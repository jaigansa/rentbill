async function loadDashboardStats() {
    const refreshBtn = document.querySelector('button[onclick="loadDashboardStats()"]');
    if (refreshBtn) refreshBtn.classList.add('loading-spin');

    try {
        const [tenants, expenses, finSummary, withdrawals, tenantLedger, paidBills] = await Promise.all([ 
            API.tenants.getAll(), 
            API.expenses.getAll(),
            API.bills.getFinancialSummary(),
            API.withdrawals.getAll(),
            API.bills.getTenantLedger(),
            API.bills.getAllPaidBills()
        ]);
        
        window.dashboardState = { tenants, expenses, finSummary, withdrawals, tenantLedger, allPaidBills: paidBills };

        // 1. Update Core Stats
        const statActive = document.getElementById('statActive');
        const statIncome = document.getElementById('statTotalIncome');
        const statExpenses = document.getElementById('statTotalExpenses');

        if (statActive) statActive.innerText = tenants.filter(t => t.is_active === 1).length;
        if (statIncome) statIncome.innerText = currencyFormatter.format(finSummary.total_paid || 0);
        
        const combinedExpenses = (Array.isArray(expenses) ? expenses.reduce((sum, e) => sum + e.amount, 0) : 0) + 
                                 (Array.isArray(withdrawals) ? withdrawals.reduce((sum, w) => sum + w.amount, 0) : 0);
        if (statExpenses) statExpenses.innerText = currencyFormatter.format(combinedExpenses);

        // 2. Populate Action Queues
        await populateActionQueues(tenants, tenantLedger);

        // 3. Update Visuals
        updateMonthlyTracker(tenants);
        updateOwnerSettlements(paidBills, expenses, withdrawals);
        loadTrendChart();
        loadActivityLogs();

        if (refreshBtn) refreshBtn.classList.remove('loading-spin');
    } catch (e) {
        console.error("Dashboard Load Failed", e);
        if (refreshBtn) refreshBtn.classList.remove('loading-spin');
    }
}

