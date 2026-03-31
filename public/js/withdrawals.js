let hFullPayouts = [];
let hPayoutsVisibleCount = 10;

async function loadWithdrawals() {
    const listDiv = document.getElementById('withdrawalList');
    const loadMoreBtn = document.getElementById('payoutLoadMoreContainer');
    if (!listDiv) return;
    try {
        const withdrawals = await API.withdrawals.getAll();
        hFullPayouts = withdrawals || [];
        hPayoutsVisibleCount = 10;
        renderPayoutsSlice();
    } catch (e) { console.error("Withdrawals failed", e); }
}

function renderPayoutsSlice() {
    const listDiv = document.getElementById('withdrawalList');
    const loadMoreBtn = document.getElementById('payoutLoadMoreContainer');
    if (!listDiv) return;

    const slice = hFullPayouts.slice(0, hPayoutsVisibleCount);

    if (slice.length === 0) {
        listDiv.innerHTML = '<p style="text-align:center; font-size:0.7rem; color:var(--text-muted); padding:2rem;">No payout records yet.</p>';
        if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
        return;
    }

    listDiv.innerHTML = slice.map(w => UI.renderWithdrawalItem(w, deleteWithdrawal)).join('');
    
    if (hPayoutsVisibleCount < hFullPayouts.length) {
        loadMoreBtn?.classList.remove('hidden');
    } else {
        loadMoreBtn?.classList.add('hidden');
    }
    lucide.createIcons();
}

function loadMoreWithdrawals() {
    hPayoutsVisibleCount += 10;
    renderPayoutsSlice();
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
    const names = [...new Set(appSettings.receiving_accounts.map(a => a.owner_name))].filter(n => n);
    select.innerHTML = '<option value="">-- Select --</option>';
    names.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.innerText = n;
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
