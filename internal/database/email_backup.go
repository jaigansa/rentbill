package database

import (
	"bytes"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"strconv"
	"strings"
	"time"
)

type EmailBackupConfig struct {
	Host       string `json:"smtp_host"`
	Port       string `json:"smtp_port"`
	User       string `json:"smtp_user"`
	Pass       string `json:"smtp_pass"`
	To         string `json:"smtp_to"`
	Enabled    bool   `json:"auto_backup_enabled"`
	Interval   string `json:"auto_backup_interval"` // "daily" or "weekly"
	LastSent   string `json:"last_backup_email_time"`
	LastStatus string `json:"last_backup_email_status"`
}

func (db *DB) GetEmailBackupConfig() EmailBackupConfig {
	port := db.GetSetting("smtp_port")
	if port == "" {
		port = "587"
	}
	interval := db.GetSetting("auto_backup_interval")
	if interval == "" {
		interval = "daily"
	}

	return EmailBackupConfig{
		Host:       db.GetSetting("smtp_host"),
		Port:       port,
		User:       db.GetSetting("smtp_user"),
		Pass:       db.GetSetting("smtp_pass"),
		To:         db.GetSetting("smtp_to"),
		Enabled:    db.GetSetting("auto_backup_enabled") == "true",
		Interval:   interval,
		LastSent:   db.GetSetting("last_backup_email_time"),
		LastStatus: db.GetSetting("last_backup_email_status"),
	}
}

func (db *DB) SaveEmailBackupConfig(cfg EmailBackupConfig) error {
	_ = db.SetSetting("smtp_host", strings.TrimSpace(cfg.Host))
	_ = db.SetSetting("smtp_port", strings.TrimSpace(cfg.Port))
	_ = db.SetSetting("smtp_user", strings.TrimSpace(cfg.User))
	if cfg.Pass != "" {
		_ = db.SetSetting("smtp_pass", strings.TrimSpace(cfg.Pass))
	}
	_ = db.SetSetting("smtp_to", strings.TrimSpace(cfg.To))
	_ = db.SetSetting("auto_backup_enabled", strconv.FormatBool(cfg.Enabled))
	_ = db.SetSetting("auto_backup_interval", strings.TrimSpace(cfg.Interval))
	return nil
}

// dialSMTP establishes a connection to the SMTP server supporting Port 465 (SMTPS) and 587/25 (STARTTLS)
func dialSMTP(host, port string) (*smtp.Client, error) {
	addr := net.JoinHostPort(host, port)
	if port == "465" {
		tlsConfig := &tls.Config{
			ServerName: host,
		}
		conn, err := tls.DialWithDialer(&net.Dialer{Timeout: 15 * time.Second}, "tcp", addr, tlsConfig)
		if err != nil {
			return nil, fmt.Errorf("SSL/TLS connection to %s failed: %w", addr, err)
		}
		client, err := smtp.NewClient(conn, host)
		if err != nil {
			_ = conn.Close()
			return nil, fmt.Errorf("SMTP client creation failed: %w", err)
		}
		return client, nil
	}

	// Port 587, 25, or custom ports
	conn, err := net.DialTimeout("tcp", addr, 15*time.Second)
	if err != nil {
		return nil, fmt.Errorf("TCP connection to %s failed: %w", addr, err)
	}

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("SMTP client creation failed: %w", err)
	}

	// Automatically upgrade with STARTTLS if supported
	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsConfig := &tls.Config{
			ServerName: host,
		}
		if err := client.StartTLS(tlsConfig); err != nil {
			_ = client.Close()
			return nil, fmt.Errorf("STARTTLS upgrade failed: %w", err)
		}
	}

	return client, nil
}

// TestSMTP verifies the SMTP server settings by authenticating
func TestSMTP(cfg EmailBackupConfig) error {
	if cfg.Host == "" {
		return fmt.Errorf("SMTP Host cannot be empty")
	}
	port := cfg.Port
	if port == "" {
		port = "587"
	}

	client, err := dialSMTP(cfg.Host, port)
	if err != nil {
		return err
	}
	defer client.Close()

	if cfg.User != "" && cfg.Pass != "" {
		auth := smtp.PlainAuth("", cfg.User, cfg.Pass, cfg.Host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("SMTP Authentication failed: %w (check username and App Password)", err)
		}
	}
	return nil
}

