function toggleTenantPortalForm() {
    const tenantForm = document.getElementById('tenantLoginForm');
    if (!tenantForm) return;

    const isTenantHidden = tenantForm.classList.contains('hidden');
    if (isTenantHidden) {
        switchLoginTab('tenant');
    } else {
        switchLoginTab('admin');
    }
}

async function submitTenantLogin() {
    const room = document.getElementById('tenantRoomInput').value.trim();
    const mobile = document.getElementById('tenantMobileInput').value.trim();

    if (!room || !mobile) {
        return showNotification("Fill Room & Password/Mobile", "error");
    }

    try {
        const response = await fetch('/api/tenant/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_no: room, mobile_number: mobile, password: mobile })
        });
        if (!response.ok) throw new Error("Invalid Unit Number or Password");
        
        const tenant = await response.json();
        
        // Save session details
        window.currentTenant = tenant;
        localStorage.setItem('tenantRoom', room);
        localStorage.setItem('tenantMobile', mobile);

        // Hide PIN Overlay
        const overlay = document.getElementById('pinOverlay');
        if (overlay) overlay.classList.add('hidden');

        // Show Tenant UI
        showTenantPortal();
        showNotification("Welcome, " + tenant.name, "success");
    } catch (e) {
        showNotification(e.message || "Login failed", "error");
    }
}

function showTenantPortal() {
    const mainApp = document.getElementById('mainApp');
    if (!mainApp) return;

    // Render only the Tenant Portal Template
    mainApp.innerHTML = `
        ${Templates.tenantPortal}
    `;
    mainApp.classList.remove('hidden');

    // Populate welcome text and stats
    const tenant = window.currentTenant;
    document.getElementById('tenantPortalWelcome').innerText = `Hello, ${tenant.name}`;
    document.getElementById('tenantPortalSub').innerText = `Room ${tenant.room_no} • RentBill Tenant Portal`;
    
    document.getElementById('tenantOutstandingBalance').innerText = currencyFormatter.format(tenant.pending_arrears);
    document.getElementById('tenantMonthlyRent').innerText = currencyFormatter.format(tenant.base_rent);

    if (typeof lucide !== 'undefined') lucide.createIcons();

    // Fetch and populate ledger and tasks
    loadTenantLedger();
    loadTenantMaintenanceTasks();
}

function tenantLogout() {
    window.currentTenant = null;
    localStorage.removeItem('tenantRoom');
    localStorage.removeItem('tenantMobile');

    // Hide mainApp
    const mainApp = document.getElementById('mainApp');
    if (mainApp) {
        mainApp.innerHTML = '';
        mainApp.classList.add('hidden');
    }

    // Show PIN Overlay and reset to PIN sign-in
    const overlay = document.getElementById('pinOverlay');
    if (overlay) {
        overlay.innerHTML = Templates.authOverlay;
        overlay.classList.remove('hidden');
        switchLoginTab('tenant');
    }
}

