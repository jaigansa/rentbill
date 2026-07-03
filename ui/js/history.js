let hFullBills = [];
let hBillsVisibleCount = 10;
let currentHistoryRenterId = null;
let resetHistoryScroll = null;
let hAllTenants = []; // Global cache for all tenants for instant lookup

async function initHistorySection(reset = false) {
    const select = document.getElementById('historyTenantSelect');
    if (!select) return;
    
    if (reset) {
        select.value = "";
        const resultsDiv = document.getElementById('historyResults');
        const emptyState = document.getElementById('historyEmptyState');
        if (resultsDiv) resultsDiv.classList.add('hidden');
        if (emptyState) emptyState.classList.remove('hidden');
    }

    try {
        // If cache is empty, fetch data
        if (!window.allTenants.length && !window.historyTenants.length) {
            await refreshGlobalTenantCache();
        }
        
        const combined = [...(window.allTenants || []), ...(window.historyTenants || [])];
        const currentVal = select.value;
        select.innerHTML = '<option value="">-- Select Unit for History --</option>';
        
        if (combined.length === 0) return;

        combined.sort((a, b) => a.room_no.localeCompare(b.room_no, undefined, {numeric: true}));
        
        combined.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            const status = t.is_active === 0 ? ' (VACATED)' : '';
            opt.innerText = `UNIT ${t.room_no} • ${t.name}${status}`;
            select.appendChild(opt);
        });
        select.value = currentVal;
    } catch (e) { console.error("Failed to load tenants for history", e); }
}

async function loadTenantHistory(renterId) {
    if (!renterId) return;
    currentHistoryRenterId = renterId;
    
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
    
    if (resetHistoryScroll) {
        resetHistoryScroll();
        resetHistoryScroll = null;
    }
    if (historyBody) historyBody.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-weight: 800;">Syncing records...</div>';

    try {
        const [renters, ledger] = await Promise.all([
            API.tenants.getAll(),
            API.bills.getTenantLedger()
        ]);
        window.allTenants = renters || [];
        
        const combined = [...window.allTenants, ...(window.historyTenants || [])];
        const renter = combined.find(t => t.id == renterId);
        const ledgerEntry = (ledger || []).find(l => l.id == renterId);
        
        if (renter) {
            nameLabel.innerText = renter.name;
            const balEl = document.getElementById('histStatBalance');
            const paidEl = document.getElementById('histStatPaid');
            const advEl = document.getElementById('histStatAdvance');
            
            // Use ledger entry for most accurate financial data if available
            const balance = ledgerEntry ? ledgerEntry.balance : (renter.balance || 0);
            const totalPaid = ledgerEntry ? ledgerEntry.total_paid : 0;
            
            if (balEl) balEl.innerText = currencyFormatter.format(balance);
            if (paidEl) paidEl.innerText = currencyFormatter.format(totalPaid);
            if (advEl) advEl.innerText = currencyFormatter.format(renter.advance_amount || 0);
        }

        resetHistoryScroll = setupInfiniteScroll(
            historyBody,
            async (offset, limit) => {
                const data = await API.bills.getByRenter(renterId, limit, offset);
                if (offset === 0 && historyBody) historyBody.innerHTML = '';
                return data;
            },
            (b) => {
                if (!b) return '';
                const month = (b.billing_month || 'JAN').slice(0, 3);
                const dateNum = b.date_generated ? new Date(b.date_generated).getDate() : '--';
                return `
                <div class="tenant-row" id="row-${b.id}" style="padding: 0.6rem 1rem; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between; border-color: var(--border); gap: 1rem;">
                    <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 0;">
                        <div style="width: 38px; height: 38px; background: var(--primary-light); color: var(--primary); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; border: 1px solid var(--primary-light);">
                            <span style="font-size: 0.5rem; font-weight: 900; text-transform: uppercase; line-height: 1; opacity: 0.8;">${month}</span>
                            <span style="font-size: 0.85rem; font-weight: 900;">${dateNum}</span>
                        </div>
                        <div style="min-width: 0;">
                            <div style="font-weight: 900; font-size: 0.95rem; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                                ${currencyFormatter.format(b.total_amount)}
                                ${b.is_paid ? '<i data-lucide="check-circle" class="icon-success" style="width: 14px; height: 14px;"></i>' : ''}
                            </div>
                            <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px;">
                                ${b.is_paid ? `Paid via ${b.payment_method || 'CASH'}` : '<span style="color: var(--danger);">Payment Overdue</span>'}
                            </div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span class="badge ${b.is_paid ? 'badge-success' : 'badge-danger'}" style="font-size: 0.5rem; padding: 2px 6px; border-radius: 4px; height: fit-content; border: none;">
                            ${b.is_paid ? 'SETTLED' : 'DUE'}
                        </span>
                        <div class="history-actions no-print" style="display: flex; gap: 0.5rem;">
                            <button class="btn btn-secondary btn-icon-sm" onclick="prepareAndShare('bill', ${b.id})" title="Share" style="width: 32px; height: 32px;"><i data-lucide="share-2"></i></button>
                            ${!b.is_paid ? `<button class="btn btn-primary btn-icon-sm" onclick="openHistoryPaymentModal(${b.id}, ${b.total_amount})" title="Pay" style="width: 32px; height: 32px;"><i data-lucide="credit-card"></i></button>` : ''}
                            <button class="btn btn-danger btn-icon-sm" onclick="deleteBill(${b.id})" title="Delete" style="width: 32px; height: 32px;"><i data-lucide="trash-2"></i></button>
                        </div>
                    </div>
                </div>`;
            },
            { limit: 10, triggerId: 'history-scroll-trigger' }
        );

        setTimeout(() => { if (typeof lucide !== 'undefined') lucide.createIcons(); }, 100);

    } catch (e) { console.error("History failed", e); }
}

