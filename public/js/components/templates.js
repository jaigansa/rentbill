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
                
                <!-- Executive Stats -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <h3 class="section-title" style="margin: 0; font-size: 0.8rem;">Executive Summary</h3>
                    <button onclick="loadDashboardStats()" class="btn btn-secondary btn-icon-sm" title="Refresh Dashboard"><i data-lucide="refresh-cw" style="width: 14px;"></i></button>
                </div>
                
                <!-- Analytics Chart -->
                <div class="card" style="padding: 1rem; margin-bottom: 1rem; background: var(--bg-card);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">6-Month Financial Trend</div>
                        <div style="display: flex; gap: 10px; font-size: 0.6rem; font-weight: 800; text-transform: uppercase;">
                            <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; background: var(--primary); border-radius: 2px;"></span> Income</span>
                            <span style="display: flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; background: var(--danger); border-radius: 2px;"></span> Expenses</span>
                        </div>
                    </div>
                    <div style="height: 180px; position: relative;">
                        <canvas id="trendChart"></canvas>
                    </div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 1rem;">
                    <div class="stats-row">
                        <div class="stat-card">
                            <div class="stat-icon icon-primary"><i data-lucide="users"></i></div>
                            <div><span class="stat-label">Units</span><div id="statActive" class="stat-value">0</div></div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon icon-success"><i data-lucide="calculator"></i></div>
                            <div>
                                <span class="stat-label">Potential Income</span>
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

                <!-- Activity Timeline -->
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
                <button onclick="switchSubSection('tenants-section', 'tenants-ledger')" class="sub-nav-btn active">
                    <i data-lucide="receipt"></i> Ledger
                </button>
                <button onclick="switchSubSection('tenants-section', 'tenants-registry')" class="sub-nav-btn">
                    <i data-lucide="book-open"></i> Registry
                </button>
                <button onclick="switchSubSection('tenants-section', 'tenants-archived')" class="sub-nav-btn">
                    <i data-lucide="archive"></i> Archive
                </button>
            </div>

            <div id="tenants-ledger" class="sub-section">
                <!-- Unit Billing -->
                <div class="card no-print" style="padding: 1.5rem; margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h4 style="font-size: 0.8rem; font-weight: 900; text-transform: uppercase; color: var(--primary); letter-spacing: 1px;">
                            <i data-lucide="zap" style="width: 16px;"></i> Quick Billing
                        </h4>
                        <div style="display: flex; gap: 6px; background: var(--bg-input); padding: 4px; border-radius: 8px; border: 1px solid var(--border);">
                            <button onclick="filterBilling('all')" id="filterBillAll" class="btn btn-sm active" style="font-size: 0.65rem; border: none; padding: 4px 12px;">All</button>
                            <button onclick="filterBilling('pending')" id="filterBillPending" class="btn btn-sm" style="font-size: 0.65rem; border: none; padding: 4px 12px;">Dues</button>
                        </div>
                    </div>
                    
                    <div style="padding: 0 1rem; display: flex; align-items: center; gap: 0.75rem; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; height: 44px; margin-bottom: 1.5rem;">
                        <i data-lucide="search" style="width: 16px; color: var(--text-muted);"></i>
                        <input type="text" id="searchBar" placeholder="Search unit or tenant..." onkeyup="searchTenants()" style="border: none; background: transparent; width: 100%; font-size: 0.9rem; outline: none; font-weight: 500;">
                    </div>

                    <div id="tenantList"></div>
                </div>

                <!-- Unit Statements / History -->
                <div id="historyTenantsContent">
                    <div class="card no-print" style="margin-bottom: 1.5rem;">
                        <div class="input-group" style="margin:0;">
                            <label>Detailed Unit Statement</label>
                            <select id="historyTenantSelect" onchange="loadTenantHistory(this.value)" style="font-weight: 800; color: var(--primary); border: 1.5px solid var(--primary); border-radius: 10px;">
                                <option value="">-- Select Unit for History --</option>
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

                        <div id="historyBody" class="history-list"></div>
                        <div id="historyLoadMoreContainer" style="margin-top: 1.5rem; text-align: center;" class="hidden no-print">
                            <button onclick="loadMoreTenantHistory()" class="btn btn-secondary btn-sm" style="width: 100%; border-style: dashed; font-weight: 800;">LOAD OLDER RECORDS</button>
                        </div>
                    </div>
                    <div id="historyEmptyState" class="empty-state no-print">
                        <i data-lucide="file-search"></i>
                        <p>Select a unit above to view full ledger</p>
                    </div>
                </div>
            </div>

            <div id="tenants-registry" class="sub-section hidden">
                <!-- Unit Directory -->
                <div class="card" style="margin-bottom: 2rem;">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="users"></i> Unit Directory</h3>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="file" id="importCsvInput" accept=".csv" class="hidden" onchange="importTenantsCSV(this)">
                            <button onclick="document.getElementById('importCsvInput').click()" class="btn btn-secondary btn-icon-sm" title="Import CSV"><i data-lucide="upload"></i></button>
                            <button onclick="exportTenantsCSV()" class="btn btn-secondary btn-icon-sm" title="Download CSV"><i data-lucide="download"></i></button>
                            <button onclick="toggleRegForm()" id="regToggleBtn" class="btn btn-primary btn-sm">Register</button>
                        </div>
                    </div>
                    <div id="entrance-form" class="hidden" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid var(--border);">
                        <h4 id="form-title" style="font-size: 0.9rem; margin-bottom: 1.5rem; color: var(--primary); text-transform: uppercase; font-weight: 900;">New Registration</h4>
                        <div class="grid-inputs">
                            <div class="input-group"><label>Full Name *</label><input type="text" id="tName"></div>
                            <div class="input-group"><label>Mobile *</label><input type="text" id="tMobile"></div>
                            <div class="input-group"><label>Email Address</label><input type="email" id="tEmail"></div>
                            <div class="input-group"><label>Unit / Room *</label><input type="text" id="tRoom"></div>
                            <div class="input-group"><label>Monthly Rent *</label><input type="number" id="tRent"></div>
                            <div class="input-group"><label>Security Advance</label><input type="number" id="tAdvance" value="0"></div>
                            <div class="input-group"><label>Move-in Date</label><input type="date" id="tMoveIn"></div>
                            <div class="input-group"><label>Initial EB Reading</label><input type="number" id="tInitialEb" step="0.01" value="0"></div>
                            <div class="input-group"><label>EB Unit Rate *</label><input type="number" id="tEbRate" step="0.01" value="9.00"></div>
                            <div class="input-group"><label>Water/Maint</label><input type="number" id="tWater" value="0"></div>
                            <div class="input-group"><label>Arrears (OB)</label><input type="number" id="tArrears" value="0"></div>
                            <div class="input-group"><label>Receiving Account *</label><select id="tAssignedUpi"><option value="">-- Select --</option></select></div>
                            <div class="input-group" style="grid-column: span 2;"><label>Permanent Address</label><input type="text" id="tPermAddr"></div>
                            <div class="input-group"><label>Emergency Contact</label><input type="text" id="tEmerg"></div>
                            <div class="input-group"><label>Occupation</label><input type="text" id="tJob"></div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
                            <button onclick="addTenant()" id="mainSubmitBtn" class="btn btn-primary" style="flex: 2;">Save Record</button>
                            <button onclick="toggleRegForm()" class="btn btn-secondary" style="flex: 1;">Cancel</button>
                            <button id="formDeleteBtn" class="btn btn-danger btn-icon-sm hidden" title="Delete Permanent"><i data-lucide="trash-2"></i></button>
                            <button id="formAgreementBtn" class="btn btn-secondary btn-icon-sm hidden" title="Print Agreement"><i data-lucide="file-text"></i></button>
                        </div>
                    </div>
                    <div id="manageTenantList" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;"></div>
                </div>

                <!-- Document Vault -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="folder-lock"></i> Document Vault</h3>
                        <button onclick="toggleUploadForm()" id="uploadToggleBtn" class="btn btn-secondary btn-sm">New Upload</button>
                    </div>
                    <div id="vaultList" style="margin-top: 1.5rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;"></div>
                </div>
            </div>

            <div id="tenants-archived" class="sub-section hidden">
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="archive"></i> Archive & History</h3>
                    </div>
                    <div id="archivedTenantList" style="display: flex; flex-direction: column; gap: 0.75rem; margin-top: 1.5rem;"></div>
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
                        <h3 class="section-title"><i data-lucide="banknote"></i> Owner Payouts</h3>
                        <div style="display: flex; gap: 0.5rem;">
                            <button onclick="printPayoutHistory()" class="btn btn-secondary btn-icon-sm" title="Print History"><i data-lucide="printer"></i></button>
                            <button onclick="toggleWithdrawalForm()" id="witToggleBtn" class="btn btn-primary btn-sm">Record Payout</button>
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
                            <div class="input-group"><label>UPI ID</label><input type="text" id="acc_upi" placeholder="name@bank"></div>
                            <div class="input-group"><label>Bank Name</label><input type="text" id="acc_bank"></div>
                            <div class="input-group"><label>Acc Number</label><input type="text" id="acc_num"></div>
                            <div class="input-group"><label>IFSC Code</label><input type="text" id="acc_ifsc"></div>
                        </div>
                        <div style="display: flex; gap: 0.5rem; margin-top: 1.5rem;">
                            <button onclick="saveReceivingAccount()" id="addAccBtn" class="btn btn-primary" style="flex: 2;">Add Account Record</button>
                            <button onclick="cancelAccountEdit()" id="cancelAccEditBtn" class="btn btn-secondary hidden" style="flex: 1;">Cancel</button>
                        </div>
                        <div id="unifiedAccountList" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;"></div>
                    </div>
                </div>
            </div>

            <div id="owners-settlements" class="sub-section hidden">
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="layout-list"></i> Settlements</h3>
                    </div>
                    <div id="ownerSettlementList" style="display: flex; flex-direction: column; gap: 0.75rem;"></div>
                </div>
            </div>
        </section>
    `,

    settings: `
        <section id="settings-section" class="app-section hidden">
            <div class="sub-nav no-print">
                <button onclick="switchSubSection('settings-section', 'settings-config')" class="sub-nav-btn active">
                    <i data-lucide="server"></i> Config
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
                    <i data-lucide="database"></i> DB
                </button>
            </div>

            <div id="settings-config" class="sub-section">
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="server"></i> System Configuration</h3>
                    </div>
                    <div class="grid-inputs" style="margin-top: 1.5rem;">
                        <div class="input-group"><label>Property Name</label><input type="text" id="prop_name"></div>
                        <div class="input-group" style="grid-column: span 2;"><label>Property Address</label><input type="text" id="prop_addr"></div>
                        <div class="input-group" style="grid-column: 1/-1;">
                            <label>Rental Agreement Terms</label>
                            <textarea id="agreement_terms" rows="6" style="width: 100%; border-radius: var(--radius-md); border: 1px solid var(--border); padding: 0.75rem; font-family: inherit; font-size: 0.85rem; resize: vertical;"></textarea>
                            <p style="font-size: 0.6rem; color: var(--text-muted); margin-top: 4px; font-weight: 700;">These terms will appear on all professional agreements. Use new lines for separate points.</p>
                        </div>
                        <div class="input-group"><label>Admin Email</label><input type="text" id="email_user"></div>
                        <div class="input-group"><label>SMTP App Pass</label><input type="password" id="email_pass"></div>
                        <div class="input-group"><label>Auto-BCC</label><input type="text" id="email_bcc"></div>
                        <div class="input-group"><label>Server Port</label><input type="number" id="server_port"></div>
                        <div class="input-group"><label>New Master PIN</label><input type="password" id="new_master_pin" maxlength="4" placeholder="4 digits"></div>
                        <div class="input-group"><label>New Staff PIN</label><input type="password" id="new_staff_pin" maxlength="4" placeholder="4 digits"></div>
                    </div>
                    <div style="display: flex; gap: 0.75rem; margin-top: 2rem;">
                        <button onclick="saveSystemSettings()" class="btn btn-primary" style="flex: 1;">Save Settings</button>
                        <button onclick="testSMTPSettings()" class="btn btn-secondary" style="flex: 1;">Test Email</button>
                    </div>
                </div>

                <div style="margin-top: 2rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <button onclick="toggleDarkMode()" class="btn btn-secondary"><i data-lucide="moon"></i> Dark Mode</button>
                    <button onclick="logout()" class="btn btn-danger"><i data-lucide="log-out"></i> Logout</button>
                </div>
            </div>

            <div id="settings-expenses" class="sub-section hidden">
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="trending-down"></i> Maintenance Logs</h3>
                        <button onclick="toggleExpenseForm()" id="expToggleBtn" class="btn btn-secondary btn-sm">Record Outflow</button>
                    </div>
                    <div id="expense-form" class="hidden" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid var(--border);">
                        <div class="grid-inputs">
                            <div class="input-group"><label>Category</label><select id="eCategory"><option value="Maintenance">Repair</option><option value="Taxes">Taxes</option><option value="Utility">Utility</option><option value="Salary">Staff</option><option value="Other">Other</option></select></div>
                            <div class="input-group"><label>Owner *</label><select id="eOwnerName"><option value="">-- Select --</option></select></div>
                            <div class="input-group"><label>Amount</label><input type="number" id="eAmount"></div>
                            <div class="input-group"><label>Date</label><input type="date" id="eDate"></div>
                            <div class="input-group" style="grid-column: 1/-1;"><label>Note</label><input type="text" id="eNotes"></div>
                        </div>
                        <button onclick="addExpense()" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Save Expense</button>
                    </div>
                    <div id="expenseList" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;"></div>
                </div>
            </div>

            <div id="settings-maintenance" class="sub-section hidden">
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="wrench"></i> Maintenance Tickets</h3>
                        <button onclick="toggleTaskForm()" id="taskToggleBtn" class="btn btn-primary btn-sm">New Ticket</button>
                    </div>
                    <div id="taskList" style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.75rem;"></div>
                </div>
            </div>

            <div id="settings-audit" class="sub-section hidden no-print">
                <div class="card">
                    <div class="card-header">
                        <h3 class="section-title"><i data-lucide="file-check"></i> Financial Audit</h3>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1rem;">
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">
                            <button onclick="setAuditPeriod('current')" class="btn btn-secondary btn-sm" style="font-size: 0.65rem; padding: 10px 5px;">This Month</button>
                            <button onclick="setAuditPeriod('last')" class="btn btn-secondary btn-sm" style="font-size: 0.65rem; padding: 10px 5px;">Last Month</button>
                            <button onclick="setAuditPeriod('fy')" class="btn btn-secondary btn-sm" style="font-size: 0.65rem; padding: 10px 5px;">This FY</button>
                        </div>
                        <div class="grid-inputs">
                            <div class="input-group"><label>From Date</label><input type="date" id="auditFromDate"></div>
                            <div class="input-group"><label>To Date</label><input type="date" id="auditToDate"></div>
                        </div>
                        <div style="border-top: 1px dashed var(--border); padding-top: 1rem;">
                            <div style="display: flex; align-items: center; justify-content: space-between; cursor: pointer;" onclick="document.getElementById('advancedTaxOptions').classList.toggle('hidden')">
                                <div style="font-size: 0.8rem; font-weight: 800; color: var(--primary);">Tax Options</div>
                                <i data-lucide="chevron-down" style="width: 14px;"></i>
                            </div>
                            <div id="advancedTaxOptions" class="hidden" style="margin-top: 1rem; background: var(--bg-main); padding: 1rem; border-radius: 8px;">
                                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                                    <span style="font-size: 0.75rem; font-weight: 700;">Show Tax Projection</span>
                                    <input type="checkbox" id="auditIncludeTax">
                                </div>
                                <div class="input-group" style="margin: 0;"><label>Municipal Taxes</label><input type="number" id="auditMunicipalTax" value="0"></div>
                            </div>
                        </div>
                        <button onclick="viewAuditReport()" class="btn btn-primary" style="width: 100%; height: 50px; font-weight: 900;">Generate Audit <i data-lucide="sparkles"></i></button>
                    </div>
                </div>
            </div>

            <div id="settings-database" class="sub-section hidden">
                <div class="card">
                    <div class="card-header"><h3 class="section-title"><i data-lucide="database"></i> Data Integrity</h3></div>
                    <div style="display: flex; flex-direction: column; gap: 2rem; margin-top: 1rem;">
                        <div>
                            <p style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Backup</p>
                            <input type="text" id="backupFilename" placeholder="manual_backup" style="margin: 1rem 0;">
                            <button onclick="backupDatabase()" class="btn btn-primary btn-sm" style="width: 100%;">Download .db</button>
                        </div>
                        <div>
                            <p style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Restore</p>
                            <div class="grid-inputs" style="margin-top: 1rem;">
                                <div class="input-group"><label>File</label><input type="file" id="restoreFile" accept=".db"></div>
                                <div class="input-group"><label>PIN</label><input type="password" id="restorePin" maxlength="4"></div>
                            </div>
                            <button onclick="restoreDatabase()" class="btn btn-danger btn-sm" style="width: 100%; margin-top: 1rem;">Execute Restore</button>
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
                            <i data-lucide="message-circle"></i> WhatsApp
                        </button>
                        <button onclick="shareTo('email')" class="btn" style="background: #ea4335; color: white; width: 100%; border: none;">
                            <i data-lucide="mail"></i> Email
                        </button>
                        <button onclick="shareTo('print')" class="btn" style="background: #1e293b; color: white; width: 100%; border: none;">
                            <i data-lucide="printer"></i> Print / PDF
                        </button>
                        <button onclick="shareTo('copy')" class="btn btn-secondary" style="width: 100%;">
                            <i data-lucide="copy"></i> Copy Text
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <div id="print-area" class="hidden"></div>

        <div id="settlementModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="section-title"><i data-lucide="door-open"></i> Settlement</h3>
                    <button onclick="closeSettlementModal()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div class="grid-inputs">
                        <div class="input-group"><label>Advance</label><input type="number" id="sAdvance" readonly></div>
                        <div class="input-group"><label>Final EB</label><input type="number" id="sEbReading" oninput="calcSettlement('reading')"></div>
                        <div class="input-group"><label>Rent Due</label><input type="number" id="sRentDue" value="0" oninput="calcSettlement('manual')"></div>
                        <div class="input-group"><label>EB Due</label><input type="number" id="sEbDue" value="0" oninput="calcSettlement('manual')"></div>
                        <div class="input-group"><label>Damages</label><input type="number" id="sRepairs" value="0" oninput="calcSettlement('manual')"></div>
                    </div>
                    <div style="background: var(--primary-light); padding: 1rem; text-align: center; margin: 1rem 0; border-radius: 8px;">
                        <div id="settlementLabel" style="font-size: 0.6rem; font-weight: 800; color: var(--secondary);">TOTAL REFUND</div>
                        <div id="settlementTotal" style="font-size: 1.5rem; font-weight: 900; color: var(--primary);">₹0.00</div>
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
                <div class="modal-body" style="text-align: center; padding-top: 2rem;">
                    <h3 id="confirmationTitle" class="section-title" style="justify-content: center;">Authorize</h3>
                    <p id="confirmationMessage" style="font-size: 0.8rem; color: var(--text-muted); margin: 1rem 0;">Enter Master PIN.</p>
                    <input type="password" id="deletePinInput" maxlength="4" style="width: 100%; text-align: center; font-size: 2rem; padding: 1rem; border: 2px solid var(--border); border-radius: 12px; background: var(--bg-input);">
                </div>
                <div class="modal-footer" style="background: transparent; border: none;">
                    <button onclick="confirmActionWithPin()" class="btn btn-danger" style="flex: 1;">Confirm</button>
                    <button onclick="closeDeleteModal()" class="btn btn-secondary" style="flex: 1;">Cancel</button>
                </div>
            </div>
        </div>

        <div id="paymentModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header">
                    <h3 class="section-title"><i data-lucide="credit-card"></i> Payment</h3>
                    <button onclick="closePaymentModal()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div id="paySummary" style="background: var(--primary-light); padding: 1rem; margin-bottom: 1rem; border-radius: 8px; text-align: center;">
                        <div id="payTotalLabel" style="font-size: 1.5rem; font-weight: 900; color: var(--primary);">₹0</div>
                    </div>
                    <div class="grid-inputs">
                        <div class="input-group"><label>Method</label><select id="payMethodInput"><option value="UPI">UPI</option><option value="Cash">Cash</option><option value="Bank">Bank</option></select></div>
                        <div class="input-group"><label>Received By</label><select id="payReceiverInput"></select></div>
                        <div class="input-group"><label>Date</label><input type="date" id="payDateInput"></div>
                        <div class="input-group"><label>Amount *</label><input type="number" id="payAmountInput" oninput="calculateAdjustments()"></div>
                    </div>
                    <div id="adjustmentSection" class="hidden" style="margin-top: 1rem; padding: 1rem; background: var(--bg-input); border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                            <span id="payBalanceLabel" style="color: var(--danger); font-weight: 800;">₹0</span>
                            <select id="adjType" onchange="calculateAdjustments()"><option value="CARRY">Carry Forward</option><option value="DISCOUNT">Discount</option><option value="WRITEOFF">Write-Off</option></select>
                        </div>
                        <p id="adjDescription" style="font-size: 0.6rem; color: var(--text-muted); font-weight: 600; line-height: 1.3; margin: 0;"></p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="confirmPaymentRecord()" class="btn btn-primary" style="flex: 2;">Save</button>
                    <button onclick="closePaymentModal()" class="btn btn-secondary" style="flex: 1;">Abort</button>
                </div>
            </div>
        </div>

        <div id="billDetailsModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 450px;">
                <div class="modal-header">
                    <h3 class="section-title"><i data-lucide="receipt"></i> Breakdown</h3>
                    <button onclick="document.getElementById('billDetailsModal').classList.add('hidden')" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body"><div id="billBreakdownContent"></div></div>
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
                        <div class="input-group"><label>Actual Cost</label><input type="number" id="mTaskActualCost" value="0"></div>
                        <div class="input-group"><label>Date Resolved</label><input type="date" id="mTaskDateResolved"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="updateTaskConfirm()" class="btn btn-primary" style="flex: 2;">Save</button>
                    <button onclick="deleteTaskConfirm()" class="btn btn-danger" style="flex: 1;">Delete</button>
                </div>
            </div>
        </div>

        <div id="uploadModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="section-title"><i data-lucide="upload-cloud"></i> Upload</h3>
                    <button onclick="toggleUploadForm()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div class="grid-inputs">
                        <div class="input-group"><label>Unit</label><select id="docRenterId"></select></div>
                        <div class="input-group"><label>Type</label><select id="docType"><option value="ID Proof">ID Proof</option><option value="Lease Agreement">Lease</option><option value="Other">Other</option></select></div>
                        <div class="input-group"><label>Expiry</label><input type="date" id="docExpiry"></div>
                        <div class="input-group" style="grid-column: 1/-1;"><label>File</label><input type="file" id="docFile"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="uploadDocument()" class="btn btn-primary" style="flex: 2;">Upload</button>
                    <button onclick="toggleUploadForm()" class="btn btn-secondary" style="flex: 1;">Cancel</button>
                </div>
            </div>
        </div>

        <div id="createTaskModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 600px;">
                <div class="modal-header">
                    <h3 class="section-title"><i data-lucide="wrench"></i> New Ticket</h3>
                    <button onclick="toggleTaskForm()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body">
                    <div class="grid-inputs">
                        <div class="input-group"><label>Unit</label><select id="tTaskRenterId"></select></div>
                        <div class="input-group"><label>Category</label><select id="tTaskCategory"><option value="Plumbing">Plumbing</option><option value="Electrical">Electrical</option><option value="Other">Other</option></select></div>
                        <div class="input-group"><label>Owner</label><select id="tTaskOwner"></select></div>
                        <div class="input-group" style="grid-column: 1/-1;"><label>Title *</label><input type="text" id="tTaskTitle"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button onclick="saveTask()" class="btn btn-primary" style="flex: 2;">Raise Ticket</button>
                    <button onclick="toggleTaskForm()" class="btn btn-secondary" style="flex: 1;">Cancel</button>
                </div>
            </div>
        </div>

        <div id="ownerTimelineModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 600px; display: flex; flex-direction: column;">
                <div class="modal-header no-print">
                    <h3 class="section-title"><i data-lucide="list-tree"></i> Timeline</h3>
                    <div style="display: flex; gap: 0.5rem;">
                        <button onclick="printOwnerTimeline()" class="btn btn-secondary btn-icon-sm"><i data-lucide="printer"></i></button>
                        <button onclick="closeOwnerTimeline()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                    </div>
                </div>
                <div class="modal-body" style="overflow-y: auto; flex: 1;">
                    <div id="timelineOwnerName" style="font-weight: 900; font-size: 1.2rem; margin-bottom: 1.5rem; border-left: 5px solid var(--primary); padding-left: 10px; color: var(--primary);"></div>
                    <div id="ownerTimelineContent"></div>
                </div>
            </div>
        </div>

        <div id="auditModal" class="modal-overlay hidden">
            <div class="modal-content" style="max-width: 800px; display: flex; flex-direction: column;">
                <div class="modal-header no-print">
                    <h3 class="section-title"><i data-lucide="file-check"></i> Audit</h3>
                    <button onclick="closeAuditModal()" class="btn-icon" style="border: none; background: none;"><i data-lucide="x"></i></button>
                </div>
                <div class="modal-body" style="background: var(--bg-main); padding: 0; overflow-y: auto; flex: 1;">
                    <div id="auditContent"></div>
                </div>
                <div class="modal-footer no-print">
                    <button onclick="printAudit()" class="btn btn-primary" style="flex: 2;">Print</button>
                    <button onclick="closeAuditModal()" class="btn btn-secondary" style="flex: 1;">Close</button>
                </div>
            </div>
        </div>
    `
};
