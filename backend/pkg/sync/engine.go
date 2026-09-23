package sync

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"rentbills/backend/pkg/db"
)

type SyncStatus struct {
	IsOnline     bool   `json:"is_online"`
	IsSyncing    bool   `json:"is_syncing"`
	PendingCount int    `json:"pending_count"`
	LastSyncTime string `json:"last_sync_time"`
	LastError    string `json:"last_error,omitempty"`
}

type SyncEngine struct {
	database  *db.DB
	client    *SupabaseClient
	status    SyncStatus
	mu        sync.RWMutex
	triggerCh chan struct{}
	ctx       context.Context
	cancel    context.CancelFunc
}

var syncTables = []string{
	"owners",
	"properties",
	"units",
	"renters",
	"bills",
	"payments",
	"expenses",
	"maintenance_tasks",
	"documents",
}

func NewSyncEngine(database *db.DB, client *SupabaseClient) *SyncEngine {
	ctx, cancel := context.WithCancel(context.Background())
	lastSync, _ := database.GetSyncMeta("last_sync_time")
	pending, _ := database.GetPendingCount()

	return &SyncEngine{
		database: database,
		client:   client,
		triggerCh: make(chan struct{}, 1),
		ctx:       ctx,
		cancel:    cancel,
		status: SyncStatus{
			IsOnline:     false,
			IsSyncing:    false,
			PendingCount: pending,
			LastSyncTime: lastSync,
		},
	}
}

func (e *SyncEngine) GetStatus() SyncStatus {
	e.mu.RLock()
	defer e.mu.RUnlock()

	pending, _ := e.database.GetPendingCount()
	st := e.status
	st.PendingCount = pending
	return st
}

func (e *SyncEngine) TriggerSync() {
	select {
	case e.triggerCh <- struct{}{}:
	default:
	}
}

func (e *SyncEngine) Stop() {
	e.cancel()
}

// Start runs background sync loop
func (e *SyncEngine) Start() {
	go e.loop()
}

func (e *SyncEngine) loop() {
	ticker := time.NewTicker(8 * time.Second)
	defer ticker.Stop()

	// Initial sync attempt on startup
	e.performSync()

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			e.performSync()
		case <-e.triggerCh:
			e.performSync()
		}
	}
}

func (e *SyncEngine) setSyncing(isSyncing bool) {
	e.mu.Lock()
	e.status.IsSyncing = isSyncing
	e.mu.Unlock()
}

func (e *SyncEngine) setOnline(isOnline bool, errStr string) {
	e.mu.Lock()
	e.status.IsOnline = isOnline
	e.status.LastError = errStr
	e.mu.Unlock()
}

func (e *SyncEngine) setLastSync(t string) {
	e.mu.Lock()
	e.status.LastSyncTime = t
	e.mu.Unlock()
	_ = e.database.SetSyncMeta("last_sync_time", t)
}

func (e *SyncEngine) performSync() {
	if !e.client.IsConfigured() {
		e.setOnline(false, "Supabase credentials not configured")
		return
	}

	// 1. Check Connectivity
	online, err := e.client.Ping()
	if !online || err != nil {
		errMsg := "Supabase unreachable (offline mode)"
		if err != nil {
			errMsg = err.Error()
		}
		e.setOnline(false, errMsg)
		return
	}
	e.setOnline(true, "")

	e.setSyncing(true)
	defer e.setSyncing(false)

	// 2. Push Outbox (Local -> Cloud)
	if err := e.drainOutbox(); err != nil {
		log.Printf("[SyncEngine] Outbox push warning: %v", err)
		e.mu.Lock()
		e.status.LastError = "Push error: " + err.Error()
		e.mu.Unlock()
	}

	// 3. Pull Remote Deltas (Cloud -> Local)
	if err := e.pullRemoteDeltas(); err != nil {
		log.Printf("[SyncEngine] Remote pull warning: %v", err)
		e.mu.Lock()
		e.status.LastError = "Pull error: " + err.Error()
		e.mu.Unlock()
	}

	e.setLastSync(db.NowISO())
}

