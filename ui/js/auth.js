let currentPin = "";

async function checkAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
        showOverlay(true);
        return false;
    } else {
        showOverlay(false);
        const hash = window.location.hash.replace('#', '');
        const validSections = ['dashboard-section', 'tenants-section', 'owners-section', 'settings-section'];
        if (hash && validSections.includes(hash)) {
            showSection(hash);
        } else {
            showSection('dashboard-section');
        }
        return true;
    }
}

function showOverlay(show) {
    const overlay = document.getElementById('pinOverlay');
    const mainApp = document.getElementById('mainApp');
    if (!overlay || !mainApp) return;
    if (show) {
        overlay.classList.remove('hidden');
        mainApp.classList.add('hidden');
    } else {
        overlay.classList.add('hidden');
        mainApp.classList.remove('hidden');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function pressKey(key) {
    const input = document.getElementById('adminPasswordInput');
    if (!input) return;
    if (key === 'back') {
        input.value = input.value.slice(0, -1);
    } else {
        input.value += key;
    }
}

function toggleAdminPasswordVisibility() {
    const input = document.getElementById('adminPasswordInput');
    const eyeIcon = document.getElementById('adminEyeIcon');
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

async function verifyPin() {
    const input = document.getElementById('adminPasswordInput');
    if (!input) return;
    const password = input.value;
    if (!password) return showNotification("PIN or Password required", "error");

    try {
        const res = await API.auth.verify(password);
        localStorage.setItem('isLoggedIn', 'true');
        localStorage.setItem('userRole', res.role || 'owner');
        location.reload(); // Hard reload after login to ensure session cookie is sent correctly
    } catch (e) {
        showNotification(e.message || "Invalid credentials", "error");
        input.value = "";
    }
}

async function forgotPin() {
    if (!confirm("Reset PIN and send to email?")) return;
    showNotification("Processing...", "info");
    try {
        await API.auth.forgotPin();
        showNotification("Temporary PIN sent", "success");
    } catch (e) {
        showNotification(e.message, "error");
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
