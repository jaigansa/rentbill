async function loadExpenses() {
    const listDiv = document.getElementById('expenseList');
    if (!listDiv) return;
    try {
        const expenses = await API.expenses.getAll();
        if (!expenses || expenses.length === 0) {
            listDiv.innerHTML = '<p style="text-align:center; font-size:0.75rem; color:var(--text-muted); padding:2rem;">No maintenance logs yet.</p>';
            return;
        }
        listDiv.innerHTML = expenses.map(e => `
            <div class="tenant-row" style="padding: 1rem; border-left: 4px solid var(--danger);">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">${e.date} &bull; ${e.category}</div>
                        <div style="font-weight: 900; font-size: 0.9rem; text-transform: uppercase;">${e.notes || 'Maintenance Work'}</div>
                        <div style="font-size: 0.6rem; color: var(--text-muted); margin-top: 2px;">PAID BY: ${e.owner_name || 'System / Cash'}</div>
                    </div>
                    <div style="text-align: right; display: flex; align-items: center; gap: 1rem;">
                        <div style="font-weight: 900; font-size: 1rem; color: var(--danger);">${currencyFormatter.format(e.amount)}</div>
                        <button onclick="deleteExpense(${e.id})" class="btn btn-secondary btn-icon-sm" style="border: none; background: transparent;">
                            <i data-lucide="trash-2" style="width: 16px; color: var(--danger);"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        lucide.createIcons();
    } catch (e) { console.error("Expenses failed", e); }
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
