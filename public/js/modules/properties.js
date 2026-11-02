// Properties Controller: Units, Occupancy Grid, Detail Modal, Expenses

export const Properties = {
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
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="building-2" style="width:36px; height:36px;"></i>
          <div>No properties added yet. Tap "Add Property" to begin.</div>
        </div>`;
      this.refreshIcons();
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
            <span><i data-lucide="wrench" style="width:13px; height:13px; color:var(--danger); vertical-align:-2px;"></i> Expenses: <strong style="color:var(--danger);" title="${this.formatFullMoney(p.total_expenses || 0)}">${this.formatMoney(p.total_expenses || 0, true)}</strong> (${p.expense_count || 0})</span>
            <span>Net Profit: <strong style="color:${(p.net_profit || 0) >= 0 ? 'var(--success)' : 'var(--danger)'};" title="${this.formatFullMoney(p.net_profit || 0)}">${this.formatMoney(p.net_profit || 0, true)}</strong></span>
          </div>
        ` : ''}
      </div>
    `).join('');
    this.refreshIcons();
  },

  openPropertyModal() {
    document.getElementById('form-property').reset();
    document.getElementById('prop-id').value = '';
    document.getElementById('modal-property-title').textContent = 'Add Property / Unit';
    document.getElementById('group-prop-water-fixed').style.display = 'block';
    document.getElementById('group-prop-water-meter').style.display = 'none';
    this.openModal('modal-property');
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
      this.toast('Error: ' + err.message, 'error');
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
          this.toast('Error deleting property: ' + err.message, 'error');
        }
      }
    });
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

  showUnitDetail(propertyId) {
    const p = (this.properties || []).find(prop => prop.id == propertyId);
    if (!p) return;
    this.currentUnitDetailPropertyId = p.id;

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
      iconWrap.className = 'unit-type-icon ' + (isOccupied ? 'unit-occupied' : 'unit-vacant');
      iconWrap.style.background = '';
      iconWrap.style.color = '';
      iconWrap.style.border = '';
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
        <div style="background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-md); padding:14px;">
          <div style="font-size:0.8rem; font-weight:750; text-transform:uppercase; color:var(--text-muted); letter-spacing:0.04em; margin-bottom:10px;">
            <i data-lucide="wallet" style="width:13px; height:13px; vertical-align:-2px; color:var(--primary);"></i> Expense &amp; Financial Summary
          </div>
          <div style="display:grid; grid-template-columns:repeat(2, 1fr); gap:10px;">
            <div style="background:var(--surface-alt); border-radius:var(--radius-sm); padding:9px 12px; border:1px solid var(--border);">
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block;">Total Expenses</span>
              <span style="font-size:1rem; font-weight:800; color:var(--danger);">${curr}${(p.total_expenses || 0).toFixed(2)} <small style="font-size:0.7rem; font-weight:500; color:var(--text-muted);">(${p.expense_count || 0})</small></span>
            </div>
            <div style="background:var(--surface-alt); border-radius:var(--radius-sm); padding:9px 12px; border:1px solid var(--border);">
              <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600; text-transform:uppercase; display:block;">Net Financial Yield</span>
              <span style="font-size:1rem; font-weight:800; color:${(p.net_profit || 0) >= 0 ? 'var(--success)' : 'var(--danger)'};">${curr}${(p.net_profit || 0).toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    }

    // Set Footer
    const footerEl = document.getElementById('unit-detail-footer');
    if (footerEl) {
      footerEl.innerHTML = `
        <button type="button" class="btn btn-secondary" data-close="modal-unit-detail" onclick="App.closeModal('modal-unit-detail')">Close</button>
      `;
    }

    this.openModal('modal-unit-detail');
    this.refreshIcons();
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
              <i data-lucide="receipt-text" style="width:36px; height:36px;"></i>
              <div>No expenses recorded for this property yet.</div>
              <div style="font-size:0.82rem; opacity:0.8; margin-top:2px;">Tap "+ Add Expense" above to record maintenance or repair costs.</div>
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
                  <strong style="color:var(--danger, #dc2626); font-size:1.05rem;">${curr}${ex.amount.toFixed(2)}</strong>
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
        this.toast('Expense not found', 'warning');
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
      this.toast('Error: ' + err.message, 'error');
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
          this.toast('Error deleting expense: ' + err.message, 'error');
        }
      }
    });
  }
};
