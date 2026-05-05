// --- Rent Bill Pro: Main Entry & Global State ---

let appSettings = {};
let editMode = false;
let editId = null;

// --- Initialization ---
window.onload = async () => {
    injectTemplates();
    applyTheme();
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        await loadSettings();
    }
    lucide.createIcons();
    registerServiceWorker();
};

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
            switchSubSection('tenants-section', 'tenants-billing');
            pendingDeleteId = null;
        } else if (typeof pendingDeleteBillId !== 'undefined' && pendingDeleteBillId) {
            await API.bills.delete(pendingDeleteBillId);
            showNotification("Deleted", "success");
            if (typeof loadTenantHistory === 'function') {
                showSection('tenants-section');
                switchSubSection('tenants-section', 'tenants-statements');
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
