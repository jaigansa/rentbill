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

function injectTemplates() {
    document.getElementById('pinOverlay').innerHTML = Templates.authOverlay;
    document.getElementById('modalContainer').innerHTML = Templates.modals;
    const mainApp = document.getElementById('mainApp');
    mainApp.innerHTML = `
        ${Templates.navigation}
        <main class="content">
            ${Templates.dashboard}
            ${Templates.billing}
            ${Templates.history}
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
            showSection('billing-module');
            pendingDeleteId = null;
        } else if (typeof pendingDeleteBillId !== 'undefined' && pendingDeleteBillId) {
            await API.bills.delete(pendingDeleteBillId);
            showNotification("Deleted", "success");
            if (typeof viewHistory === 'function') viewHistory(pendingDeleteBillRenterId);
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
    // Clean up globals from other modules if they exist
    if (typeof pendingDeleteId !== 'undefined') pendingDeleteId = null;
    if (typeof pendingDeleteBillId !== 'undefined') pendingDeleteBillId = null;
}
