let hFullBills = [];
let hBillsVisibleCount = 10;
let currentHistoryRenterId = null;
let resetHistoryScroll = null;

async function initHistorySection(reset = false) {
    const select = document.getElementById('historyTenantSelect');
    if (!select) return;
    
    if (reset) {
        select.value = "";
        const resultsDiv = document.getElementById('historyResults');
        const emptyState = document.getElementById('historyEmptyState');
        if (resultsDiv) resultsDiv.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
        toggleHistoryMode('tenants');
    }

    try {
        const tenants = await API.tenants.getAll();
        const historyTenants = await API.tenants.getHistory();
        const allTenants = [...tenants, ...historyTenants];
        
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Unit / Tenant --</option>';
        
        allTenants.sort((a, b) => a.room_no.localeCompare(b.room_no, undefined, {numeric: true}));
        
        allTenants.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            const status = t.is_active === 0 ? ' (ARCHIVED)' : '';
            opt.innerText = `UNIT ${t.room_no} • ${t.name}${status}`;
            select.appendChild(opt);
        });
        select.value = currentVal;
        
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
        loadWithdrawals();
    }
}

async function loadTenantHistory(renterId) {
    if (!renterId) return;
    currentHistoryRenterId = renterId;
    
    const resultsDiv = document.getElementById('historyResults');
    const emptyState = document.getElementById('historyEmptyState');
    const historyBody = document.getElementById('historyBody');
    const nameLabel = document.getElementById('historySelectedName');

    if (resultsDiv) resultsDiv.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    
    try {
        const renter = await API.tenants.getOne(renterId);
        nameLabel.innerText = renter.name;

        if (resetHistoryScroll) {
            resetHistoryScroll();
        }

        resetHistoryScroll = setupInfiniteScroll(
            historyBody,
            async (offset, limit) => {
                const data = await API.bills.getByRenter(renterId, limit, offset);
                return data;
            },
            (b) => `
                <tr id="row-${b.id}">
                    <td>
                        <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-main);">${b.billing_month.toUpperCase()}</div>
                        <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Generated: ${new Date(b.date_generated).toLocaleDateString('en-IN')}</div>
                    </td>
                    <td>
                        <div style="font-weight: 900; color: var(--primary); font-size: 1rem;">${currencyFormatter.format(b.total_amount)}</div>
                        ${b.is_paid ? `<div style="font-size: 0.6rem; color: var(--success); font-weight: 800;">PAID: ${currencyFormatter.format(b.paid_amount)}</div>` : ''}
                    </td>
                    <td>
                        <span class="badge" style="font-size: 0.6rem; padding: 4px 8px; background: ${b.is_paid ? 'var(--bg-success-light)' : 'var(--bg-danger-light)'}; color: ${b.is_paid ? 'var(--success)' : 'var(--danger)'}; border-color: ${b.is_paid ? 'var(--success)' : 'var(--danger)'};">
                            ${b.is_paid ? 'SETTLED' : 'PENDING'}
                        </span>
                    </td>
                    <td class="history-actions-mobile">
                        <div style="display: flex; gap: 0.25rem;">
                            <button class="btn btn-secondary btn-icon-sm" onclick="prepareAndShare('bill', ${b.id})" title="Share"><i data-lucide="share-2" width="14" height="14"></i></button>
                            ${!b.is_paid ? `<button class="btn btn-primary btn-icon-sm" onclick="openHistoryPaymentModal(${b.id}, ${b.total_amount})" title="Pay"><i data-lucide="credit-card" width="14" height="14"></i></button>` : ''}
                            <button class="btn btn-secondary btn-icon-sm" onclick="deleteBill(${b.id})" title="Delete" style="color: var(--danger);"><i data-lucide="trash-2" width="14" height="14"></i></button>
                        </div>
                    </td>
                </tr>
            `,
            { limit: 10, triggerId: 'history-scroll-trigger' }
        );

    } catch (e) { console.error("History failed", e); }
}

function loadMoreTenantHistory() {
    // Handled by infinite scroll
}

let pendingHistoryPaymentId = null;
function openHistoryPaymentModal(billId, total) {
    pendingHistoryPaymentId = billId;
    const modal = document.getElementById('paymentModal');
    if (!modal) return;
    
    document.getElementById('payTotalLabel').innerText = currencyFormatter.format(total);
    document.getElementById('payAmountInput').value = total;
    document.getElementById('payDateInput').value = new Date().toISOString().split('T')[0];
    
    // Custom confirm handler for history context
    window.confirmPaymentRecord = confirmHistoryPaymentRecord;
    
    // Populate receivers
    const recSelect = document.getElementById('payReceiverInput');
    if (recSelect && appSettings.receiving_accounts) {
        const names = [...new Set(appSettings.receiving_accounts.map(a => a.owner_name))].filter(n => n);
        recSelect.innerHTML = '<option value="">-- Select Member --</option>';
        names.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n;
            opt.innerText = n;
            recSelect.appendChild(opt);
        });
    }

    modal.classList.remove('hidden');
    calculateAdjustments();
}

async function confirmHistoryPaymentRecord() {
    const method = document.getElementById('payMethodInput').value;
    const receiver = document.getElementById('payReceiverInput').value;
    const date = document.getElementById('payDateInput').value;
    const paid = parseFloat(document.getElementById('payAmountInput').value);
    
    const disc = parseFloat(document.getElementById('adjType').value === 'DISCOUNT' ? document.getElementById('payBalanceLabel').innerText.replace(/[^\d.]/g, '') : 0) || 0;
    const woff = parseFloat(document.getElementById('adjType').value === 'WRITEOFF' ? document.getElementById('payBalanceLabel').innerText.replace(/[^\d.]/g, '') : 0) || 0;
    const arrs = parseFloat(document.getElementById('adjType').value === 'CARRY' ? document.getElementById('payBalanceLabel').innerText.replace(/[^\d.]/g, '') : 0) || 0;

    if (!receiver || isNaN(paid)) return showNotification("Fill all fields", "error");

    try {
        await API.bills.pay(pendingHistoryPaymentId, {
            payment_method: method,
            payment_details: `Received by ${receiver}`,
            payment_date: date,
            paid_amount: paid,
            discount_amount: disc,
            write_off_amount: woff,
            arrears_amount: arrs
        });
        showNotification("Payment recorded", "success");
        closePaymentModal();
        loadTenantHistory(currentHistoryRenterId);
        loadDashboardStats();
    } catch (e) { showNotification("Payment failed", "error"); }
}

async function deleteBill(id) {
    if (!confirm("Delete this bill record? This will revert any arrears added to tenant balance.")) return;
    try {
        await API.bills.delete(id);
        showNotification("Bill deleted", "success");
        loadTenantHistory(currentHistoryRenterId);
        loadDashboardStats();
    } catch (e) { showNotification("Delete failed", "error"); }
}

function closePaymentModal() {
    document.getElementById('paymentModal').classList.add('hidden');
}
