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

        // Update Collection Progress (Logic: Active units only)
        const activePaid = finSummary.active_paid || 0;
        const activeOutstanding = (finSummary.active_dues || 0) + (finSummary.total_arrears || 0); // Arrears are already filtered by active=1 in backend
        const totalPotential = activePaid + activeOutstanding;
        const percent = totalPotential > 0
            ? Math.min(100, Math.round((activePaid / totalPotential) * 100))
            : 0;

        const percentEl = document.getElementById('statCollectionPercent');
        const barEl = document.getElementById('collectionProgressBar');
        const textEl = document.getElementById('collectionProgressText');
        const detailsEl = document.getElementById('collectionDetails');
        const duesEl = document.getElementById('statTotalDues');
        const arrearsEl = document.getElementById('statTotalArrears');

        if (percentEl) percentEl.innerText = `${percent}%`;
        if (barEl) barEl.style.width = `${percent}%`;
        if (textEl) textEl.innerText = `${percent}% COLLECTED`;
        if (detailsEl) detailsEl.innerText = `${finSummary.active_paid_count || 0} of ${finSummary.active_total_count || 0} bills settled (Active Units)`;
        if (duesEl) duesEl.innerText = currencyFormatter.format(finSummary.active_dues || 0);
        if (arrearsEl) arrearsEl.innerText = currencyFormatter.format(finSummary.total_arrears || 0);

        // --- NEW: Bill Generation Progress ---
        const pendingTasks = await API.bills.getPendingBills();
        const unbilledUnits = pendingTasks.filter(t => t.type === 'MISSING_BILL' || t.type === 'DRAFT_BILL').length;
        const totalActiveUnits = tenants.length;
        const billedUnits = Math.max(0, totalActiveUnits - unbilledUnits);
        const billingPercent = totalActiveUnits > 0 ? Math.round((billedUnits / totalActiveUnits) * 100) : 0;

        const bPercentEl = document.getElementById('statBillingPercent');
        const bBarEl = document.getElementById('billingProgressBar');
        const bTextEl = document.getElementById('billingProgressText');
        const bDetailsEl = document.getElementById('billingDetails');

        if (bPercentEl) bPercentEl.innerText = `${billingPercent}%`;
        if (bBarEl) bBarEl.style.width = `${billingPercent}%`;
        if (bTextEl) bTextEl.innerText = `${billingPercent}% GENERATED`;
        if (bDetailsEl) bDetailsEl.innerText = `${billedUnits} of ${totalActiveUnits} active units billed`;

        // --- NEW: Payout Progress ---
        const payoutPercent = totalPaid > 0 ? Math.min(100, Math.round((payoutsTotal / totalPaid) * 100)) : 0;
        
        const pPercentEl = document.getElementById('statPayoutPercent');
        const pBarEl = document.getElementById('payoutProgressBar');
        const pTextEl = document.getElementById('payoutProgressText');
        const pDetailsEl = document.getElementById('payoutDetails');

        if (pPercentEl) pPercentEl.innerText = `${payoutPercent}%`;
        if (pBarEl) pBarEl.style.width = `${payoutPercent}%`;
        if (pTextEl) pTextEl.innerText = `${payoutPercent}% TRANSFERRED`;
        if (pDetailsEl) pDetailsEl.innerText = `${currencyFormatter.format(payoutsTotal)} of ${currencyFormatter.format(totalPaid)} income paid out`;
        // --- Onboarding Checklist Logic ---
        const hasAccounts = appSettings.receiving_accounts && appSettings.receiving_accounts.length > 0;
        const hasTenants = tenants.length > 0;
        const hasBills = finSummary.total_count > 0;
        const checklistCard = document.getElementById('setupChecklist');
        
        if (checklistCard) {
            if (!hasAccounts || !hasTenants || !hasBills) {
                checklistCard.classList.remove('hidden');
                updateChecklist('check-step-1', hasAccounts);
                updateChecklist('check-step-2', hasTenants);
                updateChecklist('check-step-3', hasBills);
            } else {
                checklistCard.classList.add('hidden');
            }
        }

        // Populate Pending Collections List
        const pendingList = document.getElementById('pendingCollectionList');
        if (pendingList && tenantLedger) {
            const defaulters = tenantLedger.filter(e => e.balance > 0).sort((a, b) => b.balance - a.balance);
            if (defaulters.length === 0) {
                pendingList.innerHTML = '<p style="text-align:center; font-size:0.7rem; color:var(--success); font-weight:800; padding:1rem;">ALL DUES COLLECTED! 🎉</p>';
            } else {
                pendingList.innerHTML = defaulters.map(e => `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg-input); padding:8px 12px; border:1px solid var(--border); border-left:4px solid var(--danger);">
                        <div style="flex:1;">
                            <div style="font-size:0.75rem; font-weight:900; color:var(--text-main);">${e.name} <span style="color:var(--text-muted); font-weight:700; font-size:0.6rem;">(${e.room_no})</span></div>
                            <div style="font-size:0.6rem; color:var(--text-muted); font-weight:700;">TOTAL DUE: ${currencyFormatter.format(e.balance)}</div>
                        </div>
                        <button onclick="showSection('tenants-section'); switchSubSection('tenants-section', 'tenants-statements'); loadTenantHistory(${e.id})" class="btn btn-secondary btn-sm" style="padding:2px 8px; font-size:0.6rem; min-height:24px;">View</button>
                    </div>
                `).join('');
            }
        }

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
                                <span style="color: var(--success);">${currencyFormatter.format(e.total_paid)}</span>
                            </div>
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 0.5rem;">
                        <div>
                            <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Current Balance</div>
                            <div style="font-weight: 900; font-size: 1.1rem; color: ${hasDues ? 'var(--danger)' : 'var(--success)'};">
                                ${currencyFormatter.format(e.balance)}
                            </div>
                        </div>
                        <button onclick="showSection('tenants-section'); switchSubSection('tenants-section', 'tenants-statements'); loadTenantHistory(${e.id})" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.6rem; height: auto; min-height: 0; border-width: 2px;">Statement</button>
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
                    // Check if this tenant already has a PENDING_PAYMENT, DRAFT_BILL or ARREARS_ONLY task
                    const hasTask = tasks.some(tk => tk.renter_id === t.id && (tk.type === 'PENDING_PAYMENT' || tk.type === 'ARREARS_ONLY' || tk.type === 'DRAFT_BILL' || tk.type === 'MISSING_BILL'));
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
            const isDraft = s.type === 'DRAFT_BILL';
            const isArrears = s.type === 'ARREARS_ONLY';
            const isPending = s.type === 'PENDING_PAYMENT';
            
            const item = document.createElement('div');
            item.className = 'card';
            item.style.padding = '1rem';
            item.style.marginBottom = '0.75rem';
            item.style.border = `2px solid ${isMissing ? 'var(--danger)' : (isDraft ? 'var(--border)' : (isArrears ? 'var(--warning)' : 'var(--primary)'))}`;

            const actionBtn = (isMissing || isDraft)
                ? `<button onclick="draftBillNow(${s.renter_id}, '${s.billing_month}')" class="btn btn-secondary btn-sm" style="padding: 4px 12px; font-size: 0.65rem; height: auto; min-height: 32px; border-style: dashed;">Draft Now</button>`
                : `
                <div style="display: flex; gap: 4px;">
                    <button onclick="sendWhatsAppReminder(${s.renter_id}, '${s.billing_month}', ${s.amount})" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.65rem; height: auto; min-height: 32px; color: #25D366; border-color: #25D366;" title="Send Reminder">
                        <i data-lucide="message-circle" style="width: 14px; height: 14px;"></i>
                    </button>
                    <button onclick="quickPay(${s.renter_id}, ${s.bill_id || 'null'}, ${s.amount})" class="btn ${isArrears ? 'btn-secondary' : 'btn-primary'} btn-sm" style="padding: 4px 12px; font-size: 0.65rem; height: auto; min-height: 32px;">${isArrears ? 'View Dues' : 'Pay Now'}</button>
                </div>`;

            const arrearNotice = s.arrears > 0 ? `<div style="font-size: 0.6rem; color: var(--danger); font-weight: 900; margin-top: 2px;">INCLUDES ARREARS: ${currencyFormatter.format(s.arrears)}</div>` : '';

            let statusColor = isMissing ? 'var(--danger)' : (isDraft ? 'var(--text-muted)' : (isArrears ? 'var(--warning)' : 'var(--primary)'));
            let statusLabel = '';
            let periodLabel = s.billing_month === 'Previous Balance' ? s.billing_month : `Stay Period: ${s.billing_month}`;
            
            if (isMissing) {
                statusLabel = `&bull; OVERDUE: BILL NOT GENERATED`;
            } else if (isDraft) {
                statusLabel = `&bull; POSTPAID BILL DUE: DRAFT NOW`;
            } else if (isPending) {
                statusLabel = `&bull; UNPAID: ${currencyFormatter.format(s.amount)}`;
            } else if (isArrears) {
                statusLabel = `&bull; BALANCE PENDING: ${currencyFormatter.format(s.amount)}`;
            }

            item.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <span class="room-badge" style="height: auto; min-height: 0; padding: 2px 8px; font-size: 0.6rem; min-width: 0; background: ${isMissing ? 'var(--danger)' : (isDraft ? 'transparent' : (isArrears ? 'var(--warning)' : 'var(--primary)'))}; color: ${isDraft ? 'var(--text-main)' : 'var(--bg-card)'}; border: 1px solid var(--border);">UNIT ${s.room_no}</span>
                        ${actionBtn}
                    </div>
                    <div style="font-size: 1rem; font-weight: 900; color: var(--text-main); text-transform: uppercase; margin-top: 2px;">${s.name}</div>
                    <div style="display:flex; flex-direction: column; border-top: 1px dashed var(--border); padding-top: 6px;">
                        <div style="display:flex; align-items:center; gap:0.5rem; font-size:0.75rem; font-weight:800; color:${statusColor}; text-transform: uppercase;">
                            <i data-lucide="${isMissing ? 'file-plus' : (isDraft ? 'file-text' : (isArrears ? 'alert-circle' : 'calendar'))}" style="width:12px; height:12px;"></i> 
                            ${periodLabel} <span style="font-size: 0.65rem;">${statusLabel}</span>
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
    showSection('tenants-section');
    switchSubSection('tenants-section', 'tenants-billing');
    if (typeof loadSpecificBilling === 'function') {
        loadSpecificBilling(renterId, monthName);
    }
}

