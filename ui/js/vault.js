let currentVaultDocs = [];

async function loadVault() {
    const listDiv = document.getElementById('vaultList');
    if (!listDiv) return;
    
    const filter = document.getElementById('vaultFilter')?.value || '';

    try {
        const response = await fetch(`/api/documents${filter ? '?file_type=' + filter : ''}`);
        const docs = await response.json();
        currentVaultDocs = docs;
        renderVaultList(docs);
    } catch (e) { console.error("Failed to load vault", e); }
}

function renderVaultList(docs) {
    const listDiv = document.getElementById('vaultList');
    if (!listDiv) return;
    listDiv.innerHTML = '';

    if (!docs || docs.length === 0) {
        listDiv.innerHTML = '<div class="empty-state" style="grid-column: 1/-1;"><i data-lucide="folder-open"></i><p>Vault is empty</p></div>';
        lucide.createIcons();
        return;
    }

    docs.forEach(doc => {
        const card = document.createElement('div');
        card.className = 'card';
        card.style.padding = '1rem';
        card.style.display = 'flex';
        card.style.flexDirection = 'column';
        card.style.gap = '0.75rem';
        
        const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div class="stat-icon icon-primary" style="width: 32px; height: 32px; margin: 0;"><i data-lucide="${getFileIcon(doc.file_type)}"></i></div>
                <div style="display: flex; gap: 4px;">
                    <a href="${doc.file_path}" target="_blank" class="btn btn-secondary btn-icon-sm" title="View/Download"><i data-lucide="external-link"></i></a>
                    <button onclick="deleteDocument(${doc.id})" class="btn btn-secondary btn-icon-sm" style="color: var(--danger);" title="Delete"><i data-lucide="trash-2"></i></button>
                </div>
            </div>
            <div>
                <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${doc.file_name}">${doc.file_name}</div>
                <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-top: 2px;">${doc.file_type} &bull; ${doc.unit_room}</div>
            </div>
            <div style="margin-top: auto; border-top: 1px dashed var(--border); padding-top: 0.75rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.6rem; font-weight: 700; color: var(--text-muted);">
                    <span>Uploaded: ${new Date(doc.upload_date).toLocaleDateString()}</span>
                    ${doc.expiry_date ? `<span style="color: ${isExpired ? 'var(--danger)' : 'var(--success)'};">Expires: ${doc.expiry_date}</span>` : ''}
                </div>
                ${doc.notes ? `<div style="font-size: 0.65rem; color: var(--text-muted); font-style: italic; margin-top: 4px;">"${doc.notes}"</div>` : ''}
            </div>
        `;
        listDiv.appendChild(card);
    });
    lucide.createIcons();
}

function getFileIcon(type) {
    if (type.includes('ID')) return 'contact';
    if (type.includes('Lease')) return 'file-text';
    if (type.includes('Bill')) return 'receipt';
    return 'file';
}

function toggleUploadForm() {
    const modal = document.getElementById('uploadModal');
    const isHidden = modal.classList.toggle('hidden');
    if (!isHidden) {
        document.body.classList.add('modal-open');
        populateVaultDropdowns();
    } else {
        document.body.classList.remove('modal-open');
    }
}

function populateVaultDropdowns() {
    const unitSelect = document.getElementById('docRenterId');
    if (unitSelect && window.allTenants) {
        const current = unitSelect.value;
        unitSelect.innerHTML = '<option value="">-- Global / No Unit --</option>';
        window.allTenants.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t.id;
            opt.innerText = `UNIT ${t.room_no} - ${t.name}`;
            unitSelect.appendChild(opt);
        });
        unitSelect.value = current;
    }
}

async function uploadDocument() {
    const fileInput = document.getElementById('docFile');
    if (!fileInput.files.length) return showNotification("Please select a file", "error");

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('renter_id', document.getElementById('docRenterId').value);
    formData.append('file_type', document.getElementById('docType').value);
    formData.append('expiry_date', document.getElementById('docExpiry').value);
    formData.append('notes', document.getElementById('docNotes').value);

    showNotification("Uploading...", "info");

    try {
        const res = await fetch('/api/documents/upload', {
            method: 'POST',
            body: formData
        });
        if (res.ok) {
            showNotification("Document uploaded successfully", "success");
            toggleUploadForm();
            loadVault();
            loadActivityLogs();
        } else {
            showNotification("Upload failed", "error");
        }
    } catch (e) { console.error(e); }
}

async function deleteDocument(id) {
    if (!confirm("Delete this document? The file will be permanently removed.")) return;
    try {
        const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
        if (res.ok) {
            showNotification("Document deleted", "success");
            loadVault();
        }
    } catch (e) { console.error(e); }
}

function searchVault() {
    const term = document.getElementById('vaultSearch').value.toLowerCase();
    const cards = document.querySelectorAll('#vaultList .card');
    cards.forEach(card => {
        const text = card.innerText.toLowerCase();
        card.style.display = text.includes(term) ? '' : 'none';
    });
}