// BuildEmailMIME creates a standard RFC multipart/mixed MIME email message with HTML body and JSON attachment
func BuildEmailMIME(from, to, subject, htmlBody, filename string, attachment []byte) []byte {
	boundary := fmt.Sprintf("RENTBILLS_BOUNDARY_%d", time.Now().UnixNano())
	var b bytes.Buffer

	// Standard Headers
	b.WriteString(fmt.Sprintf("From: %s\r\n", from))
	b.WriteString(fmt.Sprintf("To: %s\r\n", to))
	b.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	b.WriteString(fmt.Sprintf("Date: %s\r\n", time.Now().Format(time.RFC1123Z)))
	b.WriteString("MIME-Version: 1.0\r\n")
	b.WriteString(fmt.Sprintf("Content-Type: multipart/mixed; boundary=\"%s\"\r\n\r\n", boundary))

	// HTML Body Part
	b.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	b.WriteString("Content-Type: text/html; charset=\"UTF-8\"\r\n")
	b.WriteString("Content-Transfer-Encoding: 7bit\r\n\r\n")
	b.WriteString(htmlBody)
	b.WriteString("\r\n\r\n")

	// File Attachment Part
	if len(attachment) > 0 && filename != "" {
		b.WriteString(fmt.Sprintf("--%s\r\n", boundary))
		b.WriteString(fmt.Sprintf("Content-Type: application/json; name=\"%s\"\r\n", filename))
		b.WriteString("Content-Transfer-Encoding: base64\r\n")
		b.WriteString(fmt.Sprintf("Content-Disposition: attachment; filename=\"%s\"\r\n\r\n", filename))

		// Base64 encode and split into 76-character lines for RFC compliance
		encoded := base64.StdEncoding.EncodeToString(attachment)
		for len(encoded) > 76 {
			b.WriteString(encoded[:76] + "\r\n")
			encoded = encoded[76:]
		}
		if len(encoded) > 0 {
			b.WriteString(encoded + "\r\n")
		}
	}

	b.WriteString(fmt.Sprintf("--%s--\r\n", boundary))
	return b.Bytes()
}

