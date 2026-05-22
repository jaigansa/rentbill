let accountEditIndex = null;

async function loadSettings() {
    try {
        const data = await API.system.getSettings();
        appSettings = data;
        const propName = document.getElementById('prop_name');
        const propAddr = document.getElementById('prop_addr');
        const agTerms = document.getElementById('agreement_terms');
        const emailUser = document.getElementById('email_user');
        const emailBcc = document.getElementById('email_bcc');
        const srvPort = document.getElementById('server_port');
        
        if (propName) propName.value = data.property_name || '';
        if (propAddr) propAddr.value = data.property_address || '';
        if (agTerms) agTerms.value = data.agreement_terms || '';
        if (emailUser) emailUser.value = data.email_user || '';
        if (emailBcc) emailBcc.value = data.email_bcc || '';
        if (srvPort) srvPort.value = data.server_port || 8080;

        // Default to current month range for audit
        const fromInput = document.getElementById('auditFromDate');
        const toInput = document.getElementById('auditToDate');
        if (fromInput && toInput && !fromInput.value) {
            setAuditPeriod('current');
        }
        
        renderUnifiedAccounts(data.receiving_accounts || []);
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
    const accounts = [...appSettings.receiving_accounts]; // Clone
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
    } catch (e) { showNotification("SMTP Test failed. Check credentials.", "error"); }
}

async function backupDatabase() {
    const filenameEl = document.getElementById('backupFilename');
    const prefix = filenameEl ? (filenameEl.value || 'manual_backup') : 'dashboard_backup';
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
    
    if (!fromDate || !toDate) return showNotification("Please select both Start and End dates", "error");
    
    showNotification("Compiling financial data...", "info");
    try {
        const data = await API.system.getAuditReport(fromDate, toDate);
        const auditContent = document.getElementById('auditContent');
        if (!auditContent) return;

        // SEPARATION: Income vs. Advances
        const totalRentIncome = data.summary.total_paid;
        const totalCashOut = data.summary.total_expenses + data.summary.total_payouts;
        const netOperatingProfit = totalRentIncome - totalCashOut;
        const totalAdvances = data.summary.total_advances;

        // Transaction Ledger
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
                        const logDate = new Date(l.timestamp).toLocaleDateString('en-IN', {day:'2-digit', month:'short'});
                        return `
                        <tr style="border-bottom: 1px solid var(--border);">
                            <td style="padding: 10px; font-weight: 700; color: var(--text-muted); width: 60px;">${logDate}</td>
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

        // Optional Tax Section
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
                <!-- Modern Branding Header -->
                <div style="text-align: center; border-bottom: 3px solid var(--primary); padding-bottom: 2rem; margin-bottom: 2.5rem;">
                    <h1 style="margin: 0; font-size: 2rem; font-weight: 900; color: var(--primary); text-transform: uppercase; letter-spacing: 1px;">Period Financial Audit</h1>
                    <p style="margin: 10px 0 0 0; font-weight: 800; color: var(--text-muted); font-size: 1rem;">
                        ${new Date(fromDate).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}).toUpperCase()} 
                        — 
                        ${new Date(toDate).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'}).toUpperCase()}
                    </p>
                </div>

                <!-- Main Profitability Summary (Excluding Advances) -->
                <div style="margin-bottom: 3rem; background: var(--primary-light); border: 2px solid var(--primary); border-radius: 16px; padding: 25px; text-align: center;">
                    <div style="font-size: 0.75rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 10px;">Net Operating Profit for Period</div>
                    <div style="font-size: 2.8rem; font-weight: 900; color: var(--text-main); margin-bottom: 15px;">${currencyFormatter.format(netOperatingProfit)}</div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-top: 1.5px dashed var(--primary); padding-top: 20px;">
                        <div>
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--success); text-transform: uppercase;">Collected Rent</div>
                            <div style="font-size: 1.2rem; font-weight: 900; color: var(--text-main);">${currencyFormatter.format(totalRentIncome)}</div>
                        </div>
                        <div>
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--danger); text-transform: uppercase;">Total Expenses</div>
                            <div style="font-size: 1.2rem; font-weight: 900; color: var(--text-main);">${currencyFormatter.format(totalCashOut)}</div>
                        </div>
                    </div>
                </div>

                <!-- Secondary Financial Metrics -->
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 3rem;">
                    <div style="border: 1.5px solid var(--border); border-radius: 12px; padding: 12px; text-align: center; background: var(--bg-main);">
                        <div style="font-size: 0.55rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Security Deposits</div>
                        <div style="font-size: 1rem; font-weight: 900; color: var(--primary);">${currencyFormatter.format(totalAdvances)}</div>
                    </div>
                    <div style="border: 1.5px solid var(--border); border-radius: 12px; padding: 12px; text-align: center;">
                        <div style="font-size: 0.55rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Total Billed</div>
                        <div style="font-size: 1rem; font-weight: 900;">${currencyFormatter.format(data.summary.total_billed)}</div>
                    </div>
                    <div style="border: 1.5px solid var(--border); border-radius: 12px; padding: 12px; text-align: center;">
                        <div style="font-size: 0.55rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Maintenance</div>
                        <div style="font-size: 1rem; font-weight: 900;">${currencyFormatter.format(data.summary.total_expenses)}</div>
                    </div>
                    <div style="border: 1.5px solid var(--border); border-radius: 12px; padding: 12px; text-align: center;">
                        <div style="font-size: 0.55rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Withdrawals</div>
                        <div style="font-size: 1rem; font-weight: 900;">${currencyFormatter.format(data.summary.total_payouts)}</div>
                    </div>
                </div>

                <!-- Activity Ledger -->
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
    // Populate branding for print
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RENTBILL PRO';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';
    
    document.querySelectorAll('.auditPrintPropName').forEach(el => el.innerText = propName);
    document.querySelectorAll('.auditPrintPropAddr').forEach(el => el.innerText = propAddr);

    // Inject temporary print style
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

    // Cleanup
    setTimeout(() => {
        const styleEl = document.getElementById('print-audit-style');
        if (styleEl) styleEl.remove();
    }, 500);
}
