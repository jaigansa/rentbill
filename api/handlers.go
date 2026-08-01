package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"net/smtp"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// --- AUTH HANDLERS ---

type blockInfo struct {
	Attempts     int
	BlockedUntil time.Time
}

var (
	loginTrackerMutex sync.Mutex
	loginBlocks       = make(map[string]*blockInfo)
)

func VerifyPin(c *gin.Context) {
	ip := c.ClientIP()

	loginTrackerMutex.Lock()
	block, exists := loginBlocks[ip]
	if exists && time.Now().Before(block.BlockedUntil) {
		loginTrackerMutex.Unlock()
		remaining := time.Until(block.BlockedUntil).Round(time.Second)
		c.JSON(http.StatusTooManyRequests, gin.H{"error": fmt.Sprintf("Too many failed attempts. Try again in %v.", remaining)})
		return
	}
	loginTrackerMutex.Unlock()

	var req struct {
		Pin string `json:"pin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN/Password required"})
		return
	}

	role := ""
	if CheckPasswordHash(req.Pin, AppConfig.MasterPinHash) {
		role = "owner"
	} else if CheckPasswordHash(req.Pin, AppConfig.StaffPinHash) {
		role = "staff"
	}

	if role != "" {
		// Reset tracking on successful login
		loginTrackerMutex.Lock()
		delete(loginBlocks, ip)
		loginTrackerMutex.Unlock()

		session := sessions.Default(c)
		session.Set("user", AppConfig.Username)
		session.Set("role", role)
		if err := session.Save(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to establish session"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "role": role})
	} else {
		// Track failure
		loginTrackerMutex.Lock()
		if !exists {
			block = &blockInfo{}
			loginBlocks[ip] = block
		}
		block.Attempts++
		if block.Attempts >= 5 {
			block.BlockedUntil = time.Now().Add(5 * time.Minute)
			loginTrackerMutex.Unlock()
			c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many failed attempts. Login locked for 5 minutes."})
			return
		}
		loginTrackerMutex.Unlock()
		c.JSON(http.StatusUnauthorized, gin.H{"error": fmt.Sprintf("Invalid password. %d attempts remaining.", 5-block.Attempts)})
	}
}

func ForgotPin(c *gin.Context) {
	if AppConfig.EmailUser == "" || AppConfig.EmailPass == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMTP credentials not configured"})
		return
	}

	var req struct {
		Role   string `json:"role"`    // "admin" or "tenant"
		Room   string `json:"room_no"` // for tenant
		Mobile string `json:"mobile"`  // for tenant
		Email  string `json:"email"`   // for tenant
	}
	c.ShouldBindJSON(&req)

	if req.Role == "tenant" {
		var r struct {
			ID           int
			Name         string
			RoomNo       string
			MobileNumber string
			Email        string
		}
		var err error
		if req.Room != "" && req.Mobile != "" {
			err = DB.QueryRow("SELECT id, name, room_no, mobile_number, COALESCE(email, '') FROM renters WHERE room_no = ? AND mobile_number = ? AND is_active = 1", req.Room, req.Mobile).Scan(&r.ID, &r.Name, &r.RoomNo, &r.MobileNumber, &r.Email)
		} else if req.Room != "" {
			err = DB.QueryRow("SELECT id, name, room_no, mobile_number, COALESCE(email, '') FROM renters WHERE room_no = ? AND is_active = 1", req.Room).Scan(&r.ID, &r.Name, &r.RoomNo, &r.MobileNumber, &r.Email)
		} else if req.Mobile != "" {
			err = DB.QueryRow("SELECT id, name, room_no, mobile_number, COALESCE(email, '') FROM renters WHERE mobile_number = ? AND is_active = 1", req.Mobile).Scan(&r.ID, &r.Name, &r.RoomNo, &r.MobileNumber, &r.Email)
		} else if req.Email != "" {
			err = DB.QueryRow("SELECT id, name, room_no, mobile_number, COALESCE(email, '') FROM renters WHERE email = ? AND is_active = 1", req.Email).Scan(&r.ID, &r.Name, &r.RoomNo, &r.MobileNumber, &r.Email)
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Please provide Unit Number, Mobile, or Registered Email"})
			return
		}

		if err != nil || r.ID == 0 {
			c.JSON(http.StatusNotFound, gin.H{"error": "Tenant record not found"})
			return
		}

		targetEmail := r.Email
		if targetEmail == "" && req.Email != "" {
			targetEmail = req.Email
		}
		if targetEmail == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "No registered email address found for this tenant. Please contact property owner."})
			return
		}

		tenantPass := GetDefaultTenantPassword(r.Name, r.MobileNumber)

		auth := smtp.PlainAuth("", AppConfig.EmailUser, AppConfig.EmailPass, AppConfig.EmailHost)
		htmlMsg := fmt.Sprintf("<h1>Tenant Portal Password Recovery</h1><p>Hello <b>%s</b> (Unit %s),</p><p>Your portal password is: <b>%s</b></p><p style=\"font-size:0.85rem; color:#666;\">(Formed by first 4 letters of your name + last 4 digits of your registered mobile number)</p>", r.Name, r.RoomNo, tenantPass)
		header := fmt.Sprintf("Subject: RentBill - Tenant Password Recovery\r\nTo: %s\r\nMIME-version: 1.0;\r\nContent-Type: text/html; charset=\"UTF-8\";\r\n\r\n", targetEmail)
		msg := []byte(header + htmlMsg)

		recipients := []string{targetEmail}
		err = smtp.SendMail(fmt.Sprintf("%s:%d", AppConfig.EmailHost, AppConfig.EmailPort), auth, AppConfig.EmailUser, recipients, msg)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send reset email: " + err.Error()})
			return
		}

		hash, _ := HashPassword(tenantPass)
		DB.Exec("UPDATE renters SET password_hash = ? WHERE id = ?", hash, r.ID)

		LogActivity("FORGOT_PASSWORD", fmt.Sprintf("Password recovery email sent to tenant %s (%s)", r.Name, targetEmail), "system", 0)
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Password emailed to " + targetEmail})
		return
	}

	var b [2]byte
	if _, err := rand.Read(b[:]); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate password"})
		return
	}
	tempPin := fmt.Sprintf("%04d", (uint32(b[0])<<8|uint32(b[1]))%10000)

	auth := smtp.PlainAuth("", AppConfig.EmailUser, AppConfig.EmailPass, AppConfig.EmailHost)
	htmlMsg := fmt.Sprintf("<h1>Password Recovery</h1><p>Temporary Admin Password: <b>%s</b></p>", tempPin)
	header := fmt.Sprintf("Subject: RentBill - Password Recovery\r\nTo: %s\r\nMIME-version: 1.0;\r\nContent-Type: text/html; charset=\"UTF-8\";\r\n\r\n", AppConfig.EmailUser)
	msg := []byte(header + htmlMsg)

	recipients := []string{AppConfig.EmailUser}
	if AppConfig.EmailBCC != "" {
		splitFn := func(c rune) bool { return c == ',' || c == ';' || c == ' ' }
		bccList := strings.FieldsFunc(AppConfig.EmailBCC, splitFn)
		for _, bcc := range bccList {
			if bcc != "" {
				recipients = append(recipients, bcc)
			}
		}
	}
	err := smtp.SendMail(fmt.Sprintf("%s:%d", AppConfig.EmailHost, AppConfig.EmailPort), auth, AppConfig.EmailUser, recipients, msg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send email"})
		return
	}

	hash, _ := HashPassword(tempPin)
	AppConfig.MasterPinHash = hash
	DB.Exec("UPDATE users SET pin_hash = ? WHERE username = ?", hash, AppConfig.Username)
	SaveConfig()
	TriggerRefresh("SETTINGS_UPDATED")

	LogActivity("FORGOT_PIN", "Reset password sent to "+AppConfig.EmailUser, AppConfig.Username, 0)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Temporary password sent to " + AppConfig.EmailUser})
}

func CheckPin(c *gin.Context) {
	var req struct {
		Pin string `json:"pin"`
	}
	if err := c.ShouldBindJSON(&req); err == nil {
		if CheckPasswordHash(req.Pin, AppConfig.MasterPinHash) {
			c.JSON(http.StatusOK, gin.H{"success": true})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid PIN"})
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN required"})
	}
}

func Logout(c *gin.Context) {
	session := sessions.Default(c)
	session.Clear()
	session.Options(sessions.Options{MaxAge: -1})
	session.Save()
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// --- SYSTEM & SETTINGS ---

func GetLogs(c *gin.Context) {
	filter := c.DefaultQuery("filter", "ALL")
	limit := c.DefaultQuery("limit", "50")
	offset := c.DefaultQuery("offset", "0")
	from := c.Query("from")
	to := c.Query("to")

	query := "SELECT id, action, details, amount, username, timestamp FROM activity_logs"
	var args []interface{}
	whereAdded := false

	switch filter {
	case "PAYMENTS":
		query += " WHERE action IN ('PAYMENT_RECORDED', 'ARREARS_CARRIED')"
		whereAdded = true
	case "BILLS":
		query += " WHERE action IN ('BILL_GENERATED', 'BILL_DELETED')"
		whereAdded = true
	case "TENANTS":
		query += " WHERE action IN ('TENANT_REGISTERED', 'TENANT_UPDATED', 'TENANT_DELETED', 'UNIT_VACATED', 'TENANT_RESTORED', 'TENANT_REMOVED')"
		whereAdded = true
	case "MAINTENANCE":
		query += " WHERE action IN ('EXPENSE_RECORDED', 'EXPENSE_REMOVED', 'OWNER_PAYOUT', 'OWNER_PAYOUT_DELETED')"
		whereAdded = true
	case "SYSTEM":
		query += " WHERE action IN ('DB_BACKUP', 'FORGOT_PIN', 'PORT_CHANGED')"
		whereAdded = true
	}

	if from != "" {
		if whereAdded {
			query += " AND DATE(timestamp) >= ?"
		} else {
			query += " WHERE DATE(timestamp) >= ?"
			whereAdded = true
		}
		args = append(args, from)
	}
	if to != "" {
		if whereAdded {
			query += " AND DATE(timestamp) <= ?"
		} else {
			query += " WHERE DATE(timestamp) <= ?"
			whereAdded = true
		}
		args = append(args, to)
	}

	query += " ORDER BY id DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var logs = []ActivityLog{}
	for rows.Next() {
		var l ActivityLog
		if err := rows.Scan(&l.ID, &l.Action, &l.Details, &l.Amount, &l.Username, &l.Timestamp); err == nil {
			logs = append(logs, l)
		}
	}
	if logs == nil {
		logs = []ActivityLog{}
	}
	c.JSON(http.StatusOK, logs)
}

func GetSettings(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"db_path":            AppConfig.DbPath,
		"username":           AppConfig.Username,
		"property_name":      AppConfig.PropertyName,
		"property_address":   AppConfig.PropertyAddress,
		"agreement_terms":    AppConfig.AgreementTerms,
		"email_user":         AppConfig.EmailUser,
		"email_host":         AppConfig.EmailHost,
		"email_port":         AppConfig.EmailPort,
		"email_bcc":          AppConfig.EmailBCC,
		"server_port":        AppConfig.ServerPort,
		"receiving_accounts": AppConfig.ReceivingAccounts,
	})
}

func UpdateSettings(c *gin.Context) {
	var req struct {
		PropertyName      *string            `json:"property_name"`
		PropertyAddress   *string            `json:"property_address"`
		AgreementTerms    *string            `json:"agreement_terms"`
		EmailUser         *string            `json:"email_user"`
		EmailPass         *string            `json:"email_pass"`
		EmailBCC          *string            `json:"email_bcc"`
		EmailHost         *string            `json:"email_host"`
		EmailPort         *int               `json:"email_port"`
		NewPin            *string            `json:"new_pin"`
		NewStaffPin       *string            `json:"new_staff_pin"`
		ServerPort        *int               `json:"server_port"`
		ReceivingAccounts []ReceivingAccount `json:"receiving_accounts"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	if req.PropertyName != nil { AppConfig.PropertyName = *req.PropertyName }
	if req.PropertyAddress != nil { AppConfig.PropertyAddress = *req.PropertyAddress }
	if req.AgreementTerms != nil { AppConfig.AgreementTerms = *req.AgreementTerms }
	if req.EmailUser != nil { AppConfig.EmailUser = *req.EmailUser }
	if req.EmailPass != nil { AppConfig.EmailPass = *req.EmailPass }
	if req.EmailBCC != nil { AppConfig.EmailBCC = *req.EmailBCC }
	if req.EmailHost != nil { AppConfig.EmailHost = *req.EmailHost }
	if req.EmailPort != nil { AppConfig.EmailPort = *req.EmailPort }
	if req.ReceivingAccounts != nil { AppConfig.ReceivingAccounts = req.ReceivingAccounts }

	portChanged := false
	if req.ServerPort != nil && *req.ServerPort > 0 && *req.ServerPort != AppConfig.ServerPort {
		AppConfig.ServerPort = *req.ServerPort
		portChanged = true
	}

	if req.NewPin != nil && *req.NewPin != "" {
		hash, err := HashPassword(*req.NewPin)
		if err == nil {
			AppConfig.MasterPinHash = hash
			DB.Exec("UPDATE users SET pin_hash = ? WHERE username = ?", hash, AppConfig.Username)
		}
	}
	if req.NewStaffPin != nil && *req.NewStaffPin != "" {
		hash, _ := HashPassword(*req.NewStaffPin)
		AppConfig.StaffPinHash = hash
	}

	SaveConfig()
	TriggerRefresh("SETTINGS_UPDATED")

	if portChanged {
		LogActivity("PORT_CHANGED", fmt.Sprintf("Port changed to %d. Restarting...", AppConfig.ServerPort), AppConfig.Username, 0)
		go func() {
			time.Sleep(2 * time.Second)
			if DB != nil { DB.Close() }
			os.Exit(0)
		}()
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "System restarting..."})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func TestEmail(c *gin.Context) {
	if AppConfig.EmailUser == "" || AppConfig.EmailPass == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMTP not configured"})
		return
	}
	auth := smtp.PlainAuth("", AppConfig.EmailUser, AppConfig.EmailPass, AppConfig.EmailHost)
	header := fmt.Sprintf("Subject: RentBill Test\r\nTo: %s\r\nMIME-version: 1.0;\r\nContent-Type: text/html; charset=\"UTF-8\";\r\n\r\n", AppConfig.EmailUser)
	msg := []byte(header + "<h1>SMTP Test Success</h1>")
	err := smtp.SendMail(fmt.Sprintf("%s:%d", AppConfig.EmailHost, AppConfig.EmailPort), auth, AppConfig.EmailUser, []string{AppConfig.EmailUser}, msg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Connection failed: " + err.Error() + ". If using Gmail, ensure you use an App Password."})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func CreateBackup(c *gin.Context) {
	var req struct { Filename string `json:"filename"` }
	c.ShouldBindJSON(&req)
	cleanName := "manual_backup"
	if req.Filename != "" {
		cleanName = ""
		for _, r := range req.Filename {
			if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
				cleanName += string(r)
			}
		}
	}
	backupName := fmt.Sprintf("%s_%s.db", time.Now().Format("2006-01-02"), cleanName)
	backupPath := filepath.Join(BackupsDir, backupName)
	os.Remove(backupPath)
	_, err := DB.Exec(fmt.Sprintf("VACUUM INTO '%s'", backupPath))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	LogActivity("DB_BACKUP", "Created backup: "+backupName, AppConfig.Username, 0)
	c.File(backupPath)
}

