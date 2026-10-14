package backup_test

import (
	"strings"
	"testing"

	"rentbill/internal/backup"
)

func TestBuildEmailMIME(t *testing.T) {
	dummyAttachment := []byte(`{"test": "data"}`)
	msg := backup.BuildEmailMIME("sender@test.com", "recipient@test.com", "Test Subject", "<p>Hello</p>", "backup.json", dummyAttachment)
	msgStr := string(msg)

	if !strings.Contains(msgStr, "From: sender@test.com") {
		t.Errorf("MIME missing From header")
	}
	if !strings.Contains(msgStr, "To: recipient@test.com") {
		t.Errorf("MIME missing To header")
	}
	if !strings.Contains(msgStr, "filename=\"backup.json\"") {
		t.Errorf("MIME missing attachment filename")
	}
	if !strings.Contains(msgStr, "multipart/mixed") {
		t.Errorf("MIME missing multipart content type")
	}
}
