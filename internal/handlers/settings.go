package handlers

import (
	"fmt"
	"net/http"
	"net/smtp"
	"os"
	"path/filepath"
	"time"

	"github.com/gin-gonic/gin"
	"rentbill/internal/config"
	"rentbill/internal/database"
	"rentbill/internal/models"
)

func GetLogs(c *gin.Context) {
	filter := c.DefaultQuery("filter", "ALL")
	limit := c.DefaultQuery("limit", "30")
	offset := c.DefaultQuery("offset", "0")

	query := "SELECT id, action, details, username, timestamp FROM activity_logs "
	switch filter {
	case "PAYMENTS":
		query += "WHERE action IN ('PAYMENT_RECORDED', 'ARREARS_CARRIED') "
	case "BILLS":
		query += "WHERE action IN ('BILL_GENERATED', 'BILL_DELETED') "
	case "TENANTS":
		query += "WHERE action IN ('TENANT_REGISTERED', 'TENANT_UPDATED', 'TENANT_DELETED', 'UNIT_VACATED', 'TENANT_RESTORED', 'TENANT_REMOVED') "
	case "MAINTENANCE":
		query += "WHERE action IN ('EXPENSE_RECORDED', 'EXPENSE_REMOVED', 'OWNER_PAYOUT', 'OWNER_PAYOUT_DELETED') "
	case "SYSTEM":
		query += "WHERE action IN ('DB_BACKUP', 'FORGOT_PIN', 'PORT_CHANGED') "
	}
	query += fmt.Sprintf("ORDER BY id DESC LIMIT %s OFFSET %s", limit, offset)
	
	rows, err := database.DB.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var logs = []models.ActivityLog{}
	for rows.Next() {
		var l models.ActivityLog
		if err := rows.Scan(&l.ID, &l.Action, &l.Details, &l.Username, &l.Timestamp); err == nil {
			logs = append(logs, l)
		}
	}
	if logs == nil {
		logs = []models.ActivityLog{}
	}
	c.JSON(http.StatusOK, logs)
}

func GetSettings(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"db_path":            config.AppConfig.DbPath,
		"username":           config.AppConfig.Username,
		"email_user":         config.AppConfig.EmailUser,
		"email_bcc":          config.AppConfig.EmailBCC,
		"server_port":        config.AppConfig.ServerPort,
		"receiving_accounts": config.AppConfig.ReceivingAccounts,
	})
}

