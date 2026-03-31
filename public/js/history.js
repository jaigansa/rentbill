async function initHistorySection(reset = false) {
    console.log("Initializing History Section...");
    const select = document.getElementById('historyTenantSelect');
    if (!select) return;
    
    if (reset) {
        select.value = "";
        const resultsDiv = document.getElementById('historyResults');
        const emptyState = document.getElementById('historyEmptyState');
        if (resultsDiv) resultsDiv.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        // Default to Tenants tab
        toggleHistoryMode('tenants');
    }

    try {
        const tenants = await API.tenants.getAll();
        const historyTenants = await API.tenants.getHistory(); // Archived/Inactive ones
        const allTenants = [...tenants, ...historyTenants];
        
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Unit / Tenant --</option>';
        
        allTenants.sort((a, b) => a.room_no.localeCompare(b.room_no, undefined, {numeric: true}));
        
        allTenants.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.innerText = `[${t.room_no}] ${t.name} ${t.is_active === 0 ? '(Archived)' : ''}`;
            select.appendChild(opt);
        });
        select.value = currentVal;
        
        // Load payouts if available
        if (typeof loadWithdrawals === 'function') loadWithdrawals();
    } catch (e) { console.error("Failed to load tenants for history", e); }
}

function toggleHistoryMode(mode) {
    const tenantsContent = document.getElementById('historyTenantsContent');
    const ownersContent = document.getElementById('historyOwnersContent');
    const btnTenants = document.getElementById('btnHistoryTenants');
    const btnOwners = document.getElementById('btnHistoryOwners');

    if (mode === 'tenants') {
        tenantsContent?.classList.remove('hidden');
        ownersContent?.classList.add('hidden');
        btnTenants?.classList.add('active');
        btnOwners?.classList.remove('active');
    } else {
        tenantsContent?.classList.add('hidden');
        ownersContent?.classList.remove('hidden');
        btnTenants?.classList.remove('active');
        btnOwners?.classList.add('active');
        if (typeof loadWithdrawals === 'function') loadWithdrawals();
    }
}

let hCurrentTenantId = null;
let hFullHistory = [];
let hVisibleCount = 10;

async function loadTenantHistory(id) {
    const resultsDiv = document.getElementById('historyResults');
    const emptyState = document.getElementById('historyEmptyState');
    const historyBody = document.getElementById('historyBody');
    const loadMoreBtn = document.getElementById('historyLoadMoreContainer');
    
    if (!id) {
        if (resultsDiv) resultsDiv.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
        return;
    }

    try {
        const tenant = await API.tenants.getOne(id);
        const title = document.getElementById('historySelectedName');
        if (title) title.innerText = `${tenant.name} (Unit ${tenant.room_no})`;

        const bills = await API.bills.getByRenter(id);
        if (resultsDiv) resultsDiv.classList.remove('hidden');
        if (emptyState) emptyState.classList.add('hidden');
        
        hCurrentTenantId = id;
        hVisibleCount = 10;
        
        // Manual Sort: Newest Month First
        bills.sort((a, b) => {
            const dateA = new Date(a.billing_month.split(' ')[0] + ' 1, ' + a.billing_month.split(' ')[1]);
            const dateB = new Date(b.billing_month.split(' ')[0] + ' 1, ' + b.billing_month.split(' ')[1]);
            return dateB - dateA || b.id - a.id;
        });

        hFullHistory = bills;
        renderHistorySlice(tenant);
    } catch (err) { showNotification("Failed to load history", "error"); }
}

