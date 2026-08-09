/* ===== SECTION: billing.js ===== */
let currentSearchTerm = '';
let billedRenterSet = new Set();
let billingStatusMonth = '';

function getCurrentBillingMonth() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
}

function getNextDueLabel() {
    const now = new Date();
    const due = new Date(now.getFullYear(), now.getMonth(), 5, 23, 59, 59);
    if (now.getDate() > 5) due.setMonth(due.getMonth() + 1);
    const days = Math.max(0, Math.ceil((due - now) / 86400000));
    const dateLabel = due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    if (days === 0) return `${dateLabel} · DUE TODAY`;
    if (days === 1) return `${dateLabel} · TOMORROW`;
    return `${dateLabel} · IN ${days} DAYS`;
}

async function refreshBillingStatus() {
    try {
        const data = await API.bills.getBillingStatus(getCurrentBillingMonth());
        billedRenterSet = new Set((data && data.renter_ids) || []);
        billingStatusMonth = (data && data.month) || getCurrentBillingMonth();
    } catch (e) {
        console.error("Billing status fetch failed", e);
        billedRenterSet = new Set();
    }
}

async function loadTenants() {
    const listDiv = document.getElementById('tenantList');
    if (!listDiv) return;

    if (!window.allTenants || window.allTenants.length === 0) {
        listDiv.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-weight: 800;">Syncing active units...</div>';
        await refreshGlobalTenantCache();
    }

    await refreshBillingStatus();

    await renderBillingList();
}

function searchTenants() {
    currentSearchTerm = document.getElementById('searchBar')?.value.toLowerCase().trim() || '';
    renderBillingList();
}

