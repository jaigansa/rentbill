package handlers

import (
	"fmt"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"rentbill/internal/config"
	"rentbill/internal/database"
	"rentbill/internal/models"
)

func GetBills(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, renter_id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, is_paid, payment_method, payment_details, payment_date, date_generated, notes, rent_amount, water_amount, paid_amount, discount_amount, write_off_amount, arrears_amount, arrears_included FROM bills WHERE renter_id = ? ORDER BY date_generated DESC, id DESC", c.Param("renter_id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var bills = []models.Bill{}
	for rows.Next() {
		var b models.Bill
		rows.Scan(&b.ID, &b.RenterID, &b.BillingMonth, &b.PrevEBReading, &b.CurrEBReading, &b.Others, &b.TotalAmount, &b.IsPaid, &b.PaymentMethod, &b.PaymentDetails, &b.PaymentDate, &b.DateGenerated, &b.Notes, &b.RentAmount, &b.WaterAmount, &b.PaidAmount, &b.DiscountAmount, &b.WriteOffAmount, &b.ArrearsAmount, &b.ArrearsIncluded)
		bills = append(bills, b)
	}
	if bills == nil {
		bills = []models.Bill{}
	}
	c.JSON(http.StatusOK, bills)
}

func GetBill(c *gin.Context) {
	var b models.Bill
	err := database.DB.QueryRow("SELECT id, renter_id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, is_paid, payment_method, payment_details, payment_date, date_generated, notes, rent_amount, water_amount, paid_amount, discount_amount, write_off_amount, arrears_amount, arrears_included FROM bills WHERE id = ?", c.Param("id")).Scan(&b.ID, &b.RenterID, &b.BillingMonth, &b.PrevEBReading, &b.CurrEBReading, &b.Others, &b.TotalAmount, &b.IsPaid, &b.PaymentMethod, &b.PaymentDetails, &b.PaymentDate, &b.DateGenerated, &b.Notes, &b.RentAmount, &b.WaterAmount, &b.PaidAmount, &b.DiscountAmount, &b.WriteOffAmount, &b.ArrearsAmount, &b.ArrearsIncluded)
	if err == nil {
		c.JSON(http.StatusOK, b)
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	}
}

