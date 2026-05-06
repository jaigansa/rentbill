// --- Rent Bill Pro: Main Entry & Global State ---

let appSettings = {};
let editMode = false;
let editId = null;
window.allTenants = []; // Global cache for active tenants
window.historyTenants = []; // Global cache for archived tenants

// --- Initialization ---
window.onload = async () => {
    injectTemplates();
    applyTheme();
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        await loadSettings();
        await refreshGlobalTenantCache();
        applyPermissions(); // NEW: Apply role-based restrictions
    }
    lucide.createIcons();
    registerServiceWorker();
};

function applyPermissions() {
    const role = localStorage.getItem('userRole') || 'owner';
    if (role === 'staff') {
        document.body.classList.add('role-staff');
        // Hide sensitive nav items
        const settingsNav = document.querySelector('button[onclick*="settings-section"]');
        if (settingsNav) settingsNav.style.display = 'none';
        
        const withdrawalsNav = document.querySelector('button[onclick*="owners-section"]');
        if (withdrawalsNav) withdrawalsNav.style.display = 'none';

        // Add a style tag to hide delete buttons and sensitive UI via CSS
        const style = document.createElement('style');
        style.id = 'staff-permissions-style';
        style.innerHTML = `
            .role-staff .btn-danger, 
            .role-staff .delete-btn,
            .role-staff button[onclick*="delete"],
            .role-staff button[onclick*="markVacant"],
            .role-staff #settings-audit,
            .role-staff #settings-database,
            .role-staff .no-staff { 
                display: none !important; 
            }
        `;
        document.head.appendChild(style);
    }
}

async function refreshGlobalTenantCache() {
    try {
        const [active, history] = await Promise.all([
            API.tenants.getAll(),
            API.tenants.getHistory()
        ]);
        window.allTenants = active || [];
        window.historyTenants = history || [];
    } catch (e) { console.error("Cache refresh failed", e); }
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW Registered', reg.scope))
            .catch(err => console.log('SW Registration failed', err));
    }
}

function injectTemplates() {
    document.getElementById('pinOverlay').innerHTML = Templates.authOverlay;
    document.getElementById('modalContainer').innerHTML = Templates.modals;
    const mainApp = document.getElementById('mainApp');
    mainApp.innerHTML = `
        ${Templates.navigation}
        <main class="content">
            ${Templates.dashboard}
            ${Templates.tenants}
            ${Templates.owners}
            ${Templates.settings}
        </main>
    `;
}

// --- PIN Authorized Generic Confirmation ---
async function confirmActionWithPin() {
    const pinInput = document.getElementById('deletePinInput');
    if (!pinInput) return;
    const pin = pinInput.value;
    if (!pin) return showNotification("PIN required", "error");

    try {
        await API.auth.checkPin(pin);
        
        // Authorization successful, execute the pending action
        if (typeof pendingDeleteId !== 'undefined' && pendingDeleteId) {
            await API.tenants.delete(pendingDeleteId);
            showNotification("Removed", "success");
            if (typeof resetForm === 'function') resetForm();
            showSection('tenants-section');
            switchSubSection('tenants-section', 'tenants-ledger');
            pendingDeleteId = null;
        } else if (typeof pendingDeleteBillId !== 'undefined' && pendingDeleteBillId) {
            await API.bills.delete(pendingDeleteBillId);
            showNotification("Deleted", "success");
            if (typeof loadTenantHistory === 'function') {
                showSection('tenants-section');
                switchSubSection('tenants-section', 'tenants-ledger');
                loadTenantHistory(pendingDeleteBillRenterId);
            }
            pendingDeleteBillId = null;
        }
        
        closeDeleteModal();
        if (typeof loadManageTenants === 'function') loadManageTenants();
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } catch (e) {
        showNotification(e.message || "Authorization failed", "error");
    }
}

function closeDeleteModal() {
    const modal = document.getElementById('deletePinModal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    // Clean up globals from other modules if they exist
    if (typeof pendingDeleteId !== 'undefined') pendingDeleteId = null;
    if (typeof pendingDeleteBillId !== 'undefined') pendingDeleteBillId = null;
}

// --- UX Enhancements: Global Keyboard Listeners ---
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        // Close any visible modal overlays
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
            // Don't close pinOverlay if it's the mandatory one (optional logic)
            if (modal.id === 'pinOverlay' && !localStorage.getItem('isLoggedIn')) return;
            modal.classList.add('hidden');
        });
        
        // Cleanup specific modal states if needed
        if (typeof closeSettlementModal === 'function') closeSettlementModal();
        if (typeof closePaymentModal === 'function') closePaymentModal();
        if (typeof closeShareModal === 'function') closeShareModal();
        if (typeof closeTaskModal === 'function') closeTaskModal();
        if (typeof toggleTaskForm === 'function' && !document.getElementById('createTaskModal').classList.contains('hidden')) toggleTaskForm();
        if (typeof toggleUploadForm === 'function' && !document.getElementById('uploadModal').classList.contains('hidden')) toggleUploadForm();
    }
});
