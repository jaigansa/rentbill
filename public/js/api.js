// REST API Client for RentBill
const API = {
  async getDashboard(month = '') {
    const url = month ? `/api/dashboard?month=${encodeURIComponent(month)}` : '/api/dashboard';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load dashboard data');
    return res.json();
  },

  // Properties
  async getProperties() {
    const res = await fetch('/api/properties');
    if (!res.ok) throw new Error('Failed to load properties');
    return res.json();
  },

  async getProperty(id) {
    const res = await fetch(`/api/properties/${id}`);
    if (!res.ok) throw new Error('Failed to load property');
    return res.json();
  },

  async createProperty(data) {
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateProperty(id, data) {
    const res = await fetch(`/api/properties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async deleteProperty(id) {
    const res = await fetch(`/api/properties/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete property');
    return res.json();
  },

  // Tenants
  async getTenants() {
    const res = await fetch('/api/tenants');
    if (!res.ok) throw new Error('Failed to load tenants');
    return res.json();
  },

  async getTenant(id) {
    const res = await fetch(`/api/tenants/${id}`);
    if (!res.ok) throw new Error('Failed to load tenant');
    return res.json();
  },

  async createTenant(data) {
    const res = await fetch('/api/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async updateTenant(id, data) {
    const res = await fetch(`/api/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  async getTenantLastBill(tenantId) {
    const res = await fetch(`/api/tenants/${tenantId}/last-bill`);
    if (!res.ok) return { curr_electricity_meter: 0, curr_water_meter: 0 };
    return res.json();
  },

  async getTenantLedger(tenantId) {
    const res = await fetch(`/api/tenants/${tenantId}/ledger`);
    if (!res.ok) throw new Error('Failed to load tenant passbook ledger');
    return res.json();
  },

  async deleteTenant(id) {
    const res = await fetch(`/api/tenants/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete tenant');
    return res.json();
  },

  // Bills
  async getBills(tenantId = null) {
    const url = tenantId ? `/api/bills?tenant_id=${tenantId}` : '/api/bills';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load bills');
    return res.json();
  },

  async getBill(id) {
    const res = await fetch(`/api/bills/${id}`);
    if (!res.ok) throw new Error('Failed to load bill');
    return res.json();
  },

  async createBill(data) {
    const res = await fetch('/api/bills', {
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
    const res = await fetch(`/api/bills/${id}`, {
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
    const res = await fetch(`/api/bills/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete bill');
    return res.json();
  },

  // Payments
  async recordPayment(data) {
    const res = await fetch('/api/payments', {
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
    const res = await fetch('/api/settings');
    if (!res.ok) return { currency_symbol: '₹' };
    return res.json();
  },

  async updateSettings(data) {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  // Expenses (Per-Property)
  async getPropertyExpenses(propertyId) {
    const res = await fetch(`/api/properties/${propertyId}/expenses`);
    if (!res.ok) throw new Error('Failed to load property expenses');
    return res.json();
  },

  async createExpense(data) {
    const res = await fetch('/api/expenses', {
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
    const res = await fetch(`/api/expenses/${id}`, {
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
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete expense');
    return res.json();
  },

  // Backup & Restore
  async restoreBackup(backupData) {
    const res = await fetch('/api/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(backupData)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Restore failed' }));
      throw new Error(err.error || 'Restore failed');
    }
    return res.json();
  }
};
