// REST API Client for RentBill with Session Authentication
const API = {
  // Centralized request wrapper with Bearer token header, credentials, and 401 auto-lock
  async fetchWithAuth(url, options = {}) {
    options = options || {};
    options.headers = options.headers || {};
    const token = localStorage.getItem('rentbill_session_token');
    if (token) {
      if (options.headers instanceof Headers) {
        if (!options.headers.has('Authorization')) options.headers.set('Authorization', `Bearer ${token}`);
      } else {
        if (!options.headers['Authorization']) options.headers['Authorization'] = `Bearer ${token}`;
      }
    }
    // Attach local GUI app security token if available
    const appToken = sessionStorage.getItem('rb_app_token');
    if (appToken) {
      if (options.headers instanceof Headers) {
        if (!options.headers.has('X-RentBill-Token')) options.headers.set('X-RentBill-Token', appToken);
      } else {
        if (!options.headers['X-RentBill-Token']) options.headers['X-RentBill-Token'] = appToken;
      }
    }
    // Ensure cookies are included
    if (!options.credentials) {
      options.credentials = 'same-origin';
    }

    const res = await fetch(url, options);

    if (res.status === 401 && !url.includes('/api/auth/status') && !url.includes('/api/auth/verify')) {
      localStorage.removeItem('rentbill_session_token');
      sessionStorage.removeItem('rb_unlocked');
      if (window.App && typeof window.App.lockApp === 'function') {
        window.App.isPINEnabled = true;
        window.App.lockApp();
      }
    }
    return res;
  },

  async getNetworkInfo() {
    const res = await this.fetchWithAuth('/api/network/info');
    if (!res.ok) throw new Error('Failed to load network info');
    return res.json();
  },

  async getDashboard(month = '') {
    const url = month ? `/api/dashboard?month=${encodeURIComponent(month)}` : '/api/dashboard';
    const res = await this.fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to load dashboard data');
    return res.json();
  },

  // Properties
  async getProperties() {
    const res = await this.fetchWithAuth('/api/properties');
    if (!res.ok) throw new Error('Failed to load properties');
    return res.json();
  },

  async getProperty(id) {
    const res = await this.fetchWithAuth(`/api/properties/${id}`);
    if (!res.ok) throw new Error('Failed to load property');
    return res.json();
  },

  async createProperty(data) {
    const res = await this.fetchWithAuth('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateProperty(id, data) {
    const res = await this.fetchWithAuth(`/api/properties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteProperty(id) {
    const res = await this.fetchWithAuth(`/api/properties/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete property');
    return res.json();
  },

  // Tenants
  async getTenants() {
    const res = await this.fetchWithAuth('/api/tenants');
    if (!res.ok) throw new Error('Failed to load tenants');
    return res.json();
  },

  async getTenant(id) {
    const res = await this.fetchWithAuth(`/api/tenants/${id}`);
    if (!res.ok) throw new Error('Failed to load tenant');
    return res.json();
  },

  async createTenant(data) {
    const res = await this.fetchWithAuth('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateTenant(id, data) {
    const res = await this.fetchWithAuth(`/api/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getTenantLastBill(tenantId) {
    const res = await this.fetchWithAuth(`/api/tenants/${tenantId}/last-bill`);
    if (!res.ok) return { curr_electricity_meter: 0, curr_water_meter: 0 };
    return res.json();
  },

  async getTenantLedger(tenantId) {
    const res = await this.fetchWithAuth(`/api/tenants/${tenantId}/ledger`);
    if (!res.ok) throw new Error('Failed to load tenant passbook ledger');
    return res.json();
  },

  async deleteTenant(id) {
    const res = await this.fetchWithAuth(`/api/tenants/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete tenant');
    return res.json();
  },

  // Bills
  async getBills(tenantId = null) {
    const url = tenantId ? `/api/bills?tenant_id=${tenantId}` : '/api/bills';
    const res = await this.fetchWithAuth(url);
    if (!res.ok) throw new Error('Failed to load bills');
    return res.json();
  },

  async getBill(id) {
    const res = await this.fetchWithAuth(`/api/bills/${id}`);
    if (!res.ok) throw new Error('Failed to load bill');
    return res.json();
  },

  async createBill(data) {
    const res = await this.fetchWithAuth('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create bill' }));
      throw new Error(err.error || 'Failed to create bill');
    }
    return res.json();
  },

  async updateBill(id, data) {
    const res = await this.fetchWithAuth(`/api/bills/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update bill' }));
      throw new Error(err.error || 'Failed to update bill');
    }
    return res.json();
  },

  async deleteBill(id) {
    const res = await this.fetchWithAuth(`/api/bills/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete bill');
    return res.json();
  },

  // Payments
  async recordPayment(data) {
    const res = await this.fetchWithAuth('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to save payment' }));
      throw new Error(err.error || 'Failed to save payment');
    }
    return res.json();
  },

  // Settings
  async getSettings() {
    const res = await this.fetchWithAuth('/api/settings');
    if (!res.ok) return { currency_symbol: '₹' };
    return res.json();
  },

  async updateSettings(data) {
    const res = await this.fetchWithAuth('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Expenses (Per-Property)
  async getPropertyExpenses(propertyId) {
    const res = await this.fetchWithAuth(`/api/properties/${propertyId}/expenses`);
    if (!res.ok) throw new Error('Failed to load property expenses');
    return res.json();
  },

  async createExpense(data) {
    const res = await this.fetchWithAuth('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to create expense' }));
      throw new Error(err.error || 'Failed to create expense');
    }
    return res.json();
  },

  async updateExpense(id, data) {
    const res = await this.fetchWithAuth(`/api/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to update expense' }));
      throw new Error(err.error || 'Failed to update expense');
    }
    return res.json();
  },

  async deleteExpense(id) {
    const res = await this.fetchWithAuth(`/api/expenses/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete expense');
    return res.json();
  },

  // Backup & Restore
  async restoreBackup(backupData) {
    const res = await this.fetchWithAuth('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Restore failed' }));
      throw new Error(err.error || 'Restore failed');
    }
  },

  // 4-Digit Security PIN & Session Auth
  async getAuthStatus() {
    const res = await this.fetchWithAuth('/api/auth/status');
    if (!res.ok) return { pin_enabled: false, authenticated: false };
    return res.json();
  },

  async verifyPIN(pin) {
    const res = await this.fetchWithAuth('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Incorrect PIN' }));
      throw new Error(err.error || 'Incorrect PIN');
    }
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('rentbill_session_token', data.token);
    }
    sessionStorage.setItem('rb_unlocked', 'true');
    return data;
  },

  async setPIN(newPin, currentPin = '') {
    const res = await this.fetchWithAuth('/api/auth/set-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ new_pin: newPin, current_pin: currentPin })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to configure PIN' }));
      throw new Error(err.error || 'Failed to configure PIN');
    }
    const data = await res.json();
    if (data.token) {
      localStorage.setItem('rentbill_session_token', data.token);
    }
    sessionStorage.setItem('rb_unlocked', 'true');
    return data;
  },

  async disablePIN(currentPin = '') {
    const res = await this.fetchWithAuth('/api/auth/disable-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_pin: currentPin })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to disable PIN' }));
      throw new Error(err.error || 'Failed to disable PIN');
    }
    localStorage.removeItem('rentbill_session_token');
    sessionStorage.removeItem('rb_unlocked');
    return res.json();
  },

  async logout() {
    try {
      await this.fetchWithAuth('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      console.warn('Logout request failed:', e);
    } finally {
      localStorage.removeItem('rentbill_session_token');
      sessionStorage.removeItem('rb_unlocked');
    }
  }
};
