package database

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
