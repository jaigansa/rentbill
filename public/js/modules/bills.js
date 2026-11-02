// Bills Controller: Bill Generation, Calculators, Invoices, Payments

export const Bills = {
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
      if (currElecMeter.value !== '' && cElec < pElec) {
        if (warnElec) warnElec.style.display = 'block';
        currElecMeter.classList.add('is-invalid');
        currElecMeter.classList.remove('is-valid');
      } else {
        if (warnElec) warnElec.style.display = 'none';
        currElecMeter.classList.remove('is-invalid');
        if (currElecMeter.value !== '' && cElec >= pElec) {
          currElecMeter.classList.add('is-valid');
        } else {
          currElecMeter.classList.remove('is-valid');
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
        if (currWaterMeter.value !== '' && cWater < pWater) {
          if (warnWater) warnWater.style.display = 'block';
          currWaterMeter.classList.add('is-invalid');
          currWaterMeter.classList.remove('is-valid');
        } else {
          if (warnWater) warnWater.style.display = 'none';
          currWaterMeter.classList.remove('is-invalid');
          if (currWaterMeter.value !== '' && cWater >= pWater) {
            currWaterMeter.classList.add('is-valid');
          } else {
            currWaterMeter.classList.remove('is-valid');
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

    const billMonthInput = document.getElementById('bill-month');
    if (billMonthInput) {
      const updateMonthText = () => {
        const monthText = document.getElementById('bill-month-text');
        if (monthText) monthText.textContent = this.formatMonth(billMonthInput.value);
      };
      billMonthInput.addEventListener('input', updateMonthText);
      billMonthInput.addEventListener('change', updateMonthText);
    }

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
          if (hintBalance) {
            hintBalance.textContent = lastBill.has_prior_bill
              ? `Carried forward from ${this.formatMonth(lastBill.billing_month) || 'previous bill'}: ${window.APP_CURRENCY || '₹'}${pendingArrear.toFixed(2)}`
              : `Carried forward from opening arrears: ${window.APP_CURRENCY || '₹'}${pendingArrear.toFixed(2)}`;
          }
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
          if (hintElec) hintElec.textContent = `From ${this.formatMonth(lastBill.billing_month) || 'last bill'}: ${pElecVal} units`;
          if (badgeWater) {
            badgeWater.style.display = 'inline-block';
            badgeWater.textContent = 'Carried Over';
          }
          if (hintWater) hintWater.textContent = `From ${this.formatMonth(lastBill.billing_month) || 'last bill'}: ${pWaterVal} units`;

          // If suggested next month is available and this is a new bill, auto populate month
          if (lastBill.suggested_next_month && !document.getElementById('bill-id').value) {
            const billMonth = document.getElementById('bill-month');
            if (billMonth) {
              billMonth.value = lastBill.suggested_next_month;
              const monthText = document.getElementById('bill-month-text');
              if (monthText) monthText.textContent = this.formatMonth(billMonth.value);
            }
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
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="receipt" style="width:36px; height:36px;"></i>
          <div>No ${filter === 'ALL' ? '' : filter.toLowerCase()} bills found.</div>
        </div>`;
      this.refreshIcons();
      return;
    }

    container.innerHTML = list.map(b => this.renderBillCardHtml(b)).join('');
    this.attachBillActionListeners(container);
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
            <div class="card-subtitle">Bill #${b.bill_number} • ${this.formatMonth(b.billing_month)} • Due ${b.due_date}</div>
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
    container.querySelectorAll('.app-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-dropdown') || e.target.closest('button') || e.target.closest('a')) {
          return;
        }
        const viewBtn = card.querySelector('.btn-action-view');
        if (viewBtn) {
          const billId = viewBtn.getAttribute('data-bill-id');
          if (billId) this.showInvoice(billId);
        }
      });
      card.style.cursor = 'pointer';
    });

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
        const month = bill && bill.billing_month ? this.formatMonth(bill.billing_month) : '';
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
              this.toast('Error: ' + err.message, 'error');
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
            <div class="inv-period">Billing Month: <strong>${this.formatMonth(b.billing_month)}</strong></div>
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
              <td>Rent for ${this.formatMonth(b.billing_month)}</td>
              <td class="num">${curr}${numFmt(b.base_rent)}</td>
            </tr>
            ${b.electricity_amount > 0 ? `
              <tr>
                <td><strong>Electricity Charges</strong></td>
                <td>
                  ${b.electricity_units} units @ ${curr}${b.electricity_rate}
                  <div class="inv-subtext">Meter: ${b.prev_electricity_meter} to ${b.curr_electricity_meter}</div>
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
                    <div class="inv-subtext">Meter: ${b.prev_water_meter} to ${b.curr_water_meter}</div>
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
          <div class="payment-details-box ${b.payment_upi ? 'has-upi-qr' : ''}">
            <div class="payment-details-info">
              <div class="payment-details-title">
                <i data-lucide="credit-card" style="width:14px; height:14px; vertical-align:-2px;"></i> Payment Details (Pay To):
              </div>
              <div class="payment-details-grid">
                ${b.payment_upi ? `
                  <div class="payment-upi-highlight">
                    <strong>UPI ID:</strong> <span class="mono-val">${b.payment_upi}</span>
                    <div class="payment-upi-apps">Accepted: GPay • PhonePe • Paytm • BHIM</div>
                  </div>
                ` : ''}
                ${b.payment_bank_name ? `<div><strong>Bank:</strong> ${b.payment_bank_name}</div>` : ''}
                ${b.payment_account_no ? `<div><strong>A/C No:</strong> <span class="mono-val">${b.payment_account_no}</span></div>` : ''}
                ${b.payment_ifsc ? `<div><strong>IFSC:</strong> <span class="mono-val">${b.payment_ifsc}</span></div>` : ''}
              </div>
              ${b.payment_upi ? `
                <div class="payment-upi-actions no-print" style="margin-top:8px;">
                  <a href="${typeof Share !== 'undefined' ? Share.buildUpiUri(b) : '#'}" class="btn btn-sm btn-primary" target="_blank" style="text-decoration:none; display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; padding:4px 10px;">
                    <i data-lucide="smartphone" style="width:13px; height:13px; vertical-align:-1px;"></i> Pay in UPI App
                  </a>
                </div>
              ` : ''}
            </div>
            ${b.payment_upi ? `
              <div class="invoice-qr-container">
                <div id="invoice-upi-qrcode" class="invoice-qr-code"></div>
                <span class="invoice-qr-label">SCAN & PAY</span>
              </div>
            ` : ''}
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
      if (b.payment_upi && typeof Share !== 'undefined' && typeof Share.renderUpiQrCode === 'function') {
        const upiUri = Share.buildUpiUri(b);
        Share.renderUpiQrCode('invoice-upi-qrcode', upiUri, 104);
      }
      this.openModal('modal-invoice');
      this.refreshIcons();
    } catch (e) {
      this.toast('Error: ' + e.message, 'error');
    }
  },

  async openPaymentForTenant(tenantId) {
    try {
      const allBills = await API.getBills();
      const unpaid = (allBills || []).filter(b => b.tenant_id == tenantId && (b.balance_amount > 0 || b.status !== 'PAID'));
      if (unpaid.length > 0) {
        this.openPaymentModal(unpaid[0].id);
      } else {
        this.openTenantLedger(tenantId);
      }
    } catch (e) {
      this.openTenantLedger(tenantId);
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

    // Reset carryover hints, warnings & validation classes
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
    document.getElementById('bill-curr-meter')?.classList.remove('is-invalid', 'is-valid');
    document.getElementById('bill-curr-water-meter')?.classList.remove('is-invalid', 'is-valid');

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

      // Reset carryover hints, warnings & validation classes for edit
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
      document.getElementById('bill-curr-meter')?.classList.remove('is-invalid', 'is-valid');
      document.getElementById('bill-curr-water-meter')?.classList.remove('is-invalid', 'is-valid');

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
      const monthText = document.getElementById('bill-month-text');
      if (monthText) monthText.textContent = this.formatMonth(b.billing_month);
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
      this.toast('Error: ' + err.message, 'error');
    }
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
      this.toast('Error: ' + e.message, 'error');
    }
  }
};
