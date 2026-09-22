package sync

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"rentbills/backend/internal/db"
)

func TestSyncEngineOfflineState(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "rentbill_sync_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	dbPath := filepath.Join(tempDir, "test.db")
	database, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("Failed to open db: %v", err)
	}
	defer database.Close()

	// Unreachable or dummy config to verify offline handling
	client := NewSupabaseClient(SupabaseConfig{
		URL:     "https://invalid-supabase-test-endpoint.supabase.co",
		AnonKey: "dummy-test-key",
	})

	engine := NewSyncEngine(database, client)
	status := engine.GetStatus()

	if status.IsOnline {
		t.Errorf("Expected initial state to be offline, got online")
	}

	// Queue an outbox item
	err = database.QueueOutbox(nil, "properties", "prop-123", "INSERT", map[string]interface{}{
		"uuid": "prop-123",
		"name": "Test Villa",
	})
	if err != nil {
		t.Fatalf("Failed to queue outbox: %v", err)
	}

	status = engine.GetStatus()
	if status.PendingCount != 1 {
		t.Errorf("Expected 1 pending count, got %d", status.PendingCount)
	}

	// Trigger sync should attempt and safely remain offline without crashing
	engine.TriggerSync()
	time.Sleep(100 * time.Millisecond)

	status = engine.GetStatus()
	if status.PendingCount != 1 {
		t.Errorf("Pending count should remain 1 when sync cannot reach cloud, got %d", status.PendingCount)
	}
}
