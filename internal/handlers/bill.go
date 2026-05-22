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
	limit := c.DefaultQuery("limit", "10")
	offset := c.DefaultQuery("offset", "0")

	rows, err := database.DB.Query("SELECT id, renter_id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, is_paid, payment_method, payment_details, payment_date, date_generated, notes, rent_amount, water_amount, paid_amount, discount_amount, write_off_amount, arrears_amount, arrears_included FROM bills WHERE renter_id = ? ORDER BY date_generated DESC, id DESC LIMIT ? OFFSET ?", c.Param("renter_id"), limit, offset)
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

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction failed"})
		return
	}
	defer tx.Rollback()

	var r models.Renter
	err = tx.QueryRow("SELECT name, room_no, base_rent, water_maint, eb_unit_price, pending_arrears FROM renters WHERE id = ?", b.RenterID).Scan(&r.Name, &r.RoomNo, &r.BaseRent, &r.WaterMaint, &r.EBUnitPrice, &r.PendingArrears)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Renter not found"})
		return
	}

	ebCost := (b.CurrEBReading - b.PrevEBReading) * r.EBUnitPrice
	// Total amount represents the NET amount payable by the tenant
	total := r.BaseRent + r.WaterMaint + ebCost + b.Others + r.PendingArrears - b.DiscountAmount

	res, err := tx.Exec(`INSERT INTO bills (renter_id, billing_month, prev_eb_reading, curr_eb_reading, others, total_amount, date_generated, notes, rent_amount, water_amount, arrears_included, discount_amount) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
		b.RenterID, b.BillingMonth, b.PrevEBReading, b.CurrEBReading, b.Others, total, time.Now().Format(time.RFC3339), b.Notes, r.BaseRent, r.WaterMaint, r.PendingArrears, b.DiscountAmount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate bill"})
		return
	}

	// Reset pending arrears after they are billed
	tx.Exec("UPDATE renters SET pending_arrears = 0 WHERE id = ?", b.RenterID)

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit failed"})
		return
	}

	id, _ := res.LastInsertId()
	database.LogActivity("BILL_GENERATED", fmt.Sprintf("Generated %s bill for %s (included %.2f arrears)", b.BillingMonth, r.Name, r.PendingArrears), config.AppConfig.Username, 0)
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

	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction failed"})
		return
	}
	defer tx.Rollback()

	var total float64
	var isPaid int
	var name, month string
	var renterID int
	err = tx.QueryRow("SELECT b.total_amount, b.is_paid, r.name, b.billing_month, b.renter_id FROM bills b JOIN renters r ON b.renter_id = r.id WHERE b.id = ?", c.Param("id")).Scan(&total, &isPaid, &name, &month, &renterID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill not found"})
		return
	}

	if isPaid == 1 {
		c.JSON(http.StatusConflict, gin.H{"error": "Bill is already marked as paid"})
		return
	}

	// Adjust total if new discount/write-off/arrears are applied at payment time
	// total_amount in DB is the NET amount at billing time.
	// If additional adjustments are made now, we update the bill record to reflect them.
	newTotal := total - req.DiscountAmount - req.WriteOffAmount - req.ArrearsAmount

	_, err = tx.Exec("UPDATE bills SET is_paid = 1, payment_method = ?, payment_date = ?, payment_details = ?, paid_amount = ?, discount_amount = discount_amount + ?, write_off_amount = write_off_amount + ?, arrears_amount = ?, total_amount = ? WHERE id = ?",
		req.PaymentMethod, req.PaymentDate, req.PaymentDetails, req.PaidAmount, req.DiscountAmount, req.WriteOffAmount, req.ArrearsAmount, newTotal, c.Param("id"))

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Update failed"})
		return
	}

	// Handle Carry Forward (Arrears)
	if req.ArrearsAmount > 0 {
		tx.Exec("UPDATE renters SET pending_arrears = pending_arrears + ? WHERE id = ?", req.ArrearsAmount, renterID)
		database.LogActivity("ARREARS_CARRIED", fmt.Sprintf("Carried forward %.2f for %s", req.ArrearsAmount, name), config.AppConfig.Username, 0)
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Commit failed"})
		return
	}

	database.LogActivity("PAYMENT_RECORDED", fmt.Sprintf("Received %.2f from %s for %s via %s (Received by: %s)", req.PaidAmount, name, month, req.PaymentMethod, req.PaymentDetails), config.AppConfig.Username, req.PaidAmount)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteBill(c *gin.Context) {
	tx, err := database.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Transaction failed"})
		return
	}
	defer tx.Rollback()

	var bill struct {
		RenterID        int
		ArrearsIncluded float64
		ArrearsAmount   float64
	}
	err = tx.QueryRow("SELECT renter_id, arrears_included, arrears_amount FROM bills WHERE id = ?", c.Param("id")).Scan(&bill.RenterID, &bill.ArrearsIncluded, &bill.ArrearsAmount)
	if err == nil {
		if bill.ArrearsIncluded > 0 {
			tx.Exec("UPDATE renters SET pending_arrears = pending_arrears + ? WHERE id = ?", bill.ArrearsIncluded, bill.RenterID)
		}
		if bill.ArrearsAmount > 0 {
			tx.Exec("UPDATE renters SET pending_arrears = MAX(0, pending_arrears - ?) WHERE id = ?", bill.ArrearsAmount, bill.RenterID)
		}
	}
	tx.Exec("DELETE FROM bills WHERE id = ?", c.Param("id"))

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Delete failed"})
		return
	}
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
		TotalBilled    float64 `json:"total_billed"`
		TotalPaid      float64 `json:"total_paid"`
		TotalDues      float64 `json:"total_dues"`
		TotalArrears   float64 `json:"total_arrears"`
		TotalAdvances  float64 `json:"total_advances"`
		TotalCount     int     `json:"total_count"`
		PaidCount      int     `json:"paid_count"`
		ActiveBilled   float64 `json:"active_billed"`
		ActivePaid     float64 `json:"active_paid"`
		ActiveDues     float64 `json:"active_dues"`
		ActiveTotalCnt int     `json:"active_total_count"`
		ActivePaidCnt  int     `json:"active_paid_count"`
	}

	// 1. Global Totals (All time, all tenants)
	database.DB.QueryRow("SELECT COALESCE(SUM(total_amount - arrears_included + discount_amount + write_off_amount + arrears_amount), 0), COUNT(*) FROM bills").Scan(&summary.TotalBilled, &summary.TotalCount)
	database.DB.QueryRow("SELECT COALESCE(SUM(paid_amount), 0), COUNT(*) FROM bills WHERE is_paid = 1").Scan(&summary.TotalPaid, &summary.PaidCount)
	database.DB.QueryRow("SELECT COALESCE(SUM(total_amount), 0) FROM bills WHERE is_paid = 0").Scan(&summary.TotalDues)

	// 2. Active-Only Totals (For Collection Check progress)
	database.DB.QueryRow(`
		SELECT COALESCE(SUM(b.total_amount - b.arrears_included + b.discount_amount + b.write_off_amount + b.arrears_amount), 0), COUNT(b.id) 
		FROM bills b JOIN renters r ON b.renter_id = r.id 
		WHERE r.is_active = 1`).Scan(&summary.ActiveBilled, &summary.ActiveTotalCnt)

	database.DB.QueryRow(`
		SELECT COALESCE(SUM(b.paid_amount), 0), COUNT(b.id) 
		FROM bills b JOIN renters r ON b.renter_id = r.id 
		WHERE b.is_paid = 1 AND r.is_active = 1`).Scan(&summary.ActivePaid, &summary.ActivePaidCnt)

	database.DB.QueryRow(`
		SELECT COALESCE(SUM(b.total_amount), 0) 
		FROM bills b JOIN renters r ON b.renter_id = r.id 
		WHERE b.is_paid = 0 AND r.is_active = 1`).Scan(&summary.ActiveDues)

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
		COALESCE((SELECT SUM(total_amount - arrears_included + discount_amount + write_off_amount + arrears_amount) FROM bills WHERE renter_id = r.id), 0) as billed,
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
	if ledger == nil {
		ledger = []Entry{}
	}
	c.JSON(http.StatusOK, ledger)
}

func GetAllPendingBills(c *gin.Context) {
	GetDueCheck(c)
}

func GetDueCheck(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, name, room_no, move_in_date, pending_arrears FROM renters WHERE is_active = 1")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	type Item struct {
		Type         string  `json:"type"` // "MISSING_BILL" or "PENDING_PAYMENT"
		RenterID     int     `json:"renter_id"`
		BillID       int     `json:"bill_id,omitempty"`
		Name         string  `json:"name"`
		RoomNo       string  `json:"room_no"`
		BillingMonth string  `json:"billing_month"`
		Amount       float64 `json:"amount"`
		Arrears      float64 `json:"arrears"`
	}
	var results []Item

	now := time.Now().UTC()
	currentMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	prevMonth := currentMonth.AddDate(0, -1, 0)

	for rows.Next() {
		var r struct {
			ID             int
			Name           string
			RoomNo         string
			MoveInDate     string
			PendingArrears float64
		}
		rows.Scan(&r.ID, &r.Name, &r.RoomNo, &r.MoveInDate, &r.PendingArrears)

		// 1. Get all existing bills for this renter
		billRows, err := database.DB.Query("SELECT id, billing_month, total_amount, is_paid, arrears_included FROM bills WHERE renter_id = ?", r.ID)
		if err != nil {
			continue
		}
		billedAmount := make(map[string]float64)

		for billRows.Next() {
			var bID int
			var bMonth string
			var bAmount, bArrears float64
			var bPaid int
			if err := billRows.Scan(&bID, &bMonth, &bAmount, &bPaid, &bArrears); err != nil {
				continue
			}
			billedAmount[strings.ToUpper(strings.TrimSpace(bMonth))] = bAmount

			// If bill exists but not paid, add to pending
			if bPaid == 0 {
				results = append(results, Item{
					Type:         "PENDING_PAYMENT",
					RenterID:     r.ID,
					BillID:       bID,
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
			moveIn, _ = time.Parse(time.RFC3339, r.MoveInDate)
		}

		// Postpaid logic:
		tempDate := time.Date(moveIn.Year(), moveIn.Month(), 1, 0, 0, 0, 0, time.UTC)

		for !tempDate.After(prevMonth) {
			mStr := strings.ToUpper(tempDate.Format("January 2006"))
			if _, exists := billedAmount[mStr]; !exists {
				itemType := "MISSING_BILL"
				// The most recently completed month is the "DRAFT"
				if tempDate.Equal(prevMonth) {
					itemType = "DRAFT_BILL"
				}
				results = append(results, Item{
					Type:         itemType,
					RenterID:     r.ID,
					Name:         r.Name,
					RoomNo:       r.RoomNo,
					BillingMonth: tempDate.Format("January 2006"),
					Amount:       0,
					Arrears:      r.PendingArrears,
				})
			}
			tempDate = tempDate.AddDate(0, 1, 0)
		}
	}

	if results == nil {
		results = []Item{}
	}
	c.JSON(http.StatusOK, results)
}

func GetMonthlyReport(c *gin.Context) {
	monthParam := c.Param("month")
	displayMonth := monthParam

	// Handle YYYY-MM conversion if needed
	if len(monthParam) == 7 && monthParam[4] == '-' {
		t, err := time.Parse("2006-01", monthParam)
		if err == nil {
			displayMonth = t.Format("January 2006")
		}
	}

	type Status struct {
		RenterID int     `json:"renter_id"`
		Name     string  `json:"name"`
		RoomNo   string  `json:"room_no"`
		BillID   int     `json:"bill_id"`
		IsPaid   int     `json:"is_paid"`
		Total    float64 `json:"total"`
		Billed   bool    `json:"is_billed"`
	}
	rows, err := database.DB.Query(`SELECT r.id, r.name, r.room_no, COALESCE(b.id, 0), COALESCE(b.is_paid, 0), COALESCE(b.total_amount, 0), r.move_in_date
		FROM renters r LEFT JOIN bills b ON r.id = b.renter_id AND b.billing_month = ?
		WHERE r.is_active = 1`, displayMonth)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	// Parse the report month (Stay Period) for comparison
	reportTime, err := time.Parse("January 2006", displayMonth)
	if err != nil {
		reportTime = time.Now().UTC() // Fallback
	}
	reportTime = time.Date(reportTime.Year(), reportTime.Month(), 1, 0, 0, 0, 0, time.UTC)

	var report = []Status{}
	for rows.Next() {
		var s Status
		var moveInStr string
		rows.Scan(&s.RenterID, &s.Name, &s.RoomNo, &s.BillID, &s.IsPaid, &s.Total, &moveInStr)

		moveIn, err := time.Parse("2006-01-02", moveInStr)
		if err != nil {
			moveIn, _ = time.Parse(time.RFC3339, moveInStr)
		}
		// Normalize moveIn to the 1st of its month
		moveInMonth := time.Date(moveIn.Year(), moveIn.Month(), 1, 0, 0, 0, 0, time.UTC)

		if moveInMonth.After(reportTime) {
			continue
		}

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

		if receivedBy != nil {
			b.ReceivedBy = *receivedBy
		}
		if assignedOwner != nil {
			b.AssignedOwner = *assignedOwner
		}
		if payDate != nil {
			b.PaymentDate = *payDate
		}
		if payMethod != nil {
			b.PaymentMethod = *payMethod
		}

		bills = append(bills, b)
	}
	if bills == nil {
		bills = []PaidBill{}
	}
	c.JSON(http.StatusOK, bills)
}

func GetTrendData(c *gin.Context) {
	// Aggregate last 6 months
	type MonthTrend struct {
		Month    string  `json:"month"`
		Income   float64 `json:"income"`
		Expenses float64 `json:"expenses"`
	}
	var trends []MonthTrend

	now := time.Now()
	for i := 5; i >= 0; i-- {
		t := now.AddDate(0, -i, 0)

		var income, expenses float64
		// Income (Rent collected in this month)
		database.DB.QueryRow(`SELECT COALESCE(SUM(paid_amount), 0) FROM bills WHERE is_paid = 1 AND strftime('%Y-%m', payment_date) = ?`, t.Format("2006-01")).Scan(&income)

		// Expenses (Maintenance + Payouts in this month)
		var maint, payouts float64
		database.DB.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE strftime('%Y-%m', date) = ?`, t.Format("2006-01")).Scan(&maint)
		database.DB.QueryRow(`SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE strftime('%Y-%m', date) = ?`, t.Format("2006-01")).Scan(&payouts)

		expenses = maint + payouts

		trends = append(trends, MonthTrend{
			Month:    t.Format("Jan"),
			Income:   income,
			Expenses: expenses,
		})
	}

	c.JSON(http.StatusOK, trends)
}
