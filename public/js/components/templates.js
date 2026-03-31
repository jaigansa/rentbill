const Templates = {
    authOverlay: `
        <div class="modal-content" style="max-width: 320px; text-align: center;">
            <div class="stat-icon icon-primary" style="width: 60px; height: 60px; margin: 0 auto 1.5rem; border-radius: var(--radius-xl);">
                <i data-lucide="shield-check" style="width: 32px; height: 32px;"></i>
            </div>
            <h2 style="font-family: var(--font-heading); font-size: 1.25rem; margin-bottom: 0.25rem; color: var(--text-main);">Security Access</h2>
            <p style="color: var(--text-muted); font-size: 0.8rem; margin-bottom: 2rem;">Enter Master PIN to continue</p>
            
            <div style="display: flex; justify-content: center; gap: 1.25rem; margin-bottom: 2rem;" class="pin-dots">
                ${[1, 2, 3, 4].map(() => `<div class="dot"></div>`).join('')}
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;">
                ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button onclick="pressKey('${n}')" style="height: 4rem; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-card); color: var(--text-main); font-size: 1.25rem; font-weight: 600; cursor: pointer;">${n}</button>`).join('')}
                <button onclick="forgotPin()" style="border: none; background: transparent; color: var(--secondary); cursor: pointer;"><i data-lucide="help-circle"></i></button>
                <button onclick="pressKey('0')" style="height: 4rem; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-card); color: var(--text-main); font-size: 1.25rem; font-weight: 600; cursor: pointer;">0</button>
                <button onclick="pressKey('back')" style="border: none; background: transparent; color: var(--danger); cursor: pointer;"><i data-lucide="delete"></i></button>
            </div>
        </div>
    `,

    navigation: `
        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-brand">
                    <i data-lucide="building-2"></i>
                </div>
            </div>
            
            <nav class="sidebar-nav">
                <button onclick="showSection('tenantListContainer')" class="nav-btn active" title="Dashboard">
                    <i data-lucide="layout-dashboard"></i>
                    <span>Home</span>
                </button>
                <button onclick="showSection('billing-module')" class="nav-btn" title="Billing">
                    <i data-lucide="receipt"></i>
                    <span>Bill</span>
                </button>
                <button onclick="showSection('history-section')" class="nav-btn" title="Payment History">
                    <i data-lucide="history"></i>
                    <span>Record</span>
                </button>
                <button onclick="showSection('settings-section')" class="nav-btn" title="Settings">
                    <i data-lucide="settings"></i>
                    <span>Setup</span>
                </button>
            </nav>

            <div class="sidebar-footer">
                <button onclick="toggleDarkMode()" id="darkModeToggle" class="sidebar-btn" title="Toggle Theme">
                    <i data-lucide="moon"></i>
                </button>
                <button onclick="logout()" class="sidebar-btn text-danger" title="Logout">
                    <i data-lucide="log-out"></i>
                </button>
            </div>
        </aside>
    `,

    dashboard: `
        <section id="tenantListContainer" class="app-section">
            <div class="stats-row" style="margin-bottom: 1rem;">
                <div class="stat-card">
                    <div class="stat-icon icon-primary"><i data-lucide="users"></i></div>
                    <div><span class="stat-label">Units</span><div id="statActive" class="stat-value">0</div></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon icon-success"><i data-lucide="calculator"></i></div>
                    <div><span class="stat-label">Potential Income</span><div id="statPotentialIncome" class="stat-value">₹0</div></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon icon-warning"><i data-lucide="shield-check"></i></div>
                    <div><span class="stat-label">Total Advance</span><div id="statTotalAdvance" class="stat-value">₹0</div></div>
                </div>
            </div>

            <div class="stats-row" style="margin-bottom: 2rem;">
                <div class="stat-card">
                    <div class="stat-icon icon-success"><i data-lucide="indian-rupee"></i></div>
                    <div><span class="stat-label">Total Income</span><div id="statTotalIncome" class="stat-value">₹0</div></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon icon-danger"><i data-lucide="trending-down"></i></div>
                    <div><span class="stat-label">Total Expenses</span><div id="statTotalExpenses" class="stat-value">₹0</div></div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon icon-warning" style="background: var(--primary); color: var(--bg-card);"><i data-lucide="wallet"></i></div>
                    <div><span class="stat-label">Total Balance</span><div id="statTotalBalance" class="stat-value">₹0</div></div>
                </div>
            </div>

            <div class="card" style="margin-bottom: 2rem;">
                <div class="card-header">
                    <h3 class="section-title"><i data-lucide="layout-list"></i> Account Settlements</h3>
                </div>
                <div id="ownerSettlementList" style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <!-- Owner balance items will be injected here -->
                </div>
            </div>

            <div class="card" style="margin-bottom: 2rem;">
                <div class="card-header">
                    <h3 class="section-title"><i data-lucide="pie-chart"></i> Collection Check (All Dues)</h3>
                    <div id="statCollectionPercent" style="font-weight: 900; color: var(--primary);">0%</div>
                </div>
                <div class="progress-container">
                    <div id="collectionProgressBar" class="progress-bar"></div>
                </div>
                <p id="collectionDetails" style="font-size: 0.7rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">0 of 0 bills settled</p>
            </div>

            <div class="grid-layout">
                <div class="main-content">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="section-title"><i data-lucide="calendar-check"></i> Bill Status</h3>
                            <div id="currentTrackingMonth" style="font-weight: 800; color: var(--primary); text-transform: uppercase; font-size: 0.75rem;">Loading...</div>
                        </div>
                        <div id="monthlyChecklist" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
                    </div>
                </div>
                <div class="side-content">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="section-title"><i data-lucide="history"></i> Timeline</h3>
                            <select id="logFilter" onchange="loadActivityLogs()" style="font-size: 0.7rem; padding: 2px 5px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-input);">
                                <option value="ALL">All</option><option value="PAYMENTS">Payments</option><option value="BILLS">Bills</option>
                            </select>
                        </div>
                        <div id="activityLog" class="activity-feed"></div>
                    </div>
                </div>
            </div>
        </section>
    `,

    billing: `
        <section id="billing-module" class="app-section hidden">
            <div id="billingMainView">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2 class="section-title" style="font-size: 1.25rem;"><i data-lucide="receipt"></i> Unit Billing</h2>
                </div>
                <div class="card" style="padding: 0.5rem;">
                    <div style="padding: 0.75rem 1rem; display: flex; align-items: center; gap: 0.75rem; background: var(--bg-input); border-radius: var(--radius-md); margin-bottom: 0.5rem;">
                        <i data-lucide="search" style="width: 18px; color: var(--text-muted);"></i>
                        <input type="text" id="searchBar" placeholder="Search unit or tenant..." onkeyup="searchTenants()" style="border: none; background: transparent; width: 100%; font-size: 0.9rem; outline: none;">
                    </div>
                    <div id="tenantList"></div>
                </div>
            </div>
        </section>
    `,

    history: `
        <section id="history-section" class="app-section hidden">
            <div class="card-header" style="margin-bottom: 1.5rem;">
                <h2 class="section-title"><i data-lucide="history"></i> Records & History</h2>
                <div style="display: flex; gap: 0.5rem; background: var(--bg-input); padding: 4px; border: 2px solid var(--border);">
                    <button onclick="toggleHistoryMode('tenants')" id="btnHistoryTenants" class="btn btn-sm active" style="border:none; padding: 0.4rem 1rem;">Tenants</button>
                    <button onclick="toggleHistoryMode('owners')" id="btnHistoryOwners" class="btn btn-sm" style="border:none; padding: 0.4rem 1rem;">Payouts</button>
                </div>
            </div>

            <div id="historyTenantsContent">
                <div class="card" style="margin-bottom: 1.5rem;">
                    <div class="input-group" style="margin:0;">
                        <label>Select Unit / Tenant</label>
                        <select id="historyTenantSelect" onchange="loadTenantHistory(this.value)" style="font-weight: 800; color: var(--primary);">
                            <option value="">-- Select Unit --</option>
                        </select>
                    </div>
                </div>
                <div id="historyResults" class="hidden">
                    <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
                        <h3 id="historySelectedName" class="section-title" style="font-size: 1rem;">Tenant Name</h3>
                    </div>
                    <div class="card" style="padding: 0; overflow: hidden;">
                        <table class="styled-table">
                            <thead><tr><th>Month</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody id="historyBody"></tbody>
                        </table>
                    </div>
                    <div id="historyLoadMoreContainer" style="margin-top: 1.5rem; text-align: center;" class="hidden">
                        <button onclick="loadMoreTenantHistory()" class="btn btn-secondary btn-sm" style="width: 100%; border-style: dashed;">Load Older Records</button>
                    </div>
                </div>
                <div id="historyEmptyState" style="text-align: center; padding: 4rem 2rem; color: var(--text-muted);">
                    <i data-lucide="search" style="width: 48px; height: 48px; opacity: 0.1; margin-bottom: 1rem;"></i>
                    <p>Select a unit to view records</p>
                </div>
            </div>

            <div id="historyOwnersContent" class="hidden">
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="banknote"></i> Owner Payout History</h3>
                        <button onclick="toggleWithdrawalForm()" id="witToggleBtn" class="btn btn-primary btn-sm">Record Payout</button>
                    </div>
                    <div id="withdrawal-form" class="hidden" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid var(--border);">
                        <div class="grid-inputs">
                            <div class="input-group"><label>Owner *</label><select id="wOwnerName"><option value="">-- Select --</option></select></div>
                            <div class="input-group"><label>Amount *</label><input type="number" id="wAmount"></div>
                            <div class="input-group"><label>Date</label><input type="date" id="wDate"></div>
                            <div class="input-group" style="grid-column: 1/-1;"><label>Note</label><input type="text" id="wNotes"></div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                            <button onclick="addWithdrawal()" class="btn btn-primary">Save Record</button>
                            <button onclick="toggleWithdrawalForm()" class="btn btn-secondary">Cancel</button>
                        </div>
                    </div>
                    <div id="withdrawalList" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
                    <div id="payoutLoadMoreContainer" style="margin-top: 1.5rem; text-align: center;" class="hidden">
                        <button onclick="loadMoreWithdrawals()" class="btn btn-secondary btn-sm" style="width: 100%; border-style: dashed;">Load Older Payouts</button>
                    </div>
                </div>
            </div>
        </section>
    `,

    settings: `
        <section id="settings-section" class="app-section hidden">
            <div class="grid-layout">
                <div class="main-content">
                    <div class="card">
                        <div class="card-header">
                            <h3 class="section-title"><i data-lucide="users"></i> Unit Directory</h3>
                            <button onclick="toggleRegForm()" id="regToggleBtn" class="btn btn-primary btn-sm">Register Unit</button>
                        </div>
                        <div id="entrance-form" class="hidden" style="margin-top: 1.5rem; padding-top: 1.5rem;">
                            <h4 id="form-title" style="font-size: 0.9rem; margin-bottom: 1.5rem; color: var(--primary);">New Registration</h4>
                            <div class="grid-inputs">
                                <div class="input-group"><label>Full Name *</label><input type="text" id="tName"></div>
                                <div class="input-group"><label>Mobile *</label><input type="text" id="tMobile"></div>
                                <div class="input-group"><label>Room/Unit *</label><input type="text" id="tRoom"></div>
                                <div class="input-group"><label>Aadhar No</label><input type="text" id="tAadhar"></div>
                                <div class="input-group"><label>Base Rent *</label><input type="number" id="tRent"></div>
                                <div class="input-group"><label>EB Rate</label><input type="number" id="tEbRate" value="9.00"></div>
                                <div class="input-group"><label>Initial EB</label><input type="number" id="tInitialEb" value="0"></div>
                                <div class="input-group"><label>Water/Maint</label><input type="number" id="tWater" value="0"></div>
                                <div class="input-group"><label>Advance</label><input type="number" id="tAdvance" value="0"></div>
                                <div class="input-group"><label>Move-in</label><input type="date" id="tMoveIn"></div>
                                <div class="input-group"><label>Assign Account *</label><select id="tAssignedUpi"><option value="">-- Select --</option></select></div>
                                <div class="input-group"><label>Emergency Contact</label><input type="text" id="tEmerg"></div>
                                <div class="input-group"><label>Occupation</label><input type="text" id="tJob"></div>
                                <div class="input-group" style="grid-column: 1/-1;"><label>Permanent Address</label><input type="text" id="tPermAddr"></div>
                                <div class="input-group" style="grid-column: 1/-1;"><label>Email</label><input type="email" id="tEmail"></div>
                            </div>
                            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                                <button onclick="addTenant()" id="mainSubmitBtn" class="btn btn-primary">Save Record</button>
                                <button id="formAgreementBtn" class="btn btn-secondary">Email Agreement</button>
                                <button id="formDeleteBtn" class="btn btn-danger">Delete</button>
                                <button onclick="toggleRegForm()" class="btn btn-secondary" style="margin-left: auto;">Cancel</button>
                            </div>
                        </div>
                        <div id="manageTenantList" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
                    </div>

                    <div class="card">
                        <div class="card-header">
                            <h3 class="section-title"><i data-lucide="trending-down"></i> Maintenance Logs</h3>
                            <button onclick="toggleExpenseForm()" id="expToggleBtn" class="btn btn-secondary btn-sm">Record Outflow</button>
                        </div>
                        <div id="expense-form" class="hidden" style="margin-top: 1.5rem; padding-top: 1.5rem;">
                            <div class="grid-inputs">
                                <div class="input-group"><label>Category</label><select id="eCategory"><option value="Maintenance">Repair</option><option value="Taxes">Taxes</option><option value="Utility">Utility</option><option value="Salary">Staff</option><option value="Other">Other</option></select></div>
                                <div class="input-group"><label>Amount</label><input type="number" id="eAmount"></div>
                                <div class="input-group"><label>Date</label><input type="date" id="eDate"></div>
                                <div class="input-group" style="grid-column: 1/-1;"><label>Note</label><input type="text" id="eNotes"></div>
                            </div>
                            <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
                                <button onclick="addExpense()" class="btn btn-primary">Save Expense</button>
                                <button onclick="toggleExpenseForm()" class="btn btn-secondary">Cancel</button>
                            </div>
                        </div>
                        <div id="expenseList" style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;"></div>
                    </div>
                </div>

                <div class="side-content">
                    <div class="card">
                        <h3 class="section-title" style="margin-bottom: 1.5rem;"><i data-lucide="server"></i> Credentials</h3>
                        <div class="input-group"><label>Admin Email</label><input type="text" id="email_user"></div>
                        <div class="input-group"><label>SMTP App Pass</label><input type="password" id="email_pass"></div>
                        <div class="input-group"><label>Auto-BCC</label><input type="text" id="email_bcc"></div>
                        <div class="grid-inputs" style="margin-top: 1rem;">
                            <div class="input-group"><label>Server Port</label><input type="number" id="server_port" placeholder="8080"></div>
                            <div class="input-group"><label>New Master PIN</label><input type="password" id="new_master_pin" maxlength="4" placeholder="****"></div>
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top: 1.5rem;">
                            <button onclick="saveSystemSettings()" class="btn btn-primary btn-sm">Save</button>
                            <button onclick="testSMTPSettings()" class="btn btn-secondary btn-sm">Test Mail</button>
                        </div>
                    </div>

                    <div class="card">
                        <h3 class="section-title" style="margin-bottom: 1.5rem;"><i data-lucide="wallet"></i> Receiving Accounts</h3>
                        
                        <div class="input-group" style="margin-bottom: 1rem;"><label>Owner / Payee Name *</label><input type="text" id="acc_name" placeholder="Full Name"></div>
                        <div class="input-group" style="margin-bottom: 1rem;"><label>Account Label</label><input type="text" id="acc_label" placeholder="e.g. Primary"></div>
                        
                        <div style="padding: 1rem; border: 2px dashed var(--border); margin: 1rem 0; background: var(--bg-input);">
                            <div style="font-size: 0.65rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; margin-bottom: 1rem;">Payment Details (Fill either/both)</div>
                            <div class="input-group" style="margin-top: 0;"><label>UPI ID</label><input type="text" id="acc_upi" placeholder="name@bank"></div>
                            <div class="input-group"><label>Bank Name</label><input type="text" id="acc_bank" placeholder="e.g. HDFC"></div>
                            <div class="input-group"><label>Acc Number</label><input type="text" id="acc_num"></div>
                            <div class="input-group"><label>IFSC Code</label><input type="text" id="acc_ifsc"></div>
                        </div>

                        <button onclick="saveReceivingAccount()" class="btn btn-primary btn-sm" style="width: 100%; margin-top: 1rem;">Add Account Record</button>

                        <div id="unifiedAccountList" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;"></div>
                    </div>

                    <div class="card">
                        <h3 class="section-title" style="margin-bottom: 1.5rem;"><i data-lucide="file-check"></i> Audit & Reports</h3>
                        <div class="input-group"><label>Select Month</label><input type="month" id="auditMonth" value="${new Date().toISOString().slice(0, 7)}"></div>
                        <button onclick="viewAuditReport()" class="btn btn-primary btn-sm" style="width: 100%; margin-top: 1rem;">Generate Audit</button>
                    </div>

                    <div class="card">
                        <h3 class="section-title" style="margin-bottom: 1.5rem;"><i data-lucide="database"></i> Database Management</h3>
                        
                        <div style="border-bottom: 1px dashed var(--border); padding-bottom: 1.5rem; margin-bottom: 1.5rem;">
                            <p style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 1rem;">Backup Data</p>
                            <div class="input-group"><label>File Name</label><input type="text" id="backupFilename" placeholder="manual_backup"></div>
                            <button onclick="backupDatabase()" class="btn btn-primary btn-sm" style="width: 100%; margin-top: 0.5rem;">Download Backup (.db)</button>
                        </div>

                        <div>
                            <p style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 1rem;">Restore Data</p>
                            <p style="font-size: 0.65rem; color: var(--danger); margin-bottom: 1rem; line-height: 1.4;">Warning: Restoring will overwrite all current data. Make sure you have a backup first.</p>
                            <div class="input-group"><label>Select .db File</label><input type="file" id="restoreFile" accept=".db" style="padding: 0.5rem; background: var(--bg-input);"></div>
                            <div class="input-group"><label>Login PIN</label><input type="password" id="restorePin" maxlength="4" placeholder="****"></div>
                            <button onclick="restoreDatabase()" class="btn btn-danger btn-sm" style="width: 100%; margin-top: 0.5rem;">Upload & Restore</button>
                        </div>
                    </div>

                    <button onclick="toggleHistory()" class="btn btn-secondary" style="width: 100%; background: transparent; border: 2px dashed var(--border); color: var(--text-muted);">Toggle Archived Units</button>
                    <div id="vacantList" class="hidden" style="margin-top: 1rem;"><div id="archivedTenantList" style="display: flex; flex-direction: column; gap: 0.5rem;"></div></div>
                </div>
            </div>
        </section>
    `,

    modals: `
        <div id="shareModal" class="modal-overlay hidden"><div class="modal-content" style="max-width: 400px;">
            <div class="card-header"><h3 class="section-title">Dispatch Center</h3><button onclick="closeShareModal()" class="btn-secondary" style="border: none; background: none; cursor: pointer;"><i data-lucide="x"></i></button></div>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <button onclick="shareTo('wa')" class="btn" style="background: #25D366; color: white; width: 100%;">WhatsApp <i data-lucide="message-circle"></i></button>
                <button onclick="shareTo('email')" class="btn" style="background: #ea4335; color: white; width: 100%;">Email Receipt <i data-lucide="mail"></i></button>
                <button onclick="shareTo('copy')" class="btn btn-secondary" style="width: 100%;">Copy Text <i data-lucide="copy"></i></button>
            </div>
        </div></div>

        <div id="settlementModal" class="modal-overlay hidden"><div class="modal-content" style="max-width: 500px;">
            <div class="card-header"><h3 class="section-title">Final Settlement</h3><button onclick="closeSettlementModal()" class="btn-secondary" style="border: none; background: none; cursor: pointer;"><i data-lucide="x"></i></button></div>
            <div class="grid-inputs">
                <div class="input-group"><label>Advance</label><input type="number" id="sAdvance" readonly style="font-weight: 800; color: var(--primary);"></div>
                <div class="input-group"><label>Final EB</label><input type="number" id="sEbReading" oninput="calcSettlement()" placeholder="Reading"></div>
                <div class="input-group"><label>Rent Due (-)</label><input type="number" id="sRentDue" value="0" oninput="calcSettlement()"></div>
                <div class="input-group"><label>EB Due (-)</label><input type="number" id="sEbDue" value="0" oninput="calcSettlement()"></div>
                <div class="input-group"><label>Damages (-)</label><input type="number" id="sRepairs" value="0" oninput="calcSettlement()"></div>
                <div class="input-group"><label>Reason</label><input type="text" id="sReason"></div>
            </div>
            <div style="background: var(--primary-light); padding: 1.5rem; rounded-xl; text-align: center; margin: 1.5rem 0; border-radius: var(--radius-lg);">
                <div id="settlementLabel" style="font-size: 0.7rem; font-weight: 800; color: var(--secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Total Refund</div>
                <div id="settlementTotal" style="font-size: 1.75rem; font-weight: 900; color: var(--primary);">₹0.00</div>
            </div>
            <div style="display: flex; gap: 0.5rem;"><button onclick="processSettlementAndVacant()" class="btn btn-primary" style="flex: 1;">Execute Exit</button><button onclick="closeSettlementModal()" class="btn btn-secondary">Abort</button></div>
        </div></div>

        <div id="deletePinModal" class="modal-overlay hidden"><div class="modal-content" style="max-width: 350px; text-align: center;">
            <div style="width: 50px; height: 50px; background: #fff1f2; color: var(--danger); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem;"><i data-lucide="shield-alert"></i></div>
            <h3 id="confirmationTitle" class="section-title" style="justify-content: center;">Authorize</h3>
            <p id="confirmationMessage" style="font-size: 0.75rem; color: var(--text-muted); margin: 0.5rem 0 1.5rem;">Enter Master PIN to confirm action.</p>
            <input type="password" id="deletePinInput" maxlength="4" style="width: 100%; text-align: center; font-size: 2rem; letter-spacing: 1.5rem; padding: 0.5rem; border: 2px solid var(--border); border-radius: var(--radius-md); outline: none; margin-bottom: 1.5rem;">
            <div style="display: flex; gap: 0.5rem;"><button onclick="confirmActionWithPin()" class="btn btn-danger" style="flex: 1;">Confirm</button><button onclick="closeDeleteModal()" class="btn btn-secondary">Cancel</button></div>
        </div></div>

        <div id="paymentModal" class="modal-overlay hidden"><div class="modal-content" style="max-width: 450px;">
            <h3 class="section-title" style="margin-bottom: 1.5rem;">Record Payment</h3>
            
            <div id="paySummary" style="background: var(--primary-light); padding: 1rem; margin-bottom: 1.5rem; border: 2px solid var(--border);">
                <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Total Due</div>
                <div id="payTotalLabel" style="font-size: 1.5rem; font-weight: 900;">₹0</div>
            </div>

            <div class="grid-inputs">
                <div class="input-group"><label>Method</label><select id="payMethodInput"><option value="UPI">UPI Digital</option><option value="Cash">Physical Cash</option><option value="Bank">Direct Bank</option></select></div>
                <div class="input-group"><label>Received By</label><select id="payReceiverInput"><option value="">-- Select Member --</option></select></div>
                <div class="input-group"><label>Date</label><input type="date" id="payDateInput"></div>
                <div class="input-group"><label>Amount Paid *</label><input type="number" id="payAmountInput" oninput="calculateAdjustments()"></div>
            </div>

            <div id="adjustmentSection" class="hidden" style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span style="font-size: 0.75rem; font-weight: 800; color: var(--danger);">Balance: <span id="payBalanceLabel">₹0</span></span>
                    <select id="adjType" style="font-size: 0.7rem; padding: 4px; border: 2px solid var(--border);" onchange="calculateAdjustments()">
                        <option value="CARRY">Carry Forward (Next Bill)</option>
                        <option value="DISCOUNT">Give Discount (Waiver)</option>
                        <option value="WRITEOFF">Write-Off (Loss)</option>
                    </select>
                </div>
                <p id="adjDescription" style="font-size: 0.65rem; color: var(--text-muted); line-height: 1.3;"></p>
            </div>

            <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;"><button onclick="confirmPaymentRecord()" class="btn btn-primary" style="flex: 1;">Save Entry</button><button onclick="closePaymentModal()" class="btn btn-secondary">Abort</button></div>
        </div></div>

        <div id="billDetailsModal" class="modal-overlay hidden"><div class="modal-content" style="max-width: 400px;">
            <h3 class="section-title" style="margin-bottom: 1.5rem;">Bill Breakdown</h3>
            <div id="billBreakdownContent" style="display: flex; flex-direction: column; gap: 1rem;">
                <!-- Content will be injected here -->
            </div>
            <div style="margin-top: 2rem;"><button onclick="document.getElementById('billDetailsModal').classList.add('hidden')" class="btn btn-secondary" style="width: 100%;">Close</button></div>
        </div></div>

        <div id="ownerTimelineModal" class="modal-overlay hidden"><div class="modal-content" style="max-width: 600px; max-height: 90vh; display: flex; flex-direction: column;">
            <div class="card-header">
                <h3 class="section-title"><i data-lucide="list-tree"></i> Account Timeline</h3>
                <button onclick="printOwnerTimeline()" class="btn btn-secondary btn-icon-sm" title="Print"><i data-lucide="printer"></i></button>
            </div>
            <div id="timelineOwnerName" style="font-weight: 900; font-size: 1.2rem; margin: 1rem 0; text-transform: uppercase;"></div>
            <div id="ownerTimelineContent" style="flex: 1; overflow-y: auto; padding: 0.5rem;">
                <!-- Timeline items injected here -->
            </div>
            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 2px solid var(--border);">
                <button onclick="document.getElementById('ownerTimelineModal').classList.add('hidden')" class="btn btn-secondary" style="width: 100%;">Close</button>
            </div>
        </div></div>

        <div id="auditModal" class="modal-overlay hidden"><div class="modal-content" style="max-width: 800px; height: 90vh; display: flex; flex-direction: column;">
            <div class="card-header"><h3 class="section-title">Audit Record</h3><button onclick="closeAuditModal()" class="btn btn-secondary btn-icon-sm" style="border: none; background: none; cursor: pointer;"><i data-lucide="x"></i></button></div>
            <div id="auditContent" style="flex: 1; overflow-y: auto; padding: 1rem; font-family: monospace; border: 1px solid var(--border); background: #fff; color: #000;">
                <!-- Audit content will be injected here -->
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
                <button onclick="printAudit()" class="btn btn-primary" style="flex: 1;">Print Audit <i data-lucide="printer" style="width: 16px;"></i></button>
                <button onclick="closeAuditModal()" class="btn btn-secondary">Close</button>
            </div>
        </div></div>
    `
};
