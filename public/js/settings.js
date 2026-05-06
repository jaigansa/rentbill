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

        // Default to current month range for audit
        const fromInput = document.getElementById('auditFromDate');
        const toInput = document.getElementById('auditToDate');
        if (fromInput && toInput && !fromInput.value) {
            const now = new Date();
            fromInput.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
            toInput.value = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
        }
        
        renderUnifiedAccounts(data.receiving_accounts || []);
        populateOwnerDropdown(data.receiving_accounts || []);
    } catch (e) { console.error(e); }
}

function populateOwnerDropdown(accounts) {
    const selects = ['eOwnerName', 'wOwnerName', 'tTaskOwner'];
    selects.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const currentVal = el.value;
        el.innerHTML = '<option value="">-- Select --</option>' + 
            accounts.map(a => `<option value="${a.owner_name}">${a.owner_name}</option>`).join('');
        el.value = currentVal;
    });
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
        showNotification("Account saved", "success");
        cancelAccountEdit();
        loadSettings();
    } catch (e) { showNotification("Failed to save account", "error"); }
}

function renderUnifiedAccounts(accounts) {
    const list = document.getElementById('unifiedAccountList');
    if (!list) return;
    list.innerHTML = accounts.map((acc, index) => `
        <div class="tenant-row" style="padding: 1rem; border-color: var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div>
                    <div style="font-weight: 800; font-size: 0.9rem; color: var(--text-main);">${acc.owner_name}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">${acc.label}</div>
                    <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 8px;">
                        ${acc.upi ? `<span class="badge" style="background: var(--primary-light); color: var(--primary); border: 1px solid var(--primary); font-size: 0.6rem;">UPI: ${acc.upi}</span>` : ''}
                        ${acc.bank_name ? `<span class="badge" style="background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border); font-size: 0.6rem;">${acc.bank_name} - ${acc.account_number}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="editAccount(${index})" class="btn btn-secondary btn-icon-sm"><i data-lucide="edit-2"></i></button>
                    <button onclick="deleteAccount(${index})" class="btn btn-secondary btn-icon-sm" style="color: var(--danger);"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
        </div>
    `).join('');
    lucide.createIcons();
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
    
    document.getElementById('addAccBtn').innerText = "Update Account Record";
    document.getElementById('cancelAccEditBtn').classList.remove('hidden');
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
    document.getElementById('addAccBtn').innerText = "Add Account Record";
    document.getElementById('cancelAccEditBtn').classList.add('hidden');
}

async function deleteAccount(index) {
    if (!confirm("Are you sure? This will remove this receiving account.")) return;
    const accounts = appSettings.receiving_accounts || [];
    accounts.splice(index, 1);
    try {
        await API.system.updateSettings({ receiving_accounts: accounts });
        showNotification("Account removed", "success");
        loadSettings();
    } catch (e) { showNotification("Failed to remove", "error"); }
}

async function saveSystemSettings() {
    const data = {
        property_name: document.getElementById('prop_name').value.trim(),
        property_address: document.getElementById('prop_addr').value.trim(),
        email_user: document.getElementById('email_user').value.trim(),
        email_pass: document.getElementById('email_pass').value,
        email_bcc: document.getElementById('email_bcc').value.trim(),
        server_port: parseInt(document.getElementById('server_port').value),
        new_pin: document.getElementById('new_master_pin').value.trim()
    };

    try {
        const res = await API.system.updateSettings(data);
        if (res.message && res.message.includes('Restarting')) {
            showNotification(res.message, "warning");
        } else {
            showNotification("Settings updated successfully", "success");
            loadSettings();
        }
    } catch (e) { showNotification("Update failed", "error"); }
}

async function testSMTPSettings() {
    showNotification("Sending test email...", "info");
    try {
        await API.system.testEmail();
        showNotification("Test email sent successfully!", "success");
    } catch (e) { showNotification("SMTP Test failed. Check credentials.", "error"); }
}

async function backupDatabase() {
    const prefix = document.getElementById('backupFilename').value || 'manual_backup';
    showNotification("Preparing backup...", "info");
    try {
        const blob = await API.system.createBackup(prefix);
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

        const response = await fetch('/api/system/restore', {
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
    const fromDate = document.getElementById('auditFromDate')?.value;
    const toDate = document.getElementById('auditToDate')?.value;
    const includeTax = document.getElementById('auditIncludeTax')?.checked;
    const municipalTax = parseFloat(document.getElementById('auditMunicipalTax')?.value || 0);
    
    if (!fromDate || !toDate) return showNotification("Please select Start and End dates", "error");
    
    showNotification("Generating audit...", "info");
    try {
        const data = await API.system.getAuditReport(fromDate, toDate);
        const auditContent = document.getElementById('auditContent');
        if (!auditContent) return;

        // Strictly financial cash-flow filter (Income, Expenses, Payouts)
        const filteredLogs = (data.logs || []).filter(l => 
            ['PAYMENT_RECORDED', 'EXPENSE_RECORDED', 'EXPENSE_ADDED', 'OWNER_PAYOUT'].includes(l.action)
        );

        const logsHtml = filteredLogs.length > 0 
            ? `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
                <thead>
                    <tr style="border-bottom: 2px solid var(--border);">
                        <th style="padding: 10px; text-align: left; color: var(--text-muted);">DATE</th>
                        <th style="padding: 10px; text-align: left; color: var(--text-muted);">ACTIVITY</th>
                        <th style="padding: 10px; text-align: left; color: var(--text-muted);">DETAILS</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredLogs.map(l => {
                        let color = 'var(--text-main)';
                        if (l.action.includes('PAYMENT')) color = 'var(--success)';
                        if (l.action.includes('EXPENSE')) color = 'var(--danger)';
                        if (l.action.includes('PAYOUT')) color = 'var(--warning)';

                        const logDate = new Date(l.timestamp).toLocaleDateString('en-IN', {day:'2-digit', month:'short'});

                        return `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 10px; font-weight: 700; color: var(--text-muted); width: 60px;">${logDate}</td>
                            <td style="padding: 10px; font-weight: 900; color: ${color}; white-space: nowrap; text-transform: uppercase; font-size: 0.65rem;">
                                ${l.action.replace(/_/g, ' ')}
                            </td>
                            <td style="padding: 10px; font-weight: 700; color: var(--text-main); line-height: 1.4;">${l.details}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>`
            : '<p style="text-align: center; color: var(--text-muted); padding: 3rem; font-weight: 800;">No financial activities recorded for this period.</p>';

        // Indian Tax Estimator (Section 24)
        let taxHtml = '';
        if (includeTax) {
            const grossIncome = data.summary.total_paid;
            const netAnnualValue = Math.max(0, grossIncome - municipalTax);
            const standardDeduction = netAnnualValue * 0.30;
            const netTaxableIncome = netAnnualValue - standardDeduction;

            taxHtml = `
                <!-- TAX ESTIMATOR (SECTION 24) -->
                <div style="margin-bottom: 2.5rem; background: #fff; border: 2px solid var(--primary); border-radius: 14px; padding: 20px; break-inside: avoid;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid var(--border); padding-bottom: 12px; margin-bottom: 15px;">
                        <h3 style="margin: 0; font-size: 1.1rem; font-weight: 900; color: var(--primary); text-transform: uppercase; letter-spacing: 1px;">Income Tax Projection (India)</h3>
                        <span style="font-size: 0.6rem; font-weight: 800; background: var(--primary-light); color: var(--primary); padding: 4px 10px; border-radius: 4px;">SEC 24a • ESTIMATE</span>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                        <tr>
                            <td style="padding: 8px 0; color: var(--text-muted); font-weight: 700;">Gross Annual Value (Collected Rent)</td>
                            <td style="padding: 8px 0; font-weight: 800; text-align: right; color: var(--text-main);">${currencyFormatter.format(grossIncome)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: var(--danger); font-weight: 700;">Less: Municipal Taxes Paid</td>
                            <td style="padding: 8px 0; font-weight: 800; text-align: right; color: var(--danger);">${currencyFormatter.format(municipalTax)}</td>
                        </tr>
                        <tr style="border-top: 1px solid var(--border);">
                            <td style="padding: 8px 0; color: var(--text-main); font-weight: 800;">Net Annual Value (NAV)</td>
                            <td style="padding: 8px 0; font-weight: 900; text-align: right; color: var(--text-main);">${currencyFormatter.format(netAnnualValue)}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 0; color: var(--danger); font-weight: 700;">Less: Standard Deduction u/s 24a @ 30%</td>
                            <td style="padding: 8px 0; font-weight: 800; text-align: right; color: var(--danger);">${currencyFormatter.format(standardDeduction)}</td>
                        </tr>
                        <tr style="border-top: 1.5px dashed var(--border); font-size: 1rem;">
                            <td style="padding: 12px 0; color: var(--primary); font-weight: 900;">EST. TAXABLE INCOME (HOUSE PROPERTY)</td>
                            <td style="padding: 12px 0; font-weight: 900; text-align: right; color: var(--primary);">${currencyFormatter.format(netTaxableIncome)}</td>
                        </tr>
                    </table>
                    <p style="margin-top: 10px; font-size: 0.65rem; color: var(--text-muted); font-style: italic; line-height: 1.4;">
                        * This is an automated estimate based on Section 24 of the IT Act. Interest on home loans (Sec 24b) is not included.
                    </p>
                </div>
            `;
        }

        auditContent.innerHTML = `
            <div id="printableAudit" style="font-family: var(--font-main), sans-serif; color: var(--text-main); background: white; padding: 25px;">
                <div style="text-align: center; border-bottom: 2px solid var(--primary); padding-bottom: 2rem; margin-bottom: 2.5rem;">
                    <h1 style="margin: 0; font-size: 2rem; font-weight: 900; letter-spacing: 1px; color: var(--primary); text-transform: uppercase;">Financial Audit Report</h1>
                    <p style="margin: 12px 0; font-weight: 900; background: var(--primary); color: #fff !important; display: inline-block; padding: 8px 25px; text-transform: uppercase; border-radius: 8px; letter-spacing: 2px; font-size: 1.1rem;">
                        PERIOD: ${new Date(fromDate).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})} - ${new Date(toDate).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}
                    </p>
                </div>

                <!-- Financial Performance Grid -->
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.5rem; margin-bottom: 2.5rem;">
                    <div style="background: var(--bg-main); border: 1.5px solid var(--border); border-radius: 14px; padding: 15px; text-align: center;">
                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Total Billed</div>
                        <div style="font-size: 1.4rem; font-weight: 900; color: var(--text-main);">${currencyFormatter.format(data.summary.total_billed)}</div>
                    </div>
                    <div style="background: var(--primary-light); border: 1.5px solid var(--primary); border-radius: 14px; padding: 15px; text-align: center;">
                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 1px;">Advance Collected</div>
                        <div style="font-size: 1.4rem; font-weight: 900; color: var(--primary);">${currencyFormatter.format(data.summary.total_advances)}</div>
                    </div>
                </div>

                <!-- Primary Cashflow Metrics -->
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2.5rem;">
                    <div style="border: 1.5px solid var(--success); border-radius: 14px; padding: 15px; text-align: center; background: var(--bg-success-light);">
                        <div style="font-size: 0.6rem; font-weight: 800; color: var(--success); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Total Income</div>
                        <div style="font-size: 1.2rem; font-weight: 900; color: var(--success);">${currencyFormatter.format(data.summary.total_paid)}</div>
                    </div>
                    <div style="border: 1.5px solid var(--danger); border-radius: 14px; padding: 15px; text-align: center; background: var(--bg-danger-light);">
                        <div style="font-size: 0.6rem; font-weight: 800; color: var(--danger); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Total Expenses</div>
                        <div style="font-size: 1.2rem; font-weight: 900; color: var(--danger);">${currencyFormatter.format(data.summary.total_expenses)}</div>
                    </div>
                    <div style="border: 1.5px solid var(--warning); border-radius: 14px; padding: 15px; text-align: center; background: var(--bg-warning-light);">
                        <div style="font-size: 0.6rem; font-weight: 800; color: var(--warning); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Owner Payouts</div>
                        <div style="font-size: 1.2rem; font-weight: 900; color: var(--warning);">${currencyFormatter.format(data.summary.total_payouts)}</div>
                    </div>
                </div>

                ${taxHtml}

                <div style="margin-bottom: 1.5rem; break-inside: avoid;">
                    <h3 style="font-size: 1rem; font-weight: 900; border-bottom: 2px solid var(--border); padding-bottom: 10px; margin-bottom: 15px; text-transform: uppercase; color: var(--text-main); letter-spacing: 1.5px;">Transaction Activity Ledger</h3>
                    <div style="border: 1px solid var(--border); border-radius: 12px; overflow: hidden; background: #fff;">
                        ${logsHtml}
                    </div>
                </div>

                <div style="margin-top: 4rem; border-top: 1.5px solid var(--border); padding-top: 20px; text-align: center; font-size: 0.75rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">
                    THIS DOCUMENT IS AN OFFICIAL SYSTEM-GENERATED FINANCIAL SUMMARY
                    <br><span style="opacity: 0.7; font-weight: 600;">Report Path: Settings > Audit // Generated: ${new Date().toLocaleString('en-IN')}</span>
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
