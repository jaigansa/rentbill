async function loadManageTenants() {
    const listDiv = document.getElementById('manageTenantList');
    if (!listDiv) return;
    listDiv.innerHTML = '<p style="text-align:center; padding:1rem;">Syncing...</p>';
    try {
        const tenants = await API.tenants.getAll();
        if (!tenants || tenants.length === 0) {
            listDiv.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="users"></i>
                    <p>No units registered yet</p>
                </div>`;
            lucide.createIcons();
            return;
        }
        listDiv.innerHTML = '<h4 class="card-subtitle" style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 1rem; letter-spacing: 1px;">Active Units</h4>';
        tenants.forEach(t => listDiv.appendChild(UI.renderTenantCard(t, editTenant, markAsVacant)));
        lucide.createIcons();
    } catch (err) { console.error(err); }
}

async function addTenant() {
    const data = {
        name: document.getElementById('tName').value, mobile_number: document.getElementById('tMobile').value,
        email: document.getElementById('tEmail').value, room_no: document.getElementById('tRoom').value,
        aadhar_no: document.getElementById('tAadhar').value, base_rent: parseFloat(document.getElementById('tRent').value) || 0,
        eb_unit_price: parseFloat(document.getElementById('tEbRate').value) || 0, initial_eb: parseFloat(document.getElementById('tInitialEb').value) || 0,
        water_maint: parseFloat(document.getElementById('tWater').value) || 0, advance_amount: parseFloat(document.getElementById('tAdvance').value) || 0,
        move_in_date: document.getElementById('tMoveIn').value, perm_address: document.getElementById('tPermAddr').value,
        emergency_contact: document.getElementById('tEmerg').value, occupation: document.getElementById('tJob').value,
        assigned_upi: document.getElementById('tAssignedUpi').value
    };
    if (!data.name || !data.room_no || !data.assigned_upi || !data.mobile_number) return showNotification("Fill required fields", "error");
    try {
        const result = editMode ? await API.tenants.update(editId, data) : await API.tenants.create(data);
        showNotification("Success", "success");
        if (!editMode && confirm("Registration successful. Send Agreement?")) sendProfessionalAgreement(result.id);
        resetForm(); showSection('billing-module');
    } catch (e) { showNotification("Save failed", "error"); }
}

async function editTenant(id) {
    try {
        const t = await API.tenants.getOne(id);
        editMode = true; editId = id;
        document.getElementById('form-title').innerText = "Update Tenant";
        document.getElementById('mainSubmitBtn').innerText = "Update";
        document.getElementById('formDeleteBtn').classList.remove('hidden');
        document.getElementById('formDeleteBtn').onclick = () => deleteTenant(id);
        document.getElementById('formAgreementBtn').classList.remove('hidden');
        document.getElementById('formAgreementBtn').onclick = () => sendProfessionalAgreement(id);
        showSection('settings-section');
        if (document.getElementById('entrance-form').classList.contains('hidden')) toggleRegForm();
        const mapping = { 'tName': 'name', 'tMobile': 'mobile_number', 'tEmail': 'email', 'tRoom': 'room_no', 'tAadhar': 'aadhar_no', 'tRent': 'base_rent', 'tEbRate': 'eb_unit_price', 'tInitialEb': 'initial_eb', 'tWater': 'water_maint', 'tAdvance': 'advance_amount', 'tMoveIn': 'move_in_date', 'tPermAddr': 'perm_address', 'tEmerg': 'emergency_contact', 'tJob': 'occupation', 'tAssignedUpi': 'assigned_upi' };
        Object.keys(mapping).forEach(f => {
            let val = t[mapping[f]];
            if (f === 'tMoveIn' && val && val.length > 10) val = val.slice(0, 10);
            document.getElementById(f).value = (val !== undefined && val !== null) ? val : '';
        });
    } catch (e) { showNotification("Failed to load tenant", "error"); }
}

function resetForm() {
    editMode = false; editId = null;
    document.getElementById('form-title').innerText = "New Registration";
    document.getElementById('mainSubmitBtn').innerText = "Save Record";
    document.getElementById('formDeleteBtn').classList.add('hidden');
    document.getElementById('formAgreementBtn').classList.add('hidden');
    const fields = ['tName', 'tMobile', 'tEmail', 'tRoom', 'tAadhar', 'tRent', 'tEbRate', 'tInitialEb', 'tWater', 'tAdvance', 'tMoveIn', 'tPermAddr', 'tEmerg', 'tJob', 'tAssignedUpi'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

function toggleRegForm() {
    const el = document.getElementById('entrance-form');
    const isHidden = el.classList.contains('hidden');
    if (isHidden) { if (!editMode) resetForm(); el.classList.remove('hidden'); document.getElementById('regToggleBtn').innerText = "Hide Form"; }
    else { el.classList.add('hidden'); document.getElementById('regToggleBtn').innerText = "Register New Tenant"; resetForm(); }
}

function searchTenants() {
    const input = document.getElementById('searchBar').value.toLowerCase();
    const rows = document.querySelectorAll('#tenantList .tenant-row');
    rows.forEach(row => { const text = row.innerText.toLowerCase(); row.style.display = text.includes(input) ? '' : 'none'; });
}

async function loadArchivedTenants() {
    try {
        const tenants = await API.tenants.getHistory();
        const list = document.getElementById('archivedTenantList');
        if (!list) return;
        list.innerHTML = tenants.length ? tenants.map(t => `
            <div class="tenant-row">
                <div>
                    <div style="font-weight: 800; font-size: 1rem; color: var(--text-muted); text-decoration: line-through;">${t.name}</div>
                    <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Vacated ${new Date(t.move_in_date).toLocaleDateString()}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 1rem;">
                    <div class="room-badge" style="opacity: 0.5; font-style: italic;">${t.room_no}</div>
                    <div style="display: flex; gap: 0.25rem;">
                        <button class="btn btn-secondary btn-icon-sm" onclick="prepareAndShare('clearance', ${t.id})"><i data-lucide="share-2" width="14" height="14"></i></button>
                        <button class="btn btn-secondary btn-icon-sm" onclick="restoreTenant(${t.id})" style="color: var(--success);"><i data-lucide="rotate-ccw" width="14" height="14"></i></button>
                        <button class="btn btn-secondary btn-icon-sm" onclick="deleteTenant(${t.id})" style="color: var(--danger);"><i data-lucide="trash-2" width="14" height="14"></i></button>
                    </div>
                </div>
            </div>`).join('') : '<p style="text-align:center; padding: 2rem; font-size: 0.8rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">No archived records.</p>';
        lucide.createIcons();
    } catch (e) { console.error(e); }
}

async function restoreTenant(id) {
    try { await API.tenants.restore(id); showNotification("Restored", "success"); loadArchivedTenants(); loadManageTenants(); loadDashboardStats(); }
    catch (e) { showNotification(e.message, "error"); }
}

function toggleHistory() { if (!document.getElementById('vacantList').classList.toggle('hidden')) loadArchivedTenants(); }

let pendingDeleteId = null;
async function deleteTenant(id) {
    pendingDeleteId = id;
    document.getElementById('confirmationTitle').innerText = "Delete Permanently";
    document.getElementById('confirmationMessage').innerText = "This will erase all history. Enter Master PIN to authorize.";
    document.getElementById('deletePinModal').classList.remove('hidden');
    document.getElementById('deletePinInput').value = '';
    document.querySelector('#deletePinModal .btn-danger').onclick = confirmActionWithPin;
}

// --- Settlement & Vacant ---
let pendingVacantId = null;
async function markAsVacant(id) {
    pendingVacantId = id;
    try {
        const t = await API.tenants.getOne(id);
        document.getElementById('sAdvance').value = t.advance_amount;
        calcSettlement();
        document.getElementById('settlementModal').classList.remove('hidden');
    } catch (e) { showNotification("Failed to load details", "error"); }
}

function calcSettlement() {
    const adv = parseFloat(document.getElementById('sAdvance').value) || 0;
    const rent = parseFloat(document.getElementById('sRentDue').value) || 0;
    const eb = parseFloat(document.getElementById('sEbDue').value) || 0;
    const rep = parseFloat(document.getElementById('sRepairs').value) || 0;
    const bal = adv - (rent + eb + rep);
    document.getElementById('settlementTotal').innerText = currencyFormatter.format(Math.abs(bal));
    document.getElementById('settlementLabel').innerText = bal >= 0 ? "Total Refund" : "Net Balance Due";
}

function closeSettlementModal() {
    document.getElementById('settlementModal').classList.add('hidden');
    document.getElementById('sRentDue').value = 0; document.getElementById('sEbDue').value = 0;
    document.getElementById('sEbReading').value = ''; document.getElementById('sRepairs').value = 0;
    document.getElementById('sReason').value = ''; pendingVacantId = null;
}

async function processSettlementAndVacant() {
    if (!confirm("Confirm final settlement?")) return;
    const details = {
        advance: parseFloat(document.getElementById('sAdvance').value) || 0,
        ebReading: document.getElementById('sEbReading').value || 'N/A',
        rentDue: parseFloat(document.getElementById('sRentDue').value) || 0,
        ebDue: parseFloat(document.getElementById('sEbDue').value) || 0,
        repairs: parseFloat(document.getElementById('sRepairs').value) || 0,
        reason: document.getElementById('sReason').value || 'None',
        totalRefund: document.getElementById('settlementTotal').innerText,
        refundLabel: document.getElementById('settlementLabel').innerText
    };
    try {
        await API.tenants.markVacant(pendingVacantId);
        showNotification("Unit is now vacant", "success");
        document.getElementById('settlementModal').classList.add('hidden');
        prepareAndShare('clearance', pendingVacantId, details);
        loadManageTenants(); loadDashboardStats();
    } catch (e) { showNotification("Action failed", "error"); }
}

