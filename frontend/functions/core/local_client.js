// RentBill Pro — Local-First Data Client for Go SQLite Engine
// Implements Supabase-compatible PostgREST query builder syntax over local Go REST API

export class LocalFirstQueryBuilder {
  constructor(table, baseURL = '/api/data') {
    this.table = table;
    this.baseURL = baseURL;
    this.queryParams = {};
    this.method = 'GET';
    this.bodyPayload = null;
    this._single = false;
  }

  select(columns = '*') {
    this.method = 'GET';
    this.queryParams['select'] = columns;
    return this;
  }

  eq(column, value) {
    this.queryParams[column] = value;
    return this;
  }

  neq(column, value) {
    this.queryParams[column + '_neq'] = value;
    return this;
  }

  is(column, value) {
    if (value === null) {
      this.queryParams[column] = 'null';
    } else {
      this.queryParams[column] = String(value);
    }
    return this;
  }

  order(column, options = { ascending: true }) {
    const dir = options && options.ascending === false ? 'desc' : 'asc';
    this.queryParams['order'] = `${column}.${dir}`;
    return this;
  }

  limit(count) {
    this.queryParams['limit'] = count;
    return this;
  }

  single() {
    this._single = true;
    this.limit(1);
    return this;
  }

  maybeSingle() {
    this._single = true;
    this.limit(1);
    return this;
  }

  insert(payload) {
    this.method = 'POST';
    this.bodyPayload = payload;
    return this;
  }

  update(payload) {
    this.method = 'PATCH';
    this.bodyPayload = payload;
    return this;
  }

  delete() {
    this.method = 'DELETE';
    return this;
  }

  async then(resolve, reject) {
    try {
      const url = new URL(`${this.baseURL}/${this.table}`, window.location.origin);
      for (const [k, v] of Object.entries(this.queryParams)) {
        if (v !== undefined && v !== null) {
          url.searchParams.set(k, v);
        }
      }

      const options = {
        method: this.method,
        headers: { 'Content-Type': 'application/json' }
      };

      if (this.bodyPayload && (this.method === 'POST' || this.method === 'PATCH' || this.method === 'PUT')) {
        options.body = JSON.stringify(this.bodyPayload);
      }

      const res = await fetch(url.toString(), options);
      if (!res.ok) {
        const text = await res.text();
        return resolve({ data: null, error: new Error(text || res.statusText) });
      }

      let data = await res.json();
      if (this._single) {
        if (Array.isArray(data)) {
          data = data.length > 0 ? data[0] : null;
        }
      }
      return resolve({ data, error: null });
    } catch (err) {
      return resolve({ data: null, error: err });
    }
  }
}

export class LocalFirstClient {
  constructor(baseURL = '/api/data') {
    this.baseURL = baseURL;
    this.isLocalFirst = true;
    this.auth = {
      async getSession() {
        // In local mode, create an offline Admin session if none exists
        const localUser = localStorage.getItem('rentbill_local_user');
        const user = localUser ? JSON.parse(localUser) : {
          id: '00000000-0000-0000-0000-000000000001',
          email: 'admin@rentbill.local',
          user_metadata: { username: 'Admin (Local)', role: 'ADMIN' }
        };
        return {
          data: {
            session: {
              access_token: 'local-token',
              user: user
            }
          },
          error: null
        };
      },
      async signOut() {
        return { error: null };
      }
    };
  }

  from(table) {
    return new LocalFirstQueryBuilder(table, this.baseURL);
  }

  async getSyncStatus() {
    try {
      const res = await fetch('/api/sync/status');
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return null;
  }

  async triggerSync() {
    try {
      const res = await fetch('/api/sync/trigger', { method: 'POST' });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {}
    return null;
  }

  // Go Accounting Engine API
  async calculateBill(params) {
    try {
      const res = await fetch('/api/accounting/calculate-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!res.ok) {
        const txt = await res.text();
        return { data: null, error: new Error(txt || res.statusText) };
      }
      return { data: await res.json(), error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async getLedger() {
    try {
      const res = await fetch('/api/accounting/ledger');
      if (!res.ok) {
        const txt = await res.text();
        return { data: null, error: new Error(txt || res.statusText) };
      }
      return { data: await res.json(), error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async recordPayment(params) {
    try {
      const res = await fetch('/api/accounting/record-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!res.ok) {
        const txt = await res.text();
        return { data: null, error: new Error(txt || res.statusText) };
      }
      return { data: await res.json(), error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async voidBill(billId) {
    try {
      const res = await fetch('/api/accounting/void-bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bill_id: billId })
      });
      if (!res.ok) {
        const txt = await res.text();
        return { data: null, error: new Error(txt || res.statusText) };
      }
      return { data: await res.json(), error: null };
    } catch (err) {
      return { data: null, error: err };
    }
  }
}

