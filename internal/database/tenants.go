package database

import (
	"encoding/json"
	"fmt"
	"math"
	"time"
)

func (db *DB) CreateTenant(t *Tenant) (int64, error) {
	if t.PreferredChannel == "" {
		t.PreferredChannel = "SMS_RCS"
	}
	if len(t.CoOccupants) > 0 {
		if t.CoOccupantName == "" {
			t.CoOccupantName = t.CoOccupants[0].Name
		}
		if t.CoOccupantPhone == "" {
			t.CoOccupantPhone = t.CoOccupants[0].Phone
		}
	} else if t.CoOccupantName != "" || t.CoOccupantPhone != "" {
		t.CoOccupants = []CoOccupant{{Name: t.CoOccupantName, Phone: t.CoOccupantPhone}}
	}
	coBytes, _ := json.Marshal(t.CoOccupants)
	coJSON := string(coBytes)
	if coJSON == "" || coJSON == "null" {
		coJSON = "[]"
	}

	query := `
	INSERT INTO tenants (
		name, phone, email, property_id, security_deposit, opening_arrear, move_in_date,
		payment_upi, payment_bank_name, payment_account_no, payment_ifsc,
		initial_elec_meter, initial_water_meter, preferred_channel,
		co_occupants, co_occupant_name, co_occupant_phone, is_active, photo
	)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	res, err := db.Exec(query,
		t.Name, t.Phone, t.Email, t.PropertyID, t.SecurityDeposit, t.OpeningArrear, t.MoveInDate,
		t.PaymentUPI, t.PaymentBankName, t.PaymentAccountNo, t.PaymentIFSC,
		t.InitialElecMeter, t.InitialWaterMeter, t.PreferredChannel,
		coJSON, t.CoOccupantName, t.CoOccupantPhone, 1, t.Photo,
	)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

func (db *DB) GetAllTenants() ([]Tenant, error) {
	query := `
	SELECT t.id, t.name, t.phone, COALESCE(t.email, ''), t.property_id, COALESCE(p.name, ''),
	       t.security_deposit, COALESCE(t.opening_arrear, 0.0), COALESCE(t.move_in_date, ''),
	       COALESCE(t.payment_upi, ''), COALESCE(t.payment_bank_name, ''),
	       COALESCE(t.payment_account_no, ''), COALESCE(t.payment_ifsc, ''),
	       COALESCE(t.initial_elec_meter, 0.0), COALESCE(t.initial_water_meter, 0.0),
	       COALESCE(t.preferred_channel, 'SMS_RCS'),
	       COALESCE(t.co_occupants, '[]'), COALESCE(t.co_occupant_name, ''), COALESCE(t.co_occupant_phone, ''),
	       t.is_active, COALESCE(t.photo, ''), t.created_at,
	       COALESCE(b_stats.total_paid, 0.0) AS total_paid,
	       COALESCE(b_stats.total_due, t.opening_arrear, 0.0) AS total_due
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
		var coJSON string
		err := rows.Scan(
			&t.ID, &t.Name, &t.Phone, &t.Email, &t.PropertyID, &t.PropertyName,
			&t.SecurityDeposit, &t.OpeningArrear, &t.MoveInDate,
			&t.PaymentUPI, &t.PaymentBankName, &t.PaymentAccountNo, &t.PaymentIFSC,
			&t.InitialElecMeter, &t.InitialWaterMeter,
			&t.PreferredChannel,
			&coJSON, &t.CoOccupantName, &t.CoOccupantPhone,
			&isActiveInt, &t.Photo, &t.CreatedAt,
			&t.TotalPaid, &t.TotalDue,
		)
		if err != nil {
			return nil, err
		}
		t.CoOccupants = []CoOccupant{}
		if coJSON != "" && coJSON != "[]" {
			_ = json.Unmarshal([]byte(coJSON), &t.CoOccupants)
		}
		if len(t.CoOccupants) == 0 && (t.CoOccupantName != "" || t.CoOccupantPhone != "") {
			t.CoOccupants = []CoOccupant{{Name: t.CoOccupantName, Phone: t.CoOccupantPhone}}
		}
		t.IsActive = (isActiveInt == 1)
		tenants = append(tenants, t)
	}
	return tenants, nil
}