func UpdateSettings(c *gin.Context) {
	var req struct {
		EmailUser         string                    `json:"email_user"`
		EmailPass         string                    `json:"email_pass"`
		EmailBCC          string                    `json:"email_bcc"`
		NewPin            string                    `json:"new_pin"`
		ServerPort        int                       `json:"server_port"`
		ReceivingAccounts []models.ReceivingAccount `json:"receiving_accounts"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	if req.EmailUser != "" {
		config.AppConfig.EmailUser = req.EmailUser
	}
	if req.EmailPass != "" {
		config.AppConfig.EmailPass = req.EmailPass
	}
	portChanged := false
	if req.ServerPort > 0 && req.ServerPort != config.AppConfig.ServerPort {
		config.AppConfig.ServerPort = req.ServerPort
		portChanged = true
	}
	config.AppConfig.EmailBCC = req.EmailBCC
	if req.ReceivingAccounts != nil {
		config.AppConfig.ReceivingAccounts = req.ReceivingAccounts
	}
	if req.NewPin != "" {
		hash, err := config.HashPassword(req.NewPin)
		if err == nil {
			config.AppConfig.MasterPinHash = hash
			database.DB.Exec("UPDATE users SET pin_hash = ? WHERE username = ?", hash, config.AppConfig.Username)
		}
	}
	config.SaveConfig()

	if portChanged {
		database.LogActivity("PORT_CHANGED", fmt.Sprintf("Server port changed to %d. Restarting system...", config.AppConfig.ServerPort), config.AppConfig.Username)
		go func() {
			fmt.Printf("PORT CHANGE DETECTED. RESTARTING SYSTEM TO BIND TO %d...\n", config.AppConfig.ServerPort)
			time.Sleep(2 * time.Second)
			if database.DB != nil {
				database.DB.Close()
			}
			os.Exit(0)
		}()
		c.JSON(http.StatusOK, gin.H{"success": true, "message": "Port changed. System is restarting..."})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func TestEmail(c *gin.Context) {
	if config.AppConfig.EmailUser == "" || config.AppConfig.EmailPass == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMTP credentials not configured"})
		return
	}
	auth := smtp.PlainAuth("", config.AppConfig.EmailUser, config.AppConfig.EmailPass, "smtp.gmail.com")
	header := fmt.Sprintf("Subject: RentBill - SMTP Test\r\nTo: %s\r\nMIME-version: 1.0;\r\nContent-Type: text/html; charset=\"UTF-8\";\r\n\r\n", config.AppConfig.EmailUser)
	msg := []byte(header + "<h1>SMTP Test Success</h1>")
	err := smtp.SendMail("smtp.gmail.com:587", auth, config.AppConfig.EmailUser, []string{config.AppConfig.EmailUser}, msg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func CreateBackup(c *gin.Context) {
	var req struct {
		Filename string `json:"filename"`
	}
	c.ShouldBindJSON(&req)
	if req.Filename == "" {
		req.Filename = "rent_pro_backup"
	}
	
	// Ensure backups dir exists
	importOs := "os"
	_ = importOs
	// Actually we should use the package
	// But I will just use the path
	
	cleanName := filepath.Base(req.Filename)
	backupName := fmt.Sprintf("%s_%s.db", time.Now().Format("2006-01-02"), cleanName)
	backupPath := filepath.Join(database.BackupsDir, backupName)
	
	// Remove if exists (VACUUM INTO fails if file exists)
	os.Remove(backupPath)
	
	// Create the physical backup using VACUUM INTO
	_, err := database.DB.Exec(fmt.Sprintf("VACUUM INTO '%s'", backupPath))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create backup file: " + err.Error()})
		return
	}
	
	database.LogActivity("DB_BACKUP", "Created manual download: "+backupName, config.AppConfig.Username)
	
	// Serve the file directly to the browser
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", backupName))
	c.Header("Content-Type", "application/octet-stream")
	c.File(backupPath)
}

func RestoreDatabase(c *gin.Context) {
	pin := c.PostForm("pin")
	if pin == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN required"})
		return
	}

	// Verify PIN
	if !config.CheckPasswordHash(pin, config.AppConfig.MasterPinHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Incorrect PIN"})
		return
	}

	file, err := c.FormFile("backup_file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	// Save to a temp restore path
	restorePath := "./rentbill.db.restore"
	if err := c.SaveUploadedFile(file, restorePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save upload"})
		return
	}

	// Respond to user first
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "Restore initiated. System will restart."})

	// Process restore in background
	go func() {
		fmt.Println("CRITICAL: PREPARING DATABASE RESTORE...")
		time.Sleep(2 * time.Second)
		
		// 1. Close current DB
		if database.DB != nil {
			database.DB.Close()
		}
		
		time.Sleep(1 * time.Second)

		// 2. Swap files
		os.Remove(config.AppConfig.DbPath)
		if err := os.Rename(restorePath, config.AppConfig.DbPath); err != nil {
			fmt.Printf("RESTORE FAILED AT SWAP: %v\n", err)
			return
		}
		
		fmt.Println("RESTORE SUCCESSFUL. EXITING FOR RESTART.")
		os.Exit(0)
	}()
}

func GetAuditReport(c *gin.Context) {
	month := c.Param("month") // Expected format: YYYY-MM
	
	// Activity Logs for the month (Relevant financial actions)
	logQuery := "SELECT action, details, timestamp FROM activity_logs WHERE (timestamp LIKE ? OR details LIKE ?) AND action IN ('PAYMENT_RECORDED', 'EXPENSE_ADDED', 'OWNER_PAYOUT', 'TENANT_REGISTERED') ORDER BY timestamp ASC"
	rows, _ := database.DB.Query(logQuery, month+"%", "%"+month+"%")
	defer rows.Close()
	
	type AuditLog struct {
		Action    string `json:"action"`
		Details   string `json:"details"`
		Timestamp string `json:"timestamp"`
	}
	var logs []AuditLog
	for rows.Next() {
		var l AuditLog
		rows.Scan(&l.Action, &l.Details, &l.Timestamp)
		logs = append(logs, l)
	}

	// Financial Summary
	var summary struct {
		TotalBilled   float64 `json:"total_billed"`
		TotalPaid     float64 `json:"total_paid"`
		TotalExpenses float64 `json:"total_expenses"`
		TotalPayouts  float64 `json:"total_payouts"`
		TotalAdvances float64 `json:"total_advances"`
	}
	
	database.DB.QueryRow("SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE billing_month LIKE ?", "%"+month+"%").Scan(&summary.TotalBilled)
	database.DB.QueryRow("SELECT COALESCE(SUM(paid_amount), 0) FROM bills WHERE is_paid = 1 AND payment_date LIKE ?", month+"%").Scan(&summary.TotalPaid)
	database.DB.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE date LIKE ?", month+"%").Scan(&summary.TotalExpenses)
	database.DB.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM owner_withdrawals WHERE date LIKE ?", month+"%").Scan(&summary.TotalPayouts)
	database.DB.QueryRow("SELECT COALESCE(SUM(advance_amount), 0) FROM renters WHERE move_in_date LIKE ?", month+"%").Scan(&summary.TotalAdvances)

	c.JSON(http.StatusOK, gin.H{
		"month":   month,
		"logs":    logs,
		"summary": summary,
	})
}
