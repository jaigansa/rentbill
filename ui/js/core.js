/* ===== SECTION: components/templates.js ===== */
const Templates = {
    get authOverlay() { return document.getElementById('tpl-authOverlay').innerHTML; },
    get navigation() { return document.getElementById('tpl-navigation').innerHTML; },
    get dashboard() { return document.getElementById('tpl-dashboard').innerHTML; },
    get tenants() { return document.getElementById('tpl-tenants').innerHTML; },
    get owners() { return document.getElementById('tpl-owners').innerHTML; },
    get property() { return document.getElementById('tpl-property').innerHTML; },
    get settings() { return document.getElementById('tpl-settings').innerHTML; },
    get tenantPortal() { return document.getElementById('tpl-tenantPortal').innerHTML; },
    get modals() { return document.getElementById('tpl-modals').innerHTML; }
};

/* ===== SECTION: services/api.js ===== */
/**
 * API Service: Pure Network-Based Data Access
 * Every request communicates directly with the Go backend.
 */

const API = {
    // --- Core Request Engine ---
    
    async request(endpoint, options = {}) {
        const isFormData = options.body instanceof FormData;
        const headers = options.headers || {};
        if (!isFormData && !headers['Content-Type']) {
            headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(`/api${endpoint}`, { ...options, headers });
            
            if (response.status === 401) {
                localStorage.removeItem('isLoggedIn');
                window.location.reload();
                throw new Error('Session expired');
            }

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                throw new Error(data.error || 'Network error');
            }

            if (options.responseType === 'blob') return response.blob();
            return response.json().catch(() => ({ success: true }));
        } catch (error) {
            console.error(`API Error for ${endpoint}:`, error);
            throw error;
        }
    },

    // --- Domain Methods ---

    auth: {
        getSetupStatus: () => API.request('/setup/status'),
        completeSetup: (data) => API.request('/setup', { method: 'POST', body: JSON.stringify(data) }),
        verify: (credentials) => API.request('/auth/verify', { method: 'POST', body: JSON.stringify(typeof credentials === 'string' ? { pin: credentials } : credentials) }),
        forgotPin: (data) => API.request('/auth/forgot-pin', { method: 'POST', body: JSON.stringify(data || {}) }),
        logout: () => API.request('/auth/logout', { method: 'POST' }),
        checkPin: (pin) => API.request('/auth/check-pin', { method: 'POST', body: JSON.stringify({ pin }) })
    },

    tenants: {
        getAll: () => API.request('/renters'),
        getHistory: () => API.request('/renters/history'),
        getOne: (id) => API.request(`/renter/${id}`),
        create: (data) => API.request('/renters', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/renters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        updatePassword: (id, password) => API.request(`/renters/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
        delete: (id) => API.request(`/renters/${id}`, { method: 'DELETE' }),
        markVacant: (data) => API.request('/vacant', { method: 'POST', body: JSON.stringify(data) }),
        restore: (id) => API.request('/restore', { method: 'POST', body: JSON.stringify({ id }) }),
        getExpiringAgreements: () => API.request('/renters/expiring-agreements'),
        renewAgreement: (id) => API.request(`/renters/${id}/renew-agreement`, { method: 'POST' })
    },

    bills: {
        getByRenter: (renterId) => API.request(`/bills/${renterId}`),
        getOne: (id) => API.request(`/bill/${id}`),
        create: (data) => API.request('/bills', { method: 'POST', body: JSON.stringify(data) }),
        createBatch: (data) => API.request('/bills/batch', { method: 'POST', body: JSON.stringify(data) }),
        pay: (id, data) => API.request(`/bills/${id}/pay`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/bills/${id}`, { method: 'DELETE' }),
        sendEmail: (data) => API.request('/bills/email', { method: 'POST', body: JSON.stringify(data) }),
        getMonthlyReport: (month) => API.request(`/reports/monthly/${month}`),
        getFinancialSummary: () => API.request('/reports/financial-summary'),
        getPendingBills: () => API.request('/reports/pending-bills'),
        getPendingProofs: () => API.request('/bills/pending-proofs'),
        verifyProof: (id, action, method) => API.request(`/bills/${id}/verify-proof`, { method: 'POST', body: JSON.stringify({ action, payment_method: method }) }),
        getTenantLedger: () => API.request('/reports/tenant-ledger'),
        getAllPaidBills: (from, to) => API.request(`/reports/all-paid-bills?from=${from || ''}&to=${to || ''}`),
        getTrends: (owner) => API.request('/reports/trends?owner=' + encodeURIComponent(owner || '')),
        getLastEB: (renterId) => API.request(`/last-eb/${renterId}`),
        getLastWater: (renterId) => API.request(`/last-water/${renterId}`),
        getBillingStatus: (month) => API.request(`/reports/billing-status?month=${encodeURIComponent(month || '')}`)
    },

    expenses: {
        getAll: (limit, offset) => API.request(`/expenses?limit=${limit || 20}&offset=${offset || 0}`),
        create: (data) => API.request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/expenses/${id}`, { method: 'DELETE' })
    },

    withdrawals: {
        getAll: (limit, offset, owner, from, to) => API.request(`/withdrawals?limit=${limit || 20}&offset=${offset || 0}&owner=${owner || ''}&from=${from || ''}&to=${to || ''}`),
        create: (data) => API.request('/withdrawals', { method: 'POST', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/withdrawals/${id}`, { method: 'DELETE' })
    },

    maintenance: {
        getAll: (status) => API.request(`/maintenance?status=${status || 'ALL'}`),
        create: (data) => API.request('/maintenance', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/maintenance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/maintenance/${id}`, { method: 'DELETE' }),
        uploadPhoto: (id, formData) => API.request(`/maintenance/${id}/upload`, { method: 'POST', body: formData })
    },

    system: {
        getSettings: () => API.request('/settings'),
        updateSettings: (data) => API.request('/settings', { method: 'POST', body: JSON.stringify(data) }),
        testEmail: () => API.request('/settings/test-email', { method: 'POST' }),
        getLogs: (filter, from, to) => API.request(`/logs?filter=${filter || 'ALL'}&from=${from || ''}&to=${to || ''}`),
        backup: (filename) => API.request('/db/backup', { method: 'POST', body: JSON.stringify({ filename }), responseType: 'blob' }),
        restore: (formData) => API.request('/db/restore', { method: 'POST', body: formData }),
        getAuditReport: (from, to) => API.request(`/reports/audit?from=${from}&to=${to}`)
    },

    units: {
        getAll: () => API.request('/units'),
        create: (data) => API.request('/units', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/units/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/units/${id}`, { method: 'DELETE' })
    }
};

