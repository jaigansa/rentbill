package api

import (
	"fmt"
	"io"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// Broker handles multiple SSE client connections
type Broker struct {
	clients map[chan string]bool
	mutex   sync.Mutex
}

var GlobalBroker = &Broker{
	clients: make(map[chan string]bool),
}

func init() {
	GlobalBroker.clients = make(map[chan string]bool)
}

func (b *Broker) AddClient() chan string {
	b.mutex.Lock()
	defer b.mutex.Unlock()
	ch := make(chan string)
	b.clients[ch] = true
	return ch
}

func (b *Broker) RemoveClient(ch chan string) {
	b.mutex.Lock()
	delete(b.clients, ch)
	b.mutex.Unlock()
	close(ch)
}

func (b *Broker) Broadcast(msg string) {
	b.mutex.Lock()
	clients := make([]chan string, 0, len(b.clients))
	for ch := range b.clients {
		clients = append(clients, ch)
	}
	b.mutex.Unlock()

	for _, ch := range clients {
		select {
		case ch <- msg:
		default:
			// Client blocked or slow, skip
		}
	}
}

// SSEHandler provides the event stream endpoint
func SSEHandler(c *gin.Context) {
	clientChan := GlobalBroker.AddClient()
	defer GlobalBroker.RemoveClient(clientChan)

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")
	c.Header("Access-Control-Allow-Origin", "*")

	// Flush headers immediately
	c.Writer.Flush()

	ticker := time.NewTicker(15 * time.Second) // Heartbeat
	defer ticker.Stop()

	c.Stream(func(w io.Writer) bool {
		select {
		case msg, ok := <-clientChan:
			if !ok {
				return false
			}
			c.SSEvent("message", msg)
			return true
		case <-ticker.C:
			// Send comment heartbeat to keep connection alive
			fmt.Fprintf(w, ": heartbeat\n\n")
			return true
		case <-c.Request.Context().Done():
			return false
		}
	})
}

// TriggerRefresh tells all clients to reload their data
func TriggerRefresh(reason string) {
	GlobalBroker.Broadcast(fmt.Sprintf(`{"event": "DATA_CHANGED", "reason": "%s"}`, reason))
}
