const API = {
    async request(endpoint, options = {}) {
        if (endpoint.includes('/null') || endpoint.includes('/undefined')) {
            console.error("API Aborted: Invalid endpoint", endpoint);
            return Promise.reject(new Error("Invalid request"));
        }
        const response = await fetch(`/api${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        
        let data;
        try {
            data = await response.json();
        } catch (e) {
            data = { error: 'Invalid JSON response' };
        }

        if (response.status === 401) {
            localStorage.removeItem('isLoggedIn');
            if (typeof showOverlay === 'function') showOverlay(true);
            throw new Error('Session expired');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Network response was not ok');
        }
        return data;
    },

    auth: {
        verify: (pin) => API.request('/auth/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
        forgotPin: () => API.request('/auth/forgot-pin', { method: 'POST' }),
        checkPin: (pin) => API.request('/auth/check-pin', { method: 'POST', body: JSON.stringify({ pin }) })
    },

    tenants: {
        getAll: () => API.request('/renters'),
        getHistory: () => API.request('/renters/history'),
        getOne: (id) => API.request(`/renter/${id}`),
        create: (data) => API.request('/renters', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/renters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/renters/${id}`, { method: 'DELETE' }),
        markVacant: (id) => API.request('/vacant', { method: 'POST', body: JSON.stringify({ id }) }),
        restore: (id) => API.request('/restore', { method: 'POST', body: JSON.stringify({ id }) })
    },

    bills: {
        getByRenter: (renterId, limit = 10, offset = 0) => API.request(`/bills/${renterId}?limit=${limit}&offset=${offset}`),
        getOne: (id) => API.request(`/bill/${id}`),
        create: (data) => API.request('/bills', { method: 'POST', body: JSON.stringify(data) }),
        pay: (id, data) => API.request(`/bills/${id}/pay`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/bills/${id}`, { method: 'DELETE' }),
        sendEmail: (data) => API.request('/bills/email', { method: 'POST', body: JSON.stringify(data) }),
        getMonthlyReport: (month) => API.request(`/reports/monthly/${month}`),
        getFinancialSummary: () => API.request('/reports/financial-summary'),
        getPendingBills: () => API.request('/reports/pending-bills'),
        getTenantLedger: () => API.request('/reports/tenant-ledger'),
        getAllPaidBills: () => API.request('/reports/all-paid-bills'),
        getLastEB: (renterId) => API.request(`/last-eb/${renterId}`)
        },

    expenses: {
        getAll: (limit = 20, offset = 0) => API.request(`/expenses?limit=${limit}&offset=${offset}`),
        create: (data) => API.request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/expenses/${id}`, { method: 'DELETE' })
    },

    withdrawals: {
        getAll: (limit = 20, offset = 0) => API.request(`/withdrawals?limit=${limit}&offset=${offset}`),
        create: (data) => API.request('/withdrawals', { method: 'POST', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/withdrawals/${id}`, { method: 'DELETE' })
    },

    system: {
        getLogs: (filter = 'ALL', limit = 30, offset = 0) => API.request(`/logs?filter=${filter}&limit=${limit}&offset=${offset}`),
        getSettings: () => API.request('/settings'),
        updateSettings: (data) => API.request('/settings', { method: 'POST', body: JSON.stringify(data) }),
        testEmail: () => API.request('/settings/test-email', { method: 'POST' }),
        backup: (filename) => API.request('/db/backup', { method: 'POST', body: JSON.stringify({ filename }) }),
        getAuditReport: (month) => API.request(`/reports/audit/${month}`)
    }
};
