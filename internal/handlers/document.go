package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"rentbill/internal/config"
	"rentbill/internal/database"
	"rentbill/internal/models"
)

func GetDocuments(c *gin.Context) {
	renterID := c.Query("renter_id")

	query := `SELECT d.id, d.renter_id, COALESCE(r.room_no, 'Global') as unit_room, 
			d.file_name, d.file_path, d.file_type, d.upload_date, d.expiry_date, d.notes 
			FROM documents d 
			LEFT JOIN renters r ON d.renter_id = r.id `

	var args []interface{}
	if renterID != "" {
		query += " WHERE d.renter_id = ? "
		args = append(args, renterID)
	}

	query += " ORDER BY d.upload_date DESC"

	rows, err := database.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		return
	}
	defer rows.Close()

	var docs []models.Document
	for rows.Next() {
		var d models.Document
		rows.Scan(&d.ID, &d.RenterID, &d.UnitRoom, &d.FileName, &d.FilePath,
			&d.FileType, &d.UploadDate, &d.ExpiryDate, &d.Notes)
		docs = append(docs, d)
	}
	if docs == nil {
		docs = []models.Document{}
	}
	c.JSON(http.StatusOK, docs)
}

func UploadDocument(c *gin.Context) {
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	renterIDStr := c.PostForm("renter_id")
	fileType := c.PostForm("file_type")
	expiryDate := c.PostForm("expiry_date")
	notes := c.PostForm("notes")

	var renterID *int
	if renterIDStr != "" && renterIDStr != "null" {
		id, _ := strconv.Atoi(renterIDStr)
		renterID = &id
	}

	// Create unique filename
	uniqueName := fmt.Sprintf("%d_%s", time.Now().UnixNano(), file.Filename)
	dst := filepath.Join("./uploads", uniqueName)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	res, err := database.DB.Exec(`INSERT INTO documents 
		(renter_id, file_name, file_path, file_type, expiry_date, notes) 
		VALUES (?, ?, ?, ?, ?, ?)`,
		renterID, file.Filename, "/uploads/"+uniqueName, fileType, expiryDate, notes)

	if err != nil {
		os.Remove(dst) // Cleanup
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save document record"})
		return
	}

	id, _ := res.LastInsertId()
	database.LogActivity("DOCUMENT_UPLOADED", "Uploaded: "+file.Filename, config.AppConfig.Username, 0)
	c.JSON(http.StatusOK, gin.H{"success": true, "id": id, "path": "/uploads/" + uniqueName})
}

func DeleteDocument(c *gin.Context) {
	var filePath string
	err := database.DB.QueryRow("SELECT file_path FROM documents WHERE id = ?", c.Param("id")).Scan(&filePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Document not found"})
		return
	}

	// Remove physical file
	os.Remove("." + filePath)

	database.DB.Exec("DELETE FROM documents WHERE id = ?", c.Param("id"))
	database.LogActivity("DOCUMENT_DELETED", "Deleted document ID: "+c.Param("id"), config.AppConfig.Username, 0)
	c.JSON(http.StatusOK, gin.H{"success": true})
}
