// RentBill Pro — Supabase & Local-First Go SQLite Adapter Configuration
import { LocalFirstClient } from './local_client.js';

export const SUPABASE_CONFIG = {
  url: 'https://kkixhxrniodyndgzkqgq.supabase.co',
  anonKey: 'sb_publishable_zy5YRiETmug7i0qUII8pJQ_fVrF1th-',
  get projectIdOrUrl() { return this.url; },
  get publishableOrAnonKey() { return this.anonKey; }
};

let activeClient = null;
let syncMonitorTimer = null;

function sanitizeConfigVal(val) {
  if (!val) return '';
  let s = String(val).trim().replace(/^["']|["']$/g, '').trim();
  if (/^(YOUR_PROJECT_ID|YOUR_KEY|YOUR_SUPABASE_URL|YOUR_ANON_KEY)$/i.test(s)) {
    return '';
  }
  return s;
}

export function normalizeSupabaseUrl(input) {
  const clean = sanitizeConfigVal(input);
  if (!clean) return '';
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean.replace(/\/+$/, '');
  }
  return `https://${clean}.supabase.co`;
}

export async function initSupabaseClient() {
  // 1. Probe if Go Local-First SQLite & Sync Server is active
  try {
    const probe = await fetch('/api/sync/status', { method: 'GET', cache: 'no-store' });
    if (probe.ok) {
      console.log('⚡ RentBill Pro: Go Local-First SQLite Engine active (WAL mode).');
      activeClient = new LocalFirstClient('/api/data');
      startSyncStatusMonitor(activeClient);
      return true;
    }
  } catch (e) {
    // Local server not running, fall through to direct cloud Supabase
  }

  // 2. Direct Cloud Supabase Fallback
  const storedUrl = sanitizeConfigVal(localStorage.getItem('rentbill_sb_url'));
  const storedKey = sanitizeConfigVal(localStorage.getItem('rentbill_sb_key'));

  const rawInput = storedUrl || SUPABASE_CONFIG.projectIdOrUrl;
  const keyInput = storedKey || SUPABASE_CONFIG.publishableOrAnonKey;

  const finalUrl = normalizeSupabaseUrl(rawInput);
  const finalKey = sanitizeConfigVal(keyInput);

  if (!window.supabase) {
    console.warn('Supabase CDN library is not loaded.');
    return false;
  }

  if (finalUrl && finalKey && finalUrl !== 'https://YOUR_PROJECT_ID.supabase.co' && finalKey !== 'YOUR_KEY') {
    try {
      activeClient = window.supabase.createClient(finalUrl, finalKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      return true;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return false;
    }
  }
  return false;
}

export function getSupabaseClient() {
  return activeClient;
}

export function resetSupabaseConfig() {
  localStorage.removeItem('rentbill_sb_url');
  localStorage.removeItem('rentbill_sb_key');
  window.location.reload();
}

function startSyncStatusMonitor(client) {
  if (syncMonitorTimer) clearInterval(syncMonitorTimer);

  const poll = async () => {
    const status = await client.getSyncStatus();
    if (!status) return;

    const btn = document.getElementById('sync-status-btn');
    const txt = document.getElementById('sync-status-text');
    if (!btn || !txt) return;

    if (status.is_syncing) {
      btn.className = 'sync-status-pill syncing';
      txt.textContent = 'Syncing...';
      btn.title = 'Synchronizing with Supabase cloud...';
    } else if (!status.is_online) {
      btn.className = 'sync-status-pill offline';
      txt.textContent = 'Local SQLite (Offline)';
      btn.title = 'Offline mode active: all data saved to local SQLite. Will sync once online.';
    } else if (status.pending_count > 0) {
      btn.className = 'sync-status-pill syncing';
      txt.textContent = `${status.pending_count} Pending`;
      btn.title = `${status.pending_count} change(s) waiting to sync. Click to sync now.`;
    } else {
      btn.className = 'sync-status-pill online';
      txt.textContent = 'SQLite Synced';
      btn.title = 'Local SQLite is in sync with Supabase cloud. Click to force check.';
    }
  };

  poll();
  syncMonitorTimer = setInterval(poll, 4000);
}

export async function triggerManualSync() {
  if (activeClient && activeClient.isLocalFirst) {
    const btn = document.getElementById('sync-status-btn');
    const txt = document.getElementById('sync-status-text');
    if (txt) txt.textContent = 'Syncing...';
    if (btn) btn.className = 'sync-status-pill syncing';

    await activeClient.triggerSync();
  }
}

if (typeof window !== 'undefined') {
  window.triggerManualSync = triggerManualSync;
}

