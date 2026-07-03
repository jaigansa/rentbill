/**
 * Income Service: Handles display of paid bills and income records
 */

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

    // Refresh Owner Filter if empty
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

        // Sort by payment date descending
        filtered.sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date));

        listDiv.innerHTML = filtered.map(b => `
            <div class="tenant-row" style="padding: 1rem; border: 1.5px solid var(--border); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 0;">
                    <!-- Date Box -->
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

async function printIncomeHistory() {
    const propName = (typeof appSettings !== 'undefined' && appSettings.property_name) || 'RENTBILL PRO';
    const propAddr = (typeof appSettings !== 'undefined' && appSettings.property_address) || '';
    
    const listDiv = document.getElementById('owners-received');
    if (!listDiv) return;
    
    const existingBranding = listDiv.querySelector('.print-branding');
    if (existingBranding) existingBranding.remove();

    const fromDate = document.getElementById('receivedFromDate')?.value;
    const toDate = document.getElementById('receivedToDate')?.value;
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
            <div style="margin-top: 20px; font-weight: 900; background: var(--primary); color: #fff !important; display: inline-block; padding: 6px 25px; font-size: 1rem; border-radius: 6px; text-transform: uppercase; letter-spacing: 1.5px;">INCOME COLLECTION STATEMENT</div>
            ${periodInfo ? `<p style="margin: 15px 0 0 0; font-size: 0.8rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">${periodInfo}</p>` : ''}

            <div style="margin-top: 25px; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: left; border: 1.5px solid var(--border); padding: 15px; border-radius: 8px;">
                <div>
                    <p style="margin: 0; font-size: 0.7rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Statement For</p>
                    <p style="margin: 4px 0 0 0; font-size: 1.1rem; font-weight: 900; color: var(--primary); text-transform: uppercase;">${currentReceivedOwnerFilter ? currentReceivedOwnerFilter : 'ALL OWNERS'}</p>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 0; font-size: 0.7rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Total Received</p>
                    <p style="margin: 4px 0 0 0; font-size: 1.1rem; font-weight: 900; color: var(--success);">${currencyFormatter.format(totalAmount)}</p>
                </div>
            </div>

            <p style="margin: 15px 0 0 0; font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; text-align: left;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
        </div>
    `;

    listDiv.insertAdjacentHTML('afterbegin', brandingHtml);

    const style = document.createElement('style');
    style.id = 'print-hide-income-actions';
    style.innerHTML = `
        @media print { 
            body { background: white !important; color: black !important; }
            .no-print, .sub-nav { display: none !important; } 
            #owners-received { display: block !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
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
        const styleEl = document.getElementById('print-hide-income-actions');
        if (styleEl) styleEl.remove();
    }, 500);
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