function searchDashboard() {
    const term = document.getElementById('dashboardSearch').value.toLowerCase();
    
    // Helper to toggle visibility and handle empty states
    const filterList = (containerId, itemSelector, emptyMsg) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const items = container.querySelectorAll(itemSelector);
        let visibleCount = 0;
        items.forEach(item => {
            const matches = item.innerText.toLowerCase().includes(term);
            item.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });

        let emptyEl = container.querySelector('.search-no-results');
        if (visibleCount === 0 && term !== "") {
            if (!emptyEl) {
                emptyEl = document.createElement('div');
                emptyEl.className = 'search-no-results';
                emptyEl.style.cssText = 'text-align:center; padding:1.5rem; color:var(--text-muted); font-size:0.8rem; font-weight:700; border: 2px dashed var(--border); border-radius:var(--radius-md); margin-top:0.5rem;';
                emptyEl.innerText = emptyMsg;
                container.appendChild(emptyEl);
            }
        } else if (emptyEl) {
            emptyEl.remove();
        }
    };

    filterList('monthlyChecklist', '.card', 'No matching pending tasks');
    filterList('ownerSettlementList', '.tenant-row', 'No matching owner accounts');
    filterList('tenantLedgerList', '.tenant-row', 'No matching tenant records');
}

function showHelp(topic) {
    const helpData = {
        'potential': 'Sum of base rent for all active units. This is the total you SHOULD collect every month.',
        'arrears': 'Unpaid balance from previous months that has been carried forward. These are automatically added to the next bill.'
    };
    showNotification(helpData[topic] || "No help available", "info");
}

