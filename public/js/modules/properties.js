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
      <div class="app-card property-card property-compact-card">
        <div class="prop-compact-header">
          <div class="prop-compact-title-box">
            <div class="prop-compact-name">${p.name}</div>
            <div class="prop-compact-sub">${p.unit_type}${p.address ? ` • ${p.address}` : ''}</div>
          </div>
          <div class="prop-compact-header-right">
            <span class="badge ${p.tenant_count > 0 ? 'badge-paid' : 'badge-date'} badge-sm">
              ${p.tenant_count > 0 ? `${p.tenant_count} Occupied` : 'Vacant'}
            </span>
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

        <div class="prop-compact-meta-strip">
          <span class="prop-rate-tag"><strong>${this.formatMoney(p.default_rent, true)}</strong>/mo</span>
          <span class="prop-rate-dot">•</span>
          <span class="prop-rate-sub"><i data-lucide="zap" style="width:12px; height:12px; color:var(--warning);"></i> ${curr}${p.electricity_rate}</span>
          <span class="prop-rate-dot">•</span>
          <span class="prop-rate-sub"><i data-lucide="droplet" style="width:12px; height:12px; color:var(--primary);"></i> ${p.water_billing_type === 'METER' ? `${curr}${p.water_rate}/u` : `${curr}${p.water_charge}`}</span>
        </div>
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

    // Strict Order Protection: Check if property has assigned tenants or expenses
    const propTenants = (this.tenants || []).filter(t => t.property_id == id);
    const expenseCount = prop ? (prop.expense_count || 0) : 0;
    if (propTenants.length > 0 || expenseCount > 0) {
      this.toast('Remove tenants & expenses first to delete property', 'warning');
      return;
    }

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
    // Occupancy & Unit Status widget removed from dashboard
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
    this.expenseSearchQuery = '';
    this.expenseCategoryFilter = 'all';
    this.expenseMonthFilter = 'all';

    // Reset search & filter controls in UI
    const searchInput = document.getElementById('expense-search-input');
    if (searchInput) searchInput.value = '';
    const searchClear = document.getElementById('expense-search-clear');
    if (searchClear) searchClear.style.display = 'none';

    const catSelect = document.getElementById('expense-filter-category');
    if (catSelect) catSelect.value = 'all';

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
      this.currentPropertyExpenses = expenses || [];
      const curr = window.APP_CURRENCY || '₹';

      // Re-fetch fresh property details or use cached values
      const p = this.properties.find(item => item.id == propertyId) || {};
      const totalIncome = p.total_income || 0;
      const totalExpenses = (this.currentPropertyExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
      const netProfit = totalIncome - totalExpenses;

      document.getElementById('prop-stat-income').textContent = `${curr}${totalIncome.toFixed(2)}`;
      document.getElementById('prop-stat-expenses').textContent = `${curr}${totalExpenses.toFixed(2)}`;
      const netProfitEl = document.getElementById('prop-stat-net-profit');
      if (netProfitEl) {
        netProfitEl.textContent = `${curr}${netProfit.toFixed(2)}`;
        netProfitEl.className = `ledger-stat-value ${netProfit >= 0 ? 'text-success' : 'text-danger'}`;
      }

      // Populate Month and Category filter dropdowns
      this.populateExpenseFilterDropdowns(this.currentPropertyExpenses);

      // Render the expense history list
      this.renderPropertyExpensesList();
    } catch (err) {
      console.error(err);
      if (container) {
        container.innerHTML = `<div class="empty-state text-danger">Failed to load expenses: ${err.message}</div>`;
      }
    }
  },

  populateExpenseFilterDropdowns(expenses) {
    // 1. Month dropdown (sorted newest to oldest)
    const monthSelect = document.getElementById('expense-filter-month');
    if (monthSelect) {
      const monthsSet = new Set();
      (expenses || []).forEach(e => {
        if (e.expense_date && e.expense_date.length >= 7) {
          monthsSet.add(e.expense_date.substring(0, 7));
        }
      });
      const sortedMonths = Array.from(monthsSet).sort().reverse();
      let monthHtml = '<option value="all">All Months</option>';
      sortedMonths.forEach(m => {
        monthHtml += `<option value="${m}">${this.formatMonth(m)}</option>`;
      });
      monthSelect.innerHTML = monthHtml;
      monthSelect.value = this.expenseMonthFilter || 'all';
    }

    // 2. Category dropdown (standard categories + any custom present in data)
    const catSelect = document.getElementById('expense-filter-category');
    if (catSelect) {
      const standardCategories = [
        'Repairs & Maintenance',
        'Owner Takeout',
        'Plumbing',
        'Electrical',
        'Painting / Renovation',
        'Property Tax / Municipal',
        'Cleaning & Sanitation',
        'Carpentry',
        'Appliances',
        'Other'
      ];
      const categoriesSet = new Set(standardCategories);
      (expenses || []).forEach(e => {
        if (e.category && e.category.trim()) {
          categoriesSet.add(e.category.trim());
        }
      });
      let catHtml = '<option value="all">All Categories</option>';
      categoriesSet.forEach(c => {
        catHtml += `<option value="${c}">${c}</option>`;
      });
      catSelect.innerHTML = catHtml;
      catSelect.value = this.expenseCategoryFilter || 'all';
    }
  },

  renderPropertyExpensesList() {
    const container = document.getElementById('property-expenses-container');
    if (!container) return;

    const curr = window.APP_CURRENCY || '₹';
    const allExpenses = this.currentPropertyExpenses || [];

    const query = (this.expenseSearchQuery || '').trim().toLowerCase();
    const cat = this.expenseCategoryFilter || 'all';
    const month = this.expenseMonthFilter || 'all';

    const filtered = allExpenses.filter(ex => {
      // 1. Category filter
      if (cat !== 'all' && ex.category !== cat) {
        return false;
      }
      // 2. Month filter (matches YYYY-MM prefix)
      if (month !== 'all') {
        const exMonth = (ex.expense_date || '').substring(0, 7);
        if (exMonth !== month) return false;
      }
      // 3. Search query (matches title, paid_to, notes, category, method, amount)
      if (query) {
        const textToSearch = [
          ex.title || '',
          ex.paid_to || '',
          ex.notes || '',
          ex.category || '',
          ex.payment_method || '',
          String(ex.amount || '')
        ].join(' ').toLowerCase();
        if (!textToSearch.includes(query)) return false;
      }
      return true;
    });

    // Update count badge
    const countBadge = document.getElementById('expense-count-badge');
    if (countBadge) {
      if (query || cat !== 'all' || month !== 'all') {
        countBadge.textContent = `${filtered.length} of ${allExpenses.length}`;
      } else {
        countBadge.textContent = `${allExpenses.length}`;
      }
    }

    if (filtered.length === 0) {
      if (allExpenses.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i data-lucide="receipt-text" style="width:36px; height:36px;"></i>
            <div>No expenses recorded for this property yet.</div>
            <div style="font-size:0.82rem; opacity:0.8; margin-top:2px;">Tap "+ Add Expense" above to record maintenance or repair costs.</div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="empty-state" style="padding:28px 16px;">
            <i data-lucide="search-x" style="width:36px; height:36px; margin-bottom:8px; opacity:0.6;"></i>
            <div style="font-weight:600;">No expenses match your search or filter criteria.</div>
            <button type="button" class="btn btn-sm btn-outline" id="btn-reset-expense-filters" style="margin-top:12px;">
              <i data-lucide="rotate-ccw" style="width:13px; height:13px;"></i> Reset Filters
            </button>
          </div>
        `;
        document.getElementById('btn-reset-expense-filters')?.addEventListener('click', () => {
          this.resetExpenseFilters();
        });
      }
      this.refreshIcons();
      return;
    }

    // Filtered total summary strip if active filter/search
    const isFiltered = (query || cat !== 'all' || month !== 'all');
    let summaryStripHtml = '';
    if (isFiltered) {
      const filteredTotal = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);
      summaryStripHtml = `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--surface-alt); border:1px dashed var(--border); border-radius:var(--radius-sm); padding:6px 12px; margin-bottom:10px; font-size:0.78rem;">
          <span style="color:var(--text-muted);">Filtered Results: <strong>${filtered.length}</strong> record${filtered.length === 1 ? '' : 's'}</span>
          <span style="font-weight:750; color:var(--danger);">Filtered Total: ${curr}${filteredTotal.toFixed(2)}</span>
        </div>
      `;
    }

    container.innerHTML = summaryStripHtml + filtered.map(ex => `
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

    this.refreshIcons();
  },

  resetExpenseFilters() {
    this.expenseSearchQuery = '';
    this.expenseCategoryFilter = 'all';
    this.expenseMonthFilter = 'all';

    const searchInput = document.getElementById('expense-search-input');
    if (searchInput) searchInput.value = '';
    const searchClear = document.getElementById('expense-search-clear');
    if (searchClear) searchClear.style.display = 'none';

    const catSelect = document.getElementById('expense-filter-category');
    if (catSelect) catSelect.value = 'all';

    const monthSelect = document.getElementById('expense-filter-month');
    if (monthSelect) monthSelect.value = 'all';

    this.renderPropertyExpensesList();
  },

  bindExpenseFilters() {
    const searchInput = document.getElementById('expense-search-input');
    const searchClear = document.getElementById('expense-search-clear');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.expenseSearchQuery = e.target.value.trim().toLowerCase();
        if (searchClear) {
          searchClear.style.display = this.expenseSearchQuery ? 'block' : 'none';
        }
        this.renderPropertyExpensesList();
      });
    }

    if (searchClear) {
      searchClear.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        this.expenseSearchQuery = '';
        searchClear.style.display = 'none';
        this.renderPropertyExpensesList();
      });
    }

    const catSelect = document.getElementById('expense-filter-category');
    if (catSelect) {
      catSelect.addEventListener('change', (e) => {
        this.expenseCategoryFilter = e.target.value;
        this.renderPropertyExpensesList();
      });
    }

    const monthSelect = document.getElementById('expense-filter-month');
    if (monthSelect) {
      monthSelect.addEventListener('change', (e) => {
        this.expenseMonthFilter = e.target.value;
        this.renderPropertyExpensesList();
      });
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
  },

  printPropertyExpenses() {
    this.renderPropertyExpensesPrintSheet();
    setTimeout(() => {
      window.print();
    }, 40);
  },

  exportCurrentPropertyExpensesCSV() {
    const list = this.filteredExpensesList || this.currentPropertyExpenses || [];
    if (!list.length) {
      this.toast('No expenses available to export', 'warning');
      return;
    }
    const prop = this.properties.find(p => p.id == this.currentExpensesPropertyId);
    const propName = prop ? (prop.name || 'property').replace(/[^a-zA-Z0-9_-]/g, '_') : 'property';
    const headers = ['Date', 'Category', 'Title', 'Amount', 'Paid To', 'Payment Method', 'Notes'];
    const rows = list.map(e => [
      e.expense_date || '',
      e.category || '',
      e.title || '',
      e.amount || 0,
      e.paid_to || '',
      e.payment_method || '',
      e.notes || ''
    ]);
    const dateStr = new Date().toISOString().slice(0, 10);
    this.downloadCSV(`expenses_${propName}_${dateStr}.csv`, headers, rows);
    this.toast(`Exported ${list.length} expenses successfully!`, 'success');
  },

  renderPropertyExpensesPrintSheet() {
    const container = document.getElementById('property-expenses-printable');
    if (!container) return;

    const prop = this.properties.find(p => p.id == this.currentExpensesPropertyId) || {};
    const curr = window.APP_CURRENCY || '₹';
    const allExpenses = this.currentPropertyExpenses || [];

    const query = (this.expenseSearchQuery || '').trim().toLowerCase();
    const cat = this.expenseCategoryFilter || 'all';
    const month = this.expenseMonthFilter || 'all';

    const filtered = allExpenses.filter(ex => {
      if (cat !== 'all' && ex.category !== cat) return false;
      if (month !== 'all') {
        const exMonth = (ex.expense_date || '').substring(0, 7);
        if (exMonth !== month) return false;
      }
      if (query) {
        const textToSearch = [
          ex.title || '',
          ex.paid_to || '',
          ex.notes || '',
          ex.category || '',
          ex.payment_method || '',
          String(ex.amount || '')
        ].join(' ').toLowerCase();
        if (!textToSearch.includes(query)) return false;
      }
      return true;
    });

    const totalIncome = prop.total_income || 0;
    const totalAllExpenses = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalIncome - totalAllExpenses;
    const filteredTotal = filtered.reduce((sum, e) => sum + (e.amount || 0), 0);

    const todayStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

    let filterDesc = [];
    if (month !== 'all') filterDesc.push(`Period: ${this.formatMonth(month)}`);
    else filterDesc.push('Period: All Time');
    if (cat !== 'all') filterDesc.push(`Category: ${cat}`);
    if (query) filterDesc.push(`Search: "${query}"`);

    const html = `
      <div class="prop-print-header">
        <div class="prop-print-brand">
          <div class="prop-print-title">Property Expense Statement</div>
          <div class="prop-print-subtitle">Unit: <strong>${prop.name || 'Property'}</strong> (${prop.unit_type || 'Unit'})${prop.address ? ' • ' + prop.address : ''}</div>
          <div class="prop-print-meta">Filter Criteria: <strong>${filterDesc.join(' | ')}</strong></div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.75rem; text-transform:uppercase; color:#6b7280; font-weight:700;">Statement Date</div>
          <div style="font-size:0.9rem; font-weight:700; color:#111827;">${todayStr}</div>
          <div style="font-size:0.75rem; color:#6b7280; margin-top:2px;">RentBill Financial Engine</div>
        </div>
      </div>

      <!-- Financial Summary Box -->
      <div class="prop-print-summary-box">
        <div class="prop-print-summary-col">
          <div class="prop-print-summary-lbl">Total Rent Inflow</div>
          <div class="prop-print-summary-val" style="color:#059669;">${curr}${totalIncome.toFixed(2)}</div>
        </div>
        <div class="prop-print-summary-col">
          <div class="prop-print-summary-lbl">Total Incurred Expenses</div>
          <div class="prop-print-summary-val" style="color:#dc2626;">${curr}${totalAllExpenses.toFixed(2)}</div>
        </div>
        <div class="prop-print-summary-col">
          <div class="prop-print-summary-lbl">Net Financial Yield</div>
          <div class="prop-print-summary-val" style="color:${netProfit >= 0 ? '#059669' : '#dc2626'};">
            ${curr}${netProfit.toFixed(2)}
          </div>
        </div>
      </div>

      <!-- Expense Ledger Table -->
      <table class="prop-print-table">
        <thead>
          <tr>
            <th style="width:14%;">Date</th>
            <th style="width:20%;">Category</th>
            <th>Title &amp; Details</th>
            <th style="width:16%;">Paid To</th>
            <th style="width:12%;">Payment Mode</th>
            <th class="num" style="width:16%;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.length === 0 ? `
            <tr>
              <td colspan="6" style="text-align:center; padding:16px; color:#6b7280;">No expenses matching the criteria.</td>
            </tr>
          ` : filtered.map(ex => `
            <tr>
              <td style="font-weight:600; white-space:nowrap;">${ex.expense_date || '-'}</td>
              <td>${ex.category || 'General'}</td>
              <td>
                <div style="font-weight:600;">${ex.title}</div>
                ${ex.notes ? `<div style="font-size:0.72rem; color:#6b7280;">Note: ${ex.notes}</div>` : ''}
              </td>
              <td>${ex.paid_to || '-'}</td>
              <td>${ex.payment_method || 'Cash'}</td>
              <td class="num" style="font-weight:750; color:#dc2626;">${curr}${ex.amount.toFixed(2)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td colspan="5" style="text-align:right; font-weight:800; text-transform:uppercase; font-size:0.78rem;">
              Total Filtered Expenses (${filtered.length} record${filtered.length === 1 ? '' : 's'}):
            </td>
            <td class="num" style="font-size:1.05rem; font-weight:800; color:#dc2626;">
              ${curr}${filteredTotal.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top:16px; font-size:0.72rem; color:#6b7280; display:flex; justify-content:space-between; border-top:1px dashed #d1d5db; padding-top:8px;">
        <span>Certified Property Maintenance &amp; Expense Record • ${prop.name || 'Property'}</span>
        <span>Generated via RentBill</span>
      </div>
    `;

    container.innerHTML = html;
  }
};
