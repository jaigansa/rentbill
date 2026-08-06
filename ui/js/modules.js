/* ===== SECTION: expenses.js ===== */
let resetExpensesScroll = null;

async function loadExpenses() {
    const listDiv = document.getElementById('expenseList');
    if (!listDiv) return;

    if (resetExpensesScroll) {
        resetExpensesScroll();
    }
    
    listDiv.innerHTML = '';

    resetExpensesScroll = setupInfiniteScroll(
        listDiv,
        async (offset, limit) => {
            const data = await API.expenses.getAll(limit, offset);
            return data;
        },
        (e) => {
            const d = e.date ? new Date(e.date) : new Date();
            const day = isNaN(d.getTime()) ? '--' : d.getDate().toString().padStart(2, '0');
            const month = isNaN(d.getTime()) ? '---' : d.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase();
            return `
            <div class="tenant-row" style="padding: 0.5rem 0.75rem; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; border-color: var(--border); border-radius: var(--radius-md);">
                <div style="display: flex; align-items: center; gap: 0.6rem; flex: 1; min-width: 0;">
                    <div style="width: 34px; height: 34px; background: var(--bg-danger-light); color: var(--danger); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--bg-danger-light);">
                        <span style="font-size: 0.45rem; font-weight: 900; text-transform: uppercase; line-height: 1; opacity: 0.8;">${month}</span>
                        <span style="font-size: 0.75rem; font-weight: 900;">${day}</span>
                    </div>
                    <div style="min-width: 0;">
                        <div style="font-weight: 900; font-size: 0.82rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${e.notes || 'Maintenance Work'}</div>
                        <div style="font-size: 0.55rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${e.category} <span style="opacity: 0.5;">&bull;</span> PAID BY ${e.owner_name || 'System / Cash'}
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0;">
                    <span style="font-weight: 950; font-size: 0.85rem; color: var(--danger); white-space: nowrap;">${currencyFormatter.format(e.amount)}</span>
                    <div style="display: flex; gap: 0.25rem; margin-left: 0.4rem; padding-left: 0.5rem; border-left: 1px solid var(--border);">
                        <button class="btn btn-danger btn-icon-sm" onclick="deleteExpense(${e.id})" style="width: 30px; height: 30px; border-radius: 8px;" title="Delete"><i data-lucide="trash-2" style="width: 15px; height: 15px;"></i></button>
                    </div>
                </div>
            </div>`;
        },
        { limit: 20, triggerId: 'expenses-scroll-trigger' }
    );
}

function toggleExpenseForm() {
    const form = document.getElementById('expense-form');
    const btn = document.getElementById('expToggleBtn');
    const isHidden = form.classList.toggle('hidden');
    btn.innerText = isHidden ? 'Record Outflow' : 'Cancel';
    if (!isHidden) {
        document.getElementById('eDate').value = new Date().toISOString().split('T')[0];
        populateExpenseOwnerDropdown();
    }
}

function populateExpenseOwnerDropdown() {
    const select = document.getElementById('eOwnerName');
    if (!select || !appSettings.receiving_accounts) return;
    const currentVal = select.value;
    
    select.innerHTML = '<option value="">-- Select Owner --</option>';
    appSettings.receiving_accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.owner_name;
        opt.innerText = `${acc.owner_name.toUpperCase()} • ${acc.label.toUpperCase()}`;
        select.appendChild(opt);
    });
    select.value = currentVal;
}

async function addExpense() {
    const cat = document.getElementById('eCategory').value;
    const owner = document.getElementById('eOwnerName').value;
    const amt = parseFloat(document.getElementById('eAmount').value);
    const date = document.getElementById('eDate').value;
    const notes = document.getElementById('eNotes').value;

    if (!owner) return showNotification("Please select an owner account", "error");
    if (isNaN(amt) || !date) return showNotification("Fill required fields", "error");

    try {
        await API.expenses.create({ category: cat, amount: amt, date, notes, owner_name: owner });
        showNotification("Expense recorded", "success");
        document.getElementById('eAmount').value = '';
        document.getElementById('eNotes').value = '';
        toggleExpenseForm();
        loadExpenses();
        loadDashboardStats();
    } catch (e) { showNotification("Failed to save", "error"); }
}

async function deleteExpense(id) {
    if (!confirm("Delete this log?")) return;
    try {
        await API.expenses.delete(id);
        showNotification("Deleted", "success");
        loadExpenses();
        loadDashboardStats();
    } catch (e) { showNotification("Delete failed", "error"); }
}

