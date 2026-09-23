// RentBill Pro — Authentication, Session & User Access Gatekeeper (Direct Admin Mode)
import { getSupabaseClient } from '../core/config.js';
import { getCurrentUser, setCurrentUser, getCurrentLang } from '../core/state.js';
import { loadTranslations } from '../core/i18n.js';
import { refreshLucideIcons } from '../core/ui.js';
import { loadDashboard } from './dashboard.js';
import { loadBillsPage } from './bills.js';
import { loadPaymentsPage } from './payments.js';
import { loadMaintenancePage } from './maintenance.js';
import { loadPropertiesPage } from './properties.js';
import { setupRealtimeSubscriptions, teardownRealtimeSubscriptions } from './realtime.js';

export const DEFAULT_ADMIN_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  username: 'Admin',
  role: 'ADMIN',
  email: 'admin@rentbill.local'
};

export function showLogin() {
  // Auth removed: directly switch to app workspace
  hideLoader();
  const appView = document.getElementById('app-view');
  if (appView) appView.style.display = 'flex';
  const authView = document.getElementById('auth-view');
  if (authView) authView.style.display = 'none';
}

export function hideLoader() {
  const loader = document.getElementById('app-loader');
  if (loader) loader.style.display = 'none';
}

export async function checkAuth() {
  // Auth removed: automatically assign full Admin credentials with unrestricted access
  setCurrentUser({ ...DEFAULT_ADMIN_USER });
  const activeUser = getCurrentUser();

  // Switch views to application workspace
  hideLoader();
  const authView = document.getElementById('auth-view');
  if (authView) authView.style.display = 'none';
  const appView = document.getElementById('app-view');
  if (appView) appView.style.display = 'flex';

  const initial = (activeUser.username || 'A').charAt(0).toUpperCase();

  const badgeEl = document.getElementById('user-profile-badge');
  if (badgeEl) badgeEl.title = `Signed in as ${activeUser.username || 'Admin'} (${activeUser.role || 'ADMIN'}) — Full Access`;
  const avatarTxt = document.getElementById('user-avatar-text');
  if (avatarTxt) avatarTxt.textContent = initial;
  const nameEl = document.getElementById('user-profile-name');
  if (nameEl) nameEl.textContent = activeUser.username || 'Admin';
  const roleEl = document.getElementById('user-profile-role');
  if (roleEl) roleEl.textContent = activeUser.role || 'ADMIN';

  const dropAvatar = document.getElementById('dropdown-avatar-text');
  if (dropAvatar) dropAvatar.textContent = initial;
  const dropName = document.getElementById('dropdown-user-name');
  if (dropName) dropName.textContent = activeUser.username || 'Admin';
  const dropEmail = document.getElementById('dropdown-user-email');
  if (dropEmail) dropEmail.textContent = activeUser.email || 'admin@rentbill.local';
  const dropRole = document.getElementById('dropdown-user-role');
  if (dropRole) dropRole.textContent = activeUser.role || 'ADMIN';
  updateConnectionStatus(navigator.onLine);

  // Viewer Mode Indicator is disabled since auth is removed
  const viewerBanner = document.getElementById('viewer-mode-banner');
  if (viewerBanner) viewerBanner.style.display = 'none';

  document.querySelectorAll('.admin-only').forEach(el => el.style.display = '');

  try {
    await loadTranslations(getCurrentLang());
  } catch (i18nErr) {}

  // Restore active page across browser reloads
  let savedPage = localStorage.getItem('rentbill_active_page') || 'page-dashboard';

  // Activate the targeted page DOM section explicitly
  document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
  const targetSection = document.getElementById(savedPage) || document.getElementById('page-dashboard');
  if (targetSection) targetSection.classList.add('active');

  // Update active nav styling
  document.querySelectorAll('.nav-item').forEach(nav => {
    if (nav.getAttribute('data-target') === savedPage) {
      nav.classList.add('active');
    } else {
      nav.classList.remove('active');
    }
  });

  // Directly trigger content loader for the selected page
  switch (savedPage) {
    case 'page-bills': loadBillsPage(); break;
    case 'page-payments': loadPaymentsPage(); break;
    case 'page-maintenance': loadMaintenancePage(); break;
    case 'page-properties':
      loadPropertiesPage();
      break;
    default:
      loadDashboard();
      break;
  }

  try {
    setupRealtimeSubscriptions();
  } catch (rtErr) {
    console.warn('Realtime subscription notice:', rtErr);
  }
}