func RestoreDatabase(c *gin.Context) {
	pin := c.PostForm("pin")
	if !CheckPasswordHash(pin, AppConfig.MasterPinHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Incorrect PIN"})
		return
	}
	file, err := c.FormFile("backup_file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file"})
		return
	}
	restorePath := "./rentbill.db.restore"
	if err := c.SaveUploadedFile(file, restorePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Save failed"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Restoring... restarting."})
	go func() {
		time.Sleep(2 * time.Second)
		if DB != nil { DB.Close() }
		os.Rename(AppConfig.DbPath, AppConfig.DbPath+".bak")
		os.Rename(restorePath, AppConfig.DbPath)
		os.Exit(0)
	}()
}

// --- MANAGEMENT (RENTERS & BILLS) ---

func calcDefaultAgreementExpiry(moveInDate string, customExpiry string) string {
	if strings.TrimSpace(customExpiry) != "" {
		return customExpiry
	}
	if strings.TrimSpace(moveInDate) == "" {
		return time.Now().AddDate(0, 11, 0).Format("2006-01-02")
	}
	t, err := time.Parse("2006-01-02", moveInDate)
	if err != nil {
		return time.Now().AddDate(0, 11, 0).Format("2006-01-02")
	}
	return t.AddDate(0, 11, 0).Format("2006-01-02")
}

