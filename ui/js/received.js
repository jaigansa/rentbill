/**
 * Income Service: Handles display of paid bills and income records
 */

async function loadReceivedPayments(owner = null) {
    const listDiv = document.getElementById('receivedPaymentsList');
    const filterSelect = document.getElementById('receivedOwnerFilter');
    if (!listDiv) return;

    if (owner === null) {
        owner = filterSelect ? filterSelect.value : '';
    }

    // Refresh Owner Filter if empty
    if (filterSelect && filterSelect.options.length <= 1) {
        populateReceivedFilters();
    }

    listDiv.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted); font-weight: 800;">Syncing income records...</div>';

    try {
        const allPaid = await API.bills.getAllPaidBills();
        const filtered = owner ? allPaid.filter(b => b.assigned_owner === owner) : allPaid;

        if (filtered.length === 0) {
            listDiv.innerHTML = '<p style="text-align:center; font-size:0.75rem; color:var(--text-muted); padding: 2rem;">No paid records found for this selection.</p>';
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
                            UNIT ${b.room_no} • ${b.billing_month}
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