async function printExpenses() {
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RENTBILL PRO';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';

    let expenses = [];
    try {
        const res = await API.expenses.getAll(10000, 0);
        expenses = Array.isArray(res) ? res : [];
    } catch (e) {
        console.error("Failed to load expenses for report", e);
    }

    const fmt = v => currencyFormatter ? currencyFormatter.format(v) : '₹' + Number(v).toFixed(2);
    const total = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const owners = new Set(expenses.map(e => e.owner_name).filter(Boolean)).size;

    const breakdown = {};
    expenses.forEach(e => {
        const cat = e.category || 'Other';
        breakdown[cat] = (breakdown[cat] || 0) + (e.amount || 0);
    });

    const printWindow = window.open('/print/expense-report.html', '_blank');
    if (!printWindow) {
        return showNotification("Please allow popups to open the expense report", "error");
    }

    printWindow.onload = function () {
        const doc = printWindow.document;
        const set = (elmId, val) => {
            const el = doc.getElementById(elmId);
            if (el) el.innerText = val;
        };

        set('expPropName', propName);
        set('expPropAddr', propAddr);
        set('expDate', new Date().toLocaleDateString('en-IN'));
        set('expPeriod', 'All records');
        set('expCount', expenses.length);
        set('expTotal', fmt(total));
        set('expOwners', owners);

        const breakdownEl = doc.getElementById('expBreakdown');
        if (breakdownEl) {
            const cats = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
            breakdownEl.innerHTML = cats.length
                ? cats.map(([cat, amt]) => `
                    <span style="background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 4px 12px; border-radius: 20px; font-weight: 800; font-size: 0.72rem;">
                        ${cat.toUpperCase()} • ${fmt(amt)}
                    </span>`).join('')
                : '<span style="color: #64748b; font-weight: 700; font-size: 0.8rem;">No expense records</span>';
        }

        const tbody = doc.getElementById('expRows');
        if (!tbody) return;

        if (expenses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; padding: 2rem; color: #64748b;">No expense records found.</td></tr>`;
            return;
        }

        tbody.innerHTML = expenses.map(e => `
            <tr>
                <td style="white-space: nowrap;">${formatPrintDate(e.date)}</td>
                <td><span class="type-tag type-expense">${e.category || 'OTHER'}</span></td>
                <td>${e.owner_name || 'System / Cash'}</td>
                <td>${e.notes || '—'}</td>
                <td style="text-align: right; font-weight: 800; color: #dc2626;">${fmt(e.amount)}</td>
            </tr>
        `).join('');

        const tfoot = doc.createElement('tr');
        tfoot.innerHTML = `<td colspan="4" style="text-align: right; font-weight: 900; padding: 12px; border-top: 2px solid #0f172a;">GRAND TOTAL</td>
            <td style="text-align: right; font-weight: 950; color: #dc2626; padding: 12px; border-top: 2px solid #0f172a;">${fmt(total)}</td>`;
        tbody.appendChild(tfoot);
    };
}

/* ===== SECTION: withdrawals.js ===== */
let resetWithdrawalsScroll = null;
let currentWithdrawalOwnerFilter = '';

async function loadWithdrawals(owner = null) {
    const listDiv = document.getElementById('withdrawalList');
    if (!listDiv) return;

    if (owner === null) {
        const filterSelect = document.getElementById('payoutOwnerFilter');
        owner = filterSelect ? filterSelect.value : '';
    }

    currentWithdrawalOwnerFilter = owner;
    
    const fromDate = document.getElementById('payoutFromDate')?.value || '';
    const toDate = document.getElementById('payoutToDate')?.value || '';

    const filterSelect = document.getElementById('payoutOwnerFilter');
    if (filterSelect && filterSelect.options.length <= 1) {
        populateWithdrawalFilters();
    }

    if (resetWithdrawalsScroll) {
        resetWithdrawalsScroll();
    }
    
    listDiv.innerHTML = '';

    resetWithdrawalsScroll = setupInfiniteScroll(
        listDiv,
        async (offset, limit) => {
            const data = await API.withdrawals.getAll(limit, offset, currentWithdrawalOwnerFilter, fromDate, toDate);
            return data;
        },
        (w) => UI.renderWithdrawalItem(w, deleteWithdrawal),
        { limit: 20, triggerId: 'withdrawals-scroll-trigger' }
    );
}

function populateWithdrawalFilters() {
    const filterSelect = document.getElementById('payoutOwnerFilter');
    if (!filterSelect || !appSettings.receiving_accounts) return;

    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = '<option value="">All Owners</option>';
    
    const uniqueOwners = [...new Set(appSettings.receiving_accounts.map(acc => acc.owner_name))];
    uniqueOwners.forEach(owner => {
        const opt = document.createElement('option');
        opt.value = owner;
        opt.innerText = owner.toUpperCase();
        filterSelect.appendChild(opt);
    });
    filterSelect.value = currentFilter;
}

function toggleWithdrawalForm() {
    const form = document.getElementById('withdrawal-form');
    const btn = document.getElementById('witToggleBtn');
    const isHidden = form.classList.toggle('hidden');
    btn.innerText = isHidden ? 'Record Payout' : 'Cancel';
    if (!isHidden) {
        document.getElementById('wDate').value = new Date().toISOString().split('T')[0];
        populateWithdrawalOwnerDropdown();
    }
}

function populateWithdrawalOwnerDropdown() {
    const select = document.getElementById('wOwnerName');
    if (!select || !appSettings.receiving_accounts) return;
    const currentVal = select.value;

    select.innerHTML = '<option value="">-- Select Owner --</option>';
    appSettings.receiving_accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.owner_name;
        opt.innerText = `${acc.owner_name.toUpperCase()} • ${acc.label.toUpperCase()}`;
        select.appendChild(opt);
    });
    select.value = currentVal;
}

async function addWithdrawal() {
    const owner = document.getElementById('wOwnerName').value;
    const amount = parseFloat(document.getElementById('wAmount').value);
    const date = document.getElementById('wDate').value;
    const notes = document.getElementById('wNotes').value;

    if (!owner || isNaN(amount) || !date) return showNotification("Fill required fields", "error");

    try {
        await API.withdrawals.create({ owner_name: owner, amount, date, notes });
        showNotification("Payout recorded", "success");
        document.getElementById('wAmount').value = '';
        document.getElementById('wNotes').value = '';
        toggleWithdrawalForm();
        loadWithdrawals(currentWithdrawalOwnerFilter);
        loadDashboardStats();
    } catch (e) { showNotification("Failed to save", "error"); }
}

async function deleteWithdrawal(id) {
    if (!confirm("Delete this record?")) return;
    try {
        await API.withdrawals.delete(id);
        showNotification("Deleted", "success");
        loadWithdrawals(currentWithdrawalOwnerFilter);
        loadDashboardStats();
    } catch (e) { showNotification("Delete failed", "error"); }
}

