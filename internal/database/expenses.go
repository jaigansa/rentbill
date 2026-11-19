package database

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
