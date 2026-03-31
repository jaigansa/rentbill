package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"rentbill/internal/config"
	"rentbill/internal/database"
	"rentbill/internal/models"
)

func GetOwnerWithdrawals(c *gin.Context) {
	limit := c.DefaultQuery("limit", "20")
	offset := c.DefaultQuery("offset", "0")

	query := fmt.Sprintf("SELECT id, owner_name, amount, date, notes, timestamp FROM owner_withdrawals ORDER BY date DESC LIMIT %s OFFSET %s", limit, offset)
	rows, err := database.DB.Query(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()
	var withdrawals []models.OwnerWithdrawal
	for rows.Next() {
		var w models.OwnerWithdrawal
		rows.Scan(&w.ID, &w.OwnerName, &w.Amount, &w.Date, &w.Notes, &w.Timestamp)
		withdrawals = append(withdrawals, w)
	}
	if withdrawals == nil {
		withdrawals = []models.OwnerWithdrawal{}
	}
	c.JSON(http.StatusOK, withdrawals)
}

func CreateOwnerWithdrawal(c *gin.Context) {
	var w models.OwnerWithdrawal
	if err := c.ShouldBindJSON(&w); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input"})
		return
	}
	_, err := database.DB.Exec("INSERT INTO owner_withdrawals (owner_name, amount, date, notes) VALUES (?, ?, ?, ?)", w.OwnerName, w.Amount, w.Date, w.Notes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	database.LogActivity("OWNER_PAYOUT", fmt.Sprintf("Owner %s withdrew %.2f", w.OwnerName, w.Amount), config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func DeleteOwnerWithdrawal(c *gin.Context) {
	database.DB.Exec("DELETE FROM owner_withdrawals WHERE id = ?", c.Param("id"))
	database.LogActivity("OWNER_PAYOUT_DELETED", "Deleted withdrawal record "+c.Param("id"), config.AppConfig.Username)
	c.JSON(http.StatusOK, gin.H{"success": true})
}
