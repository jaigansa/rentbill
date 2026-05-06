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

    // 1. Start with all tenants from global cache
    let data = window.allTenants || [];

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

function createTenantCard(t) {
    const card = document.createElement('div');
    card.className = 'tenant-row';
    card.style.marginBottom = '0.5rem';
    
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const defaultMonthStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    
    card.innerHTML = `
        <div class="tenant-header" onclick="toggleBilling(${t.id})" style="padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                <div class="room-badge" style="min-width: 45px; height: 32px; font-size: 0.8rem; border-radius: 8px;">${t.room_no}</div>
                <div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main);">${t.name}</div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                        <span style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Rent: ${currencyFormatter.format(t.base_rent)}</span>
                        ${t.pending_arrears > 0 ? `<span class="badge badge-danger" style="font-size: 0.5rem; padding: 1px 4px; border-radius: 4px;">Arrears: ${currencyFormatter.format(t.pending_arrears)}</span>` : ''}
                    </div>
                </div>
            </div>
            <div id="icon-${t.id}" style="color: var(--secondary); transition: transform 0.2s ease;">
                <i data-lucide="chevron-down" width="18"></i>
            </div>
        </div>
        
        <div id="billing-${t.id}" class="billing-controls hidden" style="padding: 1.5rem; border-top: 1px dashed var(--border); background: var(--bg-main);">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                <div class="input-group"><label>Period</label><input type="month" id="month-${t.id}" value="${defaultMonthStr}"></div>
                <div class="input-group"><label>Prev EB</label><input type="number" id="prev-eb-${t.id}" step="0.01" oninput="updateLiveTotal(${t.id})"></div>
                <div class="input-group"><label>Curr EB</label><input type="number" id="eb-${t.id}" placeholder="Reading" step="0.01" oninput="updateLiveTotal(${t.id})"></div>
                <div class="input-group"><label>Arrears</label><input type="number" id="arrears-${t.id}" value="${t.pending_arrears || 0}" oninput="updateLiveTotal(${t.id})" style="color: var(--danger); font-weight: 800;"></div>
                <div class="input-group"><label>Extra Fee</label><input type="number" id="others-${t.id}" value="0" oninput="updateLiveTotal(${t.id})"></div>
                <div class="input-group"><label>Waiver (-)</label><input type="number" id="discount-${t.id}" value="0" oninput="updateLiveTotal(${t.id})" style="color: var(--success); font-weight: 800;"></div>
            </div>

            <div style="background: var(--bg-card); border: 1.5px solid var(--primary); border-radius: 12px; padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 250px;">
                    <div style="font-size: 0.65rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Calculated Draft Total</div>
                    <div id="total-val-${t.id}" style="font-size: 1.8rem; font-weight: 900; color: var(--text-main);">${currencyFormatter.format(t.base_rent + t.water_maint + t.pending_arrears)}</div>
                    <div id="breakdown-${t.id}" style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; margin-top: 6px; text-transform: uppercase; line-height: 1.4;">
                        Rent: ${currencyFormatter.format(t.base_rent)} + Maint: ${currencyFormatter.format(t.water_maint)} + Arrears: ${currencyFormatter.format(t.pending_arrears)}
                    </div>
                </div>
                <button class="btn btn-primary" onclick="generateBill(${t.id})" style="height: 50px; padding: 0 2rem; font-weight: 900; letter-spacing: 0.5px;">
                    Generate & Share <i data-lucide="send" style="margin-left: 8px; width: 16px;"></i>
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
    const total = t.base_rent + t.water_maint + ebCost + others + arrears - discount;

    document.getElementById(`total-val-${id}`).innerText = currencyFormatter.format(total);
    
    // Update Breakdown Details
    const breakdownEl = document.getElementById(`breakdown-${id}`);
    if (breakdownEl) {
        let text = `Rent: ${currencyFormatter.format(t.base_rent)} + Maint: ${currencyFormatter.format(t.water_maint)}`;
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
    if (!isHidden) fetchLastEB(id);
}

async function fetchLastEB(id) {
    try {
        const data = await API.bills.getLastEB(id);
        const prevInput = document.getElementById(`prev-eb-${id}`);
        if (prevInput) { 
            prevInput.value = data.last_eb;
            prevInput.placeholder = `Last: ${data.last_eb}`;
            updateLiveTotal(id);
        }
    } catch (e) { console.error(e); }
}

async function generateBill(id) {
    const currEB = parseFloat(document.getElementById(`eb-${id}`).value);
    const prevEB = parseFloat(document.getElementById(`prev-eb-${id}`).value);
    const arrears = parseFloat(document.getElementById(`arrears-${id}`).value) || 0;
    const others = parseFloat(document.getElementById('others-'+id).value) || 0;
    const discount = parseFloat(document.getElementById('discount-'+id).value) || 0;
    const monthInput = document.getElementById('month-'+id).value;

    if (isNaN(currEB)) return showNotification("Fill required current EB reading", "error");
    if (isNaN(prevEB)) return showNotification("Fill required previous EB reading", "error");
    if (!monthInput) return showNotification("Please select a period", "error");

    if (currEB < prevEB) {
        if (!confirm("Current reading is lower than previous. Proceed anyway?")) return;
    }

    const date = new Date(monthInput + '-01');
    const formattedMonth = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    try {
        const result = await API.bills.create({ 
            renter_id: id, 
            curr_eb_reading: currEB, 
            prev_eb_reading: prevEB, 
            others: others, 
            discount_amount: discount,
            arrears_included: arrears,
            billing_month: formattedMonth
        });
        showNotification("Bill generated", "success");
        toggleBilling(id);
        
        // Refresh cache and re-render
        await refreshGlobalTenantCache();
        await loadTenants();
        
        prepareAndShare('bill', result.id);
    } catch (err) { showNotification(err.message, "error"); }
}

async function loadSpecificBilling(renterId, monthName) {
    await loadTenants();
    
    const monthInput = document.getElementById(`month-${renterId}`);
    if (monthInput) {
        const date = new Date(monthName + ' 1');
        const yyyymm = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
        monthInput.value = yyyymm;
        
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
