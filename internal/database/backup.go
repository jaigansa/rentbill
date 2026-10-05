package database

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"time"
)

type BackupData struct {
	Version      string            `json:"version"`
	ExportedAt   string            `json:"exported_at"`
	Properties   []Property        `json:"properties"`
	Tenants      []Tenant          `json:"tenants"`
	Bills        []Bill            `json:"bills"`
	Payments     []Payment         `json:"payments"`
	Expenses     []Expense         `json:"expenses"`
	AppSettings  map[string]string `json:"app_settings"`
}

func (db *DB) GetAllExpenses() ([]Expense, error) {
	query := `
	SELECT e.id, e.property_id, p.name, e.title, e.category, e.amount, e.expense_date,
	       COALESCE(e.paid_to, ''), COALESCE(e.payment_method, 'Cash'), COALESCE(e.notes, ''), e.created_at
	FROM expenses e
	JOIN properties p ON e.property_id = p.id
	ORDER BY e.expense_date DESC, e.id DESC
	`
	rows, err := db.Query(query)
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

func (db *DB) ExportBackup() (*BackupData, error) {
	props, err := db.GetAllProperties()
	if err != nil {
		return nil, fmt.Errorf("failed exporting properties: %w", err)
	}

	tenants, err := db.GetAllTenants()
	if err != nil {
		return nil, fmt.Errorf("failed exporting tenants: %w", err)
	}

	bills, err := db.GetAllBills()
	if err != nil {
		return nil, fmt.Errorf("failed exporting bills: %w", err)
	}

	payments, err := db.GetAllPayments()
	if err != nil {
		return nil, fmt.Errorf("failed exporting payments: %w", err)
	}

	expenses, err := db.GetAllExpenses()
	if err != nil {
		return nil, fmt.Errorf("failed exporting expenses: %w", err)
	}

	settings := make(map[string]string)
	sRows, err := db.Query("SELECT key, value FROM app_settings")
	if err == nil {
		for sRows.Next() {
			var k, v string
			if err := sRows.Scan(&k, &v); err == nil {
				settings[k] = v
			}
		}
		sRows.Close()
	}

	return &BackupData{
		Version:     "1.0",
		ExportedAt:  time.Now().Format("2006-01-02 15:04:05"),
		Properties:  props,
		Tenants:     tenants,
		Bills:       bills,
		Payments:    payments,
		Expenses:    expenses,
		AppSettings: settings,
	}, nil
}

func (db *DB) RestoreBackup(data *BackupData) error {
	if data == nil {
		return fmt.Errorf("backup data is empty")
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Clear existing data cleanly
	tables := []string{"payments", "expenses", "bills", "tenants", "properties", "app_settings"}
	for _, t := range tables {
		if _, err := tx.Exec("DELETE FROM " + t); err != nil {
			return fmt.Errorf("failed clearing table %s: %w", t, err)
		}
	}

	// 1. Restore Properties
	for _, p := range data.Properties {
		wType := p.WaterBillingType
		if wType == "" {
			wType = "FIXED"
		}
		_, err := tx.Exec(`
			INSERT INTO properties (id, name, address, unit_type, default_rent, electricity_rate, water_billing_type, water_charge, water_rate, maintenance_charge, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, p.ID, p.Name, p.Address, p.UnitType, p.DefaultRent, p.ElectricityRate, wType, p.WaterCharge, p.WaterRate, p.MaintenanceCharge, p.CreatedAt)
		if err != nil {
			return fmt.Errorf("failed restoring property %s: %w", p.Name, err)
		}
	}

	// 2. Restore Tenants
	for _, t := range data.Tenants {
		activeInt := 0
		if t.IsActive {
			activeInt = 1
		}
		ch := t.PreferredChannel
		if ch == "" {
			ch = "SMS_RCS"
		}
		coBytes, _ := json.Marshal(t.CoOccupants)
		coJSON := string(coBytes)
		if coJSON == "" || coJSON == "null" {
			coJSON = "[]"
		}
		_, err := tx.Exec(`
			INSERT INTO tenants (id, name, phone, email, property_id, security_deposit, opening_arrear, move_in_date, payment_upi, payment_bank_name, payment_account_no, payment_ifsc, initial_elec_meter, initial_water_meter, preferred_channel, co_occupants, co_occupant_name, co_occupant_phone, is_active, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, t.ID, t.Name, t.Phone, t.Email, t.PropertyID, t.SecurityDeposit, t.OpeningArrear, t.MoveInDate, t.PaymentUPI, t.PaymentBankName, t.PaymentAccountNo, t.PaymentIFSC, t.InitialElecMeter, t.InitialWaterMeter, ch, coJSON, t.CoOccupantName, t.CoOccupantPhone, activeInt, t.CreatedAt)
		if err != nil {
			return fmt.Errorf("failed restoring tenant %s: %w", t.Name, err)
		}
	}

	// 3. Restore Bills
	for _, b := range data.Bills {
		wType := b.WaterBillingType
		if wType == "" {
			wType = "FIXED"
		}
		_, err := tx.Exec(`
			INSERT INTO bills (id, bill_number, tenant_id, property_id, billing_month, billing_period_start, billing_period_end, due_date, base_rent, prev_electricity_meter, curr_electricity_meter, electricity_rate, electricity_units, electricity_amount, water_billing_type, prev_water_meter, curr_water_meter, water_rate, water_units, water_amount, maintenance_amount, other_charges, other_charges_desc, discount_amount, discount_reason, previous_balance, total_amount, paid_amount, status, notes, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, b.ID, b.BillNumber, b.TenantID, b.PropertyID, b.BillingMonth, b.BillingPeriodStart, b.BillingPeriodEnd, b.DueDate, b.BaseRent, b.PrevElectricityMeter, b.CurrElectricityMeter, b.ElectricityRate, b.ElectricityUnits, b.ElectricityAmount, wType, b.PrevWaterMeter, b.CurrWaterMeter, b.WaterRate, b.WaterUnits, b.WaterAmount, b.MaintenanceAmount, b.OtherCharges, b.OtherChargesDesc, b.DiscountAmount, b.DiscountReason, b.PreviousBalance, b.TotalAmount, b.PaidAmount, b.Status, b.Notes, b.CreatedAt)
		if err != nil {
			return fmt.Errorf("failed restoring bill %s: %w", b.BillNumber, err)
		}
	}

	// 4. Restore Payments
	for _, py := range data.Payments {
		_, err := tx.Exec(`
			INSERT INTO payments (id, bill_id, amount, payment_date, payment_method, reference_no, notes, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, py.ID, py.BillID, py.Amount, py.PaymentDate, py.PaymentMethod, py.ReferenceNo, py.Notes, py.CreatedAt)
		if err != nil {
			return fmt.Errorf("failed restoring payment ID %d: %w", py.ID, err)
		}
	}

	// 5. Restore Expenses
	for _, ex := range data.Expenses {
		_, err := tx.Exec(`
			INSERT INTO expenses (id, property_id, title, category, amount, expense_date, paid_to, payment_method, notes, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, ex.ID, ex.PropertyID, ex.Title, ex.Category, ex.Amount, ex.ExpenseDate, ex.PaidTo, ex.PaymentMethod, ex.Notes, ex.CreatedAt)
		if err != nil {
			return fmt.Errorf("failed restoring expense %s: %w", ex.Title, err)
		}
	}

	// 6. Restore Settings
	for k, v := range data.AppSettings {
		_, _ = tx.Exec("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", k, v)
	}

	return tx.Commit()
}

// --- CSV Report Exporters ---

func (db *DB) ExportBillsCSV() ([]byte, error) {
	bills, err := db.GetAllBills()
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	// UTF-8 BOM so Excel opens with proper encoding
	buf.WriteString("\xEF\xBB\xBF")
	w := csv.NewWriter(&buf)

	header := []string{
		"Bill Number", "Billing Month", "Due Date", "Property Unit", "Tenant Name", "Phone",
		"Base Rent", "Elec Units", "Elec Rate", "Elec Amount", "Water Mode", "Water Units/Fixed", "Water Amount",
		"Maintenance", "Other Charges", "Other Desc", "Previous Arrears", "Total Bill", "Paid Amount", "Balance Due", "Status", "Notes", "Created At",
	}
	_ = w.Write(header)

	for _, b := range bills {
		row := []string{
			b.BillNumber,
			b.BillingMonth,
			b.DueDate,
			b.PropertyName,
			b.TenantName,
			b.TenantPhone,
			fmt.Sprintf("%.2f", b.BaseRent),
			fmt.Sprintf("%.2f", b.ElectricityUnits),
			fmt.Sprintf("%.2f", b.ElectricityRate),
			fmt.Sprintf("%.2f", b.ElectricityAmount),
			b.WaterBillingType,
			fmt.Sprintf("%.2f", b.WaterUnits),
			fmt.Sprintf("%.2f", b.WaterAmount),
			fmt.Sprintf("%.2f", b.MaintenanceAmount),
			fmt.Sprintf("%.2f", b.OtherCharges),
			b.OtherChargesDesc,
			fmt.Sprintf("%.2f", b.PreviousBalance),
			fmt.Sprintf("%.2f", b.TotalAmount),
			fmt.Sprintf("%.2f", b.PaidAmount),
			fmt.Sprintf("%.2f", b.BalanceAmount),
			b.Status,
			b.Notes,
			b.CreatedAt,
		}
		_ = w.Write(row)
	}
	w.Flush()
	return buf.Bytes(), nil
}

func (db *DB) ExportPaymentsCSV() ([]byte, error) {
	payments, err := db.GetAllPayments()
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF")
	w := csv.NewWriter(&buf)

	header := []string{
		"Payment ID", "Payment Date", "Bill Number", "Tenant Name", "Amount", "Payment Mode", "Reference No", "Notes", "Created At",
	}
	_ = w.Write(header)

	for _, p := range payments {
		row := []string{
			fmt.Sprintf("%d", p.ID),
			p.PaymentDate,
			p.BillNumber,
			p.TenantName,
			fmt.Sprintf("%.2f", p.Amount),
			p.PaymentMethod,
			p.ReferenceNo,
			p.Notes,
			p.CreatedAt,
		}
		_ = w.Write(row)
	}
	w.Flush()
	return buf.Bytes(), nil
}

func (db *DB) ExportExpensesCSV() ([]byte, error) {
	expenses, err := db.GetAllExpenses()
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF")
	w := csv.NewWriter(&buf)

	header := []string{
		"Expense ID", "Expense Date", "Property Unit", "Category", "Title", "Amount", "Payment Mode", "Paid To / Vendor", "Notes", "Created At",
	}
	_ = w.Write(header)

	for _, ex := range expenses {
		row := []string{
			fmt.Sprintf("%d", ex.ID),
			ex.ExpenseDate,
			ex.PropertyName,
			ex.Category,
			ex.Title,
			fmt.Sprintf("%.2f", ex.Amount),
			ex.PaymentMethod,
			ex.PaidTo,
			ex.Notes,
			ex.CreatedAt,
		}
		_ = w.Write(row)
	}
	w.Flush()
	return buf.Bytes(), nil
}

func (db *DB) ExportMetersCSV() ([]byte, error) {
	bills, err := db.GetAllBills()
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF")
	w := csv.NewWriter(&buf)

	header := []string{
		"Bill Number", "Billing Month", "Property Unit", "Tenant Name",
		"Prev Elec Meter", "Curr Elec Meter", "Elec Units Used", "Elec Rate", "Elec Cost",
		"Water Mode", "Prev Water Meter", "Curr Water Meter", "Water Units Used", "Water Rate", "Water Cost",
	}
	_ = w.Write(header)

	for _, b := range bills {
		row := []string{
			b.BillNumber,
			b.BillingMonth,
			b.PropertyName,
			b.TenantName,
			fmt.Sprintf("%.2f", b.PrevElectricityMeter),
			fmt.Sprintf("%.2f", b.CurrElectricityMeter),
			fmt.Sprintf("%.2f", b.ElectricityUnits),
			fmt.Sprintf("%.2f", b.ElectricityRate),
			fmt.Sprintf("%.2f", b.ElectricityAmount),
			b.WaterBillingType,
			fmt.Sprintf("%.2f", b.PrevWaterMeter),
			fmt.Sprintf("%.2f", b.CurrWaterMeter),
			fmt.Sprintf("%.2f", b.WaterUnits),
			fmt.Sprintf("%.2f", b.WaterRate),
			fmt.Sprintf("%.2f", b.WaterAmount),
		}
		_ = w.Write(row)
	}
	w.Flush()
	return buf.Bytes(), nil
}
