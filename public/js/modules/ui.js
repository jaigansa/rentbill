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
    document.getElementById('btn-lan-share')?.addEventListener('click', () => this.openLanShareModal());
    document.getElementById('btn-copy-lan-url')?.addEventListener('click', () => {
      const input = document.getElementById('lan-share-url-input');
      if (input && input.value) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(input.value).then(() => {
            this.showToast('Copied Wi-Fi URL to clipboard!', 'success');
          }).catch(() => {
            input.select();
            document.execCommand('copy');
            this.showToast('Copied Wi-Fi URL to clipboard!', 'success');
          });
        } else {
          input.select();
          document.execCommand('copy');
          this.showToast('Copied Wi-Fi URL to clipboard!', 'success');
        }
      }
    });
    document.getElementById('btn-prop-add-expense')?.addEventListener('click', () => {
      if (this.currentExpensesPropertyId) {
        this.openAddExpenseModal(this.currentExpensesPropertyId);
      }
    });
    document.getElementById('btn-prop-expenses-print')?.addEventListener('click', () => {
      this.printPropertyExpenses?.();
    });

    // Ledger Modal View Switcher (Three Tabs: Bills, Payments, Ledger)
    document.getElementById('btn-ledger-tab-bills')?.addEventListener('click', () => {
      this.switchLedgerTab('bills');
    });
    document.getElementById('btn-ledger-tab-payments')?.addEventListener('click', () => {
      this.switchLedgerTab('payments');
    });
    document.getElementById('btn-ledger-tab-ledger')?.addEventListener('click', () => {
      this.switchLedgerTab('ledger');
    });
    document.getElementById('btn-ledger-tab-statement')?.addEventListener('click', () => {
      this.switchLedgerTab('ledger');
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

        const confirmMsg = `Are you sure you want to import the database from "${file.name}"?\n\n` +
          `• Existing database records will be replaced with this imported file.\n` +
          `• It is recommended to export your current database first.`;
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
              this.toast(res.message || 'Database imported successfully!');
              this.closeModal('modal-settings');
              inputRestoreBackup.value = '';
              await this.refreshAll();
            } catch (err) {
              this.toast('Import failed: ' + err.message, 'error');
              inputRestoreBackup.value = '';
            }
          };
          reader.readAsText(file);
        } catch (err) {
          this.toast('Error reading database file: ' + err.message, 'error');
          inputRestoreBackup.value = '';
        }
      });
    }

    // Invoice actions
    document.getElementById('btn-invoice-share')?.addEventListener('click', () => {
      if (this.currentBillForInvoice) Share.shareBill(this.currentBillForInvoice);
    });
    document.getElementById('btn-ledger-print')?.addEventListener('click', () => {
      this.printTenantLedger();
    });
    document.getElementById('btn-ledger-share-statement')?.addEventListener('click', async () => {
      const tenantId = this.currentLedgerTenantId;
      if (!tenantId) return;
      const tenant = (this.tenants || []).find(t => t.id == tenantId) || await API.getTenant(tenantId).catch(() => null);
      if (this.currentLedgerData) {
        Share.shareStatement(this.currentLedgerData, tenant);
      } else {
        try {
          const ledger = await API.getTenantLedger(tenantId);
          this.currentLedgerData = ledger;
          Share.shareStatement(ledger, tenant);
        } catch (e) {
          this.toast(e.message, 'error');
        }
      }
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
          this.toast('Failed generating image: ' + err.message, 'error');
        }
      } else {
        Share.downloadReceiptImage(this.currentBillForInvoice);
      }
    });
    document.getElementById('btn-invoice-print')?.addEventListener('click', () => {
      Share.printInvoice();
    });

    // Tenant Ledger & Expenses CSV Export buttons
    document.getElementById('btn-ledger-export-csv')?.addEventListener('click', () => {
      this.exportCurrentLedgerCSV();
    });
    document.getElementById('btn-prop-expenses-export-csv')?.addEventListener('click', () => {
      this.exportCurrentPropertyExpensesCSV();
    });

    // Settings Tax & Accounting CSV Exports (Unified Dropdown + Common Export Button)
    document.getElementById('btn-run-csv-export')?.addEventListener('click', () => {
      const category = document.getElementById('select-export-category')?.value || 'bills';
      switch (category) {
        case 'bills':
          this.exportAllBillsCSV();
          break;
        case 'expenses':
          this.exportAllExpensesCSV();
          break;
        case 'payments':
          this.exportAllPaymentsCSV();
          break;
        case 'tenants':
          this.exportAllTenantsCSV();
          break;
        default:
          this.exportAllBillsCSV();
      }
    });

    document.getElementById('btn-export-bills-csv')?.addEventListener('click', () => {
      this.exportAllBillsCSV();
    });
    document.getElementById('btn-export-expenses-csv')?.addEventListener('click', () => {
      this.exportAllExpensesCSV();
    });
    document.getElementById('btn-export-payments-csv')?.addEventListener('click', () => {
      this.exportAllPaymentsCSV();
    });
    document.getElementById('btn-export-tenants-csv')?.addEventListener('click', () => {
      this.exportAllTenantsCSV();
    });

    // 1-Click Batch Monthly Bill Generator form submit & month change
    document.getElementById('batch-billing-month')?.addEventListener('change', (e) => {
      const month = e.target.value;
      if (month) {
        this.loadBatchPreview(month);
        const dueInput = document.getElementById('batch-due-date');
        if (dueInput) dueInput.value = `${month}-10`;
      }
    });

    document.getElementById('form-batch-bills')?.addEventListener('submit', (e) => {
      this.handleBatchCreateBills(e);
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
          } catch {}

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

    // Close any active inline dropdowns first
    document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));

    // Extract card title and subtitle for context in the sheet header
    const card = buttonEl.closest('.app-card, .ledger-entry-card');
    let title = 'Options';
    let subtitle = 'Select an action';

    if (card) {
      const titleEl = card.querySelector('.card-title, .ledger-entry-desc, .card-amount-val');
      const subEl = card.querySelector('.card-subtitle, .ledger-entry-date');
      if (titleEl) title = titleEl.textContent.trim();
      if (subEl) subtitle = subEl.textContent.trim();
    }

    this.openActionSheetFromDropdown(dropdownMenu, title, subtitle);
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
  },

  async openLanShareModal() {
    this.openModal('modal-lan-share');
    const badge = document.getElementById('lan-share-badge');
    const qrContainer = document.getElementById('lan-share-qrcode');
    const urlInput = document.getElementById('lan-share-url-input');
    const hint = document.getElementById('lan-share-inactive-hint');
    const instructions = document.getElementById('lan-share-instructions');

    if (qrContainer) qrContainer.innerHTML = '<span style="color:var(--text-muted); font-size:12px;">Loading Wi-Fi details...</span>';

    try {
      const info = await API.getNetworkInfo();
      const port = info.port || 8080;
      let targetUrl = info.local_url;
      if (info.lan_urls && info.lan_urls.length > 0) {
        targetUrl = info.lan_urls[0];
      }

      if (urlInput) urlInput.value = targetUrl || window.location.href;

      if (info.lan_shared) {
        if (badge) {
          badge.className = 'badge badge-success';
          badge.style.background = '';
          badge.style.color = '';
          badge.innerHTML = `<i data-lucide="wifi" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;"></i> Wi-Fi Sharing Active (Port ${port})`;
        }
        if (hint) hint.style.display = 'none';
        if (instructions) instructions.textContent = 'Scan with your mobile camera while connected to the same Wi-Fi network.';
      } else {
        if (badge) {
          badge.className = 'badge badge-warning';
          badge.style.background = '';
          badge.style.color = '';
          badge.innerHTML = `<i data-lucide="shield-alert" style="width:13px;height:13px;vertical-align:-2px;margin-right:4px;"></i> Loopback Only (Port ${port})`;
        }
        if (hint) hint.style.display = 'block';
        if (instructions) instructions.textContent = 'Desktop loopback URL shown. Run with "-share" to allow Wi-Fi phone access.';
      }

      // Render clean QR code
      if (qrContainer) {
        qrContainer.innerHTML = '';
        if (typeof QRCode !== 'undefined' && targetUrl) {
          new QRCode(qrContainer, {
            text: targetUrl,
            width: 168,
            height: 168,
            colorDark: '#0f172a',
            colorLight: '#ffffff',
            correctLevel: QRCode.CorrectLevel.M
          });
        }
      }
      this.refreshIcons();
    } catch (err) {
      if (qrContainer) qrContainer.innerHTML = `<span style="color:#ef4444; font-size:12px;">Failed to load network info: ${err.message}</span>`;
    }
  }
};
