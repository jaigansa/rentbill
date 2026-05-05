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

    // Trigger domain-specific loads for main sections
    if (sectionId === 'dashboard-section') {
        loadDashboardStats();
        loadActivityLogs();
    }
    
    // Auto-switch to first sub-section if not already visible
    if (target) {
        const visibleSub = target.querySelector('.sub-section:not(.hidden)');
        if (!visibleSub) {
            const firstSub = target.querySelector('.sub-section');
            if (firstSub) {
                switchSubSection(sectionId, firstSub.id);
            }
        }
    }

    lucide.createIcons();
}

function switchSubSection(parentSectionId, subSectionId) {
    const parent = document.getElementById(parentSectionId);
    if (!parent) return;
    
    // Hide all sub-sections in this parent
    parent.querySelectorAll('.sub-section').forEach(ss => ss.classList.add('hidden'));
    
    // Show the target sub-section
    const target = document.getElementById(subSectionId);
    if (target) target.classList.remove('hidden');
    
    // Update sub-nav button states
    parent.querySelectorAll('.sub-nav-btn').forEach(btn => {
        const oc = btn.getAttribute('onclick');
        const isActive = oc && oc.includes(subSectionId);
        btn.classList.toggle('active', isActive);
    });
    
    // Specific triggers for sub-sections
    if (subSectionId === 'tenants-billing') {
        loadTenants();
    }
    if (subSectionId === 'tenants-directory') {
        loadManageTenants();
    }
    if (subSectionId === 'tenants-statements') {
        initHistorySection(true);
    }
    if (subSectionId === 'tenants-archived') {
        if (typeof toggleHistory === 'function') toggleHistory(true);
    }
    if (subSectionId === 'tenants-vault') {
        if (typeof loadVault === 'function') loadVault();
    }
    
    if (subSectionId === 'owners-payouts') {
        if (typeof populateWithdrawalFilters === 'function') populateWithdrawalFilters();
        if (typeof loadWithdrawals === 'function') loadWithdrawals();
    }
    if (subSectionId === 'owners-accounts') {
        loadSystemSettings(); // This loads receiving accounts
    }
    if (subSectionId === 'owners-settlements') {
        loadDashboardStats(); // This loads owner settlement list
    }
    
    if (subSectionId === 'settings-config') {
        loadSystemSettings();
    }
    if (subSectionId === 'settings-expenses') {
        loadExpenses();
    }
    if (subSectionId === 'settings-maintenance') {
        if (typeof loadTasks === 'function') loadTasks();
    }
    
    lucide.createIcons();
}

function quickRegisterTenant() {
    showSection('tenants-section');
    switchSubSection('tenants-section', 'tenants-directory');
    const form = document.getElementById('entrance-form');
    if (form && form.classList.contains('hidden')) {
        toggleRegForm();
    }
    document.getElementById('entrance-form').scrollIntoView({ behavior: 'smooth' });
}

function quickRecordPayout() {
    showSection('owners-section');
    switchSubSection('owners-section', 'owners-payouts');
    const form = document.getElementById('withdrawal-form');
    if (form && form.classList.contains('hidden')) {
        toggleWithdrawalForm();
    }
    document.getElementById('withdrawal-form').scrollIntoView({ behavior: 'smooth' });
}

function quickAddExpense() {
    showSection('settings-section');
    switchSubSection('settings-section', 'settings-expenses');
    const form = document.getElementById('expense-form');
    if (form && form.classList.contains('hidden')) {
        toggleExpenseForm();
    }
    document.getElementById('expense-form').scrollIntoView({ behavior: 'smooth' });
}

function quickGenerateAudit() {
    showSection('settings-section');
    switchSubSection('settings-section', 'settings-audit');
    const auditCard = document.querySelector('#auditMonth').closest('.card');
    if (auditCard) {
        auditCard.scrollIntoView({ behavior: 'smooth' });
    }
}

function quickPay(renterId, billId, amount) {
    if (billId) {
        showSection('tenants-section');
        switchSubSection('tenants-section', 'tenants-statements');
        loadTenantHistory(renterId);
        setTimeout(() => {
            if (typeof openHistoryPaymentModal === 'function') {
                openHistoryPaymentModal(billId, amount);
            }
        }, 300);
    } else {
        showSection('tenants-section');
        switchSubSection('tenants-section', 'tenants-statements');
        loadTenantHistory(renterId);
    }
}
