const AppRouter = {
    sections: {
        'dashboard-section': () => {
            loadDashboardStats();
        },
        'tenants-section': (sub) => {
            const defaultSub = sub || 'tenants-billing';
            switchSubSection('tenants-section', defaultSub);
        },
        'owners-section': (sub) => {
            const defaultSub = sub || 'owners-received';
            switchSubSection('owners-section', defaultSub);
        },
        'settings-section': (sub) => {
            const defaultSub = sub || 'settings-config';
            switchSubSection('settings-section', defaultSub);
        }
    },
    subSections: {
        'owners-received': () => {
            if (typeof loadReceivedPayments === 'function') loadReceivedPayments();
        },
        'tenants-billing': () => {
            loadTenants();
        },
        'tenants-ledger': () => {
            initHistorySection(false);
        },
        'tenants-registry': () => {
            loadSettings();
            loadManageTenants();
            if (typeof loadVault === 'function') loadVault();
        },
        'tenants-archived': () => {
            if (typeof toggleHistory === 'function') toggleHistory(true);
        },
        'owners-payouts': () => {
            if (typeof populateWithdrawalFilters === 'function') populateWithdrawalFilters();
            if (typeof loadWithdrawals === 'function') loadWithdrawals();
        },
        'owners-accounts': () => {
            loadSettings();
        },
        'settings-config': () => {
            loadSettings();
        },
        'settings-expenses': () => {
            loadExpenses();
        },
        'settings-maintenance': () => {
            if (typeof loadTasks === 'function') loadTasks();
        }
    }
};

function showSection(sectionId, subSectionId = null) {
    window.location.hash = sectionId;
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.remove('hidden');
        if (AppRouter.sections[sectionId]) {
            AppRouter.sections[sectionId](subSectionId);
        }
    }

    // Sync Navigation UI
    document.querySelectorAll('.nav-btn, .bnav-item').forEach(btn => {
        const oc = btn.getAttribute('onclick');
        const isActive = oc && oc.includes(sectionId);
        btn.classList.toggle('active', isActive);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function switchSubSection(parentSectionId, subSectionId) {
    const parent = document.getElementById(parentSectionId);
    if (!parent) return;
    
    parent.querySelectorAll('.sub-section').forEach(ss => ss.classList.add('hidden'));
    
    const target = document.getElementById(subSectionId);
    if (target) {
        target.classList.remove('hidden');
        if (AppRouter.subSections[subSectionId]) {
            AppRouter.subSections[subSectionId]();
        }
    }
    
    parent.querySelectorAll('.sub-nav-btn').forEach(btn => {
        const oc = btn.getAttribute('onclick');
        const isActive = oc && oc.includes(subSectionId);
        btn.classList.toggle('active', isActive);
    });
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function quickRegisterTenant() {
    showSection('tenants-section');
    switchSubSection('tenants-section', 'tenants-registry');
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

function quickDownloadBackup() {
    if (typeof backupDatabase === 'function') {
        backupDatabase();
    } else {
        showSection('settings-section');
        switchSubSection('settings-section', 'settings-database');
    }
}

function quickPay(renterId, billId, amount) {
    if (billId) {
        showSection('tenants-section');
        switchSubSection('tenants-section', 'tenants-ledger');
        loadTenantHistory(renterId);
        setTimeout(() => {
            if (typeof openHistoryPaymentModal === 'function') {
                openHistoryPaymentModal(billId, amount);
            }
        }, 300);
    } else {
        showSection('tenants-section');
        switchSubSection('tenants-section', 'tenants-ledger');
        loadTenantHistory(renterId);
    }
}
