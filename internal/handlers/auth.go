package handlers

import (
	"crypto/rand"
	"fmt"
	"net/http"
	"net/smtp"
	"strings"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"rentbill/internal/config"
	"rentbill/internal/database"
)

func VerifyPin(c *gin.Context) {
	var req struct {
		Pin string `json:"pin"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN required"})
		return
	}

	role := ""
	if config.CheckPasswordHash(req.Pin, config.AppConfig.MasterPinHash) {
		role = "owner"
	} else if config.CheckPasswordHash(req.Pin, config.AppConfig.StaffPinHash) {
		role = "staff"
	}

	if role != "" {
		session := sessions.Default(c)
		session.Set("user", config.AppConfig.Username)
		session.Set("role", role)
		if err := session.Save(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to establish session"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"success": true, "role": role})
	} else {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid PIN"})
	}
}

func ForgotPin(c *gin.Context) {
	if config.AppConfig.EmailUser == "" || config.AppConfig.EmailPass == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "SMTP credentials not configured"})
		return
	}
	var b [2]byte
	if _, err := rand.Read(b[:]); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate PIN"})
		return
	}
	tempPin := fmt.Sprintf("%04d", (uint32(b[0])<<8|uint32(b[1]))%10000)

	auth := smtp.PlainAuth("", config.AppConfig.EmailUser, config.AppConfig.EmailPass, "smtp.gmail.com")
	htmlMsg := fmt.Sprintf("<h1>PIN Recovery</h1><p>Temporary PIN: <b>%s</b></p>", tempPin)
	header := fmt.Sprintf("Subject: RentBill - PIN Recovery\r\nTo: %s\r\nMIME-version: 1.0;\r\nContent-Type: text/html; charset=\"UTF-8\";\r\n\r\n", config.AppConfig.EmailUser)
	msg := []byte(header + htmlMsg)

	recipients := []string{config.AppConfig.EmailUser}
	if config.AppConfig.EmailBCC != "" {
		splitFn := func(c rune) bool { return c == ',' || c == ';' || c == ' ' }
		bccList := strings.FieldsFunc(config.AppConfig.EmailBCC, splitFn)
		for _, bcc := range bccList {
			if bcc != "" {
				recipients = append(recipients, bcc)
			}
		}
	}
	err := smtp.SendMail("smtp.gmail.com:587", auth, config.AppConfig.EmailUser, recipients, msg)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send email"})
		return
	}

	hash, _ := config.HashPassword(tempPin)
	config.AppConfig.MasterPinHash = hash
	database.DB.Exec("UPDATE users SET pin_hash = ? WHERE username = ?", hash, config.AppConfig.Username)
	config.SaveConfig()

	database.LogActivity("FORGOT_PIN", "Reset PIN sent to "+config.AppConfig.EmailUser, config.AppConfig.Username, 0)
	c.JSON(http.StatusOK, gin.H{"success": true})
}

func CheckPin(c *gin.Context) {
	var req struct {
		Pin string `json:"pin"`
	}
	if err := c.ShouldBindJSON(&req); err == nil {
		if config.CheckPasswordHash(req.Pin, config.AppConfig.MasterPinHash) {
			c.JSON(http.StatusOK, gin.H{"success": true})
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid PIN"})
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "PIN required"})
	}
}

func Logout(c *gin.Context) {
	session := sessions.Default(c)
	session.Clear()
	session.Options(sessions.Options{MaxAge: -1})
	session.Save()
	c.JSON(http.StatusOK, gin.H{"success": true})
}
