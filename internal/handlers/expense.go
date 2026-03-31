package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"rentbill/internal/config"
	"rentbill/internal/database"
	"rentbill/internal/models"
)

func GetExpenses(c *gin.Context) {
	rows, err := database.DB.Query("SELECT id, category, amount, date, notes, timestamp FROM expenses ORDER BY date DESC")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var expenses = []models.Expense{}
	for rows.Next() {
		var e models.Expense
		rows.Scan(&e.ID, &e.Category, &e.Amount, &e.Date, &e.Notes, &e.Timestamp)
		expenses = append(expenses, e)
	}
	if expenses == nil {
		expenses = []models.Expense{}
	}
	c.JSON(http.StatusOK, expenses)
}

func CreateExpense(c *gin.Context) {
	var e models.Expense
	if err := c.ShouldBindJSON(&e); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	res, err := database.DB.Exec("INSERT INTO expenses (category, amount, date, notes) VALUES (?,?,?,?)", e.Category, e.Amount, e.Date, e.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add expense"})
		return
	}
	id, _ := res.LastInsertId()
	database.LogActivity("EXPENSE_ADDED", fmt.Sprintf("Recorded %.2f for %s", e.Amount, e.Category), config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"id": id})
}

func DeleteExpense(c *gin.Context) {
	database.DB.Exec("DELETE FROM expenses WHERE id = ?", c.Param("id"))
	database.LogActivity("EXPENSE_DELETED", "Deleted expense record "+c.Param("id"), config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true})
}
