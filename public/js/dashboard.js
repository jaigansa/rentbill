async function loadDashboardStats() {
    const refreshBtn = document.querySelector('button[onclick="loadDashboardStats()"]');
    const statValues = document.querySelectorAll('.stat-value');
    
    if (refreshBtn) refreshBtn.classList.add('loading-spin');
    statValues.forEach(v => v.style.opacity = '0.4');

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
        
        // Reset styles
        statValues.forEach(v => {
            v.style.opacity = '1';
            v.style.transition = 'opacity 0.3s ease';
        });
        if (refreshBtn) refreshBtn.classList.remove('loading-spin');
        
        // --- Owner Settlements Calculation ---
        const allPaidBills = await API.bills.getAllPaidBills(); 

        const settlements = {};
        // Initialize with known owners from settings
        if (typeof appSettings !== 'undefined' && appSettings.receiving_accounts) {
            appSettings.receiving_accounts.forEach(acc => {
                if (!settlements[acc.owner_name]) settlements[acc.owner_name] = { income: 0, payouts: 0, maintenance: 0 };
            });
        }

        // Add income per owner (Credit whoever actually received the money)
        allPaidBills.forEach(b => {
            const owner = b.received_by || b.assigned_owner;
            if (owner) {
                if (!settlements[owner]) settlements[owner] = { income: 0, payouts: 0, maintenance: 0 };
                settlements[owner].income += b.paid_amount;
            }
        });

        // Add payouts per owner
        if (Array.isArray(withdrawals)) {
            withdrawals.forEach(w => {
                if (!settlements[w.owner_name]) settlements[w.owner_name] = { income: 0, payouts: 0, maintenance: 0 };
                settlements[w.owner_name].payouts += w.amount;
            });
        }

        // Add maintenance expenses per owner
        if (Array.isArray(expenses)) {
            expenses.forEach(e => {
                if (e.owner_name) {
                    if (!settlements[e.owner_name]) settlements[e.owner_name] = { income: 0, payouts: 0, maintenance: 0 };
                    settlements[e.owner_name].maintenance += e.amount;
                }
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
                    // Balance = Income - (Payouts + Maintenance paid by this owner)
                    const balance = s.income - (s.payouts + s.maintenance);
                    return `
                        <div class="tenant-row" style="padding: 1rem; border-left: 4px solid var(--primary);">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="font-weight: 900; font-size: 0.9rem; text-transform: uppercase;">${owner}</div>
                                    <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">
                                        In: ${currencyFormatter.format(s.income)} | Out: ${currencyFormatter.format(s.payouts)} | Main: ${currencyFormatter.format(s.maintenance)}
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
        window.dashboardState = { allPaidBills, withdrawals, expenses };

        renderTenantLedger(tenantLedger);
        loadMonthlyTracker();
        renderAnalyticsChart(); // NEW: Trigger chart render
    } catch (e) { console.error("Stats failed", e); }
}

let analyticsChart = null;
async function renderAnalyticsChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) return;

    try {
        const trends = await API.bills.getTrends();
        const labels = trends.map(t => t.month);
        const incomeData = trends.map(t => t.income);
        const expenseData = trends.map(t => t.expenses);

        if (analyticsChart) {
            analyticsChart.destroy();
        }

        const ctx = canvas.getContext('2d');
        const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6366f1';
        const dangerColor = getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || '#ef4444';

        analyticsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        borderColor: primaryColor,
                        backgroundColor: primaryColor + '10',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 4,
                        pointBackgroundColor: primaryColor
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        borderColor: dangerColor,
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
                        ticks: { 
                            font: { size: 10, weight: 'bold' },
                            callback: value => '₹' + (value >= 1000 ? (value/1000) + 'k' : value)
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 10, weight: 'bold' } }
                    }
                }
            }
        });
    } catch (e) { console.error("Chart load failed", e); }
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
                            <span class="room-badge" style="height: auto; min-height: 0; padding: 2px 6px; font-size: 0.6rem;">UNIT ${e.room_no}</span>
                            <div style="font-weight: 900; font-size: 0.9rem; text-transform: uppercase;">${e.name}</div>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 2px;">
                            <div class="math-row" style="width: 250px; justify-content: flex-start; gap: 1rem;">
                                <span style="width: 100px;">Billed:</span>
                                <span>${currencyFormatter.format(e.total_billed)}</span>
                            </div>
                            <div class="math-row" style="width: 250px; justify-content: flex-start; gap: 1rem;">
                                <span style="width: 100px;">Paid:</span>
                                <span>${currencyFormatter.format(e.total_paid)}</span>
                            </div>
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Current Balance</div>
                        <div style="font-weight: 900; font-size: 1.1rem; color: ${hasDues ? 'var(--danger)' : 'var(--success)'};">
                            ${currencyFormatter.format(e.balance)}
                        </div>
                    </div>
                    <button onclick="showSection('tenants-section'); switchSubSection('tenants-section', 'tenants-ledger'); loadTenantHistory(${e.id})" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.6rem; height: auto; min-height: 0; border-width: 2px;">Statement</button>
                </div>
            </div>
        `;
    }).join('');
}

async function loadActivityLogs() {
    const filter = document.getElementById('logFilter')?.value || 'ALL';
    const container = document.getElementById('activityLog');
    if (!container) return;

    try {
        const logs = await API.system.getLogs(filter, 20);
        if (!logs || logs.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--text-muted);">No activity recorded.</p>';
            return;
        }

        const icons = {
            'PAYMENT_RECORDED': 'check-circle',
            'BILL_GENERATED': 'file-plus',
            'TENANT_REGISTERED': 'user-plus',
            'TENANT_UPDATED': 'user-cog',
            'EXPENSE_RECORDED': 'trending-down',
            'OWNER_PAYOUT': 'banknote',
            'UNIT_VACATED': 'door-open'
        };

        container.innerHTML = logs.map(l => {
            const date = new Date(l.timestamp);
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            
            return `
                <div class="tenant-row" style="padding: 0.6rem 1rem; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 1rem; border-color: var(--border);">
                    <div style="width: 38px; height: 38px; background: var(--bg-main); color: var(--text-muted); border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border);">
                        <i data-lucide="${icons[l.action] || 'activity'}" style="width: 18px; height: 18px;"></i>
                    </div>
                    
                    <div style="flex: 1; min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                        <div style="min-width: 0;">
                            <div style="font-weight: 800; font-size: 0.75rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">${l.action.replace(/_/g, ' ')}</div>
                            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${l.details}</div>
                        </div>
                        <div style="text-align: right; flex-shrink: 0;">
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">${dateStr}</div>
                            <div style="font-size: 0.6rem; font-weight: 700; color: var(--text-muted); opacity: 0.8;">${timeStr}</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        lucide.createIcons();
    } catch (e) { console.error(e); }
}

async function loadMonthlyTracker() {
    const container = document.getElementById('monthlyTracker');
    if (!container) return;

    try {
        const now = new Date();
        const monthStr = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        const report = await API.bills.getMonthlyReport(monthStr);

        if (!report || report.length === 0) {
            container.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--text-muted);">No data for this month.</p>';
            return;
        }

        container.innerHTML = report.map(u => `
            <div style="display:flex; flex-direction:column; align-items:center; gap:4px; min-width: 60px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${u.is_paid ? 'var(--success)' : (u.is_billed ? 'var(--warning)' : 'var(--border)')};"></div>
                <span style="font-size:0.6rem; font-weight:800;">${u.room_no}</span>
            </div>
        `).join('');
    } catch (e) { console.error(e); }
}

function draftBillNow(renterId, monthName) {
    showSection('tenants-section');
    switchSubSection('tenants-section', 'tenants-ledger');
    if (typeof loadSpecificBilling === 'function') {
        loadSpecificBilling(renterId, monthName);
    }
}

function showOwnerTimeline(ownerName) {
    const container = document.getElementById('ownerTimelineContent');
    const titleEl = document.getElementById('timelineOwnerName');
    if (!container || !window.dashboardState) return;

    if (titleEl) titleEl.innerText = ownerName;
    const { allPaidBills, withdrawals, expenses } = window.dashboardState;

    // Filter income
    const income = allPaidBills.filter(b => (b.received_by || b.assigned_owner) === ownerName).map(b => ({
        type: 'INCOME',
        date: b.payment_date || b.date_generated,
        amount: b.paid_amount,
        details: `Rent payment from ${b.tenant_name} (${b.room_no}) for ${b.billing_month}`
    }));

    // Filter payouts
    const payouts = (withdrawals || []).filter(w => w.owner_name === ownerName).map(w => ({
        type: 'PAYOUT',
        date: w.date,
        amount: w.amount,
        details: `CASH WITHDRAWAL: ${w.notes || 'No notes'}`
    }));

    // Filter maintenance expenses
    const maintenance = (expenses || []).filter(e => e.owner_name === ownerName).map(e => ({
        type: 'EXPENSE',
        date: e.date,
        amount: e.amount,
        details: `${e.category.toUpperCase()}: ${e.notes || 'No notes'}`
    }));

    // Combine and sort
    const timeline = [...income, ...payouts, ...maintenance].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate Summary
    const totalIn = income.reduce((sum, i) => sum + i.amount, 0);
    const totalOut = payouts.reduce((sum, p) => sum + p.amount, 0) + maintenance.reduce((sum, m) => sum + m.amount, 0);
    const netBalance = totalIn - totalOut;

    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RENTBILL PRO';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';

    if (timeline.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding:2rem; color:var(--text-muted);">No transactions found.</p>';
    } else {
        let html = `
            <div class="print-branding print-only" style="text-align: center; border-bottom: 2px solid var(--primary); padding-bottom: 2rem; margin-bottom: 2rem; width: 100%; font-family: var(--font-main), sans-serif; background: white;">
                <h2 style="margin: 0; font-size: 1.6rem; text-transform: uppercase; font-weight: 900; color: var(--primary); letter-spacing: 1px;">${propName}</h2>
                <p style="margin: 6px 0; font-size: 0.95rem; color: var(--text-muted); font-weight: 600;">${propAddr}</p>
                <div style="margin-top: 20px; font-weight: 900; background: var(--primary); color: #fff !important; display: inline-block; padding: 6px 25px; font-size: 1rem; border-radius: 6px; text-transform: uppercase; letter-spacing: 1.5px;">ACCOUNT STATEMENT / TIMELINE</div>
                <p style="margin: 15px 0 0 0; font-size: 0.9rem; font-weight: 900; color: var(--text-main); text-transform: uppercase;">OWNER: <span style="border-bottom: 1.5px solid var(--border);">${ownerName}</span></p>
                <p style="margin: 6px 0 0 0; font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.5rem;">
                <div style="background: var(--primary-light); padding: 0.75rem; border: 1.5px solid var(--primary); border-radius: 12px; text-align: center;">
                    <div style="font-size: 0.6rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">Income</div>
                    <div style="font-weight: 900; font-size: 0.95rem; color: var(--primary);">${currencyFormatter.format(totalIn)}</div>
                </div>
                <div style="background: var(--bg-warning-light); padding: 0.75rem; border: 1.5px solid var(--warning); border-radius: 12px; text-align: center;">
                    <div style="font-size: 0.6rem; font-weight: 800; color: var(--warning); text-transform: uppercase; letter-spacing: 0.5px;">Payouts</div>
                    <div style="font-weight: 900; font-size: 0.95rem; color: var(--text-main);">${currencyFormatter.format(totalOut)}</div>
                </div>
                <div style="background: var(--bg-main); padding: 0.75rem; border: 1.5px solid var(--border); border-radius: 12px; text-align: center;">
                    <div style="font-size: 0.6rem; font-weight: 800; color: var(--secondary); text-transform: uppercase; letter-spacing: 0.5px;">Balance</div>
                    <div style="font-weight: 900; font-size: 0.95rem; color: var(--text-main);">${currencyFormatter.format(netBalance)}</div>
                </div>
            </div>
            <div class="timeline-list">
        `;

        html += timeline.map(item => {
            const isOut = item.type === 'PAYOUT' || item.type === 'EXPENSE';
            let icon = 'trending-up';
            let color = 'var(--success)';
            let bg = 'var(--bg-success-light)';

            if (item.type === 'PAYOUT') { icon = 'banknote'; color = 'var(--warning)'; bg = 'var(--bg-warning-light)'; }
            else if (item.type === 'EXPENSE') { icon = 'trending-down'; color = 'var(--danger)'; bg = 'var(--bg-danger-light)'; }

            return `
                <div class="tenant-row" style="padding: 0.6rem 1rem; display: flex; align-items: center; justify-content: space-between; border-color: var(--border); margin-bottom: 0.4rem; break-inside: avoid; gap: 1rem;">
                    <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 0;">
                        <!-- Styled Icon Box -->
                        <div style="width: 38px; height: 38px; background: ${bg}; color: ${color}; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid ${bg};">
                            <i data-lucide="${icon}" style="width: 18px; height: 18px;"></i>
                        </div>
                        
                        <div style="min-width: 0;">
                            <div style="font-weight: 800; font-size: 0.7rem; color: ${color}; text-transform: uppercase; letter-spacing: 0.5px;">${item.type}</div>
                            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main); margin: 1px 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.details}</div>
                            <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">${new Date(item.date).toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'})}</div>
                        </div>
                    </div>
                    <div style="font-weight: 900; font-size: 1.1rem; color: ${isOut ? 'var(--text-main)' : 'var(--primary)'}; text-align: right; flex-shrink: 0;">
                        ${isOut ? '-' : '+'}${currencyFormatter.format(item.amount)}
                    </div>
                </div>
            `;
        }).join('');

        html += `</div>`;
        container.innerHTML = html;
    }

    document.getElementById('ownerTimelineModal').classList.remove('hidden');
    document.body.classList.add('modal-open');
    lucide.createIcons();
}

function closeOwnerTimeline() {
    document.getElementById('ownerTimelineModal').classList.add('hidden');
    document.body.classList.remove('modal-open');
}

function printOwnerTimeline() {
    // Populate branding for print
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RENTBILL PRO';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';
    
    document.querySelectorAll('.auditPrintPropName').forEach(el => el.innerText = propName);
    document.querySelectorAll('.auditPrintPropAddr').forEach(el => el.innerText = propAddr);

    // Trigger native print
    window.print();
}