function renderHistorySlice(tenant) {
    const historyBody = document.getElementById('historyBody');
    const loadMoreBtn = document.getElementById('historyLoadMoreContainer');
    if (!historyBody) return;

    historyBody.innerHTML = '';
    const slice = hFullHistory.slice(0, hVisibleCount);

    if (slice.length === 0) {
        historyBody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem; color: var(--text-muted); font-size: 0.85rem;">No records found.</td></tr>';
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
        return;
    }

    slice.forEach(b => {
        const isPaid = b.is_paid === 1;
        const statusBadge = isPaid ? '<span class="badge badge-success">Paid</span>' : '<span class="badge badge-warning">Pending</span>';
        
        const actionBtn = `<div class="history-actions-mobile" style="display: flex; gap: 0.25rem; justify-content: flex-end;">
            <button class="btn btn-secondary btn-icon-sm" onclick="prepareAndShare('bill', ${b.id})"><i data-lucide="share-2"></i></button>
            ${!isPaid ? `<button class="btn btn-secondary btn-icon-sm" style="color: var(--success);" onclick="openHistoryPaymentModal(${b.id}, ${hCurrentTenantId}, ${b.total_amount})"><i data-lucide="check-circle"></i></button>` : ''}
            <button class="btn btn-secondary btn-icon-sm" style="color: var(--danger);" onclick="deleteHistoryBill(${b.id}, ${hCurrentTenantId})"><i data-lucide="trash-2"></i></button>
        </div>`;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 2px;" class="sm:hidden">Month</div>
                <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${b.billing_month}</div>
            </td>
            <td>
                <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 2px;" class="sm:hidden">Amount</div>
                <div onclick='showBillBreakdown(${JSON.stringify(b)}, ${tenant.eb_unit_price})' style="font-weight: 900; color: var(--primary); font-size: 1rem; text-decoration: underline; cursor: pointer;">
                    ${currencyFormatter.format(b.total_amount)}
                </div>
            </td>
            <td>
                <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px;" class="sm:hidden">Status</div>
                ${statusBadge}
            </td>
            <td style="text-align: right;">${actionBtn}</td>
        `;
        historyBody.appendChild(row);
    });

    if (hVisibleCount < hFullHistory.length) {
        loadMoreBtn?.classList.remove('hidden');
    } else {
        loadMoreBtn?.classList.add('hidden');
    }
    lucide.createIcons();
}

async function loadMoreTenantHistory() {
    hVisibleCount += 10;
    try {
        const tenant = await API.tenants.getOne(hCurrentTenantId);
        renderHistorySlice(tenant);
    } catch (e) {}
}

function showBillBreakdown(b, unitPrice) {
    const content = document.getElementById('billBreakdownContent');
    if (!content) return;

    const ebUnits = b.curr_eb_reading - b.prev_eb_reading;
    const ebCost = ebUnits * unitPrice;

    content.innerHTML = `
        <div style="background: var(--primary-light); padding: 1rem; border: 2px solid var(--border);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted);">BASE RENT</span>
                <span style="font-weight: 900;">${currencyFormatter.format(b.rent_amount)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted);">WATER / MAINT</span>
                <span style="font-weight: 900;">${currencyFormatter.format(b.water_amount)}</span>
            </div>
            <div style="border-top: 1px dashed var(--border); padding-top: 0.5rem; margin-top: 0.5rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                    <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted);">ELECTRICITY</span>
                    <span style="font-weight: 900;">${currencyFormatter.format(ebCost)}</span>
                </div>
                <div style="font-size: 0.65rem; color: var(--text-muted);">
                    Reading: ${b.prev_eb_reading} to ${b.curr_eb_reading} (${ebUnits.toFixed(1)} units)
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-top: 0.5rem;">
                <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted);">EXTRA CHARGES</span>
                <span style="font-weight: 900;">${currencyFormatter.format(b.others - b.arrears_included)}</span>
            </div>
            ${b.arrears_included > 0 ? `
                <div style="display: flex; justify-content: space-between; margin-top: 0.25rem;">
                    <span style="font-size: 0.7rem; font-weight: 800; color: var(--danger);">PREV. ARREARS</span>
                    <span style="font-weight: 900; color: var(--danger);">${currencyFormatter.format(b.arrears_included)}</span>
                </div>
            ` : ''}
            <div style="border-top: 2px solid var(--border); margin-top: 1rem; padding-top: 0.5rem; display: flex; justify-content: space-between;">
                <span style="font-weight: 900;">TOTAL BILL</span>
                <span style="font-weight: 900; color: var(--primary); font-size: 1.1rem;">${currencyFormatter.format(b.total_amount)}</span>
            </div>
        </div>

        ${b.is_paid ? `
            <div style="border: 2px solid var(--success); padding: 1rem; background: var(--bg-success-light);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted);">AMOUNT PAID</span>
                    <span style="font-weight: 900; color: var(--text-main);">${currencyFormatter.format(b.paid_amount)}</span>
                </div>
                ${b.discount_amount > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--text-muted);"><span>DISCOUNT</span><span style="color: var(--text-main)">-${currencyFormatter.format(b.discount_amount)}</span></div>` : ''}
                ${b.write_off_amount > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--danger);"><span>WRITE-OFF</span><span style="color: var(--danger)">-${currencyFormatter.format(b.write_off_amount)}</span></div>` : ''}
                ${b.arrears_amount > 0 ? `<div style="display: flex; justify-content: space-between; font-size: 0.7rem; color: var(--warning);"><span>CARRY FORWARD</span><span style="color: var(--warning)">${currencyFormatter.format(b.arrears_amount)}</span></div>` : ''}
                <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 8px;">
                    Method: ${b.payment_method} &bull; Date: ${b.payment_date}
                </div>
            </div>
        ` : ''}
    `;

    document.getElementById('billDetailsModal').classList.remove('hidden');
}

let hPendingPayBillId = null, hPendingPayRenterId = null, hPendingPayTotal = 0;

function openHistoryPaymentModal(billId, renterId, totalAmount) {
    hPendingPayBillId = billId; 
    hPendingPayRenterId = renterId;
    hPendingPayTotal = totalAmount;

    document.getElementById('payTotalLabel').innerText = currencyFormatter.format(totalAmount);
    document.getElementById('payAmountInput').value = totalAmount;
    document.getElementById('payDateInput').value = new Date().toISOString().split('T')[0];
    
    // Populate Receiver Dropdown
    const receiverSelect = document.getElementById('payReceiverInput');
    if (receiverSelect && typeof appSettings !== 'undefined' && appSettings.receiving_accounts) {
        receiverSelect.innerHTML = '<option value="">-- Select Member --</option>';
        const names = [...new Set(appSettings.receiving_accounts.map(acc => acc.owner_name).filter(n => n))];
        names.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.innerText = name;
            receiverSelect.appendChild(opt);
        });
    }

    calculateAdjustments();
    document.getElementById('paymentModal').classList.remove('hidden');
    document.querySelector('#paymentModal .btn-primary').onclick = confirmHistoryPaymentRecord;
}