async function renderBillingList() {
    const listDiv = document.getElementById('tenantList');
    if (!listDiv) return;

    populateBillingPropertyFilter();
    const filter = document.getElementById('billingPropertyFilter')?.value || '';

    let data = window.allTenants || [];
    if (filter) {
        data = data.filter(t => t.assigned_upi === filter);
    }

    if (currentSearchTerm) {
        data = data.filter(t =>
            t.name.toLowerCase().includes(currentSearchTerm) ||
            t.room_no.toLowerCase().includes(currentSearchTerm)
        );
    }

    data.sort((a, b) => a.room_no.localeCompare(b.room_no, undefined, { numeric: true }));

    if (data.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state" style="padding: 3rem 1rem;">
                <i data-lucide="${currentSearchTerm ? 'search-x' : 'check-circle'}"></i>
                <p>${currentSearchTerm ? `No units matching "${currentSearchTerm}"` : 'No active units found'}</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    listDiv.innerHTML = '';
    const fragment = document.createDocumentFragment();
    data.forEach(t => fragment.appendChild(createTenantCard(t)));
    listDiv.appendChild(fragment);

    lucide.createIcons();
}

function populateBillingPropertyFilter() {
    const select = document.getElementById('billingPropertyFilter');
    if (!select || !appSettings.receiving_accounts) return;
    if (select.children.length > 1) return;

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

function toggleBilling(id) {
    const el = document.getElementById(`billing-${id}`);
    if (el) {
        el.classList.toggle('hidden');
    }
}

function shareBillToWhatsApp(mobile, name, roomNo, month, amount) {
    if (!mobile || mobile === 'N/A' || mobile === 'No Mobile') {
        showNotification("No mobile number recorded for this tenant", "warning");
        return;
    }
    const cleanMobile = mobile.replace(/[^0-9]/g, '');
    const phone = cleanMobile.length === 10 ? '91' + cleanMobile : cleanMobile;
    const message = `Hello ${name} (Unit ${roomNo}),\nYour Rent & Utility Bill for ${month} is ₹${amount}.\nPlease make your payment at your earliest convenience.\nThank you!`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
}

function createTenantCard(t) {
    const card = document.createElement('div');
    card.className = 'tenant-row-redesign';
    card.style.cssText = 'background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.7rem 0.85rem; margin-bottom: 0.6rem; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 0.6rem; transition: border-color 0.2s ease;';

    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const defaultMonthStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const todayStr = now.toISOString().split('T')[0];
    const isWaterMeter = (t.water_calc_mode === 'METER');

    const statusBadge = t.pending_arrears > 0
        ? `<span class="badge badge-danger" style="font-size: 0.6rem; font-weight: 800;">OVERDUE ₹${t.pending_arrears}</span>`
        : `<span class="badge badge-success" style="font-size: 0.6rem; font-weight: 800;">ACTIVE</span>`;

    const moveIn = new Date(t.move_in_date);
    const billingMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const shouldHaveBill = !isNaN(moveIn.getTime()) && moveIn <= billingMonthEnd;
    const needsBill = shouldHaveBill && !billedRenterSet.has(t.id);

    const billAlertTag = needsBill
        ? `<span class="badge badge-warning" style="font-size: 0.55rem; font-weight: 900; animation: pulse 1.8s ease-in-out infinite;">⚡ BILL NOW · ${(billingStatusMonth || getCurrentBillingMonth()).toUpperCase()}</span>`
        : '';

    const countdownTag = `<span class="badge badge-info" style="font-size: 0.55rem; font-weight: 900;">📅 Next Due ${getNextDueLabel()}</span>`;

    card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 0.6rem; flex: 1; min-width: 0;">
                <div class="room-badge" style="min-width: 40px; height: 32px; padding: 0 0.55rem; font-size: 0.82rem;">${t.room_no}</div>
                <div style="min-width: 0; flex: 1;">
                    <div style="font-weight: 900; font-size: 0.92rem; color: var(--text-main); line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${t.name}
                        ${t.co_tenant_names ? `<span style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted); margin-left: 5px;">(Co: ${t.co_tenant_names})</span>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 0.68rem; color: var(--text-muted); font-weight: 700; flex-wrap: wrap;">
                        <span>📱 ${t.mobile_number || 'No Mobile'}</span>
                        <span>•</span>
                        <span>Rent <strong style="color: var(--text-main);">₹${t.base_rent}</strong></span>
                        ${isWaterMeter ? `<span style="font-size: 0.55rem; padding: 1px 5px; border-radius: 4px; font-weight: 900; background: var(--primary-light); color: var(--primary);">💧 METER</span>` : ''}
                        ${billAlertTag}
                        ${countdownTag}
                    </div>
                </div>
            </div>

            <div style="display: flex; align-items: center; gap: 0.35rem;">
                ${statusBadge}
                <div style="display: flex; gap: 0.25rem; margin-left: 0.4rem; padding-left: 0.5rem; border-left: 1px solid var(--border);">
                    <button type="button" class="btn btn-primary btn-icon-sm" onclick="toggleBilling(${t.id})" style="border-radius: 8px;" title="Bill / Generate">
                        <i data-lucide="zap" style="width: 15px; height: 15px;"></i>
                    </button>
                    <button type="button" class="btn btn-secondary btn-icon-sm" onclick="openTenantDetailModal(${t.id}, 'contract')" style="border-radius: 8px; color: var(--primary);" title="Profile & Agreement">
                        <i data-lucide="user-check" style="width: 15px; height: 15px;"></i>
                    </button>
                    <button type="button" class="btn btn-secondary btn-icon-sm" onclick="openTenantLedgerModal(${t.id})" style="border-radius: 8px; color: var(--info);" title="Payment Ledger">
                        <i data-lucide="receipt" style="width: 15px; height: 15px;"></i>
                    </button>
                    <button type="button" class="btn btn-secondary btn-icon-sm" onclick="editTenant(${t.id});" style="border-radius: 8px; color: var(--warning);" title="Edit Registration">
                        <i data-lucide="edit-3" style="width: 15px; height: 15px;"></i>
                    </button>
                </div>
            </div>
        </div>

        <!-- Inline Bill Generation Panel (Hidden by default) -->
        <div id="billing-${t.id}" class="billing-controls hidden" style="padding: 1.25rem; border-top: 1.5px dashed var(--border); background: var(--bg-main); border-radius: var(--radius-md);">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
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

            <div style="background: var(--bg-card); border: 2px solid var(--primary); border-radius: 14px; padding: 1.25rem; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
                <div style="margin-bottom: 1rem;">
                    <div style="font-size: 0.7rem; font-weight: 900; color: var(--primary); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 4px;">Total Amount Due</div>
                    <div id="total-val-${t.id}" style="font-size: 2rem; font-weight: 950; color: var(--text-main); line-height: 1;">${currencyFormatter.format(t.base_rent + t.water_maint + t.pending_arrears)}</div>
                    <div id="breakdown-${t.id}" style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700; margin-top: 8px; text-transform: uppercase; line-height: 1.4; background: var(--bg-main); padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border);">
                        Rent: ${currencyFormatter.format(t.base_rent)} + Maint: ${currencyFormatter.format(t.water_maint)} + Arrears: ${currencyFormatter.format(t.pending_arrears)}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary" onclick="generateBill(${t.id}, false)" style="flex: 1; height: 48px; font-weight: 900; letter-spacing: 0.5px; font-size: 0.85rem; border-radius: 10px;">
                        GENERATE & SHARE <i data-lucide="send" style="margin-left: 6px; width: 16px; height: 16px;"></i>
                    </button>
                    <button class="btn" onclick="generateBill(${t.id}, true)" style="flex: 1; height: 48px; font-weight: 900; letter-spacing: 0.5px; font-size: 0.85rem; border-radius: 10px; background: var(--success); color: white; border: none;">
                        GENERATE & MARK PAID <i data-lucide="check-circle" style="margin-left: 6px; width: 16px; height: 16px;"></i>
                    </button>
                </div>
            </div>
        </div>`;

    card._tenantData = t;
    return card;
}

function updateLiveTotal(id) {
    const card = document.querySelector(`.tenant-row-redesign:has(#billing-${id})`);
    if (!card || !card._tenantData) return;
    const t = card._tenantData;

    const currEB = parseFloat(document.getElementById(`eb-${id}`).value) || 0;
    const prevEB = parseFloat(document.getElementById(`prev-eb-${id}`).value) || 0;
    const arrears = parseFloat(document.getElementById(`arrears-${id}`).value) || 0;
    const others = parseFloat(document.getElementById(`others-${id}`).value) || 0;
    const discount = parseFloat(document.getElementById(`discount-${id}`).value) || 0;

    const ebUnits = Math.max(0, currEB - prevEB);
    const ebCost = ebUnits * t.eb_unit_price;

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

    const total = t.base_rent + (t.maint_charge || 0) + waterCost + ebCost + others + arrears - discount;

    document.getElementById(`total-val-${id}`).innerText = currencyFormatter.format(total);

    const breakdownEl = document.getElementById(`breakdown-${id}`);
    if (breakdownEl) {
        let text = `Rent: ${currencyFormatter.format(t.base_rent)}`;
        if (t.maint_charge > 0) text += ` + Maint: ${currencyFormatter.format(t.maint_charge)}`;
        if (t.water_calc_mode === 'METER') {
            text += ` + Water: ${currencyFormatter.format(meteredCost)} (${waterUnits.toFixed(1)}u × ₹${t.water_unit_price || 0})`;
        } else if (t.water_maint > 0) {
            text += ` + Water: ${currencyFormatter.format(t.water_maint)}`;
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
    await fetchLastReadings(id);
}

async function fetchLastReadings(id) {
    try {
        const ebData = await API.bills.getLastEB(id);
        const prevEbInput = document.getElementById(`prev-eb-${id}`);
        if (prevEbInput) {
            prevEbInput.value = ebData.last_eb;
            prevEbInput.placeholder = `Last: ${ebData.last_eb}`;
        }

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

async function generateBill(id, autoMarkPaid = false) {
    const card = document.querySelector(`.tenant-row-redesign:has(#billing-${id})`);
    const t = card?._tenantData;
    const isWaterMeter = t && t.water_calc_mode === 'METER';

    const btn = document.querySelector(`.tenant-row-redesign:has(#billing-${id}) .btn-primary`);
    const currEB = parseFloat(document.getElementById(`eb-${id}`).value);
    const prevEB = parseFloat(document.getElementById(`prev-eb-${id}`).value);
    const arrears = parseFloat(document.getElementById(`arrears-${id}`).value) || 0;
    const others = parseFloat(document.getElementById('others-' + id).value) || 0;
    const discount = parseFloat(document.getElementById('discount-' + id).value) || 0;
    const monthInput = document.getElementById('month-' + id).value;
    const billDateInput = document.getElementById('bill-date-' + id).value;

    if (isNaN(currEB)) return showNotification("Fill required current EB reading", "error");
    if (isNaN(prevEB)) return showNotification("Fill required previous EB reading", "error");
    if (!monthInput) return showNotification("Please select a period", "error");
    if (!billDateInput) return showNotification("Please select a bill date", "error");

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
        if (isWaterMeter) {
            payload.prev_water_reading = prevWater;
            payload.curr_water_reading = currWater;
            payload.water_calc_mode = 'METER';
            payload.water_unit_price = t.water_unit_price || 0;
        }
        const result = await API.bills.create(payload);

        if (autoMarkPaid && result && result.id) {
            await API.bills.pay(result.id, {
                payment_method: 'Cash',
                payment_details: 'Admin Direct Payment',
                payment_date: billDateInput,
                paid_amount: result.total_amount,
                discount_amount: 0,
                write_off_amount: 0,
                arrears_amount: 0
            });
            showNotification("Bill generated and marked as PAID!", "success");
        } else {
            showNotification("Bill generated successfully", "success");
            if (typeof prepareAndShare === 'function') {
                await prepareAndShare('bill', result.id);
            }
        }
        toggleBilling(id);
        loadTenants();
    } catch (e) {
        showNotification(e.message || "Failed to generate bill", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'GENERATE & SHARE <i data-lucide="send" style="margin-left: 6px; width: 16px;"></i>';
            lucide.createIcons();
        }
    }
}

async function loadSpecificBilling(renterId, monthName) {
    await loadTenants();

    const monthInput = document.getElementById(`month-${renterId}`);
    if (monthInput) {
        const date = new Date(monthName + ' 1');
        if (!isNaN(date.getTime())) {
            const yyyy = date.getFullYear();
            const mm = String(date.getMonth() + 1).padStart(2, '0');
            monthInput.value = `${yyyy}-${mm}`;
        }

        await fetchLastEB(renterId);

        const billingControls = document.getElementById(`billing-${renterId}`);
        if (billingControls && billingControls.classList.contains('hidden')) {
            toggleBilling(renterId);
        }

        monthInput.closest('.tenant-row-redesign').scrollIntoView({ behavior: 'smooth', block: 'center' });
        const card = monthInput.closest('.tenant-row-redesign');
        card.style.transition = 'background-color 0.5s';
        card.style.backgroundColor = 'var(--primary-light)';
        setTimeout(() => card.style.backgroundColor = '', 1500);
    }
}

let batchBillingData = [];
let batchBillingFiltered = [];

async function openBatchBillingModal() {
    const overlay = document.getElementById('batchBillingOverlay');
    if (!overlay) return;

    overlay.classList.remove('hidden');
    const tbody = document.getElementById('batchBillingTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 3rem; color: var(--text-muted); font-weight: 800;">
            <i data-lucide="loader-2" class="loading-spin" style="width: 28px; height: 28px; margin-bottom: 8px;"></i>
            <div>Fetching active property units & last readings...</div>
        </td></tr>`;
    }

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const pickerVal = `${yyyy}-${mm}`;
    const formattedMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const formattedDate = now.toISOString().split('T')[0];

    const monthPicker = document.getElementById('batchBillingMonthPicker');
    const monthInput = document.getElementById('batchBillingMonth');
    const dateInput = document.getElementById('batchDateGenerated');
    const searchInput = document.getElementById('batchSearchInput');

    if (monthPicker) monthPicker.value = pickerVal;
    if (monthInput) monthInput.value = formattedMonth;
    if (dateInput) dateInput.value = formattedDate;
    if (searchInput) searchInput.value = '';

    try {
        if (!window.allTenants || window.allTenants.length === 0) {
            await refreshGlobalTenantCache();
        }
        let tenants = [...(window.allTenants || [])];
        tenants.sort((a, b) => a.room_no.localeCompare(b.room_no, undefined, { numeric: true }));

        if (tenants.length === 0) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 3rem; color: var(--text-muted);">No active units available for billing.</td></tr>`;
            return;
        }

        const ebPromises = tenants.map(t => API.request(`/last-eb/${t.id}`).catch(() => ({ last_eb: t.initial_eb || 0 })));
        const ebResults = await Promise.all(ebPromises);
        const waterPromises = tenants.map(t => t.water_calc_mode === 'METER'
            ? API.request(`/last-water/${t.id}`).catch(() => ({ last_water: t.initial_water || 0 }))
            : Promise.resolve({ last_water: t.initial_water || 0 }));
        const waterResults = await Promise.all(waterPromises);

        batchBillingData = tenants.map((t, idx) => {
            const prevEB = ebResults[idx] && ebResults[idx].last_eb !== undefined ? ebResults[idx].last_eb : (t.initial_eb || 0);
            const isMeter = t.water_calc_mode === 'METER';
            const prevWater = isMeter ? (waterResults[idx] && waterResults[idx].last_water !== undefined ? waterResults[idx].last_water : (t.initial_water || 0)) : 0;
            return {
                renter_id: t.id,
                room_no: t.room_no,
                name: t.name,
                base_rent: t.base_rent || 0,
                water_maint: t.water_maint || 0,
                eb_unit_price: t.eb_unit_price || 0,
                pending_arrears: t.pending_arrears || 0,
                maint_charge: t.maint_charge || 0,
                prev_eb_reading: prevEB,
                curr_eb_reading: prevEB,
                water_calc_mode: t.water_calc_mode || 'FIXED',
                water_unit_price: t.water_unit_price || 0,
                prev_water_reading: prevWater,
                curr_water_reading: prevWater,
                others: 0,
                discount_amount: 0,
                arrears_included: t.pending_arrears || 0,
                notes: ''
            };
        });

        batchBillingFiltered = [...batchBillingData];
        renderBatchBillingRows();
    } catch (e) {
        console.error("Batch Billing Init Failed:", e);
        showNotification("Failed to load tenant readings", "error");
        closeBatchBillingModal();
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function onBatchMonthPickerChange(val) {
    if (!val) return;
    const date = new Date(val + '-01');
    if (!isNaN(date.getTime())) {
        const formattedMonth = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const hiddenInput = document.getElementById('batchBillingMonth');
        if (hiddenInput) hiddenInput.value = formattedMonth;
    }
}

function filterBatchRows(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) {
        batchBillingFiltered = [...batchBillingData];
    } else {
        batchBillingFiltered = batchBillingData.filter(d => 
            d.room_no.toLowerCase().includes(q) || 
            d.name.toLowerCase().includes(q)
        );
    }
    renderBatchBillingRows();
}

function closeBatchBillingModal() {
    const overlay = document.getElementById('batchBillingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

function renderBatchBillingRows() {
    const tbody = document.getElementById('batchBillingTableBody');
    if (!tbody) return;

    if (batchBillingFiltered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2rem; color: var(--text-muted); font-weight: 700;">No matching units found.</td></tr>`;
        return;
    }

    tbody.innerHTML = batchBillingFiltered.map((d) => {
        const index = batchBillingData.findIndex(item => item.renter_id === d.renter_id);
        const ebUnits = Math.max(0, d.curr_eb_reading - d.prev_eb_reading);
        const ebCost = ebUnits * d.eb_unit_price;
        const isMeter = d.water_calc_mode === 'METER';
        const waterUnits = isMeter ? Math.max(0, d.curr_water_reading - d.prev_water_reading) : 0;
        const waterCost = isMeter ? waterUnits * d.water_unit_price : d.water_maint;
        const total = d.base_rent + (d.maint_charge || 0) + waterCost + ebCost + d.others + d.arrears_included - d.discount_amount;

        return `
            <tr style="border-bottom: 1px solid var(--border); transition: background 0.15s ease;">
                <td style="padding: 6px 8px; white-space: nowrap;">
                    <span style="display: inline-block; background: var(--primary-light); color: var(--primary); font-weight: 900; font-size: 0.68rem; padding: 2px 8px; border-radius: 6px;">${d.room_no}</span>
                </td>
                <td style="padding: 6px 8px; font-weight: 700; color: var(--text-main); font-size: 0.75rem; white-space: nowrap;">
                    ${d.name}${isMeter ? ' <span style="color: var(--primary); font-weight: 900; font-size: 0.6rem;">MTR</span>' : ''}
                </td>
                <td style="padding: 6px 8px; font-weight: 600; font-size: 0.72rem; white-space: nowrap;">₹${d.base_rent}</td>
                <td style="padding: 6px 8px; font-weight: 600; font-size: 0.72rem; white-space: nowrap; color: ${(d.maint_charge || 0) > 0 ? 'var(--text-main)' : 'var(--text-muted)'};">₹${d.maint_charge || 0}</td>
                <td style="padding: 6px 8px; font-size: 0.72rem; white-space: nowrap;">
                    ${isMeter ? `
                        <input type="number" id="batchWater_${index}" class="form-input"
                               style="width: 92px; padding: 4px 8px; font-weight: 900; font-size: 0.75rem; border-color: #0ea5e9; background: var(--bg-card);"
                               value="${d.curr_water_reading > d.prev_water_reading ? d.curr_water_reading : ''}"
                               placeholder="${d.prev_water_reading}"
                               oninput="updateBatchWaterMath(${index})">
                        <div id="batchWaterCell_${index}" style="font-size: 0.62rem; font-weight: 800; color: var(--text-muted); margin-top: 2px;">${waterUnits} u x ₹${d.water_unit_price} = ₹${waterCost.toFixed(2)}</div>
                    ` : `₹${d.water_maint}`}
                </td>
                <td style="padding: 6px 8px; color: ${d.pending_arrears > 0 ? 'var(--danger)' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.72rem; white-space: nowrap;">
                    ₹${d.pending_arrears}
                </td>
                <td style="padding: 6px 8px; font-weight: 600; font-size: 0.72rem; color: var(--text-muted); white-space: nowrap;">${d.prev_eb_reading}</td>
                <td style="padding: 4px 8px;">
                    <input type="number" 
                           id="batchCurrEB_${index}" 
                           class="form-input" 
                           style="width: 96px; padding: 4px 8px; font-weight: 900; font-size: 0.75rem; border-color: var(--primary); background: var(--bg-card);" 
                           value="${d.curr_eb_reading > d.prev_eb_reading ? d.curr_eb_reading : ''}" 
                           placeholder="${d.prev_eb_reading}"
                           oninput="updateBatchRowMath(${index})">
                </td>
                <td style="padding: 6px 8px; font-size: 0.68rem; white-space: nowrap;" id="batchUnitsCell_${index}">
                    <span style="font-weight: 800; color: var(--primary);">${ebUnits} u</span> <span style="color: var(--text-muted);">(₹${ebCost.toFixed(2)})</span>
                </td>
                <td style="padding: 6px 8px; text-align: right; font-weight: 950; font-size: 0.78rem; color: var(--success); white-space: nowrap;" id="batchTotalCell_${index}">
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
    const isMeter = d.water_calc_mode === 'METER';
    const waterUnits = isMeter ? Math.max(0, d.curr_water_reading - d.prev_water_reading) : 0;
    const waterCost = isMeter ? waterUnits * d.water_unit_price : d.water_maint;
    const total = d.base_rent + (d.maint_charge || 0) + waterCost + ebCost + d.others + d.arrears_included - d.discount_amount;

    const unitsCell = document.getElementById(`batchUnitsCell_${index}`);
    const totalCell = document.getElementById(`batchTotalCell_${index}`);
    if (unitsCell) unitsCell.innerHTML = `${ebUnits} u (₹${ebCost.toFixed(2)})`;
    if (totalCell) totalCell.innerHTML = `₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

    updateBatchGrandTotal();
}

function updateBatchWaterMath(index) {
    const d = batchBillingData[index];
    if (!d || d.water_calc_mode !== 'METER') return;

    const waterInput = document.getElementById(`batchWater_${index}`);
    const waterVal = waterInput ? parseFloat(waterInput.value) : d.prev_water_reading;
    d.curr_water_reading = isNaN(waterVal) ? d.prev_water_reading : waterVal;

    const waterUnits = Math.max(0, d.curr_water_reading - d.prev_water_reading);
    const waterCost = waterUnits * d.water_unit_price;

    const waterCell = document.getElementById(`batchWaterCell_${index}`);
    if (waterCell) waterCell.innerText = `${waterUnits} u x ₹${d.water_unit_price} = ₹${waterCost.toFixed(2)}`;

    const ebUnits = Math.max(0, d.curr_eb_reading - d.prev_eb_reading);
    const ebCost = ebUnits * d.eb_unit_price;
    const total = d.base_rent + (d.maint_charge || 0) + waterCost + ebCost + d.others + d.arrears_included - d.discount_amount;
    const totalCell = document.getElementById(`batchTotalCell_${index}`);
    if (totalCell) totalCell.innerHTML = `₹${total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

    updateBatchGrandTotal();
}

function updateBatchGrandTotal() {
    let grandTotal = 0;
    batchBillingData.forEach(d => {
        const ebUnits = Math.max(0, d.curr_eb_reading - d.prev_eb_reading);
        const ebCost = ebUnits * d.eb_unit_price;
        const isMeter = d.water_calc_mode === 'METER';
        const waterUnits = isMeter ? Math.max(0, d.curr_water_reading - d.prev_water_reading) : 0;
        const waterCost = isMeter ? waterUnits * d.water_unit_price : d.water_maint;
        const total = d.base_rent + (d.maint_charge || 0) + waterCost + ebCost + d.others + d.arrears_included - d.discount_amount;
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
            maint_amount: d.maint_charge || 0,
            others: d.others || 0,
            discount_amount: d.discount_amount || 0,
            arrears_included: d.arrears_included || 0,
            notes: d.notes || '',
            water_calc_mode: d.water_calc_mode || 'FIXED',
            water_unit_price: d.water_unit_price || 0,
            prev_water_reading: d.prev_water_reading || 0,
            curr_water_reading: d.curr_water_reading || 0
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

/* ===== SECTION: history.js ===== */
let hFullBills = [];
let hBillsVisibleCount = 10;
let currentHistoryRenterId = null;
let resetHistoryScroll = null;
let hAllTenants = [];

async function initHistorySection(reset = false) {
    const select = document.getElementById('historyTenantSelect');
    if (!select) return;

    if (reset) {
        select.value = "";
        const resultsDiv = document.getElementById('historyResults');
        const emptyState = document.getElementById('historyEmptyState');
        if (resultsDiv) resultsDiv.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
    }

    try {
        if (!window.allTenants.length && !window.historyTenants.length) {
            await refreshGlobalTenantCache();
        }

        const combined = [...(window.allTenants || []), ...(window.historyTenants || [])];
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Unit for History --</option>';

        if (combined.length === 0) return;

        combined.sort((a, b) => a.room_no.localeCompare(b.room_no, undefined, { numeric: true }));

        combined.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            const status = t.is_active === 0 ? ' (VACATED)' : '';
            opt.innerText = `UNIT ${t.room_no} • ${t.name}${status}`;
            select.appendChild(opt);
        });
        select.value = currentVal;
    } catch (e) { console.error("Failed to load tenants for history", e); }
}

async function loadTenantHistory(renterId) {
    if (!renterId) return;
    currentHistoryRenterId = renterId;

    const select = document.getElementById('historyTenantSelect');
    if (select && select.value !== renterId.toString()) {
        select.value = renterId;
    }

    const resultsDiv = document.getElementById('historyResults');
    const emptyState = document.getElementById('historyEmptyState');
    const historyBody = document.getElementById('historyBody');
    const nameLabel = document.getElementById('historySelectedName');

    if (resultsDiv) resultsDiv.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');

    if (resetHistoryScroll) {
        resetHistoryScroll();
        resetHistoryScroll = null;
    }
    if (historyBody) historyBody.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-weight: 800;">Syncing records...</div>';

    try {
        const [renters, ledger] = await Promise.all([
            API.tenants.getAll(),
            API.bills.getTenantLedger()
        ]);
        window.allTenants = renters || [];

        const combined = [...window.allTenants, ...(window.historyTenants || [])];
        const renter = combined.find(t => t.id == renterId);
        const ledgerEntry = (ledger || []).find(l => l.id == renterId);

        if (renter) {
            nameLabel.innerText = renter.name;
            const balEl = document.getElementById('histStatBalance');
            const paidEl = document.getElementById('histStatPaid');
            const advEl = document.getElementById('histStatAdvance');

            const balance = ledgerEntry ? ledgerEntry.balance : (renter.balance || 0);
            const totalPaid = ledgerEntry ? ledgerEntry.total_paid : 0;

            if (balEl) balEl.innerText = currencyFormatter.format(balance);
            if (paidEl) paidEl.innerText = currencyFormatter.format(totalPaid);
            if (advEl) advEl.innerText = currencyFormatter.format(renter.advance_amount || 0);
        }

        resetHistoryScroll = setupInfiniteScroll(
            historyBody,
            async (offset, limit) => {
                const data = await API.bills.getByRenter(renterId, limit, offset);
                if (offset === 0 && historyBody) historyBody.innerHTML = '';
                return data;
            },
            (b) => {
                if (!b) return '';
                const month = (b.billing_month || 'JAN').slice(0, 3);
                const dateNum = b.date_generated ? new Date(b.date_generated).getDate() : '--';
                return `
                <div class="tenant-row" id="row-${b.id}" style="padding: 0.5rem 0.75rem; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; border-color: var(--border); border-radius: var(--radius-md);">
                    <div style="display: flex; align-items: center; gap: 0.6rem; flex: 1; min-width: 0;">
                        <div style="width: 30px; height: 30px; background: var(--primary-light); color: var(--primary); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--primary-light);">
                            <span style="font-size: 0.45rem; font-weight: 900; text-transform: uppercase; line-height: 1; opacity: 0.8;">${month}</span>
                            <span style="font-size: 0.72rem; font-weight: 900;">${dateNum}</span>
                        </div>
                        <div style="min-width: 0;">
                            <div style="font-weight: 900; font-size: 0.85rem; color: var(--text-main); display: flex; align-items: center; gap: 5px;">
                                ${currencyFormatter.format(b.total_amount)}
                                ${b.is_paid ? '<i data-lucide="check-circle" class="icon-success" style="width: 13px; height: 13px;"></i>' : ''}
                            </div>
                            <div style="font-size: 0.55rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px;">
                                ${b.billing_month} • ${b.is_paid ? `Paid via ${b.payment_method || 'CASH'}` : '<span style="color: var(--danger);">Payment Overdue</span>'}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                        <span class="badge ${b.is_paid ? 'badge-success' : 'badge-danger'}" style="font-size: 0.5rem; padding: 1px 6px; border-radius: 4px; height: fit-content; border: none;">
                            ${b.is_paid ? 'PAID' : 'DUE'}
                        </span>
                        <div class="history-actions no-print" style="display: flex; gap: 0.25rem; margin-left: 0.4rem; padding-left: 0.5rem; border-left: 1px solid var(--border);">
                            <button class="btn btn-secondary btn-icon-sm" onclick="prepareAndShare('bill', ${b.id})" style="border-radius: 8px; color: var(--info);" title="Share"><i data-lucide="share-2" style="width: 15px; height: 15px;"></i></button>
                            ${!b.is_paid ? `<button class="btn btn-primary btn-icon-sm" onclick="openHistoryPaymentModal(${b.id}, ${b.total_amount})" style="border-radius: 8px;" title="Record Payment"><i data-lucide="credit-card" style="width: 15px; height: 15px;"></i></button>` : ''}
                            <button class="btn btn-danger btn-icon-sm" onclick="deleteBill(${b.id})" style="border-radius: 8px;" title="Delete"><i data-lucide="trash-2" style="width: 15px; height: 15px;"></i></button>
                        </div>
                    </div>
                </div>`;
            },
            { limit: 10, triggerId: 'history-scroll-trigger' }
        );

        setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 100);

    } catch (e) { console.error("History failed", e); }
}

function loadMoreTenantHistory() { }

async function printTenantStatement() {
    if (!currentHistoryRenterId) {
        return showNotification("Please select a tenant unit first", "warning");
    }

    const tenant = (window.allTenants || []).find(t => t.id == currentHistoryRenterId);
    const tenantName = tenant && tenant.name ? tenant.name : (document.getElementById('historySelectedName')?.innerText || 'Tenant');
    const roomNo = tenant && tenant.room_no ? tenant.room_no : 'N/A';
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RentBill Pro Property';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';

    let bills = [];
    try {
        bills = await API.bills.getByRenter(currentHistoryRenterId, 500, 0);
    } catch (e) {
        console.error('Failed to fetch bills for statement print', e);
    }

    const printWin = window.open('/print/statement.html', '_blank');
    if (!printWin) {
        return showNotification("Please allow popups to open statement print view", "error");
    }

    printWin.onload = function() {
        const doc = printWin.document;
        if (doc.getElementById('stmtPropName')) doc.getElementById('stmtPropName').innerText = propName;
        if (doc.getElementById('stmtPropAddr')) doc.getElementById('stmtPropAddr').innerText = propAddr;
        if (doc.getElementById('stmtDate')) doc.getElementById('stmtDate').innerText = new Date().toLocaleDateString('en-IN');
        if (doc.getElementById('stmtTenantName')) doc.getElementById('stmtTenantName').innerText = tenantName;
        if (doc.getElementById('stmtRoomNo')) doc.getElementById('stmtRoomNo').innerText = roomNo;
        const totalPaid = (bills || []).reduce((sum, b) => sum + (b.paid_amount || 0), 0);
        if (doc.getElementById('stmtBalance')) doc.getElementById('stmtBalance').innerText = currencyFormatter.format(totalPaid);

        const tbody = doc.getElementById('stmtRows');
        if (tbody) {
            if (bills && bills.length > 0) {
                tbody.innerHTML = bills.map(b => {
                    const dt = b.date_generated ? new Date(b.date_generated).toLocaleDateString('en-IN') : '--';
                    const month = b.billing_month || 'N/A';
                    const billed = currencyFormatter.format(b.total_amount);
                    const paid = currencyFormatter.format(b.paid_amount || 0);
                    const balAmt = Math.max(0, (b.total_amount + (b.late_fee || 0)) - (b.paid_amount || 0) - (b.discount_amount || 0) - (b.write_off_amount || 0) - (b.arrears_amount || 0));
                    const bal = currencyFormatter.format(balAmt);
                    const statusClass = b.is_paid ? 'color: #059669; font-weight: 800;' : 'color: #dc2626; font-weight: 800;';
                    const statusText = b.is_paid ? 'SETTLED' : `DUE (${bal})`;

                    return `
                        <tr>
                            <td>${dt}</td>
                            <td><strong>${month} Bill</strong> (${b.payment_method || (b.is_paid ? 'PAID' : 'UNPAID')})</td>
                            <td style="text-align: right;">${billed}</td>
                            <td style="text-align: right; color: #059669;">${paid}</td>
                            <td style="text-align: right; ${statusClass}">${statusText}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">No billing transactions recorded.</td></tr>`;
            }
        }
    };
}

let pendingHistoryPaymentId = null;
function openHistoryPaymentModal(billId, total) {
    pendingHistoryPaymentId = billId;
    const modal = document.getElementById('paymentModal');
    if (!modal) return;

    document.getElementById('payTotalLabel').innerText = currencyFormatter.format(total);
    document.getElementById('payAmountInput').value = total;
    document.getElementById('payLateFeeInput').value = '';
    document.getElementById('payDateInput').value = new Date().toISOString().split('T')[0];

    window.confirmPaymentRecord = confirmHistoryPaymentRecord;

    const recSelect = document.getElementById('payReceiverInput');
    if (recSelect && appSettings.receiving_accounts) {
        const names = [...new Set(appSettings.receiving_accounts.map(a => a.owner_name))].filter(n => n);
        recSelect.innerHTML = '<option value="">-- Select Member --</option>';
        names.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n;
            opt.innerText = n;
            recSelect.appendChild(opt);
        });
    }

    modal.classList.remove('hidden');
    calculateAdjustments();
}

async function confirmHistoryPaymentRecord() {
    const method = document.getElementById('payMethodInput').value;
    const receiver = document.getElementById('payReceiverInput').value;
    const date = document.getElementById('payDateInput').value;
    const paid = parseFloat(document.getElementById('payAmountInput').value);

    const disc = parseFloat(document.getElementById('adjType').value === 'DISCOUNT' ? document.getElementById('payBalanceLabel').innerText.replace(/[^\d.]/g, '') : 0) || 0;
    const woff = parseFloat(document.getElementById('adjType').value === 'WRITEOFF' ? document.getElementById('payBalanceLabel').innerText.replace(/[^\d.]/g, '') : 0) || 0;
    const arrs = parseFloat(document.getElementById('adjType').value === 'CARRY' ? document.getElementById('payBalanceLabel').innerText.replace(/[^\d.]/g, '') : 0) || 0;
    const lateFee = parseFloat(document.getElementById('payLateFeeInput').value) || 0;

    if (!receiver || isNaN(paid)) return showNotification("Fill all fields", "error");

    try {
        await API.bills.pay(pendingHistoryPaymentId, {
            payment_method: method,
            payment_details: receiver,
            payment_date: date,
            paid_amount: paid,
            discount_amount: disc,
            write_off_amount: woff,
            arrears_amount: arrs,
            late_fee: lateFee
        });
        showNotification("Payment recorded", "success");
        closePaymentModal();
        loadTenantHistory(currentHistoryRenterId);
        loadDashboardStats();
    } catch (e) { showNotification("Payment failed", "error"); }
}

async function deleteBill(id) {
    if (!confirm("Delete this bill record? This will revert any arrears added to tenant balance.")) return;
    try {
        await API.bills.delete(id);
        showNotification("Bill deleted", "success");
        loadTenantHistory(currentHistoryRenterId);
        loadDashboardStats();
    } catch (e) { showNotification("Delete failed", "error"); }
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
}

function calculateAdjustments() {
    const total = parseFloat(document.getElementById('payTotalLabel').innerText.replace(/[^\d.]/g, '')) || 0;
    const lateFee = parseFloat(document.getElementById('payLateFeeInput')?.value) || 0;
    const dueTotal = total + lateFee;
    const paid = parseFloat(document.getElementById('payAmountInput').value) || 0;

    if (paid > dueTotal) {
        showNotification("Paid amount cannot exceed total due", "error");
        document.getElementById('payAmountInput').value = dueTotal;
        calculateAdjustments();
        return;
    }

    const balance = dueTotal - paid;

    const adjSection = document.getElementById('adjustmentSection');
    const balanceLabel = document.getElementById('payBalanceLabel');
    const adjType = document.getElementById('adjType').value;
    const adjDesc = document.getElementById('adjDescription');

    if (balance > 0) {
        adjSection.classList.remove('hidden');
        balanceLabel.innerText = currencyFormatter.format(balance);

        if (adjType === 'CARRY') {
            adjDesc.innerText = "Remaining balance will be added to the next month's bill as arrears.";
        } else if (adjType === 'DISCOUNT') {
            adjDesc.innerText = "Balance will be marked as a discount/waiver. Total collected will be less.";
        } else if (adjType === 'WRITEOFF') {
            adjDesc.innerText = "Balance will be written off as a loss. Used for rounding off small amounts.";
        }
    } else {
        adjSection.classList.add('hidden');
    }
}

/* ===== SECTION: tenants.js ===== */
async function loadManageTenants() {
    const listDiv = document.getElementById('manageTenantList');
    if (!listDiv) return;

    populateRegistryPropertyFilter();
    const filter = document.getElementById('registryPropertyFilter')?.value || '';
    const searchQuery = (document.getElementById('registrySearchInput')?.value || '').toLowerCase().trim();

    let tenants = window.allTenants || [];
    if (filter) {
        tenants = tenants.filter(t => t.assigned_upi === filter);
    }
    if (searchQuery) {
        tenants = tenants.filter(t => 
            (t.name && t.name.toLowerCase().includes(searchQuery)) ||
            (t.room_no && t.room_no.toLowerCase().includes(searchQuery)) ||
            (t.mobile_number && t.mobile_number.includes(searchQuery))
        );
    }

    if (tenants.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state" style="padding: 3rem 1.5rem; background: var(--bg-input); border: 2px dashed var(--border); border-radius: var(--radius-xl); text-align: center; width: 100%;">
                <i data-lucide="users" style="width: 44px; height: 44px; margin-bottom: 0.75rem; opacity: 0.5; color: var(--primary);"></i>
                <p style="font-weight: 800; color: var(--text-main); font-size: 1.05rem; margin-bottom: 4px;">No active tenant units found</p>
                <p style="font-size: 0.775rem; color: var(--text-muted); margin-bottom: 1.25rem; font-weight: 600;">Try clearing your search query or register a new tenant unit.</p>
                <button class="btn btn-primary btn-sm" onclick="quickRegisterTenant()">
                    <i data-lucide="user-plus" style="width: 14px; height: 14px;"></i> Register Tenant Unit
                </button>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    listDiv.innerHTML = '';
    const listContainer = document.createElement('div');
    listContainer.style.cssText = 'display: flex; flex-direction: column; gap: 0.6rem;';
    const accounts = appSettings.receiving_accounts || [];

    tenants.forEach(t => {
        const acc = accounts.find(a => a.owner_name === t.assigned_upi);
        const propertyChip = t.assigned_upi
            ? `<span style="font-size: 0.55rem; padding: 1px 5px; border-radius: 4px; font-weight: 900; background: var(--primary-light); color: var(--primary);">🏢 ${(acc ? acc.label || t.assigned_upi : t.assigned_upi).toUpperCase()}</span>`
            : '';

        const card = document.createElement('div');
        card.style.cssText = 'background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.7rem 0.85rem; box-shadow: var(--shadow-sm); display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; transition: border-color 0.2s ease;';
        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.6rem; flex: 1; min-width: 0;">
                <div class="room-badge" style="min-width: 40px; height: 32px; padding: 0 0.55rem; font-size: 0.82rem;">${t.room_no}</div>
                <div style="min-width: 0; flex: 1;">
                    <div style="font-weight: 900; font-size: 0.92rem; color: var(--text-main); line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${t.name}
                        ${t.co_tenant_names ? `<span style="font-size: 0.68rem; font-weight: 700; color: var(--text-muted); margin-left: 5px;">(Co: ${t.co_tenant_names})</span>` : ''}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 0.68rem; color: var(--text-muted); font-weight: 700; flex-wrap: wrap;">
                        <span>📱 ${t.mobile_number || 'No Mobile'}</span>
                        <span>•</span>
                        <span>Rent <strong style="color: var(--text-main);">₹${t.base_rent}</strong></span>
                        ${propertyChip}
                    </div>
                </div>
            </div>

            <div style="display: flex; gap: 0.25rem; margin-left: 0.4rem; padding-left: 0.5rem; border-left: 1px solid var(--border);">
                <button type="button" class="btn btn-secondary btn-icon-sm" onclick="editTenant(${t.id})" style="border-radius: 8px; color: var(--primary);" title="Edit Registration">
                    <i data-lucide="edit-3" style="width: 15px; height: 15px;"></i>
                </button>
                <button type="button" class="btn btn-secondary btn-icon-sm" onclick="markAsVacant(${t.id})" style="border-radius: 8px; color: var(--danger);" title="Register Exit / Vacate">
                    <i data-lucide="log-out" style="width: 15px; height: 15px;"></i>
                </button>
            </div>
        `;
        listContainer.appendChild(card);
    });
    listDiv.appendChild(listContainer);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function populateRegistryPropertyFilter() {
    const select = document.getElementById('registryPropertyFilter');
    if (!select || !appSettings.receiving_accounts) return;
    if (select.children.length > 1) return;

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

async function addTenant() {
    const fields = [
        { id: 'tName', label: 'Tenant Name' },
        { id: 'tMobile', label: 'Mobile Number' },
        { id: 'tRoom', label: 'Unit / Room No' },
        { id: 'tAssignedUpi', label: 'Receiving Account' }
    ];

    let missing = [];
    fields.forEach(f => {
        const el = document.getElementById(f.id);
        if (!el || !el.value.trim()) {
            missing.push(f.label);
            if (el) el.style.borderColor = 'var(--danger)';
        } else if (el) {
            el.style.borderColor = '';
        }
    });

    if (missing.length > 0) {
        showNotification(`Missing: ${missing.join(', ')}`, "error");
        const firstMissingId = fields.find(f => !document.getElementById(f.id).value.trim()).id;
        const firstMissing = document.getElementById(firstMissingId);
        firstMissing.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstMissing.focus();
        return;
    }

    const waterMode = document.querySelector('input[name="tWaterMode"]:checked')?.value || 'FIXED';
    const data = {
        name: document.getElementById('tName').value,
        co_tenant_names: document.getElementById('tCoTenants')?.value || '',
        mobile_number: document.getElementById('tMobile').value,
        email: document.getElementById('tEmail').value,
        room_no: document.getElementById('tRoom').value,
        aadhar_no: document.getElementById('tAadhar')?.value || '',
        base_rent: parseFloat(document.getElementById('tRent').value) || 0,
        maint_charge: parseFloat(document.getElementById('tMaintCharge')?.value) || 0,
        eb_unit_price: parseFloat(document.getElementById('tEbRate').value) || 0,
        initial_eb: parseFloat(document.getElementById('tInitialEb').value) || 0,
        water_maint: parseFloat(document.getElementById('tWater').value) || 0,
        water_calc_mode: waterMode,
        water_unit_price: parseFloat(document.getElementById('tWaterUnitPrice')?.value) || 0,
        initial_water: parseFloat(document.getElementById('tInitialWater')?.value) || 0,
        advance_amount: parseFloat(document.getElementById('tAdvance').value) || 0,
        move_in_date: document.getElementById('tMoveIn').value,
        perm_address: document.getElementById('tPermAddr').value,
        emergency_contact: document.getElementById('tEmerg').value,
        occupation: document.getElementById('tJob').value,
        assigned_upi: document.getElementById('tAssignedUpi').value,
        pending_arrears: parseFloat(document.getElementById('tArrears').value) || 0
    };
    try {
        const result = editMode ? await API.tenants.update(editId, data) : await API.tenants.create(data);
        showNotification("Success", "success");
        await refreshGlobalTenantCache();
        toggleRegForm();
        loadTenants();
    } catch (e) {
        showNotification(e.message || "Operation failed", "error");
    }
}

async function editTenant(id) {
    try {
        const t = await API.tenants.getOne(id);
        if (!t) return showNotification("Tenant not found", "error");

        editMode = true;
        editId = id;

        const title = document.getElementById('form-title');
        const submitBtn = document.getElementById('mainSubmitBtn');
        const deleteBtn = document.getElementById('formDeleteBtn');
        const agreementBtn = document.getElementById('formAgreementBtn');
        const regForm = document.getElementById('entrance-form');

        if (title) title.innerText = "Edit Tenant Record";
        if (submitBtn) submitBtn.innerText = "Update Record";
        if (deleteBtn) deleteBtn.classList.remove('hidden');
        if (deleteBtn) deleteBtn.onclick = () => deleteTenant(id);
        if (agreementBtn) agreementBtn.classList.remove('hidden');
        if (agreementBtn) agreementBtn.onclick = () => printProfessionalAgreement(id);

        if (typeof showSection === 'function') {
            showSection('tenants-section');
        }
        if (typeof switchSubSection === 'function') {
            switchSubSection('tenants-section', 'tenants-billing');
        }
        if (regForm) {
            regForm.classList.remove('hidden');
            regForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        const mapping = {
            'tName': 'name', 'tCoTenants': 'co_tenant_names', 'tMobile': 'mobile_number', 'tEmail': 'email',
            'tAadhar': 'aadhar_no',
            'tRoom': 'room_no', 'tRent': 'base_rent', 'tMaintCharge': 'maint_charge',
            'tEbRate': 'eb_unit_price', 'tInitialEb': 'initial_eb',
            'tWater': 'water_maint', 'tAdvance': 'advance_amount',
            'tMoveIn': 'move_in_date', 'tPermAddr': 'perm_address',
            'tEmerg': 'emergency_contact', 'tJob': 'occupation',
            'tAssignedUpi': 'assigned_upi', 'tArrears': 'pending_arrears',
            'tWaterUnitPrice': 'water_unit_price', 'tInitialWater': 'initial_water'
        };

        Object.keys(mapping).forEach(f => {
            const el = document.getElementById(f);
            if (el) {
                let val = t[mapping[f]];
                if (f === 'tMoveIn' && val && val.length > 10) val = val.slice(0, 10);
                el.value = (val !== undefined && val !== null) ? val : '';
            }
        });

        const mode = t.water_calc_mode || 'FIXED';
        const radioFixed = document.getElementById('tWaterFixed');
        const radioMeter = document.getElementById('tWaterMeter');
        if (radioFixed) radioFixed.checked = (mode === 'FIXED');
        if (radioMeter) radioMeter.checked = (mode === 'METER');
        toggleWaterMeterFields();

        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (e) {
        console.error("Critical: Edit load failed", e);
        showNotification(`Load Failed: ${e.message}`, "error");
    }
}

function resetForm() {
    editMode = false; editId = null;
    const title = document.getElementById('form-title');
    const submitBtn = document.getElementById('mainSubmitBtn');
    const deleteBtn = document.getElementById('formDeleteBtn');
    const agreementBtn = document.getElementById('formAgreementBtn');

    if (title) title.innerText = "New Registration";
    if (submitBtn) submitBtn.innerText = "Save Record";
    if (deleteBtn) deleteBtn.classList.add('hidden');
    if (agreementBtn) agreementBtn.classList.add('hidden');

    const fields = ['tName', 'tCoTenants', 'tMobile', 'tEmail', 'tAadhar', 'tRoom', 'tRent', 'tMaintCharge', 'tEbRate', 'tInitialEb', 'tWater', 'tWaterUnitPrice', 'tInitialWater', 'tAdvance', 'tMoveIn', 'tPermAddr', 'tEmerg', 'tJob', 'tAssignedUpi', 'tArrears'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const radioFixed = document.getElementById('tWaterFixed');
    if (radioFixed) radioFixed.checked = true;
    toggleWaterMeterFields();
}

function toggleWaterMeterFields() {
    const mode = document.querySelector('input[name="tWaterMode"]:checked')?.value || 'FIXED';
    const groupFlat = document.getElementById('groupWaterFlat');
    const groupUnit = document.getElementById('groupWaterUnitPrice');
    const groupInit = document.getElementById('groupInitialWater');
    const labelFixed = document.getElementById('labelWaterFixed');
    const labelMeter = document.getElementById('labelWaterMeter');
    const labelTWater = document.getElementById('labelTWater');

    if (mode === 'METER') {
        if (groupFlat) groupFlat.style.display = 'none';
        if (labelTWater) labelTWater.innerText = 'Water Flat Charge (₹/mo)';
        if (groupUnit) groupUnit.style.display = '';
        if (groupInit) groupInit.style.display = '';
        if (labelFixed) { labelFixed.style.borderColor = 'var(--border)'; labelFixed.style.background = ''; }
        if (labelMeter) { labelMeter.style.borderColor = 'var(--primary)'; labelMeter.style.background = 'var(--primary-light)'; }
    } else {
        if (groupFlat) groupFlat.style.display = '';
        if (labelTWater) labelTWater.innerText = 'Water Flat Charge (₹/mo)';
        if (groupUnit) groupUnit.style.display = 'none';
        if (groupInit) groupInit.style.display = 'none';
        if (labelFixed) { labelFixed.style.borderColor = 'var(--primary)'; labelFixed.style.background = 'var(--primary-light)'; }
        if (labelMeter) { labelMeter.style.borderColor = 'var(--border)'; labelMeter.style.background = ''; }
    }
}

function toggleRegForm() {
    const el = document.getElementById('entrance-form');
    if (!el) return;
    const isHidden = el.classList.contains('hidden');
    const toggleBtn = document.getElementById('regToggleBtn');
    if (isHidden) {
        if (!editMode) resetForm();
        el.classList.remove('hidden');
        if (toggleBtn) toggleBtn.innerText = "Hide Form";
        el.scrollIntoView({ behavior: 'smooth' });
    } else {
        el.classList.add('hidden');
        if (toggleBtn) toggleBtn.innerText = "Register New Tenant";
        resetForm();
    }
}

async function loadArchivedTenants() {
    try {
        const tenants = window.historyTenants || [];

        const list = document.getElementById('archivedTenantList');
        if (!list) return;
        list.innerHTML = tenants.length ? tenants.map(t => `
            <div class="tenant-row" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.7rem 0.85rem; margin-bottom: 0.6rem; box-shadow: var(--shadow-sm); display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <div style="display: flex; align-items: center; gap: 0.6rem; flex: 1; min-width: 0;">
                    <div class="room-badge" style="min-width: 40px; height: 32px; padding: 0 0.55rem; font-size: 0.82rem; opacity: 0.5; font-style: italic;">${t.room_no}</div>
                    <div style="min-width: 0; flex: 1;">
                        <div style="font-weight: 900; font-size: 0.92rem; color: var(--text-muted); line-height: 1.25; text-decoration: line-through; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.name}</div>
                        <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 0.68rem; color: var(--text-muted); font-weight: 700; flex-wrap: wrap;">
                            <span>🚪 Vacated ${t.vacate_date ? new Date(t.vacate_date).toLocaleDateString('en-IN') : 'N/A'}</span>
                            <span>•</span>
                            <span>🗓 From ${t.move_in_date ? new Date(t.move_in_date).toLocaleDateString('en-IN') : 'N/A'}</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.25rem; margin-left: 0.4rem; padding-left: 0.5rem; border-left: 1px solid var(--border);">
                    <button class="btn btn-secondary btn-icon-sm" onclick="prepareAndShare('clearance', ${t.id})" style="border-radius: 8px; color: var(--info);" title="Share Clearance"><i data-lucide="share-2" style="width: 15px; height: 15px;"></i></button>
                    <button class="btn btn-secondary btn-icon-sm" onclick="restoreTenant(${t.id})" style="border-radius: 8px; color: var(--success);" title="Restore Tenant"><i data-lucide="rotate-ccw" style="width: 15px; height: 15px;"></i></button>
                    <button class="btn btn-secondary btn-icon-sm" onclick="deleteTenant(${t.id})" style="border-radius: 8px; color: var(--danger);" title="Delete Permanently"><i data-lucide="trash-2" style="width: 15px; height: 15px;"></i></button>
                </div>
            </div>`).join('') : '<p style="text-align:center; padding: 2rem; font-size: 0.8rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">No archived records.</p>';
        lucide.createIcons();
    } catch (e) { console.error(e); }
}

async function restoreTenant(id) {
    try {
        await API.tenants.restore(id);
        showNotification("Restored", "success");
        await refreshGlobalTenantCache();
        loadArchivedTenants();
        loadManageTenants();
        loadDashboardStats();
    } catch (e) { showNotification(e.message, "error"); }
}

function toggleHistory(forceShow = false) {
    if (forceShow) {
        loadArchivedTenants();
        return;
    }
    loadArchivedTenants();
}

let pendingDeleteId = null;
async function deleteTenant(id) {
    pendingDeleteId = id;
    document.getElementById('confirmationTitle').innerText = "Delete Permanently";
    document.getElementById('confirmationMessage').innerText = "This will erase all history. Enter Master PIN to authorize.";
    document.getElementById('deletePinModal').classList.remove('hidden');
    document.getElementById('deletePinInput').value = '';
    document.querySelector('#deletePinModal .btn-danger').onclick = confirmActionWithPin;
}

let pendingVacantId = null;
let lastEBReading = 0;
let tenantEBUnitPrice = 0;

async function markAsVacant(id) {
    pendingVacantId = id;
    try {
        let t = window.allTenants.find(ten => ten.id == id);
        if (!t) t = await API.tenants.getOne(id);

        const ebData = await API.bills.getLastEB(id);

        lastEBReading = ebData.last_eb || 0;
        tenantEBUnitPrice = t.eb_unit_price || 0;

        document.getElementById('sAdvance').value = t.advance_amount;
        document.getElementById('sRentDue').value = t.pending_arrears || 0;
        document.getElementById('sEbDue').value = 0;
        document.getElementById('sEbReading').value = '';
        document.getElementById('sEbReading').placeholder = `Last: ${lastEBReading}`;

        calcSettlement();
        document.getElementById('settlementModal').classList.remove('hidden');
    } catch (e) { showNotification("Failed to load details", "error"); }
}

function calcSettlement(triggeredBy) {
    const adv = parseFloat(document.getElementById('sAdvance').value) || 0;
    const rent = parseFloat(document.getElementById('sRentDue').value) || 0;

    if (triggeredBy === 'reading') {
        const finalReading = parseFloat(document.getElementById('sEbReading').value) || lastEBReading;
        if (finalReading > lastEBReading) {
            const units = finalReading - lastEBReading;
            document.getElementById('sEbDue').value = (units * tenantEBUnitPrice).toFixed(2);
        } else {
            document.getElementById('sEbDue').value = 0;
        }
    }

    const eb = parseFloat(document.getElementById('sEbDue').value) || 0;
    const rep = parseFloat(document.getElementById('sRepairs').value) || 0;
    const other = parseFloat(document.getElementById('sOtherDues')?.value) || 0;
    const bal = adv - (rent + eb + rep + other);

    const labelEl = document.getElementById('settlementLabel');
    const totalEl = document.getElementById('settlementTotal');
    const boxEl = document.getElementById('settlementResultBox');

    if (totalEl) totalEl.innerText = currencyFormatter.format(Math.abs(bal));
    if (labelEl) labelEl.innerText = bal >= 0 ? "TOTAL REFUND AMOUNT" : "NET BALANCE DUE (ARREARS)";
    if (boxEl) {
        boxEl.style.borderColor = bal >= 0 ? 'var(--success)' : 'var(--danger)';
        if (totalEl) totalEl.style.color = bal >= 0 ? 'var(--success)' : 'var(--danger)';
    }
}

function closeSettlementModal() {
    document.getElementById('settlementModal').classList.add('hidden');
    document.getElementById('sRentDue').value = 0; document.getElementById('sEbDue').value = 0;
    document.getElementById('sEbReading').value = ''; document.getElementById('sRepairs').value = 0;
    if (document.getElementById('sOtherDues')) document.getElementById('sOtherDues').value = 0;
    document.getElementById('sReason').value = ''; pendingVacantId = null;
}

async function processSettlementAndVacant() {
    if (typeof window.bypassConfirm === 'undefined' && !confirm("Confirm final settlement?")) return;

    const adv = parseFloat(document.getElementById('sAdvance').value) || 0;
    const rent = parseFloat(document.getElementById('sRentDue').value) || 0;
    const eb = parseFloat(document.getElementById('sEbDue').value) || 0;
    const rep = parseFloat(document.getElementById('sRepairs').value) || 0;
    const other = parseFloat(document.getElementById('sOtherDues')?.value) || 0;
    const numericBalance = adv - (rent + eb + rep + other);

    const details = {
        advance: adv,
        ebReading: document.getElementById('sEbReading').value || 'N/A',
        rentDue: rent,
        ebDue: eb,
        repairs: rep,
        otherDues: other,
        reason: document.getElementById('sReason').value || 'None',
        totalRefund: document.getElementById('settlementTotal').innerText,
        refundLabel: document.getElementById('settlementLabel').innerText,
        balance: numericBalance
    };
    try {
        await API.tenants.markVacant({
            id: pendingVacantId,
            refund_amount: details.totalRefund,
            dues_deducted: details.rentDue + details.ebDue + details.otherDues,
            repairs_deducted: details.repairs,
            refund_label: details.refundLabel,
            final_balance: numericBalance,
            vacate_date: new Date().toISOString().split('T')[0],
            exit_eb_reading: details.ebReading,
            exit_rent_due: details.rentDue,
            exit_eb_due: details.ebDue,
            exit_reason: details.reason
        });
        showNotification("Unit is now vacant", "success");
        await refreshGlobalTenantCache();
        document.getElementById('settlementModal').classList.add('hidden');
        prepareAndShare('clearance', pendingVacantId, details);
        loadManageTenants(); loadDashboardStats();
    } catch (e) { showNotification("Action failed", "error"); }
}

async function exportTenantsCSV() {
    window.location.href = '/api/renters/export';
}

async function importTenantsCSV(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('csv_file', file);

    showNotification("Importing...", "info");
    try {
        const res = await fetch('/api/renters/import', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            showNotification(data.message || "Imported successfully", "success");
            await refreshGlobalTenantCache();
            loadManageTenants();
        } else {
            showNotification(data.error || "Import failed", "error");
        }
    } catch (e) {
        showNotification("Network error during import", "error");
    }
    input.value = '';
}

/* ===== SECTION: settings.js ===== */
let accountEditIndex = null;

async function loadSettings() {
    try {
        const data = await API.system.getSettings();
        appSettings = data;
        const propName = document.getElementById('prop_name');
        const propAddr = document.getElementById('prop_addr');
        const agTerms = document.getElementById('agreement_terms');
        const emailUser = document.getElementById('email_user');
        const emailHost = document.getElementById('email_host');
        const emailPort = document.getElementById('email_port');
        const emailBcc = document.getElementById('email_bcc');
        const srvPort = document.getElementById('server_port');

        if (propName) propName.value = data.property_name || '';
        if (propAddr) propAddr.value = data.property_address || '';
        if (agTerms) agTerms.value = data.agreement_terms || '';
        if (emailUser) emailUser.value = data.email_user || '';
        if (emailHost) emailHost.value = data.email_host || 'smtp.gmail.com';
        if (emailPort) emailPort.value = data.email_port || 587;
        if (emailBcc) emailBcc.value = data.email_bcc || '';
        if (srvPort) srvPort.value = data.server_port || 8080;

        const fromInput = document.getElementById('auditFromDate');
        const toInput = document.getElementById('auditToDate');
        if (fromInput && toInput && !fromInput.value) {
            setAuditPeriod('current');
        }

        renderUnifiedAccounts(data.receiving_accounts || []);
        loadPropertyUnits();
        populateOwnerDropdown(data.receiving_accounts || []);
        if (typeof populateWithdrawalFilters === 'function') populateWithdrawalFilters();
    } catch (e) { console.error(e); }
}

function setAuditPeriod(type) {
    const fromInput = document.getElementById('auditFromDate');
    const toInput = document.getElementById('auditToDate');
    if (!fromInput || !toInput) return;

    const now = new Date();
    if (type === 'current') {
        fromInput.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
        toInput.value = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    } else if (type === 'last') {
        fromInput.value = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
        toInput.value = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
    } else if (type === 'fy') {
        let startYear = now.getFullYear();
        if (now.getMonth() < 3) startYear--;
        fromInput.value = `${startYear}-04-01`;
        toInput.value = `${startYear + 1}-03-31`;
    }
}

async function saveReceivingAccount() {
    const name = document.getElementById('acc_name').value.trim();
    const label = document.getElementById('acc_label').value.trim();
    const upi = document.getElementById('acc_upi').value.trim();
    const bank = document.getElementById('acc_bank').value.trim();
    const num = document.getElementById('acc_num').value.trim();
    const ifsc = document.getElementById('acc_ifsc').value.trim();
    const pName = document.getElementById('acc_prop_name').value.trim();
    const pAddr = document.getElementById('acc_prop_addr').value.trim();
    const pTerms = document.getElementById('acc_terms').value.trim();

    if (!name || !label) return showNotification("Owner Name and Label are required", "error");
    if (!upi && !bank) return showNotification("Please provide either UPI or Bank details", "error");

    const accounts = appSettings.receiving_accounts || [];
    const accountData = {
        owner_name: name,
        label: label,
        upi: upi,
        bank_name: bank,
        account_number: num,
        ifsc: ifsc,
        property_name: pName,
        property_address: pAddr,
        agreement_terms: pTerms
    };

    if (accountEditIndex !== null) {
        accounts[accountEditIndex] = accountData;
    } else {
        accounts.push(accountData);
    }

    try {
        await API.system.updateSettings({ receiving_accounts: accounts });
        showNotification("Account saved", "success");
        cancelAccountEdit();
        loadSettings();
    } catch (e) {
        console.error(e);
        showNotification("Failed to save: " + (e.message || "Unknown error"), "error");
    }
}

function toggleOwnerAccountForm() {
    const el = document.getElementById('owner-account-form');
    if (!el) return;
    const isHidden = el.classList.contains('hidden');
    if (isHidden) {
        el.classList.remove('hidden');
        el.scrollIntoView({ behavior: 'smooth' });
    } else {
        el.classList.add('hidden');
        cancelAccountEdit();
    }
}

function renderUnifiedAccounts(accounts) {
    const list = document.getElementById('unifiedAccountList');
    if (!list) return;
    if (!accounts || accounts.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 3rem 1.5rem; background: var(--bg-card); border: 2px dashed var(--border); border-radius: var(--radius-lg);">
                <i data-lucide="wallet" style="width: 44px; height: 44px; color: var(--text-muted); opacity: 0.5; margin-bottom: 0.75rem;"></i>
                <div style="font-weight: 800; font-size: 1rem; color: var(--text-main);">No Receiving Accounts Created</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Click "Add Owner Account" above to register bank & UPI details for building owners.</div>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    list.innerHTML = accounts.map((acc, index) => `
        <div class="owner-card-redesign" style="background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 0.7rem 0.85rem; margin-bottom: 0.6rem; box-shadow: var(--shadow-sm); display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; transition: border-color 0.2s ease;">
            <div style="width: 34px; height: 34px; border-radius: 9px; font-weight: 950; font-size: 0.85rem; background: var(--primary-light); color: var(--primary); display: flex; align-items: center; justify-content: center; text-transform: uppercase; flex-shrink: 0;">
                ${(acc.owner_name || 'OW').substring(0, 2)}
            </div>

            <div style="flex: 1; min-width: 0;">
                <div style="font-weight: 900; font-size: 0.92rem; color: var(--text-main); line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${acc.owner_name}
                    <span style="font-size: 0.68rem; font-weight: 700; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; margin-left: 5px;">${acc.label || 'Primary Account'}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 0.68rem; color: var(--text-muted); font-weight: 700; flex-wrap: wrap;">
                    ${acc.upi ? `<span style="font-family: monospace; font-weight: 800; color: var(--primary);">UPI: ${acc.upi}</span>` : ''}
                    ${acc.bank_name ? `<span>•</span><span>${acc.bank_name} ${acc.account_number ? `(${acc.account_number})` : ''}${acc.ifsc ? ` · ${acc.ifsc}` : ''}</span>` : ''}
                    ${acc.property_name ? `<span>•</span><span>🏢 ${acc.property_name}</span>` : ''}
                </div>
            </div>

            <div style="display: flex; gap: 0.25rem; margin-left: 0.4rem; padding-left: 0.5rem; border-left: 1px solid var(--border);">
                <button type="button" class="btn btn-secondary btn-icon-sm" onclick="toggleOwnerAccountForm(); editAccount(${index});" style="border-radius: 8px; color: var(--warning);" title="Edit Account">
                    <i data-lucide="edit-3" style="width: 15px; height: 15px;"></i>
                </button>
                <button type="button" class="btn btn-secondary btn-icon-sm" onclick="printIncomeHistory('${acc.owner_name}')" style="border-radius: 8px; color: var(--info);" title="Print Income Statement">
                    <i data-lucide="printer" style="width: 15px; height: 15px;"></i>
                </button>
                <button type="button" class="btn btn-secondary btn-icon-sm" onclick="deleteAccount(${index})" style="border-radius: 8px; color: var(--danger);" title="Delete Account">
                    <i data-lucide="trash-2" style="width: 15px; height: 15px;"></i>
                </button>
            </div>
        </div>
    `).join('');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function populateOwnerDropdown(accounts) {
    const selects = ['eOwnerName', 'wOwnerName', 'tTaskOwner', 'tAssignedUpi', 'payReceiverInput'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const currentVal = el.value;
        el.innerHTML = '<option value="">-- Select --</option>' +
            accounts.map(a => `<option value="${a.owner_name}">${a.owner_name}</option>`).join('');
        el.value = currentVal;
    });
}
function editAccount(index) {
    const acc = appSettings.receiving_accounts[index];
    accountEditIndex = index;
    document.getElementById('acc_name').value = acc.owner_name;
    document.getElementById('acc_label').value = acc.label;
    document.getElementById('acc_upi').value = acc.upi || '';
    document.getElementById('acc_bank').value = acc.bank_name || '';
    document.getElementById('acc_num').value = acc.account_number || '';
    document.getElementById('acc_ifsc').value = acc.ifsc || '';
    document.getElementById('acc_prop_name').value = acc.property_name || '';
    document.getElementById('acc_prop_addr').value = acc.property_address || '';
    document.getElementById('acc_terms').value = acc.agreement_terms || '';

    document.getElementById('addAccBtn').innerText = "Update Account Record";
    const cancelBtn = document.getElementById('cancelAccEditBtn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelAccountEdit() {
    accountEditIndex = null;
    document.getElementById('acc_name').value = '';
    document.getElementById('acc_label').value = '';
    document.getElementById('acc_upi').value = '';
    document.getElementById('acc_bank').value = '';
    document.getElementById('acc_num').value = '';
    document.getElementById('acc_ifsc').value = '';
    document.getElementById('acc_prop_name').value = '';
    document.getElementById('acc_prop_addr').value = '';
    document.getElementById('acc_terms').value = '';
    document.getElementById('addAccBtn').innerText = "Add Account Record";
    const cancelBtn = document.getElementById('cancelAccEditBtn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

async function deleteAccount(index) {
    if (!confirm("Are you sure? This will remove this receiving account.")) return;
    const accounts = [...appSettings.receiving_accounts];
    accounts.splice(index, 1);
    try {
        await API.system.updateSettings({ receiving_accounts: accounts });
        showNotification("Account removed", "success");
        loadSettings();
    } catch (e) {
        console.error(e);
        showNotification("Failed to remove: " + (e.message || "Unknown error"), "error");
    }
}

async function saveSystemSettings() {
    const data = {
        property_name: document.getElementById('prop_name').value.trim(),
        property_address: document.getElementById('prop_addr').value.trim(),
        agreement_terms: document.getElementById('agreement_terms')?.value.trim() || '',
        email_user: document.getElementById('email_user').value.trim(),
        email_pass: document.getElementById('email_pass').value,
        email_host: document.getElementById('email_host').value.trim(),
        email_port: parseInt(document.getElementById('email_port').value) || 587,
        email_bcc: document.getElementById('email_bcc').value.trim(),
        server_port: parseInt(document.getElementById('server_port').value) || 8080,
        new_pin: document.getElementById('new_master_pin').value.trim(),
        new_staff_pin: document.getElementById('new_staff_pin').value.trim()
    };

    try {
        const res = await API.system.updateSettings(data);
        if (res.message && res.message.includes('Restarting')) {
            showNotification(res.message, "warning");
        } else {
            showNotification("Settings updated successfully", "success");
            loadSettings();
        }
    } catch (e) {
        console.error(e);
        showNotification("Update failed: " + (e.message || "Unknown error"), "error");
    }
}

async function testSMTPSettings() {
    showNotification("Sending test email...", "info");
    try {
        await API.system.testEmail();
        showNotification("Test email sent successfully!", "success");
    } catch (e) {
        console.error(e);
        showNotification("SMTP Test failed: " + (e.message || "Check credentials"), "error");
    }
}

async function backupDatabase() {
    const filenameEl = document.getElementById('backupFilename');
    const prefix = filenameEl ? (filenameEl.value || 'manual_backup') : 'dashboard_backup';
    showNotification("Preparing backup...", "info");
    try {
        const blob = await API.system.backup(prefix);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${new Date().toISOString().split('T')[0]}_${prefix}.db`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        showNotification("Backup downloaded", "success");
    } catch (e) { showNotification("Backup failed", "error"); }
}

async function restoreDatabase() {
    const fileInput = document.getElementById('restoreFile');
    const pin = document.getElementById('restorePin').value;

    if (!fileInput.files.length) return showNotification("Please select a .db file", "error");
    if (!pin) return showNotification("PIN required for restore", "error");

    if (!confirm("CRITICAL: This will replace your entire database. Continue?")) return;
    try {
        const formData = new FormData();
        formData.append('backup_file', fileInput.files[0]);
        formData.append('pin', pin);

        const result = await API.system.restore(formData);

        showNotification(result.message || "Database restored! Reloading...", "success");
        setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
        showNotification(e.message || "Restore failed", "error");
    }
}

async function viewAuditReport() {
    const fromDate = document.getElementById('auditFromDate')?.value;
    const toDate = document.getElementById('auditToDate')?.value;
    const includeTax = document.getElementById('auditIncludeTax')?.checked;
    const municipalTax = parseFloat(document.getElementById('auditMunicipalTax')?.value || 0);

    if (!fromDate || !toDate) return showNotification("Please select both Start and End dates", "error");

    const formatDateString = (ds) => {
        if (!ds) return '...';
        const [y, m, d] = ds.split('-');
        return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    };

    showNotification("Compiling financial data...", "info");
    try {
        const data = await API.system.getAuditReport(fromDate, toDate);
        const auditContent = document.getElementById('auditContent');
        if (!auditContent) return;

        const totalRentIncome = data.summary.total_paid;
        const totalExpenses = data.summary.total_expenses;
        const totalPayouts = data.summary.total_payouts;

        const netOperatingProfit = totalRentIncome - totalExpenses;
        const settledBalance = netOperatingProfit - totalPayouts;

        const filteredLogs = (data.logs || []).filter(l =>
            ['PAYMENT_RECORDED', 'EXPENSE_RECORDED', 'EXPENSE_ADDED', 'OWNER_PAYOUT'].includes(l.action)
        );

        const logsHtml = filteredLogs.length > 0
            ? `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border);">
                        <th style="padding: 10px; text-align: left; color: var(--text-muted); font-weight: 800;">DATE</th>
                        <th style="padding: 10px; text-align: left; color: var(--text-muted); font-weight: 800;">ACTIVITY</th>
                        <th style="padding: 10px; text-align: right; color: var(--text-muted); font-weight: 800;">AMOUNT</th>
                        <th style="padding: 10px; text-align: left; color: var(--text-muted); font-weight: 800;">DETAILS</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredLogs.map(l => {
                let color = 'var(--text-main)';
                if (l.action.includes('PAYMENT')) color = 'var(--success)';
                if (l.action.includes('EXPENSE')) color = 'var(--danger)';
                if (l.action.includes('PAYOUT')) color = 'var(--warning)';
                const logDate = new Date(l.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
                return `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 10px; font-weight: 700; color: var(--text-muted); width: 100px;">${logDate}</td>
                            <td style="padding: 10px; font-weight: 900; color: ${color}; white-space: nowrap; text-transform: uppercase; font-size: 0.65rem;">
                                ${l.action.replace(/_/g, ' ')}
                            </td>
                            <td style="padding: 10px; font-weight: 900; text-align: right; color: ${color};">${l.amount > 0 ? currencyFormatter.format(l.amount) : '-'}</td>
                            <td style="padding: 10px; font-weight: 700; color: var(--text-main); line-height: 1.4;">${l.details}</td>
                        </tr>`;
            }).join('')}
                </tbody>
            </table>`
            : '<p style="text-align: center; color: var(--text-muted); padding: 3rem; font-weight: 800;">No financial transactions found for this period.</p>';

        let taxHtml = '';
        if (includeTax) {
            const netAnnualValue = Math.max(0, totalRentIncome - municipalTax);
            const standardDeduction = netAnnualValue * 0.30;
            const netTaxableIncome = netAnnualValue - standardDeduction;

            taxHtml = `
                <div style="margin-top: 2rem; background: var(--bg-main); border: 1px solid var(--border); border-radius: 12px; padding: 20px; break-inside: avoid;">
                    <div style="font-size: 1rem; font-weight: 900; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 1.5px solid var(--border); padding-bottom: 8px;">Section 24a Tax Projection</div>
                    <div style="display: grid; grid-template-columns: 1fr auto; gap: 10px; font-size: 0.85rem;">
                        <span style="color: var(--text-muted);">Collected Rent (GAV):</span> <span style="font-weight: 800;">${currencyFormatter.format(totalRentIncome)}</span>
                        <span style="color: var(--text-muted);">Municipal Taxes:</span> <span style="font-weight: 800;">-${currencyFormatter.format(municipalTax)}</span>
                        <span style="color: var(--text-main); font-weight: 900; padding-top: 5px; border-top: 1px dashed var(--border);">NET ANNUAL VALUE (NAV):</span> <span style="font-weight: 900; padding-top: 5px; border-top: 1px dashed var(--border);">${currencyFormatter.format(netAnnualValue)}</span>
                        <span style="color: var(--danger);">Standard Deduction (30%):</span> <span style="font-weight: 800; color: var(--danger);">${currencyFormatter.format(standardDeduction)}</span>
                        <span style="color: var(--primary); font-weight: 900; font-size: 1rem; padding-top: 10px; border-top: 1.5px solid var(--primary);">EST. TAXABLE INCOME:</span> <span style="font-weight: 900; font-size: 1rem; padding-top: 10px; border-top: 1.5px solid var(--primary); color: var(--primary);">${currencyFormatter.format(netTaxableIncome)}</span>
                    </div>
                </div>
            `;
        }

        auditContent.innerHTML = `
            <div id="printableAudit" style="font-family: var(--font-main), sans-serif; color: var(--text-main); background: white; padding: 25px;">
                <div style="text-align: center; border-bottom: 3px solid var(--primary); padding-bottom: 2rem; margin-bottom: 2.5rem;">
                    <h1 style="margin: 0; font-size: 2rem; font-weight: 900; color: var(--primary); text-transform: uppercase; letter-spacing: 1px;">Period Financial Audit</h1>
                    <p style="margin: 10px 0 0 0; font-weight: 800; color: var(--text-muted); font-size: 1rem;">
                        ${formatDateString(fromDate)} 
                        — 
                        ${formatDateString(toDate)}
                    </p>
                </div>

                <div style="margin-bottom: 3rem; background: var(--bg-main); border: 2px solid var(--border); border-radius: 16px; padding: 30px; text-align: center;">
                    <div style="display: grid; grid-template-columns: 1fr auto 1fr auto 1fr; align-items: center; gap: 10px; margin-bottom: 25px;">
                        <div>
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--success); text-transform: uppercase; margin-bottom: 5px;">Rent Collected</div>
                            <div style="font-size: 1.2rem; font-weight: 900; color: var(--text-main);">${currencyFormatter.format(totalRentIncome)}</div>
                        </div>
                        <div style="font-size: 1.5rem; font-weight: 300; color: var(--text-muted);">&minus;</div>
                        <div>
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--danger); text-transform: uppercase; margin-bottom: 5px;">Maint. Expenses</div>
                            <div style="font-size: 1.2rem; font-weight: 900; color: var(--text-main);">${currencyFormatter.format(totalExpenses)}</div>
                        </div>
                        <div style="font-size: 1.5rem; font-weight: 300; color: var(--text-muted);">&equals;</div>
                        <div>
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--primary); text-transform: uppercase; margin-bottom: 5px;">Net Profit</div>
                            <div style="font-size: 1.5rem; font-weight: 950; color: var(--primary);">${currencyFormatter.format(netOperatingProfit)}</div>
                        </div>
                    </div>
                    
                    <div style="border-top: 1.5px dashed var(--border); padding-top: 20px; display: flex; justify-content: space-around; align-items: center;">
                        <div style="text-align: center;">
                            <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Owner Payouts</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: var(--warning);">${currencyFormatter.format(totalPayouts)}</div>
                        </div>
                        <div style="height: 30px; border-left: 1.5px solid var(--border);"></div>
                        <div style="text-align: center;">
                            <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;">Closing Balance</div>
                            <div style="font-size: 1.1rem; font-weight: 950; color: var(--text-main);">${currencyFormatter.format(settledBalance)}</div>
                        </div>
                    </div>
                </div>

                <div style="margin-bottom: 2rem;">
                    <h3 style="font-size: 1.1rem; font-weight: 900; border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 15px; text-transform: uppercase; color: var(--text-main); letter-spacing: 1px;">Transaction Activity Ledger</h3>
                    <div style="border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: #fff;">
                        ${logsHtml}
                    </div>
                </div>

                ${taxHtml}

                <div style="margin-top: 4rem; border-top: 1.5px solid var(--border); padding-top: 20px; text-align: center; font-size: 0.75rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
                    THIS DOCUMENT IS AN OFFICIAL SYSTEM-GENERATED FINANCIAL SUMMARY
                    <br><span style="opacity: 0.7; font-weight: 600;">Report Path: Settings > Audit // Generated: ${new Date().toLocaleString('en-IN')}</span>
                </div>
            </div>
        `;

        document.getElementById('auditModal')?.classList.remove('hidden');
        lucide.createIcons();
    } catch (e) {
        showNotification("Failed to compile audit data", "error");
        console.error(e);
    }
}

function closeAuditModal() {
    document.getElementById('auditModal')?.classList.add('hidden');
}

function printAudit() {
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RENTBILL PRO';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';

    document.querySelectorAll('.auditPrintPropName').forEach(el => el.innerText = propName);
    document.querySelectorAll('.auditPrintPropAddr').forEach(el => el.innerText = propAddr);

    const style = document.createElement('style');
    style.id = 'print-audit-style';
    style.innerHTML = `
        @media print {
            body { background: white !important; color: black !important; }
            .app-section, .no-print, .sub-nav { display: none !important; }
            #auditModal { display: block !important; position: static !important; width: 100% !important; background: white !important; }
            .modal-overlay { background: white !important; padding: 0 !important; }
            .modal-content { box-shadow: none !important; border: none !important; width: 100% !important; max-width: none !important; padding: 0 !important; margin: 0 !important; }
            @page { margin: 1.5cm; }
        }
    `;
    document.head.appendChild(style);

    window.print();

    setTimeout(() => {
        const styleEl = document.getElementById('print-audit-style');
        if (styleEl) styleEl.remove();
    }, 500);
}

/* ===== SECTION: tenant_portal.js ===== */
function toggleTenantPortalForm() {
    const tenantForm = document.getElementById('tenantLoginForm');
    if (!tenantForm) return;

    const isTenantHidden = tenantForm.classList.contains('hidden');
    if (isTenantHidden) {
        switchLoginTab('tenant');
    } else {
        switchLoginTab('admin');
    }
}

async function submitTenantLogin() {
    const identifier = document.getElementById('tenantRoomInput').value.trim();
    const password = document.getElementById('tenantMobileInput').value.trim();

    if (!identifier || !password) {
        return showNotification("Please enter Room No, Mobile or Email and Password", "error");
    }

    try {
        const response = await fetch('/api/tenant/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_no: identifier, mobile_number: identifier, email: identifier, password: password })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Invalid Room No / Mobile / Email or Password");

        const tenant = data;

        window.currentTenant = tenant;
        localStorage.setItem('tenantRoom', tenant.room_no || identifier);
        localStorage.setItem('tenantMobile', password);

        const overlay = document.getElementById('pinOverlay');
        if (overlay) overlay.classList.add('hidden');

        showTenantPortal();
        showNotification("Welcome, " + tenant.name, "success");
    } catch (e) {
        showNotification(e.message || "Login failed", "error");
    }
}

function showTenantPortal() {
    const mainApp = document.getElementById('mainApp');
    if (!mainApp) return;

    mainApp.innerHTML = `
        ${Templates.tenantPortal}
    `;
    mainApp.classList.remove('hidden');

    const tenant = window.currentTenant;
    document.getElementById('tenantPortalWelcome').innerText = `Hello, ${tenant.name}`;
    document.getElementById('tenantPortalSub').innerText = `Room ${tenant.room_no} • RentBill Tenant Portal`;

    document.getElementById('tenantOutstandingBalance').innerText = currencyFormatter.format(tenant.pending_arrears);
    document.getElementById('tenantMonthlyRent').innerText = currencyFormatter.format(tenant.base_rent);

    if (typeof lucide !== 'undefined') lucide.createIcons();

    loadTenantLedger();
    loadTenantMaintenanceTasks();
}

function tenantLogout() {
    window.currentTenant = null;
    localStorage.removeItem('tenantRoom');
    localStorage.removeItem('tenantMobile');

    const mainApp = document.getElementById('mainApp');
    if (mainApp) {
        mainApp.innerHTML = '';
        mainApp.classList.add('hidden');
    }

    const overlay = document.getElementById('pinOverlay');
    if (overlay) {
        overlay.innerHTML = Templates.authOverlay;
        overlay.classList.remove('hidden');
        switchLoginTab('tenant');
    }
}

async function loadTenantLedger() {
    const listDiv = document.getElementById('tenantLedgerList');
    if (!listDiv) return;

    try {
        const response = await fetch('/api/tenant/bills', {
            headers: {
                'X-Room-No': window.currentTenant.room_no,
                'X-Mobile-No': window.currentTenant.mobile_number
            }
        });
        const bills = await response.json() || [];

        if (bills.length === 0) {
            listDiv.innerHTML = `
                <div class="empty-state" style="padding: 2rem 1rem;">
                    <i data-lucide="receipt" style="width: 32px; height: 32px; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                    <p style="font-size: 0.75rem; font-weight: 600;">No payment history recorded.</p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        listDiv.innerHTML = bills.map(b => {
            const dateStr = b.date_generated ? new Date(b.date_generated).toLocaleDateString('en-IN') : 'N/A';
            let statusText = b.is_paid ? 'PAID' : 'UNPAID';
            let statusColor = b.is_paid ? 'var(--success)' : 'var(--danger)';
            let statusBg = b.is_paid ? 'var(--bg-success-light)' : 'var(--bg-danger-light)';

            if (!b.is_paid && b.proof_status === 'PENDING') {
                statusText = 'PENDING VERIFICATION';
                statusColor = 'var(--warning)';
                statusBg = 'var(--bg-warning-light)';
            }

            return `
                <div class="tenant-row" style="padding: 1rem; border: 1.5px solid var(--border); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                    <div>
                        <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-main);">${b.billing_month}</div>
                        <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">
                            Generated: ${dateStr} • EB: ${b.curr_eb_reading - b.prev_eb_reading}u
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                        <div style="font-weight: 900; font-size: 1rem; color: var(--text-main);">${currencyFormatter.format(b.total_amount)}</div>
                        <span class="badge" style="background: ${statusBg}; color: ${statusColor}; border-color: ${statusColor}; font-size: 0.55rem; padding: 2px 6px;">${statusText}</span>
                        ${!b.is_paid && b.proof_status !== 'PENDING' ? `
                            <button type="button" class="btn btn-sm btn-primary" onclick="openSubmitProofModal(${b.id}, '${b.billing_month}', ${b.total_amount})" style="font-size: 0.65rem; padding: 3px 8px; margin-top: 4px; border-radius: 6px;">
                                <i data-lucide="upload-cloud" style="width: 12px; height: 12px;"></i> Submit Proof
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.error(e);
        listDiv.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--danger); font-size:0.75rem;">Failed to load ledger.</p>';
    }
}

function openSubmitProofModal(billId, monthName, totalAmount) {
    const overlay = document.getElementById('tenantProofOverlay');
    if (!overlay) return;

    document.getElementById('proofBillId').value = billId;
    const sub = document.getElementById('proofModalSub');
    if (sub) sub.innerText = `${monthName} • Total: ${currencyFormatter.format(totalAmount)}`;

    document.getElementById('proofRefInput').value = '';
    document.getElementById('proofPhotoInput').value = '';
    overlay.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeTenantProofModal() {
    const overlay = document.getElementById('tenantProofOverlay');
    if (overlay) overlay.classList.add('hidden');
}

async function submitTenantPaymentProof() {
    const billId = document.getElementById('proofBillId').value;
    const refVal = document.getElementById('proofRefInput').value.trim();
    const photoInput = document.getElementById('proofPhotoInput');

    if (!billId) return showNotification("Invalid Bill", "error");
    if (!refVal) return showNotification("Please enter Transaction Reference / UTR ID", "error");

    const formData = new FormData();
    formData.append('bill_id', billId);
    formData.append('proof_ref', refVal);
    if (photoInput && photoInput.files.length > 0) {
        formData.append('proof_photo', photoInput.files[0]);
    }

    try {
        const response = await fetch('/api/tenant/submit-proof', {
            method: 'POST',
            headers: {
                'X-Room-No': window.currentTenant.room_no,
                'X-Mobile-No': window.currentTenant.mobile_number
            },
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to submit proof");
        }

        showNotification("Payment proof submitted for verification!", "success");
        closeTenantProofModal();
        loadTenantLedger();
    } catch (e) {
        showNotification(e.message || "Submission failed", "error");
    }
}

async function loadTenantMaintenanceTasks() {
    const listDiv = document.getElementById('tenantMaintenanceList');
    if (!listDiv) return;

    try {
        const response = await fetch('/api/tenant/maintenance', {
            headers: {
                'X-Room-No': window.currentTenant.room_no,
                'X-Mobile-No': window.currentTenant.mobile_number
            }
        });
        const tasks = await response.json() || [];

        if (tasks.length === 0) {
            listDiv.innerHTML = `
                <div class="empty-state" style="padding: 2rem 1rem;">
                    <i data-lucide="wrench" style="width: 32px; height: 32px; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                    <p style="font-size: 0.75rem; font-weight: 600;">No active tickets found.</p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        listDiv.innerHTML = tasks.map(t => {
            const statusColor = t.status === 'Resolved' ? 'var(--success)' : (t.status === 'In Progress' ? 'var(--info)' : 'var(--danger)');
            const statusBg = t.status === 'Resolved' ? 'var(--bg-success-light)' : (t.status === 'In Progress' ? 'var(--bg-info-light)' : 'var(--bg-danger-light)');

            return `
                <div class="tenant-row" style="padding: 1rem; border: 1.5px solid var(--border); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                    <div>
                        <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-main);">${t.title}</div>
                        <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">
                            ${t.category} • Reported: ${t.date_reported}
                        </div>
                    </div>
                    <div>
                        <span class="badge" style="background: ${statusBg}; color: ${statusColor}; border-color: ${statusColor}; font-size: 0.55rem; padding: 2px 6px;">${t.status.toUpperCase()}</span>
                    </div>
                </div>
            `;
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.error(e);
        listDiv.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--danger); font-size:0.75rem;">Failed to load tasks.</p>';
    }
}

async function submitTenantMaintenanceTask() {
    const category = document.getElementById('tenantTaskCat').value;
    const priority = document.getElementById('tenantTaskPriority').value;
    const title = document.getElementById('tenantTaskTitle').value.trim();
    const desc = document.getElementById('tenantTaskDesc').value.trim();

    if (!title) return showNotification("Please enter an issue title", "error");

    try {
        const response = await fetch('/api/tenant/maintenance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Room-No': window.currentTenant.room_no,
                'X-Mobile-No': window.currentTenant.mobile_number
            },
            body: JSON.stringify({ category, priority, title, description: desc })
        });
        if (!response.ok) throw new Error("Failed to submit repair ticket");

        showNotification("Ticket submitted successfully", "success");

        document.getElementById('tenantTaskTitle').value = '';
        document.getElementById('tenantTaskDesc').value = '';

        loadTenantMaintenanceTasks();
    } catch (e) {
        showNotification(e.message || "Failed to submit ticket", "error");
    }
}

function switchTenantSubView(subview) {
    const views = document.querySelectorAll('.tenant-sub-view');
    views.forEach(v => v.classList.add('hidden'));

    const activeView = document.getElementById(`tenantSubView-${subview}`);
    if (activeView) activeView.classList.remove('hidden');

    const btns = document.querySelectorAll('.sub-nav-btn');
    btns.forEach(b => b.classList.remove('active'));

    const activeBtn = document.getElementById(`btnTenant${subview.charAt(0).toUpperCase() + subview.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');
}

window.addEventListener('DOMContentLoaded', () => {
    const room = localStorage.getItem('tenantRoom');
    const mobile = localStorage.getItem('tenantMobile');
    if (room && mobile) {
        fetch('/api/tenant/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_no: room, mobile_number: mobile })
        })
            .then(res => {
                if (res.ok) return res.json();
                throw new Error();
            })
            .then(tenant => {
                window.currentTenant = tenant;
                const overlay = document.getElementById('pinOverlay');
                if (overlay) overlay.classList.add('hidden');
                showTenantPortal();
            })
            .catch(() => {
                localStorage.removeItem('tenantRoom');
                localStorage.removeItem('tenantMobile');
            });
    }
});

function openTenantChangePasswordModal() {
    const overlay = document.getElementById('tenantChangePassOverlay');
    if (!overlay) return;
    document.getElementById('tenantCurrentPass').value = '';
    document.getElementById('tenantNewPass').value = '';
    document.getElementById('tenantConfirmPass').value = '';
    overlay.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeTenantChangePasswordModal() {
    const overlay = document.getElementById('tenantChangePassOverlay');
    if (overlay) overlay.classList.add('hidden');
}

async function submitTenantChangePassword() {
    const currentPass = document.getElementById('tenantCurrentPass').value;
    const newPass = document.getElementById('tenantNewPass').value;
    const confirmPass = document.getElementById('tenantConfirmPass').value;

    if (!currentPass || !newPass) return showNotification("Please enter current and new password", "error");
    if (newPass !== confirmPass) return showNotification("New passwords do not match", "error");
    if (newPass.length < 4) return showNotification("Password must be at least 4 characters", "error");

    try {
        const response = await fetch('/api/tenant/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Room-No': window.currentTenant.room_no,
                'X-Mobile-No': window.currentTenant.mobile_number
            },
            body: JSON.stringify({
                current_password: currentPass,
                new_password: newPass
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Password update failed');
        showNotification('Password updated successfully!', 'success');
        closeTenantChangePasswordModal();
    } catch (e) {
        showNotification(e.message || 'Failed to change password', 'error');
    }
}

async function openTenantDetailModal(tenantId, focusSection = null) {
    const overlay = document.getElementById('tenantDetailOverlay');
    const body = document.getElementById('tenantDetailBody');
    const badge = document.getElementById('tdModalBadge');
    const nameEl = document.getElementById('tdModalName');
    const subEl = document.getElementById('tdModalSub');
    if (!overlay || !body) return;

    if (!window.allTenants || window.allTenants.length === 0) {
        await refreshGlobalTenantCache();
    }

    const tenant = (window.allTenants || []).find(t => t.id === tenantId);
    if (!tenant) return showNotification("Tenant not found", "error");

    overlay.classList.remove('hidden');
    if (badge) badge.innerText = tenant.room_no || 'Unit';
    if (nameEl) nameEl.innerText = tenant.name || 'Tenant Details';
    if (subEl) subEl.innerText = `Mobile: ${tenant.mobile_number || 'N/A'} | Move-in: ${dateOnly(tenant.move_in_date) || 'N/A'}`;

    body.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--text-muted); font-weight: 800;">Loading tenant details & billing history...</div>`;

    let bills = [];
    let docs = [];
    try {
        [bills, docs] = await Promise.all([
            API.request(`/bills/${tenantId}`).catch(() => []),
            fetch(`/api/documents?renter_id=${tenantId}`).then(res => res.ok ? res.json() : []).catch(() => [])
        ]);
    } catch (e) {
        console.error("Failed to load tenant details", e);
    }

    const isWaterMeter = (tenant.water_calc_mode === 'METER');
    const expiryDate = tenant.agreement_expiry_date ? dateOnly(tenant.agreement_expiry_date) : 'Not set';

    const now = new Date();
    let expiryColor = 'var(--text-main)', expiryNote = '';
    if (expiryDate !== 'Not set') {
        const exp = new Date(expiryDate);
        const daysLeft = Math.ceil((exp - now) / 86400000);
        if (daysLeft < 0) { expiryColor = 'var(--danger)'; expiryNote = ` (Expired ${Math.abs(daysLeft)}d ago)`; }
        else if (daysLeft <= 30) { expiryColor = 'var(--warning)'; expiryNote = ` (${daysLeft}d left)`; }
        else { expiryColor = 'var(--success)'; expiryNote = ` (${daysLeft}d left)`; }
    }

    const totalBilled = bills.reduce((s, b) => s + (b.total_amount || 0), 0);
    const totalPaid = bills.reduce((s, b) => s + (b.paid_amount || 0), 0);
    const unpaidBills = bills.filter(b => !b.is_paid).length;
    const fmt = v => currencyFormatter ? currencyFormatter.format(v) : '\u20b9' + Number(v).toFixed(2);

    const infoBlock = (label, value, color = '') =>
        `<div style="padding:0.55rem 0.7rem;background:var(--bg-input);border-radius:9px;border:1px solid var(--border);">
            <div style="font-size:0.58rem;font-weight:800;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px;">${label}</div>
            <div style="font-size:0.8rem;font-weight:900;color:${color || 'var(--text-main)'};word-break:break-word;">${value || '<span style="opacity:0.4;font-style:italic;">Not set</span>'}</div>
        </div>`;

    const statCard = (icon, label, value, bg, color) =>
        `<div style="background:${bg};border-radius:12px;padding:0.8rem 0.9rem;display:flex;align-items:center;gap:0.6rem;">
            <div style="width:32px;height:32px;border-radius:8px;background:${color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <i data-lucide="${icon}" style="width:15px;height:15px;color:${color};"></i>
            </div>
            <div>
                <div style="font-size:0.58rem;font-weight:800;color:${color};text-transform:uppercase;opacity:0.85;">${label}</div>
                <div style="font-size:0.92rem;font-weight:950;color:var(--text-main);line-height:1.1;">${value}</div>
            </div>
        </div>`;

    body.innerHTML = `

        <!-- Quick Stat Row -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:0.65rem;margin-bottom:1.1rem;">
            ${statCard('banknote', 'Monthly Rent', fmt(tenant.base_rent || 0), 'var(--bg-success-light)', 'var(--success)')}
            ${statCard('shield', 'Advance', fmt(tenant.advance_amount || 0), 'var(--bg-card)', 'var(--primary)')}
            ${statCard('alert-triangle', 'Arrears', fmt(tenant.pending_arrears || 0), tenant.pending_arrears > 0 ? 'var(--bg-danger-light)' : 'var(--bg-card)', tenant.pending_arrears > 0 ? 'var(--danger)' : 'var(--text-muted)')}
            ${statCard('receipt', 'Billed', fmt(totalBilled), 'var(--bg-card)', 'var(--info)')}
            ${statCard('check-circle', 'Paid', fmt(totalPaid), 'var(--bg-success-light)', 'var(--success)')}
            ${statCard('clock', 'Unpaid', unpaidBills + ' bill(s)', unpaidBills > 0 ? 'var(--bg-danger-light)' : 'var(--bg-card)', unpaidBills > 0 ? 'var(--danger)' : 'var(--text-muted)')}
        </div>

        <!-- Personal Information -->
        <div id="td-section-contract" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1rem;margin-bottom:0.85rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;padding-bottom:0.6rem;border-bottom:1px solid var(--border);">
                <h4 style="margin:0;font-size:0.78rem;font-weight:900;color:var(--primary);text-transform:uppercase;letter-spacing:0.8px;display:flex;align-items:center;gap:5px;">
                    <i data-lucide="user" style="width:13px;height:13px;"></i> Personal Information
                </h4>
                <button type="button" class="btn btn-secondary btn-sm" onclick="closeTenantDetailModal();showSection('tenants-section');editTenant(${tenant.id});" style="font-size:0.68rem;font-weight:800;padding:3px 9px;">
                    <i data-lucide="edit-3" style="width:11px;height:11px;"></i> Edit
                </button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.55rem;">
                ${infoBlock('Full Name', tenant.name)}
                ${infoBlock('Unit / Room', tenant.room_no)}
                ${infoBlock('Mobile Number', tenant.mobile_number)}
                ${infoBlock('Email Address', tenant.email)}
                ${infoBlock('Occupation', tenant.occupation)}
                ${infoBlock('Aadhar / ID', tenant.aadhar_no)}
                ${infoBlock('Emergency Contact', tenant.emergency_contact)}
                ${infoBlock('Permanent Address', tenant.perm_address)}
            </div>
        </div>

        <!-- Lease & Financial -->
        <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1rem;margin-bottom:0.85rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;padding-bottom:0.6rem;border-bottom:1px solid var(--border);">
                <h4 style="margin:0;font-size:0.78rem;font-weight:900;color:var(--primary);text-transform:uppercase;letter-spacing:0.8px;display:flex;align-items:center;gap:5px;">
                    <i data-lucide="file-signature" style="width:13px;height:13px;"></i> Lease & Financial Details
                </h4>
                <button type="button" class="btn btn-primary btn-sm" onclick="renewTenantAgreementInModal(${tenant.id})" style="font-size:0.68rem;font-weight:800;padding:3px 9px;">
                    <i data-lucide="refresh-cw" style="width:11px;height:11px;"></i> Renew +11 Mos
                </button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0.55rem;">
                ${infoBlock('Move-in Date', dateOnly(tenant.move_in_date))}
                ${infoBlock('Agreement Expiry', expiryDate + expiryNote, expiryColor)}
                ${infoBlock('Base Rent', fmt(tenant.base_rent || 0), 'var(--success)')}
                ${infoBlock('Security Advance', fmt(tenant.advance_amount || 0))}
                ${infoBlock('Pending Arrears', fmt(tenant.pending_arrears || 0), tenant.pending_arrears > 0 ? 'var(--danger)' : 'var(--text-main)')}
                ${infoBlock('Maintenance Charge', fmt(tenant.maint_charge || 0))}
                ${infoBlock('EB Rate / Unit', '\u20b9' + (tenant.eb_unit_price || 9) + '/unit')}
                ${infoBlock('Initial EB Reading', String(tenant.initial_eb || 0))}
                ${infoBlock('Water Mode', isWaterMeter ? 'Meter Based' : 'Fixed Rate')}
                ${isWaterMeter
            ? infoBlock('Water Rate / Unit', '\u20b9' + (tenant.water_unit_price || 0) + '/unit')
            : infoBlock('Fixed Water Charge', fmt(tenant.water_maint || 0))}
                ${infoBlock('Assigned Owner UPI', tenant.assigned_upi)}
            </div>
        </div>

        <!-- Documents Vault -->
        <div id="td-section-vault" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;padding-bottom:0.6rem;border-bottom:1px solid var(--border);">
                <h4 style="margin:0;font-size:0.78rem;font-weight:900;color:var(--primary);text-transform:uppercase;letter-spacing:0.8px;display:flex;align-items:center;gap:5px;">
                    <i data-lucide="folder-lock" style="width:13px;height:13px;"></i> Documents (${docs.length})
                </h4>
                <button type="button" class="btn btn-secondary btn-sm" onclick="closeTenantDetailModal();showSection('tenants-section','tenants-vault');toggleUploadForm();setTimeout(()=>{const s=document.getElementById('docRenterId');if(s)s.value='${tenant.id}';},100);" style="font-size:0.68rem;font-weight:800;padding:3px 9px;">
                    <i data-lucide="upload-cloud" style="width:11px;height:11px;"></i> Upload
                </button>
            </div>
            ${docs.length > 0
            ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:0.55rem;">
                    ${docs.map(d => `
                        <div style="padding:0.65rem;border:1px solid var(--border);border-radius:9px;background:var(--bg-input);display:flex;flex-direction:column;gap:0.4rem;">
                            <div style="font-weight:800;font-size:0.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--text-main);" title="${d.file_name}">${d.file_name}</div>
                            <div style="font-size:0.58rem;color:var(--text-muted);font-weight:700;text-transform:uppercase;">${d.file_type || 'DOCUMENT'}</div>
                            <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px dashed var(--border);padding-top:0.35rem;">
                                <span style="font-size:0.58rem;color:var(--text-muted);">${d.upload_date ? new Date(d.upload_date).toLocaleDateString('en-IN') : ''}</span>
                                <a href="${d.file_path}" target="_blank" class="btn btn-secondary btn-icon-sm" style="font-size:0.62rem;text-decoration:none;" title="View">
                                    <i data-lucide="external-link" style="width:11px;height:11px;"></i>
                                </a>
                            </div>
                        </div>`).join('')}
                   </div>`
            : '<div style="text-align:center;padding:0.85rem;color:var(--text-muted);font-size:0.75rem;font-weight:700;">No documents uploaded yet.</div>'}
        </div>
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();

    const focusId = focusSection === 'vault' ? 'td-section-vault'
            : focusSection === 'contract' ? 'td-section-contract'
                : null;
    if (focusId) {
        setTimeout(() => {
            const el = document.getElementById(focusId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                el.style.transition = 'box-shadow 0.3s ease';
                el.style.boxShadow = '0 0 0 2px var(--primary)';
                setTimeout(() => el.style.boxShadow = 'none', 1500);
            }
        }, 150);
    }
}



function closeTenantDetailModal() {
    const overlay = document.getElementById('tenantDetailOverlay');
    if (overlay) overlay.classList.add('hidden');
}

async function renewTenantAgreementInModal(tenantId) {
    try {
        const res = await API.request(`/renters/${tenantId}/renew-agreement`, { method: 'POST' });
        if (res && res.success) {
            showNotification(res.message || "Agreement renewed for 11 months!", "success");
            await refreshGlobalTenantCache();
            openTenantDetailModal(tenantId);
        }
    } catch (e) {
        showNotification("Failed to renew agreement", "error");
    }
}

// ── Tenant Ledger Modal (dedicated billing-history popup) ──────────────────
async function openTenantLedgerModal(tenantId) {
    const overlay = document.getElementById('tenantLedgerOverlay');
    const body = document.getElementById('tenantLedgerBody');
    const strip = document.getElementById('tlSummaryStrip');
    const title = document.getElementById('tlModalTitle');
    const sub = document.getElementById('tlModalSub');
    if (!overlay || !body) return;

    // Find tenant from cache
    if (!window.allTenants || window.allTenants.length === 0) {
        await refreshGlobalTenantCache();
    }
    const tenant = (window.allTenants || []).find(t => t.id === tenantId);
    if (!tenant) return showNotification("Tenant not found", "error");

    // Show overlay immediately with loader
    overlay.classList.remove('hidden');
    if (title) title.innerText = `${tenant.name} — Payment Ledger`;
    if (sub) sub.innerText = `Unit ${tenant.room_no}  •  📱 ${tenant.mobile_number || 'N/A'}`;
    if (strip) strip.innerHTML = '';
    body.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted);font-weight:800;">Loading billing history...</div>`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Load bills
    let bills = [];
    try {
        bills = await API.request(`/bills/${tenantId}`).catch(() => []) || [];
    } catch (e) { console.error("Ledger load failed", e); }

    const fmt = v => currencyFormatter ? currencyFormatter.format(v) : '₹' + Number(v).toFixed(2);

    // Summary numbers
    const totalBilled = bills.reduce((s, b) => s + (b.total_amount || 0), 0);
    const totalPaid = bills.reduce((s, b) => s + (b.paid_amount || 0), 0);
    const totalDue = bills.filter(b => !b.is_paid).reduce((s, b) => s + (b.total_amount || 0), 0);
    const arrears = tenant.pending_arrears || 0;

    // Summary strip
    const stripItem = (label, value, color) =>
        `<div style="flex:1;min-width:110px;padding:0.9rem 1.1rem;border-right:1px solid var(--border);text-align:center;background:var(--bg-card);">
            <div style="font-size:0.6rem;font-weight:850;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.6px;">${label}</div>
            <div style="font-size:1.15rem;font-weight:950;color:${color};margin-top:3px;">${value}</div>
        </div>`;

    if (strip) {
        strip.innerHTML =
            stripItem('Total Billed', fmt(totalBilled), 'var(--text-main)') +
            stripItem('Total Paid', fmt(totalPaid), 'var(--success)') +
            stripItem('Outstanding', fmt(totalDue), totalDue > 0 ? 'var(--danger)' : 'var(--text-muted)') +
            stripItem('Arrears', fmt(arrears), arrears > 0 ? 'var(--danger)' : 'var(--text-muted)') +
            `<div style="flex:1;min-width:110px;padding:0.9rem 1.1rem;text-align:center;background:var(--bg-card);">
                <div style="font-size:0.6rem;font-weight:850;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.6px;">Total Bills</div>
                <div style="font-size:1.15rem;font-weight:950;color:var(--primary);margin-top:3px;">${bills.length}</div>
            </div>`;
    }

    // Billing table
    if (bills.length === 0) {
        body.innerHTML = `
            <div style="text-align:center;padding:3.5rem 1rem;color:var(--text-muted);">
                <i data-lucide="inbox" style="width:48px;height:48px;opacity:0.3;margin-bottom:0.75rem;color:var(--secondary);"></i>
                <div style="font-size:0.95rem;font-weight:800;color:var(--text-main);">No bills generated for this unit yet</div>
                <p style="font-size:0.75rem;margin-top:4px;">Generate monthly bills from the tenant management panel.</p>
            </div>`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
    }

    body.innerHTML = `
        <div style="overflow-x:auto; background:var(--bg-card); border-radius:14px; border:1px solid var(--border); box-shadow:var(--shadow-sm);">
            <table style="width:100%;border-collapse:collapse;font-size:0.82rem;table-layout:auto;">
                <thead>
                    <tr style="background:var(--bg-input);text-align:left;position:sticky;top:0;z-index:1;border-bottom:1.5px solid var(--border);">
                        <th style="padding:10px 12px;font-weight:900;font-size:0.65rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;">Month</th>
                        <th style="padding:10px 12px;font-weight:900;font-size:0.65rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;">EB Readings</th>
                        <th style="padding:10px 12px;font-weight:900;font-size:0.65rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;">Rent</th>
                        <th style="padding:10px 12px;font-weight:900;font-size:0.65rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;">Water</th>
                        <th style="padding:10px 12px;font-weight:900;font-size:0.65rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;">Total Amount</th>
                        <th style="padding:10px 12px;font-weight:900;font-size:0.65rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;">Paid Amount</th>
                        <th style="padding:10px 12px;font-weight:900;font-size:0.65rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;">Payment Date</th>
                        <th style="padding:10px 12px;font-weight:900;font-size:0.65rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;">Status</th>
                        <th style="padding:10px 12px;text-align:right;font-weight:900;font-size:0.65rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:0.5px;">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${bills.map(b => {
        const ebUnits = Math.max(0, b.curr_eb_reading - b.prev_eb_reading).toFixed(1);
        const statusBadge = b.is_paid === 1
            ? `<span class="badge badge-success" style="font-size:0.62rem;white-space:nowrap;padding:4px 8px;"><i data-lucide="check-circle" style="width:10px;height:10px;"></i> PAID</span>`
            : (b.proof_status === 'PENDING'
                ? `<span class="badge badge-warning" style="font-size:0.62rem;white-space:nowrap;padding:4px 8px;"><i data-lucide="clock" style="width:10px;height:10px;"></i> PENDING</span>`
                : `<span class="badge badge-danger" style="font-size:0.62rem;white-space:nowrap;padding:4px 8px;"><i data-lucide="alert-circle" style="width:10px;height:10px;"></i> UNPAID</span>`);
        const rowBg = !b.is_paid && b.proof_status !== 'PENDING' ? 'background:var(--bg-danger-light, rgba(239,68,68,0.04));' : '';
        return `<tr style="border-bottom:1px solid var(--border);${rowBg}transition:background 0.15s ease;">
                            <td style="padding:10px 12px;font-weight:900;color:var(--text-main);white-space:nowrap;">${b.billing_month}</td>
                            <td style="padding:10px 12px;color:var(--text-muted);font-size:0.75rem;white-space:nowrap;">${b.prev_eb_reading} → ${b.curr_eb_reading} <span style="font-size:0.64rem;font-weight:800;color:var(--primary);">(${ebUnits} u)</span></td>
                            <td style="padding:10px 12px;font-weight:700;white-space:nowrap;">${fmt(b.rent_amount || 0)}</td>
                            <td style="padding:10px 12px;font-weight:700;white-space:nowrap;">${fmt(b.water_amount || 0)}</td>
                            <td style="padding:10px 12px;font-weight:950;color:var(--text-main);font-size:0.88rem;white-space:nowrap;">${fmt(b.total_amount)}</td>
                            <td style="padding:10px 12px;font-weight:900;color:var(--success);white-space:nowrap;">${fmt(b.paid_amount || 0)}</td>
                            <td style="padding:10px 12px;color:var(--text-muted);font-size:0.72rem;font-weight:600;white-space:nowrap;">${formatPrintDate(b.payment_date)}</td>
                            <td style="padding:10px 12px;">${statusBadge}</td>
                            <td style="padding:10px 14px;text-align:right;">
                                <div style="display:flex;gap:6px;justify-content:flex-end;align-items:center;">
                                    ${!b.is_paid ? `
                                    <button type="button" class="btn btn-primary btn-sm"
                                        onclick="closeTenantLedgerModal();openHistoryPaymentModal(${b.id}, ${b.total_amount});"
                                        title="Mark Paid" style="padding: 4px 10px; font-size: 0.7rem; font-weight: 800; border-radius: 8px;">
                                        <i data-lucide="credit-card" style="width:12px;height:12px;"></i> Pay
                                    </button>` : ''}
                                    <button type="button" class="btn btn-secondary btn-icon-sm"
                                        onclick="closeTenantLedgerModal();prepareAndShare('bill', ${b.id});"
                                        title="Dispatch Center (WhatsApp, Email, PDF, Print)" style="padding: 4px 8px; border-radius: 8px;">
                                        <i data-lucide="send" style="width:14px;height:14px;color:var(--primary);"></i>
                                    </button>
                                    <button type="button" class="btn btn-danger btn-icon-sm"
                                        onclick="deleteLedgerBill(${b.id}, ${tenant.id})"
                                        title="Delete Bill" style="padding: 4px 8px; border-radius: 8px;">
                                        <i data-lucide="trash-2" style="width:14px;height:14px;"></i>
                                    </button>
                                </div>
                            </td>
                        </tr>`;
    }).join('')}
                </tbody>
            </table>
        </div>
        ${arrears > 0 ? `
            <div style="margin-top:1rem;padding:0.75rem 1rem;background:var(--bg-danger-light,rgba(239,68,68,0.08));border:1px solid var(--danger);border-radius:10px;display:flex;align-items:center;gap:0.6rem;">
                <i data-lucide="alert-triangle" style="width:16px;height:16px;color:var(--danger);flex-shrink:0;"></i>
                <span style="font-size:0.78rem;font-weight:800;color:var(--danger);">Pending Arrears: ${fmt(arrears)} — not included in any bill above.</span>
            </div>` : ''}
    `;

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeTenantLedgerModal() {
    const overlay = document.getElementById('tenantLedgerOverlay');
    if (overlay) overlay.classList.add('hidden');
}

async function deleteLedgerBill(billId, renterId) {
    if (!confirm("Are you sure you want to delete this bill record? This will revert any arrears added to tenant balance.")) return;
    try {
        await API.bills.delete(billId);
        showNotification("Bill deleted successfully", "success");
        openTenantLedgerModal(renterId);
        loadDashboardStats();
    } catch (e) {
        showNotification(e.message || "Failed to delete bill", "error");
    }
}

/* ===== PROPERTY UNITS MANAGEMENT ===== */
let propertyUnits = [];

async function loadPropertyUnits() {
    try {
        const units = await API.units.getAll();
        propertyUnits = units || [];
        renderPropertyUnitsTable();
        populateUnitDropdowns();
    } catch (err) {
        console.error("Failed to load property units:", err);
    }
}

let editUnitMode = false;
let editUnitId = null;

function renderPropertyUnitsTable() {
    const tbody = document.getElementById('propertyUnitsTableBody');
    if (!tbody) return;

    if (!propertyUnits || propertyUnits.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">No units configured yet. Click "Add Unit / Room" to create one.</td></tr>`;
        return;
    }

    tbody.innerHTML = propertyUnits.map(u => {
        const statusBadge = u.is_occupied === 1
            ? `<span class="badge badge-warning" style="font-size: 0.65rem;">OCCUPIED</span>`
            : `<span class="badge badge-success" style="font-size: 0.65rem;">AVAILABLE</span>`;
        const termsDisplay = u.agreement_terms ? u.agreement_terms : '<span style="color:var(--text-muted);font-style:italic;">Default Property Terms</span>';
        return `<tr style="border-bottom: 1px solid var(--border);">
            <td style="padding: 10px; font-weight: 850; color: var(--text-main);">${u.unit_name}</td>
            <td style="padding: 10px; font-weight: 700; color: var(--text-muted);">${u.floor || '—'}</td>
            <td style="padding: 10px; font-weight: 800; color: var(--primary);">₹${u.default_rent ? u.default_rent.toLocaleString('en-IN') : '0'}</td>
            <td style="padding: 10px; font-weight: 800; color: var(--text-main);">₹${u.default_maint ? u.default_maint.toLocaleString('en-IN') : '0'}</td>
            <td style="padding: 10px; font-size: 0.78rem; max-width: 220px; word-break: break-word;">${termsDisplay}</td>
            <td style="padding: 10px;">${statusBadge}</td>
            <td style="padding: 10px; text-align: right;">
                <button type="button" class="btn btn-secondary btn-icon-sm" onclick="editUnit(${u.id})" title="Edit Unit Details" style="margin-right: 4px; border-radius: 6px;">
                    <i data-lucide="edit-3" style="width: 14px; height: 14px; color: var(--warning);"></i>
                </button>
                <button type="button" class="btn btn-danger btn-icon-sm" onclick="deleteUnit(${u.id}, '${u.unit_name}')" title="Delete Unit" style="border-radius: 6px;">
                    <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                </button>
            </td>
        </tr>`;
    }).join('');

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function populateUnitDropdowns() {
    const select = document.getElementById('tRoom');
    if (!select) return;

    const currentVal = select.value;
    let html = `<option value="">Select Unit / Room...</option>`;

    propertyUnits.forEach(u => {
        const occupiedText = u.is_occupied === 1 ? ' (Occupied)' : '';
        html += `<option value="${u.unit_name}">${u.unit_name} - ${u.floor || 'Floor N/A'}${occupiedText}</option>`;
    });

    select.innerHTML = html;
    if (currentVal) select.value = currentVal;
}

function onUnitSelectionChange(unitName) {
    if (!unitName) return;
    const unit = propertyUnits.find(u => u.unit_name === unitName);
    if (!unit) return;

    const rentInput = document.getElementById('tRent');
    const maintInput = document.getElementById('tMaintCharge');

    if (rentInput && unit.default_rent > 0) rentInput.value = unit.default_rent;
    if (maintInput && unit.default_maint > 0) maintInput.value = unit.default_maint;
}

function showAddUnitModal() {
    editUnitMode = false;
    editUnitId = null;

    const titleEl = document.getElementById('unitModalTitle');
    const submitBtn = document.getElementById('unitModalSubmitBtn');
    if (titleEl) titleEl.innerHTML = '<i data-lucide="door-open"></i> Add New Property Unit';
    if (submitBtn) submitBtn.innerText = 'Create Unit';

    const nameInput = document.getElementById('uUnitName');
    const floorInput = document.getElementById('uFloor');
    const rentInput = document.getElementById('uDefaultRent');
    const maintInput = document.getElementById('uDefaultMaint');
    const termsInput = document.getElementById('uAgreementTerms');

    if (nameInput) nameInput.value = '';
    if (floorInput) floorInput.value = '';
    if (rentInput) rentInput.value = '0';
    if (maintInput) maintInput.value = '0';
    if (termsInput) termsInput.value = '';

    const modal = document.getElementById('unitModal');
    if (modal) modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function editUnit(id) {
    const unit = propertyUnits.find(u => u.id === id);
    if (!unit) return showNotification("Unit details not found", "error");

    editUnitMode = true;
    editUnitId = id;

    const titleEl = document.getElementById('unitModalTitle');
    const submitBtn = document.getElementById('unitModalSubmitBtn');
    if (titleEl) titleEl.innerHTML = '<i data-lucide="edit-3"></i> Edit Property Unit';
    if (submitBtn) submitBtn.innerText = 'Update Unit';

    const nameInput = document.getElementById('uUnitName');
    const floorInput = document.getElementById('uFloor');
    const rentInput = document.getElementById('uDefaultRent');
    const maintInput = document.getElementById('uDefaultMaint');
    const termsInput = document.getElementById('uAgreementTerms');

    if (nameInput) nameInput.value = unit.unit_name || '';
    if (floorInput) floorInput.value = unit.floor || '';
    if (rentInput) rentInput.value = unit.default_rent || 0;
    if (maintInput) maintInput.value = unit.default_maint || 0;
    if (termsInput) termsInput.value = unit.agreement_terms || '';

    const modal = document.getElementById('unitModal');
    if (modal) modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeAddUnitModal() {
    const modal = document.getElementById('unitModal');
    if (modal) modal.classList.add('hidden');
}

async function saveUnitForm() {
    const nameInput = document.getElementById('uUnitName');
    const floorInput = document.getElementById('uFloor');
    const rentInput = document.getElementById('uDefaultRent');
    const maintInput = document.getElementById('uDefaultMaint');
    const termsInput = document.getElementById('uAgreementTerms');

    const unit_name = nameInput ? nameInput.value.trim() : '';
    if (!unit_name) {
        showNotification("Unit name is required", "error");
        return;
    }

    const payload = {
        unit_name,
        floor: floorInput ? floorInput.value.trim() : '',
        default_rent: rentInput ? parseFloat(rentInput.value) || 0 : 0,
        default_maint: maintInput ? parseFloat(maintInput.value) || 0 : 0,
        agreement_terms: termsInput ? termsInput.value.trim() : ''
    };

    try {
        if (editUnitMode && editUnitId) {
            await API.units.update(editUnitId, payload);
            showNotification(`Unit ${unit_name} updated successfully!`, "success");
        } else {
            await API.units.create(payload);
            showNotification(`Unit ${unit_name} created successfully!`, "success");
        }

        closeAddUnitModal();
        loadPropertyUnits();
    } catch (err) {
        showNotification(err.message || "Failed to save unit", "error");
    }
}

async function deleteUnit(id, name) {
    if (!confirm(`Are you sure you want to delete unit "${name}"?`)) return;
    try {
        await API.units.delete(id);
        showNotification(`Unit ${name} deleted`, "success");
        loadPropertyUnits();
    } catch (err) {
        showNotification(err.message || "Failed to delete unit", "error");
    }
}

async function loadSettingsTenantAccounts() {
    const tbody = document.getElementById('settingsTenantAccountsBody');
    if (!tbody) return;

    try {
        const renters = await API.tenants.getAll();
        if (!renters || renters.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1.5rem; color: var(--text-muted);">No active tenants registered.</td></tr>`;
            return;
        }

        tbody.innerHTML = renters.map(r => {
            const defaultPass = getDefaultTenantPass(r.name, r.mobile_number);
            const userEmail = r.email ? `<br><span style="font-size: 0.72rem; color: var(--text-muted);">${r.email}</span>` : '';

            return `
                <tr style="border-bottom: 1px solid var(--border);">
                    <td style="padding: 10px; font-weight: 850; color: var(--primary);">Unit ${r.room_no}</td>
                    <td style="padding: 10px; font-weight: 800; color: var(--text-main);">${r.name}</td>
                    <td style="padding: 10px; font-weight: 700; color: var(--text-muted);">+91 ${r.mobile_number || 'N/A'}${userEmail}</td>
                    <td style="padding: 10px; font-family: monospace; font-weight: 800; color: var(--success);">${defaultPass}</td>
                    <td style="padding: 10px; text-align: right;">
                        <button type="button" class="btn btn-secondary btn-icon-sm" onclick="openAdminTenantPasswordModal(${r.id}, '${r.name.replace(/'/g, "\\'")}', '${r.room_no}')" title="Set Custom Password" style="border-radius: 6px; color: var(--primary);">
                            <i data-lucide="key" style="width: 15px; height: 15px;"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (err) {
        console.error("Failed to load tenant accounts for settings:", err);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 1.5rem; color: var(--danger);">Failed to load tenant credentials.</td></tr>`;
    }
}

function getDefaultTenantPass(name, mobile) {
    if (!name) return 'rb1234';
    const cleanName = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanMobile = (mobile || '').replace(/[^0-9]/g, '');
    const namePart = cleanName.substring(0, 4);
    const mobilePart = cleanMobile.length >= 4 ? cleanMobile.slice(-4) : '1234';
    return (namePart + mobilePart) || 'rb1234';
}

function openAdminTenantPasswordModal(id, name, roomNo) {
    const hiddenId = document.getElementById('adminTenantPassRenterId');
    const subLabel = document.getElementById('adminTenantPassSub');
    const passInput = document.getElementById('adminTenantNewPass');

    if (hiddenId) hiddenId.value = id;
    if (subLabel) subLabel.innerText = `Set custom portal password for ${name} (Unit ${roomNo})`;
    if (passInput) passInput.value = '';

    const modal = document.getElementById('adminTenantPasswordModal');
    if (modal) modal.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeAdminTenantPasswordModal() {
    const modal = document.getElementById('adminTenantPasswordModal');
    if (modal) modal.classList.add('hidden');
}

async function submitAdminSetTenantPassword() {
    const hiddenId = document.getElementById('adminTenantPassRenterId');
    const passInput = document.getElementById('adminTenantNewPass');

    const id = hiddenId ? hiddenId.value : null;
    const password = passInput ? passInput.value.trim() : '';

    if (!id || !password) {
        return showNotification("Password is required", "error");
    }

    try {
        const res = await API.tenants.updatePassword(id, password);
        showNotification(res.message || "Tenant password updated successfully!", "success");
        closeAdminTenantPasswordModal();
        loadSettingsTenantAccounts();
    } catch (err) {
        showNotification(err.message || "Failed to update tenant password", "error");
    }
}
