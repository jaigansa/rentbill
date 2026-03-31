async function loadDashboardStats() {
    try {
        const [tenants, expenses, finSummary, withdrawals, tenantLedger] = await Promise.all([ 
            API.tenants.getAll(), 
            API.expenses.getAll(),
            API.bills.getFinancialSummary(),
            API.withdrawals.getAll(),
            API.bills.getTenantLedger()
        ]);
        
        window.allTenants = tenants; // Store for other functions
        
        // Potential Monthly Income (Sum of all units' base rent)
        const potentialIncome = tenants.reduce((sum, t) => sum + (t.base_rent || 0), 0);
        
        // Total Advance (Sum of all advances)
        const totalAdvance = tenants.reduce((sum, t) => sum + (t.advance_amount || 0), 0);
        
        // Outflow Calculations
        const maintenanceTotal = Array.isArray(expenses) ? expenses.reduce((sum, e) => sum + e.amount, 0) : 0;
        const payoutsTotal = Array.isArray(withdrawals) ? withdrawals.reduce((sum, w) => sum + w.amount, 0) : 0;
        
        // Total Expenses (Maintenance + Payouts)
        const combinedExpenses = maintenanceTotal + payoutsTotal;

        // Total Balance (Total Paid + Advances - Combined Outflow)
        const totalPaid = finSummary.total_paid || 0;
        const totalAdvances = finSummary.total_advances || 0;
        const totalBalance = (totalPaid + totalAdvances) - combinedExpenses;

        const statActive = document.getElementById('statActive');
        const statPotentialIncome = document.getElementById('statPotentialIncome');
        const statTotalAdvance = document.getElementById('statTotalAdvance');
        const statTotalIncome = document.getElementById('statTotalIncome');
        const statTotalExpenses = document.getElementById('statTotalExpenses');
        const statTotalBalance = document.getElementById('statTotalBalance');

        if (statActive) statActive.innerText = tenants.length;
        if (statPotentialIncome) statPotentialIncome.innerText = currencyFormatter.format(potentialIncome);
        if (statTotalAdvance) statTotalAdvance.innerText = currencyFormatter.format(totalAdvance);
        if (statTotalIncome) statTotalIncome.innerText = currencyFormatter.format(totalPaid);
        if (statTotalExpenses) statTotalExpenses.innerText = currencyFormatter.format(combinedExpenses);
        if (statTotalBalance) statTotalBalance.innerText = currencyFormatter.format(totalBalance);
        
        // --- Owner Settlements Calculation ---
        const allPaidBills = await API.bills.getAllPaidBills(); 

        const settlements = {};
        // Initialize with known owners from settings
        if (typeof appSettings !== 'undefined' && appSettings.receiving_accounts) {
            appSettings.receiving_accounts.forEach(acc => {
                if (!settlements[acc.owner_name]) settlements[acc.owner_name] = { income: 0, payouts: 0 };
            });
        }

        // Add income per owner (Credit whoever actually received the money)
        allPaidBills.forEach(b => {
            // Prioritize whoever actually received the money at payment time
            // Fallback to assigned owner if receiver record is empty
            const owner = b.received_by || b.assigned_owner;
            if (owner) {
                if (!settlements[owner]) settlements[owner] = { income: 0, payouts: 0 };
                settlements[owner].income += b.paid_amount;
            }
        });

        // Add payouts per owner
        if (Array.isArray(withdrawals)) {
            withdrawals.forEach(w => {
                if (!settlements[w.owner_name]) settlements[w.owner_name] = { income: 0, payouts: 0 };
                settlements[w.owner_name].payouts += w.amount;
            });
        }

        const settlementList = document.getElementById('ownerSettlementList');
        if (settlementList) {
            const owners = Object.keys(settlements);
            if (owners.length === 0) {
                settlementList.innerHTML = '<p style="text-align:center; font-size:0.75rem; color:var(--text-muted);">No owner accounts linked.</p>';
            } else {
                settlementList.innerHTML = owners.map(owner => {
                    const s = settlements[owner];
                    const balance = s.income - s.payouts;
                    return `
                        <div class="tenant-row" style="padding: 1rem; border-left: 4px solid var(--primary);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 900; font-size: 0.9rem; text-transform: uppercase;">${owner}</div>
                                    <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">
                                        Income: ${currencyFormatter.format(s.income)} | Payouts: ${currencyFormatter.format(s.payouts)}
                                    </div>
                                </div>
                                <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                                    <div>
                                        <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted);">BALANCE</div>
                                        <div style="font-weight: 900; font-size: 1.1rem; color: ${balance > 0 ? 'var(--primary)' : 'var(--text-main)'};">
                                            ${currencyFormatter.format(balance)}
                                        </div>
                                    </div>
                                    <button onclick="showOwnerTimeline('${owner}')" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.6rem; height: auto; min-height: 0; border-width: 2px;">Timeline</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
        
        // --- Store data for timeline ---
        window.dashboardState = { allPaidBills, withdrawals };

        // Update Progress Bar
        const percent = finSummary.total_billed > 0 
            ? Math.round((finSummary.total_paid / finSummary.total_billed) * 100) 
            : 0;

        const percentEl = document.getElementById('statCollectionPercent');
        const barEl = document.getElementById('collectionProgressBar');
        const detailsEl = document.getElementById('collectionDetails');
        const duesEl = document.getElementById('statTotalDues');
        const arrearsEl = document.getElementById('statTotalArrears');
        
        if (percentEl) percentEl.innerText = `${percent}%`;
        if (barEl) barEl.style.width = `${percent}%`;
        if (detailsEl) detailsEl.innerText = `${finSummary.paid_count || 0} of ${finSummary.total_count || 0} bills settled`;
        if (duesEl) duesEl.innerText = currencyFormatter.format(finSummary.total_dues || 0);
        if (arrearsEl) arrearsEl.innerText = currencyFormatter.format(finSummary.total_arrears || 0);

        renderTenantLedger(tenantLedger);
        loadMonthlyTracker();
    } catch (e) { console.error("Stats failed", e); }
}

function renderTenantLedger(ledger) {
    const list = document.getElementById('tenantLedgerList');
    if (!list) return;

    if (!ledger || ledger.length === 0) {
        list.innerHTML = '<p style="text-align:center; font-size:0.75rem; color:var(--text-muted);">No tenant records.</p>';
        return;
    }

    list.innerHTML = ledger.map(e => {
        const hasDues = e.balance > 0;
        return `
            <div class="tenant-row" style="padding: 1rem; border-left: 4px solid ${hasDues ? 'var(--danger)' : 'var(--success)'};">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span class="room-badge" style="height: auto; min-height: 0; padding: 2px 6px; font-size: 0.6rem;">${e.room_no}</span>
                            <div style="font-weight: 900; font-size: 0.9rem; text-transform: uppercase;">${e.name}</div>
                        </div>
                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">
                            Billed: ${currencyFormatter.format(e.total_billed)} | Paid: ${currencyFormatter.format(e.total_paid)}
                        </div>
                        <div style="font-size: 0.6rem; color: var(--text-muted); margin-top: 2px;">
                            SECURITY DEPOSIT: ${currencyFormatter.format(e.advance)}
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <div>
                            <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted);">BALANCE DUE</div>
                            <div style="font-weight: 900; font-size: 1.1rem; color: ${hasDues ? 'var(--danger)' : 'var(--success)'};">
                                ${currencyFormatter.format(e.balance)}
                            </div>
                        </div>
                        <button onclick="showSection('history-section'); loadTenantHistory(${e.id})" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.6rem; height: auto; min-height: 0; border-width: 2px;">Statement</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

async function loadMonthlyTracker() {
    const trackingEl = document.getElementById('currentTrackingMonth');
    if (trackingEl) trackingEl.innerText = "All Pending Tasks";
    const container = document.getElementById('monthlyChecklist');
    if (!container) return;
    try {
        const tasks = await API.bills.getPendingBills();
        
        // Add arrears-only entries from tenants who don't have a task yet
        if (window.allTenants) {
            window.allTenants.forEach(t => {
                if (t.pending_arrears > 0) {
                    // Check if this tenant already has a PENDING_PAYMENT task
                    const hasTask = tasks.some(tk => tk.renter_id === t.id && (tk.type === 'PENDING_PAYMENT' || tk.type === 'ARREARS_ONLY'));
                    if (!hasTask) {
                        tasks.push({
                            type: 'ARREARS_ONLY',
                            renter_id: t.id,
                            name: t.name,
                            room_no: t.room_no,
                            billing_month: 'Previous Balance',
                            amount: t.pending_arrears,
                            arrears: t.pending_arrears
                        });
                    }
                }
            });
        }

        container.innerHTML = '';
        if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="check-circle" style="color: var(--success); opacity: 0.5;"></i>
                    <p>All units are up to date!</p>
                </div>`;
            lucide.createIcons();
            return;
        }

        tasks.forEach(s => {
            const isMissing = s.type === 'MISSING_BILL';
            const isArrears = s.type === 'ARREARS_ONLY';
            const item = document.createElement('div');
            item.className = 'card';
            item.style.padding = '1rem';
            item.style.marginBottom = '0.75rem';
            item.style.border = `2px solid ${isMissing ? 'var(--danger)' : (isArrears ? 'var(--warning)' : 'var(--primary)')}`;

            const actionBtn = isMissing 
                ? `<button onclick="draftBillNow(${s.renter_id}, '${s.billing_month}')" class="btn btn-secondary btn-sm" style="padding: 4px 12px; font-size: 0.65rem; height: auto; min-height: 32px; border-style: dashed;">Draft Now</button>`
                : `<button onclick="showSection('history-section'); loadTenantHistory(${s.renter_id})" class="btn ${isArrears ? 'btn-secondary' : 'btn-primary'} btn-sm" style="padding: 4px 12px; font-size: 0.65rem; height: auto; min-height: 32px;">${isArrears ? 'View Dues' : 'Pay Now'}</button>`;

            const arrearNotice = s.arrears > 0 ? `<div style="font-size: 0.6rem; color: var(--danger); font-weight: 900; margin-top: 2px;">INCLUDES ARREARS: ${currencyFormatter.format(s.arrears)}</div>` : '';

            item.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <span class="room-badge" style="height: auto; min-height: 0; padding: 2px 8px; font-size: 0.6rem; min-width: 0; background: ${isMissing ? 'var(--danger)' : (isArrears ? 'var(--warning)' : 'var(--primary)')}; color: var(--bg-card);">UNIT ${s.room_no}</span>
                        ${actionBtn}
                    </div>
                    <div style="font-size: 1rem; font-weight: 900; color: var(--text-main); text-transform: uppercase; margin-top: 2px;">${s.name}</div>
                    <div style="display:flex; flex-direction: column; border-top: 1px dashed var(--border); padding-top: 6px;">
                        <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.75rem; font-weight:800; color:${isMissing ? 'var(--danger)' : (isArrears ? 'var(--warning)' : 'var(--primary)')}; text-transform: uppercase;">
                            <i data-lucide="${isMissing ? 'file-plus' : (isArrears ? 'alert-circle' : 'calendar')}" style="width:12px; height:12px;"></i> 
                            ${s.billing_month} ${!isMissing ? `&bull; ${currencyFormatter.format(s.amount)}` : '(Bill Missing)'}
                        </div>
                        ${arrearNotice}
                    </div>
                </div>`;
            container.appendChild(item);
        });
        lucide.createIcons();
    } catch (e) { console.error(e); }
}

function draftBillNow(renterId, monthName) {
    showSection('billing-module');
    if (typeof loadSpecificBilling === 'function') {
        loadSpecificBilling(renterId, monthName);
    }
}

async function loadActivityLogs() {
    try {
        const filter = document.getElementById('logFilter')?.value || 'ALL';
        const logs = await API.system.getLogs(filter);
        const actionIcons = { 'TENANT_REGISTERED': 'user-plus', 'TENANT_UPDATED': 'user-cog', 'TENANT_DELETED': 'user-minus', 'BILL_GENERATED': 'file-text', 'PAYMENT_RECORDED': 'check-circle', 'BILL_DELETED': 'file-x', 'UNIT_VACATED': 'home', 'TENANT_RESTORED': 'rotate-ccw', 'DB_BACKUP': 'database', 'FORGOT_PIN': 'shield-alert' };
        const listDiv = document.getElementById('activityLog');
        if (!listDiv) return;
        if (!logs || logs.length === 0) { 
            listDiv.innerHTML = `
                <div class="empty-state" style="padding: 1rem;">
                    <i data-lucide="history" style="width: 24px; height: 24px; opacity: 0.1;"></i>
                    <p style="font-size: 0.6rem;">No activity yet</p>
                </div>`; 
            lucide.createIcons();
            return; 
        }
        listDiv.innerHTML = logs.map(l => UI.renderLogItem(l, actionIcons)).join('');
        lucide.createIcons();
    } catch (e) { console.error("Logs failed", e); }
}

function showOwnerTimeline(ownerName) {
    const container = document.getElementById('ownerTimelineContent');
    const titleEl = document.getElementById('timelineOwnerName');
    if (!container || !window.dashboardState) return;

    titleEl.innerText = ownerName;
    const { allPaidBills, withdrawals } = window.dashboardState;

    // Filter income
    const income = allPaidBills.filter(b => (b.received_by || b.assigned_owner) === ownerName).map(b => ({
        type: 'INCOME',
        date: b.payment_date || b.billing_month,
        amount: b.paid_amount,
        details: `Rent from ${b.tenant_name} (Unit ${b.room_no}) via ${b.payment_method || 'Unknown'}`
    }));

    // Filter payouts
    const payouts = withdrawals.filter(w => w.owner_name === ownerName).map(w => ({
        type: 'PAYOUT',
        date: w.date,
        amount: w.amount,
        details: w.notes || 'No notes provided'
    }));

    // Combine and sort by date descending
    const timeline = [...income, ...payouts].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (timeline.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--text-muted);">No transactions found.</p>';
    } else {
        container.innerHTML = timeline.map(item => `
            <div class="tenant-row" style="padding: 0.75rem; border-left: 4px solid ${item.type === 'INCOME' ? 'var(--success)' : 'var(--danger)'}; margin-bottom: 0.5rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">${item.date} &bull; ${item.type}</div>
                        <div style="font-size: 0.8rem; font-weight: 700; margin: 2px 0;">${item.details}</div>
                    </div>
                    <div style="font-weight: 900; font-size: 1rem; color: ${item.type === 'INCOME' ? 'var(--success)' : 'var(--danger)'};">
                        ${item.type === 'INCOME' ? '+' : '-'}${currencyFormatter.format(item.amount)}
                    </div>
                </div>
            </div>
        `).join('');
    }

    document.getElementById('ownerTimelineModal').classList.remove('hidden');
    lucide.createIcons();
}

function printOwnerTimeline() {
    const ownerName = document.getElementById('timelineOwnerName').innerText;
    const content = document.getElementById('ownerTimelineContent').innerHTML;
    
    const win = window.open('', '_blank');
    win.document.write(`
        <html>
            <head>
                <title>Timeline - ${ownerName}</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; padding: 40px; color: #000; }
                    .tenant-row { border: 1px solid #000; padding: 10px; margin-bottom: 10px; display: block; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <h1>ACCOUNT TIMELINE: ${ownerName}</h1>
                <p>Generated on: ${new Date().toLocaleString('en-IN')}</p>
                <hr>
                ${content}
            </body>
        </html>
    `);
    win.document.close();
    win.onload = () => { win.print(); win.close(); };
}
