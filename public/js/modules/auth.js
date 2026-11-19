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
    } catch {
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

    const resetPinValidation = () => {
      newPinInput?.classList.remove('is-invalid', 'is-valid');
      confirmPinInput?.classList.remove('is-invalid', 'is-valid');
      const hintNew = document.getElementById('hint-new-pin');
      const hintConfirm = document.getElementById('hint-confirm-pin');
      if (hintNew) {
        hintNew.className = 'form-inline-feedback';
        hintNew.style.color = 'var(--text-muted)';
        hintNew.textContent = 'Must be exactly 4 numbers (0-9).';
      }
      if (hintConfirm) {
        hintConfirm.style.display = 'none';
        hintConfirm.textContent = '';
      }
    };

    const validatePins = () => {
      const nPin = newPinInput ? newPinInput.value.trim() : '';
      const cPin = confirmPinInput ? confirmPinInput.value.trim() : '';
      const hintNew = document.getElementById('hint-new-pin');
      const hintConfirm = document.getElementById('hint-confirm-pin');

      if (nPin.length > 0) {
        if (/^\d{4}$/.test(nPin)) {
          newPinInput.classList.remove('is-invalid');
          newPinInput.classList.add('is-valid');
          if (hintNew) {
            hintNew.className = 'form-inline-feedback feedback-success';
            hintNew.textContent = '✓ Valid 4-digit numeric PIN';
          }
        } else {
          newPinInput.classList.add('is-invalid');
          newPinInput.classList.remove('is-valid');
          if (hintNew) {
            hintNew.className = 'form-inline-feedback feedback-danger';
            hintNew.textContent = 'PIN must be exactly 4 digits (0-9)';
          }
        }
      } else {
        newPinInput?.classList.remove('is-invalid', 'is-valid');
        if (hintNew) {
          hintNew.className = 'form-inline-feedback';
          hintNew.style.color = 'var(--text-muted)';
          hintNew.textContent = 'Must be exactly 4 numbers (0-9).';
        }
      }

      if (cPin.length > 0) {
        if (hintConfirm) hintConfirm.style.display = 'block';
        if (cPin === nPin && /^\d{4}$/.test(nPin)) {
          confirmPinInput.classList.remove('is-invalid');
          confirmPinInput.classList.add('is-valid');
          if (hintConfirm) {
            hintConfirm.className = 'form-inline-feedback feedback-success';
            hintConfirm.textContent = '✓ PINs match';
          }
        } else {
          confirmPinInput.classList.add('is-invalid');
          confirmPinInput.classList.remove('is-valid');
          if (hintConfirm) {
            hintConfirm.className = 'form-inline-feedback feedback-danger';
            hintConfirm.textContent = 'PINs do not match';
          }
        }
      } else {
        confirmPinInput?.classList.remove('is-invalid', 'is-valid');
        if (hintConfirm) hintConfirm.style.display = 'none';
      }
    };

    newPinInput?.addEventListener('input', validatePins);
    confirmPinInput?.addEventListener('input', validatePins);

    if (btnOpenSetup) {
      btnOpenSetup.addEventListener('click', () => {
        if (formPin) formPin.reset();
        resetPinValidation();
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
          this.toast('New PIN must be exactly 4 digits (0-9).', 'warning');
          newPinInput?.focus();
          return;
        }

        if (newPin !== confirmPin) {
          this.toast('New PIN and Confirm PIN do not match.', 'warning');
          confirmPinInput?.focus();
          return;
        }

        try {
          await API.setPIN(newPin, currentPin);
          this.isPINEnabled = true;
          this.updatePINStatusUI(true);
          sessionStorage.setItem('rb_unlocked', 'true');
          this.closeModal('modal-pin-setup');
          resetPinValidation();
          this.toast('4-Digit PIN enabled successfully!');
        } catch (err) {
          this.toast(err.message || 'Failed configuring PIN', 'error');
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
          this.toast('Please enter your 4-digit PIN.', 'warning');
          return;
        }

        try {
          await API.disablePIN(pin.trim());
          this.isPINEnabled = false;
          this.updatePINStatusUI(false);
          sessionStorage.removeItem('rb_unlocked');
          this.toast('PIN Lock has been disabled.');
        } catch (err) {
          this.toast(err.message || 'Incorrect PIN. Could not disable.', 'error');
        }
      });
    }
  }
};
