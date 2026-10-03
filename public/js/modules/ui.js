// UI Controller: Navigation, Modals, Action Sheets, and Delete Confirmations

export const UI = {
  bindNavigation() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const tab = item.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });
  },

  switchTab(tabName) {
    this.activeTab = tabName;
    document.querySelectorAll('.tab-view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-tab') === tabName);
    });

    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) activeView.classList.add('active');

    if (tabName === 'dashboard') this.loadDashboard();
    if (tabName === 'tenants') this.loadTenants();
    if (tabName === 'properties') this.loadProperties();
  },

  bindModals() {
    // Open modal buttons
    document.getElementById('btn-quick-new-bill')?.addEventListener('click', () => this.openBillModal());
    document.getElementById('btn-new-bill-tab')?.addEventListener('click', () => this.openBillModal());
    document.getElementById('btn-quick-add-tenant')?.addEventListener('click', () => this.openTenantModal());
    document.getElementById('btn-new-tenant-tab')?.addEventListener('click', () => this.openTenantModal());
    document.getElementById('btn-quick-add-property')?.addEventListener('click', () => this.openPropertyModal());
    document.getElementById('btn-new-property-tab')?.addEventListener('click', () => this.openPropertyModal());
    document.getElementById('btn-open-settings')?.addEventListener('click', () => this.openSettingsModal());
    document.getElementById('btn-prop-add-expense')?.addEventListener('click', () => {
      if (this.currentExpensesPropertyId) {
        this.openAddExpenseModal(this.currentExpensesPropertyId);
      }
    });

    // Co-occupant dynamic rows
    document.getElementById('btn-add-co-occupant')?.addEventListener('click', () => {
      const container = document.getElementById('co-occupants-list');
      if (container) {
        const row = this.renderCoOccupantRow('', '');
        container.appendChild(row);
        this.refreshIcons();
        row.querySelector('.co-occupant-name')?.focus();
      }
    });

    // Backup & Restore file triggers
    const btnTriggerRestore = document.getElementById('btn-trigger-restore');
    const inputRestoreBackup = document.getElementById('input-restore-backup');
    if (btnTriggerRestore && inputRestoreBackup) {
      btnTriggerRestore.addEventListener('click', () => {
        inputRestoreBackup.click();
      });
      inputRestoreBackup.addEventListener('change', async (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;

        const confirmMsg = `Are you sure you want to restore the database from "${file.name}"?\n\n` +
          `• Existing database records will be replaced with this backup.\n` +
          `• It is recommended to download a current backup first.`;
        if (!confirm(confirmMsg)) {
          inputRestoreBackup.value = '';
          return;
        }

        try {
          const reader = new FileReader();
          reader.onload = async (event) => {
            try {
              const json = JSON.parse(event.target.result);
              const res = await API.restoreBackup(json);
              this.toast(res.message || 'Database restored successfully!');
              this.closeModal('modal-settings');
              inputRestoreBackup.value = '';
              await this.refreshAll();
            } catch (err) {
              alert('Restore failed: ' + err.message);
              inputRestoreBackup.value = '';
            }
          };
          reader.readAsText(file);
        } catch (err) {
          alert('Error reading backup file: ' + err.message);
          inputRestoreBackup.value = '';
        }
      });
    }

    // Invoice actions
    document.getElementById('btn-invoice-share')?.addEventListener('click', () => {
      if (this.currentBillForInvoice) Share.shareBill(this.currentBillForInvoice);
    });
    document.getElementById('btn-invoice-download-img')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-invoice-download-img');
      if (!this.currentBillForInvoice) return;
      if (btn) {
        const originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i data-lucide="loader" style="width:16px; height:16px; animation:spin 1s linear infinite; vertical-align:-2px;"></i> Generating...`;
        try {
          await Share.downloadReceiptImage(this.currentBillForInvoice);
          btn.innerHTML = `<i data-lucide="check" style="width:16px; height:16px; vertical-align:-2px;"></i> Saved!`;
          if (window.lucide) window.lucide.createIcons();
          setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
            if (window.lucide) window.lucide.createIcons();
          }, 1800);
        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = originalHtml;
          if (window.lucide) window.lucide.createIcons();
          alert('Failed generating image: ' + err.message);
        }
      } else {
        Share.downloadReceiptImage(this.currentBillForInvoice);
      }
    });
    document.getElementById('btn-invoice-print')?.addEventListener('click', () => {
      Share.printInvoice();
    });

    // Close buttons (delegated so dynamically inserted buttons with data-close also work)
    document.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('[data-close]');
      if (closeBtn) {
        const modalId = closeBtn.getAttribute('data-close');
        if (modalId) this.closeModal(modalId);
      }
    });

    // Close on backdrop click
    document.querySelectorAll('.modal').forEach(m => {
      m.addEventListener('click', (e) => {
        if (e.target === m) this.closeModal(m.id);
      });
    });

    // Close all open card dropdowns when clicking anywhere outside
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.card-dropdown')) {
        document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));
      }
    });

    // Bind Vacant Form Calculation events
    this.bindVacantCalculationEvents();
  },

  openModal(id) {
    document.getElementById(id)?.classList.add('active');
    this.refreshIcons();
  },

  closeModal(id) {
    document.getElementById(id)?.classList.remove('active');
    if (id === 'modal-confirm-delete') {
      this.cancelHold();
      this.activeDeleteCallback = null;
    }
  },

  confirmDelete({ title, subtitle, warningHtml, buttonLabel = 'Hold to Delete (10s)', onConfirm }) {
    document.getElementById('delete-modal-title').textContent = title || 'Confirm Deletion';
    document.getElementById('delete-modal-subtitle').textContent = subtitle || 'Protective Confirmation';
    document.getElementById('delete-modal-warning-box').innerHTML = warningHtml || 'Are you sure you want to delete this item?';
    document.getElementById('hold-delete-label').textContent = buttonLabel;

    this.cancelHold();
    this.activeDeleteCallback = onConfirm;
    this.openModal('modal-confirm-delete');
  },

  initHoldToDelete() {
    const btn = document.getElementById('btn-hold-delete');
    if (!btn) return;

    const startHold = (e) => {
      // Only primary mouse button or touch
      if (e.button && e.button !== 0) return;
      e.preventDefault();

      if (!this.activeDeleteCallback) return;

      this.holdStartTime = performance.now();
      btn.classList.add('is-holding');

      const progressEl = document.getElementById('hold-delete-progress');
      const labelEl = document.getElementById('hold-delete-label');

      const tick = (now) => {
        if (!this.holdStartTime) return;
        const elapsed = now - this.holdStartTime;
        const pct = Math.min(100, (elapsed / this.holdDuration) * 100);

        if (progressEl) progressEl.style.width = `${pct}%`;

        const remainingSec = Math.max(0, ((this.holdDuration - elapsed) / 1000)).toFixed(1);
        if (labelEl) labelEl.textContent = `Holding... ${remainingSec}s`;

        if (pct >= 100) {
          // Trigger successful delete
          btn.classList.remove('is-holding');
          btn.classList.add('is-completed');
          if (labelEl) labelEl.textContent = 'Deleted!';

          // Trigger physical vibration if device supports it
          try {
            if (navigator.vibrate) navigator.vibrate(60);
          } catch (e) {}

          const cb = this.activeDeleteCallback;
          this.activeDeleteCallback = null;
          this.holdStartTime = null;

          setTimeout(() => {
            this.closeModal('modal-confirm-delete');
            if (typeof cb === 'function') cb();
          }, 200);
        } else {
          this.holdTimer = requestAnimationFrame(tick);
        }
      };

      this.holdTimer = requestAnimationFrame(tick);
    };

    const stopHold = () => {
      this.cancelHold();
    };

    // Pointer events handle both touchscreens and mouse uniformly
    btn.addEventListener('pointerdown', startHold);
    btn.addEventListener('pointerup', stopHold);
    btn.addEventListener('pointerleave', stopHold);
    btn.addEventListener('pointercancel', stopHold);
  },

  cancelHold() {
    if (this.holdTimer) {
      cancelAnimationFrame(this.holdTimer);
      this.holdTimer = null;
    }
    this.holdStartTime = null;

    const btn = document.getElementById('btn-hold-delete');
    if (btn) {
      btn.classList.remove('is-holding');
      btn.classList.remove('is-completed');
    }
    const progressEl = document.getElementById('hold-delete-progress');
    if (progressEl) progressEl.style.width = '0%';

    const labelEl = document.getElementById('hold-delete-label');
    if (labelEl) labelEl.textContent = 'Hold to Delete (2s)';
  },

  toggleDropdown(buttonEl, event) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    const parentDropdown = buttonEl.closest('.card-dropdown');
    if (!parentDropdown) return;
    const dropdownMenu = parentDropdown.querySelector('.card-dropdown-menu');
    if (!dropdownMenu) return;

    // Detect mobile / touch view
    const isMobile = window.innerWidth <= 820 || (window.matchMedia && window.matchMedia('(max-width: 820px)').matches);

    if (isMobile) {
      // Close any active inline dropdowns first
      document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));

      // Extract card title and subtitle for context in the sheet header
      const card = buttonEl.closest('.app-card');
      let title = 'Options';
      let subtitle = 'Select an action';

      if (card) {
        const titleEl = card.querySelector('.card-title');
        const subEl = card.querySelector('.card-subtitle');
        if (titleEl) title = titleEl.textContent.trim();
        if (subEl) subtitle = subEl.textContent.trim();
      }

      this.openActionSheetFromDropdown(dropdownMenu, title, subtitle);
      return;
    }

    const wasActive = parentDropdown.classList.contains('active');
    
    // Close other dropdowns first
    document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));
    
    if (!wasActive) {
      parentDropdown.classList.add('active');
    }
  },

  openActionSheetFromDropdown(dropdownMenu, title, subtitle) {
    const sheetTitle = document.getElementById('action-sheet-title');
    const sheetSubtitle = document.getElementById('action-sheet-subtitle');
    const sheetItems = document.getElementById('action-sheet-items');
    if (!sheetItems) return;

    if (sheetTitle) sheetTitle.textContent = title || 'Options';
    if (sheetSubtitle) {
      sheetSubtitle.textContent = subtitle || 'Select an action';
      sheetSubtitle.style.display = subtitle ? 'block' : 'none';
    }

    sheetItems.innerHTML = '';

    const items = dropdownMenu.querySelectorAll('.dropdown-item');
    items.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      const isDanger = item.classList.contains('dropdown-item-danger');
      const isSuccess = item.classList.contains('dropdown-item-success') || item.classList.contains('btn-action-pay');
      btn.className = `action-sheet-btn ${isDanger ? 'action-sheet-btn-danger' : ''} ${isSuccess ? 'action-sheet-btn-success' : ''}`;
      
      // Transfer inner HTML (icon + label text)
      btn.innerHTML = item.innerHTML;

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeModal('modal-action-sheet');
        // Trigger the original item click synchronously so native share, inline handlers, and listeners execute
        item.click();
      });

      sheetItems.appendChild(btn);
    });

    this.openModal('modal-action-sheet');
    this.refreshIcons();
  }
};