func (db *DB) GetTenantByID(id int64) (*Tenant, error) {
	query := `
	SELECT t.id, t.name, t.phone, COALESCE(t.email, ''), t.property_id, COALESCE(p.name, ''),
	       t.security_deposit, COALESCE(t.opening_arrear, 0.0), COALESCE(t.move_in_date, ''),
	       COALESCE(t.payment_upi, ''), COALESCE(t.payment_bank_name, ''),
	       COALESCE(t.payment_account_no, ''), COALESCE(t.payment_ifsc, ''),
	       COALESCE(t.initial_elec_meter, 0.0), COALESCE(t.initial_water_meter, 0.0),
	       COALESCE(t.preferred_channel, 'SMS_RCS'),
	       COALESCE(t.co_occupants, '[]'), COALESCE(t.co_occupant_name, ''), COALESCE(t.co_occupant_phone, ''),
	       t.is_active, COALESCE(t.photo, ''), t.created_at,
	       COALESCE(b_stats.total_paid, 0.0) AS total_paid,
	       COALESCE(b_stats.total_due, t.opening_arrear, 0.0) AS total_due
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
	var coJSON string
	err := db.QueryRow(query, id, id).Scan(
		&t.ID, &t.Name, &t.Phone, &t.Email, &t.PropertyID, &t.PropertyName,
		&t.SecurityDeposit, &t.OpeningArrear, &t.MoveInDate,
		&t.PaymentUPI, &t.PaymentBankName, &t.PaymentAccountNo, &t.PaymentIFSC,
		&t.InitialElecMeter, &t.InitialWaterMeter,
		&t.PreferredChannel,
		&coJSON, &t.CoOccupantName, &t.CoOccupantPhone,
		&isActiveInt, &t.Photo, &t.CreatedAt,
		&t.TotalPaid, &t.TotalDue,
	)
	if err != nil {
		return nil, err
	}
	t.CoOccupants = []CoOccupant{}
	if coJSON != "" && coJSON != "[]" {
		_ = json.Unmarshal([]byte(coJSON), &t.CoOccupants)
	}
	if len(t.CoOccupants) == 0 && (t.CoOccupantName != "" || t.CoOccupantPhone != "") {
		t.CoOccupants = []CoOccupant{{Name: t.CoOccupantName, Phone: t.CoOccupantPhone}}
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
	if len(t.CoOccupants) > 0 {
		if t.CoOccupantName == "" {
			t.CoOccupantName = t.CoOccupants[0].Name
		}
		if t.CoOccupantPhone == "" {
			t.CoOccupantPhone = t.CoOccupants[0].Phone
		}
	} else if t.CoOccupantName != "" || t.CoOccupantPhone != "" {
		t.CoOccupants = []CoOccupant{{Name: t.CoOccupantName, Phone: t.CoOccupantPhone}}
	}
	coBytes, _ := json.Marshal(t.CoOccupants)
	coJSON := string(coBytes)
	if coJSON == "" || coJSON == "null" {
		coJSON = "[]"
	}

	query := `
	UPDATE tenants
	SET name = ?, phone = ?, email = ?, property_id = ?, security_deposit = ?, opening_arrear = ?, move_in_date = ?,
	    payment_upi = ?, payment_bank_name = ?, payment_account_no = ?, payment_ifsc = ?,
	    initial_elec_meter = ?, initial_water_meter = ?, preferred_channel = ?,
	    co_occupants = ?, co_occupant_name = ?, co_occupant_phone = ?, is_active = ?, photo = ?
	WHERE id = ?
	`
	_, err := db.Exec(query,
		t.Name, t.Phone, t.Email, t.PropertyID, t.SecurityDeposit, t.OpeningArrear, t.MoveInDate,
		t.PaymentUPI, t.PaymentBankName, t.PaymentAccountNo, t.PaymentIFSC,
		t.InitialElecMeter, t.InitialWaterMeter, t.PreferredChannel,
		coJSON, t.CoOccupantName, t.CoOccupantPhone, activeInt, t.Photo, t.ID,
	)
	return err
}

func (db *DB) DeleteTenant(id int64) error {
	_, err := db.Exec("DELETE FROM tenants WHERE id = ?", id)
	return err
}

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
			order:  b.ID * 2,
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
				Description:    fmt.Sprintf("Rent Bill - %s (%s)", formatBillingMonth(b.BillingMonth), b.BillNumber),
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

	if len(bills) == 0 && tenant.OpeningArrear > 0 {
		ledger.Entries = append(ledger.Entries, LedgerEntry{
			ID:             0,
			Type:           "BILL",
			Date:           tenant.MoveInDate,
			BillID:         0,
			BillNumber:     "OPENING",
			BillingMonth:   "-",
			Description:    "Opening Arrear / Starting Due",
			Debit:          tenant.OpeningArrear,
			Credit:         0,
			RunningBalance: tenant.OpeningArrear,
			Status:         "PENDING",
		})
		totalBilled = tenant.OpeningArrear
		runningBalance = tenant.OpeningArrear
	}

	ledger.TotalBilled = math.Round(totalBilled*100) / 100
	ledger.TotalPaid = math.Round(totalPaid*100) / 100
	ledger.CurrentBalance = math.Round(runningBalance*100) / 100

	return ledger, nil
}

func formatBillingMonth(month string) string {
	if len(month) == 7 && month[4] == '-' {
		if t, err := time.Parse("2006-01", month); err == nil {
			return t.Format("January 2006")
		}
	}
	return month
}
