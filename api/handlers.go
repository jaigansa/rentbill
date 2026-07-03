package api

import (
	"crypto/rand"
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"net/smtp"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

// --- AUTH HANDLERS ---

func VerifyPin(c *gin.Context) {
	var req struct {
		Pin string `json:"pin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN required"})
		return
	}

	role := ""
	if CheckPasswordHash(req.Pin, AppConfig.MasterPinHash) {
		role = "owner"
	} else if CheckPasswordHash(req.Pin, AppConfig.StaffPinHash) {
		role = "staff"
	}

	if role != "" {
		session := sessions.Default(c)
		session.Set("user", AppConfig.Username)
		session.Set("role", role)
		if err := session.Save(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to establish session"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "role": role})
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid PIN"})
	}
}

func ForgotPin(c *gin.Context) {
	if AppConfig.EmailUser == "" || AppConfig.EmailPass == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMTP credentials not configured"})
		return
	}
	var b [2]byte
	if _, err := rand.Read(b[:]); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PIN"})
		return
	}
	tempPin := fmt.Sprintf("%04d", (uint32(b[0])<<8|uint32(b[1]))%10000)

	auth := smtp.PlainAuth("", AppConfig.EmailUser, AppConfig.EmailPass, AppConfig.EmailHost)
	htmlMsg := fmt.Sprintf("<h1>PIN Recovery</h1><p>Temporary PIN: <b>%s</b></p>", tempPin)
	header := fmt.Sprintf("Subject: RentBill - PIN Recovery\r\nTo: %s\r\nMIME-version: 1.0;\r\nContent-Type: text/html; charset=\"UTF-8\";\r\n\r\n", AppConfig.EmailUser)
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

	LogActivity("FORGOT_PIN", "Reset PIN sent to "+AppConfig.EmailUser, AppConfig.Username, 0)
	c.JSON(http.StatusOK, gin.H{"success": true})
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

func GetRenters(c *gin.Context) {
	limit := c.DefaultQuery("limit", "100")
	offset := c.DefaultQuery("offset", "0")
	rows, err := DB.Query("SELECT id, name, room_no, aadhar_no, move_in_date, advance_amount, base_rent, eb_unit_price, water_maint, is_active, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears FROM renters WHERE is_active = 1 ORDER BY room_no ASC LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var renters = []Renter{}
	for rows.Next() {
		var r Renter
		rows.Scan(&r.ID, &r.Name, &r.RoomNo, &r.AadharNo, &r.MoveInDate, &r.AdvanceAmount, &r.BaseRent, &r.EBUnitPrice, &r.WaterMaint, &r.IsActive, &r.MobileNumber, &r.Email, &r.InitialEB, &r.PermanentAddr, &r.EmergencyContact, &r.Occupation, &r.AssignedUPI, &r.PendingArrears)
		renters = append(renters, r)
	}
	if renters == nil { renters = []Renter{} }
	c.JSON(http.StatusOK, renters)
}

func GetRenter(c *gin.Context) {
	var r Renter
	err := DB.QueryRow("SELECT id, name, room_no, aadhar_no, move_in_date, advance_amount, base_rent, eb_unit_price, water_maint, is_active, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears FROM renters WHERE id = ?", c.Param("id")).Scan(&r.ID, &r.Name, &r.RoomNo, &r.AadharNo, &r.MoveInDate, &r.AdvanceAmount, &r.BaseRent, &r.EBUnitPrice, &r.WaterMaint, &r.IsActive, &r.MobileNumber, &r.Email, &r.InitialEB, &r.PermanentAddr, &r.EmergencyContact, &r.Occupation, &r.AssignedUPI, &r.PendingArrears)
	if err == nil { c.JSON(http.StatusOK, r) } else { c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}) }
}

func CreateRenter(c *gin.Context) {
	var r Renter
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	res, err := DB.Exec(`INSERT INTO renters (name, room_no, aadhar_no, base_rent, eb_unit_price, water_maint, advance_amount, move_in_date, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, r.Name, r.RoomNo, r.AadharNo, r.BaseRent, r.EBUnitPrice, r.WaterMaint, r.AdvanceAmount, r.MoveInDate, r.MobileNumber, r.Email, r.InitialEB, r.PermanentAddr, r.EmergencyContact, r.Occupation, r.AssignedUPI, r.PendingArrears)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	id, _ := res.LastInsertId()
	LogActivity("TENANT_REGISTERED", fmt.Sprintf("Registered %s for Unit %s", r.Name, r.RoomNo), AppConfig.Username, 0)
	TriggerRefresh("TENANT_REGISTERED")
	c.JSON(http.StatusOK, gin.H{"id": id})
}

func UpdateRenter(c *gin.Context) {
	var r Renter
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	_, err := DB.Exec(`UPDATE renters SET name=?, room_no=?, aadhar_no=?, base_rent=?, eb_unit_price=?, water_maint=?, advance_amount=?, move_in_date=?, mobile_number=?, email=?, initial_eb=?, perm_address=?, emergency_contact=?, occupation=?, assigned_upi=?, pending_arrears=? WHERE id=?`,
		r.Name, r.RoomNo, r.AadharNo, r.BaseRent, r.EBUnitPrice, r.WaterMaint, r.AdvanceAmount, r.MoveInDate, r.MobileNumber, r.Email, r.InitialEB, r.PermanentAddr, r.EmergencyContact, r.Occupation, r.AssignedUPI, r.PendingArrears, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	LogActivity("TENANT_UPDATED", fmt.Sprintf("Updated %s", r.Name), AppConfig.Username, 0)
	TriggerRefresh("TENANT_UPDATED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func MarkVacant(c *gin.Context) {
	var req struct {
		ID int `json:"id"`; Refund string `json:"refund_amount"`; Dues float64 `json:"dues_deducted"`; Repairs float64 `json:"repairs_deducted"`; RefundLabel string `json:"refund_label"`; FinalBalance float64 `json:"final_balance"`
	}
	c.ShouldBindJSON(&req)
	var name string
	DB.QueryRow("SELECT name FROM renters WHERE id = ?", req.ID).Scan(&name)
	newArrears := 0.0
	if req.FinalBalance < 0 { newArrears = -req.FinalBalance }
	DB.Exec("UPDATE renters SET is_active = 0, pending_arrears = ? WHERE id = ?", newArrears, req.ID)
	LogActivity("UNIT_VACATED", fmt.Sprintf("Tenant %s vacated. %s: %s (New Arrears: %.2f)", name, req.RefundLabel, req.Refund, newArrears), AppConfig.Username, 0)
	TriggerRefresh("UNIT_VACATED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func RestoreRenter(c *gin.Context) {
	var body struct { ID int `json:"id"` }
	c.ShouldBindJSON(&body)
	DB.Exec("UPDATE renters SET is_active = 1 WHERE id = ?", body.ID)
	LogActivity("TENANT_RESTORED", "Tenant restored", AppConfig.Username, 0)
	TriggerRefresh("TENANT_RESTORED")
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func GetRenterHistory(c *gin.Context) {
	limit := c.DefaultQuery("limit", "100")
	rows, err := DB.Query("SELECT id, name, room_no, aadhar_no, move_in_date, advance_amount, base_rent, eb_unit_price, water_maint, is_active, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears FROM renters WHERE is_active = 0 ORDER BY move_in_date DESC LIMIT ?", limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var renters = []Renter{}
	for rows.Next() {
		var r Renter
		rows.Scan(&r.ID, &r.Name, &r.RoomNo, &r.AadharNo, &r.MoveInDate, &r.AdvanceAmount, &r.BaseRent, &r.EBUnitPrice, &r.WaterMaint, &r.IsActive, &r.MobileNumber, &r.Email, &r.InitialEB, &r.PermanentAddr, &r.EmergencyContact, &r.Occupation, &r.AssignedUPI, &r.PendingArrears)
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
	rows, _ := DB.Query("SELECT name, room_no, mobile_number, email, aadhar_no, base_rent, water_maint, advance_amount, move_in_date, occupation, assigned_upi, eb_unit_price, initial_eb, pending_arrears FROM renters WHERE is_active = 1 ORDER BY room_no ASC")
	defer rows.Close()
	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=units.csv")
	fmt.Fprintln(c.Writer, "Name,Unit,Mobile,Email,Aadhar,Base Rent,Water/Maint,Advance,Move-in Date,Occupation,Assigned Owner,EB Rate,Initial EB,Arrears")
	for rows.Next() {
		var r struct { Name, Room, Mobile, Email, Aadhar, MoveIn, Job, UPI string; Rent, Water, Advance, EBRate, InitialEB, Arrears float64 }
		rows.Scan(&r.Name, &r.Room, &r.Mobile, &r.Email, &r.Aadhar, &r.Rent, &r.Water, &r.Advance, &r.MoveIn, &r.Job, &r.UPI, &r.EBRate, &r.InitialEB, &r.Arrears)
		fmt.Fprintf(c.Writer, "\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%.2f,%.2f,%.2f,\"%s\",\"%s\",\"%s\",%.2f,%.2f,%.2f\n", r.Name, r.Room, r.Mobile, r.Email, r.Aadhar, r.Rent, r.Water, r.Advance, r.MoveIn, r.Job, r.UPI, r.EBRate, r.InitialEB, r.Arrears)
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
		_, err = DB.Exec(`INSERT INTO renters (name, room_no, aadhar_no, base_rent, eb_unit_price, water_maint, advance_amount, move_in_date, mobile_number, email, initial_eb, occupation, assigned_upi, pending_arrears) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, rec[0], rec[1], rec[4], rent, ebRate, water, advance, rec[8], rec[2], rec[3], initialEB, rec[9], rec[10], arrears)
		if err == nil { count++ }
	}
	LogActivity("DATA_IMPORT", fmt.Sprintf("Imported %d units", count), AppConfig.Username, 0)
	c.JSON(http.StatusOK, gin.H{"success": true, "count": count})
}

func GetBills(c *gin.Context) {
	rows, _ := DB.Query("SELECT id, renter_id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, is_paid, payment_method, payment_details, payment_date, COALESCE(date_generated, CURRENT_DATE), notes, rent_amount, water_amount, paid_amount, discount_amount, write_off_amount, arrears_amount, arrears_included FROM bills WHERE renter_id = ? ORDER BY date_generated DESC LIMIT 20", c.Param("renter_id"))
	defer rows.Close()
	var bills = []Bill{}
	for rows.Next() {
		var b Bill
		rows.Scan(&b.ID, &b.RenterID, &b.BillingMonth, &b.PrevEBReading, &b.CurrEBReading, &b.Others, &b.TotalAmount, &b.IsPaid, &b.PaymentMethod, &b.PaymentDetails, &b.PaymentDate, &b.DateGenerated, &b.Notes, &b.RentAmount, &b.WaterAmount, &b.PaidAmount, &b.DiscountAmount, &b.WriteOffAmount, &b.ArrearsAmount, &b.ArrearsIncluded)
		bills = append(bills, b)
	}
	if bills == nil { bills = []Bill{} }
	c.JSON(http.StatusOK, bills)
}

func GetBill(c *gin.Context) {
	var b Bill
	err := DB.QueryRow("SELECT id, renter_id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, is_paid, payment_method, payment_details, payment_date, COALESCE(date_generated, CURRENT_DATE), notes, rent_amount, water_amount, paid_amount, discount_amount, write_off_amount, arrears_amount, arrears_included FROM bills WHERE id = ?", c.Param("id")).Scan(&b.ID, &b.RenterID, &b.BillingMonth, &b.PrevEBReading, &b.CurrEBReading, &b.Others, &b.TotalAmount, &b.IsPaid, &b.PaymentMethod, &b.PaymentDetails, &b.PaymentDate, &b.DateGenerated, &b.Notes, &b.RentAmount, &b.WaterAmount, &b.PaidAmount, &b.DiscountAmount, &b.WriteOffAmount, &b.ArrearsAmount, &b.ArrearsIncluded)
	if err == nil { c.JSON(http.StatusOK, b) } else { c.JSON(http.StatusNotFound, gin.H{"error": "Not found"}) }
}

func CreateBill(c *gin.Context) {
	var b Bill
	if err := c.ShouldBindJSON(&b); err != nil { c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"}); return }
	var r Renter
	DB.QueryRow("SELECT name, base_rent, water_maint, eb_unit_price, pending_arrears FROM renters WHERE id = ?", b.RenterID).Scan(&r.Name, &r.BaseRent, &r.WaterMaint, &r.EBUnitPrice, &r.PendingArrears)
	ebCost := (b.CurrEBReading - b.PrevEBReading) * r.EBUnitPrice
	total := r.BaseRent + r.WaterMaint + ebCost + b.Others + r.PendingArrears - b.DiscountAmount
	res, err := DB.Exec(`INSERT INTO bills (renter_id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, date_generated, notes, rent_amount, water_amount, arrears_included, discount_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, b.RenterID, b.BillingMonth, b.PrevEBReading, b.CurrEBReading, b.Others, total, b.DateGenerated, b.Notes, r.BaseRent, r.WaterMaint, r.PendingArrears, b.DiscountAmount)
	if err == nil {
		DB.Exec("UPDATE renters SET pending_arrears = 0 WHERE id = ?", b.RenterID)
		id, _ := res.LastInsertId()
		LogActivity("BILL_GENERATED", fmt.Sprintf("Bill for %s: %.2f", r.Name, total), AppConfig.Username, 0)
		TriggerRefresh("BILL_GENERATED")
		c.JSON(http.StatusOK, gin.H{"success": true, "id": id})
	} else { c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed"}) }
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
	var trends []interface{}
	now := time.Now()
	for i := 5; i >= 0; i-- {
		t := now.AddDate(0, -i, 0)
		var inc, maint, payout float64
		DB.QueryRow(`SELECT COALESCE(SUM(paid_amount), 0) FROM bills WHERE is_paid = 1 AND strftime('%Y-%m', payment_date) = ?`, t.Format("2006-01")).Scan(&inc)
		DB.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE strftime('%Y-%m', date) = ?`, t.Format("2006-01")).Scan(&maint)
		DB.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM owner_withdrawals WHERE strftime('%Y-%m', date) = ?`, t.Format("2006-01")).Scan(&payout)
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
	// Simplified version for easier understand
	c.JSON(http.StatusOK, []interface{}{}) 
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

func SendBillEmail(c *gin.Context) {
	// Minimal stub
	c.JSON(http.StatusOK, gin.H{"success": true})
}
