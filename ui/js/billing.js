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
    card.style.marginBottom = '0.75rem';
    
    const now = new Date();
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const defaultMonthStr = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    const todayStr = now.toISOString().split('T')[0];
    
    card.innerHTML = `
        <div class="tenant-header" onclick="toggleBilling(${t.id})" style="padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; cursor: pointer;">
            <div style="display: flex; align-items: center; gap: 1rem; flex: 1;">
                <div class="room-badge" style="min-width: 50px; height: 36px; font-size: 0.9rem; border-radius: 10px; font-weight: 900;">${t.room_no}</div>
                <div>
                    <div style="font-weight: 900; font-size: 1rem; color: var(--text-main);">${t.name}</div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 3px;">
                        <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Rent: ${currencyFormatter.format(t.base_rent)}</span>
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
                <div class="input-group"><label style="font-size: 0.6rem;">Previous Reading</label><input type="number" id="prev-eb-${t.id}" step="0.01" oninput="updateLiveTotal(${t.id})" style="font-weight: 700;"></div>
                <div class="input-group"><label style="font-size: 0.6rem;">Current Reading</label><input type="number" id="eb-${t.id}" placeholder="Reading" step="0.01" oninput="updateLiveTotal(${t.id})" style="font-weight: 900; border-color: var(--primary);"></div>
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

    if (currEB < prevEB) {
        if (!confirm("Current reading is lower than previous. Proceed anyway?")) return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Generating... <i data-lucide="loader-2" class="loading-spin" style="margin-left: 8px; width: 16px;"></i>';
        lucide.createIcons();
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
            billing_month: formattedMonth,
            date_generated: billDateInput
        });
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
