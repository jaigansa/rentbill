// App Security & 4-Digit PIN Lock Controller

export const Auth = {
  bindAppLock() {
    // Quick lock button in top navigation bar
    const btnLock = document.getElementById('btn-lock-app');
    if (btnLock) {
      btnLock.addEventListener('click', () => {
        this.lockApp(true);
      });
    }

    // Keypad button listeners
    document.querySelectorAll('.pin-key').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const key = btn.getAttribute('data-key');
        this.handlePinKeypad(key);
      });
    });

    // Physical keyboard listener for desktop & laptop users
    window.addEventListener('keydown', (e) => {
      if (!this.isAppLocked) return;
      if (e.key >= '0' && e.key <= '9') {
        this.handlePinKeypad(e.key);
      } else if (e.key === 'Backspace') {
        this.handlePinKeypad('backspace');
      } else if (e.key === 'Escape' || e.key.toLowerCase() === 'c') {
        this.handlePinKeypad('clear');
      }
    });

    // Auto-lock when user leaves browser tab or locks screen (if away > 45 seconds)
    let backgroundTime = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        backgroundTime = Date.now();
      } else if (document.visibilityState === 'visible') {
        if (this.isPINEnabled && !this.isAppLocked && backgroundTime > 0) {
          const elapsed = (Date.now() - backgroundTime) / 1000;
          if (elapsed >= 45) { // Auto-lock after 45 seconds in background
            this.lockApp(true);
          }
        }
      }
    });

    this.bindPINSettings();
  },

  async checkAuthStatus() {
    try {
      const status = await API.getAuthStatus();
      this.isPINEnabled = !!status.pin_enabled;
      this.updatePINStatusUI(this.isPINEnabled);

      if (this.isPINEnabled) {
        if (!status.authenticated) {
          this.lockApp(false);
        } else {
          sessionStorage.setItem('rb_unlocked', 'true');
        }
      }
    } catch (e) {
      console.error('Failed checking PIN status:', e);
    }
  },

  updatePINStatusUI(enabled) {
    const btnLock = document.getElementById('btn-lock-app');
    const statusText = document.getElementById('pin-status-text');
    const statusBadge = document.getElementById('pin-status-badge');
    const btnOpenSetup = document.getElementById('btn-open-pin-setup');
    const btnDisable = document.getElementById('btn-disable-pin');
    const icon = document.getElementById('pin-status-icon');

    if (btnLock) {
      btnLock.style.display = enabled ? 'inline-flex' : 'none';
    }

    if (statusBadge) {
      statusBadge.textContent = enabled ? 'ACTIVE' : 'OFF';
      statusBadge.style.background = enabled ? 'var(--success-light)' : '#e2e8f0';
      statusBadge.style.color = enabled ? 'var(--success)' : '#475569';
    }

    if (statusText) {
      statusText.textContent = enabled ? 'PIN Lock: Active (Protected)' : 'PIN Lock: Disabled';
    }

    if (icon) {
      icon.style.color = enabled ? 'var(--success)' : 'var(--text-muted)';
    }

    if (btnOpenSetup) {
      btnOpenSetup.innerHTML = enabled
        ? '<i data-lucide="key-round"></i> Change 4-Digit PIN'
        : '<i data-lucide="key-round"></i> Set Up 4-Digit PIN';
    }

    if (btnDisable) {
      btnDisable.style.display = enabled ? 'inline-flex' : 'none';
    }

    this.refreshIcons();
  },

  async lockApp(explicitLogout = false) {
    if (!this.isPINEnabled) return;
    this.isAppLocked = true;
    this.enteredPIN = '';
    sessionStorage.removeItem('rb_unlocked');
    if (explicitLogout) {
      await API.logout();
    }
    this.renderPinDots();

    const overlay = document.getElementById('app-lock-screen');
    const sub = document.getElementById('lock-screen-subtitle');
    if (sub) {
      sub.textContent = 'Enter 4-Digit PIN to unlock';
      sub.style.color = 'var(--text-muted)';
    }
    if (overlay) {
      overlay.style.display = 'flex';
    }
    this.refreshIcons();
  },

  unlockApp() {
    this.isAppLocked = false;
    this.enteredPIN = '';
    sessionStorage.setItem('rb_unlocked', 'true');
    const overlay = document.getElementById('app-lock-screen');
    if (overlay) {
      overlay.style.display = 'none';
    }
  },

  handlePinKeypad(key) {
    if (!this.isAppLocked || this.isVerifyingPIN) return;

    if (key === 'clear') {
      this.enteredPIN = '';
      this.renderPinDots();
      return;
    }

    if (key === 'backspace') {
      this.enteredPIN = this.enteredPIN.slice(0, -1);
      this.renderPinDots();
      return;
    }

    if (key >= '0' && key <= '9' && this.enteredPIN.length < 4) {
      this.enteredPIN += key;
      this.renderPinDots();

      if (this.enteredPIN.length === 4) {
        this.verifyPINSubmission();
      }
    }
  },

  renderPinDots() {
    const dots = document.querySelectorAll('#lock-pin-dots .pin-dot');
    const len = this.enteredPIN.length;
    dots.forEach((dot, idx) => {
      if (idx < len) {
        dot.classList.add('filled');
      } else {
        dot.classList.remove('filled');
      }
    });
  },

  async verifyPINSubmission() {
    this.isVerifyingPIN = true;
    try {
      await API.verifyPIN(this.enteredPIN);
      if (navigator.vibrate) navigator.vibrate(40);
      this.unlockApp();
      this.toast('App Unlocked!');
    } catch (err) {
      if (navigator.vibrate) navigator.vibrate([60, 40, 60]);
      const dotsWrapper = document.getElementById('lock-pin-dots');
      const sub = document.getElementById('lock-screen-subtitle');
      if (dotsWrapper) dotsWrapper.classList.add('shake');
      if (sub) {
        sub.textContent = 'Incorrect PIN. Try again.';
        sub.style.color = 'var(--danger)';
      }

      setTimeout(() => {
        if (dotsWrapper) dotsWrapper.classList.remove('shake');
        this.enteredPIN = '';
        this.renderPinDots();
        if (sub) {
          sub.textContent = 'Enter 4-Digit PIN to unlock';
          sub.style.color = 'var(--text-muted)';
        }
      }, 500);
    } finally {
      this.isVerifyingPIN = false;
    }
  },

  bindPINSettings() {
    // Open Setup Modal
    const btnOpenSetup = document.getElementById('btn-open-pin-setup');
    const formPin = document.getElementById('form-pin-setup');
    const currentPinGroup = document.getElementById('group-current-pin');
    const currentPinInput = document.getElementById('input-current-pin');
    const newPinInput = document.getElementById('input-new-pin');
    const confirmPinInput = document.getElementById('input-confirm-pin');
    const modalTitle = document.getElementById('pin-setup-modal-title');
    const btnSave = document.getElementById('btn-save-pin');

    if (btnOpenSetup) {
      btnOpenSetup.addEventListener('click', () => {
        if (formPin) formPin.reset();
        if (currentPinGroup) {
          currentPinGroup.style.display = this.isPINEnabled ? 'block' : 'none';
        }
        if (currentPinInput) {
          currentPinInput.required = this.isPINEnabled;
        }
        if (modalTitle) {
          modalTitle.textContent = this.isPINEnabled ? 'Change 4-Digit PIN' : 'Set Up 4-Digit PIN';
        }
        if (btnSave) {
          btnSave.textContent = this.isPINEnabled ? 'Update PIN' : 'Save & Enable PIN';
        }
        this.openModal('modal-pin-setup');
      });
    }

    // Submit Setup Form
    if (formPin) {
      formPin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const currentPin = currentPinInput ? currentPinInput.value.trim() : '';
        const newPin = newPinInput ? newPinInput.value.trim() : '';
        const confirmPin = confirmPinInput ? confirmPinInput.value.trim() : '';

        if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
          alert('New PIN must be exactly 4 digits (0-9).');
          return;
        }

        if (newPin !== confirmPin) {
          alert('New PIN and Confirm PIN do not match.');
          return;
        }

        try {
          await API.setPIN(newPin, currentPin);
          this.isPINEnabled = true;
          this.updatePINStatusUI(true);
          sessionStorage.setItem('rb_unlocked', 'true');
          this.closeModal('modal-pin-setup');
          this.toast('4-Digit PIN enabled successfully!');
        } catch (err) {
          alert(err.message || 'Failed configuring PIN');
        }
      });
    }

    // Turn Off PIN
    const btnDisable = document.getElementById('btn-disable-pin');
    if (btnDisable) {
      btnDisable.addEventListener('click', async () => {
        const pin = prompt('Enter your current 4-Digit PIN to disable the lock:');
        if (pin === null) return;
        if (!pin || pin.length !== 4) {
          alert('Please enter your 4-digit PIN.');
          return;
        }

        try {
          await API.disablePIN(pin.trim());
          this.isPINEnabled = false;
          this.updatePINStatusUI(false);
          sessionStorage.removeItem('rb_unlocked');
          this.toast('PIN Lock has been disabled.');
        } catch (err) {
          alert(err.message || 'Incorrect PIN. Could not disable.');
        }
      });
    }
  }
};
