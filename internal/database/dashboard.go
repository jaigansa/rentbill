package database

import (
	"database/sql"
	"math"
	"strings"
	"time"
)

func (db *DB) GetDashboardSummary(month string) (*DashboardSummary, error) {
	var summary DashboardSummary
	summary.ActionRequired.OverdueBills = []Bill{}
	summary.ActionRequired.UnbilledTenants = []Tenant{}
	summary.AvailableMonths = []string{}

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

	// 1. Total Property count
	_ = db.QueryRow("SELECT COUNT(*) FROM properties").Scan(&summary.TotalProperties)

	// 2. Financial Aggregation (Filtered by month unless "ALL")
	var query string
	var args []interface{}

	if strings.ToUpper(summary.SelectedMonth) == "ALL" {
		query = `
		SELECT 
			COALESCE(SUM(total_amount), 0),
			COALESCE(SUM(paid_amount), 0),
			COALESCE(SUM(CASE WHEN status != 'PAID' THEN (total_amount - paid_amount) ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'OVERDUE' OR (status != 'PAID' AND due_date < date('now')) THEN (total_amount - paid_amount) ELSE 0 END), 0)
		FROM bills
		`
	} else {
		query = `
		SELECT 
			COALESCE(SUM(total_amount), 0),
			COALESCE(SUM(paid_amount), 0),
			COALESCE(SUM(CASE WHEN status != 'PAID' THEN (total_amount - paid_amount) ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN status = 'OVERDUE' OR (status != 'PAID' AND due_date < date('now')) THEN (total_amount - paid_amount) ELSE 0 END), 0)
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
	)
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	// Calculate collection rate percentage
	if summary.TotalBilled > 0 {
		summary.CollectionRate = math.Round((summary.TotalCollected/summary.TotalBilled)*1000) / 10
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