async function loadTenantLedger() {
    const listDiv = document.getElementById('tenantLedgerList');
    if (!listDiv) return;

    try {
        const response = await fetch('/api/tenant/bills', {
            headers: {
                'X-Room-No': window.currentTenant.room_no,
                'X-Mobile-No': window.currentTenant.mobile_number
            }
        });
        const bills = await response.json() || [];

        if (bills.length === 0) {
            listDiv.innerHTML = `
                <div class="empty-state" style="padding: 2rem 1rem;">
                    <i data-lucide="receipt" style="width: 32px; height: 32px; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                    <p style="font-size: 0.75rem; font-weight: 600;">No payment history recorded.</p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        listDiv.innerHTML = bills.map(b => {
            const dateStr = b.date_generated ? new Date(b.date_generated).toLocaleDateString('en-IN') : 'N/A';
            let statusText = b.is_paid ? 'PAID' : 'UNPAID';
            let statusColor = b.is_paid ? 'var(--success)' : 'var(--danger)';
            let statusBg = b.is_paid ? 'var(--bg-success-light)' : 'var(--bg-danger-light)';

            if (!b.is_paid && b.proof_status === 'PENDING') {
                statusText = 'PENDING VERIFICATION';
                statusColor = 'var(--warning)';
                statusBg = 'var(--bg-warning-light)';
            }

            return `
                <div class="tenant-row" style="padding: 1rem; border: 1.5px solid var(--border); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                    <div>
                        <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-main);">${b.billing_month}</div>
                        <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">
                            Generated: ${dateStr} • EB: ${b.curr_eb_reading - b.prev_eb_reading}u
                        </div>
                    </div>
                    <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                        <div style="font-weight: 900; font-size: 1rem; color: var(--text-main);">${currencyFormatter.format(b.total_amount)}</div>
                        <span class="badge" style="background: ${statusBg}; color: ${statusColor}; border-color: ${statusColor}; font-size: 0.55rem; padding: 2px 6px;">${statusText}</span>
                        ${!b.is_paid && b.proof_status !== 'PENDING' ? `
                            <button type="button" class="btn btn-sm btn-primary" onclick="openSubmitProofModal(${b.id}, '${b.billing_month}', ${b.total_amount})" style="font-size: 0.65rem; padding: 3px 8px; margin-top: 4px; border-radius: 6px;">
                                <i data-lucide="upload-cloud" style="width: 12px; height: 12px;"></i> Submit Proof
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.error(e);
        listDiv.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--danger); font-size:0.75rem;">Failed to load ledger.</p>';
    }
}

function openSubmitProofModal(billId, monthName, totalAmount) {
    const overlay = document.getElementById('tenantProofOverlay');
    if (!overlay) return;

    document.getElementById('proofBillId').value = billId;
    const sub = document.getElementById('proofModalSub');
    if (sub) sub.innerText = `${monthName} • Total: ${currencyFormatter.format(totalAmount)}`;
    
    document.getElementById('proofRefInput').value = '';
    document.getElementById('proofPhotoInput').value = '';
    overlay.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeTenantProofModal() {
    const overlay = document.getElementById('tenantProofOverlay');
    if (overlay) overlay.classList.add('hidden');
}

async function submitTenantPaymentProof() {
    const billId = document.getElementById('proofBillId').value;
    const refVal = document.getElementById('proofRefInput').value.trim();
    const photoInput = document.getElementById('proofPhotoInput');

    if (!billId) return showNotification("Invalid Bill", "error");
    if (!refVal) return showNotification("Please enter Transaction Reference / UTR ID", "error");

    const formData = new FormData();
    formData.append('bill_id', billId);
    formData.append('proof_ref', refVal);
    if (photoInput && photoInput.files.length > 0) {
        formData.append('proof_photo', photoInput.files[0]);
    }

    try {
        const response = await fetch('/api/tenant/submit-proof', {
            method: 'POST',
            headers: {
                'X-Room-No': window.currentTenant.room_no,
                'X-Mobile-No': window.currentTenant.mobile_number
            },
            body: formData
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || "Failed to submit proof");
        }

        showNotification("Payment proof submitted for verification!", "success");
        closeTenantProofModal();
        loadTenantLedger();
    } catch (e) {
        showNotification(e.message || "Submission failed", "error");
    }
}

async function loadTenantMaintenanceTasks() {
    const listDiv = document.getElementById('tenantMaintenanceList');
    if (!listDiv) return;

    try {
        const response = await fetch('/api/tenant/maintenance', {
            headers: {
                'X-Room-No': window.currentTenant.room_no,
                'X-Mobile-No': window.currentTenant.mobile_number
            }
        });
        const tasks = await response.json() || [];

        if (tasks.length === 0) {
            listDiv.innerHTML = `
                <div class="empty-state" style="padding: 2rem 1rem;">
                    <i data-lucide="wrench" style="width: 32px; height: 32px; margin-bottom: 0.5rem; opacity: 0.5;"></i>
                    <p style="font-size: 0.75rem; font-weight: 600;">No active tickets found.</p>
                </div>`;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        listDiv.innerHTML = tasks.map(t => {
            const statusColor = t.status === 'Resolved' ? 'var(--success)' : (t.status === 'In Progress' ? 'var(--info)' : 'var(--danger)');
            const statusBg = t.status === 'Resolved' ? 'var(--bg-success-light)' : (t.status === 'In Progress' ? 'var(--bg-info-light)' : 'var(--bg-danger-light)');

            return `
                <div class="tenant-row" style="padding: 1rem; border: 1.5px solid var(--border); border-radius: 12px; display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                    <div>
                        <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-main);">${t.title}</div>
                        <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">
                            ${t.category} • Reported: ${t.date_reported}
                        </div>
                    </div>
                    <div>
                        <span class="badge" style="background: ${statusBg}; color: ${statusColor}; border-color: ${statusColor}; font-size: 0.55rem; padding: 2px 6px;">${t.status.toUpperCase()}</span>
                    </div>
                </div>
            `;
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (e) {
        console.error(e);
        listDiv.innerHTML = '<p style="text-align:center; padding:1rem; color:var(--danger); font-size:0.75rem;">Failed to load tasks.</p>';
    }
}

async function submitTenantMaintenanceTask() {
    const category = document.getElementById('tenantTaskCat').value;
    const priority = document.getElementById('tenantTaskPriority').value;
    const title = document.getElementById('tenantTaskTitle').value.trim();
    const desc = document.getElementById('tenantTaskDesc').value.trim();

    if (!title) return showNotification("Please enter an issue title", "error");

    try {
        const response = await fetch('/api/tenant/maintenance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Room-No': window.currentTenant.room_no,
                'X-Mobile-No': window.currentTenant.mobile_number
            },
            body: JSON.stringify({ category, priority, title, description: desc })
        });
        if (!response.ok) throw new Error("Failed to submit repair ticket");

        showNotification("Ticket submitted successfully", "success");
        
        document.getElementById('tenantTaskTitle').value = '';
        document.getElementById('tenantTaskDesc').value = '';

        loadTenantMaintenanceTasks();
    } catch (e) {
        showNotification(e.message || "Failed to submit ticket", "error");
    }
}

function switchTenantSubView(subview) {
    const views = document.querySelectorAll('.tenant-sub-view');
    views.forEach(v => v.classList.add('hidden'));

    const activeView = document.getElementById(`tenantSubView-${subview}`);
    if (activeView) activeView.classList.remove('hidden');

    const btns = document.querySelectorAll('.sub-nav-btn');
    btns.forEach(b => b.classList.remove('active'));

    const activeBtn = document.getElementById(`btnTenant${subview.charAt(0).toUpperCase() + subview.slice(1)}`);
    if (activeBtn) activeBtn.classList.add('active');
}

window.addEventListener('DOMContentLoaded', () => {
    const room = localStorage.getItem('tenantRoom');
    const mobile = localStorage.getItem('tenantMobile');
    if (room && mobile) {
        fetch('/api/tenant/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ room_no: room, mobile_number: mobile })
        })
        .then(res => {
            if (res.ok) return res.json();
            throw new Error();
        })
        .then(tenant => {
            window.currentTenant = tenant;
            const overlay = document.getElementById('pinOverlay');
            if (overlay) overlay.classList.add('hidden');
            showTenantPortal();
        })
        .catch(() => {
            localStorage.removeItem('tenantRoom');
            localStorage.removeItem('tenantMobile');
        });
    }
});

function openTenantChangePasswordModal() {
    const overlay = document.getElementById('tenantChangePassOverlay');
    if (!overlay) return;
    document.getElementById('tenantCurrentPass').value = '';
    document.getElementById('tenantNewPass').value = '';
    document.getElementById('tenantConfirmPass').value = '';
    overlay.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function closeTenantChangePasswordModal() {
    const overlay = document.getElementById('tenantChangePassOverlay');
    if (overlay) overlay.classList.add('hidden');
}

async function submitTenantChangePassword() {
    const currentPass = document.getElementById('tenantCurrentPass').value;
    const newPass = document.getElementById('tenantNewPass').value;
    const confirmPass = document.getElementById('tenantConfirmPass').value;

    if (!currentPass || !newPass) return showNotification("Please enter current and new password", "error");
    if (newPass !== confirmPass) return showNotification("New passwords do not match", "error");
    if (newPass.length < 4) return showNotification("Password must be at least 4 characters", "error");

    try {
        const response = await fetch('/api/tenant/change-password', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Room-No': window.currentTenant.room_no,
                'X-Mobile-No': window.currentTenant.mobile_number
            },
            body: JSON.stringify({
                current_password: currentPass,
                new_password: newPass
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Password update failed");

        showNotification("Password updated successfully!", "success");
        closeTenantChangePasswordModal();
    } catch (e) {
        showNotification(e.message || "Failed to change password", "error");
    }
}
