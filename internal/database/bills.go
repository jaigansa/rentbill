package database

import (
	"database/sql"
	"fmt"
	"math"
	"time"
)

func (db *DB) GetLatestBillForTenant(tenantID int64) (*Bill, error) {
	query := `
	SELECT id, curr_electricity_meter, curr_water_meter, billing_month,
	       (total_amount - paid_amount) as balance_amount
	FROM bills
	WHERE tenant_id = ?
	ORDER BY id DESC
	LIMIT 1
	`
	var b Bill
	err := db.QueryRow(query, tenantID).Scan(&b.ID, &b.CurrElectricityMeter, &b.CurrWaterMeter, &b.BillingMonth, &b.BalanceAmount)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (db *DB) CreateBill(b *Bill) (int64, error) {
	if b.BillNumber == "" {
		b.BillNumber = GenerateBillNumber()
	}

	// Calculate electricity units & amount
	if b.CurrElectricityMeter >= b.PrevElectricityMeter {
		b.ElectricityUnits = b.CurrElectricityMeter - b.PrevElectricityMeter
	} else {
		b.ElectricityUnits = 0
	}
	b.ElectricityAmount = math.Round(b.ElectricityUnits*b.ElectricityRate*100) / 100

	// Calculate water units & amount based on billing type
	if b.WaterBillingType == "METER" {
		if b.CurrWaterMeter >= b.PrevWaterMeter {
			b.WaterUnits = b.CurrWaterMeter - b.PrevWaterMeter
		} else {
			b.WaterUnits = 0
		}
		b.WaterAmount = math.Round(b.WaterUnits*b.WaterRate*100) / 100
	} else {
		b.WaterBillingType = "FIXED"
		b.WaterUnits = 0
	}

	// Calculate total amount including previous balance (arrears) and minus discount
	b.TotalAmount = b.BaseRent + b.ElectricityAmount + b.WaterAmount + b.MaintenanceAmount + b.OtherCharges + b.PreviousBalance - b.DiscountAmount
	if b.TotalAmount < 0 {
		b.TotalAmount = 0
	}
	b.PaidAmount = 0
	b.Status = "PENDING"

	query := `
	INSERT INTO bills (
		bill_number, tenant_id, property_id, billing_month, billing_period_start, billing_period_end,
		due_date, base_rent, prev_electricity_meter, curr_electricity_meter, electricity_rate,
		electricity_units, electricity_amount, water_billing_type, prev_water_meter, curr_water_meter,
		water_rate, water_units, water_amount, maintenance_amount, other_charges,
		other_charges_desc, discount_amount, discount_reason, previous_balance, total_amount, paid_amount, status, notes
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	res, err := db.Exec(query,
		b.BillNumber, b.TenantID, b.PropertyID, b.BillingMonth, b.BillingPeriodStart, b.BillingPeriodEnd,
		b.DueDate, b.BaseRent, b.PrevElectricityMeter, b.CurrElectricityMeter, b.ElectricityRate,
		b.ElectricityUnits, b.ElectricityAmount, b.WaterBillingType, b.PrevWaterMeter, b.CurrWaterMeter,
		b.WaterRate, b.WaterUnits, b.WaterAmount, b.MaintenanceAmount, b.OtherCharges,
		b.OtherChargesDesc, b.DiscountAmount, b.DiscountReason, b.PreviousBalance, b.TotalAmount, b.PaidAmount, b.Status, b.Notes,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (db *DB) GetAllBills() ([]Bill, error) {
	query := `
	SELECT b.id, b.bill_number, b.tenant_id, t.name, t.phone,
	       COALESCE(t.payment_upi, ''), COALESCE(t.payment_bank_name, ''),
	       COALESCE(t.payment_account_no, ''), COALESCE(t.payment_ifsc, ''),
	       b.property_id, p.name,
	       b.billing_month, COALESCE(b.billing_period_start, ''), COALESCE(b.billing_period_end, ''),
	       b.due_date, b.base_rent, b.prev_electricity_meter, b.curr_electricity_meter,
	       b.electricity_rate, b.electricity_units, b.electricity_amount,
	       COALESCE(b.water_billing_type, 'FIXED'), b.prev_water_meter, b.curr_water_meter,
	       b.water_rate, b.water_units, b.water_amount,
	       b.maintenance_amount, b.other_charges, COALESCE(b.other_charges_desc, ''),
	       COALESCE(b.discount_amount, 0), COALESCE(b.discount_reason, ''),
	       COALESCE(b.previous_balance, 0),
	       b.total_amount, b.paid_amount, b.status, COALESCE(b.notes, ''), b.created_at
	FROM bills b
	JOIN tenants t ON b.tenant_id = t.id
	JOIN properties p ON b.property_id = p.id
	ORDER BY b.id DESC
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bills []Bill
	today := time.Now().Format("2006-01-02")
	for rows.Next() {
		var b Bill
		err := rows.Scan(
			&b.ID, &b.BillNumber, &b.TenantID, &b.TenantName, &b.TenantPhone,
			&b.PaymentUPI, &b.PaymentBankName, &b.PaymentAccountNo, &b.PaymentIFSC,
			&b.PropertyID, &b.PropertyName,
			&b.BillingMonth, &b.BillingPeriodStart, &b.BillingPeriodEnd,
			&b.DueDate, &b.BaseRent, &b.PrevElectricityMeter, &b.CurrElectricityMeter,
			&b.ElectricityRate, &b.ElectricityUnits, &b.ElectricityAmount,
			&b.WaterBillingType, &b.PrevWaterMeter, &b.CurrWaterMeter,
			&b.WaterRate, &b.WaterUnits, &b.WaterAmount,
			&b.MaintenanceAmount, &b.OtherCharges, &b.OtherChargesDesc,
			&b.DiscountAmount, &b.DiscountReason,
			&b.PreviousBalance,
			&b.TotalAmount, &b.PaidAmount, &b.Status, &b.Notes, &b.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		b.BalanceAmount = b.TotalAmount - b.PaidAmount

		// Auto check overdue if due date passed and not fully paid
		if b.Status != "PAID" && b.DueDate < today {
			b.Status = "OVERDUE"
		}
		bills = append(bills, b)
	}
	return bills, nil
}

func (db *DB) GetBillsByTenant(tenantID int64) ([]Bill, error) {
	query := `
	SELECT b.id, b.bill_number, b.tenant_id, t.name, t.phone,
	       COALESCE(t.payment_upi, ''), COALESCE(t.payment_bank_name, ''),
	       COALESCE(t.payment_account_no, ''), COALESCE(t.payment_ifsc, ''),
	       b.property_id, p.name,
	       b.billing_month, COALESCE(b.billing_period_start, ''), COALESCE(b.billing_period_end, ''),
	       b.due_date, b.base_rent, b.prev_electricity_meter, b.curr_electricity_meter,
	       b.electricity_rate, b.electricity_units, b.electricity_amount,
	       COALESCE(b.water_billing_type, 'FIXED'), b.prev_water_meter, b.curr_water_meter,
	       b.water_rate, b.water_units, b.water_amount,
	       b.maintenance_amount, b.other_charges, COALESCE(b.other_charges_desc, ''),
	       COALESCE(b.discount_amount, 0), COALESCE(b.discount_reason, ''),
	       COALESCE(b.previous_balance, 0),
	       b.total_amount, b.paid_amount, b.status, COALESCE(b.notes, ''), b.created_at
	FROM bills b
	JOIN tenants t ON b.tenant_id = t.id
	JOIN properties p ON b.property_id = p.id
	WHERE b.tenant_id = ?
	ORDER BY b.id DESC
	`
	rows, err := db.Query(query, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bills []Bill
	today := time.Now().Format("2006-01-02")
	for rows.Next() {
		var b Bill
		err := rows.Scan(
			&b.ID, &b.BillNumber, &b.TenantID, &b.TenantName, &b.TenantPhone,
			&b.PaymentUPI, &b.PaymentBankName, &b.PaymentAccountNo, &b.PaymentIFSC,
			&b.PropertyID, &b.PropertyName,
			&b.BillingMonth, &b.BillingPeriodStart, &b.BillingPeriodEnd,
			&b.DueDate, &b.BaseRent, &b.PrevElectricityMeter, &b.CurrElectricityMeter,
			&b.ElectricityRate, &b.ElectricityUnits, &b.ElectricityAmount,
			&b.WaterBillingType, &b.PrevWaterMeter, &b.CurrWaterMeter,
			&b.WaterRate, &b.WaterUnits, &b.WaterAmount,
			&b.MaintenanceAmount, &b.OtherCharges, &b.OtherChargesDesc,
			&b.DiscountAmount, &b.DiscountReason,
			&b.PreviousBalance,
			&b.TotalAmount, &b.PaidAmount, &b.Status, &b.Notes, &b.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		b.BalanceAmount = b.TotalAmount - b.PaidAmount

		if b.Status != "PAID" && b.DueDate < today {
			b.Status = "OVERDUE"
		}
		bills = append(bills, b)
	}
	return bills, nil
}

func (db *DB) GetBillByID(id int64) (*Bill, error) {
	query := `
	SELECT b.id, b.bill_number, b.tenant_id, t.name, t.phone,
	       COALESCE(t.payment_upi, ''), COALESCE(t.payment_bank_name, ''),
	       COALESCE(t.payment_account_no, ''), COALESCE(t.payment_ifsc, ''),
	       b.property_id, p.name,
	       b.billing_month, COALESCE(b.billing_period_start, ''), COALESCE(b.billing_period_end, ''),
	       b.due_date, b.base_rent, b.prev_electricity_meter, b.curr_electricity_meter,
	       b.electricity_rate, b.electricity_units, b.electricity_amount,
	       COALESCE(b.water_billing_type, 'FIXED'), b.prev_water_meter, b.curr_water_meter,
	       b.water_rate, b.water_units, b.water_amount,
	       b.maintenance_amount, b.other_charges, COALESCE(b.other_charges_desc, ''),
	       COALESCE(b.discount_amount, 0), COALESCE(b.discount_reason, ''),
	       COALESCE(b.previous_balance, 0),
	       b.total_amount, b.paid_amount, b.status, COALESCE(b.notes, ''), b.created_at
	FROM bills b
	JOIN tenants t ON b.tenant_id = t.id
	JOIN properties p ON b.property_id = p.id
	WHERE b.id = ?
	`
	var b Bill
	err := db.QueryRow(query, id).Scan(
		&b.ID, &b.BillNumber, &b.TenantID, &b.TenantName, &b.TenantPhone,
		&b.PaymentUPI, &b.PaymentBankName, &b.PaymentAccountNo, &b.PaymentIFSC,
		&b.PropertyID, &b.PropertyName,
		&b.BillingMonth, &b.BillingPeriodStart, &b.BillingPeriodEnd,
		&b.DueDate, &b.BaseRent, &b.PrevElectricityMeter, &b.CurrElectricityMeter,
		&b.ElectricityRate, &b.ElectricityUnits, &b.ElectricityAmount,
		&b.WaterBillingType, &b.PrevWaterMeter, &b.CurrWaterMeter,
		&b.WaterRate, &b.WaterUnits, &b.WaterAmount,
		&b.MaintenanceAmount, &b.OtherCharges, &b.OtherChargesDesc,
		&b.DiscountAmount, &b.DiscountReason,
		&b.PreviousBalance,
		&b.TotalAmount, &b.PaidAmount, &b.Status, &b.Notes, &b.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	b.BalanceAmount = b.TotalAmount - b.PaidAmount
	today := time.Now().Format("2006-01-02")
	if b.Status != "PAID" && b.DueDate < today {
		b.Status = "OVERDUE"
	}
	payments, _ := db.GetPaymentsByBillID(id)
	b.Payments = payments
	return &b, nil
}

func (db *DB) UpdateBill(b *Bill) error {
	// Recalculate electricity units & amount
	if b.CurrElectricityMeter >= b.PrevElectricityMeter {
		b.ElectricityUnits = b.CurrElectricityMeter - b.PrevElectricityMeter
	} else {
		b.ElectricityUnits = 0
	}
	b.ElectricityAmount = math.Round(b.ElectricityUnits*b.ElectricityRate*100) / 100

	// Recalculate water units & amount based on billing type
	if b.WaterBillingType == "METER" {
		if b.CurrWaterMeter >= b.PrevWaterMeter {
			b.WaterUnits = b.CurrWaterMeter - b.PrevWaterMeter
		} else {
			b.WaterUnits = 0
		}
		b.WaterAmount = math.Round(b.WaterUnits*b.WaterRate*100) / 100
	} else {
		b.WaterBillingType = "FIXED"
		b.WaterUnits = 0
	}

	b.TotalAmount = b.BaseRent + b.ElectricityAmount + b.WaterAmount + b.MaintenanceAmount + b.OtherCharges + b.PreviousBalance - b.DiscountAmount
	if b.TotalAmount < 0 {
		b.TotalAmount = 0
	}

	// Recheck status based on paid amount
	today := time.Now().Format("2006-01-02")
	if b.PaidAmount >= b.TotalAmount {
		b.Status = "PAID"
	} else if b.PaidAmount > 0 {
		b.Status = "PARTIAL"
	} else if b.DueDate < today {
		b.Status = "OVERDUE"
	} else {
		b.Status = "PENDING"
	}

	query := `
	UPDATE bills
	SET billing_month = ?, due_date = ?, base_rent = ?, prev_electricity_meter = ?, curr_electricity_meter = ?,
	    electricity_rate = ?, electricity_units = ?, electricity_amount = ?, water_billing_type = ?,
	    prev_water_meter = ?, curr_water_meter = ?, water_rate = ?, water_units = ?, water_amount = ?,
	    maintenance_amount = ?, other_charges = ?, other_charges_desc = ?, discount_amount = ?, discount_reason = ?, previous_balance = ?, total_amount = ?, status = ?, notes = ?
	WHERE id = ?
	`
	_, err := db.Exec(query,
		b.BillingMonth, b.DueDate, b.BaseRent, b.PrevElectricityMeter, b.CurrElectricityMeter,
		b.ElectricityRate, b.ElectricityUnits, b.ElectricityAmount, b.WaterBillingType,
		b.PrevWaterMeter, b.CurrWaterMeter, b.WaterRate, b.WaterUnits, b.WaterAmount,
		b.MaintenanceAmount, b.OtherCharges, b.OtherChargesDesc, b.DiscountAmount, b.DiscountReason, b.PreviousBalance, b.TotalAmount, b.Status, b.Notes,
		b.ID,
	)
	return err
}

func (db *DB) DeleteBill(id int64) error {
	var paymentCount int
	err := db.QueryRow("SELECT COUNT(*) FROM payments WHERE bill_id = ?", id).Scan(&paymentCount)
	if err != nil {
		return err
	}
	if paymentCount > 0 {
		return fmt.Errorf("delete payments first to remove this bill")
	}

	_, err = db.Exec("DELETE FROM bills WHERE id = ?", id)
	return err
}

func (db *DB) recalcBillStatusInTx(tx *sql.Tx, billID int64) error {
	var totalPaid float64
	err := tx.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM payments WHERE bill_id = ?", billID).Scan(&totalPaid)
	if err != nil {
		return err
	}

	var totalAmount float64
	var dueDate string
	err = tx.QueryRow("SELECT total_amount, due_date FROM bills WHERE id = ?", billID).Scan(&totalAmount, &dueDate)
	if err != nil {
		return err
	}

	var newStatus string
	if totalPaid >= totalAmount && totalAmount > 0 {
		newStatus = "PAID"
	} else if totalPaid > 0 {
		newStatus = "PARTIAL"
	} else {
		today := time.Now().Format("2006-01-02")
		if dueDate < today {
			newStatus = "OVERDUE"
		} else {
			newStatus = "PENDING"
		}
	}

	_, err = tx.Exec("UPDATE bills SET paid_amount = ?, status = ? WHERE id = ?", totalPaid, newStatus, billID)
	return err
}

func (db *DB) RecordPayment(p *Payment) (int64, error) {
	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	// Insert payment
	query := `
	INSERT INTO payments (bill_id, amount, payment_date, payment_method, reference_no, notes)
	VALUES (?, ?, ?, ?, ?, ?)
	`
	res, err := tx.Exec(query, p.BillID, p.Amount, p.PaymentDate, p.PaymentMethod, p.ReferenceNo, p.Notes)
	if err != nil {
		return 0, err
	}
	paymentID, _ := res.LastInsertId()

	if err := db.recalcBillStatusInTx(tx, p.BillID); err != nil {
		return 0, err
	}

	return paymentID, tx.Commit()
}

func (db *DB) GetPaymentByID(id int64) (*Payment, error) {
	query := `
	SELECT p.id, p.bill_id, b.bill_number, t.name, p.amount, p.payment_date, p.payment_method, COALESCE(p.reference_no, ''), COALESCE(p.notes, ''), p.created_at
	FROM payments p
	JOIN bills b ON p.bill_id = b.id
	JOIN tenants t ON b.tenant_id = t.id
	WHERE p.id = ?
	`
	var p Payment
	err := db.QueryRow(query, id).Scan(
		&p.ID, &p.BillID, &p.BillNumber, &p.TenantName, &p.Amount, &p.PaymentDate, &p.PaymentMethod, &p.ReferenceNo, &p.Notes, &p.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (db *DB) GetPaymentsByBillID(billID int64) ([]Payment, error) {
	query := `
	SELECT p.id, p.bill_id, b.bill_number, t.name, p.amount, p.payment_date, p.payment_method, COALESCE(p.reference_no, ''), COALESCE(p.notes, ''), p.created_at
	FROM payments p
	JOIN bills b ON p.bill_id = b.id
	JOIN tenants t ON b.tenant_id = t.id
	WHERE p.bill_id = ?
	ORDER BY p.payment_date DESC, p.id DESC
	`
	rows, err := db.Query(query, billID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []Payment
	for rows.Next() {
		var p Payment
		err := rows.Scan(&p.ID, &p.BillID, &p.BillNumber, &p.TenantName, &p.Amount, &p.PaymentDate, &p.PaymentMethod, &p.ReferenceNo, &p.Notes, &p.CreatedAt)
		if err != nil {
			return nil, err
		}
		payments = append(payments, p)
	}
	if payments == nil {
		payments = []Payment{}
	}
	return payments, nil
}

func (db *DB) UpdatePayment(p *Payment) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var billID int64
	err = tx.QueryRow("SELECT bill_id FROM payments WHERE id = ?", p.ID).Scan(&billID)
	if err != nil {
		return err
	}
	p.BillID = billID

	_, err = tx.Exec(`
		UPDATE payments
		SET amount = ?, payment_date = ?, payment_method = ?, reference_no = ?, notes = ?
		WHERE id = ?
	`, p.Amount, p.PaymentDate, p.PaymentMethod, p.ReferenceNo, p.Notes, p.ID)
	if err != nil {
		return err
	}

	if err := db.recalcBillStatusInTx(tx, billID); err != nil {
		return err
	}

	return tx.Commit()
}

func (db *DB) DeletePayment(id int64) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var billID int64
	err = tx.QueryRow("SELECT bill_id FROM payments WHERE id = ?", id).Scan(&billID)
	if err != nil {
		return err
	}

	_, err = tx.Exec("DELETE FROM payments WHERE id = ?", id)
	if err != nil {
		return err
	}

	if err := db.recalcBillStatusInTx(tx, billID); err != nil {
		return err
	}

	return tx.Commit()
}

func (db *DB) GetAllPayments() ([]Payment, error) {
	query := `
	SELECT p.id, p.bill_id, b.bill_number, t.name, COALESCE(pr.name, 'No Unit'), p.amount, p.payment_date, p.payment_method, COALESCE(p.reference_no, ''), COALESCE(p.notes, ''), p.created_at
	FROM payments p
	JOIN bills b ON p.bill_id = b.id
	JOIN tenants t ON b.tenant_id = t.id
	LEFT JOIN properties pr ON b.property_id = pr.id
	ORDER BY p.id DESC
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []Payment
	for rows.Next() {
		var p Payment
		err := rows.Scan(&p.ID, &p.BillID, &p.BillNumber, &p.TenantName, &p.PropertyName, &p.Amount, &p.PaymentDate, &p.PaymentMethod, &p.ReferenceNo, &p.Notes, &p.CreatedAt)
		if err != nil {
			return nil, err
		}
		payments = append(payments, p)
	}
	if payments == nil {
		payments = []Payment{}
	}
	return payments, nil
}

// GetBatchBillPreview returns the list of active unbilled tenants for billingMonth with their previous meter readings and arrears.
func (db *DB) GetBatchBillPreview(billingMonth string) ([]BatchBillPreviewItem, error) {
	if billingMonth == "" {
		return nil, fmt.Errorf("billing month is required")
	}

	query := `
	SELECT t.id, t.name, t.phone, t.property_id, t.opening_arrear,
	       t.initial_elec_meter, t.initial_water_meter,
	       p.name, p.default_rent, p.electricity_rate, p.water_billing_type,
	       p.water_charge, p.water_rate, p.maintenance_charge
	FROM tenants t
	JOIN properties p ON t.property_id = p.id
	WHERE t.is_active = 1
	  AND t.property_id IS NOT NULL
	  AND t.id NOT IN (SELECT tenant_id FROM bills WHERE billing_month = ?)
	ORDER BY p.name ASC, t.name ASC
	`
	rows, err := db.Query(query, billingMonth)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type rawPreview struct {
		it            BatchBillPreviewItem
		openingArrear float64
		initElec      float64
		initWater     float64
	}

	var rawList []rawPreview
	for rows.Next() {
		var rp rawPreview
		if err := rows.Scan(
			&rp.it.TenantID, &rp.it.TenantName, &rp.it.TenantPhone, &rp.it.PropertyID, &rp.openingArrear,
			&rp.initElec, &rp.initWater,
			&rp.it.PropertyName, &rp.it.DefaultRent, &rp.it.ElectricityRate, &rp.it.WaterBillingType,
			&rp.it.WaterCharge, &rp.it.WaterRate, &rp.it.MaintenanceCharge,
		); err != nil {
			return nil, err
		}
		rawList = append(rawList, rp)
	}
	rows.Close()

	var items []BatchBillPreviewItem
	for _, rp := range rawList {
		it := rp.it
		var prevElec, prevWater, pendingBal float64
		err := db.QueryRow(`
			SELECT curr_electricity_meter, curr_water_meter, (total_amount - paid_amount) as balance_amount
			FROM bills
			WHERE tenant_id = ?
			ORDER BY id DESC
			LIMIT 1
		`, it.TenantID).Scan(&prevElec, &prevWater, &pendingBal)

		if err != nil {
			prevElec = rp.initElec
			prevWater = rp.initWater
			pendingBal = rp.openingArrear
		}

		it.PrevElectricityMeter = prevElec
		it.PrevWaterMeter = prevWater
		it.PreviousBalance = pendingBal

		items = append(items, it)
	}

	if items == nil {
		items = []BatchBillPreviewItem{}
	}
	return items, nil
}

// BatchCreateMonthlyBills automatically creates monthly bills for all active tenants who do not have a bill for billingMonth.
// It carries forward previous electricity & water meter readings, allows custom readings via entries, sets base rent & fixed charges, and rolls over any unpaid arrears.
func (db *DB) BatchCreateMonthlyBills(billingMonth, dueDate string, entries []BatchBillEntry) ([]Bill, error) {
	if billingMonth == "" {
		return nil, fmt.Errorf("billing month is required")
	}
	if dueDate == "" {
		dueDate = billingMonth + "-10"
	}

	entryMap := make(map[int64]BatchBillEntry)
	for _, e := range entries {
		entryMap[e.TenantID] = e
	}

	periodStart := billingMonth + "-01"
	periodEnd := billingMonth + "-28"
	if t, err := time.Parse("2006-01", billingMonth); err == nil {
		nextMonth := t.AddDate(0, 1, 0)
		lastDay := nextMonth.AddDate(0, 0, -1)
		periodEnd = lastDay.Format("2006-01-02")
	}

	// Query active tenants with an assigned property who do not yet have a bill for billingMonth
	query := `
	SELECT t.id, t.name, t.phone, t.property_id, t.opening_arrear,
	       t.initial_elec_meter, t.initial_water_meter,
	       p.name, p.default_rent, p.electricity_rate, p.water_billing_type,
	       p.water_charge, p.water_rate, p.maintenance_charge
	FROM tenants t
	JOIN properties p ON t.property_id = p.id
	WHERE t.is_active = 1
	  AND t.property_id IS NOT NULL
	  AND t.id NOT IN (SELECT tenant_id FROM bills WHERE billing_month = ?)
	ORDER BY t.name ASC
	`
	rows, err := db.Query(query, billingMonth)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type tenantRow struct {
		tenantID         int64
		tenantName       string
		tenantPhone      string
		propertyID       int64
		openingArrear    float64
		initialElec      float64
		initialWater     float64
		propertyName     string
		defaultRent      float64
		elecRate         float64
		waterBillingType string
		waterCharge      float64
		waterRate        float64
		maintCharge      float64
	}

	var list []tenantRow
	for rows.Next() {
		var tr tenantRow
		if err := rows.Scan(
			&tr.tenantID, &tr.tenantName, &tr.tenantPhone, &tr.propertyID, &tr.openingArrear,
			&tr.initialElec, &tr.initialWater,
			&tr.propertyName, &tr.defaultRent, &tr.elecRate, &tr.waterBillingType,
			&tr.waterCharge, &tr.waterRate, &tr.maintCharge,
		); err != nil {
			return nil, err
		}
		list = append(list, tr)
	}
	rows.Close()

	if len(list) == 0 {
		return []Bill{}, nil
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	insertStmt, err := tx.Prepare(`
	INSERT INTO bills (
		bill_number, tenant_id, property_id, billing_month, billing_period_start, billing_period_end,
		due_date, base_rent, prev_electricity_meter, curr_electricity_meter, electricity_rate,
		electricity_units, electricity_amount, water_billing_type, prev_water_meter, curr_water_meter,
		water_rate, water_units, water_amount, maintenance_amount, other_charges,
		other_charges_desc, discount_amount, discount_reason, previous_balance, total_amount, paid_amount, status, notes
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return nil, err
	}
	defer insertStmt.Close()

	var createdBills []Bill

	for idx, tr := range list {
		// Carry over readings & arrears from latest bill
		var prevElec, prevWater, pendingBal float64
		var hasPriorBill bool
		err := tx.QueryRow(`
			SELECT curr_electricity_meter, curr_water_meter, (total_amount - paid_amount) as balance_amount
			FROM bills
			WHERE tenant_id = ?
			ORDER BY id DESC
			LIMIT 1
		`, tr.tenantID).Scan(&prevElec, &prevWater, &pendingBal)
		if err == nil {
			hasPriorBill = true
		}

		if !hasPriorBill {
			prevElec = tr.initialElec
			prevWater = tr.initialWater
			pendingBal = tr.openingArrear
		}

		// Electricity calculation
		currElec := prevElec
		if ent, ok := entryMap[tr.tenantID]; ok && ent.CurrElectricityMeter != nil {
			currElec = *ent.CurrElectricityMeter
		}
		elecUnits := 0.0
		if currElec >= prevElec {
			elecUnits = currElec - prevElec
		}
		elecAmount := math.Round(elecUnits*tr.elecRate*100) / 100

		// Water calculation
		currWater := prevWater
		waterUnits := 0.0
		waterAmount := 0.0
		if tr.waterBillingType == "METER" {
			if ent, ok := entryMap[tr.tenantID]; ok && ent.CurrWaterMeter != nil {
				currWater = *ent.CurrWaterMeter
			}
			if currWater >= prevWater {
				waterUnits = currWater - prevWater
			}
			waterAmount = math.Round(waterUnits*tr.waterRate*100) / 100
		} else {
			waterAmount = tr.waterCharge
		}

		totalAmount := tr.defaultRent + elecAmount + waterAmount + tr.maintCharge + pendingBal
		if totalAmount < 0 {
			totalAmount = 0
		}

		// Unique bill number with index offset
		billNumber := fmt.Sprintf("RB-%s-%04d%02d", time.Now().Format("200601"), time.Now().UnixNano()%10000, (idx+1)%100)

		res, err := insertStmt.Exec(
			billNumber, tr.tenantID, tr.propertyID, billingMonth, periodStart, periodEnd,
			dueDate, tr.defaultRent, prevElec, currElec, tr.elecRate,
			elecUnits, elecAmount, tr.waterBillingType, prevWater, currWater,
			tr.waterRate, waterUnits, waterAmount, tr.maintCharge, 0.0,
			"", 0.0, "", pendingBal, totalAmount, 0.0, "PENDING", "Auto-generated monthly rent roll",
		)
		if err != nil {
			return nil, fmt.Errorf("failed creating bill for %s: %w", tr.tenantName, err)
		}

		lastID, _ := res.LastInsertId()
		createdBills = append(createdBills, Bill{
			ID:                   lastID,
			BillNumber:           billNumber,
			TenantID:             tr.tenantID,
			TenantName:           tr.tenantName,
			TenantPhone:          tr.tenantPhone,
			PropertyID:           tr.propertyID,
			PropertyName:         tr.propertyName,
			BillingMonth:         billingMonth,
			BillingPeriodStart:   periodStart,
			BillingPeriodEnd:     periodEnd,
			DueDate:              dueDate,
			BaseRent:             tr.defaultRent,
			PrevElectricityMeter: prevElec,
			CurrElectricityMeter: currElec,
			ElectricityRate:      tr.elecRate,
			ElectricityUnits:     elecUnits,
			ElectricityAmount:    elecAmount,
			WaterBillingType:     tr.waterBillingType,
			PrevWaterMeter:       prevWater,
			CurrWaterMeter:       currWater,
			WaterRate:            tr.waterRate,
			WaterUnits:           waterUnits,
			WaterAmount:          waterAmount,
			MaintenanceAmount:    tr.maintCharge,
			PreviousBalance:      pendingBal,
			TotalAmount:          totalAmount,
			PaidAmount:           0,
			Status:               "PENDING",
			Notes:                "Auto-generated monthly rent roll",
		})
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return createdBills, nil
}