function loadMoreTenantHistory() {
    // Handled by infinite scroll
}

async function printTenantStatement() {
    if (!currentHistoryRenterId) return;
    
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RENTBILL PRO';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';
    
    const resultsDiv = document.getElementById('historyResults');
    const existingBranding = resultsDiv.querySelector('.print-branding');
    if (existingBranding) existingBranding.remove();

    const tenantName = document.getElementById('historySelectedName')?.innerText || 'All Tenants';

    const brandingHtml = `
        <div class="print-branding print-only" style="text-align: center; border-bottom: 2px solid var(--primary); padding-bottom: 2rem; margin-bottom: 2rem; width: 100%; font-family: var(--font-main), sans-serif; background: white;">
            <h2 style="margin: 0; font-size: 1.6rem; text-transform: uppercase; font-weight: 900; color: var(--primary); letter-spacing: 1px;">${propName}</h2>
            <p style="margin: 6px 0; font-size: 0.95rem; color: var(--text-muted); font-weight: 600;">${propAddr}</p>
            <div style="margin-top: 20px; font-weight: 900; background: var(--primary); color: #fff !important; display: inline-block; padding: 6px 25px; font-size: 1rem; border-radius: 6px; text-transform: uppercase; letter-spacing: 1.5px;">TENANT STATEMENT OF ACCOUNT</div>
            <p style="margin: 15px 0 0 0; font-size: 0.9rem; font-weight: 900; color: var(--text-main); text-transform: uppercase;">STATEMENT FOR: <span style="border-bottom: 1.5px solid var(--border);">${tenantName}</span></p>
            <p style="margin: 6px 0 0 0; font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
        </div>
    `;

    resultsDiv.insertAdjacentHTML('afterbegin', brandingHtml);

    const style = document.createElement('style');
    style.id = 'print-hide-actions';
    style.innerHTML = `
        @media print { 
            body { background: white !important; color: black !important; }
            .app-section, .no-print, .sub-nav, #historyTenantSelect, .card-header, #historyEmptyState, .history-actions, .modal-overlay { display: none !important; } 
            #historyResults { display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
            .card { border: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
            .tenant-row { 
                border: 1px solid #eee !important; 
                margin-bottom: 8px !important; 
                padding: 12px !important; 
                break-inside: avoid; 
                flex-direction: row !important; 
                align-items: center !important; 
                background: white !important;
                border-radius: 0 !important;
                box-shadow: none !important;
            } 
            .tenant-row > div:first-child { 
                background: transparent !important; 
                border: none !important; 
            }
            .room-badge { border: 1px solid #000 !important; color: black !important; background: white !important; }
            @page { margin: 1.5cm; }
        }
    `;
    document.head.appendChild(style);

    window.print();

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
    
    window.confirmPaymentRecord = confirmHistoryPaymentRecord;
    
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
    
    if (paid > total) {
        showNotification("Paid amount cannot exceed total amount", "error");
        document.getElementById('payAmountInput').value = total;
        calculateAdjustments();
        return;
    }
    
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
