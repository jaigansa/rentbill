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
    const ownersContent = document.getElementById('owners-payouts');
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
        populateWithdrawalFilters();
        loadWithdrawals();
    }
}

async function loadTenantHistory(renterId) {
    if (!renterId) return;
    currentHistoryRenterId = renterId;
    
    // Sync the select dropdown if it's not already set
    const select = document.getElementById('historyTenantSelect');
    if (select && select.value !== renterId.toString()) {
        select.value = renterId;
    }
    
    const resultsDiv = document.getElementById('historyResults');
    const emptyState = document.getElementById('historyEmptyState');
    const historyBody = document.getElementById('historyBody');
    const nameLabel = document.getElementById('historySelectedName');

    if (resultsDiv) resultsDiv.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');
    
    // Clear previous state immediately
    if (resetHistoryScroll) {
        resetHistoryScroll();
        resetHistoryScroll = null;
    }
    if (historyBody) historyBody.innerHTML = '';

    try {
        const renter = await API.tenants.getOne(renterId);
        nameLabel.innerText = renter.name;
        
        // Populate Summary
        const balEl = document.getElementById('histStatBalance');
        const advEl = document.getElementById('histStatAdvance');
        if (balEl) balEl.innerText = currencyFormatter.format(renter.balance || 0);
        if (advEl) advEl.innerText = currencyFormatter.format(renter.advance_amount || 0);

        // Clear loading state
        if (historyBody) historyBody.innerHTML = '';

        resetHistoryScroll = setupInfiniteScroll(
            historyBody,
            async (offset, limit) => {
                const data = await API.bills.getByRenter(renterId, limit, offset);
                return data;
            },
            (b) => `
                <div class="history-card" id="row-${b.id}">
                    <div class="history-card-main">
                        <div class="history-card-info">
                            <div class="history-month">${b.billing_month.toUpperCase()}</div>
                            <div class="history-date">
                                <i data-lucide="clock"></i> ${new Date(b.date_generated).toLocaleDateString('en-IN', {day:'2-digit', month:'short'})}
                            </div>
                        </div>
                        <div class="history-card-amount">
                            <div class="amount">${currencyFormatter.format(b.total_amount)}</div>
                            <span class="badge ${b.is_paid ? 'badge-success' : 'badge-danger'}" style="font-size: 0.6rem; padding: 2px 8px;">
                                ${b.is_paid ? 'SETTLED' : 'DUE'}
                            </span>
                        </div>
                    </div>
                    <div class="history-card-footer">
                        ${b.is_paid ? `<div class="payment-method">Paid via ${b.payment_method || 'CASH'}</div>` : '<div></div>'}
                        <div class="history-actions no-print">
                            <button class="btn-icon" onclick="prepareAndShare('bill', ${b.id})" title="Share Statement"><i data-lucide="share-2"></i></button>
                            ${!b.is_paid ? `<button class="btn-icon btn-primary" onclick="openHistoryPaymentModal(${b.id}, ${b.total_amount})" title="Record Payment"><i data-lucide="credit-card"></i></button>` : ''}
                            <button class="btn-icon btn-danger" onclick="deleteBill(${b.id})" title="Delete Record"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>
                </div>
            `,
            { limit: 10, triggerId: 'history-scroll-trigger' }
        );

    } catch (e) { console.error("History failed", e); }
}

function loadMoreTenantHistory() {
    // Handled by infinite scroll
}

async function printTenantStatement() {
    if (!currentHistoryRenterId) return;
    
    // Populate branding for print
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RENTBILL PRO';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';
    
    // We'll use the shareData mechanism or inject a temporary branding div
    const resultsDiv = document.getElementById('historyResults');
    const existingBranding = resultsDiv.querySelector('.print-branding');
    if (existingBranding) existingBranding.remove();

    const tenantName = document.getElementById('historySelectedName')?.innerText || 'All Tenants';

    const brandingHtml = `
        <div class="print-branding print-only" style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 1.5rem; margin-bottom: 2rem; width: 100%; font-family: var(--font-main), sans-serif;">
            <h2 style="margin: 0; font-size: 1.4rem; text-transform: uppercase; font-weight: 900;">${propName}</h2>
            <p style="margin: 4px 0; font-size: 0.9rem; color: #333;">${propAddr}</p>
            <div style="margin-top: 15px; font-weight: 900; background: #000; color: #fff !important; display: inline-block; padding: 5px 20px; font-size: 1rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px;">TENANT STATEMENT OF ACCOUNT</div>
            <p style="margin: 12px 0 0 0; font-size: 0.85rem; font-weight: 900; color: #000; text-transform: uppercase;">STATEMENT FOR: ${tenantName}</p>
            <p style="margin: 4px 0 0 0; font-size: 0.75rem; color: #555;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
        </div>
    `;

    
    resultsDiv.insertAdjacentHTML('afterbegin', brandingHtml);

    // Hide the "Action" column for printing
    const style = document.createElement('style');
    style.id = 'print-hide-actions';
    style.innerHTML = '@media print { .history-actions, .no-print { display: none !important; } .history-card { border: 1px solid #000 !important; margin-bottom: 10px; } }';
    document.head.appendChild(style);

    // Trigger native print
    window.print();

    // Cleanup after printing
    setTimeout(() => {
        const branding = resultsDiv.querySelector('.print-branding');
        if (branding) branding.remove();
        const styleEl = document.getElementById('print-hide-actions');
        if (styleEl) styleEl.remove();
    }, 500);
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
            payment_details: receiver,
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

function calculateAdjustments() {
    const total = parseFloat(document.getElementById('payTotalLabel').innerText.replace(/[^\d.]/g, '')) || 0;
    const paid = parseFloat(document.getElementById('payAmountInput').value) || 0;
    const balance = total - paid;
    
    const adjSection = document.getElementById('adjustmentSection');
    const balanceLabel = document.getElementById('payBalanceLabel');
    const adjType = document.getElementById('adjType').value;
    const adjDesc = document.getElementById('adjDescription');

    if (balance > 0) {
        adjSection.classList.remove('hidden');
        balanceLabel.innerText = currencyFormatter.format(balance);
        
        if (adjType === 'CARRY') {
            adjDesc.innerText = "Remaining balance will be added to the next month's bill as arrears.";
        } else if (adjType === 'DISCOUNT') {
            adjDesc.innerText = "Balance will be marked as a discount/waiver. Total collected will be less.";
        } else if (adjType === 'WRITEOFF') {
            adjDesc.innerText = "Balance will be written off as a loss. Used for rounding off small amounts.";
        }
    } else {
        adjSection.classList.add('hidden');
    }
}
