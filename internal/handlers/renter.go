package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"rentbill/internal/config"
	"rentbill/internal/database"
	"rentbill/internal/models"
)

func GetRenters(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, name, room_no, aadhar_no, move_in_date, advance_amount, base_rent, eb_unit_price, water_maint, is_active, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi FROM renters WHERE is_active = 1")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var renters = []models.Renter{}
	for rows.Next() {
		var r models.Renter
		rows.Scan(&r.ID, &r.Name, &r.RoomNo, &r.AadharNo, &r.MoveInDate, &r.AdvanceAmount, &r.BaseRent, &r.EBUnitPrice, &r.WaterMaint, &r.IsActive, &r.MobileNumber, &r.Email, &r.InitialEB, &r.PermanentAddr, &r.EmergencyContact, &r.Occupation, &r.AssignedUPI)
		renters = append(renters, r)
	}
	if renters == nil {
		renters = []models.Renter{}
	}
	c.JSON(http.StatusOK, renters)
}

func GetRenter(c *gin.Context) {
	var r models.Renter
	err := database.DB.QueryRow("SELECT id, name, room_no, aadhar_no, move_in_date, advance_amount, base_rent, eb_unit_price, water_maint, is_active, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi FROM renters WHERE id = ?", c.Param("id")).Scan(&r.ID, &r.Name, &r.RoomNo, &r.AadharNo, &r.MoveInDate, &r.AdvanceAmount, &r.BaseRent, &r.EBUnitPrice, &r.WaterMaint, &r.IsActive, &r.MobileNumber, &r.Email, &r.InitialEB, &r.PermanentAddr, &r.EmergencyContact, &r.Occupation, &r.AssignedUPI)
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
	res, err := database.DB.Exec(`INSERT INTO renters (name, room_no, aadhar_no, base_rent, eb_unit_price, water_maint, advance_amount, move_in_date, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, r.Name, r.RoomNo, r.AadharNo, r.BaseRent, r.EBUnitPrice, r.WaterMaint, r.AdvanceAmount, r.MoveInDate, r.MobileNumber, r.Email, r.InitialEB, r.PermanentAddr, r.EmergencyContact, r.Occupation, r.AssignedUPI)
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
	_, err := database.DB.Exec(`UPDATE renters SET name=?, room_no=?, aadhar_no=?, base_rent=?, eb_unit_price=?, water_maint=?, advance_amount=?, move_in_date=?, mobile_number=?, email=?, initial_eb=?, perm_address=?, emergency_contact=?, occupation=?, assigned_upi=? WHERE id=?`, r.Name, r.RoomNo, r.AadharNo, r.BaseRent, r.EBUnitPrice, r.WaterMaint, r.AdvanceAmount, r.MoveInDate, r.MobileNumber, r.Email, r.InitialEB, r.PermanentAddr, r.EmergencyContact, r.Occupation, r.AssignedUPI, c.Param("id"))
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
	rows, err := database.DB.Query("SELECT id, name, room_no, aadhar_no, move_in_date, advance_amount, base_rent, eb_unit_price, water_maint, is_active, mobile_number, email, initial_eb, perm_address, emergency_contact, occupation, assigned_upi FROM renters WHERE is_active = 0")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var renters = []models.Renter{}
	for rows.Next() {
		var r models.Renter
		rows.Scan(&r.ID, &r.Name, &r.RoomNo, &r.AadharNo, &r.MoveInDate, &r.AdvanceAmount, &r.BaseRent, &r.EBUnitPrice, &r.WaterMaint, &r.IsActive, &r.MobileNumber, &r.Email, &r.InitialEB, &r.PermanentAddr, &r.EmergencyContact, &r.Occupation, &r.AssignedUPI)
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
