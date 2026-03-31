let currentPin = "";

async function checkAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
        showOverlay(true);
        return false;
    } else {
        showOverlay(false);
        const hash = window.location.hash.replace('#', '');
        const validSections = ['tenantListContainer', 'billing-module', 'history-section', 'settings-section'];
        if (hash && validSections.includes(hash)) {
            showSection(hash);
        } else {
            showSection('tenantListContainer');
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
    lucide.createIcons();
}

function pressKey(key) {
    if (key === 'back') currentPin = currentPin.slice(0, -1);
    else if (currentPin.length < 4) currentPin += key;
    updatePinDots();
    if (currentPin.length === 4) setTimeout(verifyPin, 200);
}

function updatePinDots() {
    document.querySelectorAll('.pin-dots .dot').forEach((dot, i) => dot.classList.toggle('active', i < currentPin.length));
}

async function verifyPin() {
    try {
        await API.auth.verify(currentPin);
        localStorage.setItem('isLoggedIn', 'true');
        showOverlay(false);
        showSection('tenantListContainer');
    } catch (e) {
        showNotification("Wrong PIN", "error");
    }
    currentPin = "";
    updatePinDots();
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

function logout() {
    localStorage.removeItem('isLoggedIn');
    location.reload();
}
