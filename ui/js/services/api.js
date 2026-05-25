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
        verify: (pin) => API.request('/auth/verify', { method: 'POST', body: JSON.stringify({ pin }) }),
        forgotPin: () => API.request('/auth/forgot-pin', { method: 'POST' }), // Note: forgot-pin path check
        logout: () => API.request('/auth/logout', { method: 'POST' }),
        checkPin: (pin) => API.request('/auth/check-pin', { method: 'POST', body: JSON.stringify({ pin }) })
    },

    tenants: {
        getAll: () => API.request('/renters'),
        getHistory: () => API.request('/renters/history'),
        getOne: (id) => API.request(`/renter/${id}`),
        create: (data) => API.request('/renters', { method: 'POST', body: JSON.stringify(data) }),
        update: (id, data) => API.request(`/renters/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/renters/${id}`, { method: 'DELETE' }),
        markVacant: (data) => API.request('/vacant', { method: 'POST', body: JSON.stringify(data) }),
        restore: (id) => API.request('/restore', { method: 'POST', body: JSON.stringify({ id }) })
    },

    bills: {
        getByRenter: (renterId) => API.request(`/bills/${renterId}`),
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
        getTrends: () => API.request('/reports/trends'),
        getLastEB: (renterId) => API.request(`/last-eb/${renterId}`)
    },

    expenses: {
        getAll: () => API.request('/expenses'),
        create: (data) => API.request('/expenses', { method: 'POST', body: JSON.stringify(data) }),
        delete: (id) => API.request(`/expenses/${id}`, { method: 'DELETE' })
    },

    withdrawals: {
        getAll: () => API.request('/withdrawals'),
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
        getLogs: (filter) => API.request(`/logs?filter=${filter || 'ALL'}`),
        backup: (filename) => API.request('/db/backup', { method: 'POST', body: JSON.stringify({ filename }), responseType: 'blob' }),
        restore: (formData) => API.request('/db/restore', { method: 'POST', body: formData }),
        getAuditReport: (from, to) => API.request(`/reports/audit?from=${from}&to=${to}`)
    }
};