func GetRenters(c *gin.Context) {
	limit := c.DefaultQuery("limit", "100")
	offset := c.DefaultQuery("offset", "0")
	rows, err := DB.Query("SELECT id, name, room_no, aadhar_no, move_in_date, advance_amount, base_rent, eb_unit_price, water_maint, is_active, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears, COALESCE(agreement_expiry_date, ''), COALESCE(water_calc_mode, 'FIXED'), COALESCE(water_unit_price, 0), COALESCE(initial_water, 0), COALESCE(maint_charge, 0) FROM renters WHERE is_active = 1 ORDER BY room_no ASC LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var renters = []Renter{}
	for rows.Next() {
		var r Renter
		var expDate string
		rows.Scan(&r.ID, &r.Name, &r.RoomNo, &r.AadharNo, &r.MoveInDate, &r.AdvanceAmount, &r.BaseRent, &r.EBUnitPrice, &r.WaterMaint, &r.IsActive, &r.MobileNumber, &r.Email, &r.InitialEB, &r.PermanentAddr, &r.EmergencyContact, &r.Occupation, &r.AssignedUPI, &r.PendingArrears, &expDate, &r.WaterCalcMode, &r.WaterUnitPrice, &r.InitialWater, &r.MaintCharge)
		if expDate == "" {
			expDate = calcDefaultAgreementExpiry(r.MoveInDate, "")
			DB.Exec("UPDATE renters SET agreement_expiry_date = ? WHERE id = ?", expDate, r.ID)
		}
		r.AgreementExpiryDate = expDate
		renters = append(renters, r)
	}
	if renters == nil { renters = []Renter{} }
	c.JSON(http.StatusOK, renters)
}

func GetRenter(c *gin.Context) {
	var r Renter
	var expDate string
	err := DB.QueryRow(`SELECT id, name, room_no, aadhar_no, move_in_date, advance_amount, base_rent, eb_unit_price, water_maint, is_active, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears, vacate_date, exit_refund_amount, exit_dues_deducted, exit_repairs_deducted, exit_refund_label, exit_balance, exit_eb_reading, exit_reason, exit_rent_due, exit_eb_due, COALESCE(agreement_expiry_date, ''), COALESCE(water_calc_mode, 'FIXED'), COALESCE(water_unit_price, 0), COALESCE(initial_water, 0), COALESCE(maint_charge, 0) FROM renters WHERE id = ?`, c.Param("id")).Scan(
		&r.ID, &r.Name, &r.RoomNo, &r.AadharNo, &r.MoveInDate, &r.AdvanceAmount, &r.BaseRent, &r.EBUnitPrice, &r.WaterMaint, &r.IsActive, &r.MobileNumber, &r.Email, &r.InitialEB, &r.PermanentAddr, &r.EmergencyContact, &r.Occupation, &r.AssignedUPI, &r.PendingArrears,
		&r.VacateDate, &r.ExitRefundAmount, &r.ExitDuesDeducted, &r.ExitRepairsDeducted, &r.ExitRefundLabel, &r.ExitBalance, &r.ExitEBReading, &r.ExitReason, &r.ExitRentDue, &r.ExitEBDue, &expDate, &r.WaterCalcMode, &r.WaterUnitPrice, &r.InitialWater, &r.MaintCharge,
	)
	if err == nil {
		if expDate == "" {
			expDate = calcDefaultAgreementExpiry(r.MoveInDate, "")
			DB.Exec("UPDATE renters SET agreement_expiry_date = ? WHERE id = ?", expDate, r.ID)
		}
		r.AgreementExpiryDate = expDate
		c.JSON(http.StatusOK, r)
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	}
}

func CreateRenter(c *gin.Context) {
	var r Renter
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	r.AgreementExpiryDate = calcDefaultAgreementExpiry(r.MoveInDate, r.AgreementExpiryDate)
	if r.WaterCalcMode == "" { r.WaterCalcMode = "FIXED" }
	res, err := DB.Exec(`INSERT INTO renters (name, room_no, aadhar_no, base_rent, eb_unit_price, water_maint, advance_amount, move_in_date, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears, agreement_expiry_date, water_calc_mode, water_unit_price, initial_water, maint_charge) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, r.Name, r.RoomNo, r.AadharNo, r.BaseRent, r.EBUnitPrice, r.WaterMaint, r.AdvanceAmount, r.MoveInDate, r.MobileNumber, r.Email, r.InitialEB, r.PermanentAddr, r.EmergencyContact, r.Occupation, r.AssignedUPI, r.PendingArrears, r.AgreementExpiryDate, r.WaterCalcMode, r.WaterUnitPrice, r.InitialWater, r.MaintCharge)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	id, _ := res.LastInsertId()
	LogActivity("TENANT_REGISTERED", fmt.Sprintf("Registered %s for Unit %s (Expiry: %s)", r.Name, r.RoomNo, r.AgreementExpiryDate), AppConfig.Username, 0)
	TriggerRefresh("TENANT_REGISTERED")
	c.JSON(http.StatusOK, gin.H{"id": id})
}

func UpdateRenter(c *gin.Context) {
	var r Renter
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	r.AgreementExpiryDate = calcDefaultAgreementExpiry(r.MoveInDate, r.AgreementExpiryDate)
	if r.WaterCalcMode == "" { r.WaterCalcMode = "FIXED" }
	_, err := DB.Exec(`UPDATE renters SET name=?, room_no=?, aadhar_no=?, base_rent=?, eb_unit_price=?, water_maint=?, advance_amount=?, move_in_date=?, mobile_number=?, email=?, initial_eb=?, perm_address=?, emergency_contact=?, occupation=?, assigned_upi=?, pending_arrears=?, agreement_expiry_date=?, water_calc_mode=?, water_unit_price=?, initial_water=?, maint_charge=? WHERE id=?`,
		r.Name, r.RoomNo, r.AadharNo, r.BaseRent, r.EBUnitPrice, r.WaterMaint, r.AdvanceAmount, r.MoveInDate, r.MobileNumber, r.Email, r.InitialEB, r.PermanentAddr, r.EmergencyContact, r.Occupation, r.AssignedUPI, r.PendingArrears, r.AgreementExpiryDate, r.WaterCalcMode, r.WaterUnitPrice, r.InitialWater, r.MaintCharge, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	LogActivity("TENANT_UPDATED", fmt.Sprintf("Updated %s", r.Name), AppConfig.Username, 0)
	TriggerRefresh("TENANT_UPDATED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func GetExpiringAgreements(c *gin.Context) {
	rows, err := DB.Query(`
		SELECT id, name, room_no, move_in_date, COALESCE(agreement_expiry_date, '')
		FROM renters
		WHERE is_active = 1
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	type ExpiringItem struct {
		ID         int    `json:"id"`
		Name       string `json:"name"`
		RoomNo     string `json:"room_no"`
		MoveInDate string `json:"move_in_date"`
		ExpiryDate string `json:"agreement_expiry_date"`
		DaysLeft   int    `json:"days_left"`
		IsExpired  bool   `json:"is_expired"`
	}

	var results = []ExpiringItem{}
	now := time.Now().Truncate(24 * time.Hour)

	for rows.Next() {
		var item ExpiringItem
		var rawExpiry string
		rows.Scan(&item.ID, &item.Name, &item.RoomNo, &item.MoveInDate, &rawExpiry)

		if rawExpiry == "" {
			rawExpiry = calcDefaultAgreementExpiry(item.MoveInDate, "")
			DB.Exec("UPDATE renters SET agreement_expiry_date = ? WHERE id = ?", rawExpiry, item.ID)
		}
		item.ExpiryDate = rawExpiry

		expTime, err := time.Parse("2006-01-02", rawExpiry)
		if err != nil {
			continue
		}

		daysLeft := int(expTime.Sub(now).Hours() / 24)
		item.DaysLeft = daysLeft
		item.IsExpired = daysLeft < 0

		if daysLeft <= 30 {
			results = append(results, item)
		}
	}

	c.JSON(http.StatusOK, results)
}

func RenewTenantAgreement(c *gin.Context) {
	renterID := c.Param("id")
	var r Renter
	var rawExpiry sql.NullString
	err := DB.QueryRow("SELECT id, name, room_no, move_in_date, COALESCE(agreement_expiry_date, '') FROM renters WHERE id = ? AND is_active = 1", renterID).Scan(&r.ID, &r.Name, &r.RoomNo, &r.MoveInDate, &rawExpiry)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Active tenant not found"})
		return
	}

	baseDate := time.Now()
	if rawExpiry.Valid && rawExpiry.String != "" {
		if parsed, err := time.Parse("2006-01-02", rawExpiry.String); err == nil && parsed.After(time.Now()) {
			baseDate = parsed
		}
	}
	newExpiryDate := baseDate.AddDate(0, 11, 0).Format("2006-01-02")

	_, err = DB.Exec("UPDATE renters SET agreement_expiry_date = ? WHERE id = ?", newExpiryDate, renterID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to extend agreement"})
		return
	}

	LogActivity("AGREEMENT_RENEWED", fmt.Sprintf("Renewed 11-month agreement for %s (Unit %s) until %s", r.Name, r.RoomNo, newExpiryDate), AppConfig.Username, 0)
	TriggerRefresh("AGREEMENT_RENEWED")
	c.JSON(http.StatusOK, gin.H{"success": true, "new_expiry_date": newExpiryDate, "message": "Agreement renewed for 11 months!"})
}

func MarkVacant(c *gin.Context) {
	var req struct {
		ID            int     `json:"id"`
		Refund        string  `json:"refund_amount"`
		Dues          float64 `json:"dues_deducted"`
		Repairs       float64 `json:"repairs_deducted"`
		RefundLabel   string  `json:"refund_label"`
		FinalBalance  float64 `json:"final_balance"`
		VacateDate    string  `json:"vacate_date"`
		ExitEBReading string  `json:"exit_eb_reading"`
		ExitRentDue   float64 `json:"exit_rent_due"`
		ExitEBDue     float64 `json:"exit_eb_due"`
		ExitReason    string  `json:"exit_reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	var name string
	DB.QueryRow("SELECT name FROM renters WHERE id = ?", req.ID).Scan(&name)
	newArrears := 0.0
	if req.FinalBalance < 0 {
		newArrears = -req.FinalBalance
	}
	_, err := DB.Exec(`UPDATE renters SET 
		is_active = 0, 
		pending_arrears = ?, 
		vacate_date = ?, 
		exit_refund_amount = ?, 
		exit_dues_deducted = ?, 
		exit_repairs_deducted = ?, 
		exit_refund_label = ?, 
		exit_balance = ?, 
		exit_eb_reading = ?, 
		exit_reason = ?,
		exit_rent_due = ?,
		exit_eb_due = ?
		WHERE id = ?`,
		newArrears, req.VacateDate, req.Refund, req.Dues, req.Repairs, req.RefundLabel, req.FinalBalance, req.ExitEBReading, req.ExitReason, req.ExitRentDue, req.ExitEBDue, req.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	LogActivity("UNIT_VACATED", fmt.Sprintf("Tenant %s vacated. %s: %s (New Arrears: %.2f)", name, req.RefundLabel, req.Refund, newArrears), AppConfig.Username, 0)
	TriggerRefresh("UNIT_VACATED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func RestoreRenter(c *gin.Context) {
	var body struct { ID int `json:"id"` }
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	_, err := DB.Exec(`UPDATE renters SET 
		is_active = 1, 
		vacate_date = NULL, 
		exit_refund_amount = NULL, 
		exit_dues_deducted = 0, 
		exit_repairs_deducted = 0, 
		exit_refund_label = NULL, 
		exit_balance = 0, 
		exit_eb_reading = NULL, 
		exit_reason = NULL,
		exit_rent_due = 0,
		exit_eb_due = 0 
		WHERE id = ?`, body.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	LogActivity("TENANT_RESTORED", "Tenant restored", AppConfig.Username, 0)
	TriggerRefresh("TENANT_RESTORED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func GetRenterHistory(c *gin.Context) {
	limit := c.DefaultQuery("limit", "100")
	rows, err := DB.Query("SELECT id, name, room_no, aadhar_no, move_in_date, advance_amount, base_rent, eb_unit_price, water_maint, is_active, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears, vacate_date, exit_refund_amount, exit_dues_deducted, exit_repairs_deducted, exit_refund_label, exit_balance, exit_eb_reading, exit_reason, exit_rent_due, exit_eb_due, COALESCE(maint_charge, 0) FROM renters WHERE is_active = 0 ORDER BY vacate_date DESC, move_in_date DESC LIMIT ?", limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var renters = []Renter{}
	for rows.Next() {
		var r Renter
		err := rows.Scan(
			&r.ID, &r.Name, &r.RoomNo, &r.AadharNo, &r.MoveInDate, &r.AdvanceAmount, &r.BaseRent, &r.EBUnitPrice, &r.WaterMaint, &r.IsActive, &r.MobileNumber, &r.Email, &r.InitialEB, &r.PermanentAddr, &r.EmergencyContact, &r.Occupation, &r.AssignedUPI, &r.PendingArrears,
			&r.VacateDate, &r.ExitRefundAmount, &r.ExitDuesDeducted, &r.ExitRepairsDeducted, &r.ExitRefundLabel, &r.ExitBalance, &r.ExitEBReading, &r.ExitReason, &r.ExitRentDue, &r.ExitEBDue, &r.MaintCharge,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to scan history"})
			return
		}
		renters = append(renters, r)
	}
	if renters == nil { renters = []Renter{} }
	c.JSON(http.StatusOK, renters)
}

func DeleteRenter(c *gin.Context) {
	DB.Exec("UPDATE renters SET is_active = -1 WHERE id = ?", c.Param("id"))
	LogActivity("TENANT_REMOVED", "Tenant removed "+c.Param("id"), AppConfig.Username, 0)
	TriggerRefresh("TENANT_DELETED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func ExportRentersCSV(c *gin.Context) {
	rows, _ := DB.Query("SELECT name, room_no, mobile_number, email, aadhar_no, base_rent, water_maint, advance_amount, move_in_date, occupation, assigned_upi, eb_unit_price, initial_eb, pending_arrears, COALESCE(maint_charge, 0) FROM renters WHERE is_active = 1 ORDER BY room_no ASC")
	defer rows.Close()
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=units.csv")
	fmt.Fprintln(c.Writer, "Name,Unit,Mobile,Email,Aadhar,Base Rent,Water Charge,Advance,Move-in Date,Occupation,Assigned Owner,EB Rate,Initial EB,Arrears,Maintenance")
	for rows.Next() {
		var r struct { Name, Room, Mobile, Email, Aadhar, MoveIn, Job, UPI string; Rent, Water, Advance, EBRate, InitialEB, Arrears, Maint float64 }
		rows.Scan(&r.Name, &r.Room, &r.Mobile, &r.Email, &r.Aadhar, &r.Rent, &r.Water, &r.Advance, &r.MoveIn, &r.Job, &r.UPI, &r.EBRate, &r.InitialEB, &r.Arrears, &r.Maint)
		fmt.Fprintf(c.Writer, "\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%.2f,%.2f,%.2f,\"%s\",\"%s\",\"%s\",%.2f,%.2f,%.2f,%.2f\n", r.Name, r.Room, r.Mobile, r.Email, r.Aadhar, r.Rent, r.Water, r.Advance, r.MoveIn, r.Job, r.UPI, r.EBRate, r.InitialEB, r.Arrears, r.Maint)
	}
}

func ImportRentersCSV(c *gin.Context) {
	file, _ := c.FormFile("csv_file")
	f, _ := file.Open()
	defer f.Close()
	reader := csv.NewReader(f)
	reader.Read() // Skip header
	count := 0
	for {
		rec, err := reader.Read()
		if err == io.EOF { break }
		if len(rec) < 11 { continue }
		rent, _ := strconv.ParseFloat(rec[5], 64)
		water, _ := strconv.ParseFloat(rec[6], 64)
		advance, _ := strconv.ParseFloat(rec[7], 64)
		ebRate, _ := strconv.ParseFloat(rec[11], 64)
		if ebRate == 0 { ebRate = 9.0 }
		initialEB, _ := strconv.ParseFloat(rec[12], 64)
		arrears, _ := strconv.ParseFloat(rec[13], 64)
		maint := 0.0
		if len(rec) > 14 {
			maint, _ = strconv.ParseFloat(rec[14], 64)
		}
		_, err = DB.Exec(`INSERT INTO renters (name, room_no, aadhar_no, base_rent, eb_unit_price, water_maint, advance_amount, move_in_date, mobile_number, email, initial_eb, occupation, assigned_upi, pending_arrears, maint_charge) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, rec[0], rec[1], rec[4], rent, ebRate, water, advance, rec[8], rec[2], rec[3], initialEB, rec[9], rec[10], arrears, maint)
		if err == nil { count++ }
	}
	LogActivity("DATA_IMPORT", fmt.Sprintf("Imported %d units", count), AppConfig.Username, 0)
	c.JSON(http.StatusOK, gin.H{"success": true, "count": count})
}

