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
        const statAdvance = document.getElementById('statTotalAdvance');
        const statRent = document.getElementById('statTotalRent');

        if (statActive) statActive.innerText = tenants.filter(t => t.is_active === 1).length;
        if (statAdvance) statAdvance.innerText = currencyFormatter.format(finSummary.total_advances || 0);
        
        const totalRent = tenants.filter(t => t.is_active === 1).reduce((sum, t) => sum + (t.base_rent || 0), 0);
        if (statRent) statRent.innerText = currencyFormatter.format(totalRent);

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
    // For Postpaid logic: In May, we are billing for April usage.
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const billingTargetMonth = prevMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const currentMonthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    // --- Queue 1: Needs Billing ---
    const qBilling = document.getElementById('queueBilling');
    if (qBilling) {
        const day = now.getDate();
        const countEl = document.getElementById('countBilling');
        
        const report = await API.bills.getMonthlyReport(billingTargetMonth) || [];
        const unbilled = report.filter(u => !u.is_billed);
        
        if (countEl) countEl.innerText = unbilled.length;
        
        if (unbilled.length > 0) {
            const isOverdue = day > 3;
            qBilling.innerHTML = unbilled.map(u => `
                <div onclick="draftBillNow(${u.renter_id}, '${billingTargetMonth}')" class="tenant-row" style="padding: 0.75rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1.5px solid ${isOverdue ? 'var(--danger)' : 'var(--border)'}; border-radius: 10px; background: ${isOverdue ? 'var(--bg-danger-light)' : 'transparent'};">
                    <div style="min-width: 0; flex: 1;">
                        <div style="font-weight: 800; font-size: 0.85rem; color: ${isOverdue ? 'var(--danger)' : 'var(--text-main)'};">${u.name}</div>
                        <div style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Unit ${u.room_no} • ${billingTargetMonth}</div>
                    </div>
                    <div style="font-size: 0.7rem; font-weight: 900; color: ${isOverdue ? 'var(--danger)' : 'var(--warning)'}; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${isOverdue ? '⚠️ OVERDUE' : 'Create Bill'}
                    </div>
                </div>
            `).join('');
            
            if (isOverdue) {
                const warningHeader = `<div style="padding: 0.5rem; background: var(--danger); color: white; border-radius: 8px; font-size: 0.65rem; font-weight: 900; text-align: center; margin-bottom: 0.5rem; letter-spacing: 1px;">BIG WARNING: ${billingTargetMonth.toUpperCase()} BILLING OVERDUE</div>`;
                qBilling.insertAdjacentHTML('afterbegin', warningHeader);
            }
        } else {
            qBilling.innerHTML = '<p style="text-align:center; font-size:0.7rem; color:var(--text-muted); padding: 1rem;">All units billed for ' + billingTargetMonth + '.</p>';
        }
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
        const owner = b.received_by || b.assigned_owner || 'Building';
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
    const fromDate = document.getElementById('activityFromDate')?.value || '';
    const toDate = document.getElementById('activityToDate')?.value || '';
    if (!container) return;

    API.system.getLogs('ALL', fromDate, toDate).then(logs => {
        if (!logs || logs.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--text-muted); font-size: 0.7rem;">No logs found.</p>';
            return;
        }

        container.innerHTML = logs.map(l => {
            let icon = 'info';
            let color = 'var(--text-muted)';
            let bgColor = 'var(--bg-main)';
            if (l.action.includes('PAYMENT')) { icon = 'check-circle'; color = 'var(--success)'; bgColor = 'var(--bg-success-light)'; }
            if (l.action.includes('BILL')) { icon = 'zap'; color = 'var(--warning)'; bgColor = 'var(--primary-light)'; }
            if (l.action.includes('EXPENSE')) { icon = 'trending-down'; color = 'var(--danger)'; bgColor = 'rgba(239, 68, 68, 0.1)'; }
            if (l.action.includes('OWNER_PAYOUT')) { icon = 'banknote'; color = 'var(--primary)'; bgColor = 'var(--primary-light)'; }
            if (l.action.includes('TENANT')) { icon = 'user'; color = 'var(--primary)'; }

            const dateObj = new Date(l.timestamp);
            const day = dateObj.getDate();
            const month = dateObj.toLocaleString('default', { month: 'short' }).toUpperCase();
            const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

            return `
                <div style="display: flex; gap: 15px; padding: 12px 0; border-bottom: 1px solid var(--border); align-items: flex-start;">
                    <!-- Date Box Icon Style -->
                    <div style="width: 40px; height: 40px; background: ${bgColor}; color: ${color}; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.05);">
                        <span style="font-size: 0.5rem; font-weight: 900; line-height: 1;">${month}</span>
                        <span style="font-size: 0.9rem; font-weight: 950; line-height: 1.1;">${day}</span>
                    </div>
                    
                    <div style="min-width: 0; flex: 1; padding-top: 2px;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-main); line-height: 1.3; margin-bottom: 4px;">${l.details}</div>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700; display: flex; align-items: center; gap: 4px; text-transform: uppercase;">
                                <i data-lucide="clock" style="width: 10px; height: 10px;"></i> ${time}
                            </span>
                            <span style="font-size: 0.55rem; color: ${color}; font-weight: 900; background: ${bgColor}; padding: 1px 6px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                                ${l.action.replace(/_/g, ' ')}
                            </span>
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