function calculateAdjustments() {
    const paid = parseFloat(document.getElementById('payAmountInput').value) || 0;
    const balance = hPendingPayTotal - paid;
    const section = document.getElementById('adjustmentSection');
    const label = document.getElementById('payBalanceLabel');
    const desc = document.getElementById('adjDescription');
    const type = document.getElementById('adjType').value;

    if (balance > 0) {
        section.classList.remove('hidden');
        label.innerText = currencyFormatter.format(balance);
        
        const texts = {
            'CARRY': `Balance ${currencyFormatter.format(balance)} will be added to the next month's invoice.`,
            'DISCOUNT': `Record ${currencyFormatter.format(balance)} as a one-time discount. Bill will be fully settled.`,
            'WRITEOFF': `Record ${currencyFormatter.format(balance)} as a loss/write-off. Bill will be fully settled.`
        };
        desc.innerText = texts[type] || '';
    } else {
        section.classList.add('hidden');
    }
}

async function confirmHistoryPaymentRecord() {
    const paid = parseFloat(document.getElementById('payAmountInput').value) || 0;
    const balance = Math.max(0, hPendingPayTotal - paid);
    const adjType = document.getElementById('adjType').value;

    const data = { 
        payment_method: document.getElementById('payMethodInput').value, 
        payment_date: document.getElementById('payDateInput').value,
        payment_details: document.getElementById('payReceiverInput').value,
        paid_amount: paid,
        discount_amount: (balance > 0 && adjType === 'DISCOUNT') ? balance : 0,
        write_off_amount: (balance > 0 && adjType === 'WRITEOFF') ? balance : 0,
        arrears_amount: (balance > 0 && adjType === 'CARRY') ? balance : 0
    };

    if (isNaN(data.paid_amount) || data.paid_amount <= 0) return showNotification("Enter valid amount", "error");

    try {
        await API.bills.pay(hPendingPayBillId, data);
        showNotification("Payment recorded", "success");
        document.getElementById('paymentModal').classList.add('hidden');
        loadTenantHistory(hPendingPayRenterId);
        loadDashboardStats();
    } catch (e) { showNotification("Update failed", "error"); }
}

let hPendingDeleteBillId = null, hPendingDeleteBillRenterId = null;
async function deleteHistoryBill(billId, renterId) {
    hPendingDeleteBillId = billId; hPendingDeleteBillRenterId = renterId;
    document.getElementById('confirmationTitle').innerText = "Delete Bill Record";
    document.getElementById('deletePinModal').classList.remove('hidden');
    document.getElementById('deletePinInput').value = '';
    document.querySelector('#deletePinModal .btn-danger').onclick = confirmHistoryDeleteAction;
}

async function confirmHistoryDeleteAction() {
    const pin = document.getElementById('deletePinInput').value;
    try {
        await API.auth.checkPin(pin);
        await API.bills.delete(hPendingDeleteBillId);
        showNotification("Bill deleted", "success");
        document.getElementById('deletePinModal').classList.add('hidden');
        loadTenantHistory(hPendingDeleteBillRenterId);
        loadDashboardStats();
    } catch (e) { showNotification("Unauthorized", "error"); }
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
}

function confirmPaymentRecord() {
    // This is the default handler, but history context overrides it in openHistoryPaymentModal
    confirmHistoryPaymentRecord();
}

