let resetWithdrawalsScroll = null;

async function loadWithdrawals() {
    const listDiv = document.getElementById('withdrawalList');
    if (!listDiv) return;

    if (resetWithdrawalsScroll) {
        resetWithdrawalsScroll();
    }

    resetWithdrawalsScroll = setupInfiniteScroll(
        listDiv,
        async (offset, limit) => {
            const data = await API.withdrawals.getAll(limit, offset);
            return data;
        },
        (w) => UI.renderWithdrawalItem(w, deleteWithdrawal),
        { limit: 20, triggerId: 'withdrawals-scroll-trigger' }
    );
}

function loadMoreWithdrawals() {
    // This is now handled by infinite scroll, but we keep the name for compatibility
    // with any other calls that might exist.
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
        loadWithdrawals();
        loadDashboardStats();
    } catch (e) { showNotification("Failed to save", "error"); }
}

async function deleteWithdrawal(id) {
    if (!confirm("Delete this record?")) return;
    try {
        await API.withdrawals.delete(id);
        showNotification("Deleted", "success");
        loadWithdrawals();
        loadDashboardStats();
    } catch (e) { showNotification("Delete failed", "error"); }
}
