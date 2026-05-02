package handlers

import (
	"encoding/csv"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"rentbill/internal/config"
	"rentbill/internal/database"
	"rentbill/internal/models"
)

func GetRenters(c *gin.Context) {
	limit := c.DefaultQuery("limit", "100")
	offset := c.DefaultQuery("offset", "0")

	rows, err := database.DB.Query("SELECT id, name, room_no, aadhar_no, move_in_date, advance_amount, base_rent, eb_unit_price, water_maint, is_active, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears FROM renters WHERE is_active = 1 ORDER BY room_no ASC LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var renters = []models.Renter{}
	for rows.Next() {
		var r models.Renter
		rows.Scan(&r.ID, &r.Name, &r.RoomNo, &r.AadharNo, &r.MoveInDate, &r.AdvanceAmount, &r.BaseRent, &r.EBUnitPrice, &r.WaterMaint, &r.IsActive, &r.MobileNumber, &r.Email, &r.InitialEB, &r.PermanentAddr, &r.EmergencyContact, &r.Occupation, &r.AssignedUPI, &r.PendingArrears)
		renters = append(renters, r)
	}
	if renters == nil {
		renters = []models.Renter{}
	}
	c.JSON(http.StatusOK, renters)
}

func GetRenter(c *gin.Context) {
	var r models.Renter
	err := database.DB.QueryRow("SELECT id, name, room_no, aadhar_no, move_in_date, advance_amount, base_rent, eb_unit_price, water_maint, is_active, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears FROM renters WHERE id = ?", c.Param("id")).Scan(&r.ID, &r.Name, &r.RoomNo, &r.AadharNo, &r.MoveInDate, &r.AdvanceAmount, &r.BaseRent, &r.EBUnitPrice, &r.WaterMaint, &r.IsActive, &r.MobileNumber, &r.Email, &r.InitialEB, &r.PermanentAddr, &r.EmergencyContact, &r.Occupation, &r.AssignedUPI, &r.PendingArrears)
	if err == nil {
		c.JSON(http.StatusOK, r)
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	}
}

func CreateRenter(c *gin.Context) {
	var r models.Renter
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	res, err := database.DB.Exec(`INSERT INTO renters (name, room_no, aadhar_no, base_rent, eb_unit_price, water_maint, advance_amount, move_in_date, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, r.Name, r.RoomNo, r.AadharNo, r.BaseRent, r.EBUnitPrice, r.WaterMaint, r.AdvanceAmount, r.MoveInDate, r.MobileNumber, r.Email, r.InitialEB, r.PermanentAddr, r.EmergencyContact, r.Occupation, r.AssignedUPI, r.PendingArrears)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	id, _ := res.LastInsertId()
	database.LogActivity("TENANT_REGISTERED", fmt.Sprintf("Registered %s for Unit %s", r.Name, r.RoomNo), config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"id": id})
}

func UpdateRenter(c *gin.Context) {
	var r models.Renter
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	_, err := database.DB.Exec(`UPDATE renters SET name=?, room_no=?, aadhar_no=?, base_rent=?, eb_unit_price=?, water_maint=?, advance_amount=?, move_in_date=?, mobile_number=?, email=?, initial_eb=?, perm_address=?, emergency_contact=?, occupation=?, assigned_upi=?, pending_arrears=? WHERE id=?`, r.Name, r.RoomNo, r.AadharNo, r.BaseRent, r.EBUnitPrice, r.WaterMaint, r.AdvanceAmount, r.MoveInDate, r.MobileNumber, r.Email, r.InitialEB, r.PermanentAddr, r.EmergencyContact, r.Occupation, r.AssignedUPI, r.PendingArrears, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	database.LogActivity("TENANT_UPDATED", fmt.Sprintf("Updated %s", r.Name), config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func MarkVacant(c *gin.Context) {
	var body struct {
		ID int `json:"id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	database.DB.Exec("UPDATE renters SET is_active = 0 WHERE id = ?", body.ID)
	database.LogActivity("UNIT_VACATED", "Unit vacated", config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func RestoreRenter(c *gin.Context) {
	var body struct {
		ID int `json:"id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	database.DB.Exec("UPDATE renters SET is_active = 1 WHERE id = ?", body.ID)
	database.LogActivity("TENANT_RESTORED", "Tenant restored", config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func GetRenterHistory(c *gin.Context) {
	limit := c.DefaultQuery("limit", "100")
	offset := c.DefaultQuery("offset", "0")

	rows, err := database.DB.Query("SELECT id, name, room_no, aadhar_no, move_in_date, advance_amount, base_rent, eb_unit_price, water_maint, is_active, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears FROM renters WHERE is_active = 0 ORDER BY move_in_date DESC LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var renters = []models.Renter{}
	for rows.Next() {
		var r models.Renter
		rows.Scan(&r.ID, &r.Name, &r.RoomNo, &r.AadharNo, &r.MoveInDate, &r.AdvanceAmount, &r.BaseRent, &r.EBUnitPrice, &r.WaterMaint, &r.IsActive, &r.MobileNumber, &r.Email, &r.InitialEB, &r.PermanentAddr, &r.EmergencyContact, &r.Occupation, &r.AssignedUPI, &r.PendingArrears)
		renters = append(renters, r)
	}
	if renters == nil {
		renters = []models.Renter{}
	}
	c.JSON(http.StatusOK, renters)
}

func DeleteRenter(c *gin.Context) {
	database.DB.Exec("UPDATE renters SET is_active = -1 WHERE id = ?", c.Param("id"))
	database.LogActivity("TENANT_REMOVED", "Tenant removed (Soft Delete) "+c.Param("id"), config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func ExportRentersCSV(c *gin.Context) {
	rows, err := database.DB.Query("SELECT name, room_no, mobile_number, email, aadhar_no, base_rent, water_maint, advance_amount, move_in_date, occupation, assigned_upi FROM renters WHERE is_active = 1 ORDER BY room_no ASC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=unit_directory.csv")

	fmt.Fprintln(c.Writer, "Name,Unit,Mobile,Email,Aadhar,Base Rent,Water/Maint,Advance,Move-in Date,Occupation,Assigned Owner")

	for rows.Next() {
		var r struct {
			Name, Room, Mobile, Email, Aadhar, MoveIn, Job, UPI string
			Rent, Water, Advance                                float64
		}
		rows.Scan(&r.Name, &r.Room, &r.Mobile, &r.Email, &r.Aadhar, &r.Rent, &r.Water, &r.Advance, &r.MoveIn, &r.Job, &r.UPI)

		fmt.Fprintf(c.Writer, "\"%s\",\"%s\",\"%s\",\"%s\",\"%s\",%.2f,%.2f,%.2f,\"%s\",\"%s\",\"%s\"\n",
			r.Name, r.Room, r.Mobile, r.Email, r.Aadhar, r.Rent, r.Water, r.Advance, r.MoveIn, r.Job, r.UPI)
	}

	database.LogActivity("DATA_EXPORT", "Exported Unit Directory to CSV", config.AppConfig.Username)
}

func ImportRentersCSV(c *gin.Context) {
	file, err := c.FormFile("csv_file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	f, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to open file"})
		return
	}
	defer f.Close()

	reader := csv.NewReader(f)
	// Skip header
	if _, err := reader.Read(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Empty or invalid CSV"})
		return
	}

	count := 0
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			continue // Skip malformed rows
		}

		// Expected columns: Name,Unit,Mobile,Email,Aadhar,Base Rent,Water/Maint,Advance,Move-in Date,Occupation,Assigned Owner
		if len(record) < 11 {
			continue
		}

		name := record[0]
		room := record[1]
		mobile := record[2]
		email := record[3]
		aadhar := record[4]
		rent, _ := strconv.ParseFloat(record[5], 64)
		water, _ := strconv.ParseFloat(record[6], 64)
		advance, _ := strconv.ParseFloat(record[7], 64)
		moveIn := record[8]
		job := record[9]
		upi := record[10]

		if name == "" || room == "" {
			continue
		}

		_, err = database.DB.Exec(`INSERT INTO renters (name, room_no, aadhar_no, base_rent, eb_unit_price, water_maint, advance_amount, move_in_date, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi, pending_arrears) 
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, 
			name, room, aadhar, rent, 9.0, water, advance, moveIn, mobile, email, 0, "", "", job, upi, 0)
		
		if err == nil {
			count++
		}
	}

	database.LogActivity("DATA_IMPORT", fmt.Sprintf("Imported %d units from CSV", count), config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true, "message": fmt.Sprintf("Successfully imported %d records", count)})
}