async function printPayoutHistory() {
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RENTBILL PRO';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';

    const fromDate = document.getElementById('payoutFromDate')?.value || '';
    const toDate = document.getElementById('payoutToDate')?.value || '';
    const filterName = typeof currentWithdrawalOwnerFilter !== 'undefined' ? currentWithdrawalOwnerFilter : '';
    const periodInfo = (fromDate || toDate) ? `${fromDate || '...'} to ${toDate || '...'}` : 'All records';

    let withdrawals = [];
    try {
        const data = await API.withdrawals.getAll(500, 0, filterName, fromDate, toDate);
        withdrawals = Array.isArray(data) ? data : [];
    } catch (e) {
        console.error("Failed to load payouts for statement", e);
    }

    const fmt = v => currencyFormatter ? currencyFormatter.format(v) : '₹' + Number(v).toFixed(2);

    const printWindow = window.open('/print/owner-payout.html', '_blank');
    if (!printWindow) {
        return showNotification("Please allow popups to open the owner payout statement", "error");
    }

    printWindow.onload = function () {
        const doc = printWindow.document;
        const set = (elmId, val) => {
            const el = doc.getElementById(elmId);
            if (el) el.innerText = val;
        };

        set('ownPropName', propName);
        set('ownPropAddr', propAddr);
        set('ownDate', new Date().toLocaleDateString('en-IN'));
        set('ownPeriod', periodInfo);
        set('ownName', filterName ? filterName.toUpperCase() : 'ALL PROPERTY OWNERS');
        set('ownCount', withdrawals.length);

        let totalAmount = 0;
        const tbody = doc.getElementById('ownPayoutRows');
        if (tbody) {
            if (withdrawals.length > 0) {
                withdrawals.sort((a, b) => new Date(a.date) - new Date(b.date));
                tbody.innerHTML = withdrawals.map(w => {
                    totalAmount += w.amount || 0;
                    return `
                        <tr>
                            <td style="white-space: nowrap;">${formatPrintDate(w.date)}</td>
                            <td><strong>${w.owner_name}</strong></td>
                            <td>${w.notes || '—'}</td>
                            <td style="text-align: right; font-weight: 800; color: #4f46e5;">${fmt(w.amount)}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #64748b;">No payout records found for the selected period.</td></tr>`;
            }
        }

        set('ownTotal', fmt(totalAmount));
    };
}

/* ===== SECTION: received.js ===== */
let currentReceivedOwnerFilter = '';

async function loadReceivedPayments(owner = null) {
    const listDiv = document.getElementById('receivedPaymentsList');
    const filterSelect = document.getElementById('receivedOwnerFilter');
    const fromDate = document.getElementById('receivedFromDate')?.value || '';
    const toDate = document.getElementById('receivedToDate')?.value || '';
    
    if (!listDiv) return;

    if (owner === null) {
        owner = filterSelect ? filterSelect.value : '';
    }

    currentReceivedOwnerFilter = owner;

    if (filterSelect && filterSelect.options.length <= 1) {
        populateReceivedFilters();
    }

    listDiv.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-weight: 800;">Syncing income records...</div>';

    try {
        const allPaid = await API.bills.getAllPaidBills(fromDate, toDate);
        const filtered = owner ? allPaid.filter(b => (b.received_by || b.assigned_owner) === owner) : allPaid;

        if (filtered.length === 0) {
            listDiv.innerHTML = `
                <div class="empty-state" style="padding: 4rem 2rem; background: var(--bg-input); border: 2px dashed var(--border); border-radius: 20px; width: 100%;">
                    <i data-lucide="banknote" style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;"></i>
                    <p style="font-weight: 800; color: var(--text-muted); font-size: 1.1rem; margin-bottom: 8px;">No income records found</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted); opacity: 0.7;">There are no payments received for the selected dates/owners.</p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        filtered.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

        listDiv.innerHTML = filtered.map(b => `
            <div class="tenant-row" style="padding: 1rem; border: 1.5px solid var(--border); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 0;">
                    <div style="width: 44px; height: 44px; background: var(--bg-success-light); color: var(--success); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--bg-success-light);">
                        <span style="font-size: 0.5rem; font-weight: 900; text-transform: uppercase; line-height: 1;">${new Date(b.payment_date).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                        <span style="font-size: 0.9rem; font-weight: 900;">${new Date(b.payment_date).getDate()}</span>
                    </div>
                    <div style="min-width: 0;">
                        <div style="font-weight: 900; font-size: 0.95rem; color: var(--text-main);">${b.tenant_name}</div>
                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">
                            UNIT ${b.room_no} • ${b.billing_month} • TO: <span style="color: var(--primary); font-weight: 900;">${(b.received_by || b.assigned_owner || 'System').toUpperCase()}</span>
                        </div>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: 950; font-size: 1.1rem; color: var(--success);">${currencyFormatter.format(b.paid_amount)}</div>
                    <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; display: flex; align-items: center; justify-content: flex-end; gap: 4px; margin-top: 2px;">
                        <i data-lucide="wallet" style="width: 10px; height: 10px;"></i> ${b.payment_method || 'CASH'}
                    </div>
                </div>
            </div>
        `).join('');

        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.error("Failed to load income", e);
        listDiv.innerHTML = '<p style="text-align:center; color:var(--danger); font-size: 0.75rem;">Failed to load records.</p>';
    }
}

async function printIncomeHistory(ownerFilter = null) {
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RENTBILL PRO';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';

    let filterName = ownerFilter || (typeof currentReceivedOwnerFilter !== 'undefined' ? currentReceivedOwnerFilter : null);

    const accounts = (typeof appSettings !== 'undefined' && appSettings.receiving_accounts) || [];
    const filterAccount = accounts.find(a => a.owner_name === filterName);
    const accountName = filterAccount ? [filterAccount.label, filterAccount.upi].filter(Boolean).join(' · ') : (filterName || '');

    let bills = [];
    let withdrawals = [];
    try {
        const [bRes, wRes] = await Promise.all([
            API.bills.getAllPaidBills().catch(() => []),
            API.request('/withdrawals').catch(() => [])
        ]);
        bills = Array.isArray(bRes) ? bRes : [];
        withdrawals = Array.isArray(wRes) ? wRes : [];
    } catch (e) {
        console.error("Failed to load records for statement", e);
    }

    if (filterName) {
        bills = bills.filter(b => (b.received_by || b.assigned_owner) === filterName);
        withdrawals = withdrawals.filter(w => w.owner_name === filterName);
    }

    const paidBills = bills;
    const totalCollected = paidBills.reduce((sum, b) => {
        const val = (b.paid_amount > 0) ? b.paid_amount : (b.total_amount || 0);
        return sum + val;
    }, 0);
    const totalPayouts = withdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
    const netBalance = totalCollected - totalPayouts;

    const fmt = v => currencyFormatter ? currencyFormatter.format(v) : '₹' + Number(v).toFixed(2);

    const printWindow = window.open('/print/owner-income.html', '_blank');
    if (!printWindow) {
        return showNotification("Please allow popups to open the owner income statement", "error");
    }

    printWindow.onload = function () {
        const doc = printWindow.document;
        const set = (elmId, val) => {
            const el = doc.getElementById(elmId);
            if (el) el.innerText = val;
        };

        set('ownPropName', propName);
        set('ownPropAddr', propAddr);
        set('ownDate', new Date().toLocaleDateString('en-IN'));
        set('ownPeriod', 'All records');
        set('ownName', filterName ? filterName.toUpperCase() : 'ALL PROPERTY OWNERS');
        set('ownAccount', filterName ? (accountName || filterName) : 'All Accounts');
        set('ownCount', paidBills.length + withdrawals.length);
        set('ownCollections', fmt(totalCollected));
        set('ownDisbursed', fmt(totalPayouts));
        set('ownNet', fmt(netBalance));

        const tbody = doc.getElementById('ownTimelineRows');
        if (!tbody) return;

        if (paidBills.length === 0 && withdrawals.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #64748b;">No income or payout records found.</td></tr>`;
            return;
        }

        const rows = [];

        withdrawals.sort((a, b) => new Date(a.date) - new Date(b.date));
        withdrawals.forEach(w => {
            rows.push(`
                <tr>
                    <td style="white-space: nowrap;">${formatPrintDate(w.date)}</td>
                    <td><span class="type-tag type-payout">OWNER PAYOUT</span></td>
                    <td>${w.owner_name}${w.notes ? ' • ' + w.notes : ''}</td>
                    <td style="text-align: right; font-weight: 800; color: #4f46e5;">${fmt(w.amount)}</td>
                </tr>
            `);
        });

        paidBills.sort((a, b) => new Date(b.payment_date || b.date_generated) - new Date(a.payment_date || a.date_generated));
        paidBills.forEach(b => {
            rows.push(`
                <tr>
                    <td style="white-space: nowrap;">${formatPrintDate(b.payment_date || b.date_generated)}</td>
                    <td><span class="type-tag type-income">RENT COLLECTION</span></td>
                    <td>${b.tenant_name || b.renter_name || 'Tenant'} • Unit ${b.room_no || '-'} • ${b.billing_month}</td>
                    <td style="text-align: right; font-weight: 800; color: #15803d;">${fmt(b.paid_amount || b.total_amount)}</td>
                </tr>
            `);
        });

        tbody.innerHTML = rows.join('');
    };
}

function populateReceivedFilters() {
    const filterSelect = document.getElementById('receivedOwnerFilter');
    if (!filterSelect || !appSettings.receiving_accounts) return;

    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = '<option value="">All Owners</option>';
    
    const uniqueOwners = [...new Set(appSettings.receiving_accounts.map(acc => acc.owner_name))];
    uniqueOwners.forEach(owner => {
        const opt = document.createElement('option');
        opt.value = owner;
        opt.innerText = owner.toUpperCase();
        filterSelect.appendChild(opt);
    });
    filterSelect.value = currentFilter;
}

/* ===== SECTION: owner-timeline.js ===== */
let currentTimelineOwner = null;

async function showOwnerTimeline(owner) {
    const modal = document.getElementById('ownerTimelineModal');
    if (!modal) return;
    currentTimelineOwner = owner;

    const nameLabel = document.getElementById('timelineOwnerName');
    const content = document.getElementById('ownerTimelineContent');
    if (nameLabel) nameLabel.innerText = owner;
    if (content) content.innerHTML = '<p style="text-align:center; padding: 2rem; color: var(--text-muted); font-weight: 800;">Loading timeline...</p>';

    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');

    try {
        const [billsRes, withdrawalsRes, expensesRes] = await Promise.all([
            API.request('/reports/all-paid-bills').catch(() => []),
            API.request('/withdrawals').catch(() => []),
            API.request('/expenses?limit=100&offset=0').catch(() => [])
        ]);

        const bills = Array.isArray(billsRes) ? billsRes : [];
        const withdrawals = Array.isArray(withdrawalsRes) ? withdrawalsRes : [];
        const expenses = Array.isArray(expensesRes) ? expensesRes : [];

        const events = [];

        bills.filter(b => (b.received_by || b.assigned_owner) === owner).forEach(b => {
            events.push({
                date: b.payment_date || b.date_generated || '',
                type: 'income',
                label: 'PAYMENT',
                title: `${b.tenant_name} • Unit ${b.room_no || '-'}`,
                sub: `${b.billing_month} via ${(b.payment_method || 'CASH').toUpperCase()}`,
                amount: b.paid_amount || b.total_amount || 0,
                color: 'var(--success)',
                bg: 'var(--bg-success-light)',
                icon: 'check-circle'
            });
        });

        withdrawals.filter(w => w.owner_name === owner).forEach(w => {
            events.push({
                date: w.date || '',
                type: 'payout',
                label: 'PAYOUT',
                title: 'Owner Payout',
                sub: w.notes || '',
                amount: w.amount || 0,
                color: 'var(--primary)',
                bg: 'var(--primary-light)',
                icon: 'banknote'
            });
        });

        expenses.filter(e => e.owner_name === owner).forEach(e => {
            events.push({
                date: e.date || '',
                type: 'expense',
                label: 'EXPENSE',
                title: e.category || 'Expense',
                sub: e.notes || '',
                amount: e.amount || 0,
                color: 'var(--danger)',
                bg: 'rgba(239, 68, 68, 0.1)',
                icon: 'trending-down'
            });
        });

        events.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

        const total = events.reduce((sum, e) => e.type === 'income' ? sum + e.amount : sum - e.amount, 0);

        if (!content) return;

        if (events.length === 0) {
            content.innerHTML = `
                <div class="empty-state" style="padding: 3rem 1.5rem; background: var(--bg-input); border: 2px dashed var(--border); border-radius: 16px;">
                    <i data-lucide="list-tree" style="width: 40px; height: 40px; margin-bottom: 0.75rem; opacity: 0.5;"></i>
                    <p style="font-weight: 800; color: var(--text-muted);">No financial activity for this owner yet.</p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        content.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; margin-bottom: 1.5rem;" class="no-print">
                <div style="background: var(--bg-success-light); border: 1.5px solid var(--success); border-radius: 10px; padding: 0.75rem; text-align: center;">
                    <div style="font-size: 0.6rem; font-weight: 900; color: var(--success); text-transform: uppercase; letter-spacing: 0.5px;">Income</div>
                    <div style="font-weight: 950; font-size: 1.05rem; color: var(--success);">${currencyFormatter.format(events.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0))}</div>
                </div>
                <div style="background: var(--bg-main); border: 1.5px solid var(--border); border-radius: 10px; padding: 0.75rem; text-align: center;">
                    <div style="font-size: 0.6rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Net Position</div>
                    <div style="font-weight: 950; font-size: 1.05rem; color: ${total >= 0 ? 'var(--success)' : 'var(--danger)'};">${currencyFormatter.format(total)}</div>
                </div>
                <div style="background: var(--bg-danger-light); border: 1.5px solid var(--danger); border-radius: 10px; padding: 0.75rem; text-align: center;">
                    <div style="font-size: 0.6rem; font-weight: 900; color: var(--danger); text-transform: uppercase; letter-spacing: 0.5px;">Outflow</div>
                    <div style="font-weight: 950; font-size: 1.05rem; color: var(--danger);">${currencyFormatter.format(events.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0))}</div>
                </div>
            </div>
            ${events.map(e => `
                <div class="timeline-item" style="display: flex; gap: 1rem; padding: 0.85rem 0; border-bottom: 1px solid var(--border); align-items: flex-start;">
                    <div style="width: 38px; height: 38px; background: ${e.bg}; color: ${e.color}; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid rgba(0,0,0,0.05);">
                        <i data-lucide="${e.icon}" style="width: 18px; height: 18px;"></i>
                    </div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.6rem; font-weight: 900; color: ${e.color}; background: ${e.bg}; padding: 1px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">${e.label}</span>
                            <span style="font-size: 0.62rem; color: var(--text-muted); font-weight: 700;">${formatPrintDate(e.date)}</span>
                        </div>
                        <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-main); margin-top: 3px;">${e.title}</div>
                        ${e.sub ? `<div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600; margin-top: 1px;">${e.sub}</div>` : ''}
                    </div>
                    <div style="text-align: right; flex-shrink: 0; font-weight: 950; font-size: 0.95rem; color: ${e.type === 'income' ? 'var(--success)' : 'var(--text-main)'};">
                        ${e.type === 'income' ? '+' : '−'}${currencyFormatter.format(e.amount)}
                    </div>
                </div>
            `).join('')}`;

        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (err) {
        if (content) content.innerHTML = '<p style="text-align:center; color:var(--danger); padding: 2rem; font-size: 0.75rem;">Failed to load timeline.</p>';
        console.error("Owner timeline failed", err);
    }
}

function closeOwnerTimeline() {
    const modal = document.getElementById('ownerTimelineModal');
    if (modal) {
        modal.classList.add('hidden');
        document.body.classList.remove('modal-open');
    }
    currentTimelineOwner = null;
}

function printOwnerTimeline() {
    const modal = document.getElementById('ownerTimelineModal');
    if (!modal) return;

    const nameLabel = document.getElementById('timelineOwnerName');
    const ownerName = nameLabel ? nameLabel.innerText : 'Owner';
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RentBill Pro Property';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';

    const content = document.getElementById('ownerTimelineContent');
    const items = content ? Array.from(content.children) : [];

    const printWin = window.open('/print/owner-income.html', '_blank');
    if (!printWin) {
        return showNotification("Please allow popups to print owner income statement", "error");
    }

    printWin.onload = function() {
        const doc = printWin.document;
        if (doc.getElementById('ownPropName')) doc.getElementById('ownPropName').innerText = propName;
        if (doc.getElementById('ownPropAddr')) doc.getElementById('ownPropAddr').innerText = propAddr;
        if (doc.getElementById('ownDate')) doc.getElementById('ownDate').innerText = new Date().toLocaleDateString('en-IN');
        if (doc.getElementById('ownPeriod')) doc.getElementById('ownPeriod').innerText = 'All records';
        if (doc.getElementById('ownName')) doc.getElementById('ownName').innerText = ownerName;

        const accounts = (typeof appSettings !== 'undefined' && appSettings.receiving_accounts) || [];
        const ownerAcc = accounts.find(a => a.owner_name === ownerName);
        const ownerAccName = ownerAcc ? [ownerAcc.label, ownerAcc.upi].filter(Boolean).join(' · ') : ownerName;
        if (doc.getElementById('ownAccount')) doc.getElementById('ownAccount').innerText = ownerAccName;

        let totalCollected = 0;
        let totalDisbursed = 0;

        const tbody = doc.getElementById('ownTimelineRows');
        if (tbody) {
            if (items.length > 0) {
                tbody.innerHTML = items.map(item => {
                    const typeBadge = item.querySelector('.badge')?.innerText || 'TRANSACTION';
                    const title = item.querySelector('.title')?.innerText || '';
                    const sub = item.querySelector('.sub')?.innerText || '';
                    const amtText = item.querySelector('.amount')?.innerText || '₹0';
                    const amtVal = parseFloat(amtText.replace(/[^0-9.-]+/g, '')) || 0;

                    if (typeBadge.includes('INCOME') || typeBadge.includes('RENT')) totalCollected += amtVal;
                    if (typeBadge.includes('PAYOUT') || typeBadge.includes('WITHDRAWAL')) totalDisbursed += amtVal;

                    return `
                        <tr>
                            <td>${sub}</td>
                            <td><strong>${typeBadge}</strong></td>
                            <td>${title}</td>
                            <td style="text-align: right; font-weight: 800;">${amtText}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #64748b;">No owner timeline records found.</td></tr>`;
            }
        }

        if (doc.getElementById('ownCollections')) doc.getElementById('ownCollections').innerText = (typeof currencyFormatter !== 'undefined') ? currencyFormatter.format(totalCollected) : '₹' + totalCollected;
        if (doc.getElementById('ownDisbursed')) doc.getElementById('ownDisbursed').innerText = (typeof currencyFormatter !== 'undefined') ? currencyFormatter.format(totalDisbursed) : '₹' + totalDisbursed;
        if (doc.getElementById('ownNet')) doc.getElementById('ownNet').innerText = (typeof currencyFormatter !== 'undefined') ? currencyFormatter.format(totalCollected - totalDisbursed) : '₹' + (totalCollected - totalDisbursed);
        if (doc.getElementById('ownCount')) doc.getElementById('ownCount').innerText = String(items.length);
    };
}

/* ===== SECTION: vault.js ===== */
let currentVaultDocs = [];

async function loadVault() {
    const listDiv = document.getElementById('vaultList');
    if (!listDiv) return;
    
    const filter = document.getElementById('vaultFilter')?.value || '';

    try {
        const response = await fetch(`/api/documents${filter ? '?file_type=' + filter : ''}`);
        const docs = await response.json();
        currentVaultDocs = docs;
        renderVaultList(docs);
    } catch (e) { console.error("Failed to load vault", e); }
}

function renderVaultList(docs) {
    const listDiv = document.getElementById('vaultList');
    if (!listDiv) return;
    listDiv.innerHTML = '';

    if (!docs || docs.length === 0) {
        listDiv.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><i data-lucide="folder-open"></i><p>Vault is empty</p></div>';
        lucide.createIcons();
        return;
    }

    docs.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.padding = '1rem';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '0.75rem';
        
        const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div class="stat-icon icon-primary" style="width: 32px; height: 32px; margin: 0;"><i data-lucide="${getFileIcon(doc.file_type)}"></i></div>
                <div style="display: flex; gap: 4px;">
                    <a href="${doc.file_path}" target="_blank" class="btn btn-secondary btn-icon-sm" title="View/Download"><i data-lucide="external-link"></i></a>
                    <button onclick="deleteDocument(${doc.id})" class="btn btn-secondary btn-icon-sm" style="color: var(--danger);" title="Delete"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
            <div>
                <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${doc.file_name}">${doc.file_name}</div>
                <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">${doc.file_type} &bull; ${doc.unit_room}</div>
            </div>
            <div style="margin-top: auto; border-top: 1px dashed var(--border); padding-top: 0.75rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.6rem; font-weight: 700; color: var(--text-muted);">
                    <span>Uploaded: ${new Date(doc.upload_date).toLocaleDateString()}</span>
                    ${doc.expiry_date ? `<span style="color: ${isExpired ? 'var(--danger)' : 'var(--success)'};">Expires: ${dateOnly(doc.expiry_date)}</span>` : ''}
                </div>
                ${doc.notes ? `<div style="font-size: 0.65rem; color: var(--text-muted); font-style: italic; margin-top: 4px;">"${doc.notes}"</div>` : ''}
            </div>
        `;
        listDiv.appendChild(card);
    });
    lucide.createIcons();
}

function getFileIcon(type) {
    if (type.includes('ID')) return 'contact';
    if (type.includes('Lease')) return 'file-text';
    if (type.includes('Bill')) return 'receipt';
    return 'file';
}

function toggleUploadForm() {
    const form = document.getElementById('upload-form') || document.getElementById('uploadModal');
    if (!form) return;
    const isHidden = form.classList.toggle('hidden');
    if (!isHidden) {
        if (!document.body.classList.contains('modal-open')) {
            document.body.classList.add('modal-open');
        }
        populateVaultDropdowns();
    } else {
        document.body.classList.remove('modal-open');
    }
}

function populateVaultDropdowns() {
    const unitSelect = document.getElementById('docRenterId');
    if (unitSelect && window.allTenants) {
        const current = unitSelect.value;
        unitSelect.innerHTML = '<option value="">-- Global / No Unit --</option>';
        window.allTenants.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.innerText = `UNIT ${t.room_no} - ${t.name}`;
            unitSelect.appendChild(opt);
        });
        unitSelect.value = current;
    }
}

async function uploadDocument() {
    const fileInput = document.getElementById('docFile');
    if (!fileInput.files.length) return showNotification("Please select a file", "error");

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('renter_id', document.getElementById('docRenterId').value);
    formData.append('file_type', document.getElementById('docType').value);
    formData.append('expiry_date', document.getElementById('docExpiry').value);
    formData.append('notes', document.getElementById('docNotes').value);

    showNotification("Uploading...", "info");

    try {
        const res = await fetch('/api/documents/upload', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            showNotification("Document uploaded successfully", "success");
            toggleUploadForm();
            loadVault();
            loadActivityLogs();
        } else {
            showNotification("Upload failed", "error");
        }
    } catch (e) { console.error(e); }
}

async function deleteDocument(id) {
    if (!confirm("Delete this document? The file will be permanently removed.")) return;
    try {
        const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showNotification("Document deleted", "success");
            loadVault();
        }
    } catch (e) { console.error(e); }
}

function searchVault() {
    const term = document.getElementById('vaultSearch').value.toLowerCase();
    const cards = document.querySelectorAll('#vaultList .card');
    cards.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(term) ? '' : 'none';
    });
}

/* ===== SECTION: maintenance.js ===== */
let currentTasks = [];
let pendingTaskId = null;

async function loadTasks() {
    const listDiv = document.getElementById('taskList');
    if (!listDiv) return;
    
    const status = document.getElementById('taskStatusFilter')?.value || 'ALL';

    try {
        const response = await fetch(`/api/maintenance?status=${status}`);
        const tasks = await response.json();
        currentTasks = tasks;
        renderTaskList(tasks);
    } catch (e) { console.error("Failed to load tasks", e); }
}

function renderTaskList(tasks) {
    const listDiv = document.getElementById('taskList');
    if (!listDiv) return;
    listDiv.innerHTML = '';

    if (!tasks || tasks.length === 0) {
        listDiv.innerHTML = `
            <div class="empty-state" style="padding: 4rem 2rem; background: var(--bg-input); border: 2px dashed var(--border); border-radius: 20px; width: 100%;">
                <i data-lucide="wrench" style="width: 48px; height: 48px; margin-bottom: 1rem; opacity: 0.5;"></i>
                <p style="font-weight: 800; color: var(--text-muted); font-size: 1.1rem; margin-bottom: 8px;">No pending tasks</p>
                <p style="font-size: 0.8rem; color: var(--text-muted); opacity: 0.7; margin-bottom: 1.5rem;">All clear! Create a new ticket if there is a repair or issue.</p>
                <button class="btn btn-primary btn-sm" onclick="toggleTaskForm()" style="border-radius: 8px;">Create Ticket</button>
            </div>`;
        lucide.createIcons();
        return;
    }

    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'tenant-row';
        card.style.cssText = `background: var(--bg-card); border: 1px solid var(--border); border-left: 4px solid ${getPriorityColor(task.priority)}; border-radius: var(--radius-md); padding: 0.7rem 0.85rem; margin-bottom: 0.6rem; box-shadow: var(--shadow-sm); display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;`;

        const isResolved = task.status === 'Resolved';

        card.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.6rem; flex: 1; min-width: 0;">
                <div style="width: 34px; height: 34px; border-radius: 9px; background: var(--bg-input); color: ${getPriorityColor(task.priority)}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--border);">
                    <i data-lucide="wrench" style="width: 16px; height: 16px;"></i>
                </div>
                <div style="min-width: 0; flex: 1;">
                    <div style="display: flex; align-items: center; gap: 6px;">
                        <span class="badge ${getStatusBadgeClass(task.status)}" style="font-size: 0.5rem; padding: 1px 6px; border: none;">${task.status.toUpperCase()}</span>
                        <span style="font-weight: 900; font-size: 0.85rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${task.title}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px; font-size: 0.65rem; color: var(--text-muted); font-weight: 700; flex-wrap: wrap;">
                        <span>${task.category}</span>
                        <span>•</span>
                        <span>Unit ${task.unit_room}</span>
                        <span>•</span>
                        <span>${task.owner_name || 'Common'}</span>
                        <span>•</span>
                        <span>📅 ${dateOnly(task.date_reported)}</span>
                        ${task.actual_cost > 0 ? `<span style="color: var(--success);">• ${currencyFormatter.format(task.actual_cost)}</span>` : (task.estimated_cost > 0 ? `<span>• Est: ${currencyFormatter.format(task.estimated_cost)}</span>` : '')}
                    </div>
                </div>
            </div>
            <div style="display: flex; gap: 0.25rem; margin-left: 0.4rem; padding-left: 0.5rem; border-left: 1px solid var(--border);">
                <button onclick="openTaskModal(${task.id})" class="btn btn-secondary btn-icon-sm" style="border-radius: 8px; color: var(--primary);" title="Manage Task"><i data-lucide="edit-3" style="width: 15px; height: 15px;"></i></button>
                ${isResolved && task.actual_cost > 0 ? `<button onclick="convertTaskToExpense(${task.id})" class="btn btn-secondary btn-icon-sm" style="border-radius: 8px; color: var(--success);" title="Convert to Expense"><i data-lucide="arrow-right-left" style="width: 15px; height: 15px;"></i></button>` : ''}
                <button onclick="deleteTask(${task.id})" class="btn btn-secondary btn-icon-sm" style="border-radius: 8px; color: var(--danger);" title="Delete Ticket"><i data-lucide="trash-2" style="width: 15px; height: 15px;"></i></button>
            </div>
        `;
        listDiv.appendChild(card);
    });
    lucide.createIcons();
}

function getPriorityColor(priority) {
    switch (priority) {
        case 'High': return 'var(--danger)';
        case 'Medium': return 'var(--warning)';
        default: return 'var(--info)';
    }
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'Resolved': return 'badge-success';
        case 'In Progress': return 'badge-info';
        default: return 'badge-danger';
    }
}

function toggleTaskForm() {
    const form = document.getElementById('maintenance-form');
    if (!form) return;
    const isHidden = form.classList.toggle('hidden');
    const btn = document.getElementById('taskToggleBtn');
    
    if (!isHidden) {
        if (btn) btn.innerText = "Cancel";
        populateTaskDropdowns();
    } else {
        if (btn) btn.innerText = "New Ticket";
        document.getElementById('tTaskTitle').value = '';
        document.getElementById('tTaskDesc').value = '';
        document.getElementById('tTaskEst').value = '0';
        document.getElementById('tTaskPhoto').value = '';
    }
}

async function populateTaskDropdowns() {
    const unitSelect = document.getElementById('tTaskRenter');
    if (!unitSelect) return;

    if (!window.allTenants) {
        try {
            window.allTenants = await API.renters.getAll();
        } catch (e) { console.error("Failed to load renters for maintenance", e); }
    }

    if (window.allTenants) {
        const current = unitSelect.value;
        unitSelect.innerHTML = '<option value="">-- Common / Non-unit --</option>';
        window.allTenants.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.innerText = `UNIT ${t.room_no} - ${t.name}`;
            unitSelect.appendChild(opt);
        });
        unitSelect.value = current;
    }
    
    const ownerSelect = document.getElementById('tTaskOwner');
    if (ownerSelect && appSettings.receiving_accounts) {
        const current = ownerSelect.value;
        const owners = [...new Set(appSettings.receiving_accounts.map(a => a.owner_name))];
        ownerSelect.innerHTML = '<option value="">-- Select Owner --</option>';
        owners.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o;
            opt.innerText = o.toUpperCase();
            ownerSelect.appendChild(opt);
        });
        ownerSelect.value = current;
    }
}

