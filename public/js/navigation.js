function showSection(sectionId) {
    window.location.hash = sectionId;
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.remove('hidden');
    }

    // Sync Navigation States
    document.querySelectorAll('.nav-btn, .bnav-item').forEach(btn => {
        const oc = btn.getAttribute('onclick');
        const isActive = oc && oc.includes(sectionId);
        btn.classList.toggle('active', isActive);
    });

    // Trigger domain-specific loads
    if (sectionId === 'tenantListContainer') {
        loadDashboardStats();
        loadActivityLogs();
    }
    if (sectionId === 'settings-section') {
        loadSystemSettings();
        loadManageTenants();
        loadExpenses();
        if (typeof loadWithdrawals === 'function') loadWithdrawals();
    }
    if (sectionId === 'billing-module') {
        loadTenants();
    }
    if (sectionId === 'history-section') {
        initHistorySection(true);
    }
    lucide.createIcons();
}
