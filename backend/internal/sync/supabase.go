package sync

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type SupabaseConfig struct {
	URL     string
	AnonKey string
}

type SupabaseClient struct {
	config     SupabaseConfig
	httpClient *http.Client
}

func NewSupabaseClient(cfg SupabaseConfig) *SupabaseClient {
	return &SupabaseClient{
		config: cfg,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *SupabaseClient) IsConfigured() bool {
	return c.config.URL != "" && c.config.AnonKey != "" &&
		!strings.Contains(c.config.URL, "YOUR_PROJECT_ID") &&
		!strings.Contains(c.config.AnonKey, "YOUR_KEY")
}

func (c *SupabaseClient) Ping() (bool, error) {
	if !c.IsConfigured() {
		return false, fmt.Errorf("supabase is not configured")
	}

	reqURL := fmt.Sprintf("%s/rest/v1/properties?select=id&limit=1", strings.TrimRight(c.config.URL, "/"))
	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return false, err
	}

	req.Header.Set("apikey", c.config.AnonKey)
	req.Header.Set("Authorization", "Bearer "+c.config.AnonKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return false, err
	}
	defer resp.Body.Close()

	// 200 OK means reachable and authenticated
	return resp.StatusCode >= 200 && resp.StatusCode < 300, nil
}

// Upsert pushes a record to Supabase using on_conflict=uuid
func (c *SupabaseClient) Upsert(table string, payload map[string]interface{}) error {
	if !c.IsConfigured() {
		return fmt.Errorf("supabase is not configured")
	}

	reqURL := fmt.Sprintf("%s/rest/v1/%s?on_conflict=uuid", strings.TrimRight(c.config.URL, "/"), table)
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequest("POST", reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return err
	}

	req.Header.Set("apikey", c.config.AnonKey)
	req.Header.Set("Authorization", "Bearer "+c.config.AnonKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Prefer", "resolution=merge-duplicates,return=minimal")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase upsert error (%d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// DeleteByUUID sends a delete or soft-delete request to Supabase
func (c *SupabaseClient) DeleteByUUID(table string, recordUUID string) error {
	if !c.IsConfigured() {
		return fmt.Errorf("supabase is not configured")
	}

	reqURL := fmt.Sprintf("%s/rest/v1/%s?uuid=eq.%s", strings.TrimRight(c.config.URL, "/"), table, url.QueryEscape(recordUUID))
	req, err := http.NewRequest("DELETE", reqURL, nil)
	if err != nil {
		return err
	}

	req.Header.Set("apikey", c.config.AnonKey)
	req.Header.Set("Authorization", "Bearer "+c.config.AnonKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("supabase delete error (%d): %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// FetchDeltas pulls records modified after updatedAfter timestamp
func (c *SupabaseClient) FetchDeltas(table string, updatedAfter string) ([]map[string]interface{}, error) {
	if !c.IsConfigured() {
		return nil, fmt.Errorf("supabase is not configured")
	}

	reqURL := fmt.Sprintf("%s/rest/v1/%s?select=*&order=updated_at.asc&limit=200", strings.TrimRight(c.config.URL, "/"), table)
	if updatedAfter != "" {
		reqURL += fmt.Sprintf("&updated_at=gt.%s", url.QueryEscape(updatedAfter))
	}

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("apikey", c.config.AnonKey)
	req.Header.Set("Authorization", "Bearer "+c.config.AnonKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("supabase fetch error (%d): %s", resp.StatusCode, string(respBody))
	}

	var results []map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&results); err != nil {
		return nil, err
	}

	return results, nil
}