async function addTask() {
    const title = document.getElementById('tTaskTitle').value;
    const desc = document.getElementById('tTaskDesc').value;
    const renterId = document.getElementById('tTaskRenter').value;
    const category = document.getElementById('tTaskCat').value;
    const priority = document.getElementById('tTaskPrio').value;
    const owner = document.getElementById('tTaskOwner').value;
    const estCost = parseFloat(document.getElementById('tTaskEst').value) || 0;
    const photoFile = document.getElementById('tTaskPhoto').files[0];

    if (!title) return showNotification("Task Title is required", "error");

    const data = {
        title, 
        description: desc,
        renter_id: renterId ? parseInt(renterId) : null,
        category,
        priority: priority === "3" ? "High" : (priority === "1" ? "Low" : "Medium"),
        status: 'Pending',
        owner_name: owner,
        estimated_cost: estCost,
        date_reported: new Date().toISOString().split('T')[0]
    };

    try {
        const res = await fetch('/api/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            const result = await res.json();
            if (photoFile && result.id) {
                const formData = new FormData();
                formData.append('file', photoFile);
                await fetch(`/api/maintenance/${result.id}/upload`, {
                    method: 'POST',
                    body: formData
                });
            }
            showNotification("Ticket raised successfully", "success");
            toggleTaskForm();
            loadTasks();
            loadActivityLogs();
        } else {
            showNotification("Failed to save task", "error");
        }
    } catch (e) { console.error(e); }
}

