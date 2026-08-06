let currentPin = "";

async function checkAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
        showOverlay(true);
        return false;
    } else {
        showOverlay(false);
        const hash = window.location.hash.replace('#', '');
        const validSections = ['dashboard-section', 'tenants-section', 'owners-section', 'property-section', 'settings-section'];
        if (hash && validSections.includes(hash)) {
            showSection(hash);
        } else {
            showSection('dashboard-section');
        }
        return true;
    }
}

async function showOverlay(show) {
    const overlay = document.getElementById('pinOverlay');
    const mainApp = document.getElementById('mainApp');
    if (!overlay || !mainApp) return;

    if (show) {
        overlay.classList.remove('hidden');
        mainApp.classList.add('hidden');

        try {
            const status = await API.auth.getSetupStatus();
            if (status && !status.is_configured) {
                showFirstTimeSetupView();
                return;
            }
        } catch (e) {
            console.warn("Could not check setup status", e);
        }

        setTimeout(() => {
            switchLoginTab('admin');
        }, 50);
    } else {
        overlay.classList.add('hidden');
        mainApp.classList.remove('hidden');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showFirstTimeSetupView() {
    const tabsContainer = document.getElementById('loginTabs');
    const setupForm = document.getElementById('firstTimeSetupForm');
    const adminForm = document.getElementById('adminPinLoginForm');
    const tenantForm = document.getElementById('tenantLoginForm');
    const recoveryContainer = document.getElementById('recoveryContainer');
    const subtitle = document.getElementById('loginSubtitle');

    if (tabsContainer) tabsContainer.classList.add('hidden');
    if (adminForm) adminForm.classList.add('hidden');
    if (tenantForm) tenantForm.classList.add('hidden');
    if (recoveryContainer) recoveryContainer.classList.add('hidden');
    if (setupForm) setupForm.classList.remove('hidden');
    if (subtitle) {
        subtitle.innerText = "First-Time Admin Account & Gmail Setup";
        subtitle.style.color = "var(--primary)";
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function submitFirstTimeSetup() {
    const gmail = document.getElementById('setupAdminGmail')?.value.trim();
    const password = document.getElementById('setupAdminPassword')?.value;
    const app_password = document.getElementById('setupGmailAppPass')?.value.trim();
    const property_name = document.getElementById('setupPropName')?.value.trim();

    if (!gmail || !gmail.includes('@')) {
        return showNotification("Please enter a valid Admin Gmail address", "error");
    }
    if (!password) {
        return showNotification("Admin Master Password is required", "error");
    }

    try {
        const res = await API.auth.completeSetup({ gmail, password, app_password, property_name });
        showNotification(res.message || "First-time setup completed successfully!", "success");
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', 'owner');
        location.reload();
    } catch (e) {
        showNotification(e.message || "Failed to complete setup", "error");
    }
}

let activeRecoveryMode = 'admin';

function toggleAdminPasswordVisibility() {
    toggleInputVisibility('adminPasswordInput', 'adminEyeIcon');
}

function toggleTenantPasswordVisibility() {
    toggleInputVisibility('tenantMobileInput', 'tenantEyeIcon');
}

function toggleInputVisibility(inputId, eyeIconId) {
    const input = document.getElementById(inputId);
    const eyeIcon = document.getElementById(eyeIconId);
    if (!input || !eyeIcon) return;

    if (input.type === 'password') {
        input.type = 'text';
        eyeIcon.setAttribute('data-lucide', 'eye-off');
    } else {
        input.type = 'password';
        eyeIcon.setAttribute('data-lucide', 'eye');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* Unified Tab Swapping Logic */
function switchLoginTab(mode) {
    const tabAdmin = document.getElementById('tab-admin');
    const tabTenant = document.getElementById('tab-tenant');
    const adminForm = document.getElementById('adminPinLoginForm');
    const tenantForm = document.getElementById('tenantLoginForm');
    const recoveryContainer = document.getElementById('recoveryContainer');
    
    const brandIcon = document.getElementById('loginBrandIcon');
    const subtitle = document.getElementById('loginSubtitle');
    const tabsContainer = document.getElementById('loginTabs');

    if (!adminForm || !tenantForm) return;

    // Reset forms & recovery view
    if (recoveryContainer) recoveryContainer.classList.add('hidden');
    if (tabsContainer) tabsContainer.classList.remove('hidden');

    const adminInput = document.getElementById('adminPasswordInput');
    const tenantRoom = document.getElementById('tenantRoomInput');
    const tenantMobile = document.getElementById('tenantMobileInput');
    if (adminInput) adminInput.value = "";
    if (tenantRoom) tenantRoom.value = "";
    if (tenantMobile) tenantMobile.value = "";

    if (mode === 'admin') {
        // Tab buttons
        if (tabAdmin) tabAdmin.classList.add('active');
        if (tabTenant) tabTenant.classList.remove('active');
        
        // Form visibility
        adminForm.classList.remove('hidden');
        tenantForm.classList.add('hidden');

        // Brand styling
        if (brandIcon) {
            brandIcon.className = "login-brand-icon";
            brandIcon.innerHTML = `<i data-lucide="building-2" style="width: 28px; height: 28px;"></i>`;
        }
        if (subtitle) {
            subtitle.innerText = "Authorized Access Only";
            subtitle.style.color = "var(--text-muted)";
        }
    } else {
        // Tab buttons
        if (tabAdmin) tabAdmin.classList.remove('active');
        if (tabTenant) tabTenant.classList.add('active');
        
        // Form visibility
        adminForm.classList.add('hidden');
        tenantForm.classList.remove('hidden');

        // Brand styling
        if (brandIcon) {
            brandIcon.className = "login-brand-icon tenant";
            brandIcon.innerHTML = `<i data-lucide="key" style="width: 28px; height: 28px;"></i>`;
        }
        if (subtitle) {
            subtitle.innerText = "Tenant Access Portal";
            subtitle.style.color = "var(--success)";
        }
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* Recovery Wizard Logic */
function showRecoveryFlow(mode = 'admin') {
    activeRecoveryMode = mode;
    const adminForm = document.getElementById('adminPinLoginForm');
    const tenantForm = document.getElementById('tenantLoginForm');
    const tabsContainer = document.getElementById('loginTabs');
    const recoveryContainer = document.getElementById('recoveryContainer');
    const subtitle = document.getElementById('loginSubtitle');
    const tenantInputs = document.getElementById('tenantRecoveryInputs');
    const recTitle = document.getElementById('recoveryTitle');
    const recDesc = document.getElementById('recoveryDesc');
    const recEmailSub = document.getElementById('recoveryEmailSub');

    if (adminForm) adminForm.classList.add('hidden');
    if (tenantForm) tenantForm.classList.add('hidden');
    if (tabsContainer) tabsContainer.classList.add('hidden');
    if (recoveryContainer) recoveryContainer.classList.remove('hidden');
    if (subtitle) subtitle.innerText = mode === 'tenant' ? "Tenant Password Recovery" : "Admin Security & Recovery";

    if (mode === 'tenant') {
        if (tenantInputs) tenantInputs.classList.remove('hidden');
        if (recTitle) recTitle.innerText = "Tenant Password Reset";
        if (recDesc) recDesc.innerText = "Enter your Unit Number & Mobile/Email to receive a password reset mail.";
        if (recEmailSub) recEmailSub.innerText = "Emails a temporary password to tenant's registered email.";

        // Pre-fill from tenant form if typed
        const tenantRoom = document.getElementById('tenantRoomInput');
        const tenantMobile = document.getElementById('tenantMobileInput');
        const recRoom = document.getElementById('recRoomInput');
        const recMobile = document.getElementById('recMobileInput');
        if (tenantRoom && recRoom && tenantRoom.value) recRoom.value = tenantRoom.value;
        if (tenantMobile && recMobile && tenantMobile.value) recMobile.value = tenantMobile.value;
    } else {
        if (tenantInputs) tenantInputs.classList.add('hidden');
        if (recTitle) recTitle.innerText = "Admin Password Reset";
        if (recDesc) recDesc.innerText = "Generates a temporary admin password and emails it to the registered owner mail.";
        if (recEmailSub) recEmailSub.innerText = "Generates a temporary password and emails it to registered admin address.";
    }

    showRecoveryOptions();
}

function hideRecoveryFlow() {
    const recoveryContainer = document.getElementById('recoveryContainer');
    if (recoveryContainer) recoveryContainer.classList.add('hidden');
    switchLoginTab(activeRecoveryMode);
}

function showRecoveryOptions() {
    const form = document.getElementById('recoveryForm');
    const loader = document.getElementById('recoveryLoader');
    const success = document.getElementById('recoverySuccess');
    const support = document.getElementById('recoverySupport');

    if (form) form.classList.remove('hidden');
    if (loader) loader.classList.add('hidden');
    if (success) success.classList.add('hidden');
    if (support) support.classList.add('hidden');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

async function sendRecoveryEmail() {
    const form = document.getElementById('recoveryForm');
    const loader = document.getElementById('recoveryLoader');
    const success = document.getElementById('recoverySuccess');
    const support = document.getElementById('recoverySupport');

    let payload = { role: activeRecoveryMode };

    if (activeRecoveryMode === 'tenant') {
        const recRoom = document.getElementById('recRoomInput');
        const recMobile = document.getElementById('recMobileInput');
        const roomVal = recRoom ? recRoom.value.trim() : '';
        const mobileVal = recMobile ? recMobile.value.trim() : '';

        if (!roomVal && !mobileVal) {
            return showNotification("Please enter Unit Number or Mobile/Email", "error");
        }
        payload.room_no = roomVal;
        if (mobileVal.includes('@')) {
            payload.email = mobileVal;
        } else {
            payload.mobile = mobileVal;
        }
    }

    if (form) form.classList.add('hidden');
    if (loader) loader.classList.remove('hidden');

    try {
        const res = await API.auth.forgotPin(payload);
        
        // Success transition
        if (loader) loader.classList.add('hidden');
        if (success) {
            const successDesc = success.querySelector('.status-desc');
            if (successDesc && res && res.message) {
                successDesc.innerText = res.message;
            }
            success.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Forgot Password API failed:", e);
        
        if (loader) loader.classList.add('hidden');
        if (support) {
            const supportDesc = support.querySelector('.status-desc');
            if (supportDesc && e.message) {
                supportDesc.innerText = e.message;
            }
            support.classList.remove('hidden');
        }
        
        prepareSupportMailto();
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function showSupportRequestForm() {
    const form = document.getElementById('recoveryForm');
    const support = document.getElementById('recoverySupport');

    if (form) form.classList.add('hidden');
    if (support) support.classList.remove('hidden');

    prepareSupportMailto();
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function prepareSupportMailto() {
    const mailtoBtn = document.getElementById('btnSendSupportMail');
    if (!mailtoBtn) return;
    
    const origin = window.location.origin;
    const subject = encodeURIComponent("RentBill Pro - Admin Password Recovery Request");
    const body = encodeURIComponent(
        "Hello RentBill Support,\n\n" +
        "I am the administrator of a RentBill Pro system and I have lost access to my admin account (PIN/password reset failed).\n\n" +
        "System Details:\n" +
        "- Server Origin: " + origin + "\n" +
        "- Browser User Agent: " + navigator.userAgent + "\n\n" +
        "Please assist me in resetting my administrator credentials."
    );
    mailtoBtn.onclick = () => {
        window.location.href = `mailto:support@rentbill.pro?subject=${subject}&body=${body}`;
    };
}

async function verifyPin() {
    const usernameInput = document.getElementById('adminUsernameInput');
    const passwordInput = document.getElementById('adminPasswordInput');

    const username = usernameInput ? usernameInput.value.trim() : '';
    const pin = passwordInput ? passwordInput.value : '';

    if (!pin) return showNotification("Admin Password required", "error");

    try {
        const res = await API.auth.verify({ username, pin });
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', res.role || 'owner');
        location.reload();
    } catch (e) {
        showNotification(e.message || "Invalid Admin Username or Password", "error");
        if (passwordInput) passwordInput.value = "";
    }
}

async function logout() {
    try {
        await API.auth.logout();
    } catch (e) {
        console.warn("Server logout failed", e);
    }
    localStorage.removeItem('isLoggedIn');
    location.reload();
}
