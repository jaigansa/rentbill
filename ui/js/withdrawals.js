let resetWithdrawalsScroll = null;
let currentWithdrawalOwnerFilter = '';

async function loadWithdrawals(owner = null) {
    const listDiv = document.getElementById('withdrawalList');
    if (!listDiv) return;

    // If owner is null, it means we're calling from navigation or refresh
    // Try to get current filter value, fallback to ''
    if (owner === null) {
        const filterSelect = document.getElementById('payoutOwnerFilter');
        owner = filterSelect ? filterSelect.value : '';
    }

    currentWithdrawalOwnerFilter = owner;
    
    const fromDate = document.getElementById('payoutFromDate')?.value || '';
    const toDate = document.getElementById('payoutToDate')?.value || '';

    // Refresh Owner Filter if empty
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
    // Populate branding for print
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RENTBILL PRO';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';
    
    const listDiv = document.getElementById('owners-payouts');
    if (!listDiv) return;
    
    const existingBranding = listDiv.querySelector('.print-branding');
    if (existingBranding) existingBranding.remove();

    const fromDate = document.getElementById('payoutFromDate')?.value;
    const toDate = document.getElementById('payoutToDate')?.value;
    const periodInfo = (fromDate || toDate) ? `PERIOD: ${fromDate || '...'} to ${toDate || '...'}` : '';

    // Calculate Total for the current view
    let totalAmount = 0;
    const items = listDiv.querySelectorAll('.tenant-row');
    items.forEach(item => {
        const text = item.innerText || '';
        const match = text.match(/₹\s?([0-9,.]+)/);
        if (match) {
            totalAmount += parseFloat(match[1].replace(/,/g, ''));
        }
    });

    const brandingHtml = `
        <div class="print-branding print-only" style="text-align: center; border-bottom: 2px solid var(--primary); padding-bottom: 2rem; margin-bottom: 2rem; width: 100%; font-family: var(--font-main), sans-serif; background: white;">
            <h2 style="margin: 0; font-size: 1.6rem; text-transform: uppercase; font-weight: 900; color: var(--primary); letter-spacing: 1px;">${propName}</h2>
            <p style="margin: 6px 0; font-size: 0.95rem; color: var(--text-muted); font-weight: 600;">${propAddr}</p>
            <div style="margin-top: 20px; font-weight: 900; background: var(--primary); color: #fff !important; display: inline-block; padding: 6px 25px; font-size: 1rem; border-radius: 6px; text-transform: uppercase; letter-spacing: 1.5px;">OWNER PAYOUT STATEMENT</div>
            ${periodInfo ? `<p style="margin: 15px 0 0 0; font-size: 0.8rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">${periodInfo}</p>` : ''}

            <div style="margin-top: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: left; border: 1.5px solid var(--border); padding: 15px; border-radius: 8px;">
                <div>
                    <p style="margin: 0; font-size: 0.7rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Statement For</p>
                    <p style="margin: 4px 0 0 0; font-size: 1.1rem; font-weight: 900; color: var(--primary); text-transform: uppercase;">${currentWithdrawalOwnerFilter ? currentWithdrawalOwnerFilter : 'ALL OWNERS'}</p>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 0; font-size: 0.7rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Total Payout Amount</p>
                    <p style="margin: 4px 0 0 0; font-size: 1.1rem; font-weight: 900; color: var(--text-main);">${currencyFormatter.format(totalAmount)}</p>
                </div>
            </div>

            <p style="margin: 15px 0 0 0; font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; text-align: left;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
        </div>
    `;

    listDiv.insertAdjacentHTML('afterbegin', brandingHtml);

    // Hide actions column/buttons
    const style = document.createElement('style');
    style.id = 'print-hide-payout-actions';
    style.innerHTML = `
        @media print { 
            body { background: white !important; color: black !important; }
            .withdrawal-actions, #witToggleBtn, .no-print, .withdrawal-form-container, .sub-nav { display: none !important; } 
            #owners-payouts { display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
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
            @page { margin: 1.5cm; }
        }
    `;
    document.head.appendChild(style);

    window.print();

    setTimeout(() => {
        const branding = listDiv.querySelector('.print-branding');
        if (branding) branding.remove();
        const styleEl = document.getElementById('print-hide-payout-actions');
        if (styleEl) styleEl.remove();
    }, 500);
}
