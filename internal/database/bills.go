package database

import (
	"database/sql"
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
	_, err := db.Exec("DELETE FROM bills WHERE id = ?", id)
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

	// Update bill paid amount and status
	var totalAmount, paidAmount float64
	var dueDate string
	err = tx.QueryRow("SELECT total_amount, paid_amount, due_date FROM bills WHERE id = ?", p.BillID).Scan(&totalAmount, &paidAmount, &dueDate)
	if err != nil {
		return 0, err
	}

	newPaid := paidAmount + p.Amount
	var newStatus string
	if newPaid >= totalAmount {
		newStatus = "PAID"
	} else if newPaid > 0 {
		newStatus = "PARTIAL"
	} else {
		today := time.Now().Format("2006-01-02")
		if dueDate < today {
			newStatus = "OVERDUE"
		} else {
			newStatus = "PENDING"
		}
	}

	_, err = tx.Exec("UPDATE bills SET paid_amount = ?, status = ? WHERE id = ?", newPaid, newStatus, p.BillID)
	if err != nil {
		return 0, err
	}

	return paymentID, tx.Commit()
}

func (db *DB) GetAllPayments() ([]Payment, error) {
	query := `
	SELECT p.id, p.bill_id, b.bill_number, t.name, p.amount, p.payment_date, p.payment_method, COALESCE(p.reference_no, ''), COALESCE(p.notes, ''), p.created_at
	FROM payments p
	JOIN bills b ON p.bill_id = b.id
	JOIN tenants t ON b.tenant_id = t.id
	ORDER BY p.id DESC
	LIMIT 100
	`
	rows, err := db.Query(query)
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
	return payments, nil
}
