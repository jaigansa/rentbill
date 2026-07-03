async function loadManageTenants() {
    const listDiv = document.getElementById('manageTenantList');
    if (!listDiv) return;
    
    populateRegistryPropertyFilter();
    const filter = document.getElementById('registryPropertyFilter')?.value || '';
    
    // Use global cache
    let tenants = window.allTenants || [];
    if (filter) {
        tenants = tenants.filter(t => t.assigned_upi === filter);
    }
    
    if (tenants.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state" style="padding: 4rem 2rem; background: var(--bg-input); border: 2px dashed var(--border); border-radius: 20px; width: 100%;">
                <i data-lucide="users" style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p style="font-weight: 800; color: var(--text-muted); font-size: 1.1rem; margin-bottom: 8px;">No active units found</p>
                <p style="font-size: 0.8rem; color: var(--text-muted); opacity: 0.7; margin-bottom: 1.5rem;">To get started, register your first tenant unit.</p>
                <button class="btn btn-primary btn-sm" onclick="toggleRegForm()" style="border-radius: 8px;">Register First Unit</button>
            </div>`;
        lucide.createIcons();
        return;
    }
    
    listDiv.innerHTML = '<h4 class="card-subtitle" style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 1rem; letter-spacing: 1px;">Active Units</h4>';
    tenants.forEach(t => listDiv.appendChild(UI.renderTenantCard(t, editTenant, markAsVacant)));
    lucide.createIcons();
}

function populateRegistryPropertyFilter() {
    const select = document.getElementById('registryPropertyFilter');
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
            el.style.borderColor = ''; // Reset
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

    const data = {
        name: document.getElementById('tName').value, 
        mobile_number: document.getElementById('tMobile').value,
        email: document.getElementById('tEmail').value, 
        room_no: document.getElementById('tRoom').value,
        aadhar_no: document.getElementById('tAadhar')?.value || '', 
        base_rent: parseFloat(document.getElementById('tRent').value) || 0,
        eb_unit_price: parseFloat(document.getElementById('tEbRate').value) || 0, 
        initial_eb: parseFloat(document.getElementById('tInitialEb').value) || 0,
        water_maint: parseFloat(document.getElementById('tWater').value) || 0, 
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
        await refreshGlobalTenantCache(); // Refresh cache immediately
        if (!editMode && confirm("Registration successful. Print Agreement?")) printProfessionalAgreement(result.id);
        resetForm(); 
        showSection('tenants-section');
        switchSubSection('tenants-section', 'tenants-ledger');
    } catch (e) { showNotification("Save failed", "error"); }
}

async function editTenant(id) {
    if (!id) return showNotification("Invalid Tenant ID", "error");
    
    try {
        console.log("Edit request for ID:", id);
        
        // 1. Try Cache First
        let t = null;
        if (window.allTenants) {
            t = window.allTenants.find(ten => String(ten.id) === String(id));
        }
        
        // 2. Fallback to direct API
        if (!t) {
            console.log("Tenant not in cache, calling API...");
            t = await API.tenants.getOne(id);
        }
        
        if (!t) throw new Error("Record not found in database");
        
        editMode = true; 
        editId = id;
        
        const formTitle = document.getElementById('form-title');
        const submitBtn = document.getElementById('mainSubmitBtn');
        const deleteBtn = document.getElementById('formDeleteBtn');
        const agreementBtn = document.getElementById('formAgreementBtn');
        const regForm = document.getElementById('entrance-form');

        if (formTitle) formTitle.innerText = "Update Unit Profile";
        if (submitBtn) submitBtn.innerText = "Update Record";
        if (deleteBtn) {
            deleteBtn.classList.remove('hidden');
            deleteBtn.onclick = () => deleteTenant(id);
        }
        if (agreementBtn) {
            agreementBtn.classList.remove('hidden');
            agreementBtn.onclick = () => printProfessionalAgreement(id);
        }

        showSection('tenants-section');
        switchSubSection('tenants-section', 'tenants-registry');
        
        if (regForm && regForm.classList.contains('hidden')) toggleRegForm();

        // Populate fields
        const mapping = { 
            'tName': 'name', 'tMobile': 'mobile_number', 'tEmail': 'email', 
            'tAadhar': 'aadhar_no',
            'tRoom': 'room_no', 'tRent': 'base_rent', 
            'tEbRate': 'eb_unit_price', 'tInitialEb': 'initial_eb', 
            'tWater': 'water_maint', 'tAdvance': 'advance_amount', 
            'tMoveIn': 'move_in_date', 'tPermAddr': 'perm_address', 
            'tEmerg': 'emergency_contact', 'tJob': 'occupation', 
            'tAssignedUpi': 'assigned_upi', 'tArrears': 'pending_arrears'
        };

        Object.keys(mapping).forEach(f => {
            const el = document.getElementById(f);
            if (el) {
                let val = t[mapping[f]];
                if (f === 'tMoveIn' && val && val.length > 10) val = val.slice(0, 10);
                el.value = (val !== undefined && val !== null) ? val : '';
            }
        });
        
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

    const fields = ['tName', 'tMobile', 'tEmail', 'tAadhar', 'tRoom', 'tRent', 'tEbRate', 'tInitialEb', 'tWater', 'tAdvance', 'tMoveIn', 'tPermAddr', 'tEmerg', 'tJob', 'tAssignedUpi', 'tArrears'];
    fields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

function toggleRegForm() {
    const el = document.getElementById('entrance-form');
    const isHidden = el.classList.contains('hidden');
    if (isHidden) { if (!editMode) resetForm(); el.classList.remove('hidden'); document.getElementById('regToggleBtn').innerText = "Hide Form"; }
    else { el.classList.add('hidden'); document.getElementById('regToggleBtn').innerText = "Register New Tenant"; resetForm(); }
}

async function loadArchivedTenants() {
    try {
        // Use global cache
        const tenants = window.historyTenants || [];
        
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

// --- Settlement & Vacant ---
let pendingVacantId = null;
let lastEBReading = 0;
let tenantEBUnitPrice = 0;

async function markAsVacant(id) {
    pendingVacantId = id;
    try {
        // Use cache
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

    const adv = parseFloat(document.getElementById('sAdvance').value) || 0;
    const rent = parseFloat(document.getElementById('sRentDue').value) || 0;
    const eb = parseFloat(document.getElementById('sEbDue').value) || 0;
    const rep = parseFloat(document.getElementById('sRepairs').value) || 0;
    const numericBalance = adv - (rent + eb + rep);

    const details = {
        advance: adv,
        ebReading: document.getElementById('sEbReading').value || 'N/A',
        rentDue: rent,
        ebDue: eb,
        repairs: rep,
        reason: document.getElementById('sReason').value || 'None',
        totalRefund: document.getElementById('settlementTotal').innerText,
        refundLabel: document.getElementById('settlementLabel').innerText,
        balance: numericBalance
    };
    try {
        await API.tenants.markVacant({
            id: pendingVacantId,
            refund_amount: details.totalRefund,
            dues_deducted: details.rentDue + details.ebDue,
            repairs_deducted: details.repairs,
            refund_label: details.refundLabel,
            final_balance: numericBalance
        });
        showNotification("Unit is now vacant", "success");
        await refreshGlobalTenantCache(); // Sync cache
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
    input.value = ''; // Reset
}