func CreateBill(c *gin.Context) {
	var b models.Bill
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	if b.CurrEBReading < b.PrevEBReading {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Current EB reading cannot be lower than previous"})
		return
	}
	var exists int
	database.DB.QueryRow("SELECT COUNT(*) FROM bills WHERE renter_id = ? AND billing_month = ?", b.RenterID, b.BillingMonth).Scan(&exists)
	if exists > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "A bill already exists for this tenant and month"})
		return
	}
	var r models.Renter
	err := database.DB.QueryRow("SELECT name, room_no, base_rent, water_maint, eb_unit_price, pending_arrears FROM renters WHERE id = ?", b.RenterID).Scan(&r.Name, &r.RoomNo, &r.BaseRent, &r.WaterMaint, &r.EBUnitPrice, &r.PendingArrears)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Renter not found"})
		return
	}
	
	ebCost := (b.CurrEBReading - b.PrevEBReading) * r.EBUnitPrice
	total := r.BaseRent + r.WaterMaint + ebCost + b.Others + r.PendingArrears
	
	// If there were arrears, we add them to 'others' or just keep them in total but record it
	// User said: "next bill will be 5,500 (5,000 rent + 500 previous balance)"
	// We'll store the arrears component in the 'others' field or a new column. 
	// Let's use the existing 'others' for simplicity in display, but we'll modify it.
	
	actualOthers := b.Others + r.PendingArrears

	res, err := database.DB.Exec(`INSERT INTO bills (renter_id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, date_generated, notes, rent_amount, water_amount, arrears_included) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, 
		b.RenterID, b.BillingMonth, b.PrevEBReading, b.CurrEBReading, actualOthers, total, time.Now().Format(time.RFC3339), b.Notes, r.BaseRent, r.WaterMaint, r.PendingArrears)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate bill"})
		return
	}
	
	// Reset pending arrears after they are billed
	database.DB.Exec("UPDATE renters SET pending_arrears = 0 WHERE id = ?", b.RenterID)

	id, _ := res.LastInsertId()
	database.LogActivity("BILL_GENERATED", fmt.Sprintf("Generated %s bill for %s (included %.2f arrears)", b.BillingMonth, r.Name, r.PendingArrears), config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true, "id": id})
}

func PayBill(c *gin.Context) {
	var req struct {
		PaymentMethod  string  `json:"payment_method"`
		PaymentDate    string  `json:"payment_date"`
		PaymentDetails string  `json:"payment_details"`
		PaidAmount     float64 `json:"paid_amount"`
		DiscountAmount float64 `json:"discount_amount"`
		WriteOffAmount float64 `json:"write_off_amount"`
		ArrearsAmount  float64 `json:"arrears_amount"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	var amount, total float64
	var name, month string
	var renterID int
	err := database.DB.QueryRow("SELECT b.total_amount, r.name, b.billing_month, b.renter_id FROM bills b JOIN renters r ON b.renter_id = r.id WHERE b.id = ?", c.Param("id")).Scan(&total, &name, &month, &renterID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found"})
		return
	}

	// Calculate total accounted for
	accounted := req.PaidAmount + req.DiscountAmount + req.WriteOffAmount + req.ArrearsAmount
	if accounted < total {
		// If not fully accounted, treat remaining as unpaid unless marked as paid
		// But user wants a "record mechanism", so we'll allow partials if marked as paid
	}

	_, err = database.DB.Exec("UPDATE bills SET is_paid = 1, payment_method = ?, payment_date = ?, payment_details = ?, paid_amount = ?, discount_amount = ?, write_off_amount = ?, arrears_amount = ? WHERE id = ?", 
		req.PaymentMethod, req.PaymentDate, req.PaymentDetails, req.PaidAmount, req.DiscountAmount, req.WriteOffAmount, req.ArrearsAmount, c.Param("id"))
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Update failed"})
		return
	}

	// Handle Carry Forward (Arrears)
	if req.ArrearsAmount > 0 {
		database.DB.Exec("UPDATE renters SET pending_arrears = pending_arrears + ? WHERE id = ?", req.ArrearsAmount, renterID)
		database.LogActivity("ARREARS_CARRIED", fmt.Sprintf("Carried forward %.2f for %s", req.ArrearsAmount, name), config.AppConfig.Username)
	}

	amount = req.PaidAmount
	database.LogActivity("PAYMENT_RECORDED", fmt.Sprintf("Received %.2f from %s for %s via %s (Received by: %s)", amount, name, month, req.PaymentMethod, req.PaymentDetails), config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteBill(c *gin.Context) {
	var bill struct {
		RenterID        int
		ArrearsIncluded float64
	}
	err := database.DB.QueryRow("SELECT renter_id, arrears_included FROM bills WHERE id = ?", c.Param("id")).Scan(&bill.RenterID, &bill.ArrearsIncluded)
	if err == nil && bill.ArrearsIncluded > 0 {
		database.DB.Exec("UPDATE renters SET pending_arrears = pending_arrears + ? WHERE id = ?", bill.ArrearsIncluded, bill.RenterID)
	}
	database.DB.Exec("DELETE FROM bills WHERE id = ?", c.Param("id"))
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func SendBillEmail(c *gin.Context) {
	var req struct {
		BillID  int    `json:"bill_id"`
		Email   string `json:"email"`
		Message string `json:"message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	if config.AppConfig.EmailUser == "" || config.AppConfig.EmailPass == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMTP not configured"})
		return
	}
	toEmail := req.Email
	if toEmail == "" && req.BillID > 0 {
		database.DB.QueryRow("SELECT r.email FROM renters r JOIN bills b ON r.id = b.renter_id WHERE b.id = ?", req.BillID).Scan(&toEmail)
	}
	if toEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Recipient email missing"})
		return
	}
	auth := smtp.PlainAuth("", config.AppConfig.EmailUser, config.AppConfig.EmailPass, "smtp.gmail.com")
	contentType := "text/plain"
	if strings.Contains(req.Message, "<div") || strings.Contains(req.Message, "<table") {
		contentType = "text/html"
	}
	header := fmt.Sprintf("Subject: RentBill\r\nTo: %s\r\nMIME-version: 1.0;\r\nContent-Type: %s; charset=\"UTF-8\";\r\n\r\n", toEmail, contentType)
	err := smtp.SendMail("smtp.gmail.com:587", auth, config.AppConfig.EmailUser, []string{toEmail}, []byte(header+req.Message))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func GetFinancialSummary(c *gin.Context) {
	var summary struct {
		TotalBilled   float64 `json:"total_billed"`
		TotalPaid     float64 `json:"total_paid"`
		TotalDues     float64 `json:"total_dues"`
		TotalArrears  float64 `json:"total_arrears"`
		TotalAdvances float64 `json:"total_advances"`
		TotalCount    int     `json:"total_count"`
		PaidCount     int     `json:"paid_count"`
	}
	database.DB.QueryRow("SELECT COALESCE(SUM(total_amount), 0), COUNT(*) FROM bills").Scan(&summary.TotalBilled, &summary.TotalCount)
	database.DB.QueryRow("SELECT COALESCE(SUM(paid_amount), 0), COUNT(*) FROM bills WHERE is_paid = 1").Scan(&summary.TotalPaid, &summary.PaidCount)
	database.DB.QueryRow("SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE is_paid = 0").Scan(&summary.TotalDues)
	database.DB.QueryRow("SELECT COALESCE(SUM(advance_amount), 0) FROM renters WHERE is_active = 1").Scan(&summary.TotalAdvances)
	database.DB.QueryRow("SELECT COALESCE(SUM(pending_arrears), 0) FROM renters WHERE is_active = 1").Scan(&summary.TotalArrears)

	c.JSON(http.StatusOK, summary)
}

func GetTenantLedger(c *gin.Context) {
	type Entry struct {
		ID             int     `json:"id"`
		Name           string  `json:"name"`
		RoomNo         string  `json:"room_no"`
		TotalBilled    float64 `json:"total_billed"`
		TotalPaid      float64 `json:"total_paid"`
		PendingArrears float64 `json:"pending_arrears"`
		Advance        float64 `json:"advance"`
		Balance        float64 `json:"balance"`
	}

	rows, err := database.DB.Query(`
		SELECT r.id, r.name, r.room_no, r.advance_amount, r.pending_arrears,
		COALESCE((SELECT SUM(total_amount) FROM bills WHERE renter_id = r.id), 0) as billed,
		COALESCE((SELECT SUM(paid_amount) FROM bills WHERE renter_id = r.id AND is_paid = 1), 0) as paid,
		COALESCE((SELECT SUM(total_amount) FROM bills WHERE renter_id = r.id AND is_paid = 0), 0) as unpaid_bills
		FROM renters r WHERE r.is_active = 1
		ORDER BY r.room_no ASC`)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var ledger []Entry
	for rows.Next() {
		var e Entry
		var unpaidBills float64
		rows.Scan(&e.ID, &e.Name, &e.RoomNo, &e.Advance, &e.PendingArrears, &e.TotalBilled, &e.TotalPaid, &unpaidBills)
		// Balance = Outstanding Bills + Unbilled Arrears
		e.Balance = unpaidBills + e.PendingArrears
		ledger = append(ledger, e)
	}
	if ledger == nil { ledger = []Entry{} }
	c.JSON(http.StatusOK, ledger)
}
func GetAllPendingBills(c *gin.Context) {
	// Replacing old GetAllPendingBills with a more comprehensive GetDueCheck logic
	// but keeping the name or adding a new one. I'll add GetDueCheck.
	GetDueCheck(c)
}

func GetDueCheck(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, name, room_no, move_in_date FROM renters WHERE is_active = 1")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	type Item struct {
		Type         string  `json:"type"` // "MISSING_BILL" or "PENDING_PAYMENT"
		RenterID     int     `json:"renter_id"`
		Name         string  `json:"name"`
		RoomNo       string  `json:"room_no"`
		BillingMonth string  `json:"billing_month"`
		Amount       float64 `json:"amount"`
		Arrears      float64 `json:"arrears"`
	}
	var results []Item

	now := time.Now()
	currentMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

	for rows.Next() {
		var r struct {
			ID         int
			Name       string
			RoomNo     string
			MoveInDate string
		}
		rows.Scan(&r.ID, &r.Name, &r.RoomNo, &r.MoveInDate)

		// 1. Get all existing bills for this renter
		billRows, _ := database.DB.Query("SELECT billing_month, total_amount, is_paid, arrears_included FROM bills WHERE renter_id = ?", r.ID)
		billsMap := make(map[string]bool)   // month -> is_paid
		billedAmount := make(map[string]float64)
		
		for billRows.Next() {
			var bMonth string
			var bAmount, bArrears float64
			var bPaid int
			billRows.Scan(&bMonth, &bAmount, &bPaid, &bArrears)
			billsMap[strings.ToUpper(bMonth)] = (bPaid == 1)
			billedAmount[strings.ToUpper(bMonth)] = bAmount
			
			// If bill exists but not paid, add to pending
			if bPaid == 0 {
				results = append(results, Item{
					Type:         "PENDING_PAYMENT",
					RenterID:     r.ID,
					Name:         r.Name,
					RoomNo:       r.RoomNo,
					BillingMonth: bMonth,
					Amount:       bAmount,
					Arrears:      bArrears,
				})
			}
		}
		billRows.Close()

		// 2. Check for missing bills since move-in
		moveIn, err := time.Parse("2006-01-02", r.MoveInDate)
		if err != nil {
			// Fallback if date format is different
			moveIn, _ = time.Parse(time.RFC3339, r.MoveInDate)
		}
		
		tempDate := time.Date(moveIn.Year(), moveIn.Month(), 1, 0, 0, 0, 0, time.UTC)
		for !tempDate.After(currentMonth) {
			mStr := strings.ToUpper(tempDate.Format("January 2006"))
			if _, exists := billedAmount[mStr]; !exists {
				results = append(results, Item{
					Type:         "MISSING_BILL",
					RenterID:     r.ID,
					Name:         r.Name,
					RoomNo:       r.RoomNo,
					BillingMonth: tempDate.Format("January 2006"),
					Amount:       0,
				})
			}
			tempDate = tempDate.AddDate(0, 1, 0)
		}
	}

	c.JSON(http.StatusOK, results)
}

func GetMonthlyReport(c *gin.Context) {
	month := c.Param("month")
	type Status struct {
		RenterID int     `json:"renter_id"`
		Name     string  `json:"name"`
		RoomNo   string  `json:"room_no"`
		BillID   int     `json:"bill_id"`
		IsPaid   int     `json:"is_paid"`
		Total    float64 `json:"total"`
		Billed   bool    `json:"is_billed"`
	}
	rows, err := database.DB.Query(`SELECT r.id, r.name, r.room_no, COALESCE(b.id, 0), COALESCE(b.is_paid, 0), COALESCE(b.total_amount, 0)
		FROM renters r LEFT JOIN bills b ON r.id = b.renter_id AND b.billing_month = ?
		WHERE r.is_active = 1`, month)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var report = []Status{}
	for rows.Next() {
		var s Status
		rows.Scan(&s.RenterID, &s.Name, &s.RoomNo, &s.BillID, &s.IsPaid, &s.Total)
		s.Billed = s.BillID > 0
		report = append(report, s)
	}
	if report == nil {
		report = []Status{}
	}
	c.JSON(http.StatusOK, report)
}

func GetLastEB(c *gin.Context) {
	var lastEB float64
	database.DB.QueryRow(`SELECT COALESCE((SELECT curr_eb_reading FROM bills WHERE renter_id = ? ORDER BY id DESC LIMIT 1), (SELECT initial_eb FROM renters WHERE id = ?))`, c.Param("renter_id"), c.Param("renter_id")).Scan(&lastEB)
	c.JSON(http.StatusOK, gin.H{"last_eb": lastEB})
}

func GetAllPaidBills(c *gin.Context) {
	rows, err := database.DB.Query(`
		SELECT b.id, b.renter_id, b.billing_month, b.total_amount, b.paid_amount, b.payment_details, b.payment_date, b.payment_method, r.name, r.room_no, r.assigned_upi 
		FROM bills b 
		JOIN renters r ON b.renter_id = r.id 
		WHERE b.is_paid = 1`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	type PaidBill struct {
		ID            int     `json:"id"`
		RenterID      int     `json:"renter_id"`
		BillingMonth  string  `json:"billing_month"`
		TotalAmount   float64 `json:"total_amount"`
		PaidAmount    float64 `json:"paid_amount"`
		ReceivedBy    string  `json:"received_by"`
		PaymentDate   string  `json:"payment_date"`
		PaymentMethod string  `json:"payment_method"`
		TenantName    string  `json:"tenant_name"`
		RoomNo        string  `json:"room_no"`
		AssignedOwner string  `json:"assigned_owner"`
	}
	var bills []PaidBill
	for rows.Next() {
		var b PaidBill
		var receivedBy, assignedOwner, payDate, payMethod *string
		rows.Scan(&b.ID, &b.RenterID, &b.BillingMonth, &b.TotalAmount, &b.PaidAmount, &receivedBy, &payDate, &payMethod, &b.TenantName, &b.RoomNo, &assignedOwner)
		
		if receivedBy != nil { b.ReceivedBy = *receivedBy }
		if assignedOwner != nil { b.AssignedOwner = *assignedOwner }
		if payDate != nil { b.PaymentDate = *payDate }
		if payMethod != nil { b.PaymentMethod = *payMethod }
		
		bills = append(bills, b)
	}
	if bills == nil {
		bills = []PaidBill{}
	}
	c.JSON(http.StatusOK, bills)
}
