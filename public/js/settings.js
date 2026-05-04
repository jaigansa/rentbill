let accountEditIndex = null;

async function loadSettings() {
    try {
        const data = await API.system.getSettings();
        appSettings = data;
        const propName = document.getElementById('prop_name');
        const propAddr = document.getElementById('prop_addr');
        const emailUser = document.getElementById('email_user');
        const emailBcc = document.getElementById('email_bcc');
        const srvPort = document.getElementById('server_port');
        
        if (propName) propName.value = data.property_name || '';
        if (propAddr) propAddr.value = data.property_address || '';
        if (emailUser) emailUser.value = data.email_user || '';
        if (emailBcc) emailBcc.value = data.email_bcc || '';
        if (srvPort) srvPort.value = data.server_port || 8080;
        
        renderUnifiedAccounts(data.receiving_accounts || []);
        populateOwnerDropdown(data.receiving_accounts || []);
    } catch (e) { console.error(e); }
}

async function saveReceivingAccount() {
    const name = document.getElementById('acc_name').value.trim();
    const label = document.getElementById('acc_label').value.trim();
    const upi = document.getElementById('acc_upi').value.trim();
    const bank = document.getElementById('acc_bank').value.trim();
    const num = document.getElementById('acc_num').value.trim();
    const ifsc = document.getElementById('acc_ifsc').value.trim();
    
    if (!name || !label) return showNotification("Owner Name and Label are required", "error");
    if (!upi && !bank) return showNotification("Please provide either UPI or Bank details", "error");

    const accounts = appSettings.receiving_accounts || [];
    const accountData = {
        owner_name: name,
        label: label,
        upi: upi,
        bank_name: bank,
        account_number: num,
        ifsc: ifsc
    };

    if (accountEditIndex !== null) {
        accounts[accountEditIndex] = accountData;
    } else {
        accounts.push(accountData);
    }
    
    try {
        await API.system.updateSettings({ receiving_accounts: accounts });
        showNotification(accountEditIndex !== null ? "Account updated" : "Account added", "success");
        cancelAccountEdit();
        loadSettings();
    } catch (e) { showNotification("Failed to save account", "error"); }
}

