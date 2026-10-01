// RentBill Frontend Application Logic
window.APP_CURRENCY = '₹';

const App = {
  activeTab: 'dashboard',
  currentBillForInvoice: null,
  currentLedgerTenantId: null,
  activeDeleteCallback: null,
  holdTimer: null,
  holdStartTime: null,
  holdDuration: 10000, // 10 seconds hold to delete
  selectedDashboardMonth: '',
  tenantSearchQuery: '',
  tenantFilter: 'all',
  propertySearchQuery: '',
  propertyFilter: 'all',
  properties: [],
  tenants: [],
  bills: [],
  isPINEnabled: false,
  isAppLocked: false,
  enteredPIN: '',
  isVerifyingPIN: false,

  async init() {
    this.bindVisualViewport();
    this.setupDateBadge();
    this.bindNavigation();
    this.bindModals();
    this.bindForms();
    this.bindCalculators();
    this.initHoldToDelete();
    this.bindDashboardControls();
    this.bindSearchAndFilters();
    this.bindAppLock();

    await this.checkAuthStatus();
    await this.loadSettings();
    await this.refreshAll();
    this.refreshIcons();
  },

  bindVisualViewport() {
    if (window.visualViewport) {
      const updateViewport = () => {
        const vv = window.visualViewport;
        document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
      };
      window.visualViewport.addEventListener('resize', updateViewport);
      window.visualViewport.addEventListener('scroll', updateViewport);
      updateViewport();
    }
  },

  refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  },

  showToast(message, type = 'info', duration = 3000) {
    if (!message) return;
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-msg toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle-2';
    else if (type === 'warning') iconName = 'alert-triangle';
    else if (type === 'error' || type === 'danger') iconName = 'alert-circle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="width:16px; height:16px; flex-shrink:0;"></i>
      <span>${message}</span>
    `;
    container.appendChild(toast);
    this.refreshIcons();

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 220);
    }, duration);
  },

  toast(message, type = 'info') {
    return this.showToast(message, type);
  },

  // Smart currency formatter: cleanly formats large numbers (Crores, Lakhs, Thousands)
  formatMoney(amount, compact = false) {
    const curr = window.APP_CURRENCY || '₹';
    const num = Number(amount) || 0;
    const isNeg = num < 0;
    const abs = Math.abs(num);

    if (compact) {
      // 1 Crore = 10,000,000 (100 Lakhs)
      if (abs >= 10000000) {
        const cr = abs / 10000000;
        const formattedCr = cr >= 100 ? cr.toFixed(1) : cr.toFixed(2);
        return `${isNeg ? '-' : ''}${curr}${parseFloat(formattedCr)} Cr`;
      }
      // 1 Lakh = 100,000
      if (abs >= 100000) {
        const l = abs / 100000;
        const formattedL = l >= 100 ? l.toFixed(1) : l.toFixed(2);
        return `${isNeg ? '-' : ''}${curr}${parseFloat(formattedL)} L`;
      }
    }

    // Standard view with Indian comma grouping
    const hasPaise = (abs % 1) !== 0;
    const formatted = abs.toLocaleString('en-IN', {
      minimumFractionDigits: hasPaise ? 2 : 0,
      maximumFractionDigits: 2
    });
    return `${isNeg ? '-' : ''}${curr}${formatted}`;
  },

  formatFullMoney(amount) {
    const curr = window.APP_CURRENCY || '₹';
    const num = Number(amount) || 0;
    return `${num < 0 ? '-' : ''}${curr}${Math.abs(num).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  },

  setupDateBadge() {
    const today = new Date();
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const badge = document.getElementById('current-date-badge');
    if (badge) badge.textContent = today.toLocaleDateString(undefined, options);

    // Set default month & due date in form
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const billMonth = document.getElementById('bill-month');
    if (billMonth) billMonth.value = `${yyyy}-${mm}`;

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dueDateStr = nextWeek.toISOString().split('T')[0];
    const dueDateInput = document.getElementById('bill-due-date');
    if (dueDateInput) dueDateInput.value = dueDateStr;

    const payDateInput = document.getElementById('pay-date');
    if (payDateInput) payDateInput.value = today.toISOString().split('T')[0];

    const moveInInput = document.getElementById('tenant-move-in');
    if (moveInInput) moveInInput.value = today.toISOString().split('T')[0];
  },

  toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  },

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

    // Close buttons
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        this.closeModal(modalId);
      });
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

  renderCoOccupantRow(name = '', phone = '') {
    const div = document.createElement('div');
    div.className = 'co-occupant-row';
    const safeName = (name || '').replace(/"/g, '&quot;');
    const safePhone = (phone || '').replace(/"/g, '&quot;');
    div.innerHTML = `
      <input type="text" class="co-occupant-name" placeholder="Name (e.g. Spouse / Roommate)" value="${safeName}">
      <input type="tel" class="co-occupant-phone" placeholder="Mobile number" value="${safePhone}">
      <button type="button" class="btn-remove-co-occupant" title="Remove Co-occupant">
        <i data-lucide="trash-2" style="width:15px; height:15px;"></i>
      </button>
    `;
    div.querySelector('.btn-remove-co-occupant')?.addEventListener('click', () => {
      div.remove();
    });
    return div;
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

  // Electricity & Water meter live calculation
  bindCalculators() {
    const prevElecMeter = document.getElementById('bill-prev-meter');
    const currElecMeter = document.getElementById('bill-curr-meter');
    const elecRate = document.getElementById('bill-elec-rate');
    const baseRent = document.getElementById('bill-base-rent');
    const waterType = document.getElementById('bill-water-type');
    const waterFixed = document.getElementById('bill-water');
    const prevWaterMeter = document.getElementById('bill-prev-water-meter');
    const currWaterMeter = document.getElementById('bill-curr-water-meter');
    const waterRate = document.getElementById('bill-water-rate');
    const maint = document.getElementById('bill-maint');
    const other = document.getElementById('bill-other');
    const prevBalance = document.getElementById('bill-prev-balance');

    // Toggle Property water type input visibility
    const propWaterType = document.getElementById('prop-water-type');
    if (propWaterType) {
      propWaterType.addEventListener('change', () => {
        const isMeter = propWaterType.value === 'METER';
        document.getElementById('group-prop-water-fixed').style.display = isMeter ? 'none' : 'block';
        document.getElementById('group-prop-water-meter').style.display = isMeter ? 'block' : 'none';
      });
    }

    // Toggle Bill water type boxes
    const updateWaterTypeUI = () => {
      const isMeter = waterType.value === 'METER';
      document.getElementById('bill-water-fixed-box').style.display = isMeter ? 'none' : 'block';
      document.getElementById('bill-water-meter-box').style.display = isMeter ? 'block' : 'none';
      updateCalc();
      this.refreshIcons();
    };

    if (waterType) {
      waterType.addEventListener('change', updateWaterTypeUI);
    }

    // Unlock previous meter buttons
    const btnUnlockElec = document.getElementById('btn-unlock-prev-elec');
    const btnUnlockWater = document.getElementById('btn-unlock-prev-water');
    if (btnUnlockElec) {
      btnUnlockElec.addEventListener('click', () => {
        prevElecMeter.removeAttribute('readonly');
        prevElecMeter.classList.remove('input-readonly');
        prevElecMeter.focus();
        btnUnlockElec.style.display = 'none';
      });
    }
    if (btnUnlockWater) {
      btnUnlockWater.addEventListener('click', () => {
        prevWaterMeter.removeAttribute('readonly');
        prevWaterMeter.classList.remove('input-readonly');
        prevWaterMeter.focus();
        btnUnlockWater.style.display = 'none';
      });
    }

    const updateCalc = () => {
      const pElec = parseFloat(prevElecMeter.value) || 0;
      const cElec = parseFloat(currElecMeter.value) || 0;
      const eRate = parseFloat(elecRate.value) || 0;
      const rent = parseFloat(baseRent.value) || 0;
      const m = parseFloat(maint.value) || 0;
      const o = parseFloat(other.value) || 0;
      const arrear = parseFloat(prevBalance ? prevBalance.value : 0) || 0;

      // Electricity validation & calculation
      const warnElec = document.getElementById('warn-curr-elec');
      if (warnElec) {
        if (currElecMeter.value !== '' && cElec < pElec) {
          warnElec.style.display = 'block';
        } else {
          warnElec.style.display = 'none';
        }
      }

      const elecUnits = cElec >= pElec ? (cElec - pElec) : 0;
      const elecSub = elecUnits * eRate;
      document.getElementById('bill-elec-units').value = `${elecUnits.toFixed(1)} units`;
      document.getElementById('bill-elec-subtotal').textContent = `${window.APP_CURRENCY}${elecSub.toFixed(2)}`;

      // Water validation & calculation
      let waterTotal = 0;
      if (waterType && waterType.value === 'METER') {
        const pWater = parseFloat(prevWaterMeter.value) || 0;
        const cWater = parseFloat(currWaterMeter.value) || 0;
        const wRate = parseFloat(waterRate.value) || 0;

        const warnWater = document.getElementById('warn-curr-water');
        if (warnWater) {
          if (currWaterMeter.value !== '' && cWater < pWater) {
            warnWater.style.display = 'block';
          } else {
            warnWater.style.display = 'none';
          }
        }

        const waterUnits = cWater >= pWater ? (cWater - pWater) : 0;
        waterTotal = waterUnits * wRate;
        document.getElementById('bill-water-units').value = `${waterUnits.toFixed(1)} units`;
        document.getElementById('bill-water-subtotal').textContent = `${window.APP_CURRENCY}${waterTotal.toFixed(2)}`;
      } else {
        waterTotal = parseFloat(waterFixed.value) || 0;
      }

      const discount = parseFloat(document.getElementById('bill-discount')?.value) || 0;
      const subtotal = rent + elecSub + waterTotal + m + o + arrear;
      const total = Math.max(0, subtotal - discount);
      document.getElementById('bill-calculated-total').textContent = `${window.APP_CURRENCY}${total.toFixed(2)}`;
    };

    [prevElecMeter, currElecMeter, elecRate, baseRent, waterFixed, prevWaterMeter, currWaterMeter, waterRate, maint, other, prevBalance, document.getElementById('bill-discount')].forEach(inp => {
      if (inp) inp.addEventListener('input', updateCalc);
    });

    // When tenant selection changes in bill modal, auto populate unit, base rent, rate, and last meter readings
    document.getElementById('bill-tenant-select')?.addEventListener('change', async (e) => {
      const tenantId = e.target.value;
      if (!tenantId) return;

      const tenant = this.tenants.find(t => t.id == tenantId);
      if (!tenant) return;

      document.getElementById('bill-property-display').value = tenant.property_name || 'No Unit Assigned';
      document.getElementById('bill-property-id').value = tenant.property_id || '';

      if (tenant.property_id) {
        const prop = this.properties.find(p => p.id == tenant.property_id);
        if (prop) {
          baseRent.value = prop.default_rent || 0;
          elecRate.value = prop.electricity_rate || 0;
          maint.value = prop.maintenance_charge || 0;

          // Water settings from property
          if (prop.water_billing_type === 'METER') {
            waterType.value = 'METER';
            waterRate.value = prop.water_rate || 0;
          } else {
            waterType.value = 'FIXED';
            waterFixed.value = prop.water_charge || 0;
          }
          updateWaterTypeUI();
        }
      }

      // Fetch last meter reading / move-in meter & pending arrears for tenant
      try {
        const lastBill = await API.getTenantLastBill(tenantId);
        const pElecVal = lastBill.curr_electricity_meter || 0;
        const pWaterVal = lastBill.curr_water_meter || 0;
        const pendingArrear = lastBill.pending_balance || 0;

        prevElecMeter.value = pElecVal;
        prevWaterMeter.value = pWaterVal;

        // Auto carry over previous unpaid arrears (only for new bills)
        if (!document.getElementById('bill-id').value && prevBalance) {
          prevBalance.value = pendingArrear > 0 ? pendingArrear.toFixed(2) : 0;
        }

        const badgeBalance = document.getElementById('badge-prev-balance');
        const hintBalance = document.getElementById('hint-prev-balance');
        if (pendingArrear > 0) {
          if (badgeBalance) badgeBalance.style.display = 'inline-block';
          if (hintBalance) hintBalance.textContent = `Carried forward from ${lastBill.billing_month || 'previous bill'}: ${window.APP_CURRENCY || '₹'}${pendingArrear.toFixed(2)}`;
        } else {
          if (badgeBalance) badgeBalance.style.display = 'none';
          if (hintBalance) hintBalance.textContent = 'No past unpaid dues';
        }

        // Keep current reading blank or set ready for entry
        if (!document.getElementById('bill-id').value) {
          currElecMeter.value = '';
          currWaterMeter.value = '';
        }

        // Lock previous readings and show auto-carried badge / hint
        const badgeElec = document.getElementById('badge-elec-meter-source');
        const hintElec = document.getElementById('hint-prev-elec');
        const badgeWater = document.getElementById('badge-water-meter-source');
        const hintWater = document.getElementById('hint-prev-water');

        prevElecMeter.setAttribute('readonly', 'true');
        prevElecMeter.classList.add('input-readonly');
        if (btnUnlockElec) btnUnlockElec.style.display = 'inline-flex';

        prevWaterMeter.setAttribute('readonly', 'true');
        prevWaterMeter.classList.add('input-readonly');
        if (btnUnlockWater) btnUnlockWater.style.display = 'inline-flex';

        if (lastBill.has_prior_bill) {
          if (badgeElec) {
            badgeElec.style.display = 'inline-block';
            badgeElec.textContent = 'Carried Over';
          }
          if (hintElec) hintElec.textContent = `From ${lastBill.billing_month || 'last bill'}: ${pElecVal} units`;
          if (badgeWater) {
            badgeWater.style.display = 'inline-block';
            badgeWater.textContent = 'Carried Over';
          }
          if (hintWater) hintWater.textContent = `From ${lastBill.billing_month || 'last bill'}: ${pWaterVal} units`;

          // If suggested next month is available and this is a new bill, auto populate month
          if (lastBill.suggested_next_month && !document.getElementById('bill-id').value) {
            const billMonth = document.getElementById('bill-month');
            if (billMonth) billMonth.value = lastBill.suggested_next_month;
          }
        } else if (lastBill.source === 'tenant_initial' && (pElecVal > 0 || pWaterVal > 0)) {
          if (badgeElec) {
            badgeElec.style.display = 'inline-block';
            badgeElec.textContent = 'Move-in Start';
          }
          if (hintElec) hintElec.textContent = `Move-in initial reading: ${pElecVal} units`;
          if (badgeWater) {
            badgeWater.style.display = 'inline-block';
            badgeWater.textContent = 'Move-in Start';
          }
          if (hintWater) hintWater.textContent = `Move-in initial reading: ${pWaterVal} units`;
        } else {
          if (badgeElec) badgeElec.style.display = 'none';
          if (hintElec) hintElec.textContent = 'Starting reading for new tenant';
          if (badgeWater) badgeWater.style.display = 'none';
          if (hintWater) hintWater.textContent = 'Starting reading for new tenant';
        }
      } catch (err) {
        prevElecMeter.value = 0;
        prevWaterMeter.value = 0;
      }
      updateCalc();
      this.refreshIcons();
      if (!document.getElementById('bill-id').value) {
        currElecMeter.focus();
      }
    });
  },

  bindForms() {
    // Property Form (Create / Edit)
    document.getElementById('form-property')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const propId = document.getElementById('prop-id').value;
      const p = {
        name: document.getElementById('prop-name').value.trim(),
        unit_type: document.getElementById('prop-type').value,
        address: document.getElementById('prop-address').value.trim(),
        default_rent: parseFloat(document.getElementById('prop-rent').value) || 0,
        electricity_rate: parseFloat(document.getElementById('prop-elec-rate').value) || 0,
        water_billing_type: document.getElementById('prop-water-type').value,
        water_charge: parseFloat(document.getElementById('prop-water').value) || 0,
        water_rate: parseFloat(document.getElementById('prop-water-rate').value) || 0,
        maintenance_charge: parseFloat(document.getElementById('prop-maint').value) || 0
      };

      try {
        if (propId) {
          await API.updateProperty(propId, p);
          this.toast('Property updated successfully');
        } else {
          await API.createProperty(p);
          this.toast('Property added successfully');
        }
        this.closeModal('modal-property');
        e.target.reset();
        await this.refreshAll();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });

    // Tenant Form (Create / Edit)
    document.getElementById('form-tenant')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const tenantId = document.getElementById('tenant-id').value;
      const propIdVal = document.getElementById('tenant-prop-id').value;
      const isActiveVal = document.getElementById('tenant-is-active')?.value !== '0';

      const coOccupants = [];
      document.querySelectorAll('#co-occupants-list .co-occupant-row').forEach(row => {
        const name = row.querySelector('.co-occupant-name')?.value.trim() || '';
        const phone = row.querySelector('.co-occupant-phone')?.value.trim() || '';
        if (name || phone) {
          coOccupants.push({ name, phone });
        }
      });

      const t = {
        name: document.getElementById('tenant-name').value.trim(),
        phone: document.getElementById('tenant-phone').value.trim(),
        email: document.getElementById('tenant-email').value.trim(),
        property_id: propIdVal ? parseInt(propIdVal, 10) : null,
        security_deposit: parseFloat(document.getElementById('tenant-deposit').value) || 0,
        move_in_date: document.getElementById('tenant-move-in').value,
        payment_upi: document.getElementById('tenant-payment-upi').value.trim(),
        payment_bank_name: document.getElementById('tenant-payment-bank-name').value.trim(),
        payment_account_no: document.getElementById('tenant-payment-account-no').value.trim(),
        payment_ifsc: document.getElementById('tenant-payment-ifsc').value.trim().toUpperCase(),
        initial_elec_meter: parseFloat(document.getElementById('tenant-init-elec').value) || 0,
        initial_water_meter: parseFloat(document.getElementById('tenant-init-water').value) || 0,
        preferred_channel: 'SMS_RCS',
        co_occupants: coOccupants,
        co_occupant_name: coOccupants[0]?.name || '',
        co_occupant_phone: coOccupants[0]?.phone || '',
        is_active: isActiveVal
      };

      try {
        if (tenantId) {
          await API.updateTenant(tenantId, t);
          this.toast('Tenant updated successfully');
        } else {
          await API.createTenant(t);
          this.toast('Tenant added successfully');
        }
        this.closeModal('modal-tenant');
        e.target.reset();
        const coListEl = document.getElementById('co-occupants-list');
        if (coListEl) coListEl.innerHTML = '';
        await this.refreshAll();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });

    // Bill Form (Create / Edit)
    document.getElementById('form-bill')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const billId = document.getElementById('bill-id').value;
      const tenantId = parseInt(document.getElementById('bill-tenant-select').value, 10);
      const propId = parseInt(document.getElementById('bill-property-id').value, 10);

      if (!propId) {
        alert('Selected tenant has no assigned property unit.');
        return;
      }

      const wType = document.getElementById('bill-water-type').value;

      const prevElec = parseFloat(document.getElementById('bill-prev-meter').value) || 0;
      const currElec = parseFloat(document.getElementById('bill-curr-meter').value) || 0;
      if (currElec < prevElec) {
        alert(`Current Electricity Meter reading (${currElec}) cannot be less than Previous reading (${prevElec}).`);
        return;
      }

      const prevWater = parseFloat(document.getElementById('bill-prev-water-meter').value) || 0;
      const currWater = parseFloat(document.getElementById('bill-curr-water-meter').value) || 0;
      if (wType === 'METER' && currWater < prevWater) {
        alert(`Current Water Meter reading (${currWater}) cannot be less than Previous reading (${prevWater}).`);
        return;
      }

      const b = {
        tenant_id: tenantId,
        property_id: propId,
        billing_month: document.getElementById('bill-month').value,
        due_date: document.getElementById('bill-due-date').value,
        base_rent: parseFloat(document.getElementById('bill-base-rent').value) || 0,
        prev_electricity_meter: prevElec,
        curr_electricity_meter: currElec,
        electricity_rate: parseFloat(document.getElementById('bill-elec-rate').value) || 0,
        water_billing_type: wType,
        prev_water_meter: prevWater,
        curr_water_meter: currWater,
        water_rate: parseFloat(document.getElementById('bill-water-rate').value) || 0,
        water_amount: wType === 'FIXED' ? (parseFloat(document.getElementById('bill-water').value) || 0) : 0,
        maintenance_amount: parseFloat(document.getElementById('bill-maint').value) || 0,
        other_charges: parseFloat(document.getElementById('bill-other').value) || 0,
        other_charges_desc: document.getElementById('bill-other-desc').value.trim(),
        discount_amount: parseFloat(document.getElementById('bill-discount')?.value) || 0,
        discount_reason: document.getElementById('bill-discount-reason')?.value.trim() || '',
        previous_balance: parseFloat(document.getElementById('bill-prev-balance')?.value) || 0,
        notes: document.getElementById('bill-notes').value.trim()
      };

      try {
        if (billId) {
          const updated = await API.updateBill(billId, b);
          this.closeModal('modal-bill');
          e.target.reset();
          this.toast('Bill updated successfully!');
          await this.refreshAll();
          this.showInvoice(updated.id || billId);
        } else {
          const created = await API.createBill(b);
          this.closeModal('modal-bill');
          e.target.reset();
          this.toast('Bill generated successfully!');
          await this.refreshAll();
          this.showInvoice(created.id);
        }
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });

    // Payment Form
    document.getElementById('form-payment')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const billId = parseInt(document.getElementById('pay-bill-id').value, 10);
      const pay = {
        bill_id: billId,
        amount: parseFloat(document.getElementById('pay-amount').value) || 0,
        payment_date: document.getElementById('pay-date').value,
        payment_method: document.getElementById('pay-method').value,
        reference_no: document.getElementById('pay-ref').value.trim(),
        notes: document.getElementById('pay-notes').value.trim()
      };

      try {
        await API.recordPayment(pay);
        this.closeModal('modal-payment');
        e.target.reset();
        this.toast('Payment recorded successfully');
        await this.refreshAll();
        this.showInvoice(billId);
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });

    // Expense Form (Create / Edit)
    document.getElementById('form-expense')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const expenseId = document.getElementById('expense-id').value;
      const propId = parseInt(document.getElementById('expense-property-id').value, 10);
      const expenseData = {
        property_id: propId,
        title: document.getElementById('expense-title').value.trim(),
        category: document.getElementById('expense-category').value,
        amount: parseFloat(document.getElementById('expense-amount').value) || 0,
        expense_date: document.getElementById('expense-date').value,
        payment_method: document.getElementById('expense-method').value,
        paid_to: document.getElementById('expense-paid-to').value.trim(),
        notes: document.getElementById('expense-notes').value.trim()
      };

      try {
        if (expenseId) {
          await API.updateExpense(expenseId, expenseData);
          this.toast('Expense updated successfully');
        } else {
          await API.createExpense(expenseData);
          this.toast('Expense logged successfully');
        }
        this.closeModal('modal-expense');
        e.target.reset();
        await this.refreshAll();
        if (this.currentExpensesPropertyId) {
          this.openPropertyExpenses(this.currentExpensesPropertyId);
        }
      } catch (err) {
        alert('Error saving expense: ' + err.message);
      }
    });

    // Email Backup Provider Presets
    document.getElementById('btn-preset-gmail')?.addEventListener('click', () => {
      const elHost = document.getElementById('set-smtp-host');
      const elPort = document.getElementById('set-smtp-port');
      if (elHost) elHost.value = 'smtp.gmail.com';
      if (elPort) elPort.value = '587';
      this.toast('Gmail preset applied (Port 587)');
    });

    document.getElementById('btn-preset-outlook')?.addEventListener('click', () => {
      const elHost = document.getElementById('set-smtp-host');
      const elPort = document.getElementById('set-smtp-port');
      if (elHost) elHost.value = 'smtp-mail.outlook.com';
      if (elPort) elPort.value = '587';
      this.toast('Outlook preset applied (Port 587)');
    });

    document.getElementById('btn-preset-custom')?.addEventListener('click', () => {
      const elHost = document.getElementById('set-smtp-host');
      const elPort = document.getElementById('set-smtp-port');
      if (elHost) elHost.value = '';
      if (elPort) elPort.value = '587';
      elHost?.focus();
    });

    // Test SMTP Connection Button
    document.getElementById('btn-test-email')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-test-email');
      const origText = btn.innerHTML;
      const data = {
        smtp_host: document.getElementById('set-smtp-host')?.value.trim() || '',
        smtp_port: document.getElementById('set-smtp-port')?.value.trim() || '587',
        smtp_user: document.getElementById('set-smtp-user')?.value.trim() || '',
        smtp_pass: document.getElementById('set-smtp-pass')?.value || ''
      };

      if (!data.smtp_host || !data.smtp_user) {
        alert('Please fill in SMTP Host and Sender Email first.');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Testing...';

      try {
        const res = await API.testEmailBackup(data);
        this.toast('✅ ' + (res.message || 'Connection successful!'));
      } catch (err) {
        alert('❌ SMTP Test Failed:\n' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
        this.refreshIcons();
      }
    });

    // Send Backup Now Button
    document.getElementById('btn-send-email-now')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-send-email-now');
      const origText = btn.innerHTML;
      const data = {
        smtp_host: document.getElementById('set-smtp-host')?.value.trim() || '',
        smtp_port: document.getElementById('set-smtp-port')?.value.trim() || '587',
        smtp_user: document.getElementById('set-smtp-user')?.value.trim() || '',
        smtp_pass: document.getElementById('set-smtp-pass')?.value || '',
        smtp_to: document.getElementById('set-smtp-to')?.value.trim() || '',
        auto_backup_enabled: document.getElementById('set-auto-backup-enabled')?.checked || false,
        auto_backup_interval: document.getElementById('set-backup-interval')?.value || 'daily'
      };

      if (!data.smtp_host || !data.smtp_user) {
        alert('Please fill in SMTP Host and Sender Email first.');
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Sending...';

      try {
        const res = await API.sendEmailBackup(data);
        this.toast('📧 ' + (res.message || 'Backup sent successfully!'));
        await this.loadSettings();
      } catch (err) {
        alert('❌ Failed to send backup email:\n' + err.message);
      } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
        this.refreshIcons();
      }
    });

    // Settings Form
    document.getElementById('form-settings')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        currency_symbol: '₹',
        auto_backup_enabled: document.getElementById('set-auto-backup-enabled')?.checked ? 'true' : 'false',
        auto_backup_interval: document.getElementById('set-backup-interval')?.value || 'daily',
        smtp_host: document.getElementById('set-smtp-host')?.value.trim() || '',
        smtp_port: document.getElementById('set-smtp-port')?.value.trim() || '587',
        smtp_user: document.getElementById('set-smtp-user')?.value.trim() || '',
        smtp_pass: document.getElementById('set-smtp-pass')?.value || '',
        smtp_to: document.getElementById('set-smtp-to')?.value.trim() || ''
      };
      try {
        await API.updateSettings(payload);
        window.APP_CURRENCY = '₹';
        this.closeModal('modal-settings');
        this.toast('Settings & Email Backup updated');
        await this.refreshAll();
      } catch (err) {
        alert('Failed saving settings: ' + err.message);
      }
    });
  },

  async loadSettings() {
    try {
      const s = await API.getSettings();
      window.APP_CURRENCY = '₹';

      // Auto backup settings
      const elAuto = document.getElementById('set-auto-backup-enabled');
      if (elAuto) elAuto.checked = (s.auto_backup_enabled === true || s.auto_backup_enabled === 'true');

      const elInterval = document.getElementById('set-backup-interval');
      if (elInterval) elInterval.value = s.auto_backup_interval || 'daily';

      const elHost = document.getElementById('set-smtp-host');
      if (elHost) elHost.value = s.smtp_host || '';

      const elPort = document.getElementById('set-smtp-port');
      if (elPort) elPort.value = s.smtp_port || '587';

      const elUser = document.getElementById('set-smtp-user');
      if (elUser) elUser.value = s.smtp_user || '';

      const elPass = document.getElementById('set-smtp-pass');
      if (elPass) elPass.value = s.smtp_pass || '';

      const elTo = document.getElementById('set-smtp-to');
      if (elTo) elTo.value = s.smtp_to || '';

      // Backup status box
      const elStatus = document.getElementById('text-backup-last-status');
      if (elStatus) elStatus.textContent = s.last_backup_email_status || 'No backups sent yet';

      const elTime = document.getElementById('text-backup-last-time');
      if (elTime) elTime.textContent = s.last_backup_email_time ? `Last sent: ${s.last_backup_email_time}` : '';

      // Set current URL in settings
      const lanUrl = document.getElementById('lan-current-url');
      if (lanUrl) lanUrl.textContent = window.location.origin;
      this.refreshIcons();
    } catch (e) {
      console.error(e);
    }
  },

  async refreshAll() {
    await Promise.all([
      this.loadProperties(),
      this.loadTenants(),
      this.loadBills(),
      this.loadDashboard()
    ]);
    if (this.currentLedgerTenantId && document.getElementById('modal-ledger')?.classList.contains('active')) {
      await this.openTenantLedger(this.currentLedgerTenantId);
    }
    this.refreshIcons();
  },

  bindDashboardControls() {
    const monthSelect = document.getElementById('dash-month-select');
    if (monthSelect) {
      monthSelect.addEventListener('change', async (e) => {
        this.selectedDashboardMonth = e.target.value;
        await this.loadDashboard();
      });
    }

    const prevBtn = document.getElementById('btn-month-prev');
    if (prevBtn) {
      prevBtn.addEventListener('click', async () => {
        if (!monthSelect || monthSelect.options.length <= 1) return;
        const curIdx = monthSelect.selectedIndex;
        if (curIdx < monthSelect.options.length - 1) {
          monthSelect.selectedIndex = curIdx + 1;
          this.selectedDashboardMonth = monthSelect.value;
          await this.loadDashboard();
        }
      });
    }

    const nextBtn = document.getElementById('btn-month-next');
    if (nextBtn) {
      nextBtn.addEventListener('click', async () => {
        if (!monthSelect || monthSelect.options.length <= 1) return;
        const curIdx = monthSelect.selectedIndex;
        if (curIdx > 0) {
          monthSelect.selectedIndex = curIdx - 1;
          this.selectedDashboardMonth = monthSelect.value;
          await this.loadDashboard();
        }
      });
    }

    // Unit Status Filter Buttons (All / Occupied / Vacant)
    document.querySelectorAll('.unit-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.getAttribute('data-unit-filter') || 'all';
        this.currentUnitFilter = filter;
        document.querySelectorAll('.unit-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderOccupancyUnitGrid();
      });
    });
  },

  async loadDashboard() {
    try {
      const data = await API.getDashboard(this.selectedDashboardMonth);
      const curr = window.APP_CURRENCY || '₹';

      // 1. Synchronize Month Selector Options
      const monthSelect = document.getElementById('dash-month-select');
      if (monthSelect) {
        const available = data.available_months || [];
        const currentSelected = data.selected_month || '';
        this.selectedDashboardMonth = currentSelected;

        // Build list: all unique months + ALL Time
        const currentCalendarMonth = new Date().toISOString().slice(0, 7);
        const setMonths = new Set(available);
        setMonths.add(currentCalendarMonth);
        const sortedMonths = Array.from(setMonths).sort().reverse();

        monthSelect.innerHTML = sortedMonths.map(m => {
          // Format month name nicely e.g. "Sep 2026"
          let displayMonth = m;
          try {
            const parts = m.split('-');
            if (parts.length === 2) {
              const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
              displayMonth = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
            }
          } catch (e) {}
          return `<option value="${m}" ${m === currentSelected ? 'selected' : ''}>${displayMonth}</option>`;
        }).join('') + `<option value="ALL" ${currentSelected === 'ALL' ? 'selected' : ''}>All Time</option>`;
      }

      // 2. Collection Progress Bar
      const collPct = Math.round(data.collection_rate || 0);
      const pctEl = document.getElementById('dash-collection-pct');
      const barEl = document.getElementById('dash-collection-bar');
      const subEl = document.getElementById('dash-collection-subtext');

      if (pctEl) pctEl.textContent = `${collPct}%`;
      if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, collPct))}%`;
      if (subEl) {
        subEl.textContent = `${this.formatMoney(data.total_collected, true)} collected of ${this.formatMoney(data.total_billed, true)} billed`;
        subEl.title = `Collected: ${this.formatFullMoney(data.total_collected)} of ${this.formatFullMoney(data.total_billed)}`;
      }

      // 3. Quick Stats Grid (Clean compact formatting for Crores, Lakhs, and Large Numbers)
      const setStatCard = (id, amount) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.textContent = this.formatMoney(amount, true);
        el.title = this.formatFullMoney(amount);
      };

      setStatCard('dash-total-billed', data.total_billed);
      setStatCard('dash-total-collected', data.total_collected);
      setStatCard('dash-total-pending', data.total_pending);
      setStatCard('dash-total-overdue', data.total_overdue);

      const expEl = document.getElementById('dash-total-expenses');
      if (expEl) {
        expEl.textContent = this.formatMoney(data.total_expenses || 0, true);
        expEl.title = this.formatFullMoney(data.total_expenses || 0);
      }
      const netProfitEl = document.getElementById('dash-net-profit');
      if (netProfitEl) {
        const np = data.net_profit || 0;
        netProfitEl.textContent = this.formatMoney(np, true);
        netProfitEl.title = this.formatFullMoney(np);
        netProfitEl.style.color = np >= 0 ? 'var(--success)' : 'var(--danger)';
      }

      // 4. Action Required Feed
      const actionFeed = document.getElementById('dash-action-feed');
      const actionBadge = document.getElementById('dash-action-count');
      const periodHint = document.getElementById('dash-action-period-hint');

      const overdueList = (data.action_required && data.action_required.overdue_bills) || [];
      const unbilledList = (data.action_required && data.action_required.unbilled_tenants) || [];
      const totalAlerts = overdueList.length + unbilledList.length;

      if (periodHint) {
        periodHint.textContent = data.selected_month === 'ALL' ? 'All-Time Pending' : `For ${data.selected_month}`;
      }

      if (actionBadge) {
        if (totalAlerts > 0) {
          actionBadge.textContent = totalAlerts;
          actionBadge.style.display = 'inline-block';
        } else {
          actionBadge.style.display = 'none';
        }
      }

      if (actionFeed) {
        if (totalAlerts === 0) {
          actionFeed.innerHTML = `
            <div class="action-empty-state">
              <i data-lucide="check-circle-2" style="color:var(--success); width:18px; height:18px;"></i>
              <span>All caught up! No overdue bills or unbilled tenants for this period.</span>
            </div>
          `;
        } else {
          let html = '';
          // Overdue Bills
          overdueList.forEach(b => {
            const balance = b.total_amount - b.paid_amount;
            html += `
              <div class="action-card card-overdue">
                <div class="action-card-left">
                  <div class="action-card-name">
                    <span>${b.tenant_name}</span>
                    <span class="badge badge-overdue" style="font-size:0.68rem; padding:1px 6px;">Overdue</span>
                  </div>
                  <div class="action-card-sub">
                    ${b.property_name} • Due: ${b.due_date} • <strong title="${this.formatFullMoney(balance)}">Balance: ${this.formatMoney(balance, true)}</strong>
                  </div>
                </div>
                <div class="action-card-right">
                  <button type="button" class="btn-whatsapp-action" onclick="App.sendOverdueWhatsAppReminder(${b.id})" title="Send Reminder">
                    <i data-lucide="send" style="width:13px; height:13px;"></i> Remind
                  </button>
                </div>
              </div>
            `;
          });

          // Unbilled Tenants
          unbilledList.forEach(t => {
            html += `
              <div class="action-card card-unbilled">
                <div class="action-card-left">
                  <div class="action-card-name">
                    <span>${t.name}</span>
                    <span class="badge badge-date" style="font-size:0.68rem; padding:1px 6px;">Not Billed</span>
                  </div>
                  <div class="action-card-sub">
                    Unit: ${t.property_name || 'No Unit'} • Phone: <a href="tel:${(t.phone || '').replace(/[^0-9+]/g, '')}" class="phone-link" title="Tap to call ${t.phone}">${t.phone}</a>
                  </div>
                </div>
                <div class="action-card-right">
                  <button type="button" class="btn btn-primary btn-sm" onclick="App.openBillModalForTenant(${t.id})">
                    <i data-lucide="plus"></i> Bill
                  </button>
                </div>
              </div>
            `;
          });

          actionFeed.innerHTML = html;
        }
      }

      // 5. Occupancy & Unit Status Matrix Widget
      if (!this.properties || this.properties.length === 0) {
        this.properties = await API.getProperties().catch(() => []);
      }
      if (!this.tenants || this.tenants.length === 0) {
        this.tenants = await API.getTenants().catch(() => []);
      }

      const totalUnits = (this.properties && this.properties.length > 0) ? this.properties.length : (data.total_properties || 0);
      const activeTenantsMap = (this.tenants || []).filter(t => t.is_active && t.property_id);
      const occupiedUnits = new Set(activeTenantsMap.map(t => t.property_id)).size;
      const vacantUnits = Math.max(0, totalUnits - occupiedUnits);
      const occPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

      const occBadge = document.getElementById('dash-occupancy-badge');
      if (occBadge) occBadge.textContent = `${occupiedUnits}/${totalUnits} Units (${occPct}%)`;

      this.renderOccupancyUnitGrid();

      // 6. Utility Pulse
      const elecUnitsEl = document.getElementById('dash-total-elec-units');
      const elecAmountEl = document.getElementById('dash-total-elec-amount');
      const waterUnitsEl = document.getElementById('dash-total-water-units');
      const waterAmountEl = document.getElementById('dash-total-water-amount');

      if (elecUnitsEl) elecUnitsEl.textContent = `${(data.total_elec_units || 0).toLocaleString()} Units`;
      if (elecAmountEl) {
        elecAmountEl.textContent = `${this.formatMoney(data.total_elec_amount || 0, true)} billed`;
        elecAmountEl.title = this.formatFullMoney(data.total_elec_amount || 0);
      }
      if (waterUnitsEl) waterUnitsEl.textContent = `${(data.total_water_units || 0).toLocaleString()} Units`;
      if (waterAmountEl) {
        waterAmountEl.textContent = `${this.formatMoney(data.total_water_amount || 0, true)} billed`;
        waterAmountEl.title = this.formatFullMoney(data.total_water_amount || 0);
      }

      this.refreshIcons();
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  },

  openNewTenantForProperty(propertyId) {
    this.openModal('modal-tenant');
    document.getElementById('form-tenant')?.reset();
    document.getElementById('tenant-id').value = '';
    document.getElementById('modal-tenant-title').textContent = 'Add New Tenant';
    const propSelect = document.getElementById('tenant-prop-id');
    if (propSelect) propSelect.value = propertyId;
    const btnMoveOutCalc = document.getElementById('btn-tenant-move-out-calc');
    if (btnMoveOutCalc) btnMoveOutCalc.style.display = 'none';
    const statusSelect = document.getElementById('tenant-is-active');
    if (statusSelect) statusSelect.value = '1';
  },

  getUnitTypeSvg(type = '') {
    const t = (type || '').toLowerCase();
    if (t.includes('house') || t.includes('villa') || t.includes('home')) {
      // Independent House / Villa
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>`;
    }
    if (t.includes('room') || t.includes('bed') || t.includes('pg') || t.includes('single') || t.includes('studio')) {
      // Room / Bed / PG / Studio
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 4v16"/>
        <path d="M2 8h18a2 2 0 0 1 2 2v10"/>
        <path d="M2 17h20"/>
        <path d="M6 8v9"/>
      </svg>`;
    }
    if (t.includes('shop') || t.includes('commercial') || t.includes('store') || t.includes('office')) {
      // Commercial / Storefront / Shop
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l1-5h16l1 5"/>
        <path d="M3 9v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9"/>
        <path d="M9 22V12h6v10"/>
        <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>
      </svg>`;
    }
    // Default: Multi-Storey Apartment / Residential Flat
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
      <path d="M9 22v-4h6v4"/>
      <path d="M8 6h.01"/><path d="M16 6h.01"/>
      <path d="M8 10h.01"/><path d="M16 10h.01"/>
      <path d="M8 14h.01"/><path d="M16 14h.01"/>
    </svg>`;
  },

  renderOccupancyUnitGrid() {
    const grid = document.getElementById('dash-unit-grid');
    if (!grid) return;

    const properties = this.properties || [];
    const tenants = this.tenants || [];
    const curr = window.APP_CURRENCY || '₹';

    if (properties.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="padding:20px; grid-column: 1 / -1;">
          <i data-lucide="building-2" style="width:28px; height:28px; color:var(--text-muted); margin-bottom:6px;"></i>
          <div>No properties registered yet. Tap "Add Property" to begin.</div>
        </div>
      `;
      this.refreshIcons();
      return;
    }

    // Sort properties alphabetically by name for a predictable matrix order
    const sortedProps = [...properties].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    // Map each property to its occupancy status & active tenant
    const unitsData = sortedProps.map((p, idx) => {
      const activeTenants = tenants.filter(t => t.property_id == p.id && t.is_active);
      const isOccupied = activeTenants.length > 0;
      const primaryTenant = isOccupied ? activeTenants[0] : null;
      return {
        property: p,
        isOccupied: isOccupied,
        tenants: activeTenants,
        primaryTenant: primaryTenant,
        unitIndex: idx + 1
      };
    });

    const occupiedCount = unitsData.filter(s => s.isOccupied).length;
    const vacantCount = unitsData.length - occupiedCount;

    // Update filter counts
    const cntAll = document.getElementById('unit-filter-cnt-all');
    const cntOcc = document.getElementById('unit-filter-cnt-occ');
    const cntVac = document.getElementById('unit-filter-cnt-vac');

    if (cntAll) cntAll.textContent = unitsData.length;
    if (cntOcc) cntOcc.textContent = occupiedCount;
    if (cntVac) cntVac.textContent = vacantCount;

    // Filter by selected filter (all, occupied, vacant)
    const activeFilter = this.currentUnitFilter || 'all';
    const filteredUnits = unitsData.filter(s => {
      if (activeFilter === 'occupied') return s.isOccupied;
      if (activeFilter === 'vacant') return !s.isOccupied;
      return true;
    });

    if (filteredUnits.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="padding:20px; grid-column: 1 / -1;">
          <div>No ${activeFilter} units found.</div>
        </div>
      `;
      this.refreshIcons();
      return;
    }

    grid.innerHTML = filteredUnits.map(s => {
      const p = s.property;
      const isOccupied = s.isOccupied;
      const tenantCount = s.tenants ? s.tenants.length : 0;
      const typeSvg = this.getUnitTypeSvg(p.unit_type);
      const addr = (p.address || '').trim();
      const unitTypeLabel = p.unit_type ? (p.unit_type.charAt(0).toUpperCase() + p.unit_type.slice(1)) : 'Apartment';
      const displaySubtitle = addr || unitTypeLabel;
      const subtitleIcon = addr ? 'map-pin' : 'building-2';

      const tooltip = isOccupied
        ? `${p.name}${addr ? ` • ${addr}` : ''} • ${tenantCount} tenant${tenantCount === 1 ? '' : 's'} linked (${s.tenants.map(tn => tn.name).join(', ')})`
        : `${p.name}${addr ? ` • ${addr}` : ''} • Vacant`;

      const badgeTooltip = isOccupied
        ? `${tenantCount} tenant${tenantCount === 1 ? '' : 's'} linked`
        : 'Vacant (0 tenants)';

      return `
        <div class="unit-card ${isOccupied ? 'unit-occupied' : 'unit-vacant'}" 
             title="${tooltip}"
             onclick="App.showUnitDetail(${p.id})">
          <!-- Left Side: Icon with Number Badge on Top -->
          <div class="unit-type-icon" title="${unitTypeLabel}">
            ${typeSvg}
            <span class="unit-badge" title="${badgeTooltip}">${tenantCount}</span>
          </div>

          <!-- Right Side: Details -->
          <div class="unit-card-right">
            <div class="unit-name" title="${p.name}">${p.name}</div>
            <div class="unit-address" title="${displaySubtitle}">
              <i data-lucide="${subtitleIcon}" class="unit-address-pin"></i>
              <span>${displaySubtitle}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.refreshIcons();
  },

  openAddTenantForProperty(propertyId) {
    this.closeModal('modal-unit-detail');
    this.openTenantModal();
    const propSelect = document.getElementById('tenant-prop-id');
    if (propSelect) {
      propSelect.value = propertyId;
    }
  },

  showUnitDetail(propertyId) {
    const p = (this.properties || []).find(prop => prop.id == propertyId);
    if (!p) return;

    const activeTenants = (this.tenants || []).filter(t => t.property_id == p.id && t.is_active);
    const isOccupied = activeTenants.length > 0;
    const curr = window.APP_CURRENCY || '₹';
    const typeSvg = this.getUnitTypeSvg(p.unit_type);
    const unitTypeLabel = p.unit_type ? (p.unit_type.charAt(0).toUpperCase() + p.unit_type.slice(1)) : 'Apartment';
    const addr = (p.address || '').trim();

    // Set Header
    const iconWrap = document.getElementById('unit-detail-icon-wrap');
    if (iconWrap) {
      iconWrap.innerHTML = typeSvg;
      if (isOccupied) {
        iconWrap.style.background = 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)';
        iconWrap.style.color = '#059669';
        iconWrap.style.border = '1px solid #a7f3d0';
      } else {
        iconWrap.style.background = 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)';
        iconWrap.style.color = '#64748b';
        iconWrap.style.border = '1px solid var(--border)';
      }
    }

    const titleEl = document.getElementById('unit-detail-title');
    if (titleEl) titleEl.textContent = p.name;

    const badgeEl = document.getElementById('unit-detail-status-badge');
    if (badgeEl) {
      if (isOccupied) {
        badgeEl.className = 'badge badge-paid';
        badgeEl.style.fontSize = '0.75rem';
        badgeEl.innerHTML = `<i data-lucide="check-circle" style="width:11px; height:11px; vertical-align:-1px;"></i> Occupied (${activeTenants.length} Tenant${activeTenants.length === 1 ? '' : 's'})`;
      } else {
        badgeEl.className = 'badge';
        badgeEl.style.background = 'var(--surface-alt)';
        badgeEl.style.color = 'var(--text-muted)';
        badgeEl.style.border = '1px solid var(--border)';
        badgeEl.style.fontSize = '0.75rem';
        badgeEl.innerHTML = `<i data-lucide="door-open" style="width:11px; height:11px; vertical-align:-1px;"></i> Vacant`;
      }
    }

    const addrEl = document.getElementById('unit-detail-address');
    if (addrEl) {
      addrEl.textContent = addr ? `${addr} • ${unitTypeLabel}` : unitTypeLabel;
    }

    // Build Body Content
    const bodyEl = document.getElementById('unit-detail-body');
    if (bodyEl) {
      bodyEl.innerHTML = `
        <!-- Section 1: Rate & Utility Structure -->
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px;">
          <div style="font-size:0.8rem; font-weight:750; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em; margin-bottom:10px;">
            <i data-lucide="sliders" style="width:13px; height:13px; vertical-align:-2px; color:var(--primary);"></i> Rental Rates &amp; Utility Settings
          </div>
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;">
            <div style="background:var(--surface-alt); border-radius:var(--radius-sm); padding:9px 12px; border:1px solid var(--border);">
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block;">Base Rent</span>
              <span style="font-size:1rem; font-weight:800; color:var(--text-main);">${curr}${Number(p.default_rent || 0).toLocaleString()} <small style="font-size:0.7rem; font-weight:500; color:var(--text-muted);">/ mo</small></span>
            </div>
            <div style="background:var(--surface-alt); border-radius:var(--radius-sm); padding:9px 12px; border:1px solid var(--border);">
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block;">Electricity</span>
              <span style="font-size:1rem; font-weight:800; color:#d97706;">${curr}${p.electricity_rate || 0} <small style="font-size:0.7rem; font-weight:500; color:var(--text-muted);">/ unit</small></span>
            </div>
            <div style="background:var(--surface-alt); border-radius:var(--radius-sm); padding:9px 12px; border:1px solid var(--border);">
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block;">Water Billing</span>
              <span style="font-size:1rem; font-weight:800; color:var(--primary);">${p.water_billing_type === 'METER' ? `${curr}${p.water_rate || 0} <small style="font-size:0.7rem; font-weight:500; color:var(--text-muted);">/ unit</small>` : `${curr}${p.water_charge || 0} <small style="font-size:0.7rem; font-weight:500; color:var(--text-muted);">Fixed</small>`}</span>
            </div>
            <div style="background:var(--surface-alt); border-radius:var(--radius-sm); padding:9px 12px; border:1px solid var(--border);">
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block;">Maintenance</span>
              <span style="font-size:1rem; font-weight:800; color:var(--text-main);">${curr}${p.maintenance_charge || 0} <small style="font-size:0.7rem; font-weight:500; color:var(--text-muted);">/ mo</small></span>
            </div>
          </div>
        </div>

        <!-- Section 2: Expense & Financials -->
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md); padding:12px 14px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-size:0.78rem; color:var(--text-muted);">
              Total Incurred Expenses: <strong style="color:var(--danger);">${curr}${(p.total_expenses || 0).toFixed(2)}</strong> (${p.expense_count || 0})
            </div>
            <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
              Net Financial Yield: <strong style="color:${(p.net_profit || 0) >= 0 ? 'var(--success)' : 'var(--danger)'};">${curr}${(p.net_profit || 0).toFixed(2)}</strong>
            </div>
          </div>
          <div style="display:flex; gap:6px;">
            <button type="button" class="btn btn-sm btn-secondary" onclick="App.closeModal('modal-unit-detail'); App.openAddExpenseModal(${p.id});">
              <i data-lucide="plus" style="width:13px; height:13px;"></i> Log Expense
            </button>
            <button type="button" class="btn btn-sm btn-secondary" onclick="App.closeModal('modal-unit-detail'); App.openPropertyExpenses(${p.id});">
              <i data-lucide="wrench" style="width:13px; height:13px;"></i> View Ledger
            </button>
          </div>
        </div>
      `;
    }

    // Set Footer
    const footerEl = document.getElementById('unit-detail-footer');
    if (footerEl) {
      footerEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; width:100%; gap:8px;">
          <button type="button" class="btn btn-secondary" data-close="modal-unit-detail">Close</button>
          <button type="button" class="btn btn-primary" onclick="App.closeModal('modal-unit-detail'); App.editProperty(${p.id});">
            <i data-lucide="edit-3" style="width:14px; height:14px;"></i> Edit Property
          </button>
        </div>
      `;
    }

    this.openModal('modal-unit-detail');
    this.refreshIcons();
  },

  async sendOverdueWhatsAppReminder(billId) {
    this.openReminderModalForBill(billId);
  },

  bindSearchAndFilters() {
    // Tenant Search
    const tenantInput = document.getElementById('tenant-search-input');
    const tenantClear = document.getElementById('tenant-search-clear');
    if (tenantInput) {
      tenantInput.addEventListener('input', (e) => {
        this.tenantSearchQuery = e.target.value.trim().toLowerCase();
        if (tenantClear) {
          tenantClear.style.display = this.tenantSearchQuery ? 'block' : 'none';
        }
        this.renderTenantsList();
      });
    }

    if (tenantClear) {
      tenantClear.addEventListener('click', () => {
        if (tenantInput) tenantInput.value = '';
        this.tenantSearchQuery = '';
        tenantClear.style.display = 'none';
        this.renderTenantsList();
      });
    }

    // Tenant Filter Pills
    const tenantPills = document.querySelectorAll('#tenant-filter-pills .filter-pill');
    tenantPills.forEach(pill => {
      pill.addEventListener('click', () => {
        tenantPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.tenantFilter = pill.getAttribute('data-filter') || 'all';
        this.renderTenantsList();
      });
    });

    // Property Search
    const propInput = document.getElementById('property-search-input');
    const propClear = document.getElementById('property-search-clear');
    if (propInput) {
      propInput.addEventListener('input', (e) => {
        this.propertySearchQuery = e.target.value.trim().toLowerCase();
        if (propClear) {
          propClear.style.display = this.propertySearchQuery ? 'block' : 'none';
        }
        this.renderPropertiesList();
      });
    }

    if (propClear) {
      propClear.addEventListener('click', () => {
        if (propInput) propInput.value = '';
        this.propertySearchQuery = '';
        propClear.style.display = 'none';
        this.renderPropertiesList();
      });
    }

    // Property Filter Pills
    const propPills = document.querySelectorAll('#property-filter-pills .filter-pill');
    propPills.forEach(pill => {
      pill.addEventListener('click', () => {
        propPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.propertyFilter = pill.getAttribute('data-filter') || 'all';
        this.renderPropertiesList();
      });
    });
  },

  async loadProperties() {
    try {
      this.properties = await API.getProperties();

      // Update tenant modal property dropdown
      const tenantPropSelect = document.getElementById('tenant-prop-id');
      if (tenantPropSelect) {
        tenantPropSelect.innerHTML = `<option value="">-- Select Property --</option>` +
          this.properties.map(p => `<option value="${p.id}">${p.name} (${p.unit_type})</option>`).join('');
      }

      this.renderPropertiesList();
    } catch (err) {
      console.error(err);
    }
  },

  renderPropertiesList() {
    const container = document.getElementById('properties-list-container');
    if (!container) return;
    const curr = window.APP_CURRENCY || '₹';

    if (!this.properties || this.properties.length === 0) {
      container.innerHTML = `<div class="empty-state">No properties added yet. Tap "Add Property" to begin.</div>`;
      return;
    }

    // Filter properties
    let filtered = this.properties.filter(p => {
      // 1. Text Search
      if (this.propertySearchQuery) {
        const q = this.propertySearchQuery;
        const matchName = (p.name || '').toLowerCase().includes(q);
        const matchAddr = (p.address || '').toLowerCase().includes(q);
        const matchType = (p.unit_type || '').toLowerCase().includes(q);
        if (!matchName && !matchAddr && !matchType) return false;
      }

      // 2. Status Filter Pill
      const isOccupied = (p.tenant_count || 0) > 0;
      if (this.propertyFilter === 'occupied' && !isOccupied) return false;
      if (this.propertyFilter === 'vacant' && isOccupied) return false;

      return true;
    });

    // Update subtitle
    const subTitle = document.getElementById('properties-count-subtitle');
    if (subTitle) {
      subTitle.textContent = `Showing ${filtered.length} of ${this.properties.length} units`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:24px;">
          <i data-lucide="search-x" style="width:28px; height:28px; color:var(--text-muted); margin-bottom:8px;"></i>
          <div>No properties match "<strong>${this.propertySearchQuery}</strong>"</div>
        </div>
      `;
      this.refreshIcons();
      return;
    }

    container.innerHTML = filtered.map(p => `
      <div class="app-card">
        <div class="card-top">
          <div>
            <div class="card-title">${p.name}</div>
            <div class="card-subtitle">${p.unit_type} • ${p.address || 'No address'}</div>
          </div>
          <div class="card-top-right">
            <span class="badge ${p.tenant_count > 0 ? 'badge-paid' : 'badge-date'}">${p.tenant_count || 0} Tenant${p.tenant_count === 1 ? '' : 's'}</span>
            <div class="card-dropdown">
              <button type="button" class="btn-card-more" onclick="App.toggleDropdown(this, event)" aria-label="More options">
                <i data-lucide="more-vertical"></i>
              </button>
              <div class="card-dropdown-menu">
                <button type="button" class="dropdown-item" onclick="App.openAddExpenseModal(${p.id})">
                  <i data-lucide="plus"></i> Add Expense
                </button>
                <button type="button" class="dropdown-item" onclick="App.openPropertyExpenses(${p.id})">
                  <i data-lucide="wrench"></i> View Expenses ${p.expense_count ? `(${p.expense_count})` : ''}
                </button>
                <button type="button" class="dropdown-item" onclick="App.editProperty(${p.id})">
                  <i data-lucide="edit-3"></i> Edit Property
                </button>
                <button type="button" class="dropdown-item dropdown-item-danger" onclick="App.deleteProperty(${p.id})">
                  <i data-lucide="trash-2"></i> Delete Property
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="card-middle">
          <span class="card-amount-label">Base Rent</span>
          <span class="card-amount-val" title="${this.formatFullMoney(p.default_rent)}">${this.formatMoney(p.default_rent, true)}</span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;">
          <span><i data-lucide="zap" style="width:14px; height:14px; vertical-align:-2px; color:var(--warning);"></i> Elec: ${curr}${p.electricity_rate}/unit</span>
          <span><i data-lucide="droplet" style="width:14px; height:14px; vertical-align:-2px; color:var(--primary);"></i> Water: ${p.water_billing_type === 'METER' ? `${curr}${p.water_rate}/unit (Meter)` : `${curr}${p.water_charge} (Fixed)`}</span>
          <span><i data-lucide="wrench" style="width:14px; height:14px; vertical-align:-2px;"></i> Maint: ${curr}${p.maintenance_charge}</span>
        </div>
        ${(p.expense_count > 0 || p.total_expenses > 0) ? `
          <div style="font-size:0.75rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; background:var(--surface-alt); padding:5px 8px; border-radius:var(--radius-sm); margin-top:8px;">
            <span><i data-lucide="wrench" style="width:13px; height:13px; color:#dc2626; vertical-align:-2px;"></i> Expenses: <strong style="color:#dc2626;" title="${this.formatFullMoney(p.total_expenses || 0)}">${this.formatMoney(p.total_expenses || 0, true)}</strong> (${p.expense_count || 0})</span>
            <span>Net Profit: <strong style="color:${(p.net_profit || 0) >= 0 ? 'var(--success)' : 'var(--danger)'};" title="${this.formatFullMoney(p.net_profit || 0)}">${this.formatMoney(p.net_profit || 0, true)}</strong></span>
          </div>
        ` : ''}
      </div>
    `).join('');
    this.refreshIcons();
  },

  async editProperty(id) {
    try {
      const p = await API.getProperty(id);
      document.getElementById('prop-id').value = p.id;
      document.getElementById('modal-property-title').textContent = 'Edit Property / Unit';
      document.getElementById('prop-name').value = p.name;
      document.getElementById('prop-type').value = p.unit_type || 'Apartment';
      document.getElementById('prop-address').value = p.address || '';
      document.getElementById('prop-rent').value = p.default_rent || 0;
      document.getElementById('prop-elec-rate').value = p.electricity_rate || 0;
      document.getElementById('prop-water-type').value = p.water_billing_type || 'FIXED';
      document.getElementById('prop-water').value = p.water_charge || 0;
      document.getElementById('prop-water-rate').value = p.water_rate || 0;
      document.getElementById('prop-maint').value = p.maintenance_charge || 0;

      const isMeter = p.water_billing_type === 'METER';
      document.getElementById('group-prop-water-fixed').style.display = isMeter ? 'none' : 'block';
      document.getElementById('group-prop-water-meter').style.display = isMeter ? 'block' : 'none';

      this.openModal('modal-property');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  async deleteProperty(id) {
    const prop = this.properties.find(p => p.id == id);
    const propName = prop ? prop.name : 'this property';
    const tenantCount = prop ? (prop.tenant_count || 0) : 0;

    let warningHtml = `Are you sure you want to delete <strong>${propName}</strong>?`;
    if (tenantCount > 0) {
      warningHtml += `<br><br><span style="color:var(--danger); font-weight:600;"><i data-lucide="alert-circle" style="width:14px; height:14px; vertical-align:-2px;"></i> Warning:</span> ${tenantCount} tenant(s) are currently assigned to this unit.`;
    }

    this.confirmDelete({
      title: 'Delete Property / Unit',
      subtitle: propName,
      warningHtml: warningHtml,
      buttonLabel: 'Hold to Delete Property (10s)',
      onConfirm: async () => {
        try {
          await API.deleteProperty(id);
          this.toast('Property deleted successfully');
          await this.refreshAll();
        } catch (err) {
          alert('Error deleting property: ' + err.message);
        }
      }
    });
  },

  async loadTenants() {
    try {
      this.tenants = await API.getTenants();

      // Update Bill Modal tenant select
      const billTenantSelect = document.getElementById('bill-tenant-select');
      if (billTenantSelect) {
        billTenantSelect.innerHTML = `<option value="">-- Choose Tenant --</option>` +
          this.tenants.filter(t => t.is_active).map(t => `<option value="${t.id}">${t.name} (${t.property_name || 'No Unit'})</option>`).join('');
      }

      this.renderTenantsList();
    } catch (err) {
      console.error(err);
    }
  },

  renderTenantsList() {
    const container = document.getElementById('tenants-list-container');
    if (!container) return;
    const curr = window.APP_CURRENCY || '₹';

    if (!this.tenants || this.tenants.length === 0) {
      container.innerHTML = `<div class="empty-state">No tenants found. Tap "Add Tenant" to begin.</div>`;
      return;
    }

    // Filter tenants
    let filtered = this.tenants.filter(t => {
      // 1. Text Search (name, phone, property_name, co-occupants)
      if (this.tenantSearchQuery) {
        const q = this.tenantSearchQuery;
        const matchName = (t.name || '').toLowerCase().includes(q);
        const matchPhone = (t.phone || '').toLowerCase().includes(q);
        const matchProp = (t.property_name || '').toLowerCase().includes(q);
        const matchCo = (t.co_occupants || []).some(co => (co.name || '').toLowerCase().includes(q) || (co.phone || '').toLowerCase().includes(q))
          || (t.co_occupant_name || '').toLowerCase().includes(q)
          || (t.co_occupant_phone || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchProp && !matchCo) return false;
      }

      // 2. Status Filter Pill (all, active, past)
      if (this.tenantFilter === 'active' && !t.is_active) return false;
      if (this.tenantFilter === 'past' && t.is_active) return false;

      return true;
    });

    // Sort: Active tenants first (A-Z), Past tenants at the end of the list (A-Z)
    filtered.sort((a, b) => {
      if (a.is_active === b.is_active) {
        return (a.name || '').localeCompare(b.name || '');
      }
      return a.is_active ? -1 : 1;
    });

    // Update subtitle
    const subTitle = document.getElementById('tenants-count-subtitle');
    if (subTitle) {
      subTitle.textContent = `Showing ${filtered.length} of ${this.tenants.length} tenants`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:24px;">
          <i data-lucide="search-x" style="width:28px; height:28px; color:var(--text-muted); margin-bottom:8px;"></i>
          <div>No tenants match "<strong>${this.tenantSearchQuery}</strong>"</div>
        </div>
      `;
      this.refreshIcons();
      return;
    }

    container.innerHTML = filtered.map(t => {
      const tenantBills = (this.bills || []).filter(b => b.tenant_id === t.id);
      const totalPaid = (t.total_paid !== undefined && t.total_paid !== null)
        ? Number(t.total_paid)
        : tenantBills.reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0);
      const totalDue = (t.total_due !== undefined && t.total_due !== null)
        ? Number(t.total_due)
        : tenantBills.reduce((sum, b) => sum + (Number(b.balance_amount) || (Number(b.total_amount) - Number(b.paid_amount)) || 0), 0);

      const cleanPhone = (t.phone || '').replace(/[^0-9+]/g, '');

      return `
      <div class="app-card tenant-card" id="tenant-card-${t.id}" data-tenant-id="${t.id}">
        <div class="card-top">
          <div>
            <div class="card-title">
              <a href="tel:${cleanPhone}" class="tenant-name-call" title="Tap to call ${t.name}">
                <span>${t.name}</span>
                <i data-lucide="phone-call" style="width:13px; height:13px; margin-left:4px; opacity:0.65; vertical-align:-1px;"></i>
              </a>
            </div>
            <div class="card-subtitle" style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
              <span><i data-lucide="home" style="width:13px; height:13px; vertical-align:-2px; color:var(--primary);"></i> ${t.property_name || 'Unassigned'}</span>
            </div>
          </div>
          <div class="card-top-right">
            <span class="badge ${t.is_active ? 'badge-paid' : 'badge-date'}">${t.is_active ? 'Active' : 'Past'}</span>
            <div class="card-dropdown">
              <button type="button" class="btn-card-more" onclick="App.toggleDropdown(this, event)" aria-label="More options">
                <i data-lucide="more-vertical"></i>
              </button>
              <div class="card-dropdown-menu">
                <button type="button" class="dropdown-item" onclick="App.openBillModalForTenant(${t.id})">
                  <i data-lucide="plus"></i> Generate Bill
                </button>
                <button type="button" class="dropdown-item" onclick="App.openTenantLedger(${t.id})">
                  <i data-lucide="receipt"></i> View Bills
                </button>
                <button type="button" class="dropdown-item" onclick="App.editTenant(${t.id})">
                  <i data-lucide="edit-3"></i> Edit Tenant
                </button>
                ${t.is_active ? `
                  <button type="button" class="dropdown-item" onclick="App.openVacantCalculation(${t.id})">
                    <i data-lucide="user-x"></i> Move Out / Vacant Form
                  </button>
                ` : `
                  <button type="button" class="dropdown-item" onclick="App.openVacantCalculation(${t.id})">
                    <i data-lucide="calculator"></i> Vacant Calculation
                  </button>
                  <button type="button" class="dropdown-item" onclick="App.reactivateTenant(${t.id})">
                    <i data-lucide="user-check"></i> Reactivate Tenant
                  </button>
                `}
                <button type="button" class="dropdown-item dropdown-item-danger" onclick="App.deleteTenant(${t.id})">
                  <i data-lucide="trash-2"></i> Delete Tenant
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="card-middle" style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div class="card-amount-label">Total Paid</div>
            <div class="card-amount-val" style="color:var(--success, #16a34a);" title="${this.formatFullMoney(totalPaid)}">${this.formatMoney(totalPaid, true)}</div>
          </div>
          <div style="text-align:right;">
            <div class="card-amount-label">Total Due</div>
            <div class="card-amount-val" style="color:${totalDue > 0 ? 'var(--danger, #dc2626)' : 'var(--text-muted)'};" title="${this.formatFullMoney(totalDue)}">${this.formatMoney(totalDue, true)}</div>
          </div>
        </div>

        <!-- Expandable Details on Long Press -->
        <div class="tenant-card-details" id="tenant-details-${t.id}" style="display:none;">
          <div class="tenant-details-grid">
            <div class="tenant-detail-item">
              <span class="detail-label">Phone Number</span>
              <span class="detail-val">
                <a href="tel:${cleanPhone}" class="phone-link" title="Tap to call ${t.phone}">
                  <i data-lucide="phone" style="width:12px; height:12px; vertical-align:-2px;"></i> ${t.phone}
                </a>
              </span>
            </div>
            ${t.email ? `
            <div class="tenant-detail-item">
              <span class="detail-label">Email Address</span>
              <span class="detail-val"><a href="mailto:${t.email}" class="phone-link">${t.email}</a></span>
            </div>
            ` : ''}
            <div class="tenant-detail-item">
              <span class="detail-label">Security Deposit</span>
              <span class="detail-val">${curr}${t.security_deposit ? t.security_deposit.toFixed(2) : '0.00'}</span>
            </div>
            <div class="tenant-detail-item">
              <span class="detail-label">Move-in Date</span>
              <span class="detail-val">${t.move_in_date || 'Not set'}</span>
            </div>
            <div class="tenant-detail-item">
              <span class="detail-label">Initial Elec Reading</span>
              <span class="detail-val">${t.initial_elec_meter || 0} kWh</span>
            </div>
            <div class="tenant-detail-item">
              <span class="detail-label">Initial Water Reading</span>
              <span class="detail-val">${t.initial_water_meter || 0} Units</span>
            </div>
            ${(t.co_occupants && t.co_occupants.length > 0) ? `
            <div class="tenant-detail-item" style="grid-column: span 2;">
              <span class="detail-label">Co-occupants / Roommates (${t.co_occupants.length})</span>
              <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
                ${t.co_occupants.map(co => `
                  <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                    <span style="font-weight:600;">${co.name || 'Co-occupant'}</span>
                    ${co.phone ? `
                      <span style="color:var(--text-muted); opacity:0.6;">•</span>
                      <a href="tel:${co.phone.replace(/[^0-9+]/g, '')}" class="phone-link" title="Tap to call ${co.phone}">
                        <i data-lucide="phone" style="width:12px; height:12px; vertical-align:-2px;"></i> ${co.phone}
                      </a>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
            ` : (t.co_occupant_name || t.co_occupant_phone) ? `
            <div class="tenant-detail-item" style="grid-column: span 2;">
              <span class="detail-label">Co-occupant / Roommate</span>
              <span class="detail-val" style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                <span>${t.co_occupant_name || 'Co-occupant'}</span>
                ${t.co_occupant_phone ? `
                  <span style="color:var(--text-muted); opacity:0.6;">•</span>
                  <a href="tel:${t.co_occupant_phone.replace(/[^0-9+]/g, '')}" class="phone-link" title="Tap to call ${t.co_occupant_phone}">
                    <i data-lucide="phone" style="width:12px; height:12px; vertical-align:-2px;"></i> ${t.co_occupant_phone}
                  </a>
                ` : ''}
              </span>
            </div>
            ` : ''}
            ${(t.payment_upi || t.payment_bank_name) ? `
            <div class="tenant-detail-item" style="grid-column: span 2;">
              <span class="detail-label">Payment / Bank Info</span>
              <span class="detail-val" style="display:flex; flex-direction:column; gap:2px;">
                ${t.payment_upi ? `<span>UPI: <strong>${t.payment_upi}</strong></span>` : ''}
                ${t.payment_bank_name ? `<span>Bank: <strong>${t.payment_bank_name}</strong> ${t.payment_account_no ? `(A/C: ${t.payment_account_no})` : ''}</span>` : ''}
                ${t.payment_ifsc ? `<span>IFSC: <strong>${t.payment_ifsc}</strong></span>` : ''}
              </span>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="tenant-card-footer-hint" onclick="App.toggleTenantCardExpand(${t.id})">
          <span>Long-press card to toggle details</span>
          <i data-lucide="chevron-down" style="width:12px; height:12px;"></i>
        </div>
      </div>
    `;
    }).join('');
    this.attachTenantLongPressListeners(container);
    this.refreshIcons();
  },

  attachTenantLongPressListeners(container) {
    if (!container) return;
    container.querySelectorAll('.tenant-card').forEach(card => {
      let timer = null;
      let isLongPress = false;
      let startX = 0;
      let startY = 0;

      const tenantId = card.getAttribute('data-tenant-id');

      const triggerExpand = () => {
        isLongPress = true;
        this.toggleTenantCardExpand(tenantId);
        if (navigator.vibrate) {
          try { navigator.vibrate(50); } catch (e) {}
        }
      };

      const startPress = (e) => {
        // Ignore if clicking interactive children (links, buttons, dropdowns)
        if (e.target.closest('a, button, .card-dropdown, .card-dropdown-menu')) {
          return;
        }
        isLongPress = false;
        if (e.touches && e.touches[0]) {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
        } else {
          startX = e.clientX;
          startY = e.clientY;
        }

        card.classList.add('pressing');
        timer = setTimeout(() => {
          card.classList.remove('pressing');
          triggerExpand();
        }, 500); // 500ms long press threshold
      };

      const cancelPress = () => {
        card.classList.remove('pressing');
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };

      const movePress = (e) => {
        if (!timer) return;
        const currentX = e.touches ? e.touches[0].clientX : e.clientX;
        const currentY = e.touches ? e.touches[0].clientY : e.clientY;
        if (Math.hypot(currentX - startX, currentY - startY) > 10) {
          cancelPress();
        }
      };

      card.addEventListener('touchstart', startPress, { passive: true });
      card.addEventListener('touchend', cancelPress);
      card.addEventListener('touchcancel', cancelPress);
      card.addEventListener('touchmove', movePress, { passive: true });

      card.addEventListener('mousedown', startPress);
      card.addEventListener('mouseup', cancelPress);
      card.addEventListener('mouseleave', cancelPress);
      card.addEventListener('mousemove', movePress);

      card.addEventListener('contextmenu', (e) => {
        if (isLongPress) {
          e.preventDefault();
        }
      });
    });
  },

  toggleTenantCardExpand(tenantId) {
    const details = document.getElementById(`tenant-details-${tenantId}`);
    const card = document.getElementById(`tenant-card-${tenantId}`);
    if (!details || !card) return;

    const isExpanded = card.classList.contains('expanded');
    if (isExpanded) {
      card.classList.remove('expanded');
      details.style.maxHeight = '0px';
      setTimeout(() => {
        details.style.display = 'none';
      }, 250);
    } else {
      card.classList.add('expanded');
      details.style.display = 'block';
      details.style.maxHeight = '0px';
      requestAnimationFrame(() => {
        details.style.maxHeight = details.scrollHeight + 'px';
      });
      this.refreshIcons();
    }
  },

  async editTenant(id) {
    try {
      const t = await API.getTenant(id);
      document.getElementById('tenant-id').value = t.id;
      document.getElementById('modal-tenant-title').textContent = 'Edit Tenant';
      document.getElementById('tenant-name').value = t.name;
      document.getElementById('tenant-phone').value = t.phone;
      document.getElementById('tenant-email').value = t.email || '';
      const coListEl = document.getElementById('co-occupants-list');
      if (coListEl) {
        coListEl.innerHTML = '';
        const occupants = (t.co_occupants && t.co_occupants.length > 0)
          ? t.co_occupants
          : (t.co_occupant_name || t.co_occupant_phone)
            ? [{ name: t.co_occupant_name || '', phone: t.co_occupant_phone || '' }]
            : [];
        occupants.forEach(co => {
          coListEl.appendChild(this.renderCoOccupantRow(co.name || '', co.phone || ''));
        });
      }
      document.getElementById('tenant-prop-id').value = t.property_id || '';
      document.getElementById('tenant-deposit').value = t.security_deposit || 0;
      document.getElementById('tenant-move-in').value = t.move_in_date || '';
      document.getElementById('tenant-payment-upi').value = t.payment_upi || '';
      document.getElementById('tenant-payment-bank-name').value = t.payment_bank_name || '';
      document.getElementById('tenant-payment-account-no').value = t.payment_account_no || '';
      document.getElementById('tenant-payment-ifsc').value = t.payment_ifsc || '';
      document.getElementById('tenant-init-elec').value = t.initial_elec_meter || 0;
      document.getElementById('tenant-init-water').value = t.initial_water_meter || 0;
      const statusSelect = document.getElementById('tenant-is-active');
      if (statusSelect) {
        statusSelect.value = t.is_active ? '1' : '0';
      }
      const btnMoveOutCalc = document.getElementById('btn-tenant-move-out-calc');
      if (btnMoveOutCalc) {
        btnMoveOutCalc.style.display = t.is_active ? 'inline-flex' : 'none';
      }

      this.openModal('modal-tenant');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  async deleteTenant(id) {
    const tenant = this.tenants.find(t => t.id == id);
    const tenantName = tenant ? tenant.name : 'this tenant';
    const unitName = tenant && tenant.property_name ? tenant.property_name : 'No Unit';

    let warningHtml = `Are you sure you want to delete <strong>${tenantName}</strong> (${unitName})?`;
    warningHtml += `<br><br><span style="color:var(--danger); font-weight:600;"><i data-lucide="alert-triangle" style="width:14px; height:14px; vertical-align:-2px;"></i> Permanent Action:</span> Deleting this tenant will permanently erase all associated bills, meter history, and payment transactions. This cannot be undone.`;

    this.confirmDelete({
      title: 'Delete Tenant',
      subtitle: `${tenantName} • ${unitName}`,
      warningHtml: warningHtml,
      buttonLabel: 'Hold to Delete Tenant (10s)',
      onConfirm: async () => {
        try {
          await API.deleteTenant(id);
          this.toast('Tenant deleted successfully');
          await this.refreshAll();
        } catch (err) {
          alert('Error deleting tenant: ' + err.message);
        }
      }
    });
  },

  async deactivateTenant(id) {
    await this.openVacantCalculation(id);
  },

  async openVacantCalculationModal(tenantId) {
    return this.openVacantCalculation(tenantId);
  },

  async openVacantCalculation(tenantId) {
    if (!tenantId) return;

    try {
      // Find or fetch tenant
      let tenant = (this.tenants || []).find(t => t.id == tenantId);
      if (!tenant || !tenant.property_id) {
        tenant = await API.getTenant(tenantId);
      }
      if (!tenant) throw new Error('Tenant not found');

      const prop = (this.properties || []).find(p => p.id == tenant.property_id) || {};

      // Get last bill readings & tenant bills
      const [lastBill, bills] = await Promise.all([
        API.getTenantLastBill(tenant.id).catch(() => ({ curr_electricity_meter: 0, curr_water_meter: 0 })),
        API.getBills(tenant.id).catch(() => [])
      ]);

      const deposit = Number(tenant.security_deposit) || 0;
      const tenantBills = (bills || []).filter(b => b.tenant_id === tenant.id);
      const pendingArrears = tenantBills.reduce((sum, b) => {
        return sum + (Number(b.balance_amount) || (Number(b.total_amount) - Number(b.paid_amount)) || 0);
      }, 0);

      // Populate Display Overview
      const curr = window.APP_CURRENCY || '₹';
      const tenantNameDisp = document.getElementById('vacant-disp-tenant');
      if (tenantNameDisp) tenantNameDisp.textContent = tenant.name || 'Tenant';

      const unitNameDisp = document.getElementById('vacant-disp-unit');
      if (unitNameDisp) unitNameDisp.textContent = tenant.property_name || prop.name || 'Unassigned Unit';

      const depDisp = document.getElementById('vacant-disp-deposit');
      if (depDisp) depDisp.textContent = `${curr}${deposit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      const arrDisp = document.getElementById('vacant-disp-arrears');
      if (arrDisp) arrDisp.textContent = `${curr}${pendingArrears.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      const subTitle = document.getElementById('vacant-calc-subtitle');
      if (subTitle) {
        subTitle.textContent = `Move-Out & Settlement Calculator • ${tenant.name} (${tenant.property_name || prop.name || 'Unassigned'})`;
      }

      document.getElementById('vacant-tenant-id').value = tenant.id;
      document.getElementById('vacant-prop-id').value = tenant.property_id || '';

      // Move-In and Move-Out Dates
      const todayStr = new Date().toISOString().split('T')[0];
      const moveOutInput = document.getElementById('vacant-move-out-date');
      if (moveOutInput) moveOutInput.value = todayStr;

      const moveInDisp = document.getElementById('vacant-move-in-display');
      if (moveInDisp) moveInDisp.value = tenant.move_in_date || 'Not recorded';

      this.updateTenancyDurationHint(tenant.move_in_date, todayStr);

      // Electricity
      const pElec = lastBill.curr_electricity_meter || tenant.initial_elec_meter || 0;
      const elecRate = Number(prop.electricity_rate) || 0;
      document.getElementById('vacant-prev-elec').value = pElec;
      document.getElementById('vacant-curr-elec').value = '';
      document.getElementById('vacant-elec-rate-disp').textContent = elecRate;
      document.getElementById('vacant-elec-units').value = '0 units';
      document.getElementById('vacant-elec-subtotal').textContent = `${curr}0.00`;

      // Water
      const isWaterMeter = prop.water_billing_type === 'METER';
      const waterRate = Number(prop.water_rate) || 0;
      const waterCharge = Number(prop.water_charge) || 0;
      const waterModeDisp = document.getElementById('vacant-water-mode-disp');
      const waterMeterRow = document.getElementById('vacant-water-meter-row');
      const waterFixedRow = document.getElementById('vacant-water-fixed-row');

      if (isWaterMeter) {
        if (waterMeterRow) waterMeterRow.style.display = 'flex';
        if (waterFixedRow) waterFixedRow.style.display = 'none';
        if (waterModeDisp) waterModeDisp.textContent = `Metered @ ${curr}${waterRate}/unit`;
        const pWater = lastBill.curr_water_meter || tenant.initial_water_meter || 0;
        document.getElementById('vacant-prev-water').value = pWater;
        document.getElementById('vacant-curr-water').value = '';
        document.getElementById('vacant-water-units').value = '0 units';
      } else {
        if (waterMeterRow) waterMeterRow.style.display = 'none';
        if (waterFixedRow) waterFixedRow.style.display = 'block';
        if (waterModeDisp) waterModeDisp.textContent = 'Fixed';
        document.getElementById('vacant-water-fixed-charge').value = waterCharge;
      }
      document.getElementById('vacant-water-subtotal').textContent = `${curr}0.00`;

      // Rent Proration
      const baseRent = Number(prop.default_rent) || 0;
      document.getElementById('vacant-base-rent').value = baseRent;
      this.currentVacantRentMode = 'none';
      document.getElementById('btn-rent-mode-none')?.classList.add('active');
      document.getElementById('btn-rent-mode-prorated')?.classList.remove('active');
      document.getElementById('btn-rent-mode-full')?.classList.remove('active');
      const prorateRow = document.getElementById('vacant-prorate-row');
      if (prorateRow) prorateRow.style.display = 'none';
      this.updateVacantMoveOutDateCalculations();

      // Deductions
      document.getElementById('vacant-deduct-arrears').value = pendingArrears > 0 ? pendingArrears : 0;
      document.getElementById('vacant-deduct-painting').value = 0;
      document.getElementById('vacant-deduct-cleaning').value = 0;
      document.getElementById('vacant-deduct-repairs').value = 0;
      document.getElementById('vacant-deduct-other').value = 0;
      document.getElementById('vacant-extra-credit').value = 0;
      document.getElementById('vacant-deduct-notes').value = '';

      // Keep reference
      this.currentVacantTenant = tenant;
      this.currentVacantProp = prop;

      // Recalculate and open
      this.calculateVacantSettlement();
      this.openModal('modal-vacant-calculation');
      this.refreshIcons();
    } catch (err) {
      alert('Error opening Vacant Form: ' + err.message);
    }
  },

  updateTenancyDurationHint(moveInStr, moveOutStr) {
    const hintEl = document.getElementById('vacant-tenancy-duration-hint');
    if (!hintEl) return;
    if (!moveInStr) {
      hintEl.textContent = 'Tenancy duration: Move-in date not recorded';
      return;
    }
    const d1 = new Date(moveInStr);
    const d2 = new Date(moveOutStr || new Date());
    const diffMs = d2 - d1;
    if (isNaN(diffMs) || diffMs < 0) {
      hintEl.textContent = `Move-in date: ${moveInStr}`;
      return;
    }
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30.4375);
    let durStr = `${days} Days`;
    if (months > 0) {
      const remDays = Math.floor(days - (months * 30.4375));
      durStr = `${months} Month${months > 1 ? 's' : ''} ${remDays > 0 ? `${remDays} Days` : ''} (${days} days total)`;
    }
    hintEl.innerHTML = `<span class="badge badge-paid" style="font-size:0.72rem;"><i data-lucide="clock" style="width:11px; height:11px; vertical-align:-1px;"></i> Tenancy Duration: ${durStr}</span>`;
  },

  updateVacantMoveOutDateCalculations() {
    const moveInStr = document.getElementById('vacant-move-in-display')?.value;
    const moveOutStr = document.getElementById('vacant-move-out-date')?.value;
    this.updateTenancyDurationHint(moveInStr, moveOutStr);

    if (moveOutStr) {
      const parts = moveOutStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        const occupiedDaysInput = document.getElementById('vacant-occupied-days');
        if (occupiedDaysInput) occupiedDaysInput.value = day;
      }
    }
    this.updateVacantRentProration();
  },

  updateVacantRentProration() {
    const mode = this.currentVacantRentMode || 'none';
    const rentAmountInp = document.getElementById('vacant-rent-amount');
    const baseRent = parseFloat(document.getElementById('vacant-base-rent')?.value) || 0;
    const moveOutStr = document.getElementById('vacant-move-out-date')?.value || '';

    if (!rentAmountInp) return;

    if (mode === 'none') {
      rentAmountInp.value = 0;
    } else if (mode === 'full') {
      rentAmountInp.value = baseRent.toFixed(2);
    } else if (mode === 'prorated') {
      let daysInMonth = 30;
      if (moveOutStr) {
        const parts = moveOutStr.split('-');
        if (parts.length === 3) {
          daysInMonth = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10), 0).getDate() || 30;
        }
      }
      const occupiedDays = parseFloat(document.getElementById('vacant-occupied-days')?.value) || 0;
      const proratedRent = daysInMonth > 0 ? (baseRent / daysInMonth) * occupiedDays : 0;
      rentAmountInp.value = proratedRent.toFixed(2);
    }
  },

  calculateVacantSettlement(skipProration = false) {
    if (!skipProration && this.currentVacantRentMode === 'prorated') {
      this.updateVacantRentProration();
    }
    const curr = window.APP_CURRENCY || '₹';
    const tenant = this.currentVacantTenant || {};
    const prop = this.currentVacantProp || {};

    const deposit = Number(tenant.security_deposit) || 0;
    const extraCredit = parseFloat(document.getElementById('vacant-extra-credit')?.value) || 0;

    // Electricity
    const prevElec = parseFloat(document.getElementById('vacant-prev-elec')?.value) || 0;
    const currElecVal = document.getElementById('vacant-curr-elec')?.value;
    const currElec = (currElecVal !== undefined && currElecVal !== '') ? parseFloat(currElecVal) : prevElec;
    const elecRate = parseFloat(document.getElementById('vacant-elec-rate-disp')?.textContent) || Number(prop.electricity_rate) || 0;
    const elecUnits = Math.max(0, currElec - prevElec);
    const elecAmount = elecUnits * elecRate;

    const elecUnitsEl = document.getElementById('vacant-elec-units');
    if (elecUnitsEl) elecUnitsEl.value = `${elecUnits.toFixed(1)} units`;
    const elecSubEl = document.getElementById('vacant-elec-subtotal');
    if (elecSubEl) elecSubEl.textContent = `${curr}${elecAmount.toFixed(2)}`;

    // Water
    let waterUnits = 0;
    let waterAmount = 0;
    if (prop.water_billing_type === 'METER') {
      const prevWater = parseFloat(document.getElementById('vacant-prev-water')?.value) || 0;
      const currWaterVal = document.getElementById('vacant-curr-water')?.value;
      const currWater = (currWaterVal !== undefined && currWaterVal !== '') ? parseFloat(currWaterVal) : prevWater;
      const waterRate = Number(prop.water_rate) || 0;
      waterUnits = Math.max(0, currWater - prevWater);
      waterAmount = waterUnits * waterRate;
      const waterUnitsEl = document.getElementById('vacant-water-units');
      if (waterUnitsEl) waterUnitsEl.value = `${waterUnits.toFixed(1)} units`;
    } else {
      waterAmount = parseFloat(document.getElementById('vacant-water-fixed-charge')?.value) || 0;
    }
    const waterSubEl = document.getElementById('vacant-water-subtotal');
    if (waterSubEl) waterSubEl.textContent = `${curr}${waterAmount.toFixed(2)}`;

    // Rent
    const baseRent = parseFloat(document.getElementById('vacant-base-rent')?.value) || Number(prop.default_rent) || 0;
    const rentAmount = parseFloat(document.getElementById('vacant-rent-amount')?.value) || 0;

    // Deductions
    const arrears = parseFloat(document.getElementById('vacant-deduct-arrears')?.value) || 0;
    const painting = parseFloat(document.getElementById('vacant-deduct-painting')?.value) || 0;
    const cleaning = parseFloat(document.getElementById('vacant-deduct-cleaning')?.value) || 0;
    const repairs = parseFloat(document.getElementById('vacant-deduct-repairs')?.value) || 0;
    const other = parseFloat(document.getElementById('vacant-deduct-other')?.value) || 0;
    const notes = document.getElementById('vacant-deduct-notes')?.value || '';

    // Totals
    const totalCredits = deposit + extraCredit;
    const utilitiesTotal = elecAmount + waterAmount;
    const otherDeductionsTotal = painting + cleaning + repairs + other;
    const totalDebits = arrears + utilitiesTotal + rentAmount + otherDeductionsTotal;
    const netAmount = totalCredits - totalDebits;

    // Update live breakdown labels
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('sum-credit-deposit', `${curr}${deposit.toFixed(2)}`);
    setTxt('sum-credit-extra', `${curr}${extraCredit.toFixed(2)}`);
    setTxt('sum-total-credits', `${curr}${totalCredits.toFixed(2)}`);

    setTxt('sum-debit-arrears', `${curr}${arrears.toFixed(2)}`);
    setTxt('sum-debit-utilities', `${curr}${utilitiesTotal.toFixed(2)}`);
    setTxt('sum-debit-rent', `${curr}${rentAmount.toFixed(2)}`);
    setTxt('sum-debit-deductions', `${curr}${otherDeductionsTotal.toFixed(2)}`);
    setTxt('sum-total-debits', `${curr}${totalDebits.toFixed(2)}`);

    // Banner
    const banner = document.getElementById('vacant-net-banner');
    const iconEl = document.getElementById('vacant-net-icon');
    const labelEl = document.getElementById('vacant-net-label');
    const amountEl = document.getElementById('vacant-net-amount');
    const descEl = document.getElementById('vacant-net-desc');

    if (banner) {
      banner.className = 'vacant-net-banner';
      if (netAmount > 0.009) {
        banner.classList.add('refund');
        if (iconEl) iconEl.innerHTML = '<i data-lucide="check-circle-2"></i>';
        if (labelEl) labelEl.textContent = 'REFUND TO TENANT';
        if (amountEl) amountEl.textContent = `${curr}${netAmount.toFixed(2)}`;
        if (descEl) descEl.textContent = `Landlord will refund ${curr}${netAmount.toFixed(2)} to ${tenant.name || 'tenant'} upon vacating.`;
      } else if (netAmount < -0.009) {
        banner.classList.add('due');
        if (iconEl) iconEl.innerHTML = '<i data-lucide="alert-circle"></i>';
        if (labelEl) labelEl.textContent = 'AMOUNT DUE FROM TENANT';
        if (amountEl) amountEl.textContent = `${curr}${Math.abs(netAmount).toFixed(2)}`;
        if (descEl) descEl.textContent = `Deductions exceed deposit. Tenant must pay ${curr}${Math.abs(netAmount).toFixed(2)} before vacating.`;
      } else {
        banner.classList.add('zero');
        if (iconEl) iconEl.innerHTML = '<i data-lucide="check"></i>';
        if (labelEl) labelEl.textContent = 'SETTLED IN FULL';
        if (amountEl) amountEl.textContent = `${curr}0.00`;
        if (descEl) descEl.textContent = 'All dues, deductions, and security deposit are completely balanced.';
      }
      this.refreshIcons();
    }

    // Cache current data for WhatsApp / Copy / Print / Confirm
    this.currentVacantCalcData = {
      tenantId: tenant.id,
      tenantName: tenant.name || 'Tenant',
      tenantPhone: tenant.phone || '',
      unitName: tenant.property_name || prop.name || 'Unassigned Unit',
      unitType: prop.unit_type || 'Apartment',
      propertyAddress: prop.address || '',
      moveInDate: tenant.move_in_date || '',
      moveOutDate: document.getElementById('vacant-move-out-date')?.value || new Date().toISOString().split('T')[0],
      tenancyDuration: document.getElementById('vacant-tenancy-duration-hint')?.innerText?.trim() || '',
      deposit: deposit,
      extraCredit: extraCredit,
      totalCredits: totalCredits,
      arrears: arrears,
      prevElec: prevElec,
      currElec: currElec,
      elecRate: elecRate,
      elecUnits: elecUnits,
      elecAmount: elecAmount,
      waterMode: prop.water_billing_type || 'FIXED',
      prevWater: parseFloat(document.getElementById('vacant-prev-water')?.value) || 0,
      currWater: parseFloat(document.getElementById('vacant-curr-water')?.value) || 0,
      waterUnits: Math.max(0, (parseFloat(document.getElementById('vacant-curr-water')?.value) || 0) - (parseFloat(document.getElementById('vacant-prev-water')?.value) || 0)),
      waterAmount: waterAmount,
      baseRent: baseRent,
      rentAmount: rentAmount,
      occupiedDays: parseFloat(document.getElementById('vacant-occupied-days')?.value) || 0,
      painting: painting,
      cleaning: cleaning,
      repairs: repairs,
      otherDeduct: other,
      notes: notes,
      totalDebits: totalDebits,
      netAmount: netAmount
    };

    this.renderVacantPrintableSheet();
  },

  async completeVacantMoveOut() {
    const data = this.currentVacantCalcData;
    if (!data || !data.tenantId) {
      alert('Missing tenant data');
      return;
    }

    const tenantName = data.tenantName;
    const unitName = data.unitName;
    const curr = window.APP_CURRENCY || '₹';
    const netFormatted = `${curr}${Math.abs(data.netAmount).toFixed(2)}`;
    const settlementSummary = data.netAmount >= 0 ? `Refund: ${netFormatted}` : `Due: ${netFormatted}`;

    const confirmMsg = `Are you sure you want to complete move-out and vacate "${unitName}"?\n\n` +
      `• Resident "${tenantName}" will be marked as moved-out (Past).\n` +
      `• "${unitName}" will be freed up immediately as VACANT.\n` +
      `• Final Settlement: ${settlementSummary}\n` +
      `• All historical records and past ledgers remain safe.`;

    if (!confirm(confirmMsg)) return;

    try {
      const btn = document.getElementById('btn-vacant-confirm');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader" style="width:16px; height:16px; animation:spin 1s linear infinite;"></i> Processing Move-Out...';
      }

      // Check if user wants to record settlement bill
      const optCreateBill = document.getElementById('vacant-opt-create-bill')?.checked;
      const finalBillCharges = (data.elecAmount || 0) + (data.waterAmount || 0) + (data.rentAmount || 0) + (data.painting || 0) + (data.cleaning || 0) + (data.repairs || 0) + (data.otherDeduct || 0);

      if (optCreateBill && finalBillCharges > 0 && this.currentVacantProp && this.currentVacantProp.id) {
        try {
          const moveOutBillPayload = {
            tenant_id: data.tenantId,
            property_id: this.currentVacantProp.id,
            billing_month: `Move-Out ${data.moveOutDate}`,
            billing_period_start: data.moveInDate || data.moveOutDate,
            billing_period_end: data.moveOutDate,
            due_date: data.moveOutDate,
            base_rent: data.rentAmount || 0,
            prev_electricity_meter: data.prevElec || 0,
            curr_electricity_meter: data.currElec || 0,
            electricity_rate: data.elecRate || 0,
            electricity_units: data.elecUnits || 0,
            electricity_amount: data.elecAmount || 0,
            water_billing_type: this.currentVacantProp.water_billing_type || 'FIXED',
            prev_water_meter: 0,
            curr_water_meter: 0,
            water_rate: this.currentVacantProp.water_rate || 0,
            water_units: 0,
            water_amount: data.waterAmount || 0,
            maintenance_amount: 0,
            other_charges: (data.painting || 0) + (data.cleaning || 0) + (data.repairs || 0) + (data.otherDeduct || 0),
            other_charges_desc: `Settlement: Paint ₹${data.painting || 0}, Clean ₹${data.cleaning || 0}, Repair ₹${data.repairs || 0}, Other ₹${data.otherDeduct || 0}. ${data.notes || ''}`.trim(),
            discount_amount: 0,
            discount_reason: '',
            previous_balance: data.arrears || 0,
            total_amount: data.totalDebits || 0,
            paid_amount: data.deposit >= data.totalDebits ? data.totalDebits : data.deposit,
            status: data.netAmount >= 0 ? 'PAID' : 'PENDING',
            notes: `Move-Out Vacant Settlement on ${data.moveOutDate}. Deposit: ₹${data.deposit.toFixed(2)}. ${settlementSummary}`
          };
          await API.createBill(moveOutBillPayload);
        } catch (billErr) {
          console.warn('Could not auto-create settlement bill:', billErr);
        }
      }

      // Deactivate tenant
      const t = await API.getTenant(data.tenantId);
      t.is_active = false;
      await API.updateTenant(data.tenantId, t);

      this.toast(`Tenant ${tenantName} moved out. ${unitName} is now Vacant!`);
      this.closeModal('modal-vacant-calculation');
      await this.refreshAll();
    } catch (err) {
      alert('Error during move-out: ' + err.message);
    } finally {
      const btn = document.getElementById('btn-vacant-confirm');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="log-out" style="width:16px; height:16px;"></i> Complete Move-Out &amp; Vacate';
      }
    }
  },

  buildVacantSettlementText(calcData) {
    if (!calcData) return '';
    const curr = window.APP_CURRENCY || '₹';
    const lines = [
      `🏠 *MOVE-OUT & VACANT SETTLEMENT STATEMENT*`,
      `----------------------------------------`,
      `👤 *Resident:* ${calcData.tenantName}`,
      `🏢 *Property / Unit:* ${calcData.unitName}`,
      calcData.moveInDate ? `📅 *Move-In Date:* ${calcData.moveInDate}` : '',
      `🚪 *Move-Out Date:* ${calcData.moveOutDate}`,
      calcData.tenancyDuration ? `⏳ *Tenancy Period:* ${calcData.tenancyDuration}` : '',
      `----------------------------------------`,
      `💰 *SECURITY DEPOSIT & CREDITS:*`,
      `+ Security Deposit: ${curr}${calcData.deposit.toFixed(2)}`,
      calcData.extraCredit > 0 ? `+ Extra Credit/Advance: ${curr}${calcData.extraCredit.toFixed(2)}` : '',
      `*Total Credits:* ${curr}${calcData.totalCredits.toFixed(2)}`,
      `----------------------------------------`,
      `🧾 *FINAL DUES & DEDUCTIONS:*`,
      calcData.arrears > 0 ? `• Past Unpaid Bills: ${curr}${calcData.arrears.toFixed(2)}` : '',
      calcData.elecAmount > 0 ? `• Electricity (${calcData.elecUnits} units @ ${curr}${calcData.elecRate}): ${curr}${calcData.elecAmount.toFixed(2)} (Meter: ${calcData.prevElec} ➔ ${calcData.currElec})` : '',
      calcData.waterAmount > 0 ? `• Water Charges: ${curr}${calcData.waterAmount.toFixed(2)}` : '',
      calcData.rentAmount > 0 ? `• Move-Out Rent (${calcData.occupiedDays} days): ${curr}${calcData.rentAmount.toFixed(2)}` : '',
      calcData.painting > 0 ? `• Painting / Whitewash: ${curr}${calcData.painting.toFixed(2)}` : '',
      calcData.cleaning > 0 ? `• Deep Cleaning: ${curr}${calcData.cleaning.toFixed(2)}` : '',
      calcData.repairs > 0 ? `• Repairs & Damages: ${curr}${calcData.repairs.toFixed(2)}` : '',
      calcData.otherDeduct > 0 ? `• Other Deductions: ${curr}${calcData.otherDeduct.toFixed(2)}` : '',
      calcData.notes ? `• Remarks: ${calcData.notes}` : '',
      `*Total Deductions:* ${curr}${calcData.totalDebits.toFixed(2)}`,
      `========================================`,
      calcData.netAmount >= 0
        ? `🟢 *NET REFUND TO TENANT:* ${curr}${calcData.netAmount.toFixed(2)}`
        : `🔴 *NET DUE FROM TENANT:* ${curr}${Math.abs(calcData.netAmount).toFixed(2)}`,
      `========================================`,
      `Unit Status: Vacated • All Records Archived Safe`,
      `Thank you!`
    ].filter(Boolean);
    return lines.join('\n');
  },

  shareVacantSettlementWhatsApp() {
    const data = this.currentVacantCalcData;
    if (!data) return;
    const text = this.buildVacantSettlementText(data);
    Share.sendWhatsAppDirect(data.tenantPhone, text);
    this.toast('Opening WhatsApp...');
  },

  async copyVacantSettlement() {
    const data = this.currentVacantCalcData;
    if (!data) return;
    const text = this.buildVacantSettlementText(data);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        this.toast('Settlement copied to clipboard!');
      } else {
        window.prompt('Copy settlement breakdown below:', text);
      }
    } catch (e) {
      window.prompt('Copy settlement breakdown below:', text);
    }
  },

  renderVacantPrintableSheet(data = this.currentVacantCalcData) {
    const container = document.getElementById('vacant-printable');
    if (!container || !data) return;

    const curr = window.APP_CURRENCY || '₹';
    const numFmt = (n) => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const isRefund = data.netAmount >= 0;
    const netAbs = Math.abs(data.netAmount);
    const inWords = typeof Share !== 'undefined' ? Share.amountInWords(netAbs) : '';

    const html = `
      <div class="vacant-print-sheet">
        <!-- Header -->
        <div class="vacant-print-header">
          <div class="vacant-print-brand">
            <div class="vacant-print-title">MOVE-OUT SETTLEMENT STATEMENT</div>
            <div class="vacant-print-subtitle">Final Tenancy Clearance &amp; Security Deposit Settlement</div>
            <div class="vacant-print-meta">Settlement Date: <strong>${data.moveOutDate || new Date().toISOString().split('T')[0]}</strong> • Unit: <strong>${data.unitName}</strong></div>
          </div>
          <div class="vacant-print-status">
            <span class="vacant-print-badge">
              ${isRefund ? 'REFUND TO TENANT' : 'AMOUNT DUE FROM TENANT'}
            </span>
            <div class="vacant-print-net-amount">${curr}${numFmt(netAbs)}</div>
          </div>
        </div>

        <!-- Parties Box (2 columns) -->
        <div class="vacant-print-parties">
          <div class="vacant-print-party-col">
            <div class="vacant-print-party-lbl">PROPERTY &amp; UNIT DETAILS</div>
            <div class="vacant-print-party-name">${data.unitName}</div>
            <div class="vacant-print-party-sub">Type: ${data.unitType || 'Apartment'}</div>
            ${data.propertyAddress ? `<div class="vacant-print-party-sub">Address: ${data.propertyAddress}</div>` : ''}
          </div>
          <div class="vacant-print-party-col vacant-print-party-right">
            <div class="vacant-print-party-lbl">RESIDENT / TENANT DETAILS</div>
            <div class="vacant-print-party-name">${data.tenantName}</div>
            ${data.tenantPhone ? `<div class="vacant-print-party-sub">Phone: ${data.tenantPhone}</div>` : ''}
            <div class="vacant-print-party-sub">Tenancy: ${data.moveInDate || '--'} to ${data.moveOutDate || '--'} ${data.tenancyDuration ? `(${data.tenancyDuration})` : ''}</div>
          </div>
        </div>

        <!-- Financial Breakdown Table -->
        <table class="vacant-print-table">
          <thead>
            <tr>
              <th style="width:50%;">Particulars / Item Description</th>
              <th style="width:30%;">Computation Details</th>
              <th class="num" style="width:20%;">Amount (${curr})</th>
            </tr>
          </thead>
          <tbody>
            <!-- Section 1: Credits -->
            <tr class="vacant-table-section-row">
              <td colspan="3">1. SECURITY DEPOSIT &amp; ADVANCE CREDITS</td>
            </tr>
            <tr>
              <td>Security Deposit Held</td>
              <td>Initial move-in deposit</td>
              <td class="num" style="color:#047857; font-weight:600;">+ ${numFmt(data.deposit)}</td>
            </tr>
            ${data.extraCredit > 0 ? `
              <tr>
                <td>Extra Advance / Credit Adjustment</td>
                <td>Prepaid credit balance</td>
                <td class="num" style="color:#047857; font-weight:600;">+ ${numFmt(data.extraCredit)}</td>
              </tr>
            ` : ''}
            <tr class="vacant-subtotal-row">
              <td colspan="2"><strong>Total Credits Available (A)</strong></td>
              <td class="num"><strong>${curr}${numFmt(data.totalCredits)}</strong></td>
            </tr>

            <!-- Section 2: Deductions -->
            <tr class="vacant-table-section-row">
              <td colspan="3">2. FINAL DUES, UTILITIES &amp; DAMAGE DEDUCTIONS</td>
            </tr>
            ${data.arrears > 0 ? `
              <tr>
                <td>Past Unpaid Bills / Ledger Arrears</td>
                <td>Outstanding balance from previous bills</td>
                <td class="num" style="color:#b91c1c;">- ${numFmt(data.arrears)}</td>
              </tr>
            ` : ''}
            ${data.elecAmount > 0 ? `
              <tr>
                <td>Final Electricity Consumption</td>
                <td>Meter: ${data.prevElec} ➔ ${data.currElec} (${data.elecUnits} units @ ${curr}${data.elecRate})</td>
                <td class="num" style="color:#b91c1c;">- ${numFmt(data.elecAmount)}</td>
              </tr>
            ` : ''}
            ${data.waterAmount > 0 ? `
              <tr>
                <td>Final Water Consumption Charges</td>
                <td>${data.waterMode === 'METERED' ? `Meter: ${data.prevWater} ➔ ${data.currWater} (${data.waterUnits} units)` : 'Fixed charge for period'}</td>
                <td class="num" style="color:#b91c1c;">- ${numFmt(data.waterAmount)}</td>
              </tr>
            ` : ''}
            ${data.rentAmount > 0 ? `
              <tr>
                <td>Move-Out Month Rent</td>
                <td>${data.occupiedDays} days @ ${curr}${numFmt(data.baseRent || 0)}/mo</td>
                <td class="num" style="color:#b91c1c;">- ${numFmt(data.rentAmount)}</td>
              </tr>
            ` : ''}
            ${data.painting > 0 ? `
              <tr>
                <td>Painting / Whitewash Charges</td>
                <td>Wall restoration &amp; touch-up</td>
                <td class="num" style="color:#b91c1c;">- ${numFmt(data.painting)}</td>
              </tr>
            ` : ''}
            ${data.cleaning > 0 ? `
              <tr>
                <td>Deep Cleaning &amp; Sanitization</td>
                <td>Move-out turnover cleaning</td>
                <td class="num" style="color:#b91c1c;">- ${numFmt(data.cleaning)}</td>
              </tr>
            ` : ''}
            ${data.repairs > 0 ? `
              <tr>
                <td>Repairs &amp; Damages Rectification</td>
                <td>Fixture damages / maintenance</td>
                <td class="num" style="color:#b91c1c;">- ${numFmt(data.repairs)}</td>
              </tr>
            ` : ''}
            ${data.otherDeduct > 0 ? `
              <tr>
                <td>Other Deductions / Short Notice</td>
                <td>Settlement adjustment</td>
                <td class="num" style="color:#b91c1c;">- ${numFmt(data.otherDeduct)}</td>
              </tr>
            ` : ''}
            <tr class="vacant-subtotal-row">
              <td colspan="2"><strong>Total Deductions &amp; Charges (B)</strong></td>
              <td class="num"><strong>${curr}${numFmt(data.totalDebits)}</strong></td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="vacant-final-row">
              <td colspan="2">
                <strong>${isRefund ? 'NET REFUND PAYABLE TO RESIDENT (A - B)' : 'NET BALANCE DUE FROM RESIDENT (B - A)'}</strong>
              </td>
              <td class="num">
                <strong>${curr}${numFmt(netAbs)}</strong>
              </td>
            </tr>
          </tfoot>
        </table>

        <!-- Amount in words -->
        ${inWords ? `
          <div class="vacant-print-words">
            <strong>Settlement in Words:</strong> ${inWords}
          </div>
        ` : ''}

        ${data.notes ? `
          <div class="vacant-print-notes">
            <strong>Handover Remarks &amp; Condition:</strong> ${data.notes}
          </div>
        ` : ''}

        <!-- Signatures Block -->
        <div class="vacant-print-signatures">
          <div class="vacant-sign-box">
            <div class="vacant-sign-line"></div>
            <div class="vacant-sign-label">Resident / Tenant Signature</div>
            <div class="vacant-sign-sub">${data.tenantName}</div>
          </div>
          <div class="vacant-sign-box">
            <div class="vacant-sign-line"></div>
            <div class="vacant-sign-label">Landlord / Authorized Signature</div>
            <div class="vacant-sign-sub">Date: ____________________</div>
          </div>
        </div>

        <!-- Footer Notice -->
        <div class="vacant-print-footer">
          <span>This is an official move-out settlement statement. Generated via RentBills.</span>
          <span>Printed on ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>
        </div>
      </div>
    `;

    container.innerHTML = html;
  },

  printVacantSettlement() {
    this.renderVacantPrintableSheet();
    setTimeout(() => {
      window.print();
    }, 30);
  },

  openVacantCalculationFromEdit() {
    const tenantId = document.getElementById('tenant-id')?.value;
    if (tenantId) {
      this.closeModal('modal-tenant');
      this.openVacantCalculation(tenantId);
    }
  },

  bindVacantCalculationEvents() {
    const calcInputs = [
      'vacant-curr-elec', 'vacant-curr-water', 'vacant-water-fixed-charge',
      'vacant-base-rent', 'vacant-occupied-days', 'vacant-rent-amount',
      'vacant-deduct-arrears', 'vacant-deduct-painting', 'vacant-deduct-cleaning',
      'vacant-deduct-repairs', 'vacant-deduct-other', 'vacant-extra-credit',
      'vacant-deduct-notes'
    ];

    calcInputs.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        ['input', 'change', 'keyup'].forEach(ev => {
          el.addEventListener(ev, () => {
            if (id === 'vacant-occupied-days') {
              // If user changes Days Occupied while mode was none, activate prorated mode
              if (this.currentVacantRentMode === 'none') {
                this.currentVacantRentMode = 'prorated';
                document.getElementById('btn-rent-mode-none')?.classList.remove('active');
                document.getElementById('btn-rent-mode-prorated')?.classList.add('active');
                document.getElementById('btn-rent-mode-full')?.classList.remove('active');
                const prorateRow = document.getElementById('vacant-prorate-row');
                if (prorateRow) prorateRow.style.display = 'flex';
              }
              this.updateVacantRentProration();
            } else if (id === 'vacant-base-rent') {
              this.updateVacantRentProration();
            }
            this.calculateVacantSettlement(id === 'vacant-rent-amount');
          });
        });
      }
    });

    ['change', 'input'].forEach(ev => {
      document.getElementById('vacant-move-out-date')?.addEventListener(ev, () => {
        this.updateVacantMoveOutDateCalculations();
        this.calculateVacantSettlement();
      });
    });

    // Rent Mode pills
    const pillNone = document.getElementById('btn-rent-mode-none');
    const pillProrated = document.getElementById('btn-rent-mode-prorated');
    const pillFull = document.getElementById('btn-rent-mode-full');
    const prorateRow = document.getElementById('vacant-prorate-row');

    const setRentMode = (mode) => {
      this.currentVacantRentMode = mode;
      [pillNone, pillProrated, pillFull].forEach(p => p?.classList.remove('active'));
      if (mode === 'none') {
        pillNone?.classList.add('active');
        if (prorateRow) prorateRow.style.display = 'none';
      } else if (mode === 'prorated') {
        pillProrated?.classList.add('active');
        if (prorateRow) prorateRow.style.display = 'none';
      } else if (mode === 'full') {
        pillFull?.classList.add('active');
        if (prorateRow) prorateRow.style.display = 'none';
      }
      if (mode !== 'none' && prorateRow) prorateRow.style.display = 'flex';
      this.updateVacantRentProration();
      this.calculateVacantSettlement();
    };

    pillNone?.addEventListener('click', () => setRentMode('none'));
    pillProrated?.addEventListener('click', () => setRentMode('prorated'));
    pillFull?.addEventListener('click', () => setRentMode('full'));

    // Action buttons
    document.getElementById('btn-vacant-confirm')?.addEventListener('click', () => {
      this.completeVacantMoveOut();
    });

    document.getElementById('btn-vacant-whatsapp')?.addEventListener('click', () => {
      this.shareVacantSettlementWhatsApp();
    });

    document.getElementById('btn-vacant-copy')?.addEventListener('click', () => {
      this.copyVacantSettlement();
    });

    document.getElementById('btn-vacant-print')?.addEventListener('click', () => {
      this.printVacantSettlement();
    });
  },

  async reactivateTenant(id) {
    const tenant = this.tenants.find(t => t.id == id);
    const tenantName = tenant ? tenant.name : 'this tenant';

    if (!confirm(`Reactivate "${tenantName}" as an active resident?`)) return;

    try {
      const t = await API.getTenant(id);
      t.is_active = true;
      await API.updateTenant(id, t);
      this.toast(`Tenant ${tenantName} reactivated`);
      await this.refreshAll();
    } catch (err) {
      alert('Error reactivating tenant: ' + err.message);
    }
  },

  async openTenantLedger(tenantId) {
    this.currentLedgerTenantId = tenantId;
    const container = document.getElementById('ledger-bills-container');
    if (container) {
      container.innerHTML = `<div class="empty-state">Loading bills...</div>`;
    }

    const tenant = this.tenants.find(t => t.id == tenantId);
    if (tenant) {
      document.getElementById('modal-ledger-tenant-name').textContent = `${tenant.name} - Bills`;
      document.getElementById('modal-ledger-unit-info').textContent = `Unit: ${tenant.property_name || 'Unassigned'} • Phone: ${tenant.phone}`;
    } else {
      document.getElementById('modal-ledger-tenant-name').textContent = 'Tenant Bills';
      document.getElementById('modal-ledger-unit-info').textContent = '';
    }

    this.openModal('modal-ledger');

    try {
      const [tDetails, bills, ledgerData] = await Promise.all([
        tenant ? Promise.resolve(tenant) : API.getTenant(tenantId),
        API.getBills(tenantId),
        API.getTenantLedger(tenantId).catch(() => null)
      ]);

      this.currentLedgerData = ledgerData;

      if (tDetails) {
        let paymentInfoText = '';
        if (tDetails.payment_upi) paymentInfoText += ` • Pay UPI: ${tDetails.payment_upi}`;
        if (tDetails.payment_bank_name) paymentInfoText += ` • Bank: ${tDetails.payment_bank_name} (${tDetails.payment_account_no || ''})`;
        document.getElementById('modal-ledger-tenant-name').textContent = `${tDetails.name} - Bills`;
        document.getElementById('modal-ledger-unit-info').textContent = `Unit: ${tDetails.property_name || 'Unassigned'} • Phone: ${tDetails.phone}${paymentInfoText}`;
        const btnLedgerVacant = document.getElementById('btn-ledger-vacant-calc');
        if (btnLedgerVacant) {
          btnLedgerVacant.style.display = 'inline-flex';
          btnLedgerVacant.innerHTML = `<i data-lucide="calculator" style="width:13px; height:13px;"></i> ${tDetails.is_active ? 'Move Out / Vacant Form' : 'Vacant Form'}`;
        }
      }

      const curr = window.APP_CURRENCY || '₹';
      const totalBilled = ledgerData ? ledgerData.total_billed : bills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      const totalPaid = ledgerData ? ledgerData.total_paid : bills.reduce((sum, b) => sum + (b.paid_amount || 0), 0);
      const totalBalance = ledgerData ? ledgerData.current_balance : bills.reduce((sum, b) => sum + (b.balance_amount || 0), 0);

      document.getElementById('ledger-total-billed').textContent = `${curr}${totalBilled.toFixed(2)}`;
      document.getElementById('ledger-total-paid').textContent = `${curr}${totalPaid.toFixed(2)}`;
      document.getElementById('ledger-total-balance').textContent = `${curr}${totalBalance.toFixed(2)}`;

      // Render Bills Cards
      if (container) {
        if (!bills || bills.length === 0) {
          container.innerHTML = `
            <div class="empty-state">
              No bills found for this tenant.
            </div>
          `;
        } else {
          container.innerHTML = bills.map(b => this.renderBillCardHtml(b)).join('');
          this.attachBillActionListeners(container);
        }
      }

      this.refreshIcons();
    } catch (err) {
      console.error(err);
      if (container) {
        container.innerHTML = `<div class="empty-state text-danger">Failed to load bills: ${err.message}</div>`;
      }
    }
  },

  async openPropertyExpenses(propertyId) {
    this.currentExpensesPropertyId = propertyId;
    const container = document.getElementById('property-expenses-container');
    if (container) {
      container.innerHTML = `<div class="empty-state">Loading property expenses...</div>`;
    }

    const prop = this.properties.find(p => p.id == propertyId);
    const propTitle = prop ? prop.name : 'Property';
    document.getElementById('modal-property-expenses-title').textContent = `${propTitle} - Expenses`;
    document.getElementById('modal-property-expenses-sub').textContent = prop ? `${prop.unit_type} • ${prop.address || 'Maintenance & Repairs'}` : 'Maintenance & Repairs';

    this.openModal('modal-property-expenses');

    try {
      const expenses = await API.getPropertyExpenses(propertyId);
      const curr = window.APP_CURRENCY || '₹';

      // Re-fetch fresh property details or use cached values
      const p = this.properties.find(item => item.id == propertyId) || {};
      const totalIncome = p.total_income || 0;
      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const netProfit = totalIncome - totalExpenses;

      document.getElementById('prop-stat-income').textContent = `${curr}${totalIncome.toFixed(2)}`;
      document.getElementById('prop-stat-expenses').textContent = `${curr}${totalExpenses.toFixed(2)}`;
      const netProfitEl = document.getElementById('prop-stat-net-profit');
      if (netProfitEl) {
        netProfitEl.textContent = `${curr}${netProfit.toFixed(2)}`;
        netProfitEl.className = `ledger-stat-value ${netProfit >= 0 ? 'text-success' : 'text-danger'}`;
      }

      if (container) {
        if (!expenses || expenses.length === 0) {
          container.innerHTML = `
            <div class="empty-state">
              No expenses recorded for this property yet.<br>
              Tap "+ Add Expense" above to record maintenance or repair costs.
            </div>
          `;
        } else {
          container.innerHTML = expenses.map(ex => `
            <div class="app-card" style="margin-bottom:10px;">
              <div class="card-top">
                <div>
                  <div class="card-title">${ex.title}</div>
                  <div class="card-subtitle">
                    <span class="badge badge-date" style="font-size:0.7rem; padding:1px 6px;">${ex.category}</span>
                    • ${ex.expense_date} ${ex.paid_to ? '• Paid to: ' + ex.paid_to : ''}
                  </div>
                </div>
                <div class="card-top-right">
                  <strong style="color:#dc2626; font-size:1.05rem;">${curr}${ex.amount.toFixed(2)}</strong>
                  <div class="card-dropdown">
                    <button type="button" class="btn-card-more" onclick="App.toggleDropdown(this, event)" aria-label="Expense options">
                      <i data-lucide="more-vertical"></i>
                    </button>
                    <div class="card-dropdown-menu">
                      <button type="button" class="dropdown-item" onclick="App.editExpense(${ex.id})">
                        <i data-lucide="edit-3"></i> Edit Expense
                      </button>
                      <button type="button" class="dropdown-item dropdown-item-danger" onclick="App.deleteExpense(${ex.id})">
                        <i data-lucide="trash-2"></i> Delete Expense
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div style="font-size:0.78rem; color:var(--text-muted); display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
                <span>Payment Mode: <strong>${ex.payment_method || 'Cash'}</strong></span>
                ${ex.notes ? `<span>Note: ${ex.notes}</span>` : ''}
              </div>
            </div>
          `).join('');
        }
      }
      this.refreshIcons();
    } catch (err) {
      console.error(err);
      if (container) {
        container.innerHTML = `<div class="empty-state text-danger">Failed to load expenses: ${err.message}</div>`;
      }
    }
  },

  openAddExpenseModal(propertyId) {
    this.currentExpensesPropertyId = propertyId;
    const prop = this.properties.find(p => p.id == propertyId);
    const form = document.getElementById('form-expense');
    if (form) form.reset();

    document.getElementById('expense-id').value = '';
    document.getElementById('expense-property-id').value = propertyId;
    document.getElementById('expense-property-name').value = prop ? prop.name : `Property #${propertyId}`;
    document.getElementById('modal-expense-title').textContent = 'Add Property Expense';

    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('expense-date');
    if (dateInput) dateInput.value = today;

    this.openModal('modal-expense');
  },

  async editExpense(expenseId) {
    try {
      const ex = await API.getPropertyExpenses(this.currentExpensesPropertyId).then(list => list.find(e => e.id == expenseId));
      if (!ex) {
        alert('Expense not found');
        return;
      }

      document.getElementById('expense-id').value = ex.id;
      document.getElementById('expense-property-id').value = ex.property_id;
      document.getElementById('expense-property-name').value = ex.property_name || 'Property';
      document.getElementById('modal-expense-title').textContent = 'Edit Expense';
      document.getElementById('expense-title').value = ex.title;
      document.getElementById('expense-category').value = ex.category;
      document.getElementById('expense-amount').value = ex.amount;
      document.getElementById('expense-date').value = ex.expense_date;
      document.getElementById('expense-method').value = ex.payment_method || 'Cash';
      document.getElementById('expense-paid-to').value = ex.paid_to || '';
      document.getElementById('expense-notes').value = ex.notes || '';

      this.openModal('modal-expense');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  async deleteExpense(expenseId) {
    this.confirmDelete({
      title: 'Delete Expense',
      subtitle: 'Maintenance Record',
      warningHtml: 'Are you sure you want to permanently delete this expense entry?',
      buttonLabel: 'Hold to Delete Expense (10s)',
      onConfirm: async () => {
        try {
          await API.deleteExpense(expenseId);
          this.toast('Expense deleted successfully');
          await this.refreshAll();
          if (this.currentExpensesPropertyId) {
            this.openPropertyExpenses(this.currentExpensesPropertyId);
          }
        } catch (err) {
          alert('Error deleting expense: ' + err.message);
        }
      }
    });
  },

  async loadBills() {
    try {
      this.bills = await API.getBills();
      this.renderBills('ALL');
    } catch (err) {
      console.error(err);
    }
  },

  renderBills(filter = 'ALL') {
    const container = document.getElementById('all-bills-container');
    if (!container) return;
    let list = this.bills;
    if (filter !== 'ALL') {
      list = this.bills.filter(b => b.status === filter);
    }

    if (list.length === 0) {
      container.innerHTML = `<div class="empty-state">No ${filter === 'ALL' ? '' : filter.toLowerCase()} bills found.</div>`;
      return;
    }

    container.innerHTML = list.map(b => this.renderBillCardHtml(b)).join('');
    this.attachBillActionListeners(container);
    this.refreshIcons();
  },

  // Toggle card dropdown menu safely (opens full-view action sheet on mobile/small screens, or inline dropdown on desktop)
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
  },

  renderBillCardHtml(b) {
    const curr = window.APP_CURRENCY || '₹';
    const badgeClass = b.status === 'PAID' ? 'badge-paid' : (b.status === 'OVERDUE' ? 'badge-overdue' : (b.status === 'PARTIAL' ? 'badge-partial' : 'badge-pending'));
    
    return `
      <div class="app-card">
        <div class="card-top">
          <div>
            <div class="card-title">${b.tenant_name} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-muted);">(${b.property_name})</span></div>
            <div class="card-subtitle">Bill #${b.bill_number} • ${b.billing_month} • Due ${b.due_date}</div>
          </div>
          <div class="card-top-right">
            <span class="badge ${badgeClass}">${b.status}</span>
            <div class="card-dropdown">
              <button type="button" class="btn-card-more" onclick="App.toggleDropdown(this, event)" aria-label="Bill options">
                <i data-lucide="more-vertical"></i>
              </button>
              <div class="card-dropdown-menu">
                <button type="button" class="dropdown-item btn-action-remind" data-bill-id="${b.id}">
                  <i data-lucide="send" style="color:var(--primary);"></i> Send Reminder
                </button>
                <button type="button" class="dropdown-item btn-action-share" data-bill-id="${b.id}">
                  <i data-lucide="share-2"></i> Share Bill
                </button>
                <button type="button" class="dropdown-item btn-action-view" data-bill-id="${b.id}">
                  <i data-lucide="printer"></i> View / Print
                </button>
                <button type="button" class="dropdown-item btn-action-edit" data-bill-id="${b.id}">
                  <i data-lucide="edit-3"></i> Edit Bill
                </button>
                ${b.status !== 'PAID' ? `
                  <button type="button" class="dropdown-item dropdown-item-success btn-action-pay" data-bill-id="${b.id}">
                    <i data-lucide="credit-card"></i> Record Payment
                  </button>
                ` : ''}
                <button type="button" class="dropdown-item dropdown-item-danger btn-action-del" data-bill-id="${b.id}">
                  <i data-lucide="trash-2"></i> Delete Bill
                </button>
              </div>
            </div>
          </div>
        </div>
        <div class="card-middle">
          <div>
            <div class="card-amount-label">Total Bill</div>
            <div class="card-amount-val" title="${this.formatFullMoney(b.total_amount)}">${this.formatMoney(b.total_amount, true)}</div>
          </div>
          ${b.paid_amount > 0 ? `
            <div style="text-align:right;">
              <div class="card-amount-label">Balance Due</div>
              <div style="font-size:1.15rem; font-weight:700; color:var(--danger);" title="${this.formatFullMoney(b.balance_amount)}">${this.formatMoney(b.balance_amount, true)}</div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  },

  attachBillActionListeners(container) {
    container.querySelectorAll('.btn-action-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));
        this.showInvoice(btn.getAttribute('data-bill-id'));
      });
    });

    container.querySelectorAll('.btn-action-remind').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));
        const id = parseInt(btn.getAttribute('data-bill-id'), 10);
        this.openReminderModalForBill(id);
      });
    });

    container.querySelectorAll('.btn-action-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));
        this.editBill(btn.getAttribute('data-bill-id'));
      });
    });

    container.querySelectorAll('.btn-action-share').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));
        const id = parseInt(btn.getAttribute('data-bill-id'), 10);
        // Look up cached bill synchronously so user gesture is never broken
        let bill = App.bills.find(b => b.id === id);
        if (bill) {
          Share.shareBill(bill);
        } else {
          API.getBill(id).then(b => Share.shareBill(b));
        }
      });
    });

    container.querySelectorAll('.btn-action-pay').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));
        this.openPaymentModal(btn.getAttribute('data-bill-id'));
      });
    });

    container.querySelectorAll('.btn-action-del').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));
        const billId = parseInt(btn.getAttribute('data-bill-id'), 10);
        const bill = App.bills.find(b => b.id === billId);
        const billNo = bill ? bill.bill_number : `#${billId}`;
        const tenantName = bill ? bill.tenant_name : 'Tenant';
        const month = bill && bill.billing_month ? bill.billing_month : '';
        const curr = window.APP_CURRENCY || '₹';
        const amount = bill ? `${curr}${bill.total_amount.toFixed(2)}` : '';

        let warningHtml = `Are you sure you want to delete invoice <strong>${billNo}</strong> for <strong>${tenantName}</strong> (${month})?`;
        if (bill && bill.paid_amount > 0) {
          warningHtml += `<br><br><span style="color:var(--danger); font-weight:600;"><i data-lucide="alert-triangle" style="width:14px; height:14px; vertical-align:-2px;"></i> Payment Warning:</span> This bill has <strong>${curr}${bill.paid_amount.toFixed(2)}</strong> in recorded payments. Deleting this bill will also remove these payment records.`;
        }

        this.confirmDelete({
          title: 'Delete Bill',
          subtitle: `${billNo} • ${tenantName} ${amount ? `(${amount})` : ''}`,
          warningHtml: warningHtml,
          buttonLabel: 'Hold to Delete Bill (10s)',
          onConfirm: async () => {
            try {
              await API.deleteBill(billId);
              this.toast('Bill deleted');
              await this.refreshAll();
            } catch (err) {
              alert('Error: ' + err.message);
            }
          }
        });
      });
    });
  },

  async showInvoice(billId) {
    try {
      const b = await API.getBill(billId);
      this.currentBillForInvoice = b;
      const curr = window.APP_CURRENCY || '₹';
      const tenant = (this.tenants || []).find(t => t.id === b.tenant_id);
      const property = (this.properties || []).find(p => p.id === b.property_id);
      const propertyAddress = (property && property.address) ? property.address : '';
      const tenantEmail = (tenant && tenant.email) || b.tenant_email || '';

      let coOccupantsHtml = '';
      if (tenant && Array.isArray(tenant.co_occupants) && tenant.co_occupants.length > 0) {
        coOccupantsHtml = `
          <div class="inv-party-detail inv-party-co">
            <strong>Co-occupant(s):</strong> ${tenant.co_occupants.map(c => `${c.name}${c.phone ? ` (${c.phone})` : ''}`).join(', ')}
          </div>
        `;
      } else if (tenant && tenant.co_occupant_name) {
        coOccupantsHtml = `
          <div class="inv-party-detail inv-party-co">
            <strong>Co-occupant:</strong> ${tenant.co_occupant_name}${tenant.co_occupant_phone ? ` (${tenant.co_occupant_phone})` : ''}
          </div>
        `;
      }

      const issueDate = b.created_at ? (b.created_at.split('T')[0] || b.created_at.split(' ')[0]) : '';
      const statusBadge = `<span class="badge ${b.status === 'PAID' ? 'badge-paid' : (b.status === 'OVERDUE' ? 'badge-overdue' : 'badge-pending')}">${b.status}</span>`;
      const numFmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (n || '0.00'));

      const html = `
        <div class="inv-header">
          <div class="inv-brand-section">
            <div class="inv-title">RENT INVOICE / RECEIPT</div>
            <div class="inv-num">Invoice #: <strong>${b.bill_number}</strong></div>
            <div class="inv-date">Date: ${issueDate}</div>
          </div>
          <div class="inv-meta-section">
            <div class="inv-badge-wrap">${statusBadge}</div>
            <div class="inv-period">Billing Month: <strong>${b.billing_month}</strong></div>
            <div class="inv-due">Due Date: <strong>${b.due_date}</strong></div>
          </div>
        </div>

        <div class="inv-parties">
          <div class="inv-party-col">
            <div class="inv-party-label">Billed To (Tenant)</div>
            <div class="inv-party-name">${b.tenant_name}</div>
            <div class="inv-party-detail"><strong>Mobile:</strong> ${b.tenant_phone}</div>
            ${tenantEmail ? `<div class="inv-party-detail"><strong>Email:</strong> ${tenantEmail}</div>` : ''}
            ${coOccupantsHtml}
          </div>
          <div class="inv-party-col inv-party-right">
            <div class="inv-party-label">Rental Premises</div>
            <div class="inv-party-name">${b.property_name}</div>
            ${propertyAddress ? `<div class="inv-party-detail">${propertyAddress}</div>` : ''}
          </div>
        </div>

        <table class="inv-table">
          <thead>
            <tr>
              <th style="width:45%;">Line Item / Description</th>
              <th style="width:35%;">Details / Readings</th>
              <th class="num" style="width:20%;">Amount (${curr})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Base House Rent</strong></td>
              <td>Rent for ${b.billing_month}</td>
              <td class="num">${curr}${numFmt(b.base_rent)}</td>
            </tr>
            ${b.electricity_amount > 0 ? `
              <tr>
                <td><strong>Electricity Charges</strong></td>
                <td>
                  ${b.electricity_units} units @ ${curr}${b.electricity_rate}
                  <div class="inv-subtext">Meter: ${b.prev_electricity_meter} ➔ ${b.curr_electricity_meter}</div>
                </td>
                <td class="num">${curr}${numFmt(b.electricity_amount)}</td>
              </tr>
            ` : ''}
            ${b.water_amount > 0 ? `
              <tr>
                <td><strong>Water Charges</strong></td>
                <td>
                  ${b.water_billing_type === 'METER' ? `
                    ${b.water_units} units @ ${curr}${b.water_rate}
                    <div class="inv-subtext">Meter: ${b.prev_water_meter} ➔ ${b.curr_water_meter}</div>
                  ` : 'Fixed Monthly Charge'}
                </td>
                <td class="num">${curr}${numFmt(b.water_amount)}</td>
              </tr>
            ` : ''}
            ${b.maintenance_amount > 0 ? `
              <tr>
                <td><strong>Maintenance</strong></td>
                <td>Society & Maintenance</td>
                <td class="num">${curr}${numFmt(b.maintenance_amount)}</td>
              </tr>
            ` : ''}
            ${b.other_charges > 0 ? `
              <tr>
                <td><strong>Other Charges</strong></td>
                <td>${b.other_charges_desc || 'Adjustment'}</td>
                <td class="num">${curr}${numFmt(b.other_charges)}</td>
              </tr>
            ` : ''}
            ${b.discount_amount > 0 ? `
              <tr class="inv-row-discount">
                <td><strong style="color:var(--success, #16a34a);"><i data-lucide="tag" style="width:13px; height:13px; vertical-align:-2px;"></i> Discount</strong></td>
                <td>${b.discount_reason || 'Concession'}</td>
                <td class="num" style="color:var(--success, #16a34a); font-weight:700;">-${curr}${numFmt(b.discount_amount)}</td>
              </tr>
            ` : ''}
            ${b.previous_balance > 0 ? `
              <tr class="inv-row-arrears">
                <td><strong style="color:var(--danger, #dc2626);"><i data-lucide="history" style="width:13px; height:13px; vertical-align:-2px;"></i> Previous Arrears</strong></td>
                <td>Unpaid balance carried forward</td>
                <td class="num" style="color:var(--danger, #dc2626); font-weight:700;">${curr}${numFmt(b.previous_balance)}</td>
              </tr>
            ` : ''}
          </tbody>
          <tfoot>
            <tr class="inv-total-row">
              <td colspan="2"><strong>Total Amount Due</strong></td>
              <td class="num"><strong>${curr}${numFmt(b.total_amount)}</strong></td>
            </tr>
            ${b.paid_amount > 0 ? `
              <tr class="inv-paid-row">
                <td colspan="2">Amount Paid</td>
                <td class="num" style="color:var(--success, #16a34a); font-weight:600;">${curr}${numFmt(b.paid_amount)}</td>
              </tr>
              <tr class="inv-balance-row">
                <td colspan="2"><strong>Outstanding Balance Due</strong></td>
                <td class="num"><strong style="color:${b.balance_amount > 0 ? 'var(--danger, #dc2626)' : 'inherit'}; font-size:1.05rem;">${curr}${numFmt(b.balance_amount)}</strong></td>
              </tr>
            ` : ''}
          </tfoot>
        </table>

        <div class="amount-words-box">
          <strong>Amount in Words:</strong> ${typeof Share !== 'undefined' ? Share.amountInWords(b.total_amount) : ''}
          ${(b.paid_amount > 0 && b.balance_amount > 0) ? `<br><small><strong>Balance in Words:</strong> ${Share.amountInWords(b.balance_amount)}</small>` : ''}
        </div>

        ${(b.payment_upi || b.payment_bank_name) ? `
          <div class="payment-details-box">
            <div class="payment-details-title">
              <i data-lucide="credit-card" style="width:14px; height:14px; vertical-align:-2px;"></i> Payment Details (Pay To):
            </div>
            <div class="payment-details-grid">
              ${b.payment_upi ? `<div><strong>UPI ID:</strong> <span class="mono-val">${b.payment_upi}</span></div>` : ''}
              ${b.payment_bank_name ? `<div><strong>Bank:</strong> ${b.payment_bank_name}</div>` : ''}
              ${b.payment_account_no ? `<div><strong>A/C No:</strong> <span class="mono-val">${b.payment_account_no}</span></div>` : ''}
              ${b.payment_ifsc ? `<div><strong>IFSC:</strong> <span class="mono-val">${b.payment_ifsc}</span></div>` : ''}
            </div>
          </div>
        ` : ''}

        ${b.notes ? `
          <div class="inv-notes-box">
            <strong>Note:</strong> ${b.notes}
          </div>
        ` : ''}

        <div class="inv-footer-notice">
          <span>This is a computer-generated invoice/receipt. Valid without physical signature.</span>
          <span>Generated via <strong>RentBill</strong></span>
        </div>
      `;

      document.getElementById('invoice-printable').innerHTML = html;
      this.openModal('modal-invoice');
      this.refreshIcons();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  },

  openBillModalForTenant(tenantId) {
    this.openBillModal();
    const sel = document.getElementById('bill-tenant-select');
    if (sel) {
      sel.value = tenantId;
      sel.dispatchEvent(new Event('change'));
    }
  },

  openBillModal() {
    document.getElementById('form-bill').reset();
    document.getElementById('bill-id').value = '';
    document.getElementById('modal-bill-title').textContent = 'Generate Rent & Utility Bill';
    document.getElementById('bill-elec-units').value = '0 units';
    document.getElementById('bill-elec-subtotal').textContent = `${window.APP_CURRENCY}0.00`;
    document.getElementById('bill-water-units').value = '0 units';
    document.getElementById('bill-water-subtotal').textContent = `${window.APP_CURRENCY}0.00`;
    document.getElementById('bill-calculated-total').textContent = `${window.APP_CURRENCY}0.00`;

    // Reset carryover hints & warnings
    document.getElementById('badge-elec-meter-source')?.setAttribute('style', 'display:none;');
    document.getElementById('badge-water-meter-source')?.setAttribute('style', 'display:none;');
    document.getElementById('badge-prev-balance')?.setAttribute('style', 'display:none;');
    document.getElementById('hint-prev-elec') && (document.getElementById('hint-prev-elec').textContent = '');
    document.getElementById('hint-prev-water') && (document.getElementById('hint-prev-water').textContent = '');
    document.getElementById('hint-prev-balance') && (document.getElementById('hint-prev-balance').textContent = 'Carried forward from previous unpaid bill');
    document.getElementById('warn-curr-elec')?.setAttribute('style', 'display:none;');
    document.getElementById('warn-curr-water')?.setAttribute('style', 'display:none;');
    document.getElementById('btn-unlock-prev-elec')?.setAttribute('style', 'display:none;');
    document.getElementById('btn-unlock-prev-water')?.setAttribute('style', 'display:none;');

    const prevElec = document.getElementById('bill-prev-meter');
    if (prevElec) {
      prevElec.removeAttribute('readonly');
      prevElec.classList.remove('input-readonly');
    }
    const prevWater = document.getElementById('bill-prev-water-meter');
    if (prevWater) {
      prevWater.removeAttribute('readonly');
      prevWater.classList.remove('input-readonly');
    }

    this.setupDateBadge();
    this.openModal('modal-bill');
  },

  async editBill(id) {
    try {
      const b = await API.getBill(id);
      document.getElementById('bill-id').value = b.id;
      document.getElementById('modal-bill-title').textContent = `Edit Bill #${b.bill_number}`;

      // Reset carryover hints & warnings for edit
      document.getElementById('badge-elec-meter-source')?.setAttribute('style', 'display:none;');
      document.getElementById('badge-water-meter-source')?.setAttribute('style', 'display:none;');
      document.getElementById('badge-prev-balance')?.setAttribute('style', 'display:none;');
      document.getElementById('hint-prev-elec') && (document.getElementById('hint-prev-elec').textContent = '');
      document.getElementById('hint-prev-water') && (document.getElementById('hint-prev-water').textContent = '');
      document.getElementById('hint-prev-balance') && (document.getElementById('hint-prev-balance').textContent = 'Carried forward from previous unpaid bill');
      document.getElementById('warn-curr-elec')?.setAttribute('style', 'display:none;');
      document.getElementById('warn-curr-water')?.setAttribute('style', 'display:none;');
      document.getElementById('btn-unlock-prev-elec')?.setAttribute('style', 'display:none;');
      document.getElementById('btn-unlock-prev-water')?.setAttribute('style', 'display:none;');

      const prevElec = document.getElementById('bill-prev-meter');
      if (prevElec) {
        prevElec.removeAttribute('readonly');
        prevElec.classList.remove('input-readonly');
      }
      const prevWater = document.getElementById('bill-prev-water-meter');
      if (prevWater) {
        prevWater.removeAttribute('readonly');
        prevWater.classList.remove('input-readonly');
      }

      const sel = document.getElementById('bill-tenant-select');
      if (sel) sel.value = b.tenant_id;
      document.getElementById('bill-property-display').value = b.property_name || '';
      document.getElementById('bill-property-id').value = b.property_id || '';
      document.getElementById('bill-month').value = b.billing_month || '';
      document.getElementById('bill-due-date').value = b.due_date || '';
      document.getElementById('bill-base-rent').value = b.base_rent || 0;

      // Electricity
      document.getElementById('bill-prev-meter').value = b.prev_electricity_meter || 0;
      document.getElementById('bill-curr-meter').value = b.curr_electricity_meter || 0;
      document.getElementById('bill-elec-rate').value = b.electricity_rate || 0;

      // Water
      const wType = b.water_billing_type || 'FIXED';
      document.getElementById('bill-water-type').value = wType;
      document.getElementById('bill-water-fixed-box').style.display = wType === 'METER' ? 'none' : 'block';
      document.getElementById('bill-water-meter-box').style.display = wType === 'METER' ? 'block' : 'none';
      document.getElementById('bill-water').value = b.water_amount || 0;
      document.getElementById('bill-prev-water-meter').value = b.prev_water_meter || 0;
      document.getElementById('bill-curr-water-meter').value = b.curr_water_meter || 0;
      document.getElementById('bill-water-rate').value = b.water_rate || 0;

      document.getElementById('bill-maint').value = b.maintenance_amount || 0;
      document.getElementById('bill-other').value = b.other_charges || 0;
      document.getElementById('bill-other-desc').value = b.other_charges_desc || '';
      document.getElementById('bill-discount').value = b.discount_amount || 0;
      document.getElementById('bill-discount-reason').value = b.discount_reason || '';
      const elPrevBal = document.getElementById('bill-prev-balance');
      if (elPrevBal) elPrevBal.value = b.previous_balance || 0;
      document.getElementById('bill-notes').value = b.notes || '';

      // Trigger calculation event
      document.getElementById('bill-base-rent').dispatchEvent(new Event('input'));
      this.openModal('modal-bill');
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  openTenantModal() {
    document.getElementById('form-tenant').reset();
    document.getElementById('tenant-id').value = '';
    const coListEl = document.getElementById('co-occupants-list');
    if (coListEl) coListEl.innerHTML = '';
    const statusSelect = document.getElementById('tenant-is-active');
    if (statusSelect) statusSelect.value = '1';
    const btnMoveOutCalc = document.getElementById('btn-tenant-move-out-calc');
    if (btnMoveOutCalc) btnMoveOutCalc.style.display = 'none';
    document.getElementById('modal-tenant-title').textContent = 'Add Tenant';
    this.openModal('modal-tenant');
  },

  openPropertyModal() {
    document.getElementById('form-property').reset();
    document.getElementById('prop-id').value = '';
    document.getElementById('modal-property-title').textContent = 'Add Property / Unit';
    document.getElementById('group-prop-water-fixed').style.display = 'block';
    document.getElementById('group-prop-water-meter').style.display = 'none';
    this.openModal('modal-property');
  },

  openSettingsModal() {
    this.openModal('modal-settings');
  },

  async openPaymentModal(billId) {
    try {
      const b = await API.getBill(billId);
      const curr = window.APP_CURRENCY;
      document.getElementById('pay-bill-id').value = b.id;
      document.getElementById('pay-amount').value = b.balance_amount > 0 ? b.balance_amount : '';
      document.getElementById('pay-bill-info').innerHTML = `
        <div style="background:var(--surface-alt); padding:10px; border-radius:var(--radius-sm); margin-bottom:12px; font-size:0.85rem;">
          <strong>Bill #${b.bill_number}</strong> for <strong>${b.tenant_name}</strong><br>
          Total: ${curr}${b.total_amount.toFixed(2)} | Paid: ${curr}${b.paid_amount.toFixed(2)} | 
          <span style="color:var(--danger); font-weight:700;">Due: ${curr}${b.balance_amount.toFixed(2)}</span>
        </div>
      `;
      this.openModal('modal-payment');
      this.refreshIcons();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  },

  // --- Automated WhatsApp Reminder Engine ---

  async openReminderModalForTenant(tenantId) {
    const tenant = this.tenants.find(t => t.id == tenantId) || await API.getTenant(tenantId).catch(() => null);
    if (!tenant) return;

    // Find latest unpaid or most recent bill for this tenant
    const tenantBills = (this.bills || []).filter(b => b.tenant_id == tenantId);
    const bill = tenantBills.find(b => b.status !== 'PAID') || tenantBills[0] || null;

    this.showReminderDialog(bill, tenant);
  },

  async openReminderModalForBill(billId) {
    const bill = (this.bills || []).find(b => b.id == billId) || await API.getBill(billId).catch(() => null);
    if (!bill) return;
    const tenant = (this.tenants || []).find(t => t.id == bill.tenant_id) || null;

    this.showReminderDialog(bill, tenant);
  },

  showReminderDialog(bill, tenant) {
    this.currentReminderBill = bill;
    this.currentReminderTenant = tenant;

    const tenantName = (tenant && tenant.name) || (bill && bill.tenant_name) || 'Tenant';
    const subtitle = document.getElementById('reminder-tenant-subtitle');
    if (subtitle) {
      const propName = (tenant && tenant.property_name) || (bill && bill.property_name) || '';
      subtitle.textContent = `Tenant: ${tenantName} ${propName ? '(' + propName + ')' : ''}`;
    }

    // Default channel: based on tenant.preferred_channel
    let activeChannel = (tenant && tenant.preferred_channel === 'WHATSAPP') ? 'whatsapp' : 'sms_rcs';

    // Default template: if overdue -> 'overdue', if due today -> 'due_today', if paid -> 'receipt', else -> 'gentle'
    let activeType = 'gentle';
    if (bill) {
      if (bill.status === 'PAID') activeType = 'receipt';
      else if (bill.status === 'OVERDUE') activeType = 'overdue';
      else {
        const today = new Date().toISOString().split('T')[0];
        if (bill.due_date === today) activeType = 'due_today';
      }
    }

    const channelPills = document.querySelectorAll('#modal-reminder .channel-pill');
    channelPills.forEach(p => {
      if (p.getAttribute('data-channel') === activeChannel) p.classList.add('active');
      else p.classList.remove('active');
    });

    const templatePills = document.querySelectorAll('#modal-reminder .template-pill');
    templatePills.forEach(p => {
      if (p.getAttribute('data-tpl') === activeType) p.classList.add('active');
      else p.classList.remove('active');
    });

    const msgBox = document.getElementById('reminder-message-text');
    const counterEl = document.getElementById('reminder-char-counter');
    const btnSendPrimary = document.getElementById('btn-send-reminder-primary');
    const btnSendIcon = document.getElementById('btn-send-primary-icon');
    const btnSendText = document.getElementById('btn-send-primary-text');

    const updatePrimaryButton = () => {
      if (!btnSendPrimary) return;
      if (activeChannel === 'whatsapp') {
        btnSendPrimary.className = 'btn btn-whatsapp';
        if (btnSendText) btnSendText.textContent = 'Open WhatsApp Now';
        if (btnSendIcon) btnSendIcon.setAttribute('data-lucide', 'message-circle');
      } else if (activeChannel === 'email') {
        btnSendPrimary.className = 'btn btn-primary';
        if (btnSendText) btnSendText.textContent = 'Send via Email';
        if (btnSendIcon) btnSendIcon.setAttribute('data-lucide', 'mail');
      } else {
        // SMS / RCS
        btnSendPrimary.className = 'btn btn-primary';
        if (btnSendText) btnSendText.textContent = 'Send via SMS / RCS';
        if (btnSendIcon) btnSendIcon.setAttribute('data-lucide', 'message-square');
      }
      this.refreshIcons();
    };

    const updateCharCounter = (text) => {
      if (!counterEl) return;
      const chars = (text || '').length;
      if (activeChannel === 'sms_rcs') {
        const smsSegments = Math.ceil(chars / 160) || 1;
        counterEl.textContent = `${chars} chars (${smsSegments} SMS / RCS)`;
      } else {
        counterEl.textContent = `${chars} chars`;
      }
    };

    const regenerateMessage = () => {
      if (msgBox) {
        const text = Share.buildReminderMessage(activeType, this.currentReminderBill, this.currentReminderTenant, activeChannel);
        msgBox.value = text;
        updateCharCounter(text);
      }
      updatePrimaryButton();
    };

    regenerateMessage();

    // Bind channel clicks
    channelPills.forEach(p => {
      p.onclick = () => {
        channelPills.forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        activeChannel = p.getAttribute('data-channel');
        regenerateMessage();
      };
    });

    // Bind template clicks
    templatePills.forEach(p => {
      p.onclick = () => {
        templatePills.forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        activeType = p.getAttribute('data-tpl');
        regenerateMessage();
      };
    });

    // Live typing counter
    if (msgBox) {
      msgBox.oninput = () => {
        updateCharCounter(msgBox.value);
      };
    }

    // Bind copy message
    const btnCopy = document.getElementById('btn-copy-reminder-msg');
    if (btnCopy && msgBox) {
      btnCopy.onclick = async () => {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(msgBox.value);
          } else {
            msgBox.select();
            document.execCommand('copy');
          }
          this.toast('Reminder text copied to clipboard!');
        } catch (e) {
          msgBox.select();
          document.execCommand('copy');
          this.toast('Copied!');
        }
      };
    }

    // Bind primary send action
    if (btnSendPrimary) {
      btnSendPrimary.onclick = () => {
        const phone = (tenant && tenant.phone) || (bill && bill.tenant_phone) || '';
        const email = (tenant && tenant.email) || (bill && bill.tenant_email) || '';
        const text = msgBox ? msgBox.value : '';

        if (activeChannel === 'whatsapp') {
          Share.sendWhatsAppDirect(phone, text);
          this.toast('Opening WhatsApp...');
        } else if (activeChannel === 'email') {
          const subject = `Rent Notice for ${bill ? bill.property_name : (tenant ? tenant.property_name : 'Rental Unit')}`;
          Share.sendEmailDirect(email, subject, text);
          this.toast('Opening Email client...');
        } else {
          // SMS / RCS
          Share.sendSmsRcsDirect(phone, text);
          this.toast('Opening Messages (SMS / RCS)...');
        }
        this.closeModal('modal-reminder');
      };
    }

    this.openModal('modal-reminder');
    this.refreshIcons();
  },

  // --- 4-Digit Security PIN App Lock Controller ---

  bindAppLock() {
    // Quick lock button in top navigation bar
    const btnLock = document.getElementById('btn-lock-app');
    if (btnLock) {
      btnLock.addEventListener('click', () => {
        this.lockApp();
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
            this.lockApp();
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
        // If not unlocked in this browser session, present lock screen immediately
        const unlocked = sessionStorage.getItem('rb_unlocked') === 'true';
        if (!unlocked) {
          this.lockApp();
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

  lockApp() {
    if (!this.isPINEnabled) return;
    this.isAppLocked = true;
    this.enteredPIN = '';
    sessionStorage.removeItem('rb_unlocked');
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

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

