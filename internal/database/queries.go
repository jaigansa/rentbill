package database

import (
	"database/sql"
	"fmt"
	"math"
	"strings"
	"time"
)

// --- Property Queries ---

func (db *DB) CreateProperty(p *Property) (int64, error) {
	if p.WaterBillingType == "" {
		p.WaterBillingType = "FIXED"
	}
	query := `
	INSERT INTO properties (name, address, unit_type, default_rent, electricity_rate, water_billing_type, water_charge, water_rate, maintenance_charge)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	res, err := db.Exec(query, p.Name, p.Address, p.UnitType, p.DefaultRent, p.ElectricityRate, p.WaterBillingType, p.WaterCharge, p.WaterRate, p.MaintenanceCharge)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (db *DB) GetAllProperties() ([]Property, error) {
	query := `
	SELECT p.id, p.name, COALESCE(p.address, ''), COALESCE(p.unit_type, 'Apartment'),
	       p.default_rent, p.electricity_rate, COALESCE(p.water_billing_type, 'FIXED'),
	       p.water_charge, p.water_rate, p.maintenance_charge, p.created_at,
	       (SELECT COUNT(*) FROM tenants t WHERE t.property_id = p.id AND t.is_active = 1) as tenant_count,
	       COALESCE((SELECT SUM(amount) FROM expenses e WHERE e.property_id = p.id), 0.0) as total_expenses,
	       COALESCE((SELECT COUNT(*) FROM expenses e WHERE e.property_id = p.id), 0) as expense_count,
	       COALESCE((SELECT SUM(b.paid_amount) FROM bills b WHERE b.property_id = p.id), 0.0) as total_income
	FROM properties p
	ORDER BY p.name ASC
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var properties []Property
	for rows.Next() {
		var p Property
		err := rows.Scan(
			&p.ID, &p.Name, &p.Address, &p.UnitType, &p.DefaultRent, &p.ElectricityRate,
			&p.WaterBillingType, &p.WaterCharge, &p.WaterRate, &p.MaintenanceCharge, &p.CreatedAt,
			&p.TenantCount, &p.TotalExpenses, &p.ExpenseCount, &p.TotalIncome,
		)
		if err != nil {
			return nil, err
		}
		p.NetProfit = p.TotalIncome - p.TotalExpenses
		properties = append(properties, p)
	}
	return properties, nil
}

