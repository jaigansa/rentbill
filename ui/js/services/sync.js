/**
 * Live Sync Engine: Standard SSE-based UI Updates
 * Listens for server events to refresh the UI in real-time.
 */

const SyncEngine = {
    eventSource: null,

    init() {
        this.connectLiveStream();

        // Reconnect logic
        window.addEventListener('online', () => {
            console.log("Network back online. Reconnecting live stream...");
            this.connectLiveStream();
        });

        // Periodic check to ensure connection
        setInterval(() => {
            if (navigator.onLine && !this.eventSource) this.connectLiveStream();
        }, 30000);
    },

    connectLiveStream() {
        if (this.eventSource) return;

        this.eventSource = new EventSource('/api/events/stream');
        const liveBadge = document.getElementById('liveStatus');
        
        this.eventSource.onopen = () => {
            console.log("Live Sync: Connected to server");
            if (liveBadge) {
                liveBadge.innerHTML = '<span class="pulse-dot" style="width: 6px; height: 6px; background: var(--success); border-radius: 50%; display: inline-block; margin-right: 6px;"></span> LIVE';
                liveBadge.style.background = 'var(--bg-success-light)';
                liveBadge.style.color = 'var(--success)';
                liveBadge.style.borderColor = 'var(--success)';
            }
        };

        this.eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.event === 'DATA_CHANGED') {
                    console.log("Live Sync: Data changed on server", data.reason);
                    // Refresh the app's global state from server
                    window.dispatchEvent(new CustomEvent('sync-complete', { detail: data }));
                }
            } catch (e) {
                // Ignore heartbeats (not JSON)
            }
        };

        this.eventSource.onerror = (err) => {
            console.warn("Live Sync connection lost. Retrying in 5s...");
            if (liveBadge) {
                liveBadge.innerHTML = 'OFFLINE';
                liveBadge.style.background = 'var(--bg-danger-light)';
                liveBadge.style.color = 'var(--danger)';
                liveBadge.style.borderColor = 'var(--danger)';
            }
            this.eventSource.close();
            this.eventSource = null;
            setTimeout(() => this.connectLiveStream(), 5000);
        };
    }
};

// Start the engine
SyncEngine.init();
