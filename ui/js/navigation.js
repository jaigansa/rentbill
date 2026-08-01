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
    const auditSection = document.getElementById('settings-audit');
    if (auditSection) {
        auditSection.scrollIntoView({ behavior: 'smooth' });
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

// --- NEW USER ONBOARDING GUIDE ---
let currentOnboardingStep = 0;

const onboardingSteps = [
    {
        title: "Step 1: Setup Bank & UPI Accounts",
        icon: "wallet",
        desc: "Before registering tenants or generating bills, configure your property receiving accounts (UPI ID / Bank details). This assigns payments to correct property accounts.",
        actionText: "Configure Receiving Accounts",
        actionFn: () => {
            closeOnboardingModal();
            showSection('owners-section', 'owners-accounts');
        }
    },
    {
        title: "Step 2: Register Units & Tenants",
        icon: "users",
        desc: "Add your active tenants with Room Number, Base Rent, Move-in Date, and 11-Month Expiry. Choose between Fixed Rate Water (e.g. ₹200/mo flat) or Water Meter Unit Calculation.",
        actionText: "Register First Unit / Tenant",
        actionFn: () => {
            closeOnboardingModal();
            showSection('tenants-section', 'tenants-registry');
            if (document.getElementById('entrance-form')?.classList.contains('hidden')) {
                toggleRegForm();
            }
        }
    },
    {
        title: "Step 3: Generate Monthly Bills & Batch Billing",
        icon: "zap",
        desc: "Create individual bills or use 1-Click Batch Billing to generate invoices for all occupied units simultaneously with automatic EB and Water meter unit mathematics.",
        actionText: "Open Batch Billing Grid",
        actionFn: () => {
            closeOnboardingModal();
            if (typeof openBatchBillingModal === 'function') openBatchBillingModal();
        }
    },
    {
        title: "Step 4: Verify Payment Proofs & WhatsApp Reminders",
        icon: "check-square",
        desc: "Tenants can upload UPI payment screenshots from their portal. Review UTR transaction numbers directly on your Admin Dashboard with 1-click Approve/Reject actions, or send 1-click WhatsApp reminders.",
        actionText: "Go to Admin Dashboard",
        actionFn: () => {
            closeOnboardingModal();
            showSection('dashboard-section');
        }
    },
    {
        title: "Step 5: 11-Month Lease Agreement Renewal",
        icon: "file-clock",
        desc: "The app automatically monitors 11-month rental agreements expiring within 30 days. Extend lease validity by 11 months anytime with 1 click.",
        actionText: "View Expiring Agreements",
        actionFn: () => {
            closeOnboardingModal();
            showSection('dashboard-section');
            document.getElementById('cardLeaseExpiries')?.scrollIntoView({ behavior: 'smooth' });
        }
    }
];

function openOnboardingModal(step = 0) {
    currentOnboardingStep = step;
    const modal = document.getElementById('onboardingOverlay');
    if (modal) {
        modal.classList.remove('hidden');
        renderOnboardingStep(currentOnboardingStep);
    }
}

function closeOnboardingModal() {
    const modal = document.getElementById('onboardingOverlay');
    if (modal) modal.classList.add('hidden');
    localStorage.setItem('rentbill_onboarded', 'true');
}

function renderOnboardingStep(index) {
    currentOnboardingStep = index;
    const step = onboardingSteps[index];
    const body = document.getElementById('onboardingStepBody');
    const counter = document.getElementById('onboardStepCounter');
    const prevBtn = document.getElementById('btnOnboardPrev');
    const nextBtn = document.getElementById('btnOnboardNext');

    if (counter) counter.innerText = `Step ${index + 1} of ${onboardingSteps.length}`;
    if (prevBtn) prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
    if (nextBtn) nextBtn.innerText = index === onboardingSteps.length - 1 ? 'Finish Tour' : 'Next';

    for (let i = 0; i < onboardingSteps.length; i++) {
        const pill = document.getElementById(`onboardPill-${i}`);
        if (pill) {
            if (i === index) {
                pill.style.background = 'var(--primary)';
                pill.style.color = 'white';
                pill.style.borderColor = 'var(--primary)';
            } else {
                pill.style.background = 'var(--bg-card)';
                pill.style.color = 'var(--text-main)';
                pill.style.borderColor = 'var(--border)';
            }
        }
    }

    if (body) {
        body.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 44px; height: 44px; background: var(--primary-light); color: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i data-lucide="${step.icon}" style="width: 24px; height: 24px;"></i>
                    </div>
                    <h4 style="font-size: 1.05rem; font-weight: 900; color: var(--text-main); margin: 0;">${step.title}</h4>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin: 0;">${step.desc}</p>
                <div style="margin-top: 0.5rem; width: 100%;">
                    <button onclick="onboardingSteps[${index}].actionFn()" class="btn btn-primary" style="width: 100%; height: 44px; border-radius: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i data-lucide="arrow-right-circle" style="width: 18px; height: 18px;"></i> ${step.actionText}
                    </button>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function onboardingNextStep() {
    if (currentOnboardingStep < onboardingSteps.length - 1) {
        renderOnboardingStep(currentOnboardingStep + 1);
    } else {
        closeOnboardingModal();
    }
}

function onboardingPrevStep() {
    if (currentOnboardingStep > 0) {
        renderOnboardingStep(currentOnboardingStep - 1);
    }
}
