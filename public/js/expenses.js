function toggleExpenseForm() {
    const el = document.getElementById('expense-form');
    if (!el) return;
    el.classList.toggle('hidden');
    if (!el.classList.contains('hidden')) {
        const dateInput = document.getElementById('eDate');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    }
    const btn = document.getElementById('expToggleBtn');
    if (btn) btn.innerText = el.classList.contains('hidden') ? "Record Expense" : "Hide Form";
}

async function addExpense() {
    const data = {
        category: document.getElementById('eCategory').value,
        amount: parseFloat(document.getElementById('eAmount').value),
        date: document.getElementById('eDate').value,
        notes: document.getElementById('eNotes').value
    };
    if (!data.amount || !data.date) return showNotification("Fill amount and date", "error");
    try {
        await API.expenses.create(data);
        showNotification("Expense recorded", "success");
        document.getElementById('eAmount').value = ''; 
        document.getElementById('eNotes').value = '';
        toggleExpenseForm(); 
        loadExpenses(); 
        loadDashboardStats(); 
        renderIncomeChart();
    } catch (e) { showNotification(e.message, "error"); }
}

async function loadExpenses() {
    try {
        const expenses = await API.expenses.getAll();
        const listDiv = document.getElementById('expenseList');
        if (!listDiv) return;
        if (expenses.length === 0) {
            listDiv.innerHTML = `
                <div class="empty-state">
                    <i data-lucide="trending-down"></i>
                    <p>No maintenance logs found</p>
                </div>`;
            lucide.createIcons();
            return;
        }
        listDiv.innerHTML = '';
        expenses.forEach(e => listDiv.appendChild(UI.renderExpenseItem(e, deleteExpense)));
        lucide.createIcons();
    } catch (e) { console.error(e); }
}

async function deleteExpense(id) {
    if (!confirm("Delete this record?")) return;
    try {
        await API.expenses.delete(id);
        loadExpenses(); loadDashboardStats();
    } catch (e) { showNotification(e.message, "error"); }
}