/* ===== SECTION: services/sync.js ===== */
/**
 * Live Sync Engine: Standard SSE-based UI Updates
 * Listens for server events to refresh the UI in real-time.
 */

const SyncEngine = {
    eventSource: null,
    currentSection: null,
    currentSubSection: null,

    // Map sections to their refresh functions
    refreshMap: {
        'dashboard-section': () => { if (typeof loadDashboardStats === 'function') loadDashboardStats(); },
        'tenants-section': {
            'tenants-billing': () => { if (typeof loadTenants === 'function') loadTenants(); },
            'tenants-ledger': () => { if (typeof initHistorySection === 'function') initHistorySection(false); },
            'tenants-registry': () => { if (typeof loadManageTenants === 'function') loadManageTenants(); },
            'tenants-vault': () => { if (typeof loadVault === 'function') loadVault(); },
            'tenants-archived': () => { if (typeof toggleHistory === 'function') toggleHistory(true); }
        },
        'owners-section': {
            'owners-received': () => { if (typeof loadReceivedPayments === 'function') loadReceivedPayments(); },
            'owners-payouts': () => { if (typeof loadWithdrawals === 'function') loadWithdrawals(); },
            'owners-accounts': () => { if (typeof loadSettings === 'function') loadSettings(); }
        },
        'property-section': {
            'property-units': () => { if (typeof renderPropertyUnitsTable === 'function') renderPropertyUnitsTable(); },
            'property-expenses': () => { if (typeof loadExpenses === 'function') loadExpenses(); },
            'property-maintenance': () => { if (typeof loadTasks === 'function') loadTasks(); },
            'property-audit': () => { if (typeof loadAuditReport === 'function') loadAuditReport(); }
        },
        'settings-section': {
            'settings-config': () => { if (typeof loadSettings === 'function') loadSettings(); },
            'settings-database': () => { if (typeof loadSettings === 'function') loadSettings(); }
        }
    },

    init() {
        this.connectLiveStream();
        this.setupSyncListener();

        window.addEventListener('online', () => {
            console.log("Network back online. Reconnecting live stream...");
            this.connectLiveStream();
        });

        setInterval(() => {
            if (navigator.onLine && !this.eventSource) this.connectLiveStream();
        }, 30000);
    },

    setupSyncListener() {
        window.addEventListener('sync-complete', (e) => {
            console.log("Live Sync: Refreshing current view", e.detail);
            this.refreshCurrentView();
        });
    },

    trackSection(sectionId, subSectionId = null) {
        this.currentSection = sectionId;
        this.currentSubSection = subSectionId;
    },

    refreshCurrentView() {
        const sectionHandlers = this.refreshMap[this.currentSection];
        if (!sectionHandlers) return;

        if (typeof sectionHandlers === 'function') {
            sectionHandlers();
        } else if (this.currentSubSection && sectionHandlers[this.currentSubSection]) {
            sectionHandlers[this.currentSubSection]();
        } else if (!this.currentSubSection) {
            // Try default subsections
            const defaults = {
                'tenants-section': 'tenants-billing',
                'owners-section': 'owners-received',
                'settings-section': 'settings-config',
                'property-section': 'property-units'
            };
            const defaultSub = defaults[this.currentSection];
            if (defaultSub && sectionHandlers[defaultSub]) {
                sectionHandlers[defaultSub]();
            }
        }
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
                    window.dispatchEvent(new CustomEvent('sync-complete', { detail: data }));
                }
            } catch (e) {}
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

