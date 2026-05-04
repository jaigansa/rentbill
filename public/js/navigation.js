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

function quickRegisterTenant() {
    showSection('settings-section');
    const form = document.getElementById('entrance-form');
    if (form && form.classList.contains('hidden')) {
        toggleRegForm();
    }
    document.getElementById('entrance-form').scrollIntoView({ behavior: 'smooth' });
}

function quickRecordPayout() {
    showSection('history-section');
    if (typeof toggleHistoryMode === 'function') {
        toggleHistoryMode('owners');
    }
    const form = document.getElementById('withdrawal-form');
    if (form && form.classList.contains('hidden')) {
        toggleWithdrawalForm();
    }
    document.getElementById('withdrawal-form').scrollIntoView({ behavior: 'smooth' });
}

function quickAddExpense() {
    showSection('settings-section');
    const form = document.getElementById('expense-form');
    if (form && form.classList.contains('hidden')) {
        toggleExpenseForm();
    }
    document.getElementById('expense-form').scrollIntoView({ behavior: 'smooth' });
}

function quickGenerateAudit() {
    showSection('settings-section');
    const auditCard = document.querySelector('#auditMonth').closest('.card');
    if (auditCard) {
        auditCard.scrollIntoView({ behavior: 'smooth' });
    }
}

function quickPay(renterId, billId, amount) {
    if (billId) {
        // If it's a specific bill, open payment modal
        if (typeof openHistoryPaymentModal === 'function') {
            // We need to ensure history section is initialized or at least appSettings is loaded
            showSection('history-section');
            loadTenantHistory(renterId);
            setTimeout(() => {
                openHistoryPaymentModal(billId, amount);
            }, 300);
        }
    } else {
        // Just go to history
        showSection('history-section');
        loadTenantHistory(renterId);
    }
}
