// Tenants Controller: Tenant CRUD, Co-occupants, Long Press Expand, Ledger
import { toast } from './utils.js';

export const Tenants = {
  getAvatarColorIndex(name) {
    if (!name) return 0;
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 8;
  },

  getAvatarColor(name) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const lightColors = [
      { bg: '#e8f0fe', text: '#1967d2', border: '#c2e7ff' }, // Blue
      { bg: '#fce8e6', text: '#c5221f', border: '#fad2cf' }, // Red
      { bg: '#fef7e0', text: '#b06000', border: '#feefc3' }, // Yellow/Amber
      { bg: '#e6f4ea', text: '#137333', border: '#ceead6' }, // Green
      { bg: '#f3e8fd', text: '#8430ce', border: '#e9d2fd' }, // Purple
      { bg: '#e4f7fb', text: '#007b83', border: '#cbf0f8' }, // Teal
      { bg: '#feefe3', text: '#af3a03', border: '#fedfc8' }, // Orange
      { bg: '#fce4ec', text: '#b80672', border: '#f8bbd0' }, // Pink
    ];

    const darkColors = [
      { bg: 'rgba(59, 130, 246, 0.22)', text: '#93c5fd', border: 'rgba(59, 130, 246, 0.45)' },
      { bg: 'rgba(239, 68, 68, 0.22)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.45)' },
      { bg: 'rgba(245, 158, 11, 0.22)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.45)' },
      { bg: 'rgba(16, 185, 129, 0.22)', text: '#6ee7b7', border: 'rgba(16, 185, 129, 0.45)' },
      { bg: 'rgba(168, 85, 247, 0.22)', text: '#d8b4fe', border: 'rgba(168, 85, 247, 0.45)' },
      { bg: 'rgba(20, 184, 166, 0.22)', text: '#5eead4', border: 'rgba(20, 184, 166, 0.45)' },
      { bg: 'rgba(249, 115, 22, 0.22)', text: '#fdba74', border: 'rgba(249, 115, 22, 0.45)' },
      { bg: 'rgba(236, 72, 153, 0.22)', text: '#f472b6', border: 'rgba(236, 72, 153, 0.45)' },
    ];

    const colors = isDark ? darkColors : lightColors;
    const index = this.getAvatarColorIndex(name);
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
    const colorIdx = this.getAvatarColorIndex(t.name || '');
    const initials = this.getInitials(t.name || '');
    const fontSize = Math.round(size * 0.38);
    return `
      <div class="tenant-avatar tenant-avatar-initials avatar-color-${colorIdx}" onclick="App.openAvatarZoom(${t.id}, event)" title="Tap to view photo" style="width:${size}px; height:${size}px; min-width:${size}px; font-size:${fontSize}px;">
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
        const colorIdx = this.getAvatarColorIndex(t.name || '');
        const initials = this.getInitials(t.name || '');
        zoomInitials.className = `avatar-zoom-initials avatar-color-${colorIdx}`;
        zoomInitials.style.display = 'flex';
        zoomInitials.style.background = '';
        zoomInitials.style.color = '';
        zoomInitials.style.border = '';
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
        toast('Please choose an image file (JPEG, PNG, WebP).', 'warning');
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

  bindTenantPaymentUX() {
    const fields = ['tenant-payment-upi', 'tenant-payment-bank-name', 'tenant-payment-account-no', 'tenant-payment-ifsc'];
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        if (id === 'tenant-payment-ifsc') {
          el.value = el.value.toUpperCase();
        }
        this.updatePaymentBadge();
      });
    });
  },

  bindTenantDocumentUpload() {
    const triggerBtn = document.getElementById('btn-trigger-tenant-doc');
    const fileInput = document.getElementById('tenant-doc-file-input');
    if (triggerBtn && fileInput) {
      triggerBtn.onclick = () => fileInput.click();

      fileInput.onchange = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;

        this.currentTenantDocuments = this.currentTenantDocuments || [];

        for (const file of files) {
          if (file.size > 8 * 1024 * 1024) {
            this.toast(`File "${file.name}" exceeds 8MB limit.`, 'warning');
            continue;
          }

          const fileType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
          const lowerName = file.name.toLowerCase();
          let guessedType = 'AGREEMENT';
          if (lowerName.includes('id') || lowerName.includes('aadhaar') || lowerName.includes('pan') || lowerName.includes('voter') || lowerName.includes('passport')) {
            guessedType = 'ID_PROOF';
          } else if (lowerName.includes('police')) {
            guessedType = 'POLICE_VERIFICATION';
          } else if (lowerName.includes('receipt')) {
            guessedType = 'RECEIPT';
          }

          try {
            const dataUrl = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            this.currentTenantDocuments.push({
              id: 'doc_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
              name: file.name,
              type: guessedType,
              file_type: fileType,
              data: dataUrl,
              uploaded_at: new Date().toISOString().split('T')[0]
            });
          } catch (err) {
            this.toast(`Failed to read file ${file.name}: ${err.message}`, 'error');
          }
        }

        fileInput.value = '';
        this.renderTenantFormDocsList();
      };
    }
  },

  renderTenantFormDocsList() {
    const container = document.getElementById('tenant-form-docs-list');
    if (!container) return;

    const docs = this.currentTenantDocuments || [];
    if (docs.length === 0) {
      container.innerHTML = `<div style="font-size:0.75rem; color:var(--text-muted); font-style:italic; padding:4px 0;">No documents attached yet.</div>`;
      return;
    }

    container.innerHTML = docs.map((doc, idx) => {
      const isPdf = doc.file_type === 'application/pdf' || (doc.data && doc.data.startsWith('data:application/pdf'));
      const icon = isPdf ? 'file-text' : 'image';
      return `
        <div class="tenant-form-doc-item">
          <div class="tenant-form-doc-meta" title="${doc.name}">
            <i data-lucide="${icon}" style="width:16px; height:16px; color:var(--primary); flex-shrink:0;"></i>
            <span class="tenant-form-doc-name">${doc.name}</span>
          </div>
          <div class="tenant-form-doc-controls">
            <select class="tenant-form-doc-type-select" onchange="App.updateTenantFormDocType(${idx}, this.value)">
              <option value="AGREEMENT" ${doc.type === 'AGREEMENT' ? 'selected' : ''}>Agreement</option>
              <option value="ID_PROOF" ${doc.type === 'ID_PROOF' ? 'selected' : ''}>ID Proof</option>
              <option value="POLICE_VERIFICATION" ${doc.type === 'POLICE_VERIFICATION' ? 'selected' : ''}>Police Verif</option>
              <option value="RECEIPT" ${doc.type === 'RECEIPT' ? 'selected' : ''}>Receipt</option>
              <option value="OTHER" ${doc.type === 'OTHER' ? 'selected' : ''}>Other</option>
            </select>
            <button type="button" class="btn btn-ghost btn-xs" onclick="App.previewTenantDocumentDirect(${idx})" title="Preview Document">
              <i data-lucide="eye" style="width:14px; height:14px;"></i>
            </button>
            <button type="button" class="btn btn-ghost btn-xs text-danger" onclick="App.removeTenantFormDoc(${idx})" title="Remove Document">
              <i data-lucide="trash-2" style="width:14px; height:14px;"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    this.refreshIcons();
  },

  updateTenantFormDocType(idx, newType) {
    if (this.currentTenantDocuments && this.currentTenantDocuments[idx]) {
      this.currentTenantDocuments[idx].type = newType;
    }
  },

  removeTenantFormDoc(idx) {
    if (this.currentTenantDocuments && this.currentTenantDocuments[idx] !== undefined) {
      this.currentTenantDocuments.splice(idx, 1);
      this.renderTenantFormDocsList();
    }
  },

  previewTenantDocumentDirect(idx) {
    if (this.currentTenantDocuments && this.currentTenantDocuments[idx]) {
      this.previewTenantDocumentObject(this.currentTenantDocuments[idx]);
    }
  },

  previewTenantDocument(tenantId, docId) {
    const tenant = (this.tenants || []).find(t => t.id == tenantId);
    if (!tenant || !tenant.documents) {
      this.toast('Document not found', 'error');
      return;
    }
    const doc = tenant.documents.find(d => d.id == docId);
    if (!doc) {
      this.toast('Document not found', 'error');
      return;
    }
    this.previewTenantDocumentObject(doc);
  },

  previewTenantDocumentObject(doc) {
    if (!doc || !doc.data) {
      this.toast('Document data unavailable', 'error');
      return;
    }

    const titleEl = document.getElementById('doc-preview-title');
    const metaEl = document.getElementById('doc-preview-meta');
    const frameEl = document.getElementById('doc-preview-frame');
    const imgEl = document.getElementById('doc-preview-img');
    const dlBtn = document.getElementById('btn-doc-download');

    if (titleEl) titleEl.textContent = doc.name || 'Document Preview';
    if (metaEl) metaEl.textContent = `Type: ${doc.type || 'Document'} • ${doc.uploaded_at ? 'Uploaded ' + doc.uploaded_at : ''}`;

    const isPdf = doc.file_type === 'application/pdf' || doc.data.startsWith('data:application/pdf');

    if (isPdf) {
      if (frameEl) {
        frameEl.src = doc.data;
        frameEl.style.display = 'block';
      }
      if (imgEl) {
        imgEl.src = '';
        imgEl.style.display = 'none';
      }
    } else {
      if (imgEl) {
        imgEl.src = doc.data;
        imgEl.style.display = 'block';
      }
      if (frameEl) {
        frameEl.src = '';
        frameEl.style.display = 'none';
      }
    }

    if (dlBtn) {
      dlBtn.onclick = () => {
        const a = document.createElement('a');
        a.href = doc.data;
        a.download = doc.name || 'document';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      };
    }

    this.openModal('modal-doc-preview');
    this.refreshIcons();
  },

  openTenantDocuments(tenantId) {
    const tenant = (this.tenants || []).find(t => t.id == tenantId);
    if (!tenant) return;
    const docs = tenant.documents || [];
    if (docs.length === 0) {
      this.toast(`No documents attached for ${tenant.name}. Edit tenant to add documents.`, 'info');
      this.editTenant(tenantId);
      return;
    }
    if (docs.length === 1) {
      this.previewTenantDocument(tenantId, docs[0].id);
      return;
    }
    const detailsEl = document.getElementById(`tenant-details-${tenantId}`);
    if (detailsEl) {
      detailsEl.style.display = 'block';
      const icon = document.getElementById(`tenant-expand-icon-${tenantId}`);
      if (icon) icon.style.transform = 'rotate(180deg)';
      detailsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  },

  updatePaymentBadge() {
    const upi = document.getElementById('tenant-payment-upi')?.value.trim();
    const bank = document.getElementById('tenant-payment-bank-name')?.value.trim();
    const acc = document.getElementById('tenant-payment-account-no')?.value.trim();
    const ifsc = document.getElementById('tenant-payment-ifsc')?.value.trim();
    const badge = document.getElementById('tenant-payment-badge');
    if (!badge) return;
    if (upi || bank || acc || ifsc) {
      badge.textContent = 'Configured';
      badge.classList.add('is-configured');
    } else {
      badge.textContent = 'Optional';
      badge.classList.remove('is-configured');
    }
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
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="users" style="width:36px; height:36px;"></i>
          <div>No tenants found. Tap "Add Tenant" to begin.</div>
        </div>`;
      this.refreshIcons();
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
      <div class="app-card tenant-card tenant-compact-card" id="tenant-card-${t.id}" data-tenant-id="${t.id}">
        <!-- Row 1: Header (Avatar 36px + Info + Micro Contact Icons + 3-Dot Menu) -->
        <div class="tenant-compact-header">
          ${this.getTenantAvatarHtml(t, 36)}
          <div class="tenant-compact-info">
            <div class="tenant-compact-name-row">
              <span class="tenant-compact-name" title="${t.name}">${t.name}</span>
              <span class="badge ${t.is_active ? 'badge-paid' : 'badge-date'} badge-sm">${t.is_active ? 'Active' : 'Past'}</span>
            </div>
            <div class="tenant-compact-sub">
              <span class="tenant-compact-unit">${t.property_name || 'Unassigned'}</span>
            </div>
          </div>

          <!-- Micro Quick Contact Icons (Direct 1-Tap) & 3-Dot Actions -->
          <div class="tenant-compact-actions">
            ${cleanPhone ? `
              <a href="tel:${cleanPhone}" class="micro-action-btn" title="Call ${t.name}">
                <i data-lucide="phone"></i>
              </a>
              <a href="sms:${cleanPhone}" class="micro-action-btn" title="SMS ${t.name}">
                <i data-lucide="message-square"></i>
              </a>
              <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="micro-action-btn micro-wa" title="WhatsApp ${t.name}">
                <i data-lucide="message-circle"></i>
              </a>
            ` : ''}
            <div class="card-dropdown">
              <button type="button" class="btn-card-more" onclick="App.toggleDropdown(this, event)" aria-label="More options">
                <i data-lucide="more-vertical"></i>
              </button>
              <div class="card-dropdown-menu">
                <button type="button" class="dropdown-item" onclick="App.openBillModalForTenant(${t.id})">
                  <i data-lucide="plus"></i> Generate Bill
                </button>
                <button type="button" class="dropdown-item" onclick="App.openTenantLedger(${t.id})">
                  <i data-lucide="receipt"></i> View Bills &amp; Ledger
                </button>
                <button type="button" class="dropdown-item" onclick="App.openTenantDocuments(${t.id})">
                  <i data-lucide="paperclip"></i> Documents (${(t.documents || []).length})
                </button>
                <button type="button" class="dropdown-item" onclick="App.editTenant(${t.id})">
                  <i data-lucide="edit-3"></i> Edit Tenant
                </button>
                ${t.is_active ? `
                  <button type="button" class="dropdown-item" onclick="App.openVacantCalculation(${t.id})">
                    <i data-lucide="user-x"></i> Vacant
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

        <!-- Row 2: Financial Chips & Details Toggle -->
        <div class="tenant-compact-mid">
          <div class="tenant-compact-finance" onclick="App.openTenantLedger(${t.id})" title="Tap to view bills ledger">
            <span class="compact-chip chip-paid">Paid: ${this.formatMoney(totalPaid, true)}</span>
            <span class="compact-chip ${totalDue > 0 ? 'chip-due' : 'chip-cleared'}">Due: ${this.formatMoney(totalDue, true)}</span>
          </div>
          <div class="tenant-compact-btn-strip">
            <button type="button" class="btn btn-xs btn-ghost btn-details-toggle" onclick="App.toggleTenantCardExpand(${t.id})" title="Toggle Details">
              <i data-lucide="chevron-down" id="tenant-expand-icon-${t.id}"></i>
            </button>
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
            ${(t.documents && t.documents.length > 0) ? `
            <div class="tenant-detail-item" style="grid-column: span 2;">
              <span class="detail-label">Attached Documents (${t.documents.length})</span>
              <div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:4px;">
                ${t.documents.map((doc) => `
                  <button type="button" class="btn btn-outline btn-xs btn-tenant-doc-chip" onclick="App.previewTenantDocument(${t.id}, '${doc.id}')" title="Preview ${doc.name}">
                    <i data-lucide="${(doc.file_type === 'application/pdf' || (doc.data && doc.data.startsWith('data:application/pdf'))) ? 'file-text' : 'image'}" style="width:12px;height:12px;"></i>
                    <span>${doc.name}</span>
                    <span class="badge badge-subtle" style="font-size:0.65rem; padding:1px 4px;">${doc.type || 'DOC'}</span>
                  </button>
                `).join('')}
              </div>
            </div>
            ` : ''}
          </div>
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
      placeholder.className = 'tenant-photo-avatar-placeholder';
      placeholder.style.display = 'flex';
      placeholder.style.background = 'var(--surface-alt)';
      placeholder.style.color = 'var(--text-muted)';
      placeholder.style.border = '1px solid var(--border)';
      placeholder.innerHTML = `<i data-lucide="user" style="width:28px; height:28px; color:var(--text-muted);"></i>`;
    }
    if (btnRemove) btnRemove.style.display = 'none';

    document.getElementById('tenant-phone')?.classList.remove('is-invalid', 'is-valid');
    const phoneHint = document.getElementById('hint-tenant-phone');
    if (phoneHint) {
      phoneHint.style.display = 'none';
      phoneHint.textContent = '';
    }

    const paymentCard = document.getElementById('tenant-payment-card');
    if (paymentCard) paymentCard.open = true;
    this.updatePaymentBadge?.();

    // Reset documents
    this.currentTenantDocuments = [];
    this.renderTenantFormDocsList();

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
      document.getElementById('tenant-phone')?.classList.remove('is-invalid', 'is-valid');
      const phoneHint = document.getElementById('hint-tenant-phone');
      if (phoneHint) {
        phoneHint.style.display = 'none';
        phoneHint.textContent = '';
      }
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
          const colorIdx = this.getAvatarColorIndex(t.name);
          const initials = this.getInitials(t.name);
          placeholder.className = `tenant-photo-avatar-placeholder avatar-color-${colorIdx}`;
          placeholder.style.display = 'flex';
          placeholder.style.background = '';
          placeholder.style.color = '';
          placeholder.style.border = '';
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

      const paymentCard = document.getElementById('tenant-payment-card');
      if (paymentCard) paymentCard.open = true;
      this.updatePaymentBadge?.();

      // Populate documents
      this.currentTenantDocuments = Array.isArray(t.documents) ? JSON.parse(JSON.stringify(t.documents)) : [];
      this.renderTenantFormDocsList();

      this.openModal('modal-tenant');
      this.refreshIcons();
    } catch (err) {
      this.toast('Error: ' + err.message, 'error');
    }
  },

  async deleteTenant(id) {
    const tenant = this.tenants.find(t => t.id == id);
    const tenantName = tenant ? tenant.name : 'this tenant';
    const unitName = tenant && tenant.property_name ? tenant.property_name : 'No Unit';

    // Strict Order Protection: Check if tenant has existing bills
    const tenantBills = (this.bills || []).filter(b => b.tenant_id == id);
    if (tenantBills.length > 0) {
      this.toast('Delete bills first to remove this tenant', 'warning');
      return;
    }

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
          this.toast('Error deleting tenant: ' + err.message, 'error');
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
      this.toast('Error reactivating tenant: ' + err.message, 'error');
    }
  },

  async openTenantLedger(tenantId) {
    this.currentLedgerTenantId = tenantId;
    this.ledgerViewMode = this.ledgerViewMode || 'bills';
    this.openModal('modal-ledger');
    await this.renderTenantLedger(tenantId);
  },

  exportCurrentLedgerCSV() {
    const entries = this.currentLedgerData?.entries || [];
    if (!entries.length) {
      this.toast('No ledger entries available to export', 'warning');
      return;
    }
    const tenant = this.tenants.find(t => t.id == this.currentLedgerTenantId);
    const tenantName = tenant ? (tenant.name || 'tenant').replace(/[^a-zA-Z0-9_-]/g, '_') : 'tenant';
    const headers = ['Date', 'Type', 'Description / Details', 'Debit (Billed)', 'Credit (Paid)', 'Balance Due'];
    const rows = entries.map(e => [
      e.date || '',
      e.type || '',
      e.description || '',
      e.debit || 0,
      e.credit || 0,
      e.balance || 0
    ]);
    const dateStr = new Date().toISOString().slice(0, 10);
    this.downloadCSV(`ledger_${tenantName}_${dateStr}.csv`, headers, rows);
    this.toast(`Exported ${entries.length} ledger records successfully!`, 'success');
  },

  printTenantLedger() {
    this.renderTenantLedgerPrintSheet();
    setTimeout(() => {
      window.print();
    }, 40);
  },

  renderTenantLedgerPrintSheet() {
    const container = document.getElementById('tenant-ledger-printable');
    if (!container) return;

    const tenant = this.tenants.find(t => t.id == this.currentLedgerTenantId) || {};
    const curr = window.APP_CURRENCY || '₹';
    const ledger = this.currentLedgerData;
    const entries = ledger?.entries || [];

    const totalBilled = ledger ? ledger.total_billed : 0;
    const totalPaid = ledger ? ledger.total_paid : 0;
    const currentBalance = ledger ? ledger.current_balance : 0;

    const todayStr = new Date().toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });

    let paymentInfoHtml = '';
    if (tenant.payment_upi || tenant.payment_bank_name) {
      paymentInfoHtml = `
        <div class="prop-print-summary-box" style="margin-top:10px; margin-bottom:12px; background:#f8fafc; font-size:0.78rem;">
          <div style="flex:1; text-align:left;">
            <strong>Payment Coordinates:</strong>
            ${tenant.payment_upi ? `<span style="margin-left:6px;">UPI: <code>${tenant.payment_upi}</code></span>` : ''}
            ${tenant.payment_bank_name ? `<span style="margin-left:10px;">Bank: ${tenant.payment_bank_name} (A/C: ${tenant.payment_account_no || 'N/A'}, IFSC: ${tenant.payment_ifsc || 'N/A'})</span>` : ''}
          </div>
        </div>
      `;
    }

    let rowsHtml = '';
    if (entries.length === 0) {
      rowsHtml = `<tr><td colspan="6" style="text-align:center; padding:16px; color:#6b7280;">No passbook ledger records found.</td></tr>`;
    } else {
      rowsHtml = entries.map(e => {
        const isBill = e.type === 'BILL';
        const typeBadge = isBill
          ? `<span style="font-weight:700; color:#1e40af;">BILL</span>`
          : `<span style="font-weight:700; color:#15803d;">PAYMENT</span>`;
        const debitText = e.debit > 0 ? `${curr}${Number(e.debit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
        const creditText = e.credit > 0 ? `${curr}${Number(e.credit).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';
        const balText = `${curr}${Number(e.balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

        return `
          <tr>
            <td style="font-weight:600; white-space:nowrap;">${e.date || '-'}</td>
            <td>${typeBadge}</td>
            <td>${e.description || '-'}</td>
            <td class="num">${debitText}</td>
            <td class="num" style="color:#15803d; font-weight:600;">${creditText}</td>
            <td class="num" style="font-weight:700;">${balText}</td>
          </tr>
        `;
      }).join('');
    }

    container.innerHTML = `
      <div class="prop-print-header">
        <div>
          <div class="prop-print-title">TENANT FINANCIAL STATEMENT</div>
          <div class="prop-print-subtitle">Tenant: <strong>${tenant.name || 'Tenant'}</strong> • Unit: <strong>${tenant.property_name || 'Unassigned'}</strong></div>
          <div class="prop-print-meta">Phone: ${tenant.phone || 'N/A'} • Move-in: ${tenant.move_in_date || 'N/A'} • Deposit Held: ${curr}${(tenant.security_deposit || 0).toLocaleString('en-IN')}</div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.95rem; font-weight:800; color:#111827;">${window.APP_NAME || 'RentBill'}</div>
          <div style="font-size:0.75rem; color:#6b7280; margin-top:2px;">Statement Date: ${todayStr}</div>
        </div>
      </div>

      <div class="prop-print-summary-box">
        <div class="prop-print-summary-col">
          <div class="prop-print-summary-lbl">Total Billed</div>
          <div class="prop-print-summary-val">${curr}${Number(totalBilled).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="prop-print-summary-col">
          <div class="prop-print-summary-lbl">Total Paid</div>
          <div class="prop-print-summary-val" style="color:#15803d;">${curr}${Number(totalPaid).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
        <div class="prop-print-summary-col">
          <div class="prop-print-summary-lbl">Current Balance Due</div>
          <div class="prop-print-summary-val" style="color:${currentBalance > 0 ? '#b91c1c' : '#15803d'};">
            ${curr}${Number(currentBalance).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      ${paymentInfoHtml}

      <table class="prop-print-table">
        <thead>
          <tr>
            <th style="width:13%;">Date</th>
            <th style="width:12%;">Type</th>
            <th style="width:35%;">Description / Reference</th>
            <th class="num" style="width:13%;">Billed (Debit)</th>
            <th class="num" style="width:13%;">Paid (Credit)</th>
            <th class="num" style="width:14%;">Balance</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div style="margin-top:16px; font-size:0.72rem; color:#6b7280; display:flex; justify-content:space-between; border-top:1px dashed #d1d5db; padding-top:8px;">
        <span>Certified Tenant Financial Statement Passbook • ${tenant.name || 'Tenant'}</span>
        <span>Generated via RentBill</span>
      </div>
    `;
  },

  switchLedgerTab(mode) {
    if (mode === 'statement') mode = 'ledger';
    this.ledgerViewMode = mode;
    ['bills', 'payments', 'ledger'].forEach(tab => {
      const btn = document.getElementById(`btn-ledger-tab-${tab}`);
      if (btn) {
        btn.classList.toggle('active', tab === mode);
      }
    });
    this.renderTenantLedgerContent();
  },

  async renderTenantLedger(tenantId) {
    this.currentLedgerTenantId = tenantId;
    const container = document.getElementById('ledger-bills-container');
    if (container) {
      container.innerHTML = `<div class="empty-state">Loading tenant records...</div>`;
    }

    const tenant = this.tenants.find(t => t.id == tenantId);
    if (tenant) {
      document.getElementById('modal-ledger-tenant-name').textContent = `${tenant.name} - Ledger & Bills`;
      document.getElementById('modal-ledger-unit-info').textContent = `Unit: ${tenant.property_name || 'Unassigned'} • Phone: ${tenant.phone}`;
    } else {
      document.getElementById('modal-ledger-tenant-name').textContent = 'Tenant Ledger';
      document.getElementById('modal-ledger-unit-info').textContent = '';
    }

    try {
      const [tDetails, bills, ledgerData] = await Promise.all([
        tenant ? Promise.resolve(tenant) : API.getTenant(tenantId),
        API.getBills(tenantId),
        API.getTenantLedger(tenantId).catch(() => null)
      ]);

      this.currentLedgerData = ledgerData;
      this.currentLedgerBills = bills || [];

      if (tDetails) {
        let paymentInfoText = '';
        if (tDetails.payment_upi) paymentInfoText += ` • Pay UPI: ${tDetails.payment_upi}`;
        if (tDetails.payment_bank_name) paymentInfoText += ` • Bank: ${tDetails.payment_bank_name} (${tDetails.payment_account_no || ''})`;
        document.getElementById('modal-ledger-tenant-name').textContent = `${tDetails.name} - Ledger & Bills`;
        document.getElementById('modal-ledger-unit-info').textContent = `Unit: ${tDetails.property_name || 'Unassigned'} • Phone: ${tDetails.phone}${paymentInfoText}`;
      }

      const curr = window.APP_CURRENCY || '₹';
      const totalBilled = ledgerData ? ledgerData.total_billed : bills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
      const totalPaid = ledgerData ? ledgerData.total_paid : bills.reduce((sum, b) => sum + (b.paid_amount || 0), 0);
      const totalBalance = ledgerData ? ledgerData.current_balance : bills.reduce((sum, b) => sum + (b.balance_amount || 0), 0);

      document.getElementById('ledger-total-billed').textContent = `${curr}${totalBilled.toFixed(2)}`;
      document.getElementById('ledger-total-paid').textContent = `${curr}${totalPaid.toFixed(2)}`;
      document.getElementById('ledger-total-balance').textContent = `${curr}${totalBalance.toFixed(2)}`;

      // Update badge counts on tab buttons
      const countBillsEl = document.getElementById('ledger-count-bills');
      if (countBillsEl) countBillsEl.textContent = (this.currentLedgerBills || []).length;

      const paymentCount = (ledgerData?.entries || []).filter(e => e.type === 'PAYMENT').length;
      const countPayEl = document.getElementById('ledger-count-payments');
      if (countPayEl) countPayEl.textContent = paymentCount;

      // Update tab active state
      const currentMode = this.ledgerViewMode || 'bills';
      ['bills', 'payments', 'ledger'].forEach(tab => {
        const btn = document.getElementById(`btn-ledger-tab-${tab}`);
        if (btn) btn.classList.toggle('active', tab === currentMode);
      });

      this.renderTenantLedgerContent();
    } catch (err) {
      console.error(err);
      if (container) {
        container.innerHTML = `<div class="empty-state text-danger">Failed to load ledger: ${err.message}</div>`;
      }
    }
  },

  renderTenantLedgerContent() {
    const container = document.getElementById('ledger-bills-container');
    if (!container) return;

    let mode = this.ledgerViewMode || 'bills';
    if (mode === 'statement') mode = 'ledger';
    const curr = window.APP_CURRENCY || '₹';

    // 1. BILLS TAB
    if (mode === 'bills') {
      const bills = this.currentLedgerBills || [];
      if (bills.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i data-lucide="receipt" style="width:36px; height:36px;"></i>
            <div>No bills found for this tenant.</div>
          </div>
        `;
      } else {
        container.innerHTML = bills.map(b => this.renderBillCardHtml(b)).join('');
        this.attachBillActionListeners(container);
      }
      this.refreshIcons();
      return;
    }

    // 2. PAYMENTS TAB
    if (mode === 'payments') {
      const payments = (this.currentLedgerData?.entries || []).filter(e => e.type === 'PAYMENT');
      if (payments.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <i data-lucide="credit-card" style="width:36px; height:36px;"></i>
            <div>No payment records found for this tenant.</div>
          </div>
        `;
        this.refreshIcons();
        return;
      }

      let html = `<div class="ledger-statement-list">`;
      for (const p of payments) {
        html += `
          <div class="ledger-entry-card entry-payment">
            <div class="ledger-entry-header">
              <div class="ledger-entry-type-wrap">
                <span class="badge badge-paid">${p.payment_method || 'PAYMENT'}</span>
                <span class="ledger-entry-date">${p.date || ''}</span>
              </div>
              <div class="card-dropdown">
                <button type="button" class="btn-card-more" onclick="App.toggleDropdown(this, event)" aria-label="Payment options">
                  <i data-lucide="more-vertical"></i>
                </button>
                <div class="card-dropdown-menu">
                  ${p.bill_id ? `
                    <button type="button" class="dropdown-item btn-action-view-bill" data-bill-id="${p.bill_id}">
                      <i data-lucide="printer"></i> View Bill (#${p.bill_number || p.bill_id})
                    </button>
                  ` : ''}
                  <button type="button" class="dropdown-item btn-action-edit-pay" data-payment-id="${p.id}">
                    <i data-lucide="edit-2"></i> Edit Payment
                  </button>
                  <button type="button" class="dropdown-item dropdown-item-danger btn-action-del-pay" data-payment-id="${p.id}" data-bill-id="${p.bill_id}" data-amount="${p.credit}">
                    <i data-lucide="trash-2"></i> Delete Payment
                  </button>
                </div>
              </div>
            </div>

            <div class="card-middle" style="margin: 4px 0 2px 0; display:flex; justify-content:space-between; align-items:baseline;">
              <div>
                <div class="card-amount-label">Payment Amount</div>
                <div class="card-amount-val text-success" style="font-size:1.2rem; font-weight:800;">
                  ${curr}${Number(p.credit).toFixed(2)}
                </div>
              </div>
              <div style="text-align:right;">
                <div class="card-amount-label">Applied To</div>
                <div style="font-size:0.86rem; font-weight:650; color:var(--text-main);">
                  Bill #${p.bill_number || p.bill_id}
                </div>
              </div>
            </div>

            <div class="ledger-entry-desc" style="font-size:0.8rem; font-weight:500; color:var(--text-muted); margin-top:2px;">
              ${p.description || ''}
            </div>

            ${(p.reference_no || p.billing_month) ? `
              <div class="ledger-entry-footer" style="padding-top:6px; font-size:0.75rem; color:var(--text-muted);">
                <span>Month: <strong>${p.billing_month ? this.formatMonth(p.billing_month) : 'Rent'}</strong></span>
                ${p.reference_no ? `<span>Ref: <strong>${p.reference_no}</strong></span>` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }
      html += `</div>`;
      container.innerHTML = html;
      this.attachLedgerEntryActionListeners(container);
      this.refreshIcons();
      return;
    }

    // 3. LEDGER TAB (Full Passbook Timeline)
    const entries = this.currentLedgerData?.entries || [];
    if (entries.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i data-lucide="book-open" style="width:36px; height:36px;"></i>
          <div>No transactions recorded in this ledger.</div>
        </div>
      `;
      this.refreshIcons();
      return;
    }

    let html = `<div class="ledger-statement-list">`;
    for (const item of entries) {
      const isPayment = item.type === 'PAYMENT';
      const isBill = item.type === 'BILL';

      html += `
        <div class="ledger-entry-card ${isPayment ? 'entry-payment' : 'entry-bill'}">
          <div class="ledger-entry-header">
            <div class="ledger-entry-type-wrap">
              <span class="badge ${isPayment ? 'badge-paid' : 'badge-primary'}">${item.type}</span>
              <span class="ledger-entry-date">${item.date || ''}</span>
            </div>
            <div class="card-dropdown">
              <button type="button" class="btn-card-more" onclick="App.toggleDropdown(this, event)" aria-label="Entry options">
                <i data-lucide="more-vertical"></i>
              </button>
              <div class="card-dropdown-menu">
                ${isBill && item.bill_id ? `
                  <button type="button" class="dropdown-item btn-action-view-bill" data-bill-id="${item.bill_id}">
                    <i data-lucide="printer"></i> View Invoice
                  </button>
                  ${(() => {
                    const targetBill = (this.currentLedgerBills || []).find(b => b.id == item.bill_id);
                    const isPaid = item.status === 'PAID' || (targetBill && (targetBill.status === 'PAID' || targetBill.balance_amount <= 0));
                    return !isPaid ? `
                      <button type="button" class="dropdown-item dropdown-item-success btn-action-pay-bill" data-bill-id="${item.bill_id}">
                        <i data-lucide="credit-card"></i> Record Payment
                      </button>
                    ` : '';
                  })()}
                ` : ''}
                ${isPayment ? `
                  ${item.bill_id ? `
                    <button type="button" class="dropdown-item btn-action-view-bill" data-bill-id="${item.bill_id}">
                      <i data-lucide="printer"></i> View Associated Bill
                    </button>
                  ` : ''}
                  <button type="button" class="dropdown-item btn-action-edit-pay" data-payment-id="${item.id}">
                    <i data-lucide="edit-2"></i> Edit Payment
                  </button>
                  <button type="button" class="dropdown-item dropdown-item-danger btn-action-del-pay" data-payment-id="${item.id}" data-bill-id="${item.bill_id}" data-amount="${item.credit}">
                    <i data-lucide="trash-2"></i> Delete Payment
                  </button>
                ` : ''}
              </div>
            </div>
          </div>

          <div class="ledger-entry-desc">${item.description || ''}</div>

          <div class="ledger-entry-footer">
            <div class="ledger-entry-amount-block">
              ${isBill ? `
                <span class="amount-label">Billed:</span>
                <span class="amount-val text-danger">+${curr}${item.debit.toFixed(2)}</span>
              ` : `
                <span class="amount-label">Paid:</span>
                <span class="amount-val text-success">-${curr}${item.credit.toFixed(2)}</span>
              `}
            </div>
            <div class="ledger-entry-balance-block">
              <span class="balance-label">Balance:</span>
              <span class="balance-val ${item.running_balance > 0 ? 'text-danger' : 'text-success'}">${curr}${item.running_balance.toFixed(2)}</span>
            </div>
          </div>
        </div>
      `;
    }
    html += `</div>`;
    container.innerHTML = html;
    this.attachLedgerEntryActionListeners(container);
    this.refreshIcons();
  },

  attachLedgerEntryActionListeners(container) {
    container.querySelectorAll('.btn-action-view-bill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));
        const bid = parseInt(btn.getAttribute('data-bill-id'), 10);
        if (bid) this.showInvoice(bid);
      });
    });

    container.querySelectorAll('.btn-action-pay-bill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));
        const bid = parseInt(btn.getAttribute('data-bill-id'), 10);
        if (bid) this.openPaymentModal(bid);
      });
    });

    container.querySelectorAll('.btn-action-edit-pay').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));
        const pid = parseInt(btn.getAttribute('data-payment-id'), 10);
        if (pid) this.openEditPaymentModal(pid);
      });
    });

    container.querySelectorAll('.btn-action-del-pay').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.card-dropdown.active').forEach(d => d.classList.remove('active'));
        const pid = parseInt(btn.getAttribute('data-payment-id'), 10);
        const bid = parseInt(btn.getAttribute('data-bill-id'), 10);
        const amt = btn.getAttribute('data-amount');
        if (pid) this.deletePaymentRecord(pid, bid, amt);
      });
    });
  }
};