SyncEngine.init();

/* ===== SECTION: components/ui.js ===== */
const UI = {
    renderTenantCard: (t, onEdit, onVacant) => {
        const card = document.createElement('div');
        card.className = 'tenant-row';
        card.innerHTML = `
            <div class="tenant-header" style="padding: 1rem;">
                <div style="display: flex; gap: 1rem; align-items: flex-start; width: 100%;">
                    <div class="room-badge" style="flex-shrink: 0;">${t.room_no}</div>
                    
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 900; font-size: 1.1rem; color: var(--text-main); line-height: 1.2; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${t.name}
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
                            <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">
                                <i data-lucide="phone" style="width: 10px; height: 10px; margin-right: 2px; vertical-align: middle;"></i> ${t.mobile_number}
                            </span>
                            <span style="width: 4px; height: 4px; background: var(--border);"></span>
                            <span style="font-size: 0.7rem; font-weight: 800; color: var(--primary); text-transform: uppercase;">
                                <i data-lucide="indian-rupee" style="width: 10px; height: 10px; margin-right: 2px; vertical-align: middle;"></i> ${currencyFormatter.format(t.base_rent)}
                            </span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 0.5rem; flex-shrink: 0; align-items: center;">
                        <button class="btn btn-secondary btn-icon-sm edit-btn" title="Edit Profile" style="border-radius: 8px; width: 34px; height: 34px;">
                            <i data-lucide="edit-2" style="width: 16px;"></i>
                        </button>
                        <button class="btn btn-danger btn-icon-sm vacant-btn" title="Register Exit" style="border-radius: 8px; width: 34px; height: 34px; background: var(--bg-danger-light); border-color: var(--danger); color: var(--danger);">
                            <i data-lucide="log-out" style="width: 16px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        card.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); onEdit(t.id); };
        card.querySelector('.vacant-btn').onclick = (e) => { e.stopPropagation(); onVacant(t.id); };
        return card;
    },

    renderExpenseItem: (e, onDelete) => {
        const item = document.createElement('div');
        item.className = 'tenant-row';
        item.style.padding = '1rem 1.25rem';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div class="stat-icon icon-danger" style="width: 40px; height: 40px;"><i data-lucide="trending-down" style="width: 20px;"></i></div>
                <div>
                    <div style="font-weight: 900; font-size: 1rem; color: var(--text-main);">${currencyFormatter.format(e.amount)}</div>
                    <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">${e.category} • ${e.date}</div>
                </div>
            </div>
            <button class="btn btn-secondary btn-icon-sm delete-btn"><i data-lucide="trash-2" width="14" height="14"></i></button>
        `;
        item.querySelector('.delete-btn').onclick = () => onDelete(e.id);
        return item;
    },

    renderLogItem: (l, actionIcons) => {
        const icon = actionIcons[l.action] || 'activity';
        return `
            <div class="log-item">
                <div class="log-icon-box">
                    <i data-lucide="${icon}" style="width: 20px; height: 20px;"></i>
                </div>
                <div class="log-content">
                    <span class="log-action">${l.action.replace(/_/g, ' ')}</span>
                    <div class="log-details">${l.details}</div>
                    <span class="log-time">${new Date(l.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        `;
    },

    renderUnifiedAccountRow: (acc, index) => {
        const hasUpi = !!acc.upi;
        const hasBank = !!acc.bank_name;
        
        return `
            <div class="tenant-row" style="padding: 1rem; margin-bottom: 0.5rem; border: 3px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="font-weight: 900; font-size: 0.8rem; color: var(--primary); text-transform: uppercase; margin-bottom: 4px;">
                            ${acc.owner_name} <span style="color: var(--text-muted); font-weight: 700;">(${acc.label})</span>
                        </div>
                        
                        ${hasUpi ? `
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <div class="stat-icon icon-success" style="width: 24px; height: 24px; border-width: 2px;"><i data-lucide="smartphone" style="width: 12px;"></i></div>
                                <span style="font-size: 0.75rem; font-family: monospace; font-weight: 700;">${acc.upi}</span>
                            </div>
                        ` : ''}

                        ${hasBank ? `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div class="stat-icon icon-primary" style="width: 24px; height: 24px; border-width: 2px;"><i data-lucide="building" style="width: 12px;"></i></div>
                                <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-main);">${acc.bank_name} - ${acc.account_number} (${acc.ifsc})</span>
                            </div>
                        ` : ''}
                    </div>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="editReceivingAccount(${index})" class="btn btn-secondary btn-icon-sm" style="border: none; background: transparent;">
                            <i data-lucide="edit-2" style="width: 16px; color: var(--primary);"></i>
                        </button>
                        <button onclick="deleteReceivingAccount(${index})" class="btn btn-secondary btn-icon-sm" style="border: none; background: transparent;">
                            <i data-lucide="trash-2" style="width: 16px; color: var(--danger);"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    },

    renderWithdrawalItem: (w, onDelete) => {
        const d = new Date(w.date);
        const day = d.getDate().toString().padStart(2, '0');
        const month = d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
        
        return `
            <div class="tenant-row" style="padding: 0.75rem 1.25rem; margin-bottom: 0.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1.25rem; border: 1.5px solid var(--border); border-radius: 12px; transition: transform 0.2s ease;">
                <div style="display: flex; align-items: center; gap: 1.25rem; flex: 1; min-width: 0;">
                    <div style="width: 44px; height: 44px; background: var(--bg-input); border: 1.5px solid var(--border); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; line-height: 1;">
                        <span style="font-size: 0.55rem; font-weight: 800; color: var(--primary); margin-bottom: 2px;">${month}</span>
                        <span style="font-size: 1rem; font-weight: 900; color: var(--text-main);">${day}</span>
                    </div>
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; flex: 1; min-width: 0; gap: 1rem;">
                        <div style="min-width: 0; flex: 1;">
                            <div style="font-size: 0.7rem; font-weight: 850; color: var(--primary); text-transform: uppercase; margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
                                <span>${w.owner_name}</span>
                                <span style="width: 3px; height: 3px; background: var(--border); border-radius: 50%;"></span>
                                <span style="color: var(--text-muted);">${d.getFullYear()}</span>
                            </div>
                            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0.8;" title="${w.notes || ''}">
                                ${w.notes || 'No description provided'}
                            </div>
                        </div>
                        
                        <div style="text-align: right; flex-shrink: 0;">
                            <div style="font-weight: 900; font-size: 1.15rem; color: var(--text-main); letter-spacing: -0.5px;">
                                ${currencyFormatter.format(w.amount)}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="withdrawal-actions no-print">
                    <button onclick="deleteWithdrawal(${w.id})" class="btn btn-secondary btn-icon-sm" style="width: 32px; height: 32px; border-radius: 8px; border: none; background: var(--bg-danger-light); color: var(--danger);"><i data-lucide="trash-2" width="14" height="14"></i></button>
                </div>
            </div>
        `;
    },
    renderChannelPill: (acc) => {
        const pill = document.createElement('button');
        pill.className = 'btn btn-secondary btn-sm';
        pill.style.padding = '0.4rem 0.75rem';
        pill.style.fontSize = '0.65rem';
        pill.style.borderRadius = '0px';
        pill.style.border = '2px solid var(--border)';
        pill.style.fontWeight = '800';
        pill.innerHTML = `<span style="color: var(--primary); margin-right: 4px;">${acc.label}:</span> ${acc.id} <i data-lucide="copy" width="10" height="10" style="margin-left: 4px; opacity: 0.5;"></i>`;
        pill.onclick = () => {
            navigator.clipboard.writeText(acc.id);
            showNotification(`Copied ${acc.label}`, "success");
        };
        return pill;
    }
};
