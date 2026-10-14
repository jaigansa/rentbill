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

  bindForms() {
    this.bindTenantPhotoUpload?.();

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

  },

  async loadSettings() {
    try {
      const s = await API.getSettings();
      window.APP_CURRENCY = s.currency_symbol || '₹';

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
      const occPct = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

      const occBadge = document.getElementById('dash-occupancy-badge');
      if (occBadge) occBadge.textContent = `${occupiedUnits}/${totalUnits} Units (${occPct}%)`;

      this.renderOccupancyUnitGrid();
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
  },

  openSettingsModal() {
    this.openModal('modal-settings');
  }
};

window.App = App;
export default App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
