async function loadTenants() {
    const listDiv = document.getElementById('tenantList');
    if (!listDiv) return;
    listDiv.innerHTML = '<p style="text-align:center; padding:2rem;">Syncing tenants...</p>';
    try {
        const tenants = await API.tenants.getAll();
        if (!tenants || tenants.length === 0) {
            listDiv.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="info"></i>
                    <p>No active units available for billing</p>
                </div>`;
            lucide.createIcons();
            return;
        }
        listDiv.innerHTML = '';
        tenants.forEach(t => listDiv.appendChild(createTenantCard(t)));
        lucide.createIcons();
    } catch (err) { showNotification("Failed to load list", "error"); }
}

function createTenantCard(t) {
    const card = document.createElement('div');
    card.className = 'tenant-row';
    const currentMonthStr = new Date().toISOString().slice(0, 7); // YYYY-MM
    card.innerHTML = `
        <div class="tenant-header" onclick="toggleBilling(${t.id})">
            <div style="display: flex; flex-direction: column; gap: 4px; flex: 1;">
                <div style="font-weight: 900; font-size: 1.1rem; color: var(--text-main); letter-spacing: -0.01em;">${t.name}</div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.7rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">${currencyFormatter.format(t.base_rent)}</span>
                    <span style="width: 3px; height: 3px; border-radius: 50%; background: var(--border);"></span>
                    <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Standard Unit</span>
                    ${t.pending_arrears > 0 ? `
                        <span style="width: 3px; height: 3px; border-radius: 50%; background: var(--border);"></span>
                        <span style="font-size: 0.7rem; font-weight: 900; color: var(--danger); text-transform: uppercase; background: #ffebee; padding: 2px 6px;">Arrears: ${currencyFormatter.format(t.pending_arrears)}</span>
                    ` : ''}
                </div>
            </div>
            <div style="display: flex; align-items: center; gap: 1.25rem;">
                <div class="room-badge">${t.room_no}</div>
                <div class="action-icon" id="icon-${t.id}" style="color: var(--secondary); opacity: 0.4;"><i data-lucide="chevron-down" width="24" height="24"></i></div>
            </div>
        </div>
        <div id="billing-${t.id}" class="billing-controls hidden">
            <div class="billing-inputs" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                <div class="input-group" style="margin:0;"><label>Billing Month</label><input type="month" id="month-${t.id}" value="${currentMonthStr}"></div>
                <div class="input-group" style="margin:0;"><label>Extra Charges</label><input type="number" id="others-${t.id}" value="0"></div>
                <div class="input-group" style="margin:0;"><label>Prev EB Reading</label><input type="number" id="prev-eb-${t.id}" step="0.01" style="font-weight: 400;"></div>
                <div class="input-group" style="margin:0;"><label>Curr EB Reading</label><input type="number" id="eb-${t.id}" placeholder="Reading" step="0.01" style="font-weight: 800; color: var(--primary);"></div>
                <div class="input-group" style="grid-column: 1 / -1; margin:0;"><label>Notes / Remarks</label><input type="text" id="notes-${t.id}" placeholder="Optional notes"></div>
            </div>
            <div style="display: flex; gap: 0.75rem; margin-top: 1.25rem;">
                <button class="btn btn-primary" onclick="generateBill(${t.id})" style="flex: 1; height: 50px;"><i data-lucide="plus-circle" width="18" height="18"></i> Generate Bill</button>
            </div>
        </div>`;
    return card;
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
    const notes = document.getElementById(`notes-${id}`).value;
    const monthInput = document.getElementById(`month-${id}`).value;

    if (isNaN(currEB)) return showNotification("Fill required current EB reading", "error");
    if (isNaN(prevEB)) return showNotification("Fill required previous EB reading", "error");
    if (!monthInput) return showNotification("Please select a billing month", "error");

    if (currEB < prevEB) {
        if (!confirm("Current reading is lower than previous. Proceed anyway?")) return;
    }

    // Format month: 2026-03 -> March 2026
    const date = new Date(monthInput + '-01');
    const formattedMonth = date.toLocaleString('default', { month: 'long', year: 'numeric' });

    try {
        const result = await API.bills.create({ 
            renter_id: id, 
            curr_eb_reading: currEB, 
            prev_eb_reading: prevEB, 
            others: others, 
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