export async function handleLogout() {
  // Auth removed: refreshing or clearing session reloads workspace directly as Admin
  teardownRealtimeSubscriptions();
  localStorage.removeItem('rentbill_active_page');
  window.location.reload();
}

export function showSetupConfigModal() {
  const inputIdOrUrl = prompt("Enter your Supabase Project ID (e.g., 'abcd1234') or Project URL:");
  const inputKey = prompt("Enter your Supabase Publishable Key or Anon Key:");
  if (inputIdOrUrl && inputKey) {
    localStorage.setItem('rentbill_sb_url', inputIdOrUrl.trim());
    localStorage.setItem('rentbill_sb_key', inputKey.trim());
    window.location.reload();
  }
}

export function toggleKeyMask() {
  const input = document.getElementById('cfg-sb-key');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
}

export function toggleLoginPasswordMask() {
  const pwInput = document.getElementById('login-password');
  const eyeIcon = document.getElementById('login-eye-icon');
  if (!pwInput) return;
  const isHidden = pwInput.type === 'password';
  pwInput.type = isHidden ? 'text' : 'password';
  if (eyeIcon) {
    eyeIcon.setAttribute('data-lucide', isHidden ? 'eye-off' : 'eye');
    refreshLucideIcons();
  }
}

export function toggleUserProfileDropdown(event) {
  if (event) event.stopPropagation();
  const dropdown = document.getElementById('user-profile-dropdown');
  if (!dropdown) return;
  const isHidden = dropdown.style.display === 'none';
  dropdown.style.display = isHidden ? 'block' : 'none';
  if (isHidden) {
    refreshLucideIcons();
  }
}

export function closeUserProfileDropdown() {
  const dropdown = document.getElementById('user-profile-dropdown');
  if (dropdown) dropdown.style.display = 'none';
}

export function openProfileSettings() {
  closeUserProfileDropdown();
  if (window.navigateToPage) {
    window.navigateToPage('page-settings');
  } else {
    document.querySelectorAll('[data-target="page-settings"]').forEach(el => el.click());
  }
  if (window.switchSettingsSubTab) {
    const authBtn = document.querySelectorAll('.settings-tab-btn')[1];
    if (authBtn) window.switchSettingsSubTab('auth', authBtn);
  }
}

export function openProfileDiagnostics() {
  closeUserProfileDropdown();
  if (window.navigateToPage) {
    window.navigateToPage('page-diagnostics');
  } else {
    document.querySelectorAll('[data-target="page-diagnostics"]').forEach(el => el.click());
  }
}

export function updateConnectionStatus(isOnline) {
  const statusDot = document.getElementById('user-status-dot');
  const dropdownIndicator = document.getElementById('dropdown-status-indicator');
  if (statusDot) {
    statusDot.className = `avatar-status-dot ${isOnline ? 'online' : 'offline'}`;
    statusDot.title = isOnline ? 'Online • Realtime Synced' : 'Offline • Local Mode';
  }
  if (dropdownIndicator) {
    dropdownIndicator.className = `status-indicator-badge ${isOnline ? 'online' : 'offline'}`;
    dropdownIndicator.innerHTML = `<span class="status-dot ${isOnline ? 'online' : 'offline'}"></span> ${isOnline ? 'Realtime Synced' : 'Offline Mode'}`;
  }
}

if (typeof window !== 'undefined') {
  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('user-profile-wrapper');
    if (wrapper && !wrapper.contains(e.target)) {
      closeUserProfileDropdown();
    }
  });

  window.addEventListener('online', () => updateConnectionStatus(true));
  window.addEventListener('offline', () => updateConnectionStatus(false));
}
