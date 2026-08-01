let currentBillingFilter = 'all';
let currentSearchTerm = '';
let pendingBillsCache = null;

async function loadTenants() {
    const listDiv = document.getElementById('tenantList');
    if (!listDiv) return;
    
    // Ensure cache exists
    if (!window.allTenants || window.allTenants.length === 0) {
        listDiv.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-weight: 800;">Syncing active units...</div>';
        await refreshGlobalTenantCache();
    }
    
    // Fetch pending bills in background once per session
    if (pendingBillsCache === null) {
        try {
            const data = await API.bills.getPendingBills();
            pendingBillsCache = new Set((data || []).map(b => b.renter_id));
        } catch (e) { 
            console.error("Pending fetch failed", e);
            pendingBillsCache = new Set();
        }
    }
    
    await renderBillingList();
}

async function filterBilling(mode) {
    currentBillingFilter = mode;
    const allBtn = document.getElementById('filterBillAll');
    const pendingBtn = document.getElementById('filterBillPending');
    if (allBtn) allBtn.classList.toggle('active', mode === 'all');
    if (pendingBtn) pendingBtn.classList.toggle('active', mode === 'pending');
    await renderBillingList();
}

function searchTenants() {
    currentSearchTerm = document.getElementById('searchBar')?.value.toLowerCase().trim() || '';
    renderBillingList(); // Re-render with new search term
}

