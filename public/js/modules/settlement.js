// Settlement & Move-Out Calculator Module
// Handles vacant move-out calculations, rent proration, settlement statements, WhatsApp share & printable sheets

export const Settlement = {
  currentVacantTenant: null,
  currentVacantProp: null,
  currentVacantRentMode: 'none',
  currentVacantCalcData: null,

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
      let pendingArrears = tenantBills.reduce((sum, b) => {
        return sum + (Number(b.balance_amount) || (Number(b.total_amount) - Number(b.paid_amount)) || 0);
      }, 0);
      if (tenantBills.length === 0 && tenant.opening_arrear > 0) {
        pendingArrears = Number(tenant.opening_arrear) || 0;
      }

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
  }
};
