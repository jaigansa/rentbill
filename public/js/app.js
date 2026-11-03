// RentBill - Core Application Orchestrator (ES Module)
// Imports specialized modules and assembles the unified App controller

import { Utils } from './modules/utils.js';
import { UI } from './modules/ui.js';
import { Auth } from './modules/auth.js';
import { Properties } from './modules/properties.js';
import { Tenants } from './modules/tenants.js';
import { Bills } from './modules/bills.js';
import { Settlement } from './modules/settlement.js';
import { Reminders } from './modules/reminders.js';
import { Theme } from './modules/theme.js';

window.APP_NAME = 'RentBill';
window.APP_CURRENCY = '₹';

const App = {
  // Integrate specialized module capabilities
  ...Utils,
  ...UI,
  ...Auth,
  ...Properties,
  ...Tenants,
  ...Bills,
  ...Settlement,
  ...Reminders,
  ...Theme,

  // Root state properties
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
  expenseSearchQuery: '',
  expenseCategoryFilter: 'all',
  expenseMonthFilter: 'all',
  currentPropertyExpenses: [],
  properties: [],
  tenants: [],
  bills: [],
  isPINEnabled: false,
  isAppLocked: false,
  enteredPIN: '',
  isVerifyingPIN: false,

  async init() {
    this.initTheme();
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

  bindForms() {
    this.bindTenantPhotoUpload?.();
    this.bindTenantPaymentUX?.();
    this.bindTenantDocumentUpload?.();

    // Live tenant phone format validation
    const phoneInput = document.getElementById('tenant-phone');
    if (phoneInput) {
      phoneInput.addEventListener('input', () => {
        const val = phoneInput.value.trim();
        const hint = document.getElementById('hint-tenant-phone');
        if (!val) {
          phoneInput.classList.remove('is-invalid', 'is-valid');
          if (hint) {
            hint.style.display = 'none';
            hint.textContent = '';
          }
          return;
        }
        const clean = val.replace(/[\s\-\(\)]/g, '');
        const isValid = /^\+?[0-9]{7,15}$/.test(clean);
        if (isValid) {
          phoneInput.classList.remove('is-invalid');
          phoneInput.classList.add('is-valid');
          if (hint) {
            hint.style.display = 'block';
            hint.className = 'form-inline-feedback feedback-success';
            hint.textContent = '✓ Valid phone format';
          }
        } else {
          phoneInput.classList.add('is-invalid');
          phoneInput.classList.remove('is-valid');
          if (hint) {
            hint.style.display = 'block';
            hint.className = 'form-inline-feedback feedback-danger';
            hint.textContent = 'Enter valid phone number (min 7 digits)';
          }
        }
      });
    }

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
        this.toast('Error: ' + err.message, 'error');
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
        photo: document.getElementById('tenant-photo')?.value || '',
        phone: document.getElementById('tenant-phone').value.trim(),
        email: document.getElementById('tenant-email').value.trim(),
        property_id: propIdVal ? parseInt(propIdVal, 10) : null,
        security_deposit: parseFloat(document.getElementById('tenant-deposit').value) || 0,
        opening_arrear: parseFloat(document.getElementById('tenant-opening-arrear')?.value) || 0,
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
        documents: this.currentTenantDocuments || [],
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
        this.currentTenantDocuments = [];
        this.renderTenantFormDocsList?.();
        const coListEl = document.getElementById('co-occupants-list');
        if (coListEl) coListEl.innerHTML = '';
        await this.refreshAll();
      } catch (err) {
        this.toast('Error: ' + err.message, 'error');
      }
    });

    // Bill Form (Create / Edit)
    document.getElementById('form-bill')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const billId = document.getElementById('bill-id').value;
      const tenantId = parseInt(document.getElementById('bill-tenant-select').value, 10);
      const propId = parseInt(document.getElementById('bill-property-id').value, 10);

      if (!propId) {
        this.toast('Selected tenant has no assigned property unit.', 'warning');
        return;
      }

      const wType = document.getElementById('bill-water-type').value;

      const prevElec = parseFloat(document.getElementById('bill-prev-meter').value) || 0;
      const currElec = parseFloat(document.getElementById('bill-curr-meter').value) || 0;
      if (currElec < prevElec) {
        this.toast(`Current Electricity Meter reading (${currElec}) cannot be less than Previous reading (${prevElec}).`, 'warning');
        document.getElementById('bill-curr-meter')?.focus();
        return;
      }

      const prevWater = parseFloat(document.getElementById('bill-prev-water-meter').value) || 0;
      const currWater = parseFloat(document.getElementById('bill-curr-water-meter').value) || 0;
      if (wType === 'METER' && currWater < prevWater) {
        this.toast(`Current Water Meter reading (${currWater}) cannot be less than Previous reading (${prevWater}).`, 'warning');
        document.getElementById('bill-curr-water-meter')?.focus();
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
        this.toast('Error: ' + err.message, 'error');
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
        this.toast('Error: ' + err.message, 'error');
      }
    });

    // Edit Payment Form (Update / Delete)
    document.getElementById('form-edit-payment')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = parseInt(document.getElementById('edit-pay-id').value, 10);
      const billId = parseInt(document.getElementById('edit-pay-bill-id').value, 10);
      const payData = {
        amount: parseFloat(document.getElementById('edit-pay-amount').value) || 0,
        payment_date: document.getElementById('edit-pay-date').value,
        payment_method: document.getElementById('edit-pay-method').value,
        reference_no: document.getElementById('edit-pay-ref').value.trim(),
        notes: document.getElementById('edit-pay-notes').value.trim()
      };

      try {
        await API.updatePayment(id, payData);
        this.closeModal('modal-edit-payment');
        this.toast('Payment record updated successfully');
        await this.refreshAll();
        if (billId && document.getElementById('modal-invoice')?.classList.contains('active')) {
          this.showInvoice(billId);
        }
        if (this.currentLedgerTenantId && document.getElementById('modal-ledger')?.classList.contains('active')) {
          this.renderTenantLedger(this.currentLedgerTenantId);
        }
      } catch (err) {
        this.toast('Error: ' + err.message, 'error');
      }
    });

    document.getElementById('btn-delete-payment-record')?.addEventListener('click', async () => {
      const id = parseInt(document.getElementById('edit-pay-id').value, 10);
      const billId = parseInt(document.getElementById('edit-pay-bill-id').value, 10);
      const amount = document.getElementById('edit-pay-amount').value;
      if (!id) return;
      await this.deletePaymentRecord(id, billId, amount);
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
        this.toast('Error saving expense: ' + err.message, 'error');
      }
    });

  },

  async loadSettings() {
    try {
      const s = await API.getSettings();
      window.APP_CURRENCY = s.currency_symbol || '₹';
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
          const displayMonth = this.formatMonth(m);
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

      // 3. Quick Stats Grid
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

      const overdueWrap = document.getElementById('dash-overdue-wrap');
      if (overdueWrap) {
        overdueWrap.style.display = (data.total_overdue && data.total_overdue > 0) ? 'block' : 'none';
      }

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

      const depositsEl = document.getElementById('dash-total-deposits');
      if (depositsEl) {
        depositsEl.textContent = this.formatMoney(data.total_deposits_held || 0, true);
        depositsEl.title = `Total security deposits held in trust across ${data.active_tenants_count || 0} active tenants: ${this.formatFullMoney(data.total_deposits_held || 0)}`;
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
          if (unbilledList.length > 0 && data.selected_month !== 'ALL') {
            html += `
              <div class="batch-bill-banner">
                <div class="batch-bill-info">
                  <div class="batch-bill-title">
                    <i data-lucide="zap" style="width:16px;height:16px;"></i>
                    <span>${unbilledList.length} Tenant(s) Not Billed for ${this.formatMonth(data.selected_month) || data.selected_month}</span>
                  </div>
                  <div class="batch-bill-desc">Auto-generate base rent, utilities & arrears in 1 click.</div>
                </div>
                <button type="button" class="btn btn-primary btn-sm" onclick="App.openBatchBillsModal('${data.selected_month}', ${unbilledList.length})">
                  <i data-lucide="layers" style="width:14px;height:14px;"></i> Generate All Bills (${unbilledList.length})
                </button>
              </div>
            `;
          }

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

      this.refreshIcons();
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
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

    // Expense History Search & Filters
    this.bindExpenseFilters?.();
  },

  openSettingsModal() {
    this.openModal('modal-settings');
  },

  // 1-Click Batch Monthly Bill Generator with EB Reading Entry Roll
  async openBatchBillsModal(month, count) {
    const targetMonth = month || this.selectedDashboardMonth || new Date().toISOString().slice(0, 7);
    const monthInput = document.getElementById('batch-billing-month');
    if (monthInput) {
      monthInput.value = targetMonth;
    }
    const dueInput = document.getElementById('batch-due-date');
    if (dueInput) {
      dueInput.value = `${targetMonth}-10`;
    }

    this.openModal('modal-batch-bills');
    await this.loadBatchPreview(targetMonth);
  },

  async loadBatchPreview(month) {
    const container = document.getElementById('batch-meter-entries-container');
    const badgeCount = document.getElementById('batch-meter-count-badge');
    const submitCount = document.getElementById('batch-submit-count');

    if (container) {
      container.innerHTML = `<div class="empty-state"><i data-lucide="loader" style="width:24px;height:24px;animation:spin 1s linear infinite;"></i><div>Loading active unbilled tenants...</div></div>`;
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      const items = await API.getBatchBillPreview(month);
      this.batchPreviewItems = items || [];

      if (badgeCount) badgeCount.textContent = `${this.batchPreviewItems.length} Tenants`;
      if (submitCount) submitCount.textContent = this.batchPreviewItems.length;

      this.renderBatchMeterRoll();
    } catch (err) {
      if (container) {
        container.innerHTML = `<div class="empty-state text-danger">Failed loading roll: ${err.message}</div>`;
      }
    }
  },

  renderBatchMeterRoll() {
    const container = document.getElementById('batch-meter-entries-container');
    if (!container) return;

    const items = this.batchPreviewItems || [];
    if (items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="check-circle-2" style="width:32px;height:32px;color:var(--success);"></i>
          <div>All active tenants already have bills generated for this month.</div>
        </div>
      `;
      this.updateBatchRollSummary();
      this.refreshIcons();
      return;
    }

    const curr = window.APP_CURRENCY || '₹';

    container.innerHTML = items.map(it => {
      const isWaterMeter = it.water_billing_type === 'METER';
      const fixedWaterAmt = isWaterMeter ? 0 : (it.water_charge || 0);
      const fixedBase = (it.default_rent || 0) + fixedWaterAmt + (it.maintenance_charge || 0) + (it.previous_balance || 0);

      return `
        <div class="batch-meter-card" data-tenant-id="${it.tenant_id}">
          <div class="batch-meter-tenant">
            <span class="batch-meter-name">${it.tenant_name}</span>
            <span class="batch-meter-unit">Unit: <strong>${it.property_name}</strong> • Rent: ${curr}${it.default_rent}</span>
            ${it.previous_balance > 0 ? `<span style="font-size:0.72rem; color:var(--danger); font-weight:600;">+ Past Arrear: ${curr}${it.previous_balance.toFixed(2)}</span>` : ''}
            ${it.previous_balance < 0 ? `<span style="font-size:0.72rem; color:var(--success); font-weight:600;">- Advance Credit: ${curr}${Math.abs(it.previous_balance).toFixed(2)}</span>` : ''}
          </div>

          <div class="batch-meter-prev">
            <span style="font-size:0.7rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Prev EB Meter</span>
            <span class="badge badge-date" style="font-weight:700; font-size:0.8rem;">${it.prev_electricity_meter} units</span>
            <span style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Rate: ${curr}${it.electricity_rate}/unit</span>
          </div>

          <div class="batch-meter-input-wrap">
            <label style="font-size:0.72rem; font-weight:600; color:var(--text-muted); margin-bottom:1px;">New EB Reading</label>
            <input type="number" step="any" min="${it.prev_electricity_meter}" 
                   class="batch-meter-input batch-elec-input" 
                   data-tenant-id="${it.tenant_id}" 
                   data-prev="${it.prev_electricity_meter}" 
                   data-rate="${it.electricity_rate}" 
                   data-fixed="${fixedBase}"
                   placeholder="Enter reading (e.g. ${it.prev_electricity_meter})"
                   inputmode="decimal">
            <div id="batch-elec-calc-${it.tenant_id}" style="font-size:0.72rem; color:var(--text-muted); margin-top:1px;">
              0 units consumed = ${curr}0.00
            </div>
            ${isWaterMeter ? `
              <label style="font-size:0.72rem; font-weight:600; color:var(--text-muted); margin-top:4px;">New Water Reading (Prev: ${it.prev_water_meter})</label>
              <input type="number" step="any" min="${it.prev_water_meter}" 
                     class="batch-meter-input batch-water-input" 
                     data-tenant-id="${it.tenant_id}" 
                     data-prev="${it.prev_water_meter}" 
                     data-rate="${it.water_rate}"
                     placeholder="${it.prev_water_meter}"
                     inputmode="decimal">
            ` : ''}
          </div>

          <div class="batch-meter-result">
            <span style="font-size:0.7rem; text-transform:uppercase; font-weight:700; color:var(--text-muted);">Est. Total</span>
            <strong id="batch-row-total-${it.tenant_id}" style="font-size:1.05rem; color:var(--text-main); font-weight:800;">
              ${curr}${fixedBase.toFixed(2)}
            </strong>
          </div>
        </div>
      `;
    }).join('');

    // Attach real-time calculation input listeners
    container.querySelectorAll('.batch-meter-input').forEach(input => {
      input.addEventListener('input', () => {
        this.updateBatchRow(input.getAttribute('data-tenant-id'));
        this.updateBatchRollSummary();
      });
    });

    this.updateBatchRollSummary();
    this.refreshIcons();
  },

  updateBatchRow(tenantId) {
    const item = (this.batchPreviewItems || []).find(t => t.tenant_id == tenantId);
    if (!item) return;

    const curr = window.APP_CURRENCY || '₹';
    const elecInput = document.querySelector(`.batch-elec-input[data-tenant-id="${tenantId}"]`);
    const waterInput = document.querySelector(`.batch-water-input[data-tenant-id="${tenantId}"]`);
    const calcEl = document.getElementById(`batch-elec-calc-${tenantId}`);
    const rowTotalEl = document.getElementById(`batch-row-total-${tenantId}`);

    const prevElec = item.prev_electricity_meter || 0;
    const currElec = elecInput && elecInput.value !== '' ? parseFloat(elecInput.value) : prevElec;
    const elecRate = item.electricity_rate || 0;

    let elecUnits = 0;
    if (currElec >= prevElec) {
      elecUnits = currElec - prevElec;
    }
    const elecAmount = Math.round(elecUnits * elecRate * 100) / 100;

    if (calcEl) {
      if (elecInput && elecInput.value !== '' && currElec < prevElec) {
        calcEl.innerHTML = `<span style="color:var(--danger);">Reading must be ≥ ${prevElec}</span>`;
      } else {
        calcEl.textContent = `${elecUnits.toFixed(1)} units = ${curr}${elecAmount.toFixed(2)}`;
      }
    }

    let waterAmount = 0;
    if (item.water_billing_type === 'METER') {
      const prevWater = item.prev_water_meter || 0;
      const currWater = waterInput && waterInput.value !== '' ? parseFloat(waterInput.value) : prevWater;
      const waterRate = item.water_rate || 0;
      const waterUnits = currWater >= prevWater ? (currWater - prevWater) : 0;
      waterAmount = Math.round(waterUnits * waterRate * 100) / 100;
    } else {
      waterAmount = item.water_charge || 0;
    }

    const fixedBase = (item.default_rent || 0) + (item.maintenance_charge || 0) + (item.previous_balance || 0);
    const total = Math.max(0, fixedBase + elecAmount + waterAmount);

    if (rowTotalEl) {
      rowTotalEl.textContent = `${curr}${total.toFixed(2)}`;
    }
  },

  updateBatchRollSummary() {
    const curr = window.APP_CURRENCY || '₹';
    const totalEl = document.getElementById('batch-total-roll-amount');
    const unitsEl = document.getElementById('batch-total-units-summary');
    const items = this.batchPreviewItems || [];

    let totalRoll = 0;
    let totalUnits = 0;

    items.forEach(it => {
      const elecInput = document.querySelector(`.batch-elec-input[data-tenant-id="${it.tenant_id}"]`);
      const waterInput = document.querySelector(`.batch-water-input[data-tenant-id="${it.tenant_id}"]`);

      const prevElec = it.prev_electricity_meter || 0;
      const currElec = elecInput && elecInput.value !== '' ? parseFloat(elecInput.value) : prevElec;
      const elecUnits = currElec >= prevElec ? (currElec - prevElec) : 0;
      const elecAmount = Math.round(elecUnits * (it.electricity_rate || 0) * 100) / 100;

      let waterAmount = 0;
      if (it.water_billing_type === 'METER') {
        const prevWater = it.prev_water_meter || 0;
        const currWater = waterInput && waterInput.value !== '' ? parseFloat(waterInput.value) : prevWater;
        const waterUnits = currWater >= prevWater ? (currWater - prevWater) : 0;
        waterAmount = Math.round(waterUnits * (it.water_rate || 0) * 100) / 100;
      } else {
        waterAmount = it.water_charge || 0;
      }

      const fixed = (it.default_rent || 0) + (it.maintenance_charge || 0) + (it.previous_balance || 0);
      totalRoll += (fixed + elecAmount + waterAmount);
      totalUnits += elecUnits;
    });

    if (totalEl) totalEl.textContent = `${curr}${totalRoll.toFixed(2)}`;
    if (unitsEl) unitsEl.textContent = `${totalUnits.toFixed(1)} total EB units across ${items.length} tenants`;
  },

  async handleBatchCreateBills(e) {
    if (e && e.preventDefault) e.preventDefault();
    const monthInput = document.getElementById('batch-billing-month');
    const dueInput = document.getElementById('batch-due-date');
    const billingMonth = monthInput ? monthInput.value : '';
    const dueDate = dueInput ? dueInput.value : '';

    if (!billingMonth) {
      this.toast('Please select a billing month', 'warning');
      return;
    }

    const items = this.batchPreviewItems || [];
    if (items.length === 0) {
      this.toast('No unbilled tenants available for this month', 'warning');
      return;
    }

    // Collect all entered EB and water meter readings
    const entries = items.map(it => {
      const elecInput = document.querySelector(`.batch-elec-input[data-tenant-id="${it.tenant_id}"]`);
      const waterInput = document.querySelector(`.batch-water-input[data-tenant-id="${it.tenant_id}"]`);
      const currElec = elecInput && elecInput.value !== '' ? parseFloat(elecInput.value) : it.prev_electricity_meter;
      const currWater = waterInput && waterInput.value !== '' ? parseFloat(waterInput.value) : it.prev_water_meter;
      return {
        tenant_id: it.tenant_id,
        curr_electricity_meter: currElec,
        curr_water_meter: currWater
      };
    });

    const btn = document.getElementById('btn-submit-batch-bills');
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<i data-lucide="loader" style="width:14px;height:14px;animation:spin 1s linear infinite;"></i> Generating...`;
      if (window.lucide) window.lucide.createIcons();
    }

    try {
      const res = await API.batchCreateBills(billingMonth, dueDate, entries);
      this.closeModal('modal-batch-bills');
      this.toast(`Generated ${res.created_count} bills with EB readings for ${this.formatMonth(billingMonth) || billingMonth}!`, 'success');
      await this.refreshAll();
    } catch (err) {
      this.toast(err.message || 'Failed generating batch bills', 'error');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origText;
        if (window.lucide) window.lucide.createIcons();
      }
    }
  },

  // Tax & Accounting CSV Exports
  async exportAllBillsCSV() {
    try {
      this.toast('Preparing rent bills export...', 'info');
      const bills = await API.getBills();
      if (!bills || !bills.length) {
        this.toast('No bills available to export', 'warning');
        return;
      }
      const headers = [
        'Bill Number', 'Billing Month', 'Due Date', 'Tenant Name', 'Tenant Phone',
        'Property / Unit', 'Base Rent', 'Electricity Units', 'Electricity Rate',
        'Electricity Amount', 'Water Type', 'Water Amount', 'Maintenance Amount',
        'Other Charges', 'Discount Amount', 'Past Arrears', 'Total Amount',
        'Paid Amount', 'Balance Due', 'Status', 'Bill Created Date'
      ];
      const rows = bills.map(b => [
        b.bill_number || '',
        b.billing_month || '',
        b.due_date || '',
        b.tenant_name || '',
        b.tenant_phone || '',
        b.property_name || '',
        b.base_rent || 0,
        b.electricity_units || 0,
        b.electricity_rate || 0,
        b.electricity_amount || 0,
        b.water_billing_type || 'FIXED',
        b.water_amount || 0,
        b.maintenance_amount || 0,
        b.other_charges || 0,
        b.discount_amount || 0,
        b.previous_balance || 0,
        b.total_amount || 0,
        b.paid_amount || 0,
        (b.total_amount - b.paid_amount) || 0,
        b.status || '',
        b.created_at || ''
      ]);
      const dateStr = new Date().toISOString().slice(0, 10);
      this.downloadCSV(`rentbills_collections_${dateStr}.csv`, headers, rows);
      this.toast(`Exported ${bills.length} rent bills successfully!`, 'success');
    } catch (err) {
      this.toast('Failed exporting bills: ' + err.message, 'error');
    }
  },

  async exportAllExpensesCSV() {
    try {
      this.toast('Preparing expenses journal export...', 'info');
      const expenses = await API.getExpenses();
      if (!expenses || !expenses.length) {
        this.toast('No expenses recorded to export', 'warning');
        return;
      }
      const headers = [
        'Expense Date', 'Property / Unit', 'Category', 'Expense Title',
        'Amount', 'Paid To / Vendor', 'Payment Method', 'Notes'
      ];
      const rows = expenses.map(e => [
        e.expense_date || '',
        e.property_name || 'All Properties',
        e.category || '',
        e.title || '',
        e.amount || 0,
        e.paid_to || '',
        e.payment_method || '',
        e.notes || ''
      ]);
      const dateStr = new Date().toISOString().slice(0, 10);
      this.downloadCSV(`expenses_journal_${dateStr}.csv`, headers, rows);
      this.toast(`Exported ${expenses.length} expense entries successfully!`, 'success');
    } catch (err) {
      this.toast('Failed exporting expenses: ' + err.message, 'error');
    }
  },

  async exportAllPaymentsCSV() {
    try {
      this.toast('Preparing payments ledger export...', 'info');
      const payments = await API.getPayments();
      if (!payments || !payments.length) {
        this.toast('No payments recorded to export', 'warning');
        return;
      }
      const headers = [
        'Payment Date', 'Payment ID', 'Bill Number', 'Tenant Name',
        'Property / Unit', 'Payment Method', 'Reference / Txn ID', 'Amount Received', 'Notes'
      ];
      const rows = payments.map(p => [
        p.payment_date || '',
        p.id || '',
        p.bill_number || '',
        p.tenant_name || '',
        p.property_name || '',
        p.payment_method || '',
        p.reference_no || '',
        p.amount || 0,
        p.notes || ''
      ]);
      const dateStr = new Date().toISOString().slice(0, 10);
      this.downloadCSV(`payments_ledger_${dateStr}.csv`, headers, rows);
      this.toast(`Exported ${payments.length} payment records successfully!`, 'success');
    } catch (err) {
      this.toast('Failed exporting payments: ' + err.message, 'error');
    }
  },

  async exportAllTenantsCSV() {
    try {
      this.toast('Preparing tenants & deposits export...', 'info');
      const tenants = await API.getTenants();
      if (!tenants || !tenants.length) {
        this.toast('No tenants found to export', 'warning');
        return;
      }
      const headers = [
        'Tenant Name', 'Phone', 'Email', 'Assigned Unit', 'Occupancy Status',
        'Move-In Date', 'Security Deposit Held', 'Opening Arrears', 'Initial Elec Meter',
        'Initial Water Meter', 'Total Paid Lifetime', 'Current Due / Balance'
      ];
      const rows = tenants.map(t => [
        t.name || '',
        t.phone || '',
        t.email || '',
        t.property_name || 'Unassigned',
        t.is_active ? 'ACTIVE' : 'PAST',
        t.move_in_date || '',
        t.security_deposit || 0,
        t.opening_arrear || 0,
        t.initial_elec_meter || 0,
        t.initial_water_meter || 0,
        t.total_paid || 0,
        t.total_due || 0
      ]);
      const dateStr = new Date().toISOString().slice(0, 10);
      this.downloadCSV(`tenants_and_deposits_${dateStr}.csv`, headers, rows);
      this.toast(`Exported ${tenants.length} tenant profiles successfully!`, 'success');
    } catch (err) {
      this.toast('Failed exporting tenants: ' + err.message, 'error');
    }
  }
};

window.App = App;
export default App;

// Disable browser default right-click context menu
document.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
