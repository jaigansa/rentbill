package db

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

type OutboxItem struct {
	ID         int64  `json:"id"`
	TableName  string `json:"table_name"`
	RecordUUID string `json:"record_uuid"`
	Action     string `json:"action"`
	Payload    string `json:"payload"`
	Status     string `json:"status"`
	RetryCount int    `json:"retry_count"`
}

type DB struct {
	sqlDB *sql.DB
	mu    sync.RWMutex
}

// Open initializes or connects to the local SQLite database at dbPath
func Open(dbPath string) (*DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create db directory: %w", err)
	}

	sqlDB, err := sql.Open("sqlite", dbPath+"?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite db: %w", err)
	}

	// Single writer / multi-reader configuration
	sqlDB.SetMaxOpenConns(1)

	if _, err := sqlDB.Exec(Schema); err != nil {
		sqlDB.Close()
		return nil, fmt.Errorf("failed to apply schema: %w", err)
	}

	return &DB{sqlDB: sqlDB}, nil
}

func (d *DB) Close() error {
	return d.sqlDB.Close()
}

func (d *DB) SQLDB() *sql.DB {
	return d.sqlDB
}

// EnsureUUID generates a new UUID string if empty
func EnsureUUID(val string) string {
	if val == "" {
		return uuid.New().String()
	}
	return val
}

// QueueOutbox adds a pending change to the sync_outbox
func (d *DB) QueueOutbox(tx *sql.Tx, tableName, recordUUID, action string, payload interface{}) error {
	bytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal outbox payload: %w", err)
	}

	query := `
		INSERT INTO sync_outbox (table_name, record_uuid, action, payload, status, created_at)
		VALUES (?, ?, ?, ?, 'PENDING', datetime('now'))
	`
	if tx != nil {
		_, err = tx.Exec(query, tableName, recordUUID, action, string(bytes))
	} else {
		_, err = d.sqlDB.Exec(query, tableName, recordUUID, action, string(bytes))
	}
	return err
}

// GetPendingOutbox retrieves un-synced items from the outbox
func (d *DB) GetPendingOutbox(limit int) ([]OutboxItem, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	rows, err := d.sqlDB.Query(`
		SELECT id, table_name, record_uuid, action, payload, status, retry_count
		FROM sync_outbox
		WHERE status IN ('PENDING', 'FAILED') AND retry_count < 10
		ORDER BY id ASC
		LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []OutboxItem
	for rows.Next() {
		var item OutboxItem
		if err := rows.Scan(&item.ID, &item.TableName, &item.RecordUUID, &item.Action, &item.Payload, &item.Status, &item.RetryCount); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

// MarkOutboxSynced marks an outbox row as synced
func (d *DB) MarkOutboxSynced(id int64) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.sqlDB.Exec(`
		UPDATE sync_outbox
		SET status = 'SYNCED', synced_at = datetime('now')
		WHERE id = ?
	`, id)
	return err
}

// MarkOutboxFailed increments the retry count and records error
func (d *DB) MarkOutboxFailed(id int64, errMsg string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.sqlDB.Exec(`
		UPDATE sync_outbox
		SET status = 'FAILED', retry_count = retry_count + 1, error_message = ?
		WHERE id = ?
	`, errMsg, id)
	return err
}

// GetPendingCount returns number of queued sync operations
func (d *DB) GetPendingCount() (int, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var count int
	err := d.sqlDB.QueryRow(`
		SELECT COUNT(*) FROM sync_outbox WHERE status IN ('PENDING', 'FAILED')
	`).Scan(&count)
	return count, err
}

// Sync Meta accessors
func (d *DB) GetSyncMeta(key string) (string, error) {
	d.mu.RLock()
	defer d.mu.RUnlock()

	var val string
	err := d.sqlDB.QueryRow(`SELECT value FROM sync_meta WHERE key = ?`, key).Scan(&val)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return val, err
}

func (d *DB) SetSyncMeta(key, value string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	_, err := d.sqlDB.Exec(`
		INSERT INTO sync_meta (key, value, updated_at)
		VALUES (?, ?, datetime('now'))
		ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
	`, key, value)
	return err
}

// Generic Query Helper to convert SQL rows into []map[string]interface{} for easy JSON serialization
func QueryToMaps(rows *sql.Rows) ([]map[string]interface{}, error) {
	defer rows.Close()
	cols, err := rows.Columns()
	if err != nil {
		return nil, err
	}

	var results []map[string]interface{}
	for rows.Next() {
		colVals := make([]interface{}, len(cols))
		colPointers := make([]interface{}, len(cols))
		for i := range colVals {
			colPointers[i] = &colVals[i]
		}

		if err := rows.Scan(colPointers...); err != nil {
			return nil, err
		}

		rowMap := make(map[string]interface{})
		for i, col := range cols {
			val := colVals[i]
			switch v := val.(type) {
			case []byte:
				rowMap[col] = string(v)
			default:
				rowMap[col] = v
			}
		}
		results = append(results, rowMap)
	}

	return results, nil
}

// NowISO returns current UTC timestamp in ISO 8601 format
func NowISO() string {
	return time.Now().UTC().Format(time.RFC3339)
}