function updateChecklist(id, isComplete) {
    const el = document.getElementById(id);
    if (!el) return;
    const icon = el.querySelector('.check-icon');
    const btn = el.querySelector('button');
    
    if (isComplete) {
        el.classList.add('complete');
        if (icon) icon.setAttribute('data-lucide', 'check-circle-2');
        if (btn) btn.classList.add('hidden');
    } else {
        el.classList.remove('complete');
        if (icon) icon.setAttribute('data-lucide', 'circle');
        if (btn) btn.classList.remove('hidden');
    }
    lucide.createIcons();
}

let resetLogsScroll = null;

async function loadActivityLogs() {
    const listDiv = document.getElementById('activityLog');
    if (!listDiv) return;

    const filter = document.getElementById('logFilter')?.value || 'ALL';
    
    // Reset if filter changed
    if (resetLogsScroll) {
        resetLogsScroll();
    }

    const actionIcons = {
        'TENANT_REGISTERED': 'user-plus', 'TENANT_UPDATED': 'user-cog',
        'TENANT_DELETED': 'user-minus', 'TENANT_REMOVED': 'user-minus',
        'BILL_GENERATED': 'file-text', 'PAYMENT_RECORDED': 'check-circle',
        'ARREARS_CARRIED': 'trending-up', 'BILL_DELETED': 'file-x',
        'UNIT_VACATED': 'home', 'TENANT_RESTORED': 'rotate-ccw',
        'DB_BACKUP': 'database', 'FORGOT_PIN': 'shield-alert',
        'EXPENSE_RECORDED': 'trending-down', 'EXPENSE_REMOVED': 'trash-2',
        'OWNER_PAYOUT': 'banknote', 'OWNER_PAYOUT_DELETED': 'trash-2'
    };
    resetLogsScroll = setupInfiniteScroll(
        listDiv,
        async (offset, limit) => {
            const data = await API.system.getLogs(filter, limit, offset);
            return data;
        },
        (l) => UI.renderLogItem(l, actionIcons),
        { limit: 30, triggerId: 'logs-scroll-trigger' }
    );
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
        date: b.payment_date || b.billing_month,
        amount: b.paid_amount,
        details: `Rent from ${b.tenant_name} (Unit ${b.room_no}) via ${b.payment_method || 'Unknown'}`
    }));

    // Filter payouts (Withdrawals)
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
        details: `MAINTENANCE (${e.category.toUpperCase()}): ${e.notes || 'Work'}`
    }));

    // Combine and sort by date descending
    const timeline = [...income, ...payouts, ...maintenance].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate Summary
    const totalIn = income.reduce((sum, i) => sum + i.amount, 0);
    const totalOut = payouts.reduce((sum, p) => sum + p.amount, 0) + maintenance.reduce((sum, e) => sum + e.amount, 0);
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