async function populateActionQueues(tenants, ledger) {
    const now = new Date();
    const currentMonth = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // --- Queue 1: Needs Billing ---
    const qBilling = document.getElementById('queueBilling');
    if (qBilling) {
        const report = await API.bills.getMonthlyReport(currentMonth) || [];
        const unbilled = report.filter(u => !u.is_billed);
        
        const countEl = document.getElementById('countBilling');
        if (countEl) countEl.innerText = unbilled.length;
        
        qBilling.innerHTML = unbilled.length ? unbilled.map(u => `
            <div onclick="draftBillNow(${u.renter_id}, '${currentMonth}')" class="tenant-row" style="padding: 0.75rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1.5px solid var(--border); border-radius: 10px;">
                <div style="font-weight: 800; font-size: 0.85rem;">Unit ${u.room_no}</div>
                <div style="font-size: 0.75rem; font-weight: 700; color: var(--warning);">CREATE BILL</div>
            </div>
        `).join('') : '<p style="text-align:center; font-size:0.7rem; color:var(--text-muted); padding: 1rem;">All units billed.</p>';
    }

    // --- Queue 2: Pending Collections ---
    const qCollection = document.getElementById('queueCollection');
    if (qCollection) {
        const defaulters = ledger.filter(e => e.balance > 0).sort((a, b) => b.balance - a.balance);
        
        const countEl = document.getElementById('countCollection');
        if (countEl) countEl.innerText = defaulters.length;
        
        qCollection.innerHTML = defaulters.length ? defaulters.map(d => `
            <div onclick="quickPay(${d.id})" class="tenant-row" style="padding: 0.75rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1.5px solid var(--border); border-radius: 10px; border-left: 3px solid var(--danger);">
                <div style="min-width: 0;">
                    <div style="font-weight: 800; font-size: 0.85rem;">${d.name}</div>
                    <div style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted);">UNIT ${d.room_no}</div>
                </div>
                <div style="font-weight: 900; color: var(--danger); font-size: 0.85rem;">₹${d.balance}</div>
            </div>
        `).join('') : '<p style="text-align:center; font-size:0.7rem; color:var(--text-muted); padding: 1rem;">All dues collected!</p>';
    }

    // --- Queue 3: Open Tasks ---
    const qTasks = document.getElementById('queueTasks');
    if (qTasks) {
        try {
            const tasks = await API.maintenance.getAll();
            const openTasks = tasks.filter(t => t.status !== 'Resolved').slice(0, 10);
            
            const countEl = document.getElementById('countTasks');
            if (countEl) countEl.innerText = openTasks.length;
            
            qTasks.innerHTML = openTasks.length ? openTasks.map(t => `
                <div onclick="showSection('settings-section', 'settings-maintenance')" class="tenant-row" style="padding: 0.75rem; cursor: pointer; border: 1.5px solid var(--border); border-radius: 10px;">
                    <div style="font-weight: 800; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.title}</div>
                    <div style="display:flex; justify-content: space-between; margin-top: 4px;">
                        <div style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted);">${t.unit_room}</div>
                        <div class="badge" style="font-size: 0.55rem; padding: 2px 6px; background: ${t.status === 'Pending' ? 'var(--bg-danger-light)' : 'var(--bg-warning-light)'}; color: ${t.status === 'Pending' ? 'var(--danger)' : 'var(--warning)'};">${t.status}</div>
                    </div>
                </div>
            `).join('') : '<p style="text-align:center; font-size:0.7rem; color:var(--text-muted); padding: 1rem;">No pending tasks.</p>';
        } catch(e) { qTasks.innerHTML = ''; }
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateMonthlyTracker(tenants) {
    const container = document.getElementById('monthlyTracker');
    if (!container) return;

    const now = new Date();
    const monthStr = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    
    API.bills.getMonthlyReport(monthStr).then(report => {
        if (!report || report.length === 0) {
            container.innerHTML = '<p style="text-align:center; font-size:0.7rem;">No data.</p>';
            return;
        }
        container.innerHTML = report.map(u => `
            <div title="Unit ${u.room_no}: ${u.is_paid ? 'Paid' : (u.is_billed ? 'Unpaid' : 'Not Billed')}" style="width: 14px; height: 14px; border-radius: 4px; background: ${u.is_paid ? 'var(--success)' : (u.is_billed ? 'var(--warning)' : 'var(--border)')};"></div>
        `).join('');
    }).catch(e => console.error(e));
}

function updateOwnerSettlements(paidBills, expenses, withdrawals) {
    const dashboardList = document.getElementById('ownerSettlementList');
    const detailedList = document.getElementById('detailedOwnerSettlementList');
    
    if (!dashboardList && !detailedList) return;

    const settlements = {};
    
    // Initialize owners from settings
    if (appSettings.receiving_accounts) {
        appSettings.receiving_accounts.forEach(acc => {
            if (!settlements[acc.owner_name]) {
                settlements[acc.owner_name] = { income: 0, expenses: 0, payouts: 0 };
            }
        });
    }

    // 1. Calculate Income per owner
    paidBills.forEach(b => {
        const owner = b.assigned_owner || 'Building';
        if (!settlements[owner]) settlements[owner] = { income: 0, expenses: 0, payouts: 0 };
        settlements[owner].income += (b.paid_amount || 0);
    });

    // 2. Calculate Expenses per owner
    expenses.forEach(e => {
        const owner = e.owner_name || 'Building';
        if (!settlements[owner]) settlements[owner] = { income: 0, expenses: 0, payouts: 0 };
        settlements[owner].expenses += (e.amount || 0);
    });

    // 3. Calculate Payouts (Withdrawals)
    withdrawals.forEach(w => {
        const owner = w.owner_name || 'Building';
        if (!settlements[owner]) settlements[owner] = { income: 0, expenses: 0, payouts: 0 };
        settlements[owner].payouts += (w.amount || 0);
    });

    const owners = Object.keys(settlements);
    const html = owners.length === 0 
        ? '<p style="text-align:center; font-size:0.7rem; color:var(--text-muted);">No owners found.</p>'
        : owners.map(name => {
            const s = settlements[name];
            const net = s.income - s.expenses - s.payouts;
            return `
                <div class="tenant-row" style="padding: 1rem; border: 1.5px solid var(--border); border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 900; font-size: 0.9rem;">${name}</div>
                        <div style="font-size: 0.6rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 4px;">
                            Income: ₹${s.income.toFixed(0)} | Outflow: ₹${(s.expenses + s.payouts).toFixed(0)}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Final Payable</div>
                        <div style="font-weight: 950; font-size: 1.1rem; color: ${net > 0 ? 'var(--success)' : 'var(--text-muted)'};">
                            ${currencyFormatter.format(net)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    if (dashboardList) dashboardList.innerHTML = html;
    if (detailedList) detailedList.innerHTML = html;
}

function loadTrendChart() {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    API.bills.getTrends().then(data => {
        if (!data || data.length === 0) return;

        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#94a3b8' : '#64748b';

        if (window.myTrendChart) window.myTrendChart.destroy();

        window.myTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.month),
                datasets: [
                    {
                        label: 'Income',
                        data: data.map(d => d.income),
                        borderColor: '#10b981',
                        backgroundColor: '#10b98120',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'Outflow',
                        data: data.map(d => d.expenses),
                        borderColor: '#ef4444',
                        backgroundColor: '#ef444410',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { display: false, beginAtZero: true },
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { size: 10, weight: 'bold' } }
                    }
                }
            }
        });
    });
}

function loadActivityLogs() {
    const container = document.getElementById('activityLog');
    if (!container) return;

    API.system.getLogs('ALL').then(logs => {
        if (!logs || logs.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--text-muted); font-size: 0.7rem;">No logs found.</p>';
            return;
        }

        container.innerHTML = logs.slice(0, 15).map(l => {
            let icon = 'info';
            let color = 'var(--text-muted)';
            if (l.action.includes('PAYMENT')) { icon = 'check-circle'; color = 'var(--success)'; }
            if (l.action.includes('BILL')) { icon = 'zap'; color = 'var(--warning)'; }
            if (l.action.includes('EXPENSE')) { icon = 'trending-down'; color = 'var(--danger)'; }

            return `
                <div style="display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); align-items: center;">
                    <div style="color: ${color};"><i data-lucide="${icon}" style="width: 14px; height: 14px;"></i></div>
                    <div style="min-width: 0; flex: 1;">
                        <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${l.details}</div>
                        <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 600; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                            <i data-lucide="calendar" style="width: 10px; height: 10px;"></i>
                            <span>${new Date(l.timestamp).toLocaleDateString([], {day: '2-digit', month: 'short'})} • ${new Date(l.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
}

function draftBillNow(renterId, monthName) {
    showSection('tenants-section', 'tenants-billing');
    if (typeof loadSpecificBilling === 'function') {
        loadSpecificBilling(renterId, monthName);
    }
}

function quickPay(renterId) {
    showSection('tenants-section');
    switchSubSection('tenants-section', 'tenants-ledger');
}