function editReceivingAccount(index) {
    const acc = appSettings.receiving_accounts[index];
    if (!acc) return;

    accountEditIndex = index;
    document.getElementById('acc_name').value = acc.owner_name || '';
    document.getElementById('acc_label').value = acc.label || '';
    document.getElementById('acc_upi').value = acc.upi || '';
    document.getElementById('acc_bank').value = acc.bank_name || '';
    document.getElementById('acc_num').value = acc.account_number || '';
    document.getElementById('acc_ifsc').value = acc.ifsc || '';

    const btn = document.getElementById('addAccBtn');
    if (btn) btn.innerText = "Update Account Record";
    
    const cancelBtn = document.getElementById('cancelAccEditBtn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    document.getElementById('acc_name').focus();
}

function cancelAccountEdit() {
    accountEditIndex = null;
    ['acc_name', 'acc_label', 'acc_upi', 'acc_bank', 'acc_num', 'acc_ifsc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    const btn = document.getElementById('addAccBtn');
    if (btn) btn.innerText = "Add Account Record";

    const cancelBtn = document.getElementById('cancelAccEditBtn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

function renderUnifiedAccounts(accounts) {
    const container = document.getElementById('unifiedAccountList'); 
    if (!container) return;
    container.innerHTML = '';

    if (!accounts || accounts.length === 0) {
        container.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); padding:1rem; text-align:center;">No receiving accounts added yet.</p>';
        return;
    }

    accounts.forEach((acc, index) => {
        const div = document.createElement('div');
        div.innerHTML = UI.renderUnifiedAccountRow(acc, index);
        container.appendChild(div);
    });
    lucide.createIcons();
}

function populateOwnerDropdown(accounts) {
    const select = document.getElementById('tAssignedUpi');
    if (!select) return;
    const currentVal = select.value;
    
    select.innerHTML = '<option value="">-- Select Receiving Account --</option>';
    accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.owner_name;
        opt.innerText = `${acc.owner_name.toUpperCase()} • ${acc.label.toUpperCase()}`;
        select.appendChild(opt);
    });
    select.value = currentVal;
}

async function deleteReceivingAccount(index) {
    if (!confirm("Remove this account record?")) return;
    const accounts = appSettings.receiving_accounts || [];
    accounts.splice(index, 1);
    try {
        await API.system.updateSettings({ receiving_accounts: accounts });
        showNotification("Account removed", "success");
        loadSettings();
    } catch (e) { showNotification("Failed to remove account", "error"); }
}

async function loadSystemSettings() { await loadSettings(); }

async function saveSystemSettings() {
    const data = {
        property_name: document.getElementById('prop_name').value,
        property_address: document.getElementById('prop_addr').value,
        email_user: document.getElementById('email_user').value,
        email_bcc: document.getElementById('email_bcc').value,
        email_pass: document.getElementById('email_pass').value,
        server_port: parseInt(document.getElementById('server_port').value) || 8080,
        new_pin: document.getElementById('new_master_pin').value
    };
    try {
        const response = await API.system.updateSettings(data);
        if (response.message && response.message.includes("restarting")) {
            showNotification("Port changed! System is restarting. Please wait...", "success");
            setTimeout(() => {
                const newUrl = window.location.protocol + "//" + window.location.hostname + ":" + data.server_port;
                window.location.assign(newUrl);
            }, 5000);
        } else {
            showNotification("Settings updated", "success");
            const pinInput = document.getElementById('new_master_pin');
            if (pinInput) pinInput.value = '';
            // Update global appSettings so branding shows up immediately
            appSettings.property_name = data.property_name;
            appSettings.property_address = data.property_address;
        }
    } catch (e) { showNotification("Failed to update settings", "error"); }
}

async function testSMTPSettings() {
    showNotification("Testing...", "info");
    try {
        await API.system.testEmail();
        showNotification("Test email sent!", "success");
    } catch (e) { showNotification(e.message, "error"); }
}

async function importTenantsCSV(input) {
    if (!input.files[0]) return;
    
    if (!confirm("This will add all units from the CSV to your current directory. Proceed?")) {
        input.value = '';
        return;
    }

    const formData = new FormData();
    formData.append('csv_file', input.files[0]);

    showNotification("Importing records...", "info");
    try {
        const response = await fetch('/api/renters/import', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();
        if (response.ok) {
            showNotification(result.message, "success");
            if (typeof loadManageTenants === 'function') loadManageTenants();
        } else {
            showNotification(result.error || "Import failed", "error");
        }
    } catch (e) {
        showNotification("Network error during import", "error");
        console.error(e);
    } finally {
        input.value = '';
    }
}

async function exportTenantsCSV() {
    showNotification("Exporting directory...", "info");
    try {
        const response = await fetch('/api/renters/export');
        if (!response.ok) throw new Error("Export failed");

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `unit_directory_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        showNotification("Directory exported successfully", "success");
    } catch (e) {
        showNotification("Failed to export directory", "error");
        console.error(e);
    }
}

async function backupDatabase() {
    const filenameInput = document.getElementById('backupFilename');
    const filename = filenameInput ? filenameInput.value.trim() : "rent_backup";
    
    showNotification("Creating backup...", "info");
    try {
        const response = await fetch('/api/db/backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename })
        });

        if (!response.ok) throw new Error("Backup failed");

        // Convert response to blob and download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${new Date().toISOString().slice(0,10)}_${filename}.db`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();

        showNotification("Backup downloaded successfully", "success");
    } catch (e) { 
        showNotification("Failed to create backup", "error");
        console.error(e);
    }
}

async function restoreDatabase() {
    const fileInput = document.getElementById('restoreFile');
    const pinInput = document.getElementById('restorePin');
    
    if (!fileInput.files[0]) return showNotification("Please select a .db file", "error");
    if (!pinInput.value) return showNotification("Enter Master PIN for safety", "error");

    if (!confirm("This will delete all current data and replace it with the backup file. Are you absolutely sure?")) return;

    const formData = new FormData();
    formData.append('backup_file', fileInput.files[0]);
    formData.append('pin', pinInput.value);

    showNotification("Restoring data...", "info");
    try {
        const response = await fetch('/api/db/restore', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            showNotification("Database restored! Reloading...", "success");
            setTimeout(() => window.location.reload(), 2000);
        } else {
            const err = await response.json();
            showNotification(err.error || "Restore failed", "error");
        }
    } catch (e) {
        showNotification("System error during restore", "error");
        console.error(e);
    }
}

async function viewAuditReport() {
    const month = document.getElementById('auditMonth')?.value;
    if (!month) return showNotification("Please select a month", "error");
    
    showNotification("Generating audit...", "info");
    try {
        const data = await API.system.getAuditReport(month);
        const auditContent = document.getElementById('auditContent');
        if (!auditContent) return;

        const filteredLogs = (data.logs || []).filter(l => 
            l.action === 'PAYMENT_RECORDED' || l.action === 'EXPENSE_ADDED'
        );

        let logsHtml = filteredLogs.length > 0 
            ? filteredLogs.map(l => `
                <div style="border-bottom: 1px dashed var(--border); padding: 8px 0; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="font-weight: bold; font-size: 0.75rem; text-transform: uppercase; color: var(--text-main);">${l.action.replace('_', ' ')}</div>
                        <div style="font-size: 0.7rem; color: var(--text-muted);">${l.details}</div>
                    </div>
                    <div style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${l.timestamp.slice(11, 16)}</div>
                </div>`).join('')
            : '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No income or expense records found for this period.</p>';

        auditContent.innerHTML = `
            <div id="printableAudit" style="font-family: var(--font-main), sans-serif; color: #000;">
                <div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 1.5rem; margin-bottom: 2rem;">
                    <h1 style="margin: 0; font-size: 1.8rem; font-weight: 900; letter-spacing: 1px; color: #000; text-transform: uppercase;">Financial Audit Report</h1>
                    <p style="margin: 10px 0; font-weight: 900; background: #000; color: #fff !important; display: inline-block; padding: 5px 20px; text-transform: uppercase; border-radius: 4px; letter-spacing: 1px;">PERIOD: ${new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</p>
                </div>

                <!-- Primary Metrics -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 2rem;">
                    <div style="border: 2px solid #000; border-radius: 8px; padding: 15px; text-align: center; background: #fff;">
                        <div style="font-size: 0.8rem; font-weight: bold; color: #333; text-transform: uppercase; letter-spacing: 1px;">TOTAL INCOME</div>
                        <div style="font-size: 1.5rem; font-weight: 900; color: #000; margin-top: 5px;">${currencyFormatter.format(data.summary.total_paid)}</div>
                    </div>
                    <div style="border: 2px solid #000; border-radius: 8px; padding: 15px; text-align: center; background: #fff;">
                        <div style="font-size: 0.8rem; font-weight: bold; color: #333; text-transform: uppercase; letter-spacing: 1px;">TOTAL EXPENSES</div>
                        <div style="font-size: 1.5rem; font-weight: 900; color: #000; margin-top: 5px;">${currencyFormatter.format(data.summary.total_expenses)}</div>
                    </div>
                </div>

                <div style="margin-bottom: 1.5rem;">
                    <h3 style="font-size: 0.95rem; font-weight: 900; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; text-transform: uppercase; color: #000; letter-spacing: 1px;">Income & Expense Details</h3>
                    <div style="border: 1.5px solid #000; border-radius: 8px; padding: 5px 15px; background: #fff;">
                        ${logsHtml}
                    </div>
                </div>

                <div style="margin-top: 3rem; border-top: 1px solid #000; padding-top: 10px; text-align: center; font-size: 0.7rem; color: #555; font-weight: bold;">
                    THIS DOCUMENT IS A SYSTEM-GENERATED FINANCIAL SUMMARY // RENTBILL PRO
                    <br>GENERATED ON: ${new Date().toLocaleString('en-IN')}
                </div>
            </div>
        `;


        document.getElementById('auditModal')?.classList.remove('hidden');
        lucide.createIcons();
    } catch (e) {
        showNotification("Failed to load audit data", "error");
        console.error(e);
    }
}

function closeAuditModal() {
    document.getElementById('auditModal')?.classList.add('hidden');
}

function printAudit() {
    // Populate branding for print
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RENTBILL PRO';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';
    
    document.querySelectorAll('.auditPrintPropName').forEach(el => el.innerText = propName);
    document.querySelectorAll('.auditPrintPropAddr').forEach(el => el.innerText = propAddr);

    window.print();
}
