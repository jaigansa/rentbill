let currentTasks = [];
let pendingTaskId = null;

async function loadTasks() {
    const listDiv = document.getElementById('taskList');
    if (!listDiv) return;
    
    const status = document.getElementById('taskStatusFilter')?.value || 'ALL';

    try {
        const response = await fetch(`/api/maintenance?status=${status}`);
        const tasks = await response.json();
        currentTasks = tasks;
        renderTaskList(tasks);
    } catch (e) { console.error("Failed to load tasks", e); }
}

function renderTaskList(tasks) {
    const listDiv = document.getElementById('taskList');
    if (!listDiv) return;
    listDiv.innerHTML = '';

    if (!tasks || tasks.length === 0) {
        listDiv.innerHTML = '<div class="empty-state"><i data-lucide="wrench"></i><p>No maintenance tasks found</p></div>';
        lucide.createIcons();
        return;
    }

    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'tenant-row';
        card.style.padding = '1rem';
        card.style.borderLeft = `4px solid ${getPriorityColor(task.priority)}`;
        
        const isResolved = task.status === 'Resolved';
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span class="badge ${getStatusBadgeClass(task.status)}" style="font-size: 0.55rem; padding: 2px 6px;">${task.status.toUpperCase()}</span>
                        <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">${task.category}</span>
                        <span class="room-badge" style="height: auto; min-height: 0; padding: 2px 6px; font-size: 0.6rem; margin-left: auto;">${task.unit_room}</span>
                    </div>
                    <div style="font-weight: 900; font-size: 0.95rem; color: var(--text-main); margin-bottom: 4px;">${task.title}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; margin-bottom: 8px;">${task.description || 'No description'}</div>
                    <div style="display: flex; align-items: center; gap: 12px; font-size: 0.65rem; font-weight: 700; color: var(--text-muted);">
                        <span><i data-lucide="user" style="width: 10px; height: 10px; display: inline-block; margin-right: 2px;"></i> ${task.owner_name || 'Common'}</span>
                        <span><i data-lucide="calendar" style="width: 10px; height: 10px; display: inline-block; margin-right: 2px;"></i> ${task.date_reported}</span>
                        ${task.actual_cost > 0 ? `<span style="color: var(--success);"><i data-lucide="indian-rupee" style="width: 10px; height: 10px; display: inline-block; margin-right: 2px;"></i> ${currencyFormatter.format(task.actual_cost)}</span>` : (task.estimated_cost > 0 ? `<span><i data-lucide="calculator" style="width: 10px; height: 10px; display: inline-block; margin-right: 2px;"></i> Est: ${currencyFormatter.format(task.estimated_cost)}</span>` : '')}
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <button onclick="openTaskModal(${task.id})" class="btn btn-secondary btn-icon-sm" title="Manage Task"><i data-lucide="edit-3"></i></button>
                    ${isResolved && task.actual_cost > 0 ? `<button onclick="convertTaskToExpense(${task.id})" class="btn btn-secondary btn-icon-sm" title="Convert to Expense" style="color: var(--success);"><i data-lucide="arrow-right-left"></i></button>` : ''}
                </div>
            </div>
        `;
        listDiv.appendChild(card);
    });
    lucide.createIcons();
}

function getPriorityColor(priority) {
    switch (priority) {
        case 'High': return 'var(--danger)';
        case 'Medium': return 'var(--warning)';
        default: return 'var(--info)';
    }
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'Resolved': return 'badge-success';
        case 'In Progress': return 'badge-info';
        default: return 'badge-danger';
    }
}

function toggleTaskForm() {
    const modal = document.getElementById('createTaskModal');
    const isHidden = modal.classList.toggle('hidden');
    if (!isHidden) {
        document.body.classList.add('modal-open');
        document.getElementById('tTaskDateReported').value = new Date().toISOString().split('T')[0];
        populateTaskDropdowns();
    } else {
        document.body.classList.remove('modal-open');
    }
}

function populateTaskDropdowns() {
    // Units
    const unitSelect = document.getElementById('tTaskRenterId');
    if (unitSelect && window.allTenants) {
        const current = unitSelect.value;
        unitSelect.innerHTML = '<option value="">-- Common / Non-unit --</option>';
        window.allTenants.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.innerText = `UNIT ${t.room_no} - ${t.name}`;
            unitSelect.appendChild(opt);
        });
        unitSelect.value = current;
    }
    
    // Owners
    const ownerSelect = document.getElementById('tTaskOwner');
    if (ownerSelect && appSettings.receiving_accounts) {
        const current = ownerSelect.value;
        const owners = [...new Set(appSettings.receiving_accounts.map(a => a.owner_name))];
        ownerSelect.innerHTML = '<option value="">-- Select Owner --</option>';
        owners.forEach(o => {
            const opt = document.createElement('option');
            opt.value = o;
            opt.innerText = o.toUpperCase();
            ownerSelect.appendChild(opt);
        });
        ownerSelect.value = current;
    }
}

async function saveTask() {
    const title = document.getElementById('tTaskTitle').value;
    const desc = document.getElementById('tTaskDesc').value;
    const renterId = document.getElementById('tTaskRenterId').value;
    const category = document.getElementById('tTaskCategory').value;
    const priority = document.getElementById('tTaskPriority').value;
    const owner = document.getElementById('tTaskOwner').value;
    const estCost = parseFloat(document.getElementById('tTaskEstCost').value) || 0;
    const date = document.getElementById('tTaskDateReported').value;

    if (!title || !date) return showNotification("Title and Date are required", "error");

    const data = {
        title, 
        description: desc,
        renter_id: renterId ? parseInt(renterId) : null,
        category,
        priority,
        status: 'Pending',
        owner_name: owner,
        estimated_cost: estCost,
        date_reported: date
    };

    try {
        const res = await fetch('/api/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            showNotification("Ticket raised successfully", "success");
            toggleTaskForm();
            loadTasks();
            loadActivityLogs();
        } else {
            showNotification("Failed to save task", "error");
        }
    } catch (e) { console.error(e); }
}

function openTaskModal(id) {
    const task = currentTasks.find(t => t.id === id);
    if (!task) return;
    pendingTaskId = id;
    
    document.getElementById('mTaskStatus').value = task.status;
    document.getElementById('mTaskPriority').value = task.priority;
    document.getElementById('mTaskActualCost').value = task.actual_cost || 0;
    document.getElementById('mTaskDateResolved').value = task.date_resolved ? task.date_resolved.slice(0, 10) : '';
    document.getElementById('mTaskNotes').value = '';
    
    toggleConvertOption();

    document.getElementById('taskModal').classList.remove('hidden');
    document.body.classList.add('modal-open');
}

function closeTaskModal() {
    document.getElementById('taskModal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    pendingTaskId = null;
}

function toggleConvertOption() {
    const status = document.getElementById('mTaskStatus').value;
    const option = document.getElementById('convertOption');
    option.classList.toggle('hidden', status !== 'Resolved');
}

document.getElementById('mTaskStatus')?.addEventListener('change', toggleConvertOption);

async function updateTaskConfirm() {
    const status = document.getElementById('mTaskStatus').value;
    const priority = document.getElementById('mTaskPriority').value;
    const actualCost = parseFloat(document.getElementById('mTaskActualCost').value) || 0;
    let dateResolved = document.getElementById('mTaskDateResolved').value;
    const notes = document.getElementById('mTaskNotes').value;
    const convert = document.getElementById('mTaskConvertToExpense').checked;

    const task = currentTasks.find(t => t.id === pendingTaskId);
    
    const data = {
        ...task,
        status,
        priority,
        actual_cost: actualCost,
        date_resolved: dateResolved || null,
        description: task.description + (notes ? "\nUpdate: " + notes : "")
    };

    try {
        const res = await fetch(`/api/maintenance/${pendingTaskId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            if (convert && status === 'Resolved' && actualCost > 0) {
                await convertTaskToExpense(pendingTaskId, true);
            }
            showNotification("Task updated", "success");
            closeTaskModal();
            loadTasks();
            loadActivityLogs();
        }
    } catch (e) { console.error(e); }
}

async function convertTaskToExpense(id, silent = false) {
    try {
        const res = await fetch(`/api/maintenance/${id}/convert`, { method: 'POST' });
        if (res.ok && !silent) {
            showNotification("Expense recorded successfully", "success");
            loadTasks();
            loadExpenses();
        }
    } catch (e) { console.error(e); }
}

async function deleteTaskConfirm() {
    if (!confirm("Delete this maintenance ticket?")) return;
    try {
        const res = await fetch(`/api/maintenance/${pendingTaskId}`, { method: 'DELETE' });
        if (res.ok) {
            showNotification("Ticket deleted", "success");
            closeTaskModal();
            loadTasks();
        }
    } catch (e) { console.error(e); }
}

function searchTasks() {
    const term = document.getElementById('taskSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#taskList .tenant-row');
    rows.forEach(row => {
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
}
