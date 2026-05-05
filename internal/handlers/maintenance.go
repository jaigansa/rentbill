package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"rentbill/internal/config"
	"rentbill/internal/database"
	"rentbill/internal/models"
)

func GetMaintenanceTasks(c *gin.Context) {
	limit := c.DefaultQuery("limit", "20")
	offset := c.DefaultQuery("offset", "0")
	status := c.Query("status") // Optional filter

	query := `SELECT t.id, t.renter_id, COALESCE(r.room_no, 'COMMON') as unit_room, t.title, t.description, 
			t.category, t.priority, t.status, t.owner_name, t.estimated_cost, t.actual_cost, 
			t.date_reported, t.date_resolved, t.timestamp 
			FROM maintenance_tasks t 
			LEFT JOIN renters r ON t.renter_id = r.id `
	
	var args []interface{}
	if status != "" && status != "ALL" {
		query += " WHERE t.status = ? "
		args = append(args, status)
	}
	
	query += " ORDER BY t.priority DESC, t.timestamp DESC LIMIT ? OFFSET ?"
	args = append(args, limit, offset)

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var tasks []models.MaintenanceTask
	for rows.Next() {
		var t models.MaintenanceTask
		rows.Scan(&t.ID, &t.RenterID, &t.UnitRoom, &t.Title, &t.Description, 
			&t.Category, &t.Priority, &t.Status, &t.OwnerName, &t.EstimatedCost, &t.ActualCost, 
			&t.DateReported, &t.DateResolved, &t.Timestamp)
		tasks = append(tasks, t)
	}
	if tasks == nil { tasks = []models.MaintenanceTask{} }
	c.JSON(http.StatusOK, tasks)
}

func CreateMaintenanceTask(c *gin.Context) {
	var t models.MaintenanceTask
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	res, err := database.DB.Exec(`INSERT INTO maintenance_tasks 
		(renter_id, title, description, category, priority, status, owner_name, estimated_cost, date_reported) 
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		t.RenterID, t.Title, t.Description, t.Category, t.Priority, t.Status, t.OwnerName, t.EstimatedCost, t.DateReported)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create task"})
		return
	}

	id, _ := res.LastInsertId()
	database.LogActivity("MAINTENANCE_TASK_CREATED", "New Task: "+t.Title, config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true, "id": id})
}

func UpdateMaintenanceTask(c *gin.Context) {
	var t models.MaintenanceTask
	if err := c.ShouldBindJSON(&t); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}

	_, err := database.DB.Exec(`UPDATE maintenance_tasks 
		SET title=?, description=?, category=?, priority=?, status=?, owner_name=?, 
		estimated_cost=?, actual_cost=?, date_resolved=? 
		WHERE id = ?`,
		t.Title, t.Description, t.Category, t.Priority, t.Status, t.OwnerName, 
		t.EstimatedCost, t.ActualCost, t.DateResolved, c.Param("id"))
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update task"})
		return
	}

	// If resolved and has actual cost, we might want to log it specifically
	if t.Status == "Resolved" && t.ActualCost > 0 {
		database.LogActivity("MAINTENANCE_TASK_RESOLVED", fmt.Sprintf("Resolved: %s (Cost: %.2f)", t.Title, t.ActualCost), config.AppConfig.Username)
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteMaintenanceTask(c *gin.Context) {
	database.DB.Exec("DELETE FROM maintenance_tasks WHERE id = ?", c.Param("id"))
	database.LogActivity("MAINTENANCE_TASK_DELETED", "Deleted task ID: "+c.Param("id"), config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func ConvertTaskToExpense(c *gin.Context) {
	// Fetch task details first
	var t models.MaintenanceTask
	err := database.DB.QueryRow(`SELECT title, category, actual_cost, owner_name, date_resolved 
		FROM maintenance_tasks WHERE id = ?`, c.Param("id")).Scan(
		&t.Title, &t.Category, &t.ActualCost, &t.OwnerName, &t.DateResolved)
	
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Task not found"})
		return
	}

	if t.ActualCost <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Task must have an actual cost to convert"})
		return
	}

	date := ""
	if t.DateResolved != nil {
		date = *t.DateResolved
	}

	// Insert into expenses
	_, err = database.DB.Exec("INSERT INTO expenses (category, amount, date, notes, owner_name) VALUES (?, ?, ?, ?, ?)",
		t.Category, t.ActualCost, date, "Task: "+t.Title, t.OwnerName)
	
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create expense"})
		return
	}

	database.LogActivity("EXPENSE_RECORDED", "Converted Task to Expense: "+t.Title, config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true})
}