func (e *SyncEngine) drainOutbox() error {
	items, err := e.database.GetPendingOutbox(50)
	if err != nil {
		return err
	}

	for _, item := range items {
		var payload map[string]interface{}
		if err := json.Unmarshal([]byte(item.Payload), &payload); err != nil {
			_ = e.database.MarkOutboxFailed(item.ID, fmt.Sprintf("invalid payload: %v", err))
			continue
		}

		// Ensure UUID is present in payload
		if item.RecordUUID != "" && payload["uuid"] == nil {
			payload["uuid"] = item.RecordUUID
		}

		var opErr error
		if item.Action == "DELETE" {
			// For soft-delete, we can either update deleted_at or DELETE by uuid
			if payload["deleted_at"] != nil {
				opErr = e.client.Upsert(item.TableName, payload)
			} else {
				opErr = e.client.DeleteByUUID(item.TableName, item.RecordUUID)
			}
		} else {
			// Clean payload: remove local auto-increment integer ID so Supabase uses its own or matches on UUID
			delete(payload, "id")
			opErr = e.client.Upsert(item.TableName, payload)
		}

		if opErr != nil {
			_ = e.database.MarkOutboxFailed(item.ID, opErr.Error())
			return opErr
		}

		if err := e.database.MarkOutboxSynced(item.ID); err != nil {
			return err
		}
	}

	return nil
}

func (e *SyncEngine) pullRemoteDeltas() error {
	for _, table := range syncTables {
		metaKey := "last_pull_" + table
		lastPull, _ := e.database.GetSyncMeta(metaKey)

		deltas, err := e.client.FetchDeltas(table, lastPull)
		if err != nil {
			return fmt.Errorf("failed to pull %s: %w", table, err)
		}

		latestUpdated := lastPull
		for _, row := range deltas {
			if err := e.applyRemoteRow(table, row); err != nil {
				log.Printf("[SyncEngine] Failed applying remote row for %s: %v", table, err)
				continue
			}

			if updatedAt, ok := row["updated_at"].(string); ok && updatedAt > latestUpdated {
				latestUpdated = updatedAt
			}
		}

		if latestUpdated != "" && latestUpdated != lastPull {
			_ = e.database.SetSyncMeta(metaKey, latestUpdated)
		}
	}

	return nil
}

// applyRemoteRow upserts a cloud record into local SQLite with Last-Write-Wins logic
func (e *SyncEngine) applyRemoteRow(table string, row map[string]interface{}) error {
	recordUUID, ok := row["uuid"].(string)
	if !ok || recordUUID == "" {
		return nil // skip rows without uuid
	}

	// Prepare dynamic upsert
	cols := make([]string, 0, len(row))
	placeholders := make([]string, 0, len(row))
	values := make([]interface{}, 0, len(row))
	updateClauses := make([]string, 0, len(row))

	for k, v := range row {
		if k == "id" {
			continue // skip server integer id, use local id or uuid
		}
		cols = append(cols, k)
		placeholders = append(placeholders, "?")
		values = append(values, v)

		if k != "uuid" && k != "created_at" {
			updateClauses = append(updateClauses, fmt.Sprintf("%s = excluded.%s", k, k))
		}
	}

	if len(cols) == 0 {
		return nil
	}

	query := fmt.Sprintf(`
		INSERT INTO %s (%s)
		VALUES (%s)
		ON CONFLICT(uuid) DO UPDATE SET
			%s
		WHERE excluded.updated_at IS NULL OR excluded.updated_at >= %s.updated_at OR %s.updated_at IS NULL
	`,
		table,
		strings.Join(cols, ", "),
		strings.Join(placeholders, ", "),
		strings.Join(updateClauses, ", "),
		table,
		table,
	)

	_, err := e.database.SQLDB().Exec(query, values...)
	return err
}
