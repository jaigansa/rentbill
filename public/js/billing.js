let allBillingTenants = [];
let currentBillingFilter = 'all';

async function loadTenants() {
    const listDiv = document.getElementById('tenantList');
    if (!listDiv) return;
    listDiv.innerHTML = '';
    try {
        allBillingTenants = await API.tenants.getAll();
        await renderBillingList();
    } catch (err) { showNotification("Failed to load list", "error"); }
}

async function filterBilling(mode) {
    currentBillingFilter = mode;
    document.getElementById('filterBillAll').classList.toggle('active', mode === 'all');
    document.getElementById('filterBillPending').classList.toggle('active', mode === 'pending');
    await renderBillingList();
}

async function renderBillingList() {
    const listDiv = document.getElementById('tenantList');
    if (!listDiv) return;

    let filtered = allBillingTenants;
    if (currentBillingFilter === 'pending') {
        listDiv.innerHTML = '';
        try {
            const tasks = await API.bills.getPendingBills();
            const pendingIds = new Set(tasks.map(t => t.renter_id));
            filtered = allBillingTenants.filter(t => t.pending_arrears > 0 || pendingIds.has(t.id));
        } catch (e) {
            console.error("Failed to fetch pending tasks for filter", e);
            filtered = allBillingTenants.filter(t => t.pending_arrears > 0);
        }
    }

    if (filtered.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state">
                <i data-lucide="check-circle"></i>
                <p>${currentBillingFilter === 'all' ? 'No active units found' : 'No units with pending actions'}</p>
            </div>`;
        lucide.createIcons();
        return;
    }

    listDiv.innerHTML = '';
    filtered.forEach(t => listDiv.appendChild(createTenantCard(t)));
    lucide.createIcons();
}

function createTenantCard(t) {
    const card = document.createElement('div');
    card.className = 'tenant-row';
    
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const defaultMonthStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    
    card.innerHTML = `
        <div class="tenant-header" onclick="toggleBilling(${t.id})" style="padding: 1.25rem 1.5rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; cursor: pointer; flex-wrap: wrap;">
            <div style="display: flex; align-items: center; gap: 1.25rem; flex: 1; min-width: 200px;">
                <div class="room-badge">${t.room_no}</div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-weight: 700; font-size: 1.05rem; color: var(--text-main); line-height: 1.2;">${t.name}</div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span class="badge badge-info" style="font-size: 0.65rem;">Rent: ${currencyFormatter.format(t.base_rent)}</span>
                        ${t.pending_arrears > 0 ? `
                            <span class="badge badge-danger" style="font-size: 0.65rem;">Arrears: ${currencyFormatter.format(t.pending_arrears)}</span>
                        ` : ''}
                    </div>
                </div>
            </div>
            <div class="action-icon" id="icon-${t.id}" style="color: var(--secondary); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; margin-left: auto;">
                <i data-lucide="chevron-down"></i>
            </div>
        </div>
        
        <div id="billing-${t.id}" class="billing-controls hidden" style="padding: 1.5rem; border-top: 1px solid var(--border); background: var(--bg-main);">
            <div style="margin-bottom: 2rem;">
                <h4 style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: var(--secondary); margin-bottom: 1.5rem; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.5rem;">
                    <i data-lucide="calculator" style="width: 14px;"></i> Billing Computation
                </h4>
                <div class="billing-inputs" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem;">
                    <div class="input-group"><label>Service Month</label><input type="month" id="month-${t.id}" value="${defaultMonthStr}"></div>
                    <div class="input-group"><label>Prev Reading</label><input type="number" id="prev-eb-${t.id}" step="0.01" oninput="updateLiveTotal(${t.id})"></div>
                    <div class="input-group"><label>Curr Reading</label><input type="number" id="eb-${t.id}" placeholder="Enter reading" step="0.01" oninput="updateLiveTotal(${t.id})"></div>
                    <div class="input-group"><label>Extra Charges</label><input type="number" id="others-${t.id}" value="0" oninput="updateLiveTotal(${t.id})"></div>
                    <div class="input-group"><label>Waiver / Disc</label><input type="number" id="discount-${t.id}" value="0" oninput="updateLiveTotal(${t.id})"></div>
                    <div class="input-group"><label>Internal Note</label><input type="text" id="notes-${t.id}" placeholder="Not visible to tenant"></div>
                </div>
            </div>

            <div class="grid-layout" style="align-items: start; gap: 1.5rem;">
                <!-- Live Total Preview -->
                <div id="live-preview-${t.id}" class="card" style="padding: 1.5rem; background: var(--bg-card); border-color: var(--primary); box-shadow: var(--shadow-lg);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px dashed var(--border); padding-bottom: 0.75rem;">
                        <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; display: flex; align-items: center; gap: 4px;">
                            <span style="width: 6px; height: 6px; background: var(--primary); border-radius: 50%; display: inline-block;"></span> Draft Total
                        </span>
                        <span id="total-val-${t.id}" style="font-size: 1.75rem; font-weight: 900; color: var(--primary);">${currencyFormatter.format(t.base_rent + t.water_maint + t.pending_arrears)}</span>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <div class="math-row"><span>Monthly Rent</span><span>${currencyFormatter.format(t.base_rent)}</span></div>
                        <div class="math-row"><span>Water/Maint</span><span>${currencyFormatter.format(t.water_maint)}</span></div>
                        <div class="math-row" id="eb-preview-${t.id}"><span>Electricity</span><span>₹0.00</span></div>
                        ${t.pending_arrears > 0 ? `<div class="math-row" style="color: var(--danger);"><span>Arrears</span><span>${currencyFormatter.format(t.pending_arrears)}</span></div>` : ''}
                        <div class="math-row hidden" id="others-preview-row-${t.id}"><span>Additional</span><span id="others-val-${t.id}">₹0.00</span></div>
                        <div class="math-row hidden" id="discount-preview-row-${t.id}" style="color: var(--success);"><span>Discount</span><span id="discount-val-${t.id}">- ₹0.00</span></div>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1rem; height: 100%; justify-content: center;">
                    <button class="btn btn-primary" onclick="generateBill(${t.id})" style="width: 100%; height: 56px; font-size: 1rem;">
                        <i data-lucide="plus-circle"></i> Confirm & Generate Bill
                    </button>
                    <p style="font-size: 0.75rem; color: var(--text-muted); text-align: center; font-weight: 500;">
                        The bill will be saved and available for sharing instantly.
                    </p>
                </div>
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
    const others = parseFloat(document.getElementById(`others-${id}`).value) || 0;
    const discount = parseFloat(document.getElementById(`discount-${id}`).value) || 0;

    const ebUnits = Math.max(0, currEB - prevEB);
    const ebCost = ebUnits * t.eb_unit_price;
    const total = t.base_rent + t.water_maint + ebCost + others + t.pending_arrears - discount;

    document.getElementById(`total-val-${id}`).innerText = currencyFormatter.format(total);
    
    // Update EB details
    const ebEl = document.getElementById(`eb-preview-${id}`);
    ebEl.innerHTML = `<span>Electricity (${ebUnits.toFixed(1)} u x ${t.eb_unit_price})</span> <span>${currencyFormatter.format(ebCost)}</span>`;
    
    // Toggle dynamic rows
    const othersRow = document.getElementById(`others-preview-row-${id}`);
    if (othersRow) {
        othersRow.classList.toggle('hidden', others === 0);
        document.getElementById(`others-val-${id}`).innerText = currencyFormatter.format(others);
    }
    
    const discRow = document.getElementById(`discount-preview-row-${id}`);
    if (discRow) {
        discRow.classList.toggle('hidden', discount === 0);
        document.getElementById(`discount-val-${id}`).innerText = `- ${currencyFormatter.format(discount)}`;
    }
}


function toggleBilling(id) {
    const el = document.getElementById(`billing-${id}`);
    const icon = document.getElementById(`icon-${id}`);
    const isHidden = el.classList.toggle('hidden');
    if (icon) icon.classList.toggle('rotate', !isHidden);
    if (!isHidden) fetchLastEB(id);
}

async function fetchLastEB(id) {
    try {
        const data = await API.bills.getLastEB(id);
        const prevInput = document.getElementById(`prev-eb-${id}`);
        const currInput = document.getElementById(`eb-${id}`);
        if (prevInput) { 
            prevInput.value = data.last_eb;
            prevInput.placeholder = `Last: ${data.last_eb}`;
        }
    } catch (e) { console.error(e); }
}

async function generateBill(id) {
    const currEB = parseFloat(document.getElementById(`eb-${id}`).value);
    const prevEB = parseFloat(document.getElementById(`prev-eb-${id}`).value);
    const others = parseFloat(document.getElementById(`others-${id}`).value) || 0;
    const discount = parseFloat(document.getElementById(`discount-${id}`).value) || 0;
    const notes = document.getElementById(`notes-${id}`).value;
    const monthInput = document.getElementById(`month-${id}`).value;

    if (isNaN(currEB)) return showNotification("Fill required current EB reading", "error");
    if (isNaN(prevEB)) return showNotification("Fill required previous EB reading", "error");
    if (!monthInput) return showNotification("Please select a billing month", "error");

    if (currEB < prevEB) {
        if (!confirm("Current reading is lower than previous. Proceed anyway?")) return;
    }

    // Format month: 2026-03 -> March 2026 (Force en-US locale for backend consistency)
    const date = new Date(monthInput + '-01');
    const formattedMonth = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    try {
        const result = await API.bills.create({ 
            renter_id: id, 
            curr_eb_reading: currEB, 
            prev_eb_reading: prevEB, 
            others: others, 
            discount_amount: discount,
            billing_month: formattedMonth,
            notes: notes 
        });
        showNotification("Bill generated", "success");
        toggleBilling(id); loadActivityLogs(); loadDashboardStats();
        prepareAndShare('bill', result.id);
    } catch (err) { showNotification(err.message, "error"); }
}

async function loadSpecificBilling(renterId, monthName) {
    // Wait for tenants to load if they haven't yet
    await loadTenants();
    
    // Find the month input for this renter
    const monthInput = document.getElementById(`month-${renterId}`);
    if (monthInput) {
        // Convert "March 2026" to "2026-03"
        const date = new Date(monthName + ' 1');
        const yyyymm = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        monthInput.value = yyyymm;
        
        // Open the billing section
        const billingControls = document.getElementById(`billing-${renterId}`);
        if (billingControls && billingControls.classList.contains('hidden')) {
            toggleBilling(renterId);
        }
        
        // Scroll into view
        monthInput.closest('.tenant-row').scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash effect to highlight
        const card = monthInput.closest('.tenant-row');
        card.style.transition = 'background-color 0.5s';
        card.style.backgroundColor = 'var(--primary-light)';
        setTimeout(() => card.style.backgroundColor = '', 1500);
    }
}
