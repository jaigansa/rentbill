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
                <div style="display: flex; flex-direction: column; overflow: hidden;" class="sidebar-text">
                    <span style="font-weight: 800; font-size: 1rem; color: var(--text-main); white-space: nowrap;">RentBill</span>
                    <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Pro Manager</span>
                </div>
            </div>
            
            <nav class="sidebar-nav">
                <button onclick="showSection('tenantListContainer')" class="nav-btn active" title="Dashboard">
                    <i data-lucide="layout-dashboard"></i>
                    <span>Dashboard</span>
                </button>
                <button onclick="showSection('billing-module')" class="nav-btn" title="Billing">
                    <i data-lucide="receipt"></i>
                    <span>Billing</span>
                </button>
                <button onclick="showSection('history-section')" class="nav-btn" title="Payment History">
                    <i data-lucide="history"></i>
                    <span>Statements</span>
                </button>
                <button onclick="showSection('settings-section')" class="nav-btn" title="Settings">
                    <i data-lucide="settings"></i>
                    <span>Settings</span>
                </button>
            </nav>

            <div class="sidebar-footer">
                <button onclick="toggleDarkMode()" id="darkModeToggle" class="btn btn-secondary" style="width: 100%; justify-content: flex-start; padding: 0.75rem 1rem;" title="Toggle Theme">
                    <i data-lucide="moon" style="width: 18px; height: 18px;"></i>
                    <span style="margin-left: 0.75rem; font-size: 0.85rem;" class="sidebar-text">Appearance</span>
                </button>
                <button onclick="logout()" class="btn btn-danger" style="width: 100%; justify-content: flex-start; padding: 0.75rem 1rem; margin-top: 0.5rem;" title="Logout">
                    <i data-lucide="log-out" style="width: 18px; height: 18px;"></i>
                    <span style="margin-left: 0.75rem; font-size: 0.85rem;" class="sidebar-text">Logout</span>
                </button>
            </div>
        </aside>
    `,

    dashboard: `
        <section id="tenantListContainer" class="app-section">
            <div style="max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem;">
                
                <!-- 0. Quick Actions -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <h3 class="section-title" style="margin: 0; font-size: 0.8rem;">Shortcuts</h3>
                    <button onclick="loadDashboardStats()" class="btn btn-secondary btn-icon-sm" title="Refresh Dashboard"><i data-lucide="refresh-cw" style="width: 14px;"></i></button>
                </div>
                <div class="quick-actions-grid">
                    <button onclick="quickRegisterTenant()" class="quick-action-btn">
                        <div class="qa-icon"><i data-lucide="user-plus"></i></div>
                        <span>Register Unit</span>
                    </button>
                    <button onclick="quickRecordPayout()" class="quick-action-btn">
                        <div class="qa-icon"><i data-lucide="banknote"></i></div>
                        <span>Record Payout</span>
                    </button>
                    <button onclick="quickAddExpense()" class="quick-action-btn">
                        <div class="qa-icon"><i data-lucide="trending-down"></i></div>
                        <span>Add Expense</span>
                    </button>
                    <button onclick="quickGenerateAudit()" class="quick-action-btn">
                        <div class="qa-icon"><i data-lucide="file-check"></i></div>
                        <span>Run Audit</span>
                    </button>
                </div>

                <!-- 0.1 Setup Checklist (Hidden by default) -->
                <div id="setupChecklist" class="card checklist-card hidden">
                    <div class="card-header" style="border-bottom-style: dashed;">
                        <h3 class="section-title"><i data-lucide="sparkles"></i> Getting Started</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 1rem;">
                        <p style="font-size: 0.8rem; font-weight: 700; color: var(--text-main);">Welcome! Complete these steps to start managing your property:</p>
                        <div id="check-step-1" class="checklist-item">
                            <i data-lucide="circle" class="check-icon"></i>
                            <div style="flex: 1;">
                                <div class="check-label">Add Receiving Account</div>
                                <div class="check-desc">Setup where you receive rent (UPI/Bank)</div>
                            </div>
                            <button onclick="showSection('settings-section')" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.6rem; min-height: 0;">Setup</button>
                        </div>
                        <div id="check-step-2" class="checklist-item">
                            <i data-lucide="circle" class="check-icon"></i>
                            <div style="flex: 1;">
                                <div class="check-label">Register First Unit</div>
                                <div class="check-desc">Add a tenant and their rent details</div>
                            </div>
                            <button onclick="quickRegisterTenant()" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.6rem; min-height: 0;">Add</button>
                        </div>
                        <div id="check-step-3" class="checklist-item">
                            <i data-lucide="circle" class="check-icon"></i>
                            <div style="flex: 1;">
                                <div class="check-label">Generate First Bill</div>
                                <div class="check-desc">Create your first itemized rent invoice</div>
                            </div>
                            <button onclick="showSection('billing-module')" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.6rem; min-height: 0;">Go</button>
                        </div>
                    </div>
                </div>

                <!-- 0.2 Dashboard Search -->
                <div class="dashboard-search-box">
                    <i data-lucide="search" style="width: 18px; color: var(--text-muted);"></i>
                    <input type="text" id="dashboardSearch" placeholder="Search units, owners or ledger..." onkeyup="searchDashboard()">
                </div>

                <!-- 1. Executive Stats -->
                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div class="stats-row">
                        <div class="stat-card">
                            <div class="stat-icon icon-primary"><i data-lucide="users"></i></div>
                            <div><span class="stat-label">Units</span><div id="statActive" class="stat-value">0</div></div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon icon-success"><i data-lucide="calculator"></i></div>
                            <div>
                                <span class="stat-label">Potential Income <i data-lucide="help-circle" class="help-trigger" onclick="showHelp('potential')"></i></span>
                                <div id="statPotentialIncome" class="stat-value">₹0</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon icon-warning"><i data-lucide="shield-check"></i></div>
                            <div><span class="stat-label">Total Advance</span><div id="statTotalAdvance" class="stat-value">₹0</div></div>
                        </div>
                    </div>

                    <div class="stats-row">
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
                </div>

                <!-- 2. Management Progress -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="line-chart"></i> Management Progress</h3>
                    </div>

                    <!-- 2.1 Bill Generation Progress -->
                    <div style="margin-bottom: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Bill Generation</span>
                            <div id="statBillingPercent" style="font-weight: 900; color: var(--info);">0%</div>
                        </div>
                        <div class="progress-container" style="margin: 0;">
                            <div id="billingProgressBar" class="progress-bar" style="background: var(--info);"></div>
                            <div class="progress-text" id="billingProgressText">0% GENERATED</div>
                        </div>
                        <p id="billingDetails" style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 0.5rem;">0 of 0 active units billed</p>
                    </div>

                    <!-- 2.2 Collection Progress -->
                    <div style="margin-bottom: 2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Collection Progress</span>
                            <div id="statCollectionPercent" style="font-weight: 900; color: var(--success);">0%</div>
                        </div>
                        <div class="progress-container" style="margin: 0;">
                            <div id="collectionProgressBar" class="progress-bar" style="background: var(--success);"></div>
                            <div class="progress-text" id="collectionProgressText">0% COLLECTED</div>
                        </div>
                        <p id="collectionDetails" style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 0.5rem;">0 of 0 bills settled</p>
                    </div>

                    <!-- 2.3 Payout Progress -->
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <span style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Payout Progress (Owner Transfers)</span>
                            <div id="statPayoutPercent" style="font-weight: 900; color: var(--warning);">0%</div>
                        </div>
                        <div class="progress-container" style="margin: 0;">
                            <div id="payoutProgressBar" class="progress-bar" style="background: var(--warning);"></div>
                            <div class="progress-text" id="payoutProgressText">0% TRANSFERRED</div>
                        </div>
                        <p id="payoutDetails" style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 0.5rem;">₹0 of ₹0 income paid out</p>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; border-top: 1px dashed var(--border); padding-top: 1rem; margin-top: 1.5rem; margin-bottom: 1rem;">
                        <div style="background: var(--bg-input); padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md);">
                            <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Billed Dues</div>
                            <div id="statTotalDues" style="font-weight: 900; color: var(--danger); font-size: 1rem;">₹0</div>
                        </div>
                        <div style="background: var(--bg-input); padding: 0.75rem; border: 1px solid var(--border); border-radius: var(--radius-md);">
                            <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Potential Arrears <i data-lucide="help-circle" class="help-trigger" onclick="showHelp('arrears')"></i></div>
                            <div id="statTotalArrears" style="font-weight: 900; color: var(--warning); font-size: 1rem;">₹0</div>
                        </div>
                    </div>
                    
                    <div id="pendingCollectionList" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 250px; overflow-y: auto; padding-right: 5px;" class="no-scrollbar">
                        <!-- Defaulters will be injected here -->
                    </div>
                </div>

                <!-- 3. Immediate Action: Bill Status -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="calendar-check"></i> Bill Status</h3>
                        <div id="currentTrackingMonth" style="font-weight: 800; color: var(--primary); text-transform: uppercase; font-size: 0.75rem;">Syncing</div>
                    </div>
                    <div id="monthlyChecklist" style="display: flex; flex-direction: column; gap: 0.5rem;"></div>
                </div>

                <!-- 4. Owner Settlements -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="layout-list"></i> Account Settlements</h3>
                    </div>
                    <div id="ownerSettlementList" style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <!-- Owner balance items will be injected here -->
                    </div>
                </div>

                <!-- 5. Tenant Financial Ledger -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="contact-2"></i> All-Time Ledger</h3>
                        <div style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Total Billed vs Total Paid</div>
                    </div>
                    <div id="tenantLedgerList" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: max-content; overflow-y: auto; padding-right: 5px;" class="no-scrollbar">
                        <!-- Tenant ledger items will be injected here -->
                    </div>
                </div>

                <!-- 6. Activity Timeline -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="history"></i> Activity Timeline</h3>
                        <select id="logFilter" onchange="loadActivityLogs()" style="font-size: 0.7rem; padding: 4px 8px; border-radius: 4px; border: 2px solid var(--border); background: var(--bg-input); font-weight: 800; text-transform: uppercase;">
                            <option value="ALL">Recent Activity</option>
                            <option value="PAYMENTS">Payments & Dues</option>
                            <option value="BILLS">Bills & Invoices</option>
                            <option value="TENANTS">Units & Tenants</option>
                            <option value="MAINTENANCE">Maintenance</option>
                            <option value="SYSTEM">System & Security</option>
                        </select>
                    </div>
                    <div id="activityLog" class="activity-feed"></div>
                </div>

            </div>
        </section>
    `,

    billing: `
        <section id="billing-module" class="app-section hidden">
            <div id="billingMainView">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
                    <h2 class="section-title"><i data-lucide="receipt"></i> Unit Billing</h2>
                </div>
                
                <div class="card" style="padding: 1.5rem;">
                    <div class="billing-search-grid">
                        <div style="padding: 0 1rem; display: flex; align-items: center; gap: 0.75rem; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); height: 48px;">
                            <i data-lucide="search" style="width: 18px; color: var(--text-muted);"></i>
                            <input type="text" id="searchBar" placeholder="Search unit or tenant..." onkeyup="searchTenants()" style="border: none; background: transparent; width: 100%; font-size: 0.95rem; outline: none; font-weight: 500;">
                        </div>
                        
                        <div style="display: flex; gap: 0.5rem; background: var(--bg-input); padding: 4px; border: 1px solid var(--border); border-radius: var(--radius-md); height: 48px;">
                            <button onclick="filterBilling('all')" id="filterBillAll" class="btn btn-sm active" style="flex: 1; border: none; font-size: 0.75rem;">All Units</button>
                            <button onclick="filterBilling('pending')" id="filterBillPending" class="btn btn-sm" style="flex: 1; border: none; font-size: 0.75rem;">Pending Only</button>
                        </div>
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
                <div class="card no-print" style="margin-bottom: 1.5rem;">
                    <div class="input-group" style="margin:0;">
                        <label>Select Unit / Tenant</label>
                        <select id="historyTenantSelect" onchange="loadTenantHistory(this.value)" style="font-weight: 800; color: var(--primary);">
                            <option value="">-- Select Unit --</option>
                        </select>
                    </div>
                </div>
                <div id="historyResults" class="hidden">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1.25rem;">
                        <h3 id="historySelectedName" class="section-title" style="font-size: 1rem;">Tenant Name</h3>
                        <button onclick="printTenantStatement()" class="btn btn-secondary btn-sm" title="Print Ledger">
                            <i data-lucide="printer"></i> <span class="sm:hidden">Print Ledger</span>
                        </button>
                    </div>

                    <!-- Financial Summary for Tenant -->
                    <div id="historyTenantSummary" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1.5rem;" class="no-print">
                        <div style="background: var(--bg-danger-light); padding: 0.75rem; border: 1px solid var(--danger); border-radius: var(--radius-md);">
                            <div style="font-size: 0.6rem; font-weight: 800; color: var(--danger); text-transform: uppercase;">Outstanding Balance</div>
                            <div id="histStatBalance" style="font-weight: 900; font-size: 1rem; color: var(--text-main);">₹0</div>
                        </div>
                        <div style="background: var(--bg-success-light); padding: 0.75rem; border: 1px solid var(--success); border-radius: var(--radius-md);">
                            <div style="font-size: 0.6rem; font-weight: 800; color: var(--success); text-transform: uppercase;">Security Advance</div>
                            <div id="histStatAdvance" style="font-weight: 900; font-size: 1rem; color: var(--text-main);">₹0</div>
                        </div>
                    </div>

                    <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 8px;">
                        <i data-lucide="list" style="width: 12px; height: 12px;"></i> Billing History
                    </div>

                    <div id="historyBody" class="history-list"></div>
                    <div id="historyLoadMoreContainer" style="margin-top: 1.5rem; text-align: center;" class="hidden no-print">
                        <button onclick="loadMoreTenantHistory()" class="btn btn-secondary btn-sm" style="width: 100%; border-style: dashed;">Load Older Records</button>
                    </div>
                </div>
                <div id="historyEmptyState" class="empty-state no-print">
                    <i data-lucide="file-search"></i>
                    <p>Select a unit to view statements</p>
                </div>
            </div>

            <div id="historyOwnersContent" class="hidden">
                <div class="card">
                    <div class="card-header no-print">
                        <h3 class="section-title"><i data-lucide="banknote"></i> Owner Payout History</h3>
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick="printPayoutHistory()" class="btn btn-secondary btn-icon-sm" title="Print History"><i data-lucide="printer"></i></button>
                            <button onclick="toggleWithdrawalForm()" id="witToggleBtn" class="btn btn-primary btn-sm">Record Payout</button>
                        </div>
                    </div>

                    <!-- Owner Filter Dropdown -->
                    <div style="padding: 0 1.5rem; margin-bottom: 1rem;" class="no-print">
                        <div class="input-group" style="margin:0;">
                            <label style="font-size: 0.6rem;">Filter by Owner</label>
                            <select id="payoutOwnerFilter" onchange="loadWithdrawals(this.value)" style="font-weight: 800; color: var(--primary); border: 2px solid var(--border);">
                                <option value="">All Owners</option>
                            </select>
                        </div>
                    </div>
                    <div id="withdrawal-form" class="hidden no-print" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid var(--border);">
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
                    <div id="payoutLoadMoreContainer" style="margin-top: 1.5rem; text-align: center;" class="hidden no-print">
                        <button onclick="loadMoreWithdrawals()" class="btn btn-secondary btn-sm" style="width: 100%; border-style: dashed;">Load Older Payouts</button>
                    </div>
                </div>
            </div>
        </section>
    `,

    settings: `
        <section id="settings-section" class="app-section hidden">
            <div style="max-width: 800px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem;" class="no-print">
                
                <!-- 1. System Configuration -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="server"></i> System Configuration</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1rem;">
                        <div class="grid-inputs">
                            <div class="input-group"><label>Property Name</label><input type="text" id="prop_name" placeholder="e.g. Blue Sky Apartments"></div>
                            <div class="input-group" style="grid-column: span 2;"><label>Property Address</label><input type="text" id="prop_addr" placeholder="Full Street Address"></div>
                        </div>
                        <div class="grid-inputs">
                            <div class="input-group"><label>Admin Email</label><input type="text" id="email_user"></div>
                            <div class="input-group"><label>SMTP App Pass</label><input type="password" id="email_pass"></div>
                            <div class="input-group"><label>Auto-BCC</label><input type="text" id="email_bcc"></div>
                        </div>
                        <div class="grid-inputs">
                            <div class="input-group"><label>Server Port</label><input type="number" id="server_port" placeholder="8080"></div>
                            <div class="input-group"><label>New Master PIN</label><input type="password" id="new_master_pin" maxlength="4" placeholder="****"></div>
                        </div>
                        <div style="display: flex; gap: 0.75rem; border-top: 1px dashed var(--border); padding-top: 1.5rem;">
                            <button onclick="saveSystemSettings()" class="btn btn-primary btn-sm" style="flex: 1;">Save Configuration</button>
                            <button onclick="testSMTPSettings()" class="btn btn-secondary btn-sm" style="flex: 1;">Test SMTP Mail</button>
                        </div>
                    </div>
                </div>

                <!-- 2. Receiving Accounts -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="wallet"></i> Receiving Accounts</h3>
                    </div>
                    <div style="margin-top: 1rem;">
                        <div class="grid-inputs">
                            <div class="input-group"><label>Owner / Payee Name *</label><input type="text" id="acc_name" placeholder="Full Name"></div>
                            <div class="input-group"><label>Account Label</label><input type="text" id="acc_label" placeholder="e.g. Primary"></div>
                        </div>
                        
                        <div style="padding: 1.25rem; border: 2px dashed var(--border); margin: 1.5rem 0; background: var(--bg-input);">
                            <div style="font-size: 0.65rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; margin-bottom: 1.25rem;">Payment Details (Fill either/both)</div>
                            <div class="grid-inputs">
                                <div class="input-group" style="margin-top: 0;"><label>UPI ID</label><input type="text" id="acc_upi" placeholder="name@bank"></div>
                                <div class="input-group" style="margin-top: 0;"><label>Bank Name</label><input type="text" id="acc_bank" placeholder="e.g. HDFC"></div>
                                <div class="input-group" style="margin-top: 0;"><label>Acc Number</label><input type="text" id="acc_num"></div>
                                <div class="input-group" style="margin-top: 0;"><label>IFSC Code</label><input type="text" id="acc_ifsc"></div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 0.75rem;">
                            <button onclick="saveReceivingAccount()" id="addAccBtn" class="btn btn-primary btn-sm" style="flex: 2;">Add Account Record</button>
                            <button onclick="cancelAccountEdit()" id="cancelAccEditBtn" class="btn btn-secondary btn-sm hidden" style="flex: 1;">Cancel</button>
                        </div>

                        <div id="unifiedAccountList" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;"></div>
                    </div>
                </div>

                <!-- 3. Unit Directory -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="users"></i> Unit Directory</h3>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="file" id="importCsvInput" accept=".csv" class="hidden" onchange="importTenantsCSV(this)">
                            <button onclick="document.getElementById('importCsvInput').click()" class="btn btn-secondary btn-sm" title="Import CSV"><i data-lucide="upload"></i></button>
                            <button onclick="exportTenantsCSV()" class="btn btn-secondary btn-sm" title="Download CSV"><i data-lucide="download"></i></button>
                            <button onclick="toggleRegForm()" id="regToggleBtn" class="btn btn-primary btn-sm">Register New Unit</button>
                        </div>
                    </div>
                    <div id="entrance-form" class="hidden" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid var(--border);">
                        <h4 id="form-title" style="font-size: 0.9rem; margin-bottom: 1.5rem; color: var(--primary); text-transform: uppercase; font-weight: 900;">New Registration</h4>
                        
                        <div style="display: flex; flex-direction: column; gap: 2rem;">
                            <!-- Section: Primary Info -->
                            <div>
                                <h5 style="font-size: 0.65rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem; border-bottom: 1px dashed var(--border); padding-bottom: 0.5rem;">Occupant Details</h5>
                                <div class="grid-inputs">
                                    <div class="input-group"><label>Full Name *</label><input type="text" id="tName"></div>
                                    <div class="input-group"><label>Mobile *</label><input type="text" id="tMobile"></div>
                                    <div class="input-group"><label>Aadhar No</label><input type="text" id="tAadhar"></div>
                                    <div class="input-group"><label>Email</label><input type="email" id="tEmail"></div>
                                    <div class="input-group"><label>Occupation</label><input type="text" id="tJob"></div>
                                    <div class="input-group"><label>Emergency Contact</label><input type="text" id="tEmerg"></div>
                                </div>
                            </div>

                            <!-- Section: Lease Details -->
                            <div>
                                <h5 style="font-size: 0.65rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem; border-bottom: 1px dashed var(--border); padding-bottom: 0.5rem;">Unit & Lease</h5>
                                <div class="grid-inputs">
                                    <div class="input-group"><label>Room/Unit *</label><input type="text" id="tRoom"></div>
                                    <div class="input-group"><label>Move-in</label><input type="date" id="tMoveIn"></div>
                                    <div class="input-group"><label>Base Rent *</label><input type="number" id="tRent"></div>
                                    <div class="input-group"><label>Advance</label><input type="number" id="tAdvance" value="0"></div>
                                </div>
                            </div>

                            <!-- Section: Utilities -->
                            <div>
                                <h5 style="font-size: 0.65rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem; border-bottom: 1px dashed var(--border); padding-bottom: 0.5rem;">Utilities & Settings</h5>
                                <div class="grid-inputs">
                                    <div class="input-group"><label>EB Rate</label><input type="number" id="tEbRate" value="9.00"></div>
                                    <div class="input-group"><label>Initial EB</label><input type="number" id="tInitialEb" value="0"></div>
                                    <div class="input-group"><label>Water/Maint</label><input type="number" id="tWater" value="0"></div>
                                    <div class="input-group"><label>Assign Account *</label><select id="tAssignedUpi"><option value="">-- Select --</option></select></div>
                                </div>
                            </div>

                            <!-- Section: Address -->
                            <div>
                                <h5 style="font-size: 0.65rem; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 1rem; border-bottom: 1px dashed var(--border); padding-bottom: 0.5rem;">Permanent Address</h5>
                                <div class="input-group" style="margin-top: 0;"><label>Address</label><input type="text" id="tPermAddr"></div>
                            </div>
                        </div>

                        <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem; border-top: 1px dashed var(--border); padding-top: 1.5rem;">
                            <button onclick="addTenant()" id="mainSubmitBtn" class="btn btn-primary" style="flex: 2;">Save Record</button>
                            <button id="formAgreementBtn" class="btn btn-secondary" style="flex: 1;">Print Agreement</button>
                            <button id="formDeleteBtn" class="btn btn-danger" style="flex: 1;">Delete</button>
                            <button onclick="toggleRegForm()" class="btn btn-secondary" style="margin-left: auto;">Close</button>
                        </div>
                    </div>
                    <div id="manageTenantList" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;"></div>
                </div>

                <!-- 4. Maintenance Logs -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="trending-down"></i> Maintenance Logs</h3>
                        <button onclick="toggleExpenseForm()" id="expToggleBtn" class="btn btn-secondary btn-sm">Record Outflow</button>
                    </div>
                    <div id="expense-form" class="hidden" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid var(--border);">
                        <div class="grid-inputs">
                            <div class="input-group"><label>Category</label><select id="eCategory"><option value="Maintenance">Repair</option><option value="Taxes">Taxes</option><option value="Utility">Utility</option><option value="Salary">Staff</option><option value="Other">Other</option></select></div>
                            <div class="input-group"><label>Owner Account *</label><select id="eOwnerName"><option value="">-- Select --</option></select></div>
                            <div class="input-group"><label>Amount</label><input type="number" id="eAmount"></div>
                            <div class="input-group"><label>Date</label><input type="date" id="eDate"></div>
                            <div class="input-group" style="grid-column: 1/-1;"><label>Note</label><input type="text" id="eNotes"></div>
                        </div>
                        <div style="display: flex; gap: 0.75rem; margin-top: 1rem;">
                            <button onclick="addExpense()" class="btn btn-primary" style="flex: 1;">Save Expense</button>
                            <button onclick="toggleExpenseForm()" class="btn btn-secondary">Cancel</button>
                        </div>
                    </div>
                    <div id="expenseList" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;"></div>
                </div>

                <!-- 5. Audit & Reports -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="file-check"></i> Audit & Analysis</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
                        <div class="input-group" style="margin: 0;"><label>Select Audit Period</label><input type="month" id="auditMonth" value="${new Date().toISOString().slice(0, 7)}"></div>
                        <button onclick="viewAuditReport()" class="btn btn-primary btn-sm" style="width: 100%;">Generate Financial Audit</button>
                    </div>
                </div>

                <!-- 6. Database Management -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="database"></i> Data Integrity</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 2rem; margin-top: 1rem;">
                        <div style="border-bottom: 1px dashed var(--border); padding-bottom: 1.5rem;">
                            <p style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 1rem;">Backup Management</p>
                            <div class="input-group"><label>File Name Prefix</label><input type="text" id="backupFilename" placeholder="manual_backup"></div>
                            <button onclick="backupDatabase()" class="btn btn-primary btn-sm" style="width: 100%; margin-top: 0.5rem;">Download Local Backup (.db)</button>
                        </div>

                        <div>
                            <p style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 1rem;">Disaster Recovery</p>
                            <div style="background: var(--bg-danger-light); border: 1px solid var(--border); padding: 1rem; margin-bottom: 1rem;">
                                <p style="font-size: 0.65rem; color: var(--text-main); font-weight: 800; line-height: 1.4;">⚠️ WARNING: RESTORING WILL OVERWRITE ALL CURRENT DATA PERMANENTLY.</p>
                            </div>
                            <div class="grid-inputs">
                                <div class="input-group" style="margin: 0;"><label>Select Backup File</label><input type="file" id="restoreFile" accept=".db" style="padding: 0.5rem; background: var(--bg-input);"></div>
                                <div class="input-group" style="margin: 0;"><label>Master PIN Authorization</label><input type="password" id="restorePin" maxlength="4" placeholder="****"></div>
                            </div>
                            <button onclick="restoreDatabase()" class="btn btn-danger btn-sm" style="width: 100%; margin-top: 1rem;">Execute Data Restore</button>
                        </div>
                    </div>
                </div>

                <!-- 7. Archived Data -->
                <div style="margin-top: 1rem;">
                    <button onclick="toggleHistory()" class="btn btn-secondary" style="width: 100%; background: transparent; border: 2px dashed var(--border); color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; font-weight: 800;">
                        <i data-lucide="archive" style="width: 14px; height: 14px; margin-right: 6px;"></i> View / Hide Archived Units
                    </button>
                    <div id="vacantList" class="hidden" style="margin-top: 1.5rem;"><div id="archivedTenantList" style="display: flex; flex-direction: column; gap: 0.75rem;"></div></div>
                </div>

                <!-- 8. Mobile Session Management -->
                <div class="sm:hidden" style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--border);">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <button onclick="toggleDarkMode()" class="btn btn-secondary" style="width: 100%;">
                            <i data-lucide="moon"></i> Appearance
                        </button>
                        <button onclick="logout()" class="btn btn-danger" style="width: 100%;">
                            <i data-lucide="log-out"></i> Logout
                        </button>
                    </div>
                </div>

            </div>
        </section>
    `,

    modals: `
        <div id="shareModal" class="modal-overlay hidden"><div class="modal-content" style="max-width: 400px;">
            <div class="card-header"><h3 class="section-title">Dispatch Center</h3><button onclick="closeShareModal()" class="btn-secondary" style="border: none; background: none; cursor: pointer;"><i data-lucide="x"></i></button></div>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <button onclick="shareTo('wa')" class="btn" style="background: #25D366; color: white; width: 100%;"><i data-lucide="message-circle" style="margin-right: 8px;"></i> WhatsApp</button>
                <button onclick="shareTo('email')" class="btn" style="background: #ea4335; color: white; width: 100%;"><i data-lucide="mail" style="margin-right: 8px;"></i> Email Receipt</button>
                <button onclick="shareTo('print')" class="btn" style="background: #1e293b; color: white; width: 100%;"><i data-lucide="printer" style="margin-right: 8px;"></i> Print / Save PDF</button>
                <button onclick="shareTo('copy')" class="btn btn-secondary" style="width: 100%;"><i data-lucide="copy" style="margin-right: 8px;"></i> Copy Text</button>
            </div>
        </div></div>

        <!-- Hidden container for high-quality printing -->
        <div id="print-area" class="hidden"></div>

        <div id="settlementModal" class="modal-overlay hidden"><div class="modal-content" style="max-width: 500px;">
            <div class="card-header"><h3 class="section-title">Final Settlement</h3><button onclick="closeSettlementModal()" class="btn-secondary" style="border: none; background: none; cursor: pointer;"><i data-lucide="x"></i></button></div>
            <div class="grid-inputs">
                <div class="input-group"><label>Advance</label><input type="number" id="sAdvance" readonly style="font-weight: 800; color: var(--primary);"></div>
                <div class="input-group"><label>Final EB</label><input type="number" id="sEbReading" oninput="calcSettlement('reading')" placeholder="Reading"></div>
                <div class="input-group"><label>Rent Due (-)</label><input type="number" id="sRentDue" value="0" oninput="calcSettlement('manual')"></div>
                <div class="input-group"><label>EB Due (-)</label><input type="number" id="sEbDue" value="0" oninput="calcSettlement('manual')"></div>
                <div class="input-group"><label>Damages (-)</label><input type="number" id="sRepairs" value="0" oninput="calcSettlement('manual')"></div>
                <div class="input-group"><label>Reason</label><input type="text" id="sReason"></div>
            </div>
            <div style="background: var(--primary-light); padding: 1.5rem; rounded-xl; text-align: center; margin: 1.5rem 0; border-radius: var(--radius-lg);">
                <div id="settlementLabel" style="font-size: 0.7rem; font-weight: 800; color: var(--secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Total Refund</div>
                <div id="settlementTotal" style="font-size: 1.75rem; font-weight: 900; color: var(--primary);">₹0.00</div>
            </div>
            <div style="display: flex; gap: 0.5rem;"><button onclick="processSettlementAndVacant()" class="btn btn-primary" style="flex: 1;">Execute Exit</button><button onclick="closeSettlementModal()" class="btn btn-secondary">Abort</button></div>
        </div></div>

        <div id="deletePinModal" class="modal-overlay hidden"><div class="modal-content" style="max-width: 350px; text-align: center;">
            <div class="stat-icon icon-danger" style="width: 50px; height: 50px; margin: 0 auto 1rem;"><i data-lucide="shield-alert"></i></div>
            <h3 id="confirmationTitle" class="section-title" style="justify-content: center;">Authorize</h3>
            <p id="confirmationMessage" style="font-size: 0.75rem; color: var(--text-muted); margin: 0.5rem 0 1.5rem;">Enter Master PIN to confirm action.</p>
            <input type="password" id="deletePinInput" maxlength="4" style="width: 100%; text-align: center; font-size: 2rem; letter-spacing: 1.5rem; padding: 0.5rem; border: 3px solid var(--border); border-radius: var(--radius-md); background: var(--bg-input); color: var(--text-main); outline: none; margin-bottom: 1.5rem;">
            <div style="display: flex; gap: 0.5rem;"><button onclick="confirmActionWithPin()" class="btn btn-danger" style="flex: 1;">Confirm</button><button onclick="closeDeleteModal()" class="btn btn-secondary" style="flex: 1;">Cancel</button></div>
        </div></div>

        <div id="paymentModal" class="modal-overlay hidden"><div class="modal-content" style="max-width: 450px;">
            <h3 class="section-title" style="margin-bottom: 1.5rem;">Record Payment</h3>
            
            <div id="paySummary" style="background: var(--primary-light); padding: 1.5rem; margin-bottom: 1.5rem; border: 3px solid var(--border);">
                <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Total Due</div>
                <div id="payTotalLabel" style="font-size: 1.5rem; font-weight: 900; color: var(--primary);">₹0</div>
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
                    <select id="adjType" style="font-size: 0.7rem; padding: 4px; border: 2px solid var(--border); background: var(--bg-input); color: var(--text-main);" onchange="calculateAdjustments()">
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
            <div class="print-only" style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 1.5rem; margin-bottom: 2rem; font-family: var(--font-main), sans-serif;">
                <h2 id="printPropName" style="margin: 0; font-size: 1.4rem; text-transform: uppercase; font-weight: 900;"></h2>
                <p id="printPropAddr" style="margin: 4px 0; font-size: 0.9rem; color: #333;"></p>
                <div style="margin-top: 15px; font-weight: 900; background: #000; color: #fff !important; display: inline-block; padding: 5px 20px; font-size: 1rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px;">ACCOUNT STATEMENT / TIMELINE</div>
                <p style="margin: 12px 0 0 0; font-size: 0.8rem; font-weight: bold; color: #555;">Statement Generated: ${new Date().toLocaleString('en-IN')}</p>
            </div>
            <div class="card-header no-print">
                <h3 class="section-title"><i data-lucide="list-tree"></i> Account Timeline</h3>
                <button onclick="printOwnerTimeline()" class="btn btn-secondary btn-icon-sm" title="Print"><i data-lucide="printer"></i></button>
            </div>
            <div id="timelineOwnerName" style="font-weight: 900; font-size: 1.2rem; margin: 1rem 0; text-transform: uppercase; border-left: 5px solid var(--primary); padding-left: 10px;"></div>
            <div id="ownerTimelineContent" style="flex: 1; overflow-y: auto; padding: 0.5rem;">
                <!-- Timeline items injected here -->
            </div>
            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 2px solid var(--border);" class="no-print">
                <button onclick="closeOwnerTimeline()" class="btn btn-secondary" style="width: 100%;">Close</button>
            </div>
        </div></div>

        <div id="auditModal" class="modal-overlay hidden"><div class="modal-content" style="max-width: 800px; height: 90vh; display: flex; flex-direction: column;">
            <div class="print-only" style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 1.5rem; margin-bottom: 2rem; font-family: var(--font-main), sans-serif;">
                <h2 class="auditPrintPropName" style="margin: 0; font-size: 1.4rem; text-transform: uppercase; font-weight: 900;"></h2>
                <p class="auditPrintPropAddr" style="margin: 4px 0; font-size: 0.9rem; color: #333;"></p>
                <div style="margin-top: 15px; font-weight: 900; background: #000; color: #fff !important; display: inline-block; padding: 5px 20px; font-size: 1rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px;">MONTHLY AUDIT REPORT</div>
                <p style="margin: 12px 0 0 0; font-size: 0.8rem; font-weight: bold; color: #555;">Generated on: ${new Date().toLocaleString('en-IN')}</p>
            </div>
            <div class="card-header no-print">
                <h3 class="section-title">Audit Record</h3>
                <button onclick="closeAuditModal()" class="btn btn-secondary btn-icon-sm" style="border: none; background: none; cursor: pointer;"><i data-lucide="x"></i></button>
            </div>
            <div id="auditContent" style="flex: 1; overflow-y: auto; padding: 1rem; font-family: monospace; border: 3px solid var(--border); background: var(--bg-card); color: var(--text-main);">
                <!-- Audit content will be injected here -->
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;" class="no-print">
                <button onclick="printAudit()" class="btn btn-primary" style="flex: 1;">Print Audit <i data-lucide="printer" style="width: 16px;"></i></button>
                <button onclick="closeAuditModal()" class="btn btn-secondary">Close</button>
            </div>
        </div></div>
    `
};