func GetBills(c *gin.Context) {
	rows, _ := DB.Query("SELECT id, renter_id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, is_paid, payment_method, payment_details, payment_date, COALESCE(date_generated, CURRENT_DATE), notes, rent_amount, water_amount, paid_amount, discount_amount, write_off_amount, arrears_amount, arrears_included, COALESCE(prev_water_reading, 0), COALESCE(curr_water_reading, 0), COALESCE(water_unit_price, 0), COALESCE(water_calc_mode, 'FIXED'), COALESCE(maint_amount, 0) FROM bills WHERE renter_id = ? ORDER BY date_generated DESC LIMIT 20", c.Param("renter_id"))
	defer rows.Close()
	var bills = []Bill{}
	for rows.Next() {
		var b Bill
		rows.Scan(&b.ID, &b.RenterID, &b.BillingMonth, &b.PrevEBReading, &b.CurrEBReading, &b.Others, &b.TotalAmount, &b.IsPaid, &b.PaymentMethod, &b.PaymentDetails, &b.PaymentDate, &b.DateGenerated, &b.Notes, &b.RentAmount, &b.WaterAmount, &b.PaidAmount, &b.DiscountAmount, &b.WriteOffAmount, &b.ArrearsAmount, &b.ArrearsIncluded, &b.PrevWaterReading, &b.CurrWaterReading, &b.WaterUnitPrice, &b.WaterCalcMode, &b.MaintAmount)
		bills = append(bills, b)
	}
	if bills == nil { bills = []Bill{} }
	c.JSON(http.StatusOK, bills)
}

func GetBill(c *gin.Context) {
	var b Bill
	err := DB.QueryRow("SELECT id, renter_id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, is_paid, payment_method, payment_details, payment_date, COALESCE(date_generated, CURRENT_DATE), notes, rent_amount, water_amount, paid_amount, discount_amount, write_off_amount, arrears_amount, arrears_included, COALESCE(prev_water_reading, 0), COALESCE(curr_water_reading, 0), COALESCE(water_unit_price, 0), COALESCE(water_calc_mode, 'FIXED'), COALESCE(maint_amount, 0) FROM bills WHERE id = ?", c.Param("id")).Scan(&b.ID, &b.RenterID, &b.BillingMonth, &b.PrevEBReading, &b.CurrEBReading, &b.Others, &b.TotalAmount, &b.IsPaid, &b.PaymentMethod, &b.PaymentDetails, &b.PaymentDate, &b.DateGenerated, &b.Notes, &b.RentAmount, &b.WaterAmount, &b.PaidAmount, &b.DiscountAmount, &b.WriteOffAmount, &b.ArrearsAmount, &b.ArrearsIncluded, &b.PrevWaterReading, &b.CurrWaterReading, &b.WaterUnitPrice, &b.WaterCalcMode, &b.MaintAmount)
	if err == nil { c.JSON(http.StatusOK, b) } else { c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}) }
}