function openTaskModal(id) {
    const task = currentTasks.find(t => t.id === id);
    if (!task) return;
    pendingTaskId = id;
    
    document.getElementById('mTaskStatus').value = task.status;
    document.getElementById('mTaskPriority').value = task.priority;
    document.getElementById('mTaskActualCost').value = task.actual_cost || 0;
    document.getElementById('mTaskDateResolved').value = task.date_resolved ? task.date_resolved.slice(0, 10) : '';
    document.getElementById('mTaskNotes').value = '';
    
    toggleConvertOption();

    document.getElementById('taskModal').classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeTaskModal() {
    document.getElementById('taskModal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    pendingTaskId = null;
}

function toggleConvertOption() {
    const status = document.getElementById('mTaskStatus').value;
    const option = document.getElementById('convertOption');
    option.classList.toggle('hidden', status !== 'Resolved');
}

document.getElementById('mTaskStatus')?.addEventListener('change', toggleConvertOption);

async function updateTaskConfirm() {
    const status = document.getElementById('mTaskStatus').value;
    const priority = document.getElementById('mTaskPriority').value;
    const actualCost = parseFloat(document.getElementById('mTaskActualCost').value) || 0;
    let dateResolved = document.getElementById('mTaskDateResolved').value;
    const notes = document.getElementById('mTaskNotes').value;
    const convert = document.getElementById('mTaskConvertToExpense').checked;

    const task = currentTasks.find(t => t.id === pendingTaskId);
    
    const data = {
        ...task,
        status,
        priority,
        actual_cost: actualCost,
        date_resolved: dateResolved || null,
        description: task.description + (notes ? "\nUpdate: " + notes : "")
    };

    try {
        const res = await fetch(`/api/maintenance/${pendingTaskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            if (convert && status === 'Resolved' && actualCost > 0) {
                await convertTaskToExpense(pendingTaskId, true);
            }
            showNotification("Task updated", "success");
            closeTaskModal();
            loadTasks();
            loadActivityLogs();
        }
    } catch (e) { console.error(e); }
}

async function convertTaskToExpense(id, silent = false) {
    try {
        const res = await fetch(`/api/maintenance/${id}/convert`, { method: 'POST' });
        if (res.ok && !silent) {
            showNotification("Expense recorded successfully", "success");
            loadTasks();
            loadExpenses();
        }
    } catch (e) { console.error(e); }
}

async function deleteTaskConfirm() {
    if (!confirm("Delete this maintenance ticket?")) return;
    try {
        const res = await fetch(`/api/maintenance/${pendingTaskId}`, { method: 'DELETE' });
        if (res.ok) {
            showNotification("Ticket deleted", "success");
            closeTaskModal();
            loadTasks();
        }
    } catch (e) { console.error(e); }
}

async function deleteTask(id) {
    if (!confirm("Delete this maintenance ticket?")) return;
    try {
        await API.maintenance.delete(id);
        showNotification("Ticket deleted", "success");
        loadTasks();
    } catch (e) { console.error(e); }
}

function searchTasks() {
    const term = document.getElementById('taskSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#taskList .tenant-row');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
}
