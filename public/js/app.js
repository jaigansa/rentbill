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
    document.getElementById('btn-invoice-download-img')?.addEventListener('click', () => {
      if (this.currentBillForInvoice) Share.downloadReceiptImage(this.currentBillForInvoice);
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
        currency_symbol: document.getElementById('set-currency')?.value.trim() || '₹',
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
        window.APP_CURRENCY = payload.currency_symbol;
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
      if (s.currency_symbol) window.APP_CURRENCY = s.currency_symbol;

      const elCur = document.getElementById('set-currency');
      if (elCur) elCur.value = s.currency_symbol || '₹';

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

      // 5. Occupancy Widget
      const totalUnits = data.total_properties || 0;
      const occupiedUnits = data.occupied_units || 0;
      const vacantUnits = data.vacant_units || 0;
      const occPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

      const occBadge = document.getElementById('dash-occupancy-badge');
      if (occBadge) occBadge.textContent = `${occupiedUnits}/${totalUnits} Units (${occPct}%)`;

      const occBar = document.getElementById('dash-occupancy-bar');
      if (occBar) occBar.style.width = `${occPct}%`;

      const occCountEl = document.getElementById('dash-occupied-count');
      if (occCountEl) occCountEl.textContent = `${occupiedUnits} Unit${occupiedUnits !== 1 ? 's' : ''}`;

      const vacCountEl = document.getElementById('dash-vacant-count');
      if (vacCountEl) vacCountEl.textContent = `${vacantUnits} Unit${vacantUnits !== 1 ? 's' : ''}`;

      const vacantContainer = document.getElementById('dash-vacant-container');
      if (vacantContainer) {
        const vacantProps = data.vacant_properties || [];
        if (vacantProps.length > 0) {
          vacantContainer.innerHTML = `
            <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">Vacant Units (Tap to assign tenant):</div>
            <div class="vacant-chips-wrapper">
              ${vacantProps.map(p => `
                <div class="vacant-chip" onclick="App.openNewTenantForProperty(${p.id})">
                  <i data-lucide="plus-circle" style="width:12px; height:12px; color:var(--primary);"></i>
                  <strong>${p.name}</strong> (${curr}${p.default_rent.toFixed(0)})
                </div>
              `).join('')}
            </div>
          `;
        } else {
          vacantContainer.innerHTML = `
            <div style="font-size:0.75rem; color:var(--success); margin-top:4px;">
              <i data-lucide="check" style="width:12px; height:12px; vertical-align:-1px;"></i> 100% Occupancy! All units have active tenants.
            </div>
          `;
        }
      }

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
                  <i data-lucide="plus"></i> Log Expense
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
      const ch = t.preferred_channel || 'SMS_RCS';
      const isWa = ch === 'WHATSAPP';
      const isBoth = ch === 'BOTH';
      const chIcon = isWa ? 'message-circle' : 'message-square';
      const chLabel = isWa ? 'WhatsApp' : (isBoth ? 'SMS/WA' : 'SMS/RCS');

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
                  <button type="button" class="dropdown-item" onclick="App.deactivateTenant(${t.id})">
                    <i data-lucide="user-x"></i> Move Out / Deactivate
                  </button>
                ` : `
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
    const tenant = this.tenants.find(t => t.id == id);
    const tenantName = tenant ? tenant.name : 'this tenant';
    const unitName = tenant && tenant.property_name ? tenant.property_name : 'No Unit';

    const confirmMsg = `Are you sure you want to deactivate / move out "${tenantName}" (${unitName})?\n\n` +
      `• Their assigned property flat/unit will be freed up as Vacant.\n` +
      `• All existing bills, payments, and ledger history will remain completely safe.\n` +
      `• The tenant will be moved to the "Past" residents filter tab.`;

    if (!confirm(confirmMsg)) return;

    try {
      // Fetch full tenant details to ensure full payload
      const t = await API.getTenant(id);
      t.is_active = false;
      await API.updateTenant(id, t);
      this.toast(`Tenant ${tenantName} moved out / deactivated`);
      await this.refreshAll();
    } catch (err) {
      alert('Error deactivating tenant: ' + err.message);
    }
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
              Tap "+ Log Expense" above to record maintenance or repair costs.
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
    document.getElementById('modal-expense-title').textContent = 'Log Property Expense';

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
                  <i data-lucide="send" style="color:var(--primary);"></i> Send Reminder (SMS / WA)
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
      const curr = window.APP_CURRENCY;
      const statusBadge = `<span class="badge ${b.status === 'PAID' ? 'badge-paid' : (b.status === 'OVERDUE' ? 'badge-overdue' : 'badge-pending')}">${b.status}</span>`;

      const html = `
        <div class="inv-header">
          <div>
            <div class="inv-title">RENT INVOICE</div>
            <div class="inv-num">Invoice #${b.bill_number}</div>
            <div style="font-size:0.8rem; color:var(--text-muted);">Date: ${b.created_at.split('T')[0] || b.created_at.split(' ')[0]}</div>
          </div>
          <div style="text-align:right;">
            ${statusBadge}
            <div style="font-size:0.85rem; font-weight:700; margin-top:6px;">${b.billing_month}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Due: ${b.due_date}</div>
          </div>
        </div>

        <div style="display:flex; justify-content:space-between; margin-bottom:14px; font-size:0.85rem;">
          <div>
            <strong>Billed To:</strong><br>
            ${b.tenant_name}<br>
            Phone: ${b.tenant_phone}
          </div>
          <div style="text-align:right;">
            <strong>Property Unit:</strong><br>
            ${b.property_name}
          </div>
        </div>

        <table class="inv-table">
          <thead>
            <tr>
              <th>Description</th>
              <th class="num">Amount (${curr})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Base House Rent</td>
              <td class="num">${curr}${b.base_rent.toFixed(2)}</td>
            </tr>
            ${b.electricity_amount > 0 ? `
              <tr>
                <td>
                  Electricity (${b.electricity_units} units @ ${curr}${b.electricity_rate})<br>
                  <small style="color:var(--text-muted);">Meter: ${b.prev_electricity_meter} ➔ ${b.curr_electricity_meter}</small>
                </td>
                <td class="num">${curr}${b.electricity_amount.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${b.water_amount > 0 ? `
              <tr>
                <td>
                  ${b.water_billing_type === 'METER' ? `
                    Water Meter (${b.water_units} units @ ${curr}${b.water_rate})<br>
                    <small style="color:var(--text-muted);">Meter: ${b.prev_water_meter} ➔ ${b.curr_water_meter}</small>
                  ` : `Water Charges (Fixed)`}
                </td>
                <td class="num">${curr}${b.water_amount.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${b.maintenance_amount > 0 ? `
              <tr>
                <td>Maintenance Charges</td>
                <td class="num">${curr}${b.maintenance_amount.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${b.other_charges > 0 ? `
              <tr>
                <td>Other: ${b.other_charges_desc || 'Adjustments'}</td>
                <td class="num">${curr}${b.other_charges.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${b.discount_amount > 0 ? `
              <tr style="background:rgba(22, 163, 74, 0.05);">
                <td style="color:var(--success); font-weight:600;">
                  <i data-lucide="tag" style="width:13px; height:13px; vertical-align:-2px;"></i> Discount / Concession ${b.discount_reason ? `(${b.discount_reason})` : ''}
                </td>
                <td class="num" style="color:var(--success); font-weight:700;">-${curr}${b.discount_amount.toFixed(2)}</td>
              </tr>
            ` : ''}
            ${b.previous_balance > 0 ? `
              <tr style="background:rgba(239, 68, 68, 0.05);">
                <td style="color:var(--danger); font-weight:600;">
                  <i data-lucide="history" style="width:13px; height:13px; vertical-align:-2px;"></i> Previous Arrears / Unpaid Balance
                </td>
                <td class="num" style="color:var(--danger); font-weight:700;">${curr}${b.previous_balance.toFixed(2)}</td>
              </tr>
            ` : ''}
            <tr class="inv-total-row" style="border-top:2px solid var(--border);">
              <td>Total Amount</td>
              <td class="num" style="color:var(--primary); font-size:1.15rem;">${curr}${b.total_amount.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Paid Amount</td>
              <td class="num" style="color:var(--success); font-weight:600;">${curr}${b.paid_amount.toFixed(2)}</td>
            </tr>
            <tr style="font-weight:700;">
              <td>Balance Due</td>
              <td class="num" style="color:${b.balance_amount > 0 ? 'var(--danger)' : 'var(--text-main)'}; font-size:1.05rem;">
                ${curr}${b.balance_amount.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>

        <div class="amount-words-box" style="font-size:0.82rem; margin-top:8px; padding:6px 10px; background:var(--bg); border-radius:var(--radius-sm); border:1px solid var(--border);">
          <strong>Amount in Words:</strong> ${typeof Share !== 'undefined' ? Share.amountInWords(b.total_amount) : ''}
        </div>

        ${(b.payment_upi || b.payment_bank_name) ? `
          <div class="payment-details-box" style="margin-top:12px; padding:10px 12px; background:var(--surface-alt); border-radius:var(--radius-sm); border:1px dashed var(--border); font-size:0.82rem;">
            <div style="font-weight:700; color:var(--primary); margin-bottom:4px; display:flex; align-items:center; gap:6px;">
              <i data-lucide="credit-card" style="width:14px; height:14px;"></i> Payment Details (Pay To)
            </div>
            ${b.payment_upi ? `<div><strong>UPI ID:</strong> <span style="font-family:monospace; font-size:0.9rem;">${b.payment_upi}</span></div>` : ''}
            ${b.payment_bank_name ? `<div><strong>Bank:</strong> ${b.payment_bank_name}</div>` : ''}
            ${b.payment_account_no ? `<div><strong>A/C No:</strong> <span style="font-family:monospace;">${b.payment_account_no}</span></div>` : ''}
            ${b.payment_ifsc ? `<div><strong>IFSC:</strong> <span style="font-family:monospace;">${b.payment_ifsc}</span></div>` : ''}
          </div>
        ` : ''}

        ${b.notes ? `<p style="font-size:0.8rem; color:var(--text-muted); margin-top:8px;"><strong>Note:</strong> ${b.notes}</p>` : ''}
        
        <div class="inv-footer-notice" style="margin-top:16px; padding-top:10px; border-top:1px dashed var(--border); display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:var(--text-muted);">
          <span>This is a computer-generated invoice and requires no physical signature.</span>
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

