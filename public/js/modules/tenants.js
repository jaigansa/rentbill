// Tenants Controller: Tenant CRUD, Co-occupants, Long Press Expand, Ledger

export const Tenants = {
  getAvatarColor(name) {
    const colors = [
      { bg: '#e8f0fe', text: '#1967d2', border: '#c2e7ff' }, // Blue
      { bg: '#fce8e6', text: '#c5221f', border: '#fad2cf' }, // Red
      { bg: '#fef7e0', text: '#b06000', border: '#feefc3' }, // Yellow/Amber
      { bg: '#e6f4ea', text: '#137333', border: '#ceead6' }, // Green
      { bg: '#f3e8fd', text: '#8430ce', border: '#e9d2fd' }, // Purple
      { bg: '#e4f7fb', text: '#007b83', border: '#cbf0f8' }, // Teal
      { bg: '#feefe3', text: '#af3a03', border: '#fedfc8' }, // Orange
      { bg: '#fce4ec', text: '#b80672', border: '#f8bbd0' }, // Pink
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  },

  getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  },

  getTenantAvatarHtml(t, size = 48) {
    if (t.photo && t.photo.trim() !== '') {
      return `
        <div class="tenant-avatar" onclick="App.openAvatarZoom(${t.id}, event)" title="Tap to view photo" style="width:${size}px; height:${size}px; min-width:${size}px;">
          <img src="${t.photo}" class="tenant-avatar-img" alt="${t.name || 'Tenant'}">
        </div>
      `;
    }
    const color = this.getAvatarColor(t.name || '');
    const initials = this.getInitials(t.name || '');
    const fontSize = Math.round(size * 0.38);
    return `
      <div class="tenant-avatar tenant-avatar-initials" onclick="App.openAvatarZoom(${t.id}, event)" title="Tap to view photo" style="width:${size}px; height:${size}px; min-width:${size}px; background:${color.bg}; color:${color.text}; border:1.5px solid ${color.border}; font-size:${fontSize}px;">
        ${initials}
      </div>
    `;
  },

  openAvatarZoom(tenantId, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    const t = (this.tenants || []).find(item => item.id == tenantId);
    if (!t) return;

    const zoomImg = document.getElementById('avatar-zoom-img');
    const zoomInitials = document.getElementById('avatar-zoom-initials');
    const zoomName = document.getElementById('avatar-zoom-name');
    const zoomUnit = document.getElementById('avatar-zoom-unit');

    if (zoomName) zoomName.textContent = t.name || 'Tenant Profile';
    if (zoomUnit) {
      const unitText = t.property_name ? t.property_name : 'Unassigned';
      const phoneText = t.phone ? ` • ${t.phone}` : '';
      zoomUnit.textContent = `${unitText}${phoneText}`;
    }

    if (t.photo && t.photo.trim() !== '') {
      if (zoomImg) {
        zoomImg.src = t.photo;
        zoomImg.style.display = 'block';
      }
      if (zoomInitials) zoomInitials.style.display = 'none';
    } else {
      if (zoomImg) {
        zoomImg.src = '';
        zoomImg.style.display = 'none';
      }
      if (zoomInitials) {
        const color = this.getAvatarColor(t.name || '');
        const initials = this.getInitials(t.name || '');
        zoomInitials.style.display = 'flex';
        zoomInitials.style.background = color.bg;
        zoomInitials.style.color = color.text;
        zoomInitials.style.border = `4px solid ${color.border}`;
        zoomInitials.textContent = initials;
      }
    }

    this.openModal('modal-avatar-zoom');
  },

  bindTenantPhotoUpload() {
    const fileInput = document.getElementById('tenant-photo-file-input');
    const triggerBtn = document.getElementById('btn-trigger-tenant-photo');
    const uploadBtn = document.getElementById('btn-upload-tenant-photo');
    const previewWrap = document.getElementById('tenant-photo-preview-wrap');
    const removeBtn = document.getElementById('btn-remove-tenant-photo');
    const previewImg = document.getElementById('tenant-photo-preview-img');
    const placeholder = document.getElementById('tenant-photo-avatar-placeholder');
    const hiddenPhotoInput = document.getElementById('tenant-photo');

    const openFileDialog = () => {
      if (fileInput) fileInput.click();
    };

    triggerBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      openFileDialog();
    });
    uploadBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      openFileDialog();
    });
    previewWrap?.addEventListener('click', (e) => {
      if (e.target !== removeBtn && !removeBtn?.contains(e.target)) {
        openFileDialog();
      }
    });

    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        alert('Please choose an image file (JPEG, PNG, WebP).');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 300;
          const width = img.width;
          const height = img.height;

          const minDim = Math.min(width, height);
          const startX = (width - minDim) / 2;
          const startY = (height - minDim) / 2;

          canvas.width = maxDim;
          canvas.height = maxDim;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, maxDim, maxDim);

          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

          if (hiddenPhotoInput) hiddenPhotoInput.value = compressedBase64;
          if (previewImg) {
            previewImg.src = compressedBase64;
            previewImg.style.display = 'block';
          }
          if (placeholder) placeholder.style.display = 'none';
          if (removeBtn) removeBtn.style.display = 'inline-block';
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });

    removeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (hiddenPhotoInput) hiddenPhotoInput.value = '';
      if (fileInput) fileInput.value = '';
      if (previewImg) {
        previewImg.src = '';
        previewImg.style.display = 'none';
      }
      if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.style.background = 'var(--surface-alt)';
        placeholder.style.color = 'var(--text-muted)';
        placeholder.innerHTML = `<i data-lucide="user" style="width:28px; height:28px; color:var(--text-muted);"></i>`;
        this.refreshIcons();
      }
      removeBtn.style.display = 'none';
    });
  },
  renderCoOccupantRow(name = '', phone = '') {
    const div = document.createElement('div');
    div.className = 'co-occupant-row';
    const safeName = (name || '').replace(/"/g, '&quot;');
    const safePhone = (phone || '').replace(/"/g, '&quot;');
    div.innerHTML = `
      <input type="text" class="co-occupant-name" placeholder="Name (e.g. Spouse / Roommate)" value="${safeName}">
      <input type="tel" class="co-occupant-phone" placeholder="Mobile number" value="${safePhone}">
      <button type="button" class="btn-remove-co-occupant" title="Remove Co-occupant">
        <i data-lucide="trash-2" style="width:15px; height:15px;"></i>
      </button>
    `;
    div.querySelector('.btn-remove-co-occupant')?.addEventListener('click', () => {
      div.remove();
    });
    return div;
  },

  async loadTenants() {
    try {
      this.tenants = await API.getTenants();

      // Update Bill Modal tenant select
      const billTenantSelect = document.getElementById('bill-tenant-select');
      if (billTenantSelect) {
        billTenantSelect.innerHTML = `<option value="">-- Choose Tenant --</option>` +
          this.tenants.filter(t => t.is_active).map(t => `<option value="${t.id}">${t.name} (${t.property_name || 'No Unit'})</option>`).join('');
      }

      this.renderTenantsList();
    } catch (err) {
      console.error(err);
    }
  },

  renderTenantsList() {
    const container = document.getElementById('tenants-list-container');
    if (!container) return;
    const curr = window.APP_CURRENCY || '₹';

    if (!this.tenants || this.tenants.length === 0) {
      container.innerHTML = `<div class="empty-state">No tenants found. Tap "Add Tenant" to begin.</div>`;
      return;
    }

    // Filter tenants
    let filtered = this.tenants.filter(t => {
      // 1. Text Search (name, phone, property_name, co-occupants)
      if (this.tenantSearchQuery) {
        const q = this.tenantSearchQuery;
        const matchName = (t.name || '').toLowerCase().includes(q);
        const matchPhone = (t.phone || '').toLowerCase().includes(q);
        const matchProp = (t.property_name || '').toLowerCase().includes(q);
        const matchCo = (t.co_occupants || []).some(co => (co.name || '').toLowerCase().includes(q) || (co.phone || '').toLowerCase().includes(q))
          || (t.co_occupant_name || '').toLowerCase().includes(q)
          || (t.co_occupant_phone || '').toLowerCase().includes(q);
        if (!matchName && !matchPhone && !matchProp && !matchCo) return false;
      }

      // 2. Status Filter Pill (all, active, past)
      if (this.tenantFilter === 'active' && !t.is_active) return false;
      if (this.tenantFilter === 'past' && t.is_active) return false;

      return true;
    });

    // Sort: Active tenants first (A-Z), Past tenants at the end of the list (A-Z)
    filtered.sort((a, b) => {
      if (a.is_active === b.is_active) {
        return (a.name || '').localeCompare(b.name || '');
      }
      return a.is_active ? -1 : 1;
    });

    // Update subtitle
    const subTitle = document.getElementById('tenants-count-subtitle');
    if (subTitle) {
      subTitle.textContent = `Showing ${filtered.length} of ${this.tenants.length} tenants`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:24px;">
          <i data-lucide="search-x" style="width:28px; height:28px; color:var(--text-muted); margin-bottom:8px;"></i>
          <div>No tenants match "<strong>${this.tenantSearchQuery}</strong>"</div>
        </div>
      `;
      this.refreshIcons();
      return;
    }

    container.innerHTML = filtered.map(t => {
      const tenantBills = (this.bills || []).filter(b => b.tenant_id === t.id);
      const totalPaid = (t.total_paid !== undefined && t.total_paid !== null)
        ? Number(t.total_paid)
        : tenantBills.reduce((sum, b) => sum + (Number(b.paid_amount) || 0), 0);
      const totalDue = (t.total_due !== undefined && t.total_due !== null)
        ? Number(t.total_due)
        : (tenantBills.length > 0
            ? tenantBills.reduce((sum, b) => sum + (Number(b.balance_amount) || (Number(b.total_amount) - Number(b.paid_amount)) || 0), 0)
            : (Number(t.opening_arrear) || 0));

      const cleanPhone = (t.phone || '').replace(/[^0-9+]/g, '');
      const waPhone = cleanPhone.replace(/^\+/, '');
      const waUrl = waPhone ? `https://wa.me/${waPhone}` : '#';
      const email = (t.email || '').trim();

      return `
      <div class="app-card tenant-card" id="tenant-card-${t.id}" data-tenant-id="${t.id}">
        <!-- Google Contacts Header: Avatar + Name/Unit + 3-Dot Actions -->
        <div class="tenant-contact-header">
          ${this.getTenantAvatarHtml(t, 48)}
          <div class="tenant-contact-info">
            <div class="tenant-contact-name-row">
              <span class="tenant-contact-name" title="${t.name}">${t.name}</span>
            </div>
            <div class="tenant-contact-sub">
              <span class="tenant-contact-unit">${t.property_name || 'Unassigned'}</span>
            </div>
          </div>
          <div class="tenant-contact-header-right">
            <span class="badge ${t.is_active ? 'badge-paid' : 'badge-date'}">${t.is_active ? 'Active' : 'Past'}</span>
            <div class="card-dropdown">
              <button type="button" class="btn-card-more" onclick="App.toggleDropdown(this, event)" aria-label="More options">
                <i data-lucide="more-vertical"></i>
              </button>
              <div class="card-dropdown-menu">
                <button type="button" class="dropdown-item" onclick="App.openBillModalForTenant(${t.id})">
                  <i data-lucide="plus"></i> Generate Bill
                </button>
                <button type="button" class="dropdown-item" onclick="App.openTenantLedger(${t.id})">
                  <i data-lucide="receipt"></i> View Bills
                </button>
                <button type="button" class="dropdown-item" onclick="App.editTenant(${t.id})">
                  <i data-lucide="edit-3"></i> Edit Tenant
                </button>
                ${t.is_active ? `
                  <button type="button" class="dropdown-item" onclick="App.openVacantCalculation(${t.id})">
                    <i data-lucide="user-x"></i> Move Out / Vacant Form
                  </button>
                ` : `
                  <button type="button" class="dropdown-item" onclick="App.openVacantCalculation(${t.id})">
                    <i data-lucide="calculator"></i> Vacant Calculation
                  </button>
                  <button type="button" class="dropdown-item" onclick="App.reactivateTenant(${t.id})">
                    <i data-lucide="user-check"></i> Reactivate Tenant
                  </button>
                `}
                <button type="button" class="dropdown-item dropdown-item-danger" onclick="App.deleteTenant(${t.id})">
                  <i data-lucide="trash-2"></i> Delete Tenant
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Google Contacts Quick Action Buttons (3 Columns: Call, SMS, Email) -->
        <div class="tenant-quick-actions">
          <a href="${cleanPhone ? `tel:${cleanPhone}` : 'javascript:void(0)'}" class="tenant-action-btn btn-action-call ${cleanPhone ? '' : 'disabled'}" title="${cleanPhone ? `Call ${t.name}` : 'No phone number'}">
            <i data-lucide="phone"></i>
            <span>Call</span>
          </a>
          <a href="${cleanPhone ? `sms:${cleanPhone}` : 'javascript:void(0)'}" class="tenant-action-btn btn-action-sms ${cleanPhone ? '' : 'disabled'}" title="${cleanPhone ? `SMS / Text ${t.name}` : 'No phone number'}">
            <i data-lucide="message-square"></i>
            <span>SMS</span>
          </a>
          <a href="${email ? `mailto:${email}` : 'javascript:void(0)'}" class="tenant-action-btn btn-action-email ${email ? '' : 'disabled'}" title="${email ? `Email ${t.name} (${email})` : 'No email added'}">
            <i data-lucide="mail"></i>
            <span>Email</span>
          </a>
        </div>

        <!-- Financial Status Bar (Tap to view bills ledger) -->
        <div class="tenant-financial-bar" onclick="App.openTenantLedger(${t.id})" title="Tap to view bills & ledger">
          <div class="financial-chip chip-paid">
            <span class="chip-label">Total Paid</span>
            <span class="chip-val" title="${this.formatFullMoney(totalPaid)}">${this.formatMoney(totalPaid, true)}</span>
          </div>
          <div class="financial-chip ${totalDue > 0 ? 'chip-due' : 'chip-cleared'}">
            <span class="chip-label">Total Due</span>
            <span class="chip-val" title="${this.formatFullMoney(totalDue)}">${this.formatMoney(totalDue, true)}</span>
          </div>
        </div>

        <!-- Expandable Details on Long Press / Tap -->
        <div class="tenant-card-details" id="tenant-details-${t.id}" style="display:none;">
          <div class="tenant-details-grid">
            <div class="tenant-detail-item">
              <span class="detail-label">Phone Number</span>
              <span class="detail-val">
                <a href="tel:${cleanPhone}" class="phone-link" title="Tap to call ${t.phone}">
                  <i data-lucide="phone" style="width:12px; height:12px; vertical-align:-2px;"></i> ${t.phone}
                </a>
              </span>
            </div>
            ${t.email ? `
            <div class="tenant-detail-item">
              <span class="detail-label">Email Address</span>
              <span class="detail-val"><a href="mailto:${t.email}" class="phone-link">${t.email}</a></span>
            </div>
            ` : ''}
            <div class="tenant-detail-item">
              <span class="detail-label">Security Deposit</span>
              <span class="detail-val">${curr}${t.security_deposit ? t.security_deposit.toFixed(2) : '0.00'}</span>
            </div>
            ${t.opening_arrear > 0 ? `
            <div class="tenant-detail-item">
              <span class="detail-label">Opening Arrear</span>
              <span class="detail-val" style="color:var(--danger, #dc2626); font-weight:600;">${curr}${Number(t.opening_arrear).toFixed(2)}</span>
            </div>
            ` : ''}
            <div class="tenant-detail-item">
              <span class="detail-label">Move-in Date</span>
              <span class="detail-val">${t.move_in_date || 'Not set'}</span>
            </div>
            <div class="tenant-detail-item">
              <span class="detail-label">Initial Elec Reading</span>
              <span class="detail-val">${t.initial_elec_meter || 0} kWh</span>
            </div>
            <div class="tenant-detail-item">
              <span class="detail-label">Initial Water Reading</span>
              <span class="detail-val">${t.initial_water_meter || 0} Units</span>
            </div>
            ${(t.co_occupants && t.co_occupants.length > 0) ? `
            <div class="tenant-detail-item" style="grid-column: span 2;">
              <span class="detail-label">Co-occupants / Roommates (${t.co_occupants.length})</span>
              <div style="display:flex; flex-direction:column; gap:4px; margin-top:4px;">
                ${t.co_occupants.map(co => `
                  <div style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                    <span style="font-weight:600;">${co.name || 'Co-occupant'}</span>
                    ${co.phone ? `
                      <span style="color:var(--text-muted); opacity:0.6;">•</span>
                      <a href="tel:${co.phone.replace(/[^0-9+]/g, '')}" class="phone-link" title="Tap to call ${co.phone}">
                        <i data-lucide="phone" style="width:12px; height:12px; vertical-align:-2px;"></i> ${co.phone}
                      </a>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
            ` : (t.co_occupant_name || t.co_occupant_phone) ? `
            <div class="tenant-detail-item" style="grid-column: span 2;">
              <span class="detail-label">Co-occupant / Roommate</span>
              <span class="detail-val" style="display:flex; align-items:center; flex-wrap:wrap; gap:6px;">
                <span>${t.co_occupant_name || 'Co-occupant'}</span>
                ${t.co_occupant_phone ? `
                  <span style="color:var(--text-muted); opacity:0.6;">•</span>
                  <a href="tel:${t.co_occupant_phone.replace(/[^0-9+]/g, '')}" class="phone-link" title="Tap to call ${t.co_occupant_phone}">
                    <i data-lucide="phone" style="width:12px; height:12px; vertical-align:-2px;"></i> ${t.co_occupant_phone}
                  </a>
                ` : ''}
              </span>
            </div>
            ` : ''}
            ${(t.payment_upi || t.payment_bank_name) ? `
            <div class="tenant-detail-item" style="grid-column: span 2;">
              <span class="detail-label">Payment / Bank Info</span>
              <span class="detail-val" style="display:flex; flex-direction:column; gap:2px;">
                ${t.payment_upi ? `<span>UPI: <strong>${t.payment_upi}</strong></span>` : ''}
                ${t.payment_bank_name ? `<span>Bank: <strong>${t.payment_bank_name}</strong> ${t.payment_account_no ? `(A/C: ${t.payment_account_no})` : ''}</span>` : ''}
                ${t.payment_ifsc ? `<span>IFSC: <strong>${t.payment_ifsc}</strong></span>` : ''}
              </span>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="tenant-card-footer-hint" onclick="App.toggleTenantCardExpand(${t.id})">
          <span>Tap or long-press to toggle details</span>
          <i data-lucide="chevron-down" style="width:12px; height:12px;"></i>
        </div>
      </div>
    `;
    }).join('');
    this.attachTenantLongPressListeners(container);
    this.refreshIcons();
  },

  attachTenantLongPressListeners(container) {
    if (!container) return;
    container.querySelectorAll('.tenant-card').forEach(card => {
      let timer = null;
      let isLongPress = false;
      let startX = 0;
      let startY = 0;

      const tenantId = card.getAttribute('data-tenant-id');

      const triggerExpand = () => {
        isLongPress = true;
        this.toggleTenantCardExpand(tenantId);
        if (navigator.vibrate) {
          try { navigator.vibrate(50); } catch (e) {}
        }
      };

      const startPress = (e) => {
        // Ignore if clicking interactive children (links, buttons, dropdowns, quick actions, avatar zoom, financial bar)
        if (e.target.closest('a, button, .card-dropdown, .card-dropdown-menu, .tenant-quick-actions, .tenant-avatar, .tenant-financial-bar')) {
          return;
        }
        isLongPress = false;
        if (e.touches && e.touches[0]) {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
        } else {
          startX = e.clientX;
          startY = e.clientY;
        }

        card.classList.add('pressing');
        timer = setTimeout(() => {
          card.classList.remove('pressing');
          triggerExpand();
        }, 500); // 500ms long press threshold
      };

      const cancelPress = () => {
        card.classList.remove('pressing');
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      };

      const movePress = (e) => {
        if (!timer) return;
        const currentX = e.touches ? e.touches[0].clientX : e.clientX;
        const currentY = e.touches ? e.touches[0].clientY : e.clientY;
        if (Math.hypot(currentX - startX, currentY - startY) > 10) {
          cancelPress();
        }
      };

      card.addEventListener('touchstart', startPress, { passive: true });
      card.addEventListener('touchend', cancelPress);
      card.addEventListener('touchcancel', cancelPress);
      card.addEventListener('touchmove', movePress, { passive: true });

      card.addEventListener('mousedown', startPress);
      card.addEventListener('mouseup', cancelPress);
      card.addEventListener('mouseleave', cancelPress);
      card.addEventListener('mousemove', movePress);

      card.addEventListener('contextmenu', (e) => {
        if (isLongPress) {
          e.preventDefault();
        }
      });
    });
  },

  toggleTenantCardExpand(tenantId) {
    const details = document.getElementById(`tenant-details-${tenantId}`);
    const card = document.getElementById(`tenant-card-${tenantId}`);
    if (!details || !card) return;

    const isExpanded = card.classList.contains('expanded');
    if (isExpanded) {
      card.classList.remove('expanded');
      details.style.maxHeight = '0px';
      setTimeout(() => {
        details.style.display = 'none';
      }, 250);
    } else {
      card.classList.add('expanded');
      details.style.display = 'block';
      details.style.maxHeight = '0px';
      requestAnimationFrame(() => {
        details.style.maxHeight = details.scrollHeight + 'px';
      });
      this.refreshIcons();
    }
  },

  openTenantModal() {
    document.getElementById('form-tenant').reset();
    document.getElementById('tenant-id').value = '';
    const coListEl = document.getElementById('co-occupants-list');
    if (coListEl) coListEl.innerHTML = '';
    const openArrear = document.getElementById('tenant-opening-arrear');
    if (openArrear) openArrear.value = '';
    const statusSelect = document.getElementById('tenant-is-active');
    if (statusSelect) statusSelect.value = '1';

    // Reset photo preview to placeholder
    const photoInput = document.getElementById('tenant-photo');
    const photoFileInput = document.getElementById('tenant-photo-file-input');
    const previewImg = document.getElementById('tenant-photo-preview-img');
    const placeholder = document.getElementById('tenant-photo-avatar-placeholder');
    const btnRemove = document.getElementById('btn-remove-tenant-photo');
    if (photoInput) photoInput.value = '';
    if (photoFileInput) photoFileInput.value = '';
    if (previewImg) {
      previewImg.src = '';
      previewImg.style.display = 'none';
    }
    if (placeholder) {
      placeholder.style.display = 'flex';
      placeholder.style.background = 'var(--surface-alt)';
      placeholder.style.color = 'var(--text-muted)';
      placeholder.style.border = '1px solid var(--border)';
      placeholder.innerHTML = `<i data-lucide="user" style="width:28px; height:28px; color:var(--text-muted);"></i>`;
    }
    if (btnRemove) btnRemove.style.display = 'none';

    document.getElementById('modal-tenant-title').textContent = 'Add Tenant';
    this.openModal('modal-tenant');
    this.refreshIcons();
  },

  async editTenant(id) {
    try {
      const t = await API.getTenant(id);
      document.getElementById('tenant-id').value = t.id;
      document.getElementById('modal-tenant-title').textContent = 'Edit Tenant';
      document.getElementById('tenant-name').value = t.name;
      document.getElementById('tenant-phone').value = t.phone;
      document.getElementById('tenant-email').value = t.email || '';

      // Populate photo preview
      const photoInput = document.getElementById('tenant-photo');
      const photoFileInput = document.getElementById('tenant-photo-file-input');
      const previewImg = document.getElementById('tenant-photo-preview-img');
      const placeholder = document.getElementById('tenant-photo-avatar-placeholder');
      const btnRemove = document.getElementById('btn-remove-tenant-photo');
      if (photoFileInput) photoFileInput.value = '';

      if (t.photo && t.photo.trim() !== '') {
        if (photoInput) photoInput.value = t.photo;
        if (previewImg) {
          previewImg.src = t.photo;
          previewImg.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
        if (btnRemove) btnRemove.style.display = 'inline-block';
      } else {
        if (photoInput) photoInput.value = '';
        if (previewImg) {
          previewImg.src = '';
          previewImg.style.display = 'none';
        }
        if (placeholder) {
          const color = this.getAvatarColor(t.name);
          const initials = this.getInitials(t.name);
          placeholder.style.display = 'flex';
          placeholder.style.background = color.bg;
          placeholder.style.color = color.text;
          placeholder.style.border = `1.5px solid ${color.border}`;
          placeholder.innerHTML = `<span style="font-weight:700; font-size:1.35rem;">${initials}</span>`;
        }
        if (btnRemove) btnRemove.style.display = 'none';
      }

      const coListEl = document.getElementById('co-occupants-list');
      if (coListEl) {
        coListEl.innerHTML = '';
        const occupants = (t.co_occupants && t.co_occupants.length > 0)
          ? t.co_occupants
          : (t.co_occupant_name || t.co_occupant_phone)
            ? [{ name: t.co_occupant_name || '', phone: t.co_occupant_phone || '' }]
            : [];
        occupants.forEach(co => {
          coListEl.appendChild(this.renderCoOccupantRow(co.name || '', co.phone || ''));
        });
      }
      document.getElementById('tenant-prop-id').value = t.property_id || '';
      document.getElementById('tenant-deposit').value = t.security_deposit || 0;
      const openArrear = document.getElementById('tenant-opening-arrear');
      if (openArrear) openArrear.value = t.opening_arrear || 0;
      document.getElementById('tenant-move-in').value = t.move_in_date || '';
      document.getElementById('tenant-payment-upi').value = t.payment_upi || '';
      document.getElementById('tenant-payment-bank-name').value = t.payment_bank_name || '';
      document.getElementById('tenant-payment-account-no').value = t.payment_account_no || '';
      document.getElementById('tenant-payment-ifsc').value = t.payment_ifsc || '';
      document.getElementById('tenant-init-elec').value = t.initial_elec_meter || 0;
      document.getElementById('tenant-init-water').value = t.initial_water_meter || 0;
      const statusSelect = document.getElementById('tenant-is-active');
      if (statusSelect) {
        statusSelect.value = t.is_active ? '1' : '0';
      }

      this.openModal('modal-tenant');
      this.refreshIcons();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  },

  async deleteTenant(id) {
    const tenant = this.tenants.find(t => t.id == id);
    const tenantName = tenant ? tenant.name : 'this tenant';
    const unitName = tenant && tenant.property_name ? tenant.property_name : 'No Unit';

    let warningHtml = `Are you sure you want to delete <strong>${tenantName}</strong> (${unitName})?`;
    warningHtml += `<br><br><span style="color:var(--danger); font-weight:600;"><i data-lucide="alert-triangle" style="width:14px; height:14px; vertical-align:-2px;"></i> Permanent Action:</span> Deleting this tenant will permanently erase all associated bills, meter history, and payment transactions. This cannot be undone.`;

    this.confirmDelete({
      title: 'Delete Tenant',
      subtitle: `${tenantName} • ${unitName}`,
      warningHtml: warningHtml,
      buttonLabel: 'Hold to Delete Tenant (10s)',
      onConfirm: async () => {
        try {
          await API.deleteTenant(id);
          this.toast('Tenant deleted successfully');
          await this.refreshAll();
        } catch (err) {
          alert('Error deleting tenant: ' + err.message);
        }
      }
    });
  },

  async deactivateTenant(id) {
    await this.openVacantCalculation(id);
  },

  async reactivateTenant(id) {
    const tenant = this.tenants.find(t => t.id == id);
    const tenantName = tenant ? tenant.name : 'this tenant';

    if (!confirm(`Reactivate "${tenantName}" as an active resident?`)) return;

    try {
      const t = await API.getTenant(id);
      t.is_active = true;
      await API.updateTenant(id, t);
      this.toast(`Tenant ${tenantName} reactivated`);
      await this.refreshAll();
    } catch (err) {
      alert('Error reactivating tenant: ' + err.message);
    }
  },

  async openTenantLedger(tenantId) {
    this.currentLedgerTenantId = tenantId;
    const container = document.getElementById('ledger-bills-container');
    if (container) {
      container.innerHTML = `<div class="empty-state">Loading bills...</div>`;
    }

    const tenant = this.tenants.find(t => t.id == tenantId);
    if (tenant) {
      document.getElementById('modal-ledger-tenant-name').textContent = `${tenant.name} - Bills`;
      document.getElementById('modal-ledger-unit-info').textContent = `Unit: ${tenant.property_name || 'Unassigned'} • Phone: ${tenant.phone}`;
    } else {
      document.getElementById('modal-ledger-tenant-name').textContent = 'Tenant Bills';
      document.getElementById('modal-ledger-unit-info').textContent = '';
    }

    this.openModal('modal-ledger');

    try {
      const [tDetails, bills, ledgerData] = await Promise.all([
        tenant ? Promise.resolve(tenant) : API.getTenant(tenantId),
        API.getBills(tenantId),
        API.getTenantLedger(tenantId).catch(() => null)
      ]);

      this.currentLedgerData = ledgerData;

      if (tDetails) {
        let paymentInfoText = '';
        if (tDetails.payment_upi) paymentInfoText += ` • Pay UPI: ${tDetails.payment_upi}`;
        if (tDetails.payment_bank_name) paymentInfoText += ` • Bank: ${tDetails.payment_bank_name} (${tDetails.payment_account_no || ''})`;
        document.getElementById('modal-ledger-tenant-name').textContent = `${tDetails.name} - Bills`;
        document.getElementById('modal-ledger-unit-info').textContent = `Unit: ${tDetails.property_name || 'Unassigned'} • Phone: ${tDetails.phone}${paymentInfoText}`;
      }

      const curr = window.APP_CURRENCY || '₹';
      const totalBilled = ledgerData ? ledgerData.total_billed : bills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      const totalPaid = ledgerData ? ledgerData.total_paid : bills.reduce((sum, b) => sum + (b.paid_amount || 0), 0);
      const totalBalance = ledgerData ? ledgerData.current_balance : bills.reduce((sum, b) => sum + (b.balance_amount || 0), 0);

      document.getElementById('ledger-total-billed').textContent = `${curr}${totalBilled.toFixed(2)}`;
      document.getElementById('ledger-total-paid').textContent = `${curr}${totalPaid.toFixed(2)}`;
      document.getElementById('ledger-total-balance').textContent = `${curr}${totalBalance.toFixed(2)}`;

      // Render Bills Cards
      if (container) {
        if (!bills || bills.length === 0) {
          container.innerHTML = `
            <div class="empty-state">
              No bills found for this tenant.
            </div>
          `;
        } else {
          container.innerHTML = bills.map(b => this.renderBillCardHtml(b)).join('');
          this.attachBillActionListeners(container);
        }
      }

      this.refreshIcons();
    } catch (err) {
      console.error(err);
      if (container) {
        container.innerHTML = `<div class="empty-state text-danger">Failed to load bills: ${err.message}</div>`;
      }
    }
  }
};
