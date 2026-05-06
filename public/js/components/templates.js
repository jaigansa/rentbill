const Templates = {
    authOverlay: `
        <div class="modal-content" style="max-width: 360px; text-align: center; border: none; box-shadow: var(--shadow-xl);">
            <div class="modal-body" style="padding: 3rem 2rem;">
                <div class="sidebar-brand" style="width: 64px; height: 64px; margin: 0 auto 1.5rem; background: var(--primary); color: white; border-radius: 20px;">
                    <i data-lucide="building-2" style="width: 32px; height: 32px;"></i>
                </div>
                <h2 style="font-weight: 900; font-size: 1.5rem; color: var(--text-main); margin-bottom: 0.5rem;">RentBill Pro</h2>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 2.5rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Authorized Access Only</p>
                
                <div class="pin-dots" style="display: flex; justify-content: center; gap: 1.25rem; margin-bottom: 2.5rem;">
                    <div class="dot" style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--border); transition: all 0.2s ease;"></div>
                    <div class="dot" style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--border); transition: all 0.2s ease;"></div>
                    <div class="dot" style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--border); transition: all 0.2s ease;"></div>
                    <div class="dot" style="width: 16px; height: 16px; border-radius: 50%; border: 2px solid var(--border); transition: all 0.2s ease;"></div>
                </div>

                <div class="pin-keypad" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; max-width: 240px; margin: 0 auto;">
                    ${[1,2,3,4,5,6,7,8,9].map(n => `<button onclick="pressKey('${n}')" class="key" style="height: 64px; border-radius: 50%; border: 1px solid var(--border); background: var(--bg-card); font-size: 1.25rem; font-weight: 700; color: var(--text-main); cursor: pointer; transition: all 0.15s ease;">${n}</button>`).join('')}
                    <button onclick="forgotPin()" class="key" style="height: 64px; border: none; background: transparent; color: var(--primary); font-size: 0.7rem; font-weight: 800; text-transform: uppercase; cursor: pointer;">Reset</button>
                    <button onclick="pressKey('0')" class="key" style="height: 64px; border-radius: 50%; border: 1px solid var(--border); background: var(--bg-card); font-size: 1.25rem; font-weight: 700; color: var(--text-main); cursor: pointer; transition: all 0.15s ease;">0</button>
                    <button onclick="pressKey('back')" class="key" style="height: 64px; border: none; background: transparent; color: var(--danger); display: flex; align-items: center; justify-content: center; cursor: pointer;"><i data-lucide="delete"></i></button>
                </div>
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
                <button onclick="showSection('dashboard-section')" class="nav-btn active" title="Dashboard">
                    <i data-lucide="layout-dashboard"></i>
                    <span>Dashboard</span>
                </button>
                <button onclick="showSection('tenants-section')" class="nav-btn" title="Tenants">
                    <i data-lucide="users"></i>
                    <span>Tenants</span>
                </button>
                <button onclick="showSection('owners-section')" class="nav-btn" title="Owners">
                    <i data-lucide="wallet"></i>
                    <span>Owners</span>
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
        <section id="dashboard-section" class="app-section">
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
                    <button onclick="showSection('settings-section'); switchSubSection('settings-section', 'settings-maintenance');" class="quick-action-btn">
                        <div class="qa-icon"><i data-lucide="wrench"></i></div>
                        <span>Raise Ticket</span>
                    </button>
                    <button onclick="quickAddExpense()" class="quick-action-btn">
                        <div class="qa-icon"><i data-lucide="trending-down"></i></div>
                        <span>Add Expense</span>
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
                            <button onclick="showSection('owners-section'); switchSubSection('owners-section', 'owners-accounts');" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.6rem; min-height: 0;">Setup</button>
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
                            <button onclick="showSection('tenants-section'); switchSubSection('tenants-section', 'tenants-billing');" class="btn btn-secondary btn-sm" style="padding: 4px 8px; font-size: 0.6rem; min-height: 0;">Go</button>
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

                <!-- 4. Activity Timeline -->
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

    tenants: `
        <section id="tenants-section" class="app-section hidden">
            <div class="sub-nav no-print">
                <button onclick="switchSubSection('tenants-section', 'tenants-billing')" class="sub-nav-btn active">
                    <i data-lucide="receipt"></i> Billing
                </button>
                <button onclick="switchSubSection('tenants-section', 'tenants-directory')" class="sub-nav-btn">
                    <i data-lucide="book-open"></i> Directory
                </button>
                <button onclick="switchSubSection('tenants-section', 'tenants-statements')" class="sub-nav-btn">
                    <i data-lucide="history"></i> Statements
                </button>
                <button onclick="switchSubSection('tenants-section', 'tenants-archived')" class="sub-nav-btn">
                    <i data-lucide="archive"></i> Archived
                </button>
                <button onclick="switchSubSection('tenants-section', 'tenants-vault')" class="sub-nav-btn">
                    <i data-lucide="folder-lock"></i> Vault
                </button>
            </div>

            <div id="tenants-billing" class="sub-section">
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

            <div id="tenants-directory" class="sub-section hidden">
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

                <!-- Tenant Financial Ledger (Summary of all) -->
                <div class="card" style="margin-top: 2rem;">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="contact-2"></i> All-Time Ledger Summary</h3>
                    </div>
                    <div id="tenantLedgerList" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: max-content; overflow-y: auto; padding-right: 5px;" class="no-scrollbar"></div>
                </div>
            </div>

            <div id="tenants-statements" class="sub-section hidden">
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
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; padding-bottom: 1rem; border-bottom: 1.5px solid var(--border);">
                            <div>
                                <h3 id="historySelectedName" class="section-title" style="font-size: 1.1rem; margin-bottom: 2px; color: var(--text-main);">Tenant Name</h3>
                                <div style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Detailed Payment History</div>
                            </div>
                            <button onclick="printTenantStatement()" class="btn btn-secondary btn-sm" title="Print Ledger" style="border: 1px solid var(--border);">
                                <i data-lucide="printer"></i> <span class="sm:hidden">Print Ledger</span>
                            </button>
                        </div>

                        <!-- Financial Summary for Tenant -->
                        <div id="historyTenantSummary" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;" class="no-print">
                            <div style="background: var(--bg-danger-light); padding: 0.75rem; border: 1px solid var(--danger); border-radius: var(--radius-md); text-align: center;">
                                <div style="font-size: 0.6rem; font-weight: 800; color: var(--danger); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">Outstanding</div>
                                <div id="histStatBalance" style="font-weight: 900; font-size: 1.1rem; color: var(--danger);">₹0</div>
                            </div>
                            <div style="background: var(--bg-success-light); padding: 0.75rem; border: 1px solid var(--success); border-radius: var(--radius-md); text-align: center;">
                                <div style="font-size: 0.6rem; font-weight: 800; color: var(--success); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">Advance</div>
                                <div id="histStatAdvance" style="font-weight: 900; font-size: 1.1rem; color: var(--success);">₹0</div>
                            </div>
                        </div>

                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px;">
                            <i data-lucide="list-checks" style="width: 14px; height: 14px; color: var(--primary);"></i> Transactions
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
            </div>

            <div id="tenants-archived" class="sub-section hidden">
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="archive"></i> Archived & Vacant Units</h3>
                    </div>
                    <div id="archivedTenantList" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.5rem;"></div>
                </div>
            </div>

            <div id="tenants-vault" class="sub-section hidden">
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="folder-lock"></i> Digital Document Vault</h3>
                        <button onclick="toggleUploadForm()" id="uploadToggleBtn" class="btn btn-primary btn-sm">Upload Document</button>
                    </div>
                    
                    <div style="margin-top: 1.5rem; display: flex; align-items: center; gap: 1rem;" class="no-print">
                        <div style="flex: 1; padding: 0 1rem; display: flex; align-items: center; gap: 0.75rem; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); height: 40px;">
                            <i data-lucide="search" style="width: 16px; color: var(--text-muted);"></i>
                            <input type="text" id="vaultSearch" placeholder="Search documents..." onkeyup="searchVault()" style="border: none; background: transparent; width: 100%; font-size: 0.85rem; outline: none;">
                        </div>
                        <select id="vaultFilter" onchange="loadVault()" style="height: 40px; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-input); font-size: 0.75rem; font-weight: 800; padding: 0 1rem;">
                            <option value="">All Documents</option>
                            <option value="ID Proof">ID Proofs</option>
                            <option value="Lease Agreement">Lease Agreements</option>
                        </select>
                    </div>

                    <div id="vaultList" style="margin-top: 1.5rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;"></div>
                </div>
            </div>
        </section>
    `,

    owners: `
        <section id="owners-section" class="app-section hidden">
            <div class="sub-nav no-print">
                <button onclick="switchSubSection('owners-section', 'owners-payouts')" class="sub-nav-btn active">
                    <i data-lucide="banknote"></i> Payouts
                </button>
                <button onclick="switchSubSection('owners-section', 'owners-accounts')" class="sub-nav-btn">
                    <i data-lucide="wallet"></i> Accounts
                </button>
                <button onclick="switchSubSection('owners-section', 'owners-settlements')" class="sub-nav-btn">
                    <i data-lucide="layout-list"></i> Settlements
                </button>
            </div>

            <div id="owners-payouts" class="sub-section">
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

            <div id="owners-accounts" class="sub-section hidden">
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
            </div>

            <div id="owners-settlements" class="sub-section hidden">
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="layout-list"></i> Account Settlements</h3>
                    </div>
                    <div id="ownerSettlementList" style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <!-- Owner balance items will be injected here -->
                    </div>
                </div>
            </div>
        </section>
    `,

    settings: `
        <section id="settings-section" class="app-section hidden">
            <div class="sub-nav no-print">
                <button onclick="switchSubSection('settings-section', 'settings-config')" class="sub-nav-btn active">
                    <i data-lucide="server"></i> Configuration
                </button>
                <button onclick="switchSubSection('settings-section', 'settings-expenses')" class="sub-nav-btn">
                    <i data-lucide="trending-down"></i> Expenses
                </button>
                <button onclick="switchSubSection('settings-section', 'settings-maintenance')" class="sub-nav-btn">
                    <i data-lucide="wrench"></i> Tasks
                </button>
                <button onclick="switchSubSection('settings-section', 'settings-audit')" class="sub-nav-btn">
                    <i data-lucide="file-check"></i> Audit
                </button>
                <button onclick="switchSubSection('settings-section', 'settings-database')" class="sub-nav-btn">
                    <i data-lucide="database"></i> Database
                </button>
            </div>

            <div id="settings-config" class="sub-section">
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

                <!-- Appearance & Logout (Mobile focused but available) -->
                <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid var(--border);">
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

            <div id="settings-expenses" class="sub-section hidden">
                <!-- Maintenance Logs -->
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
            </div>

            <div id="settings-maintenance" class="sub-section hidden">
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="wrench"></i> Maintenance Ticketing</h3>
                        <button onclick="toggleTaskForm()" id="taskToggleBtn" class="btn btn-primary btn-sm">Create New Ticket</button>
                    </div>
                    
                    <div style="margin-top: 1.5rem; display: flex; align-items: center; gap: 1rem;" class="no-print">
                        <div style="flex: 1; padding: 0 1rem; display: flex; align-items: center; gap: 0.75rem; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-md); height: 40px;">
                            <i data-lucide="search" style="width: 16px; color: var(--text-muted);"></i>
                            <input type="text" id="taskSearch" placeholder="Search tasks..." onkeyup="searchTasks()" style="border: none; background: transparent; width: 100%; font-size: 0.85rem; outline: none;">
                        </div>
                        <select id="taskStatusFilter" onchange="loadTasks()" style="height: 40px; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-input); font-size: 0.75rem; font-weight: 800; padding: 0 1rem;">
                            <option value="ALL">All Status</option>
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                        </select>
                    </div>

                    <div id="taskList" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;"></div>
                </div>
            </div>

            <div id="settings-audit" class="sub-section hidden no-print">
                <!-- Audit & Reports -->
                <div class="card no-print">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="file-check"></i> Financial Audit</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1rem;">
                        <!-- Quick Select Shortcuts -->
                        <div style="display: flex; flex-direction: column; gap: 0.75rem;" class="no-print">
                            <p style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Quick Period Selection</p>
                            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
                                <button onclick="setAuditPeriod('current')" class="btn btn-secondary btn-sm" style="font-size: 0.65rem; padding: 10px 5px;">This Month</button>
                                <button onclick="setAuditPeriod('last')" class="btn btn-secondary btn-sm" style="font-size: 0.65rem; padding: 10px 5px;">Last Month</button>
                                <button onclick="setAuditPeriod('fy')" class="btn btn-secondary btn-sm" style="font-size: 0.65rem; padding: 10px 5px;">This FY (Apr-Mar)</button>
                            </div>
                        </div>

                        <!-- Manual Date Inputs -->
                        <div class="grid-inputs no-print">
                            <div class="input-group"><label>From Date</label><input type="date" id="auditFromDate"></div>
                            <div class="input-group"><label>To Date</label><input type="date" id="auditToDate"></div>
                        </div>

                        <!-- Advanced Tax Options (Collapsed by default) -->
                        <div style="border-top: 1px dashed var(--border); padding-top: 1rem;" class="no-print">
                            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="document.getElementById('advancedTaxOptions').classList.toggle('hidden')">
                                <div style="font-size: 0.8rem; font-weight: 800; color: var(--primary);">Professional Tax Options</div>
                                <i data-lucide="chevron-down" style="width: 14px; color: var(--primary);"></i>
                            </div>
                            
                            <div id="advancedTaxOptions" class="hidden no-print" style="margin-top: 1rem; background: var(--bg-main); padding: 1rem; border-radius: 8px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                                    <span style="font-size: 0.75rem; font-weight: 700;">Show Indian Tax Projection (Sec 24a)</span>
                                    <input type="checkbox" id="auditIncludeTax" style="width: 18px; height: 18px; accent-color: var(--primary);">
                                </div>
                                <div class="input-group" style="margin-top: 0;">
                                    <label>Municipal Taxes Paid</label>
                                    <input type="number" id="auditMunicipalTax" value="0">
                                </div>
                            </div>
                        </div>

                        <button onclick="viewAuditReport()" class="btn btn-primary" style="width: 100%; height: 50px; font-weight: 900; font-size: 1rem;">
                            Generate Financial Audit <i data-lucide="sparkles" style="margin-left: 8px;"></i>
                        </button>
                    </div>
                </div>
            </div>

            <div id="settings-database" class="sub-section hidden">
                <!-- Database Management -->
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
            </div>
        </section>
    `,

    modals: `
        <div id="shareModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3 class="section-title"><i data-lucide="send"></i> Dispatch Center</h3>
                    <button onclick="closeShareModal()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                        <button onclick="shareTo('wa')" class="btn" style="background: #25D366; color: white; width: 100%; border: none;">
                            <i data-lucide="message-circle"></i> WhatsApp Message
                        </button>
                        <button onclick="shareTo('email')" class="btn" style="background: #ea4335; color: white; width: 100%; border: none;">
                            <i data-lucide="mail"></i> Email Receipt
                        </button>
                        <button onclick="shareTo('print')" class="btn" style="background: #1e293b; color: white; width: 100%; border: none;">
                            <i data-lucide="printer"></i> Print / Save PDF
                        </button>
                        <button onclick="shareTo('copy')" class="btn btn-secondary" style="width: 100%;">
                            <i data-lucide="copy"></i> Copy Text Only
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div id="print-area" class="hidden"></div>

        <div id="settlementModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="section-title"><i data-lucide="door-open"></i> Final Settlement</h3>
                    <button onclick="closeSettlementModal()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div class="grid-inputs">
                        <div class="input-group"><label>Advance</label><input type="number" id="sAdvance" readonly style="font-weight: 800; color: var(--primary);"></div>
                        <div class="input-group"><label>Final EB</label><input type="number" id="sEbReading" oninput="calcSettlement('reading')" placeholder="Reading"></div>
                        <div class="input-group"><label>Rent Due (-)</label><input type="number" id="sRentDue" value="0" oninput="calcSettlement('manual')"></div>
                        <div class="input-group"><label>EB Due (-)</label><input type="number" id="sEbDue" value="0" oninput="calcSettlement('manual')"></div>
                        <div class="input-group"><label>Damages (-)</label><input type="number" id="sRepairs" value="0" oninput="calcSettlement('manual')"></div>
                        <div class="input-group"><label>Reason</label><input type="text" id="sReason"></div>
                    </div>
                    <div style="background: var(--primary-light); padding: 1.5rem; text-align: center; margin: 1.5rem 0; border-radius: var(--radius-lg); border: 1px solid var(--primary);">
                        <div id="settlementLabel" style="font-size: 0.7rem; font-weight: 800; color: var(--secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Total Refund</div>
                        <div id="settlementTotal" style="font-size: 2rem; font-weight: 900; color: var(--primary);">₹0.00</div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="processSettlementAndVacant()" class="btn btn-primary" style="flex: 2;">Execute Exit</button>
                    <button onclick="closeSettlementModal()" class="btn btn-secondary" style="flex: 1;">Abort</button>
                </div>
            </div>
        </div>

        <div id="deletePinModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 360px;">
                <div class="modal-body" style="text-align: center; padding-top: 3rem;">
                    <div class="stat-icon icon-danger" style="width: 64px; height: 64px; margin: 0 auto 1.5rem;"><i data-lucide="shield-alert" style="width: 32px; height: 32px;"></i></div>
                    <h3 id="confirmationTitle" class="section-title" style="justify-content: center; font-size: 1.2rem;">Authorization Required</h3>
                    <p id="confirmationMessage" style="font-size: 0.8rem; color: var(--text-muted); margin: 0.75rem 0 2rem; line-height: 1.5;">Please enter your Master PIN to confirm this sensitive action.</p>
                    <input type="password" id="deletePinInput" maxlength="4" style="width: 100%; text-align: center; font-size: 2.5rem; letter-spacing: 1.2rem; padding: 1rem; border: 2px solid var(--border); border-radius: var(--radius-lg); background: var(--bg-input); color: var(--text-main); outline: none; margin-bottom: 0.5rem;">
                </div>
                <div class="modal-footer" style="background: transparent; border: none; padding-top: 0;">
                    <button onclick="confirmActionWithPin()" class="btn btn-danger" style="flex: 1;">Confirm</button>
                    <button onclick="closeDeleteModal()" class="btn btn-secondary" style="flex: 1;">Cancel</button>
                </div>
            </div>
        </div>

        <div id="paymentModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header">
                    <h3 class="section-title"><i data-lucide="credit-card"></i> Record Payment</h3>
                    <button onclick="closePaymentModal()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div id="paySummary" style="background: var(--primary-light); padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid var(--primary); border-radius: var(--radius-lg); text-align: center;">
                        <div style="font-size: 0.75rem; font-weight: 800; color: var(--secondary); text-transform: uppercase; margin-bottom: 0.5rem;">Total Outstanding</div>
                        <div id="payTotalLabel" style="font-size: 2rem; font-weight: 900; color: var(--primary);">₹0</div>
                    </div>

                    <div class="grid-inputs">
                        <div class="input-group"><label>Method</label><select id="payMethodInput"><option value="UPI">UPI Digital</option><option value="Cash">Physical Cash</option><option value="Bank">Direct Bank</option></select></div>
                        <div class="input-group"><label>Received By</label><select id="payReceiverInput"><option value="">-- Select Member --</option></select></div>
                        <div class="input-group"><label>Date</label><input type="date" id="payDateInput"></div>
                        <div class="input-group"><label>Amount Paid *</label><input type="number" id="payAmountInput" oninput="calculateAdjustments()"></div>
                    </div>

                    <div id="adjustmentSection" class="hidden" style="margin-top: 1.5rem; padding: 1.25rem; background: var(--bg-input); border: 1px dashed var(--danger); border-radius: var(--radius-md);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: var(--danger);">Balance: <span id="payBalanceLabel">₹0</span></span>
                            <select id="adjType" style="font-size: 0.7rem; padding: 4px 8px; border-radius: 4px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-main); font-weight: 700;" onchange="calculateAdjustments()">
                                <option value="CARRY">Carry Forward (Next Bill)</option>
                                <option value="DISCOUNT">Give Discount (Waiver)</option>
                                <option value="WRITEOFF">Write-Off (Loss)</option>
                            </select>
                        </div>
                        <p id="adjDescription" style="font-size: 0.7rem; color: var(--text-muted); line-height: 1.4; font-style: italic;"></p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="confirmPaymentRecord()" class="btn btn-primary" style="flex: 2;">Save Entry</button>
                    <button onclick="closePaymentModal()" class="btn btn-secondary" style="flex: 1;">Abort</button>
                </div>
            </div>
        </div>

        <div id="billDetailsModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header">
                    <h3 class="section-title"><i data-lucide="receipt"></i> Bill Breakdown</h3>
                    <button onclick="document.getElementById('billDetailsModal').classList.add('hidden')" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div id="billBreakdownContent" style="display: flex; flex-direction: column; gap: 1rem;">
                        <!-- Content will be injected here -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="document.getElementById('billDetailsModal').classList.add('hidden')" class="btn btn-secondary" style="width: 100%;">Close Details</button>
                </div>
            </div>
        </div>

        <div id="taskModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="section-title"><i data-lucide="wrench"></i> Update Ticket</h3>
                    <button onclick="closeTaskModal()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div class="grid-inputs">
                        <div class="input-group"><label>Status</label><select id="mTaskStatus"><option value="Pending">Pending</option><option value="In Progress">In Progress</option><option value="Resolved">Resolved</option></select></div>
                        <div class="input-group"><label>Priority</label><select id="mTaskPriority"><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></select></div>
                        <div class="input-group"><label>Actual Cost (Resolved)</label><input type="number" id="mTaskActualCost" value="0"></div>
                        <div class="input-group"><label>Date Resolved</label><input type="date" id="mTaskDateResolved"></div>
                        <div class="input-group" style="grid-column: 1/-1;"><label>Update Notes</label><input type="text" id="mTaskNotes" placeholder="Resolution details..."></div>
                    </div>
                    <div id="convertOption" class="hidden" style="margin-top: 1.5rem; padding: 1rem; background: var(--bg-success-light); border: 2px dashed var(--success); border-radius: var(--radius-md);">
                        <label style="display: flex; align-items: center; gap: 1rem; cursor: pointer; font-size: 0.85rem; font-weight: 800; color: var(--success);">
                            <input type="checkbox" id="mTaskConvertToExpense" style="width: 20px; height: 20px; accent-color: var(--success);"> 
                            Add to Maintenance Expenses?
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="updateTaskConfirm()" class="btn btn-primary" style="flex: 2;">Save Updates</button>
                    <button onclick="deleteTaskConfirm()" class="btn btn-danger" style="flex: 1;">Delete</button>
                </div>
            </div>
        </div>

        <div id="uploadModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="section-title"><i data-lucide="upload-cloud"></i> Upload Document</h3>
                    <button onclick="toggleUploadForm()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div class="grid-inputs">
                        <div class="input-group"><label>Target Unit (Optional)</label><select id="docRenterId"><option value="">-- Global / No Unit --</option></select></div>
                        <div class="input-group"><label>Document Type</label><select id="docType"><option value="ID Proof">ID Proof (Aadhar/PAN)</option><option value="Lease Agreement">Lease Agreement</option><option value="Police Verification">Police Verification</option><option value="Maintenance Bill">Maintenance Bill</option><option value="Other">Other</option></select></div>
                        <div class="input-group"><label>Expiry Date (if any)</label><input type="date" id="docExpiry"></div>
                        <div class="input-group"><label>File Selection *</label><input type="file" id="docFile" style="padding: 0.5rem; background: var(--bg-input);"></div>
                        <div class="input-group" style="grid-column: 1/-1;"><label>Notes</label><input type="text" id="docNotes" placeholder="e.g. Renew every 11 months"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="uploadDocument()" class="btn btn-primary" style="flex: 2;">Start Upload</button>
                    <button onclick="toggleUploadForm()" class="btn btn-secondary" style="flex: 1;">Cancel</button>
                </div>
            </div>
        </div>

        <div id="createTaskModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 class="section-title"><i data-lucide="wrench"></i> Raise New Ticket</h3>
                    <button onclick="toggleTaskForm()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div class="grid-inputs">
                        <div class="input-group"><label>Target Unit (Optional)</label><select id="tTaskRenterId"><option value="">-- Common / Non-unit --</option></select></div>
                        <div class="input-group"><label>Category</label><select id="tTaskCategory"><option value="Plumbing">Plumbing</option><option value="Electrical">Electrical</option><option value="Carpentry">Carpentry</option><option value="Appliance">Appliance</option><option value="Civil">Civil / Masonry</option><option value="Other">Other</option></select></div>
                        <div class="input-group"><label>Priority</label><select id="tTaskPriority"><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option></select></div>
                        <div class="input-group"><label>Owner responsible</label><select id="tTaskOwner"><option value="">-- Select Owner --</option></select></div>
                        <div class="input-group" style="grid-column: 1/-1;"><label>Task Title *</label><input type="text" id="tTaskTitle" placeholder="Brief issue summary"></div>
                        <div class="input-group" style="grid-column: 1/-1;"><label>Description</label><textarea id="tTaskDesc" style="width: 100%; min-height: 80px; padding: 0.5rem; border-radius: var(--radius-md); border: 2px solid var(--border); background: var(--bg-input); color: var(--text-main); font-family: inherit; outline: none;"></textarea></div>
                        <div class="input-group"><label>Est. Cost</label><input type="number" id="tTaskEstCost" value="0"></div>
                        <div class="input-group"><label>Date Reported</label><input type="date" id="tTaskDateReported"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="saveTask()" class="btn btn-primary" style="flex: 2;">Raise Maintenance Ticket</button>
                    <button onclick="toggleTaskForm()" class="btn btn-secondary" style="flex: 1;">Cancel</button>
                </div>
            </div>
        </div>

        <div id="ownerTimelineModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 600px; display: flex; flex-direction: column;">
                <div class="modal-header no-print">
                    <h3 class="section-title"><i data-lucide="list-tree"></i> Account Timeline</h3>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="printOwnerTimeline()" class="btn btn-secondary btn-icon-sm" title="Print"><i data-lucide="printer"></i></button>
                        <button onclick="closeOwnerTimeline()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                    </div>
                </div>
                <div class="modal-body" style="overflow-y: auto; flex: 1;">
                    <div id="timelineOwnerName" style="font-weight: 900; font-size: 1.2rem; margin-bottom: 1.5rem; text-transform: uppercase; border-left: 5px solid var(--primary); padding-left: 10px; color: var(--primary);"></div>
                    <div id="ownerTimelineContent">
                        <!-- Timeline items injected here -->
                    </div>
                </div>
                <div class="modal-footer no-print">
                    <button onclick="closeOwnerTimeline()" class="btn btn-secondary" style="width: 100%;">Close Statement</button>
                </div>
            </div>
        </div>

        <div id="auditModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 800px; display: flex; flex-direction: column;">
                <div class="modal-header no-print">
                    <h3 class="section-title"><i data-lucide="file-check"></i> Audit Record</h3>
                    <button onclick="closeAuditModal()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body" style="background: var(--bg-main); padding: 0; overflow-y: auto; flex: 1;">
                    <div id="auditContent">
                        <!-- Audit content will be injected here -->
                    </div>
                </div>
                <div class="modal-footer no-print">
                    <button onclick="printAudit()" class="btn btn-primary" style="flex: 2;">
                        Print Report <i data-lucide="printer" style="width: 16px;"></i>
                    </button>
                    <button onclick="closeAuditModal()" class="btn btn-secondary" style="flex: 1;">Close</button>
                </div>
            </div>
        </div>
    `
};