func (db *DB) GetPropertyByID(id int64) (*Property, error) {
	query := `SELECT id, name, COALESCE(address, ''), COALESCE(unit_type, 'Apartment'), default_rent, electricity_rate, COALESCE(water_billing_type, 'FIXED'), water_charge, water_rate, maintenance_charge, created_at FROM properties WHERE id = ?`
	var p Property
	err := db.QueryRow(query, id).Scan(&p.ID, &p.Name, &p.Address, &p.UnitType, &p.DefaultRent, &p.ElectricityRate, &p.WaterBillingType, &p.WaterCharge, &p.WaterRate, &p.MaintenanceCharge, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (db *DB) UpdateProperty(p *Property) error {
	if p.WaterBillingType == "" {
		p.WaterBillingType = "FIXED"
	}
	query := `
	UPDATE properties
	SET name = ?, address = ?, unit_type = ?, default_rent = ?, electricity_rate = ?, water_billing_type = ?, water_charge = ?, water_rate = ?, maintenance_charge = ?
	WHERE id = ?
	`
	_, err := db.Exec(query, p.Name, p.Address, p.UnitType, p.DefaultRent, p.ElectricityRate, p.WaterBillingType, p.WaterCharge, p.WaterRate, p.MaintenanceCharge, p.ID)
	return err
}

func (db *DB) DeleteProperty(id int64) error {
	_, err := db.Exec("DELETE FROM properties WHERE id = ?", id)
	return err
}

// --- Tenant Queries ---

func (db *DB) CreateTenant(t *Tenant) (int64, error) {
	if t.PreferredChannel == "" {
		t.PreferredChannel = "SMS_RCS"
	}
	query := `
	INSERT INTO tenants (
		name, phone, email, property_id, security_deposit, move_in_date,
		payment_upi, payment_bank_name, payment_account_no, payment_ifsc,
		initial_elec_meter, initial_water_meter, preferred_channel, is_active
	)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	res, err := db.Exec(query,
		t.Name, t.Phone, t.Email, t.PropertyID, t.SecurityDeposit, t.MoveInDate,
		t.PaymentUPI, t.PaymentBankName, t.PaymentAccountNo, t.PaymentIFSC,
		t.InitialElecMeter, t.InitialWaterMeter, t.PreferredChannel, 1,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (db *DB) GetAllTenants() ([]Tenant, error) {
	query := `
	SELECT t.id, t.name, t.phone, COALESCE(t.email, ''), t.property_id, COALESCE(p.name, ''),
	       t.security_deposit, COALESCE(t.move_in_date, ''),
	       COALESCE(t.payment_upi, ''), COALESCE(t.payment_bank_name, ''),
	       COALESCE(t.payment_account_no, ''), COALESCE(t.payment_ifsc, ''),
	       COALESCE(t.initial_elec_meter, 0.0), COALESCE(t.initial_water_meter, 0.0),
	       COALESCE(t.preferred_channel, 'SMS_RCS'),
	       t.is_active, t.created_at,
	       COALESCE(b_stats.total_paid, 0.0) AS total_paid,
	       COALESCE(b_stats.total_due, 0.0) AS total_due
	FROM tenants t
	LEFT JOIN properties p ON t.property_id = p.id
	LEFT JOIN (
		SELECT tenant_id,
		       SUM(paid_amount) AS total_paid,
		       SUM(total_amount - paid_amount) AS total_due
		FROM bills
		GROUP BY tenant_id
	) b_stats ON t.id = b_stats.tenant_id
	ORDER BY t.is_active DESC, t.name ASC
	`
	rows, err := db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tenants []Tenant
	for rows.Next() {
		var t Tenant
		var isActiveInt int
		err := rows.Scan(
			&t.ID, &t.Name, &t.Phone, &t.Email, &t.PropertyID, &t.PropertyName,
			&t.SecurityDeposit, &t.MoveInDate,
			&t.PaymentUPI, &t.PaymentBankName, &t.PaymentAccountNo, &t.PaymentIFSC,
			&t.InitialElecMeter, &t.InitialWaterMeter,
			&t.PreferredChannel,
			&isActiveInt, &t.CreatedAt,
			&t.TotalPaid, &t.TotalDue,
		)
		if err != nil {
			return nil, err
		}
		t.IsActive = (isActiveInt == 1)
		tenants = append(tenants, t)
	}
	return tenants, nil
}

func (db *DB) GetTenantByID(id int64) (*Tenant, error) {
	query := `
	SELECT t.id, t.name, t.phone, COALESCE(t.email, ''), t.property_id, COALESCE(p.name, ''),
	       t.security_deposit, COALESCE(t.move_in_date, ''),
	       COALESCE(t.payment_upi, ''), COALESCE(t.payment_bank_name, ''),
	       COALESCE(t.payment_account_no, ''), COALESCE(t.payment_ifsc, ''),
	       COALESCE(t.initial_elec_meter, 0.0), COALESCE(t.initial_water_meter, 0.0),
	       COALESCE(t.preferred_channel, 'SMS_RCS'),
	       t.is_active, t.created_at,
	       COALESCE(b_stats.total_paid, 0.0) AS total_paid,
	       COALESCE(b_stats.total_due, 0.0) AS total_due
	FROM tenants t
	LEFT JOIN properties p ON t.property_id = p.id
	LEFT JOIN (
		SELECT tenant_id,
		       SUM(paid_amount) AS total_paid,
		       SUM(total_amount - paid_amount) AS total_due
		FROM bills
		WHERE tenant_id = ?
		GROUP BY tenant_id
	) b_stats ON t.id = b_stats.tenant_id
	WHERE t.id = ?
	`
	var t Tenant
	var isActiveInt int
	err := db.QueryRow(query, id, id).Scan(
		&t.ID, &t.Name, &t.Phone, &t.Email, &t.PropertyID, &t.PropertyName,
		&t.SecurityDeposit, &t.MoveInDate,
		&t.PaymentUPI, &t.PaymentBankName, &t.PaymentAccountNo, &t.PaymentIFSC,
		&t.InitialElecMeter, &t.InitialWaterMeter,
		&t.PreferredChannel,
		&isActiveInt, &t.CreatedAt,
		&t.TotalPaid, &t.TotalDue,
	)
	if err != nil {
		return nil, err
	}
	t.IsActive = (isActiveInt == 1)
	return &t, nil
}

func (db *DB) UpdateTenant(t *Tenant) error {
	activeInt := 0
	if t.IsActive {
		activeInt = 1
	}
	if t.PreferredChannel == "" {
		t.PreferredChannel = "SMS_RCS"
	}
	query := `
	UPDATE tenants
	SET name = ?, phone = ?, email = ?, property_id = ?, security_deposit = ?, move_in_date = ?,
	    payment_upi = ?, payment_bank_name = ?, payment_account_no = ?, payment_ifsc = ?,
	    initial_elec_meter = ?, initial_water_meter = ?, preferred_channel = ?, is_active = ?
	WHERE id = ?
	`
	_, err := db.Exec(query,
		t.Name, t.Phone, t.Email, t.PropertyID, t.SecurityDeposit, t.MoveInDate,
		t.PaymentUPI, t.PaymentBankName, t.PaymentAccountNo, t.PaymentIFSC,
		t.InitialElecMeter, t.InitialWaterMeter, t.PreferredChannel, activeInt, t.ID,
	)
	return err
}

func (db *DB) DeleteTenant(id int64) error {
	_, err := db.Exec("DELETE FROM tenants WHERE id = ?", id)
	return err
}

// --- Bill Queries ---

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

	// Calculate total amount including previous balance (arrears)
	b.TotalAmount = b.BaseRent + b.ElectricityAmount + b.WaterAmount + b.MaintenanceAmount + b.OtherCharges + b.PreviousBalance
	b.PaidAmount = 0
	b.Status = "PENDING"

	query := `
	INSERT INTO bills (
		bill_number, tenant_id, property_id, billing_month, billing_period_start, billing_period_end,
		due_date, base_rent, prev_electricity_meter, curr_electricity_meter, electricity_rate,
		electricity_units, electricity_amount, water_billing_type, prev_water_meter, curr_water_meter,
		water_rate, water_units, water_amount, maintenance_amount, other_charges,
		other_charges_desc, previous_balance, total_amount, paid_amount, status, notes
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	res, err := db.Exec(query,
		b.BillNumber, b.TenantID, b.PropertyID, b.BillingMonth, b.BillingPeriodStart, b.BillingPeriodEnd,
		b.DueDate, b.BaseRent, b.PrevElectricityMeter, b.CurrElectricityMeter, b.ElectricityRate,
		b.ElectricityUnits, b.ElectricityAmount, b.WaterBillingType, b.PrevWaterMeter, b.CurrWaterMeter,
		b.WaterRate, b.WaterUnits, b.WaterAmount, b.MaintenanceAmount, b.OtherCharges,
		b.OtherChargesDesc, b.PreviousBalance, b.TotalAmount, b.PaidAmount, b.Status, b.Notes,
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

	b.TotalAmount = b.BaseRent + b.ElectricityAmount + b.WaterAmount + b.MaintenanceAmount + b.OtherCharges + b.PreviousBalance

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
	    maintenance_amount = ?, other_charges = ?, other_charges_desc = ?, previous_balance = ?, total_amount = ?, status = ?, notes = ?
	WHERE id = ?
	`
	_, err := db.Exec(query,
		b.BillingMonth, b.DueDate, b.BaseRent, b.PrevElectricityMeter, b.CurrElectricityMeter,
		b.ElectricityRate, b.ElectricityUnits, b.ElectricityAmount, b.WaterBillingType,
		b.PrevWaterMeter, b.CurrWaterMeter, b.WaterRate, b.WaterUnits, b.WaterAmount,
		b.MaintenanceAmount, b.OtherCharges, b.OtherChargesDesc, b.PreviousBalance, b.TotalAmount, b.Status, b.Notes,
		b.ID,
	)
	return err
}

func (db *DB) DeleteBill(id int64) error {
	_, err := db.Exec("DELETE FROM bills WHERE id = ?", id)
	return err
}

// --- Payment Queries ---

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

func (db *DB) GetPaymentsForBill(billID int64) ([]Payment, error) {
	query := `
	SELECT id, bill_id, amount, payment_date, payment_method, COALESCE(reference_no, ''), COALESCE(notes, ''), created_at
	FROM payments
	WHERE bill_id = ?
	ORDER BY payment_date DESC
	`
	rows, err := db.Query(query, billID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payments []Payment
	for rows.Next() {
		var p Payment
		err := rows.Scan(&p.ID, &p.BillID, &p.Amount, &p.PaymentDate, &p.PaymentMethod, &p.ReferenceNo, &p.Notes, &p.CreatedAt)
		if err != nil {
			return nil, err
		}
		payments = append(payments, p)
	}
	return payments, nil
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

// --- Dashboard Summary ---

func (db *DB) GetDashboardSummary(month string) (*DashboardSummary, error) {
	var summary DashboardSummary
	summary.ActionRequired.OverdueBills = []Bill{}
	summary.ActionRequired.UnbilledTenants = []Tenant{}
	summary.VacantProperties = []Property{}
	summary.AvailableMonths = []string{}
	summary.RecentBills = []Bill{}

	// Query distinct billing months available in database
	rowsM, err := db.Query("SELECT DISTINCT billing_month FROM bills WHERE billing_month != '' ORDER BY billing_month DESC")
	if err == nil {
		for rowsM.Next() {
			var m string
			if err := rowsM.Scan(&m); err == nil && m != "" {
				summary.AvailableMonths = append(summary.AvailableMonths, m)
			}
		}
		rowsM.Close()
	}

	// Determine selected month (if month is empty, pick first available month or current month)
	currentMonth := time.Now().Format("2006-01")
	if month == "" {
		if len(summary.AvailableMonths) > 0 {
			// check if current month exists in available
			found := false
			for _, m := range summary.AvailableMonths {
				if m == currentMonth {
					found = true
					break
				}
			}
			if found {
				summary.SelectedMonth = currentMonth
			} else {
				summary.SelectedMonth = summary.AvailableMonths[0]
			}
		} else {
			summary.SelectedMonth = currentMonth
		}
	} else {
		summary.SelectedMonth = month
	}

	// 1. Property & Occupancy counts
	_ = db.QueryRow("SELECT COUNT(*) FROM properties").Scan(&summary.TotalProperties)
	_ = db.QueryRow("SELECT COUNT(*) FROM tenants WHERE is_active = 1").Scan(&summary.TotalTenants)
	_ = db.QueryRow(`
		SELECT COUNT(DISTINCT property_id) 
		FROM tenants 
		WHERE is_active = 1 AND property_id IS NOT NULL
	`).Scan(&summary.OccupiedUnits)

	if summary.TotalProperties >= summary.OccupiedUnits {
		summary.VacantUnits = summary.TotalProperties - summary.OccupiedUnits
	}

	// List vacant properties
	vacantRows, err := db.Query(`
		SELECT p.id, p.name, COALESCE(p.unit_type, 'Apartment'), p.default_rent, COALESCE(p.address, '')
		FROM properties p
		WHERE p.id NOT IN (SELECT DISTINCT property_id FROM tenants WHERE is_active = 1 AND property_id IS NOT NULL)
		ORDER BY p.name ASC
	`)
	if err == nil {
		for vacantRows.Next() {
			var p Property
			if err := vacantRows.Scan(&p.ID, &p.Name, &p.UnitType, &p.DefaultRent, &p.Address); err == nil {
				summary.VacantProperties = append(summary.VacantProperties, p)
			}
		}
		vacantRows.Close()
	}

	// 2. Financial & Utility Aggregation (Filtered by month unless "ALL")
	var query string
	var args []interface{}

	if strings.ToUpper(summary.SelectedMonth) == "ALL" {
		query = `
		SELECT 
			COALESCE(SUM(total_amount), 0),
			COALESCE(SUM(paid_amount), 0),
			COALESCE(SUM(CASE WHEN status != 'PAID' THEN (total_amount - paid_amount) ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'OVERDUE' OR (status != 'PAID' AND due_date < date('now')) THEN (total_amount - paid_amount) ELSE 0 END), 0),
			COALESCE(COUNT(CASE WHEN status != 'PAID' THEN 1 END), 0),
			COALESCE(SUM(electricity_units), 0),
			COALESCE(SUM(water_units), 0),
			COALESCE(SUM(electricity_amount), 0),
			COALESCE(SUM(water_amount), 0)
		FROM bills
		`
	} else {
		query = `
		SELECT 
			COALESCE(SUM(total_amount), 0),
			COALESCE(SUM(paid_amount), 0),
			COALESCE(SUM(CASE WHEN status != 'PAID' THEN (total_amount - paid_amount) ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'OVERDUE' OR (status != 'PAID' AND due_date < date('now')) THEN (total_amount - paid_amount) ELSE 0 END), 0),
			COALESCE(COUNT(CASE WHEN status != 'PAID' THEN 1 END), 0),
			COALESCE(SUM(electricity_units), 0),
			COALESCE(SUM(water_units), 0),
			COALESCE(SUM(electricity_amount), 0),
			COALESCE(SUM(water_amount), 0)
		FROM bills
		WHERE billing_month = ?
		`
		args = append(args, summary.SelectedMonth)
	}

	err = db.QueryRow(query, args...).Scan(
		&summary.TotalBilled,
		&summary.TotalCollected,
		&summary.TotalPending,
		&summary.TotalOverdue,
		&summary.PendingBills,
		&summary.TotalElecUnits,
		&summary.TotalWaterUnits,
		&summary.TotalElecAmount,
		&summary.TotalWaterAmount,
	)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Calculate collection rate percentage
	if summary.TotalBilled > 0 {
		summary.CollectionRate = math.Round((summary.TotalCollected / summary.TotalBilled) * 1000) / 10
		if summary.CollectionRate > 100 {
			summary.CollectionRate = 100
		}
	} else {
		summary.CollectionRate = 0
	}

	// Calculate Total Expenses & Net Profit for selected period
	if strings.ToUpper(summary.SelectedMonth) == "ALL" {
		_ = db.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM expenses").Scan(&summary.TotalExpenses)
	} else {
		// Matches 'YYYY-MM' prefix in expense_date
		_ = db.QueryRow("SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE strftime('%Y-%m', expense_date) = ?", summary.SelectedMonth).Scan(&summary.TotalExpenses)
	}
	summary.NetProfit = summary.TotalCollected - summary.TotalExpenses

	// 3. Action Feed - Overdue Bills
	var overdueQuery string
	var overdueArgs []interface{}
	if strings.ToUpper(summary.SelectedMonth) == "ALL" {
		overdueQuery = `
		SELECT b.id, b.bill_number, b.tenant_id, t.name, t.phone, 
		       COALESCE(t.payment_upi, ''), COALESCE(t.payment_bank_name, ''),
		       b.property_id, p.name, b.billing_month, b.due_date,
		       b.total_amount, b.paid_amount, (b.total_amount - b.paid_amount) as balance, b.status
		FROM bills b
		JOIN tenants t ON b.tenant_id = t.id
		JOIN properties p ON b.property_id = p.id
		WHERE b.status != 'PAID' AND (b.status = 'OVERDUE' OR b.due_date < date('now'))
		ORDER BY b.due_date ASC
		LIMIT 10
		`
	} else {
		overdueQuery = `
		SELECT b.id, b.bill_number, b.tenant_id, t.name, t.phone, 
		       COALESCE(t.payment_upi, ''), COALESCE(t.payment_bank_name, ''),
		       b.property_id, p.name, b.billing_month, b.due_date,
		       b.total_amount, b.paid_amount, (b.total_amount - b.paid_amount) as balance, b.status
		FROM bills b
		JOIN tenants t ON b.tenant_id = t.id
		JOIN properties p ON b.property_id = p.id
		WHERE b.billing_month = ? AND b.status != 'PAID' AND (b.status = 'OVERDUE' OR b.due_date < date('now'))
		ORDER BY b.due_date ASC
		LIMIT 10
		`
		overdueArgs = append(overdueArgs, summary.SelectedMonth)
	}

	odRows, err := db.Query(overdueQuery, overdueArgs...)
	if err == nil {
		for odRows.Next() {
			var b Bill
			if err := odRows.Scan(&b.ID, &b.BillNumber, &b.TenantID, &b.TenantName, &b.TenantPhone,
				&b.PaymentUPI, &b.PaymentBankName,
				&b.PropertyID, &b.PropertyName, &b.BillingMonth, &b.DueDate,
				&b.TotalAmount, &b.PaidAmount, &b.BalanceAmount, &b.Status); err == nil {
				summary.ActionRequired.OverdueBills = append(summary.ActionRequired.OverdueBills, b)
			}
		}
		odRows.Close()
	}

	// 4. Action Feed - Unbilled Active Tenants (For selected month when month is not 'ALL')
	if strings.ToUpper(summary.SelectedMonth) != "ALL" {
		unbilledQuery := `
		SELECT t.id, t.name, t.phone, COALESCE(t.email, ''), t.property_id, 
		       COALESCE(p.name, 'No Unit'), t.security_deposit, COALESCE(t.move_in_date, '')
		FROM tenants t
		LEFT JOIN properties p ON t.property_id = p.id
		WHERE t.is_active = 1
		  AND t.id NOT IN (
		      SELECT tenant_id FROM bills WHERE billing_month = ?
		  )
		ORDER BY t.name ASC
		`
		ubRows, err := db.Query(unbilledQuery, summary.SelectedMonth)
		if err == nil {
			for ubRows.Next() {
				var t Tenant
				if err := ubRows.Scan(&t.ID, &t.Name, &t.Phone, &t.Email, &t.PropertyID,
					&t.PropertyName, &t.SecurityDeposit, &t.MoveInDate); err == nil {
					summary.ActionRequired.UnbilledTenants = append(summary.ActionRequired.UnbilledTenants, t)
				}
			}
			ubRows.Close()
		}
	}

	return &summary, nil
}

// --- App Settings (Email Backup / Config) ---

func (db *DB) SetSetting(key, value string) error {
	_, err := db.Exec("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", key, value)
	return err
}

func (db *DB) GetSetting(key string) string {
	var val string
	_ = db.QueryRow("SELECT value FROM app_settings WHERE key = ?", key).Scan(&val)
	return strings.TrimSpace(val)
}

// --- Expense Queries ---

func (db *DB) CreateExpense(e *Expense) (int64, error) {
	query := `
	INSERT INTO expenses (property_id, title, category, amount, expense_date, paid_to, payment_method, notes)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`
	res, err := db.Exec(query, e.PropertyID, e.Title, e.Category, e.Amount, e.ExpenseDate, e.PaidTo, e.PaymentMethod, e.Notes)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (db *DB) GetExpensesByProperty(propertyID int64) ([]Expense, error) {
	query := `
	SELECT e.id, e.property_id, p.name, e.title, e.category, e.amount, e.expense_date,
	       COALESCE(e.paid_to, ''), COALESCE(e.payment_method, 'Cash'), COALESCE(e.notes, ''), e.created_at
	FROM expenses e
	JOIN properties p ON e.property_id = p.id
	WHERE e.property_id = ?
	ORDER BY e.expense_date DESC, e.id DESC
	`
	rows, err := db.Query(query, propertyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var expenses []Expense
	for rows.Next() {
		var ex Expense
		err := rows.Scan(
			&ex.ID, &ex.PropertyID, &ex.PropertyName, &ex.Title, &ex.Category, &ex.Amount,
			&ex.ExpenseDate, &ex.PaidTo, &ex.PaymentMethod, &ex.Notes, &ex.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		expenses = append(expenses, ex)
	}
	return expenses, nil
}

func (db *DB) GetExpenseByID(id int64) (*Expense, error) {
	query := `
	SELECT e.id, e.property_id, p.name, e.title, e.category, e.amount, e.expense_date,
	       COALESCE(e.paid_to, ''), COALESCE(e.payment_method, 'Cash'), COALESCE(e.notes, ''), e.created_at
	FROM expenses e
	JOIN properties p ON e.property_id = p.id
	WHERE e.id = ?
	`
	var ex Expense
	err := db.QueryRow(query, id).Scan(
		&ex.ID, &ex.PropertyID, &ex.PropertyName, &ex.Title, &ex.Category, &ex.Amount,
		&ex.ExpenseDate, &ex.PaidTo, &ex.PaymentMethod, &ex.Notes, &ex.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &ex, nil
}

func (db *DB) UpdateExpense(e *Expense) error {
	query := `
	UPDATE expenses
	SET property_id = ?, title = ?, category = ?, amount = ?, expense_date = ?, paid_to = ?, payment_method = ?, notes = ?
	WHERE id = ?
	`
	_, err := db.Exec(query, e.PropertyID, e.Title, e.Category, e.Amount, e.ExpenseDate, e.PaidTo, e.PaymentMethod, e.Notes, e.ID)
	return err
}

func (db *DB) DeleteExpense(id int64) error {
	_, err := db.Exec("DELETE FROM expenses WHERE id = ?", id)
	return err
}

// --- Tenant Ledger & Passbook ---

func (db *DB) GetTenantLedger(tenantID int64) (*TenantLedger, error) {
	tenant, err := db.GetTenantByID(tenantID)
	if err != nil {
		return nil, err
	}

	ledger := &TenantLedger{
		Tenant:  *tenant,
		Entries: []LedgerEntry{},
	}

	// Fetch all bills for tenant ordered by created_at / billing_period ASC
	billRows, err := db.Query(`
		SELECT id, bill_number, billing_month, billing_period_start, total_amount, paid_amount, status, created_at
		FROM bills
		WHERE tenant_id = ?
		ORDER BY id ASC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer billRows.Close()

	type rawBill struct {
		ID           int64
		BillNumber   string
		BillingMonth string
		PeriodStart  string
		TotalAmount  float64
		PaidAmount   float64
		Status       string
		CreatedAt    string
	}
	var bills []rawBill
	for billRows.Next() {
		var rb rawBill
		if err := billRows.Scan(&rb.ID, &rb.BillNumber, &rb.BillingMonth, &rb.PeriodStart, &rb.TotalAmount, &rb.PaidAmount, &rb.Status, &rb.CreatedAt); err != nil {
			return nil, err
		}
		bills = append(bills, rb)
	}

	// Fetch all payments for bills of this tenant
	paymentRows, err := db.Query(`
		SELECT p.id, p.bill_id, b.bill_number, b.billing_month, p.amount, p.payment_date, p.payment_method, COALESCE(p.reference_no, ''), COALESCE(p.notes, ''), p.created_at
		FROM payments p
		JOIN bills b ON p.bill_id = b.id
		WHERE b.tenant_id = ?
		ORDER BY p.id ASC
	`, tenantID)
	if err != nil {
		return nil, err
	}
	defer paymentRows.Close()

	type rawPayment struct {
		ID            int64
		BillID        int64
		BillNumber    string
		BillingMonth  string
		Amount        float64
		PaymentDate   string
		PaymentMethod string
		ReferenceNo   string
		Notes         string
		CreatedAt     string
	}
	var payments []rawPayment
	for paymentRows.Next() {
		var rp rawPayment
		if err := paymentRows.Scan(&rp.ID, &rp.BillID, &rp.BillNumber, &rp.BillingMonth, &rp.Amount, &rp.PaymentDate, &rp.PaymentMethod, &rp.ReferenceNo, &rp.Notes, &rp.CreatedAt); err != nil {
			return nil, err
		}
		payments = append(payments, rp)
	}

	// Combine into chronological events
	// An event sort key can be the Date (or CreatedAt)
	type sortableItem struct {
		isBill  bool
		bill    rawBill
		payment rawPayment
		date    string
		order   int64
	}

	var items []sortableItem
	for _, b := range bills {
		d := b.PeriodStart
		if d == "" {
			d = b.CreatedAt
		}
		items = append(items, sortableItem{
			isBill: true,
			bill:   b,
			date:   d,
			order:  b.ID * 2, // bill first if same ID space
		})
	}
	for _, p := range payments {
		d := p.PaymentDate
		if d == "" {
			d = p.CreatedAt
		}
		items = append(items, sortableItem{
			isBill:  false,
			payment: p,
			date:    d,
			order:   p.BillID*2 + 1,
		})
	}

	// Sort chronologically
	for i := 0; i < len(items); i++ {
		for j := i + 1; j < len(items); j++ {
			if items[i].date > items[j].date || (items[i].date == items[j].date && items[i].order > items[j].order) {
				items[i], items[j] = items[j], items[i]
			}
		}
	}

	// Compute running balance
	var runningBalance float64 = 0
	var totalBilled float64 = 0
	var totalPaid float64 = 0

	for _, it := range items {
		if it.isBill {
			b := it.bill
			runningBalance += b.TotalAmount
			totalBilled += b.TotalAmount
			ledger.Entries = append(ledger.Entries, LedgerEntry{
				ID:             b.ID,
				Type:           "BILL",
				Date:           it.date,
				BillID:         b.ID,
				BillNumber:     b.BillNumber,
				BillingMonth:   b.BillingMonth,
				Description:    fmt.Sprintf("Rent Bill - %s (%s)", b.BillingMonth, b.BillNumber),
				Debit:          b.TotalAmount,
				Credit:         0,
				RunningBalance: runningBalance,
				Status:         b.Status,
			})
		} else {
			p := it.payment
			runningBalance -= p.Amount
			totalPaid += p.Amount
			desc := fmt.Sprintf("Payment Received - %s (%s)", p.PaymentMethod, p.BillNumber)
			if p.ReferenceNo != "" {
				desc += fmt.Sprintf(" [Ref: %s]", p.ReferenceNo)
			}
			ledger.Entries = append(ledger.Entries, LedgerEntry{
				ID:             p.ID,
				Type:           "PAYMENT",
				Date:           p.PaymentDate,
				BillID:         p.BillID,
				BillNumber:     p.BillNumber,
				BillingMonth:   p.BillingMonth,
				Description:    desc,
				Debit:          0,
				Credit:         p.Amount,
				RunningBalance: runningBalance,
				PaymentMethod:  p.PaymentMethod,
				ReferenceNo:    p.ReferenceNo,
			})
		}
	}

	ledger.TotalBilled = math.Round(totalBilled*100) / 100
	ledger.TotalPaid = math.Round(totalPaid*100) / 100
	ledger.CurrentBalance = math.Round(runningBalance*100) / 100

	return ledger, nil
}


