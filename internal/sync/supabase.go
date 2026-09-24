package sync

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type SupabaseClient struct {
	URL    string
	APIKey string
	client *http.Client
}

func NewSupabaseClient(url, apiKey string) *SupabaseClient {
	return &SupabaseClient{
		URL:    url,
		APIKey: apiKey,
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// PushRecord allows pushing a table row to Supabase REST endpoint (e.g. /rest/v1/bills)
func (s *SupabaseClient) PushRecord(tableName string, record interface{}) error {
	if s.URL == "" || s.APIKey == "" {
		return nil // Cloud sync not configured, silently skip
	}

	endpoint := fmt.Sprintf("%s/rest/v1/%s", s.URL, tableName)
	payloadBytes, err := json.Marshal(record)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", endpoint, bytes.NewBuffer(payloadBytes))
	if err != nil {
		return err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.APIKey)
	req.Header.Set("Authorization", "Bearer "+s.APIKey)
	req.Header.Set("Prefer", "resolution=merge-duplicates") // Upsert support

	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return fmt.Errorf("supabase returned HTTP %d", resp.StatusCode)
	}

	return nil
}
