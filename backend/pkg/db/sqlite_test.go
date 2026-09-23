package db

import (
	"os"
	"path/filepath"
	"testing"
)

func TestOpenSQLiteAndOutbox(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "rentbill_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test.db")
	database, err := Open(dbPath)
	if err != nil {
		t.Fatalf("Failed to open db: %v", err)
	}
	defer database.Close()

	// Verify properties table works
	res, err := database.SQLDB().Exec(`
		INSERT INTO properties (uuid, name, address)
		VALUES (?, ?, ?)
	`, "test-prop-uuid", "Green Heights", "123 Main Street")
	if err != nil {
		t.Fatalf("Failed to insert property: %v", err)
	}

	id, _ := res.LastInsertId()
	if id <= 0 {
		t.Errorf("Expected positive ID, got %d", id)
	}

	// Verify outbox queueing
	err = database.QueueOutbox(nil, "properties", "test-prop-uuid", "INSERT", map[string]interface{}{
		"uuid":    "test-prop-uuid",
		"name":    "Green Heights",
		"address": "123 Main Street",
	})
	if err != nil {
		t.Fatalf("Failed to queue outbox: %v", err)
	}

	count, err := database.GetPendingCount()
	if err != nil {
		t.Fatalf("Failed to get pending count: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected 1 pending item, got %d", count)
	}

	items, err := database.GetPendingOutbox(10)
	if err != nil {
		t.Fatalf("Failed to get pending outbox: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("Expected 1 outbox item, got %d", len(items))
	}
	if items[0].TableName != "properties" || items[0].RecordUUID != "test-prop-uuid" {
		t.Errorf("Unexpected outbox item content: %+v", items[0])
	}

	// Mark synced
	if err := database.MarkOutboxSynced(items[0].ID); err != nil {
		t.Fatalf("Failed to mark outbox synced: %v", err)
	}

	countAfter, err := database.GetPendingCount()
	if err != nil {
		t.Fatalf("Failed to get pending count after sync: %v", err)
	}
	if countAfter != 0 {
		t.Errorf("Expected 0 pending items, got %d", countAfter)
	}

	// Verify sync meta
	err = database.SetSyncMeta("last_pulled_at", "2026-09-22T00:00:00Z")
	if err != nil {
		t.Fatalf("Failed to set sync meta: %v", err)
	}
	val, err := database.GetSyncMeta("last_pulled_at")
	if err != nil {
		t.Fatalf("Failed to get sync meta: %v", err)
	}
	if val != "2026-09-22T00:00:00Z" {
		t.Errorf("Expected meta value '2026-09-22T00:00:00Z', got '%s'", val)
	}
}