async function renderBillingList() {
    const listDiv = document.getElementById('tenantList');
    if (!listDiv) return;

    populateBillingPropertyFilter();
    const filter = document.getElementById('billingPropertyFilter')?.value || '';

    // 1. Start with all tenants from global cache
    let data = window.allTenants || [];
    if (filter) {
        data = data.filter(t => t.assigned_upi === filter);
    }

    // 2. Apply "Dues" Filter
    if (currentBillingFilter === 'pending') {
        data = data.filter(t => (t.pending_arrears > 0) || (pendingBillsCache && pendingBillsCache.has(t.id)));
    }

    // 3. Apply Search Filter (Data-driven, not DOM-driven)
    if (currentSearchTerm) {
        data = data.filter(t => 
            t.name.toLowerCase().includes(currentSearchTerm) || 
            t.room_no.toLowerCase().includes(currentSearchTerm)
        );
    }

    // 4. Sort by Unit Number (Numeric)
    data.sort((a, b) => a.room_no.localeCompare(b.room_no, undefined, {numeric: true}));

    if (data.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state" style="padding: 3rem 1rem;">
                <i data-lucide="${currentSearchTerm ? 'search-x' : 'check-circle'}"></i>
                <p>${currentSearchTerm ? `No units matching "${currentSearchTerm}"` : (currentBillingFilter === 'all' ? 'No active units found' : 'All unit bills are up-to-date')}</p>
                ${currentBillingFilter === 'pending' && !currentSearchTerm ? '<button onclick="filterBilling(\'all\')" class="btn btn-secondary btn-sm" style="margin-top:1rem;">View All Units</button>' : ''}
            </div>`;
        lucide.createIcons();
        return;
    }

    // 5. Render
    listDiv.innerHTML = '';
    const fragment = document.createDocumentFragment();
    data.forEach(t => fragment.appendChild(createTenantCard(t)));
    listDiv.appendChild(fragment);
    
    lucide.createIcons();
}

function populateBillingPropertyFilter() {
    const select = document.getElementById('billingPropertyFilter');
    if (!select || !appSettings.receiving_accounts) return;
    if (select.children.length > 1) return; // Already populated
    
    const currentVal = select.value;
    select.innerHTML = '<option value="">All Buildings</option>';
    appSettings.receiving_accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.owner_name;
        opt.innerText = `${acc.owner_name.toUpperCase()} • ${acc.label.toUpperCase()}`;
        select.appendChild(opt);
    });
    select.value = currentVal;
}

function createTenantCard(t) {
    const card = document.createElement('div');
    card.className = 'tenant-row';
    card.style.marginBottom = '0.75rem';
    
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const defaultMonthStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const todayStr = now.toISOString().split('T')[0];
    const isWaterMeter = (t.water_calc_mode === 'METER');
    
    card.innerHTML = `
        <div class="tenant-header" onclick="toggleBilling(${t.id})" style="padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                <div class="room-badge" style="min-width: 50px; height: 36px; font-size: 0.9rem; border-radius: 10px; font-weight: 900;">${t.room_no}</div>
                <div>
                    <div style="font-weight: 900; font-size: 1rem; color: var(--text-main);">${t.name}</div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px;">
                        <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Rent: ${currencyFormatter.format(t.base_rent)}</span>
                        ${isWaterMeter ? `<span style="font-size: 0.55rem; padding: 2px 6px; border-radius: 4px; font-weight: 900; background: var(--primary-light); color: var(--primary);">💧 METER</span>` : ''}
                        ${t.pending_arrears > 0 ? `<span class="badge badge-danger" style="font-size: 0.55rem; padding: 2px 6px; border-radius: 4px; font-weight: 900;">Arrears: ${currencyFormatter.format(t.pending_arrears)}</span>` : ''}
                    </div>
                </div>
            </div>
            <div id="icon-${t.id}" style="color: var(--secondary); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
                <i data-lucide="chevron-down" width="20"></i>
            </div>
        </div>
        
        <div id="billing-${t.id}" class="billing-controls hidden" style="padding: 1.5rem; border-top: 1.5px dashed var(--border); background: var(--bg-main); border-bottom-left-radius: 12px; border-bottom-right-radius: 12px;">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="input-group"><label style="font-size: 0.6rem;">Bill Generation Date</label><input type="date" id="bill-date-${t.id}" value="${todayStr}" style="font-weight: 800;"></div>
                <div class="input-group"><label style="font-size: 0.6rem;">Billing Month</label><input type="month" id="month-${t.id}" value="${defaultMonthStr}" style="font-weight: 800;"></div>
                <div class="input-group"><label style="font-size: 0.6rem;">EB Prev Reading</label><input type="number" id="prev-eb-${t.id}" step="0.01" oninput="updateLiveTotal(${t.id})" style="font-weight: 700;"></div>
                <div class="input-group"><label style="font-size: 0.6rem;">EB Current Reading</label><input type="number" id="eb-${t.id}" placeholder="Reading" step="0.01" oninput="updateLiveTotal(${t.id})" style="font-weight: 900; border-color: var(--primary);"></div>
                ${isWaterMeter ? `
                <div class="input-group"><label style="font-size: 0.6rem; color: var(--primary);">💧 Water Prev Reading</label><input type="number" id="prev-water-${t.id}" step="0.01" oninput="updateLiveTotal(${t.id})" style="font-weight: 700; border-color: var(--primary);"></div>
                <div class="input-group"><label style="font-size: 0.6rem; color: var(--primary);">💧 Water Current Reading</label><input type="number" id="curr-water-${t.id}" placeholder="Reading" step="0.01" oninput="updateLiveTotal(${t.id})" style="font-weight: 900; border-color: var(--primary);"></div>` : ''}
                <div class="input-group"><label style="font-size: 0.6rem;">Arrears</label><input type="number" id="arrears-${t.id}" value="${t.pending_arrears || 0}" oninput="updateLiveTotal(${t.id})" style="color: var(--danger); font-weight: 800;"></div>
                <div class="input-group"><label style="font-size: 0.6rem;">Extra Charges</label><input type="number" id="others-${t.id}" value="0" oninput="updateLiveTotal(${t.id})" style="font-weight: 700;"></div>
                <div class="input-group" style="grid-column: span 2;"><label style="font-size: 0.6rem;">Waiver / Discount (-)</label><input type="number" id="discount-${t.id}" value="0" oninput="updateLiveTotal(${t.id})" style="color: var(--success); font-weight: 800;"></div>
            </div>

            <div style="background: var(--bg-card); border: 2px solid var(--primary); border-radius: 16px; padding: 1.5rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="margin-bottom: 1.25rem;">
                    <div style="font-size: 0.7rem; font-weight: 900; color: var(--primary); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px;">Total Amount Due</div>
                    <div id="total-val-${t.id}" style="font-size: 2.2rem; font-weight: 950; color: var(--text-main); line-height: 1;">${currencyFormatter.format(t.base_rent + t.water_maint + t.pending_arrears)}</div>
                    <div id="breakdown-${t.id}" style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700; margin-top: 10px; text-transform: uppercase; line-height: 1.5; background: var(--bg-main); padding: 8px; border-radius: 8px; border: 1px solid var(--border);">
                        Rent: ${currencyFormatter.format(t.base_rent)} + Maint: ${currencyFormatter.format(t.water_maint)} + Arrears: ${currencyFormatter.format(t.pending_arrears)}
                    </div>
                </div>
                <button class="btn btn-primary" onclick="generateBill(${t.id})" style="width: 100%; height: 56px; font-weight: 900; letter-spacing: 1px; font-size: 1rem; border-radius: 12px; box-shadow: 0 4px 0 var(--primary-dark);">
                    GENERATE & SHARE <i data-lucide="send" style="margin-left: 10px; width: 20px; height: 20px;"></i>
                </button>
            </div>
        </div>`;
    
    card._tenantData = t;
    return card;
}

function updateLiveTotal(id) {
    const card = document.querySelector(`.tenant-row:has(#billing-${id})`);
    if (!card || !card._tenantData) return;
    const t = card._tenantData;

    const currEB = parseFloat(document.getElementById(`eb-${id}`).value) || 0;
    const prevEB = parseFloat(document.getElementById(`prev-eb-${id}`).value) || 0;
    const arrears = parseFloat(document.getElementById(`arrears-${id}`).value) || 0;
    const others = parseFloat(document.getElementById(`others-${id}`).value) || 0;
    const discount = parseFloat(document.getElementById(`discount-${id}`).value) || 0;

    const ebUnits = Math.max(0, currEB - prevEB);
    const ebCost = ebUnits * t.eb_unit_price;

    // Water & Maintenance cost: combine base maintenance with metered reading if METER mode, else fixed maintenance
    let waterCost = t.water_maint || 0;
    let waterUnits = 0;
    let meteredCost = 0;
    if (t.water_calc_mode === 'METER') {
        const currWater = parseFloat(document.getElementById(`curr-water-${id}`)?.value) || 0;
        const prevWater = parseFloat(document.getElementById(`prev-water-${id}`)?.value) || 0;
        waterUnits = Math.max(0, currWater - prevWater);
        meteredCost = waterUnits * (t.water_unit_price || 0);
        waterCost += meteredCost;
    }

    const total = t.base_rent + waterCost + ebCost + others + arrears - discount;

    document.getElementById(`total-val-${id}`).innerText = currencyFormatter.format(total);
    
    // Update Breakdown Details
    const breakdownEl = document.getElementById(`breakdown-${id}`);
    if (breakdownEl) {
        let text = `Rent: ${currencyFormatter.format(t.base_rent)}`;
        if (t.water_calc_mode === 'METER') {
            if (t.water_maint > 0) text += ` + Maint: ${currencyFormatter.format(t.water_maint)}`;
            text += ` + Water: ${currencyFormatter.format(meteredCost)} (${waterUnits.toFixed(1)}u × ₹${t.water_unit_price || 0})`;
        } else {
            text += ` + Maint: ${currencyFormatter.format(t.water_maint)}`;
        }
        if (ebCost > 0) text += ` + EB: ${currencyFormatter.format(ebCost)} (${ebUnits.toFixed(1)}u)`;
        if (others > 0) text += ` + Fee: ${currencyFormatter.format(others)}`;
        if (arrears > 0) text += ` + Arrears: ${currencyFormatter.format(arrears)}`;
        if (discount > 0) text += ` - Waiver: ${currencyFormatter.format(discount)}`;
        breakdownEl.innerText = text;
    }
}


function toggleBilling(id) {
    const el = document.getElementById(`billing-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    if (!el) return;
    const isHidden = el.classList.toggle('hidden');
    if (icon) icon.style.transform = isHidden ? '' : 'rotate(180deg)';
    if (!isHidden) fetchLastReadings(id);
}

async function fetchLastEB(id) {
    // Kept for backward compatibility (called from loadSpecificBilling)
    await fetchLastReadings(id);
}

async function fetchLastReadings(id) {
    try {
        // Fetch last EB reading
        const ebData = await API.bills.getLastEB(id);
        const prevEbInput = document.getElementById(`prev-eb-${id}`);
        if (prevEbInput) {
            prevEbInput.value = ebData.last_eb;
            prevEbInput.placeholder = `Last: ${ebData.last_eb}`;
        }

        // Fetch last water reading if this tenant uses METER mode
        const prevWaterInput = document.getElementById(`prev-water-${id}`);
        if (prevWaterInput) {
            try {
                const waterData = await API.bills.getLastWater(id);
                prevWaterInput.value = waterData.last_water;
                prevWaterInput.placeholder = `Last: ${waterData.last_water}`;
            } catch (e) { console.error('Water reading fetch error:', e); }
        }

        updateLiveTotal(id);
    } catch (e) { console.error('Reading fetch error:', e); }
}

async function generateBill(id) {
    const card = document.querySelector(`.tenant-row:has(#billing-${id})`);
    const t = card?._tenantData;
    const isWaterMeter = t && t.water_calc_mode === 'METER';

    const btn = document.querySelector(`.tenant-row:has(#billing-${id}) .btn-primary`);
    const currEB = parseFloat(document.getElementById(`eb-${id}`).value);
    const prevEB = parseFloat(document.getElementById(`prev-eb-${id}`).value);
    const arrears = parseFloat(document.getElementById(`arrears-${id}`).value) || 0;
    const others = parseFloat(document.getElementById('others-'+id).value) || 0;
    const discount = parseFloat(document.getElementById('discount-'+id).value) || 0;
    const monthInput = document.getElementById('month-'+id).value;
    const billDateInput = document.getElementById('bill-date-'+id).value;

    if (isNaN(currEB)) return showNotification("Fill required current EB reading", "error");
    if (isNaN(prevEB)) return showNotification("Fill required previous EB reading", "error");
    if (!monthInput) return showNotification("Please select a period", "error");
    if (!billDateInput) return showNotification("Please select a bill date", "error");

    // Validate water meter readings if in METER mode
    let currWater = 0, prevWater = 0;
    if (isWaterMeter) {
        currWater = parseFloat(document.getElementById(`curr-water-${id}`)?.value);
        prevWater = parseFloat(document.getElementById(`prev-water-${id}`)?.value);
        if (isNaN(currWater)) return showNotification("Fill required current Water reading", "error");
        if (isNaN(prevWater)) return showNotification("Fill required previous Water reading", "error");
        if (currWater < prevWater) {
            if (!confirm("Current water reading is lower than previous. Proceed anyway?")) return;
        }
    }

    if (currEB < prevEB) {
        if (!confirm("Current EB reading is lower than previous. Proceed anyway?")) return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Generating... <i data-lucide="loader-2" class="loading-spin" style="margin-left: 8px; width: 16px;"></i>';
        lucide.createIcons();
    }

    const date = new Date(monthInput + '-01');
    const formattedMonth = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    try {
        const payload = { 
            renter_id: id, 
            curr_eb_reading: currEB, 
            prev_eb_reading: prevEB, 
            others: others, 
            discount_amount: discount,
            arrears_included: arrears,
            billing_month: formattedMonth,
            date_generated: billDateInput
        };
        // Include water meter data when in METER mode
        if (isWaterMeter) {
            payload.prev_water_reading = prevWater;
            payload.curr_water_reading = currWater;
            payload.water_calc_mode = 'METER';
            payload.water_unit_price = t.water_unit_price || 0;
        }
        const result = await API.bills.create(payload);
        showNotification("Bill generated", "success");
        if (typeof prepareAndShare === 'function') {
            await prepareAndShare('bill', result.id);
        }
        toggleBilling(id);
        loadTenants(); 
    } catch (e) {
        showNotification(e.message || "Failed to generate bill", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Generate & Share <i data-lucide="send" style="margin-left: 8px; width: 16px;"></i>';
            lucide.createIcons();
        }
    }
}

async function loadSpecificBilling(renterId, monthName) {
    await loadTenants();
    
    const monthInput = document.getElementById(`month-${renterId}`);
    if (monthInput) {
        // Convert "Month Year" (e.g., "May 2026") to "YYYY-MM"
        const date = new Date(monthName + ' 1');
        if (!isNaN(date.getTime())) {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            monthInput.value = `${yyyy}-${mm}`;
        }
        
        // Always fetch last EB when loading specific billing
        await fetchLastEB(renterId);
        
        const billingControls = document.getElementById(`billing-${renterId}`);
        if (billingControls && billingControls.classList.contains('hidden')) {
            toggleBilling(renterId);
        }
        
        monthInput.closest('.tenant-row').scrollIntoView({ behavior: 'smooth', block: 'center' });
        const card = monthInput.closest('.tenant-row');
        card.style.transition = 'background-color 0.5s';
        card.style.backgroundColor = 'var(--primary-light)';
        setTimeout(() => card.style.backgroundColor = '', 1500);
    }
}

/* --- BATCH BILLING SYSTEM --- */
let batchBillingData = [];

async function openBatchBillingModal() {
    const overlay = document.getElementById('batchBillingOverlay');
    if (!overlay) return;

    overlay.classList.remove('hidden');
    const tbody = document.getElementById('batchBillingTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted); font-weight: 800;">Loading active units & readings...</td></tr>`;
    }

    const now = new Date();
    const formattedMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const formattedDate = now.toISOString().split('T')[0];

    const monthInput = document.getElementById('batchBillingMonth');
    const dateInput = document.getElementById('batchDateGenerated');
    if (monthInput) monthInput.value = formattedMonth;
    if (dateInput) dateInput.value = formattedDate;

    try {
        if (!window.allTenants || window.allTenants.length === 0) {
            await refreshGlobalTenantCache();
        }
        let tenants = [...(window.allTenants || [])];
        tenants.sort((a, b) => a.room_no.localeCompare(b.room_no, undefined, { numeric: true }));

        if (tenants.length === 0) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">No active units available.</td></tr>`;
            return;
        }

        const ebPromises = tenants.map(t => API.request(`/last-eb/${t.id}`).catch(() => ({ last_eb: t.initial_eb || 0 })));
        const ebResults = await Promise.all(ebPromises);

        batchBillingData = tenants.map((t, idx) => {
            const prevEB = ebResults[idx] && ebResults[idx].last_eb !== undefined ? ebResults[idx].last_eb : (t.initial_eb || 0);
            return {
                renter_id: t.id,
                room_no: t.room_no,
                name: t.name,
                base_rent: t.base_rent || 0,
                water_maint: t.water_maint || 0,
                eb_unit_price: t.eb_unit_price || 0,
                pending_arrears: t.pending_arrears || 0,
                prev_eb_reading: prevEB,
                curr_eb_reading: prevEB,
                others: 0,
                discount_amount: 0,
                arrears_included: t.pending_arrears || 0,
                notes: ''
            };
        });

        renderBatchBillingRows();
    } catch (e) {
        console.error("Batch Billing Init Failed:", e);
        showNotification("Failed to load tenant readings", "error");
        closeBatchBillingModal();
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeBatchBillingModal() {
    const overlay = document.getElementById('batchBillingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

function renderBatchBillingRows() {
    const tbody = document.getElementById('batchBillingTableBody');
    if (!tbody) return;

    tbody.innerHTML = batchBillingData.map((d, index) => {
        const ebUnits = Math.max(0, d.curr_eb_reading - d.prev_eb_reading);
        const ebCost = ebUnits * d.eb_unit_price;
        const total = d.base_rent + d.water_maint + ebCost + d.others + d.arrears_included - d.discount_amount;

        return `
            <tr style="border-bottom: 1px solid var(--border);">
                <td style="padding: 10px; font-weight: 800; color: var(--primary);">Unit ${d.room_no}</td>
                <td style="padding: 10px; font-weight: 700;">${d.name}</td>
                <td style="padding: 10px;">₹${d.base_rent}</td>
                <td style="padding: 10px;">₹${d.water_maint}</td>
                <td style="padding: 10px; color: ${d.pending_arrears > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 700;">
                    ₹${d.pending_arrears}
                </td>
                <td style="padding: 10px; font-weight: 600;">${d.prev_eb_reading}</td>
                <td style="padding: 8px;">
                    <input type="number" 
                           id="batchCurrEB_${index}" 
                           class="form-input" 
                           style="width: 100px; padding: 4px 8px; font-weight: 800; font-size: 0.85rem;" 
                           value="${d.curr_eb_reading > d.prev_eb_reading ? d.curr_eb_reading : ''}" 
                           placeholder="${d.prev_eb_reading}"
                           oninput="updateBatchRowMath(${index})">
                </td>
                <td style="padding: 10px; font-size: 0.78rem;" id="batchUnitsCell_${index}">
                    ${ebUnits} u (₹${ebCost.toFixed(2)})
                </td>
                <td style="padding: 10px; text-align: right; font-weight: 900; font-size: 0.9rem; color: var(--success);" id="batchTotalCell_${index}">
                    ₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </td>
            </tr>
        `;
    }).join('');

    updateBatchGrandTotal();
}

function updateBatchRowMath(index) {
    const d = batchBillingData[index];
    if (!d) return;

    const currInput = document.getElementById(`batchCurrEB_${index}`);
    const currVal = currInput ? parseFloat(currInput.value) : d.prev_eb_reading;
    d.curr_eb_reading = isNaN(currVal) ? d.prev_eb_reading : currVal;

    const ebUnits = Math.max(0, d.curr_eb_reading - d.prev_eb_reading);
    const ebCost = ebUnits * d.eb_unit_price;
    const total = d.base_rent + d.water_maint + ebCost + d.others + d.arrears_included - d.discount_amount;

    const unitsCell = document.getElementById(`batchUnitsCell_${index}`);
    const totalCell = document.getElementById(`batchTotalCell_${index}`);
    if (unitsCell) unitsCell.innerHTML = `${ebUnits} u (₹${ebCost.toFixed(2)})`;
    if (totalCell) totalCell.innerHTML = `₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

    updateBatchGrandTotal();
}

function updateBatchGrandTotal() {
    let grandTotal = 0;
    batchBillingData.forEach(d => {
        const ebUnits = Math.max(0, d.curr_eb_reading - d.prev_eb_reading);
        const ebCost = ebUnits * d.eb_unit_price;
        const total = d.base_rent + d.water_maint + ebCost + d.others + d.arrears_included - d.discount_amount;
        grandTotal += total;
    });

    const grandEl = document.getElementById('batchGrandTotal');
    if (grandEl) grandEl.innerText = `₹${grandTotal.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

async function submitBatchBilling() {
    const monthVal = document.getElementById('batchBillingMonth')?.value.trim();
    const dateVal = document.getElementById('batchDateGenerated')?.value;

    if (!monthVal) return showNotification("Please specify Billing Month", "error");
    if (!batchBillingData || batchBillingData.length === 0) return showNotification("No units to bill", "error");

    const payload = {
        billing_month: monthVal,
        date_generated: dateVal,
        bills: batchBillingData.map(d => ({
            renter_id: d.renter_id,
            prev_eb_reading: d.prev_eb_reading,
            curr_eb_reading: d.curr_eb_reading,
            others: d.others || 0,
            discount_amount: d.discount_amount || 0,
            arrears_included: d.arrears_included || 0,
            notes: d.notes || ''
        }))
    };

    try {
        const res = await API.bills.createBatch(payload);
        showNotification(`Batch generated ${res.count || payload.bills.length} bills successfully!`, "success");
        closeBatchBillingModal();
        if (typeof loadTenants === 'function') loadTenants();
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } catch (e) {
        showNotification(e.message || "Failed to process batch billing", "error");
    }
}