// SendEmailBackup generates a fresh database backup and sends it to the configured recipient
func (db *DB) SendEmailBackup(cfg EmailBackupConfig) error {
	if cfg.Host == "" || cfg.User == "" {
		return fmt.Errorf("SMTP Host and User must be configured")
	}
	recipient := cfg.To
	if recipient == "" {
		recipient = cfg.User
	}
	port := cfg.Port
	if port == "" {
		port = "587"
	}

	// 1. Export database backup
	backupData, err := db.ExportBackup()
	if err != nil {
		return fmt.Errorf("failed generating backup data: %w", err)
	}

	backupJSON, err := json.MarshalIndent(backupData, "", "  ")
	if err != nil {
		return fmt.Errorf("failed encoding backup to JSON: %w", err)
	}

	now := time.Now()
	nowStr := now.Format("2006-01-02 15:04:05")
	filename := fmt.Sprintf("rentbills-backup-%s.json", now.Format("2006-01-02-150405"))
	subject := fmt.Sprintf("[RentBills] Automatic Cloud Backup - %s", now.Format("02 Jan 2006"))

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f1f5f9; padding: 24px; margin: 0;">
  <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
    <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 24px; text-align: center; color: #ffffff;">
      <h2 style="margin: 0 0 6px 0; font-size: 22px; font-weight: 700;">🏠 RentBills Auto-Backup</h2>
      <p style="margin: 0; font-size: 14px; opacity: 0.9;">Secure Automated Database Snapshot</p>
    </div>
    <div style="padding: 24px; color: #334155; font-size: 14px; line-height: 1.6;">
      <p style="margin-top: 0;">Hello,</p>
      <p>Your RentBills database has been safely backed up. The complete JSON data file <strong>%s</strong> (%.1f KB) is attached to this email.</p>
      
      <table style="width: 100%%; border-collapse: collapse; margin: 20px 0; background: #f8fafc; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0; font-size: 13px;">
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 14px; font-weight: 600; color: #64748b;">Snapshot Date</td><td style="padding: 10px 14px; text-align: right; color: #0f172a; font-weight: 600;">%s</td></tr>
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 14px; font-weight: 600; color: #64748b;">Properties</td><td style="padding: 10px 14px; text-align: right; color: #0f172a;">%d</td></tr>
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 14px; font-weight: 600; color: #64748b;">Tenants</td><td style="padding: 10px 14px; text-align: right; color: #0f172a;">%d</td></tr>
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 14px; font-weight: 600; color: #64748b;">Bills Recorded</td><td style="padding: 10px 14px; text-align: right; color: #0f172a;">%d</td></tr>
        <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 10px 14px; font-weight: 600; color: #64748b;">Payments Tracked</td><td style="padding: 10px 14px; text-align: right; color: #0f172a;">%d</td></tr>
        <tr><td style="padding: 10px 14px; font-weight: 600; color: #64748b;">Expenses Recorded</td><td style="padding: 10px 14px; text-align: right; color: #0f172a;">%d</td></tr>
      </table>

      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 14px; border-radius: 4px; font-size: 13px; color: #1e40af; margin-bottom: 18px;">
        💡 <strong>How to Restore:</strong> If you ever need to restore your data on this PC or a new computer, download the attached JSON file, go to <strong>Settings &rarr; Restore Database from Backup File</strong> in RentBills, and select it.
      </div>
    </div>
    <div style="border-top: 1px solid #f1f5f9; padding: 14px 24px; text-align: center; color: #94a3b8; font-size: 12px; background: #fafafa;">
      RentBills Management App &bull; Automated Cloud Backup System
    </div>
  </div>
</body>
</html>`, filename, float64(len(backupJSON))/1024.0, nowStr, len(backupData.Properties), len(backupData.Tenants), len(backupData.Bills), len(backupData.Payments), len(backupData.Expenses))

	msg := BuildEmailMIME(cfg.User, recipient, subject, htmlBody, filename, backupJSON)

	// 2. Connect and deliver via SMTP
	client, err := dialSMTP(cfg.Host, port)
	if err != nil {
		status := fmt.Sprintf("Failed: %v", err)
		_ = db.SetSetting("last_backup_email_status", status)
		return err
	}
	defer client.Close()

	if cfg.User != "" && cfg.Pass != "" {
		auth := smtp.PlainAuth("", cfg.User, cfg.Pass, cfg.Host)
		if err := client.Auth(auth); err != nil {
			status := fmt.Sprintf("Auth Failed: %v", err)
			_ = db.SetSetting("last_backup_email_status", status)
			return fmt.Errorf("SMTP auth failed: %w", err)
		}
	}

	if err := client.Mail(cfg.User); err != nil {
		status := fmt.Sprintf("MAIL failed: %v", err)
		_ = db.SetSetting("last_backup_email_status", status)
		return err
	}
	if err := client.Rcpt(recipient); err != nil {
		status := fmt.Sprintf("RCPT failed: %v", err)
		_ = db.SetSetting("last_backup_email_status", status)
		return err
	}

	w, err := client.Data()
	if err != nil {
		status := fmt.Sprintf("DATA failed: %v", err)
		_ = db.SetSetting("last_backup_email_status", status)
		return err
	}

	if _, err := w.Write(msg); err != nil {
		_ = w.Close()
		status := fmt.Sprintf("Write failed: %v", err)
		_ = db.SetSetting("last_backup_email_status", status)
		return err
	}

	if err := w.Close(); err != nil {
		status := fmt.Sprintf("Close failed: %v", err)
		_ = db.SetSetting("last_backup_email_status", status)
		return err
	}

	_ = client.Quit()

	// Update status on success
	successStatus := fmt.Sprintf("Success (sent %.1f KB backup)", float64(len(backupJSON))/1024.0)
	_ = db.SetSetting("last_backup_email_time", nowStr)
	_ = db.SetSetting("last_backup_email_status", successStatus)
	log.Printf("📧 Automated email backup sent successfully to %s (%s)", recipient, successStatus)

	return nil
}

// RunAutoBackupCheck evaluates if a scheduled backup is due and triggers it
func (db *DB) RunAutoBackupCheck() error {
	cfg := db.GetEmailBackupConfig()
	if !cfg.Enabled || cfg.Host == "" || cfg.User == "" {
		return nil
	}

	// Check if due
	interval := 24 * time.Hour
	if cfg.Interval == "weekly" {
		interval = 7 * 24 * time.Hour
	}

	if cfg.LastSent != "" {
		lastTime, err := time.Parse("2006-01-02 15:04:05", cfg.LastSent)
		if err == nil {
			if time.Since(lastTime) < interval {
				return nil // Not due yet
			}
		}
	}

	log.Printf("⏰ Auto backup is due (Interval: %s). Sending email...", cfg.Interval)
	return db.SendEmailBackup(cfg)
}
