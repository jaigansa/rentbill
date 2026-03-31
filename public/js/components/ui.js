const UI = {
    renderTenantCard: (t, onEdit, onVacant) => {
        const card = document.createElement('div');
        card.className = 'tenant-row';
        card.innerHTML = `
            <div class="tenant-header" style="padding: 1rem;">
                <div style="display: flex; gap: 1rem; align-items: flex-start; width: 100%;">
                    <div class="room-badge" style="flex-shrink: 0;">${t.room_no}</div>
                    
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 900; font-size: 1.1rem; color: var(--text-main); line-height: 1.2; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${t.name}
                        </div>
                        <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
                            <span style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">
                                <i data-lucide="phone" style="width: 10px; height: 10px; margin-right: 2px; vertical-align: middle;"></i> ${t.mobile_number}
                            </span>
                            <span style="width: 3px; height: 3px; border-radius: 50%; background: var(--border);"></span>
                            <span style="font-size: 0.7rem; font-weight: 800; color: var(--primary); text-transform: uppercase;">
                                <i data-lucide="indian-rupee" style="width: 10px; height: 10px; margin-right: 2px; vertical-align: middle;"></i> ${currencyFormatter.format(t.base_rent)}
                            </span>
                        </div>
                    </div>

                    <div style="display: flex; gap: 0.5rem; flex-shrink: 0; align-items: center;">
                        <button class="btn btn-secondary btn-icon-sm edit-btn" title="Edit Profile">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button class="btn btn-secondary btn-icon-sm vacant-btn" style="color: var(--danger);" title="Register Exit">
                            <i data-lucide="log-out"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        card.querySelector('.edit-btn').onclick = (e) => { e.stopPropagation(); onEdit(t.id); };
        card.querySelector('.vacant-btn').onclick = (e) => { e.stopPropagation(); onVacant(t.id); };
        return card;
    },

    renderExpenseItem: (e, onDelete) => {
        const item = document.createElement('div');
        item.className = 'tenant-row';
        item.style.padding = '1rem 1.25rem';
        item.style.display = 'flex';
        item.style.justifyContent = 'space-between';
        item.style.alignItems = 'center';
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div class="stat-icon icon-danger" style="width: 40px; height: 40px;"><i data-lucide="trending-down" style="width: 20px;"></i></div>
                <div>
                    <div style="font-weight: 900; font-size: 1rem; color: var(--text-main);">${currencyFormatter.format(e.amount)}</div>
                    <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">${e.category} • ${e.date}</div>
                </div>
            </div>
            <button class="btn btn-secondary btn-icon-sm delete-btn"><i data-lucide="trash-2" width="14" height="14"></i></button>
        `;
        item.querySelector('.delete-btn').onclick = () => onDelete(e.id);
        return item;
    },

    renderLogItem: (l, actionIcons) => {
        const icon = actionIcons[l.action] || 'activity';
        return `
            <div class="log-item">
                <div class="log-icon-box">
                    <i data-lucide="${icon}" style="width: 20px; height: 20px;"></i>
                </div>
                <div class="log-content">
                    <span class="log-action">${l.action.replace(/_/g, ' ')}</span>
                    <div class="log-details">${l.details}</div>
                    <span class="log-time">${new Date(l.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            </div>
        `;
    },

    renderUnifiedAccountRow: (acc, index) => {
        const hasUpi = !!acc.upi;
        const hasBank = !!acc.bank_name;
        
        return `
            <div class="tenant-row" style="padding: 1rem; margin-bottom: 0.5rem; border: 3px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                    <div style="flex: 1;">
                        <div style="font-weight: 900; font-size: 0.8rem; color: var(--primary); text-transform: uppercase; margin-bottom: 4px;">
                            ${acc.owner_name} <span style="color: var(--text-muted); font-weight: 700;">(${acc.label})</span>
                        </div>
                        
                        ${hasUpi ? `
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <div class="stat-icon icon-success" style="width: 24px; height: 24px; border-width: 2px;"><i data-lucide="smartphone" style="width: 12px;"></i></div>
                                <span style="font-size: 0.75rem; font-family: monospace; font-weight: 700;">${acc.upi}</span>
                            </div>
                        ` : ''}

                        ${hasBank ? `
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <div class="stat-icon icon-primary" style="width: 24px; height: 24px; border-width: 2px;"><i data-lucide="building" style="width: 12px;"></i></div>
                                <span style="font-size: 0.7rem; font-weight: 700; color: var(--text-main);">${acc.bank_name} - ${acc.account_number} (${acc.ifsc})</span>
                            </div>
                        ` : ''}
                    </div>
                    <button onclick="deleteReceivingAccount(${index})" class="btn btn-secondary btn-icon-sm" style="border: none; background: transparent;">
                        <i data-lucide="trash-2" style="width: 16px; color: var(--danger);"></i>
                    </button>
                </div>
            </div>
        `;
    },

    renderWithdrawalItem: (w, onDelete) => `
        <div class="tenant-row" style="padding: 0.75rem 1rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <div class="stat-icon icon-warning" style="width: 36px; height: 36px;"><i data-lucide="banknote" style="width: 18px;"></i></div>
                <div>
                    <div style="font-weight: 900; font-size: 0.9rem; color: var(--text-main);">${currencyFormatter.format(w.amount)}</div>
                    <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">${w.owner_name} • ${w.date}</div>
                </div>
            </div>
            <button onclick="deleteWithdrawal(${w.id})" class="btn btn-secondary btn-icon-sm" style="border:none; background:none;"><i data-lucide="trash-2" width="14" height="14" color="var(--danger)"></i></button>
        </div>
    `,

    renderChannelPill: (acc) => {
        const pill = document.createElement('button');
        pill.className = 'btn btn-secondary btn-sm';
        pill.style.padding = '0.4rem 0.75rem';
        pill.style.fontSize = '0.65rem';
        pill.style.borderRadius = '0px';
        pill.style.border = '2px solid var(--border)';
        pill.style.fontWeight = '800';
        pill.innerHTML = `<span style="color: var(--primary); margin-right: 4px;">${acc.label}:</span> ${acc.id} <i data-lucide="copy" width="10" height="10" style="margin-left: 4px; opacity: 0.5;"></i>`;
        pill.onclick = () => {
            navigator.clipboard.writeText(acc.id);
            showNotification(`Copied ${acc.label}`, "success");
        };
        return pill;
    }
};