func CreateBill(c *gin.Context) {
	var b Bill
	if err := c.ShouldBindJSON(&b); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"}); return }
	var r Renter
	DB.QueryRow("SELECT name, base_rent, water_maint, eb_unit_price, pending_arrears, COALESCE(water_calc_mode, 'FIXED'), COALESCE(water_unit_price, 0), COALESCE(maint_charge, 0) FROM renters WHERE id = ?", b.RenterID).Scan(&r.Name, &r.BaseRent, &r.WaterMaint, &r.EBUnitPrice, &r.PendingArrears, &r.WaterCalcMode, &r.WaterUnitPrice, &r.MaintCharge)
	
	ebUnits := b.CurrEBReading - b.PrevEBReading
	if ebUnits < 0 {
		ebUnits = 0
	}
	ebCost := ebUnits * r.EBUnitPrice

	maintAmount := b.MaintAmount
	if maintAmount == 0 { maintAmount = r.MaintCharge }

	waterCost := r.WaterMaint
	if b.WaterCalcMode == "METER" || r.WaterCalcMode == "METER" {
		wUnits := b.CurrWaterReading - b.PrevWaterReading
		if wUnits < 0 { wUnits = 0 }
		unitPrice := b.WaterUnitPrice
		if unitPrice == 0 { unitPrice = r.WaterUnitPrice }
		waterCost = wUnits * unitPrice
		b.WaterCalcMode = "METER"
		b.WaterUnitPrice = unitPrice
	} else {
		b.WaterCalcMode = "FIXED"
	}
	
	total := r.BaseRent + maintAmount + waterCost + ebCost + b.Others + b.ArrearsIncluded - b.DiscountAmount
	res, err := DB.Exec(`INSERT INTO bills (renter_id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, date_generated, notes, rent_amount, water_amount, maint_amount, arrears_included, discount_amount, prev_water_reading, curr_water_reading, water_unit_price, water_calc_mode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, b.RenterID, b.BillingMonth, b.PrevEBReading, b.CurrEBReading, b.Others, total, b.DateGenerated, b.Notes, r.BaseRent, waterCost, maintAmount, b.ArrearsIncluded, b.DiscountAmount, b.PrevWaterReading, b.CurrWaterReading, b.WaterUnitPrice, b.WaterCalcMode)
	if err == nil {
		DB.Exec("UPDATE renters SET pending_arrears = MAX(0, pending_arrears - ?) WHERE id = ?", b.ArrearsIncluded, b.RenterID)
		id, _ := res.LastInsertId()
		LogActivity("BILL_GENERATED", fmt.Sprintf("Bill for %s: %.2f", r.Name, total), AppConfig.Username, 0)
		TriggerRefresh("BILL_GENERATED")
		c.JSON(http.StatusOK, gin.H{"success": true, "id": id})
	} else { c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed"}) }
}

func CreateBatchBills(c *gin.Context) {
	var req struct {
		BillingMonth  string `json:"billing_month"`
		DateGenerated string `json:"date_generated"`
		Bills         []struct {
			RenterID         int     `json:"renter_id"`
			PrevEBReading    float64 `json:"prev_eb_reading"`
			CurrEBReading    float64 `json:"curr_eb_reading"`
			PrevWaterReading float64 `json:"prev_water_reading"`
			CurrWaterReading float64 `json:"curr_water_reading"`
			WaterUnitPrice   float64 `json:"water_unit_price"`
			WaterCalcMode    string  `json:"water_calc_mode"`
			MaintAmount      float64 `json:"maint_amount"`
			Others           float64 `json:"others"`
			DiscountAmount   float64 `json:"discount_amount"`
			ArrearsIncluded  float64 `json:"arrears_included"`
			Notes            string  `json:"notes"`
		} `json:"bills"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input payload"})
		return
	}

	if len(req.Bills) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No bill entries provided"})
		return
	}

	tx, err := DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to start database transaction"})
		return
	}

	insertedCount := 0
	for _, item := range req.Bills {
		var r Renter
		err := tx.QueryRow("SELECT name, base_rent, water_maint, eb_unit_price, COALESCE(water_calc_mode, 'FIXED'), COALESCE(water_unit_price, 0), COALESCE(maint_charge, 0) FROM renters WHERE id = ? AND is_active = 1", item.RenterID).Scan(&r.Name, &r.BaseRent, &r.WaterMaint, &r.EBUnitPrice, &r.WaterCalcMode, &r.WaterUnitPrice, &r.MaintCharge)
		if err != nil {
			continue
		}

		ebUnits := item.CurrEBReading - item.PrevEBReading
		if ebUnits < 0 {
			ebUnits = 0
		}
		ebCost := ebUnits * r.EBUnitPrice

		maintAmount := item.MaintAmount
		if maintAmount == 0 { maintAmount = r.MaintCharge }

		calcMode := item.WaterCalcMode
		if calcMode == "" { calcMode = r.WaterCalcMode }
		waterCost := r.WaterMaint
		unitPrice := item.WaterUnitPrice
		if unitPrice == 0 { unitPrice = r.WaterUnitPrice }

		if calcMode == "METER" {
			wUnits := item.CurrWaterReading - item.PrevWaterReading
			if wUnits < 0 { wUnits = 0 }
			waterCost = wUnits * unitPrice
		}

		total := r.BaseRent + maintAmount + waterCost + ebCost + item.Others + item.ArrearsIncluded - item.DiscountAmount

		dateGen := req.DateGenerated
		if dateGen == "" {
			dateGen = time.Now().Format("2006-01-02")
		}

		_, err = tx.Exec(`INSERT INTO bills (renter_id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, date_generated, notes, rent_amount, water_amount, maint_amount, arrears_included, discount_amount, prev_water_reading, curr_water_reading, water_unit_price, water_calc_mode) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, item.RenterID, req.BillingMonth, item.PrevEBReading, item.CurrEBReading, item.Others, total, dateGen, item.Notes, r.BaseRent, waterCost, maintAmount, item.ArrearsIncluded, item.DiscountAmount, item.PrevWaterReading, item.CurrWaterReading, unitPrice, calcMode)
		if err != nil {
			tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to insert bill for " + r.Name})
			return
		}

		if item.ArrearsIncluded > 0 {
			tx.Exec("UPDATE renters SET pending_arrears = MAX(0, pending_arrears - ?) WHERE id = ?", item.ArrearsIncluded, item.RenterID)
		}
		insertedCount++
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to commit bills transaction"})
		return
	}

	LogActivity("BILL_GENERATED", fmt.Sprintf("Batch Generated %d bills for %s", insertedCount, req.BillingMonth), AppConfig.Username, 0)
	TriggerRefresh("BILL_GENERATED")
	c.JSON(http.StatusOK, gin.H{"success": true, "count": insertedCount})
}

func PayBill(c *gin.Context) {
	var req struct { Method string `json:"payment_method"`; Date string `json:"payment_date"`; Details string `json:"payment_details"`; Paid float64 `json:"paid_amount"`; Disc float64 `json:"discount_amount"`; Write float64 `json:"write_off_amount"`; Arrears float64 `json:"arrears_amount"` }
	c.ShouldBindJSON(&req)
	var b Bill
	DB.QueryRow("SELECT renter_id, total_amount FROM bills WHERE id = ?", c.Param("id")).Scan(&b.RenterID, &b.TotalAmount)
	newTotal := b.TotalAmount - req.Disc - req.Write - req.Arrears
	_, err := DB.Exec("UPDATE bills SET is_paid = 1, payment_method = ?, payment_date = ?, payment_details = ?, paid_amount = ?, discount_amount = discount_amount + ?, write_off_amount = write_off_amount + ?, arrears_amount = ?, total_amount = ? WHERE id = ?", req.Method, req.Date, req.Details, req.Paid, req.Disc, req.Write, req.Arrears, newTotal, c.Param("id"))
	if err == nil {
		if req.Arrears > 0 { DB.Exec("UPDATE renters SET pending_arrears = pending_arrears + ? WHERE id = ?", req.Arrears, b.RenterID) }
		LogActivity("PAYMENT_RECORDED", fmt.Sprintf("Received %.2f", req.Paid), AppConfig.Username, req.Paid)
		TriggerRefresh("PAYMENT_RECORDED")
		c.JSON(http.StatusOK, gin.H{"success": true})
	} else { c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed"}) }
}

func DeleteBill(c *gin.Context) {
	var b struct { RID int; Inc, Amt float64 }
	DB.QueryRow("SELECT renter_id, arrears_included, arrears_amount FROM bills WHERE id = ?", c.Param("id")).Scan(&b.RID, &b.Inc, &b.Amt)
	if b.Inc > 0 { DB.Exec("UPDATE renters SET pending_arrears = pending_arrears + ? WHERE id = ?", b.Inc, b.RID) }
	if b.Amt > 0 { DB.Exec("UPDATE renters SET pending_arrears = MAX(0, pending_arrears - ?) WHERE id = ?", b.Amt, b.RID) }
	DB.Exec("DELETE FROM bills WHERE id = ?", c.Param("id"))
	TriggerRefresh("BILL_DELETED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// --- OPERATIONS (EXPENSES, TASKS, DOCS) ---

func GetExpenses(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	rows, _ := DB.Query("SELECT id, category, amount, date, notes, COALESCE(owner_name, '') FROM expenses ORDER BY date DESC LIMIT ? OFFSET ?", limit, offset)
	defer rows.Close()
	var expenses []Expense
	for rows.Next() {
		var e Expense
		rows.Scan(&e.ID, &e.Category, &e.Amount, &e.Date, &e.Notes, &e.OwnerName)
		expenses = append(expenses, e)
	}
	if expenses == nil {
		expenses = []Expense{}
	}
	c.JSON(http.StatusOK, expenses)
}

func CreateExpense(c *gin.Context) {
	var e Expense
	c.ShouldBindJSON(&e)
	res, _ := DB.Exec("INSERT INTO expenses (category, amount, date, notes, owner_name) VALUES (?, ?, ?, ?, ?)", e.Category, e.Amount, e.Date, e.Notes, e.OwnerName)
	id, _ := res.LastInsertId()
	LogActivity("EXPENSE_RECORDED", "Recorded: "+e.Category, AppConfig.Username, e.Amount)
	TriggerRefresh("EXPENSE_RECORDED")
	c.JSON(http.StatusOK, gin.H{"success": true, "id": id})
}

func DeleteExpense(c *gin.Context) {
	DB.Exec("DELETE FROM expenses WHERE id = ?", c.Param("id"))
	TriggerRefresh("EXPENSE_DELETED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func GetMaintenanceTasks(c *gin.Context) {
	status := c.Query("status")
	query := "SELECT t.id, t.renter_id, COALESCE(r.room_no, 'COMMON'), t.title, t.description, t.category, t.priority, t.status, t.owner_name, t.estimated_cost, t.actual_cost, t.date_reported, t.date_resolved, t.photo_path, t.timestamp FROM maintenance_tasks t LEFT JOIN renters r ON t.renter_id = r.id"
	var args []interface{}
	if status != "" && status != "ALL" { query += " WHERE t.status = ?"; args = append(args, status) }
	query += " ORDER BY t.priority DESC, t.timestamp DESC LIMIT 50"
	rows, _ := DB.Query(query, args...)
	defer rows.Close()
	var tasks []MaintenanceTask
	for rows.Next() {
		var t MaintenanceTask
		rows.Scan(&t.ID, &t.RenterID, &t.UnitRoom, &t.Title, &t.Description, &t.Category, &t.Priority, &t.Status, &t.OwnerName, &t.EstimatedCost, &t.ActualCost, &t.DateReported, &t.DateResolved, &t.PhotoPath, &t.Timestamp)
		tasks = append(tasks, t)
	}
	if tasks == nil { tasks = []MaintenanceTask{} }
	c.JSON(http.StatusOK, tasks)
}

func CreateMaintenanceTask(c *gin.Context) {
	var t MaintenanceTask
	c.ShouldBindJSON(&t)
	DB.Exec(`INSERT INTO maintenance_tasks (renter_id, title, description, category, priority, status, owner_name, estimated_cost, date_reported) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, t.RenterID, t.Title, t.Description, t.Category, t.Priority, t.Status, t.OwnerName, t.EstimatedCost, t.DateReported)
	TriggerRefresh("TASK_CREATED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func UpdateMaintenanceTask(c *gin.Context) {
	var t MaintenanceTask
	c.ShouldBindJSON(&t)
	DB.Exec(`UPDATE maintenance_tasks SET title=?, description=?, category=?, priority=?, status=?, owner_name=?, estimated_cost=?, actual_cost=?, date_resolved=?, photo_path=? WHERE id = ?`, t.Title, t.Description, t.Category, t.Priority, t.Status, t.OwnerName, t.EstimatedCost, t.ActualCost, t.DateResolved, t.PhotoPath, c.Param("id"))
	TriggerRefresh("TASK_UPDATED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func UploadMaintenancePhoto(c *gin.Context) {
	file, _ := c.FormFile("file")
	path := "./uploads/maintenance/" + fmt.Sprintf("%d_%s", time.Now().Unix(), file.Filename)
	c.SaveUploadedFile(file, path)
	webPath := "/uploads/maintenance/" + filepath.Base(path)
	DB.Exec("UPDATE maintenance_tasks SET photo_path = ? WHERE id = ?", webPath, c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"success": true, "path": webPath})
}

func DeleteMaintenanceTask(c *gin.Context) {
	DB.Exec("DELETE FROM maintenance_tasks WHERE id = ?", c.Param("id"))
	TriggerRefresh("TASK_DELETED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func GetOwnerWithdrawals(c *gin.Context) {
	owner := c.Query("owner")
	from := c.Query("from")
	to := c.Query("to")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	query := "SELECT id, owner_name, amount, date, notes, timestamp FROM owner_withdrawals"
	var args []interface{}
	whereAdded := false
	if owner != "" {
		query += " WHERE owner_name = ?"
		args = append(args, owner)
		whereAdded = true
	}
	if from != "" {
		if whereAdded {
			query += " AND date >= ?"
		} else {
			query += " WHERE date >= ?"
			whereAdded = true
		}
		args = append(args, from)
	}
	if to != "" {
		if whereAdded {
			query += " AND date <= ?"
		} else {
			query += " WHERE date <= ?"
			whereAdded = true
		}
		args = append(args, to)
	}

	query += " ORDER BY date DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, _ := DB.Query(query, args...)
	defer rows.Close()
	var withdrawals []OwnerWithdrawal
	for rows.Next() {
		var w OwnerWithdrawal
		rows.Scan(&w.ID, &w.OwnerName, &w.Amount, &w.Date, &w.Notes, &w.Timestamp)
		withdrawals = append(withdrawals, w)
	}
	if withdrawals == nil {
		withdrawals = []OwnerWithdrawal{}
	}
	c.JSON(http.StatusOK, withdrawals)
}

func CreateOwnerWithdrawal(c *gin.Context) {
	var w OwnerWithdrawal
	c.ShouldBindJSON(&w)
	DB.Exec("INSERT INTO owner_withdrawals (owner_name, amount, date, notes) VALUES (?, ?, ?, ?)", w.OwnerName, w.Amount, w.Date, w.Notes)
	LogActivity("OWNER_PAYOUT", fmt.Sprintf("Owner %s withdrew %.2f", w.OwnerName, w.Amount), AppConfig.Username, w.Amount)
	TriggerRefresh("OWNER_PAYOUT")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteOwnerWithdrawal(c *gin.Context) {
	DB.Exec("DELETE FROM owner_withdrawals WHERE id = ?", c.Param("id"))
	TriggerRefresh("WITHDRAWAL_DELETED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func GetDocuments(c *gin.Context) {
	rid := c.Query("renter_id")
	q := "SELECT d.id, d.renter_id, COALESCE(r.room_no, 'Global'), d.file_name, d.file_path, d.file_type, d.upload_date, d.expiry_date, d.notes FROM documents d LEFT JOIN renters r ON d.renter_id = r.id"
	var args []interface{}
	if rid != "" { q += " WHERE d.renter_id = ?"; args = append(args, rid) }
	rows, _ := DB.Query(q, args...)
	defer rows.Close()
	var docs []Document
	for rows.Next() {
		var d Document
		rows.Scan(&d.ID, &d.RenterID, &d.UnitRoom, &d.FileName, &d.FilePath, &d.FileType, &d.UploadDate, &d.ExpiryDate, &d.Notes)
		docs = append(docs, d)
	}
	if docs == nil { docs = []Document{} }
	c.JSON(http.StatusOK, docs)
}

func UploadDocument(c *gin.Context) {
	file, _ := c.FormFile("file")
	uniqueName := fmt.Sprintf("%d_%s", time.Now().UnixNano(), file.Filename)
	c.SaveUploadedFile(file, "./uploads/"+uniqueName)
	rid, _ := strconv.Atoi(c.PostForm("renter_id"))
	DB.Exec(`INSERT INTO documents (renter_id, file_name, file_path, file_type, expiry_date, notes) VALUES (?, ?, ?, ?, ?, ?)`, rid, file.Filename, "/uploads/"+uniqueName, c.PostForm("file_type"), c.PostForm("expiry_date"), c.PostForm("notes"))
	TriggerRefresh("DOCUMENT_UPLOADED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteDocument(c *gin.Context) {
	var path string
	DB.QueryRow("SELECT file_path FROM documents WHERE id = ?", c.Param("id")).Scan(&path)
	os.Remove("." + path)
	DB.Exec("DELETE FROM documents WHERE id = ?", c.Param("id"))
	TriggerRefresh("DOCUMENT_DELETED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// --- REPORTS ---

func GetFinancialSummary(c *gin.Context) {
	var s struct { TB, TP, TD, TA, TAdv float64; TC, PC int; AB, AP, AD float64; ATC, APC int }
	DB.QueryRow("SELECT COALESCE(SUM(total_amount - arrears_included + discount_amount + write_off_amount + arrears_amount), 0), COUNT(*) FROM bills").Scan(&s.TB, &s.TC)
	DB.QueryRow("SELECT COALESCE(SUM(paid_amount), 0), COUNT(*) FROM bills WHERE is_paid = 1").Scan(&s.TP, &s.PC)
	DB.QueryRow("SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE is_paid = 0").Scan(&s.TD)
	DB.QueryRow("SELECT COALESCE(SUM(advance_amount), 0) FROM renters WHERE is_active = 1").Scan(&s.TAdv)
	DB.QueryRow("SELECT COALESCE(SUM(pending_arrears), 0) FROM renters WHERE is_active = 1").Scan(&s.TA)
	c.JSON(http.StatusOK, gin.H{
		"total_billed": s.TB, "total_paid": s.TP, "total_dues": s.TD, "total_arrears": s.TA, "total_advances": s.TAdv, "total_count": s.TC, "paid_count": s.PC,
	})
}

func GetTenantLedger(c *gin.Context) {
	rows, _ := DB.Query(`SELECT r.id, r.name, r.room_no, r.advance_amount, r.pending_arrears, COALESCE((SELECT SUM(total_amount - arrears_included + discount_amount + write_off_amount + arrears_amount) FROM bills WHERE renter_id = r.id), 0), COALESCE((SELECT SUM(paid_amount) FROM bills WHERE renter_id = r.id AND is_paid = 1), 0), COALESCE((SELECT SUM(total_amount) FROM bills WHERE renter_id = r.id AND is_paid = 0), 0) FROM renters r WHERE r.is_active = 1 ORDER BY r.room_no ASC`)
	defer rows.Close()
	var ledger []interface{}
	for rows.Next() {
		var e struct { ID int; Name, Room string; Adv, Arr, Billed, Paid, Unpaid float64 }
		rows.Scan(&e.ID, &e.Name, &e.Room, &e.Adv, &e.Arr, &e.Billed, &e.Paid, &e.Unpaid)
		ledger = append(ledger, gin.H{ "id": e.ID, "name": e.Name, "room_no": e.Room, "advance": e.Adv, "pending_arrears": e.Arr, "total_billed": e.Billed, "total_paid": e.Paid, "balance": e.Unpaid + e.Arr })
	}
	if ledger == nil { ledger = []interface{}{} }
	c.JSON(http.StatusOK, ledger)
}

func GetTrendData(c *gin.Context) {
	owner := c.Query("owner")
	var trends []interface{}
	now := time.Now()
	for i := 5; i >= 0; i-- {
		t := now.AddDate(0, -i, 0)
		monthStr := t.Format("2006-01")
		var inc, maint, payout float64
		if owner != "" {
			DB.QueryRow(`SELECT COALESCE(SUM(b.paid_amount), 0) FROM bills b JOIN renters r ON b.renter_id = r.id WHERE b.is_paid = 1 AND strftime('%Y-%m', b.payment_date) = ? AND (b.payment_details = ? OR r.assigned_upi = ?)`, monthStr, owner, owner).Scan(&inc)
			DB.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE strftime('%Y-%m', date) = ? AND owner_name = ?`, monthStr, owner).Scan(&maint)
			DB.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM owner_withdrawals WHERE strftime('%Y-%m', date) = ? AND owner_name = ?`, monthStr, owner).Scan(&payout)
		} else {
			DB.QueryRow(`SELECT COALESCE(SUM(paid_amount), 0) FROM bills WHERE is_paid = 1 AND strftime('%Y-%m', payment_date) = ?`, monthStr).Scan(&inc)
			DB.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE strftime('%Y-%m', date) = ?`, monthStr).Scan(&maint)
			DB.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM owner_withdrawals WHERE strftime('%Y-%m', date) = ?`, monthStr).Scan(&payout)
		}
		trends = append(trends, gin.H{ "month": t.Format("Jan"), "income": inc, "expenses": maint + payout })
	}
	c.JSON(http.StatusOK, trends)
}

func GetAuditReport(c *gin.Context) {
	fromDate := c.Query("from")
	toDate := c.Query("to")

	if fromDate == "" || toDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Start and End dates required"})
		return
	}

	logQuery := "SELECT action, details, amount, timestamp FROM activity_logs WHERE DATE(timestamp) >= ? AND DATE(timestamp) <= ? AND action IN ('PAYMENT_RECORDED', 'EXPENSE_ADDED', 'EXPENSE_RECORDED', 'OWNER_PAYOUT') ORDER BY timestamp DESC"
	rows, _ := DB.Query(logQuery, fromDate, toDate)
	defer rows.Close()

	type AuditLog struct {
		Action    string    `json:"action"`
		Details   string    `json:"details"`
		Amount    float64   `json:"amount"`
		Timestamp time.Time `json:"timestamp"`
	}
	var logs []AuditLog
	for rows.Next() {
		var l AuditLog
		rows.Scan(&l.Action, &l.Details, &l.Amount, &l.Timestamp)
		logs = append(logs, l)
	}
	
	var summary struct {
		TotalBilled   float64 `json:"total_billed"`
		TotalPaid     float64 `json:"total_paid"`
		TotalExpenses float64 `json:"total_expenses"`
		TotalPayouts  float64 `json:"total_payouts"`
		TotalAdvances float64 `json:"total_advances"`
	}

	DB.QueryRow("SELECT COALESCE(SUM(total_amount - arrears_included), 0) FROM bills WHERE DATE(date_generated) >= ? AND DATE(date_generated) <= ?", fromDate, toDate).Scan(&summary.TotalBilled)
	DB.QueryRow("SELECT COALESCE(SUM(paid_amount), 0) FROM bills WHERE is_paid = 1 AND DATE(payment_date) >= ? AND DATE(payment_date) <= ?", fromDate, toDate).Scan(&summary.TotalPaid)
	DB.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE date >= ? AND date <= ?", fromDate, toDate).Scan(&summary.TotalExpenses)
	DB.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM owner_withdrawals WHERE date >= ? AND date <= ?", fromDate, toDate).Scan(&summary.TotalPayouts)
	DB.QueryRow("SELECT COALESCE(SUM(advance_amount), 0) FROM renters WHERE move_in_date >= ? AND move_in_date <= ?", fromDate, toDate).Scan(&summary.TotalAdvances)

	c.JSON(http.StatusOK, gin.H{
		"from":    fromDate,
		"to":      toDate,
		"logs":    logs,
		"summary": summary,
	})
}

func GetMonthlyReport(c *gin.Context) {
	month := c.Param("month") // e.g. "May 2026"
	
	// Convert "Month Year" to find the last day of that month
	t, _ := time.Parse("January 2006", month)
	reportMonthLastDay := t.AddDate(0, 1, -1).Format("2006-01-02")

	rows, _ := DB.Query(`
		SELECT r.id, r.name, r.room_no, COALESCE(b.id, 0), COALESCE(b.is_paid, 0), COALESCE(b.total_amount, 0), r.move_in_date
		FROM renters r
		LEFT JOIN bills b ON r.id = b.renter_id AND b.billing_month = ?
		WHERE r.is_active = 1 AND r.move_in_date <= ?`, month, reportMonthLastDay)
	defer rows.Close()
	
	var report = []interface{}{}
	for rows.Next() {
		var s struct { RID int; Name, Room string; BID, Paid int; Total float64; MoveIn string }
		rows.Scan(&s.RID, &s.Name, &s.Room, &s.BID, &s.Paid, &s.Total, &s.MoveIn)
		
		// Optional: If you want to be very strict and only bill if they stayed at least 1 day in that month
		report = append(report, gin.H{ 
			"renter_id": s.RID, 
			"name": s.Name, 
			"room_no": s.Room, 
			"bill_id": s.BID, 
			"is_paid": s.Paid, 
			"total": s.Total, 
			"is_billed": s.BID > 0,
			"move_in_date": s.MoveIn,
		})
	}
	c.JSON(http.StatusOK, report)
}

func GetAllPendingBills(c *gin.Context) {
	query := `SELECT b.id, b.renter_id, b.billing_month, b.total_amount, b.paid_amount, COALESCE(b.payment_details, ''), COALESCE(b.payment_date, ''), COALESCE(b.payment_method, ''), r.name, r.room_no, COALESCE(r.assigned_upi, '') 
	          FROM bills b JOIN renters r ON b.renter_id = r.id 
	          WHERE b.is_paid = 0`
	rows, _ := DB.Query(query)
	defer rows.Close()
	var bills = []interface{}{}
	for rows.Next() {
		var b struct {
			ID, RID                                                   int
			Month                                                     string
			Total, Paid                                               float64
			ReceivedBy, Date, Method, TenantName, Room, AssignedOwner string
		}
		rows.Scan(&b.ID, &b.RID, &b.Month, &b.Total, &b.Paid, &b.ReceivedBy, &b.Date, &b.Method, &b.TenantName, &b.Room, &b.AssignedOwner)

		bills = append(bills, gin.H{
			"id":             b.ID,
			"renter_id":      b.RID,
			"billing_month":  b.Month,
			"total_amount":   b.Total,
			"paid_amount":    b.Paid,
			"received_by":    b.ReceivedBy,
			"payment_date":   b.Date,
			"payment_method": b.Method,
			"tenant_name":    b.TenantName,
			"room_no":        b.Room,
			"assigned_owner": b.AssignedOwner,
		})
	}
	c.JSON(http.StatusOK, bills)
}

func GetAllPaidBills(c *gin.Context) {
	from := c.Query("from")
	to := c.Query("to")

	query := `SELECT b.id, b.renter_id, b.billing_month, b.total_amount, b.paid_amount, COALESCE(b.payment_details, ''), COALESCE(b.payment_date, ''), COALESCE(b.payment_method, ''), r.name, r.room_no, COALESCE(r.assigned_upi, '') 
	          FROM bills b JOIN renters r ON b.renter_id = r.id 
	          WHERE b.is_paid = 1`
	var args []interface{}
	if from != "" {
		query += " AND b.payment_date >= ?"
		args = append(args, from)
	}
	if to != "" {
		query += " AND b.payment_date <= ?"
		args = append(args, to)
	}

	rows, _ := DB.Query(query, args...)
	defer rows.Close()
	var bills = []interface{}{}
	for rows.Next() {
		var b struct {
			ID, RID                                                   int
			Month                                                     string
			Total, Paid                                               float64
			ReceivedBy, Date, Method, TenantName, Room, AssignedOwner string
		}
		rows.Scan(&b.ID, &b.RID, &b.Month, &b.Total, &b.Paid, &b.ReceivedBy, &b.Date, &b.Method, &b.TenantName, &b.Room, &b.AssignedOwner)

		bills = append(bills, gin.H{
			"id":             b.ID,
			"renter_id":      b.RID,
			"billing_month":  b.Month,
			"total_amount":   b.Total,
			"paid_amount":    b.Paid,
			"received_by":    b.ReceivedBy,
			"payment_date":   b.Date,
			"payment_method": b.Method,
			"tenant_name":    b.TenantName,
			"room_no":        b.Room,
			"assigned_owner": b.AssignedOwner,
		})
	}
	c.JSON(http.StatusOK, bills)
}

func GetLastEB(c *gin.Context) {
	var lastEB float64
	DB.QueryRow(`SELECT COALESCE((SELECT curr_eb_reading FROM bills WHERE renter_id = ? ORDER BY id DESC LIMIT 1), (SELECT initial_eb FROM renters WHERE id = ?))`, c.Param("renter_id"), c.Param("renter_id")).Scan(&lastEB)
	c.JSON(http.StatusOK, gin.H{"last_eb": lastEB})
}

func GetLastWaterReading(c *gin.Context) {
	var lastWater float64
	DB.QueryRow(`SELECT COALESCE((SELECT curr_water_reading FROM bills WHERE renter_id = ? AND water_calc_mode = 'METER' ORDER BY id DESC LIMIT 1), (SELECT COALESCE(initial_water, 0) FROM renters WHERE id = ?))`, c.Param("renter_id"), c.Param("renter_id")).Scan(&lastWater)
	c.JSON(http.StatusOK, gin.H{"last_water": lastWater})
}

func SendBillEmail(c *gin.Context) {
	// Minimal stub
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// --- TENANT PORTAL HANDLERS ---

func authenticateTenantRequest(c *gin.Context) (int, string, error) {
	room := c.GetHeader("X-Room-No")
	mobile := c.GetHeader("X-Mobile-No")
	if room == "" || mobile == "" {
		return 0, "", fmt.Errorf("missing room or mobile credentials")
	}
	var id int
	var name string
	err := DB.QueryRow("SELECT id, name FROM renters WHERE room_no = ? AND mobile_number = ? AND is_active = 1", room, mobile).Scan(&id, &name)
	if err != nil {
		return 0, "", fmt.Errorf("invalid tenant credentials or inactive account")
	}
	return id, name, nil
}

func GetDefaultTenantPassword(name, mobile string) string {
	var letters []rune
	for _, r := range strings.ToLower(name) {
		if r >= 'a' && r <= 'z' {
			letters = append(letters, r)
		}
	}
	first4 := string(letters)
	if len(letters) > 4 {
		first4 = string(letters[:4])
	}

	var digits []rune
	for _, r := range mobile {
		if r >= '0' && r <= '9' {
			digits = append(digits, r)
		}
	}
	last4 := string(digits)
	if len(digits) > 4 {
		last4 = string(digits[len(digits)-4:])
	}

	return first4 + last4
}

func TenantLogin(c *gin.Context) {
	var req struct {
		Room     string `json:"room_no"`
		Mobile   string `json:"mobile_number"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}
	inputSecret := req.Password
	if inputSecret == "" {
		inputSecret = req.Mobile
	}

	var r Renter
	var passHash sql.NullString
	err := DB.QueryRow("SELECT id, name, room_no, mobile_number, base_rent, pending_arrears, COALESCE(password_hash, '') FROM renters WHERE room_no = ? AND is_active = 1", req.Room).Scan(&r.ID, &r.Name, &r.RoomNo, &r.MobileNumber, &r.BaseRent, &r.PendingArrears, &passHash)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Unit Number or Password"})
		return
	}

	defaultPass := GetDefaultTenantPassword(r.Name, r.MobileNumber)
	inputLower := strings.ToLower(strings.TrimSpace(inputSecret))

	valid := false
	if passHash.Valid && passHash.String != "" {
		if CheckPasswordHash(inputSecret, passHash.String) || inputLower == defaultPass || inputSecret == r.MobileNumber {
			valid = true
		}
	} else {
		if inputLower == defaultPass || inputSecret == r.MobileNumber {
			valid = true
		}
	}

	if !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Unit Number or Password"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"id":              r.ID,
		"name":            r.Name,
		"room_no":         r.RoomNo,
		"mobile_number":   r.MobileNumber,
		"base_rent":       r.BaseRent,
		"pending_arrears": r.PendingArrears,
	})
}

func TenantChangePassword(c *gin.Context) {
	renterID, renterName, err := authenticateTenantRequest(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req struct {
		CurrentPassword string `json:"current_password"`
		NewPassword     string `json:"new_password"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.NewPassword) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current and new password required"})
		return
	}

	if len(req.NewPassword) < 4 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New password must be at least 4 characters long"})
		return
	}

	var roomNo, mobileNo string
	var passHash sql.NullString
	err = DB.QueryRow("SELECT room_no, mobile_number, COALESCE(password_hash, '') FROM renters WHERE id = ?", renterID).Scan(&roomNo, &mobileNo, &passHash)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Tenant record not found"})
		return
	}

	defaultPass := GetDefaultTenantPassword(renterName, mobileNo)
	inputLower := strings.ToLower(strings.TrimSpace(req.CurrentPassword))

	valid := false
	if passHash.Valid && passHash.String != "" {
		if CheckPasswordHash(req.CurrentPassword, passHash.String) || inputLower == defaultPass || req.CurrentPassword == mobileNo {
			valid = true
		}
	} else {
		if inputLower == defaultPass || req.CurrentPassword == mobileNo {
			valid = true
		}
	}

	if !valid {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Incorrect current password"})
		return
	}

	newHash, err := HashPassword(req.NewPassword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt new password"})
		return
	}

	_, err = DB.Exec("UPDATE renters SET password_hash = ? WHERE id = ?", newHash, renterID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	LogActivity("TENANT_PASSWORD_CHANGED", fmt.Sprintf("Tenant %s (Unit %s) updated their portal password", renterName, roomNo), "tenant", 0)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Password updated successfully!"})
}

func TenantGetBills(c *gin.Context) {
	renterID, _, err := authenticateTenantRequest(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	rows, err := DB.Query(`SELECT id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, is_paid, COALESCE(payment_method, ''), COALESCE(payment_details, ''), COALESCE(payment_date, ''), date_generated, notes, rent_amount, water_amount, paid_amount, discount_amount, write_off_amount, arrears_amount, arrears_included, COALESCE(proof_status, 'NONE'), COALESCE(proof_ref, ''), COALESCE(proof_photo, ''), COALESCE(proof_date, ''), COALESCE(maint_amount, 0) FROM bills WHERE renter_id = ? ORDER BY date_generated DESC`, renterID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database query error"})
		return
	}
	defer rows.Close()

	var bills = []Bill{}
	for rows.Next() {
		var b Bill
		var pStatus, pRef, pPhoto, pDate string
		rows.Scan(&b.ID, &b.BillingMonth, &b.PrevEBReading, &b.CurrEBReading, &b.Others, &b.TotalAmount, &b.IsPaid, &b.PaymentMethod, &b.PaymentDetails, &b.PaymentDate, &b.DateGenerated, &b.Notes, &b.RentAmount, &b.WaterAmount, &b.PaidAmount, &b.DiscountAmount, &b.WriteOffAmount, &b.ArrearsAmount, &b.ArrearsIncluded, &pStatus, &pRef, &pPhoto, &pDate, &b.MaintAmount)
		b.ProofStatus = pStatus
		b.ProofRef = &pRef
		b.ProofPhoto = &pPhoto
		b.ProofDate = &pDate
		bills = append(bills, b)
	}
	c.JSON(http.StatusOK, bills)
}

func TenantSubmitPaymentProof(c *gin.Context) {
	renterID, renterName, err := authenticateTenantRequest(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	billIDStr := c.PostForm("bill_id")
	proofRef := c.PostForm("proof_ref")

	if billIDStr == "" {
		var req struct {
			BillID int    `json:"bill_id"`
			Ref    string `json:"proof_ref"`
		}
		if err := c.ShouldBindJSON(&req); err == nil && req.BillID > 0 {
			billIDStr = strconv.Itoa(req.BillID)
			proofRef = req.Ref
		}
	}

	billID, err := strconv.Atoi(billIDStr)
	if err != nil || billID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Valid Bill ID required"})
		return
	}

	var b Bill
	err = DB.QueryRow("SELECT id, renter_id, total_amount, is_paid FROM bills WHERE id = ? AND renter_id = ?", billID, renterID).Scan(&b.ID, &b.RenterID, &b.TotalAmount, &b.IsPaid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found for this tenant"})
		return
	}
	if b.IsPaid == 1 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Bill is already marked as paid"})
		return
	}

	proofPhotoPath := ""
	file, err := c.FormFile("proof_photo")
	if err == nil {
		ext := filepath.Ext(file.Filename)
		filename := fmt.Sprintf("proof_%d_%d_%d%s", renterID, billID, time.Now().Unix(), ext)
		savePath := filepath.Join("./uploads/proofs", filename)
		if err := c.SaveUploadedFile(file, savePath); err == nil {
			proofPhotoPath = "/uploads/proofs/" + filename
		}
	}

	nowStr := time.Now().Format("2006-01-02 15:04:05")
	_, err = DB.Exec("UPDATE bills SET proof_status = 'PENDING', proof_ref = ?, proof_photo = ?, proof_date = ? WHERE id = ?", proofRef, proofPhotoPath, nowStr, billID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record payment proof"})
		return
	}

	LogActivity("PAYMENT_PROOF_SUBMITTED", fmt.Sprintf("Tenant %s submitted payment proof for Bill #%d (Ref: %s)", renterName, billID, proofRef), "tenant", b.TotalAmount)
	TriggerRefresh("PAYMENT_PROOF_SUBMITTED")
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Payment proof submitted successfully for verification."})
}

func GetPendingPaymentProofs(c *gin.Context) {
	rows, err := DB.Query(`
		SELECT b.id, b.renter_id, r.name, r.room_no, b.billing_month, b.total_amount, 
		       COALESCE(b.proof_status, 'PENDING'), COALESCE(b.proof_ref, ''), 
		       COALESCE(b.proof_photo, ''), COALESCE(b.proof_date, '')
		FROM bills b
		JOIN renters r ON b.renter_id = r.id
		WHERE b.proof_status = 'PENDING' AND b.is_paid = 0
		ORDER BY b.proof_date DESC
	`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database query error"})
		return
	}
	defer rows.Close()

	type PendingProof struct {
		BillID      int     `json:"bill_id"`
		RenterID    int     `json:"renter_id"`
		RenterName  string  `json:"renter_name"`
		RoomNo      string  `json:"room_no"`
		Month       string  `json:"billing_month"`
		TotalAmount float64 `json:"total_amount"`
		ProofStatus string  `json:"proof_status"`
		ProofRef    string  `json:"proof_ref"`
		ProofPhoto  string  `json:"proof_photo"`
		ProofDate   string  `json:"proof_date"`
	}

	var proofs = []PendingProof{}
	for rows.Next() {
		var p PendingProof
		rows.Scan(&p.BillID, &p.RenterID, &p.RenterName, &p.RoomNo, &p.Month, &p.TotalAmount, &p.ProofStatus, &p.ProofRef, &p.ProofPhoto, &p.ProofDate)
		proofs = append(proofs, p)
	}

	c.JSON(http.StatusOK, proofs)
}

func VerifyPaymentProof(c *gin.Context) {
	billID := c.Param("id")
	var req struct {
		Action string `json:"action"`
		Method string `json:"payment_method"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	var b Bill
	var renterName string
	err := DB.QueryRow(`
		SELECT b.id, b.renter_id, r.name, b.total_amount, COALESCE(b.proof_ref, '') 
		FROM bills b 
		JOIN renters r ON b.renter_id = r.id 
		WHERE b.id = ?`, billID).Scan(&b.ID, &b.RenterID, &renterName, &b.TotalAmount, &b.Notes)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found"})
		return
	}

	if req.Action == "approve" {
		method := req.Method
		if method == "" {
			method = "UPI / Online"
		}
		nowDate := time.Now().Format("2006-01-02")
		_, err := DB.Exec("UPDATE bills SET is_paid = 1, proof_status = 'APPROVED', payment_method = ?, payment_date = ?, paid_amount = total_amount WHERE id = ?", method, nowDate, billID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to approve payment"})
			return
		}

		LogActivity("PAYMENT_RECORDED", fmt.Sprintf("Approved payment of %.2f for %s (Unit %s)", b.TotalAmount, renterName, billID), AppConfig.Username, b.TotalAmount)
		TriggerRefresh("PAYMENT_RECORDED")
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Payment proof approved and marked paid."})
	} else {
		DB.Exec("UPDATE bills SET proof_status = 'REJECTED' WHERE id = ?", billID)
		LogActivity("PAYMENT_PROOF_REJECTED", fmt.Sprintf("Rejected payment proof for %s (Bill #%s)", renterName, billID), AppConfig.Username, 0)
		TriggerRefresh("PAYMENT_PROOF_REJECTED")
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Payment proof rejected."})
	}
}

func TenantGetMaintenance(c *gin.Context) {
	renterID, _, err := authenticateTenantRequest(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	rows, err := DB.Query(`SELECT id, renter_id, title, description, category, priority, status, date_reported FROM maintenance_tasks WHERE renter_id = ? ORDER BY date_reported DESC`, renterID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database query error"})
		return
	}
	defer rows.Close()

	var tasks = []interface{}{}
	for rows.Next() {
		var t struct {
			ID, RID                                      int
			Title, Description, Category, Priority, Status, Date string
		}
		rows.Scan(&t.ID, &t.RID, &t.Title, &t.Description, &t.Category, &t.Priority, &t.Status, &t.Date)
		tasks = append(tasks, gin.H{
			"id":            t.ID,
			"renter_id":     t.RID,
			"title":         t.Title,
			"description":   t.Description,
			"category":      t.Category,
			"priority":      t.Priority,
			"status":        t.Status,
			"date_reported": t.Date,
		})
	}
	c.JSON(http.StatusOK, tasks)
}

func TenantCreateMaintenance(c *gin.Context) {
	renterID, name, err := authenticateTenantRequest(c)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Category    string `json:"category"`
		Priority    string `json:"priority"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid payload"})
		return
	}

	today := time.Now().Format("2006-01-02")
	_, err = DB.Exec(`INSERT INTO maintenance_tasks (renter_id, title, description, category, priority, date_reported, status, owner_name) VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)`, renterID, req.Title, req.Description, req.Category, req.Priority, today, "Tenant: "+name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	TriggerRefresh("MAINTENANCE_UPDATED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}
