// Reminders Module
// Automated & Manual Reminder Engine: WhatsApp, SMS/RCS, and Email notifications

export const Reminders = {
  currentReminderBill: null,
  currentReminderTenant: null,

  async openReminderModalForBill(billId) {
    const bill = (this.bills || []).find(b => b.id == billId) || await API.getBill(billId).catch(() => null);
    if (!bill) return;
    const tenant = (this.tenants || []).find(t => t.id == bill.tenant_id) || null;

    this.showReminderDialog(bill, tenant);
  },

  async sendOverdueWhatsAppReminder(billId) {
    this.openReminderModalForBill(billId);
  },

  showReminderDialog(bill, tenant) {
    this.currentReminderBill = bill;
    this.currentReminderTenant = tenant;

    const tenantName = (tenant && tenant.name) || (bill && bill.tenant_name) || 'Tenant';
    const subtitle = document.getElementById('reminder-tenant-subtitle');
    if (subtitle) {
      const propName = (tenant && tenant.property_name) || (bill && bill.property_name) || '';
      subtitle.textContent = `Tenant: ${tenantName} ${propName ? '(' + propName + ')' : ''}`;
    }

    // Default channel: based on tenant.preferred_channel
    let activeChannel = (tenant && tenant.preferred_channel === 'WHATSAPP') ? 'whatsapp' : 'sms_rcs';

    // Default template: if overdue -> 'overdue', if due today -> 'due_today', if paid -> 'receipt', else -> 'gentle'
    let activeType = 'gentle';
    if (bill) {
      if (bill.status === 'PAID') activeType = 'receipt';
      else if (bill.status === 'OVERDUE') activeType = 'overdue';
      else {
        const today = new Date().toISOString().split('T')[0];
        if (bill.due_date === today) activeType = 'due_today';
      }
    }

    const channelSelect = document.getElementById('reminder-channel-select');
    const templateSelect = document.getElementById('reminder-template-select');
    if (channelSelect) channelSelect.value = activeChannel;
    if (templateSelect) templateSelect.value = activeType;

    const msgBox = document.getElementById('reminder-message-text');
    const counterEl = document.getElementById('reminder-char-counter');
    const btnSendPrimary = document.getElementById('btn-send-reminder-primary');
    const btnSendIcon = document.getElementById('btn-send-primary-icon');
    const btnSendText = document.getElementById('btn-send-primary-text');

    const waNameEl = document.getElementById('reminder-wa-tenant-name');
    const waAvatarEl = document.getElementById('reminder-wa-avatar-char');
    const waTimeEl = document.getElementById('reminder-wa-time');
    const waBubbleEl = document.getElementById('reminder-wa-bubble-content');
    const waScreen = document.getElementById('reminder-whatsapp-screen');
    const rawContainer = document.getElementById('reminder-raw-container');
    const btnViewWa = document.getElementById('btn-reminder-view-wa');
    const btnViewRaw = document.getElementById('btn-reminder-view-raw');

    if (waNameEl) waNameEl.textContent = tenantName;
    if (waAvatarEl) waAvatarEl.textContent = (tenantName[0] || 'T').toUpperCase();
    if (waTimeEl) {
      const now = new Date();
      waTimeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    const setViewMode = (mode) => {
      if (mode === 'whatsapp') {
        if (btnViewWa) btnViewWa.classList.add('active');
        if (btnViewRaw) btnViewRaw.classList.remove('active');
        if (waScreen) waScreen.style.display = 'block';
        if (rawContainer) rawContainer.style.display = 'none';
      } else {
        if (btnViewRaw) btnViewRaw.classList.add('active');
        if (btnViewWa) btnViewWa.classList.remove('active');
        if (rawContainer) rawContainer.style.display = 'block';
        if (waScreen) waScreen.style.display = 'none';
      }
    };

    if (btnViewWa) btnViewWa.onclick = () => setViewMode('whatsapp');
    if (btnViewRaw) btnViewRaw.onclick = () => setViewMode('raw');

    // Default view mode based on channel
    setViewMode(activeChannel === 'whatsapp' ? 'whatsapp' : 'raw');

    const updatePrimaryButton = () => {
      if (!btnSendPrimary) return;
      if (activeChannel === 'whatsapp') {
        btnSendPrimary.className = 'btn btn-whatsapp';
        if (btnSendText) btnSendText.textContent = 'Open WhatsApp Now';
        if (btnSendIcon) btnSendIcon.setAttribute('data-lucide', 'message-circle');
      } else if (activeChannel === 'email') {
        btnSendPrimary.className = 'btn btn-primary';
        if (btnSendText) btnSendText.textContent = 'Send via Email';
        if (btnSendIcon) btnSendIcon.setAttribute('data-lucide', 'mail');
      } else {
        // SMS / RCS
        btnSendPrimary.className = 'btn btn-primary';
        if (btnSendText) btnSendText.textContent = 'Send via SMS / RCS';
        if (btnSendIcon) btnSendIcon.setAttribute('data-lucide', 'message-square');
      }
      this.refreshIcons();
    };

    const updateCharCounter = (text) => {
      const str = text || '';
      const chars = str.length;
      const words = str.trim() ? str.trim().split(/\s+/).length : 0;
      const smsSegments = Math.max(1, Math.ceil(chars / 160));

      const statChars = document.getElementById('reminder-stat-chars');
      const statWords = document.getElementById('reminder-stat-words');
      const statSms = document.getElementById('reminder-stat-sms');

      if (statChars) statChars.innerHTML = `<strong>${chars}</strong> chars`;
      if (statWords) statWords.innerHTML = `<strong>${words}</strong> words`;
      if (statSms) statSms.innerHTML = `<strong>${smsSegments}</strong> SMS`;

      if (counterEl) {
        if (activeChannel === 'sms_rcs') {
          counterEl.innerHTML = `<strong>${chars}</strong> chars &bull; <strong>${words}</strong> words &bull; <strong>${smsSegments}</strong> SMS`;
        } else {
          counterEl.innerHTML = `<strong>${chars}</strong> chars &bull; <strong>${words}</strong> words`;
        }
      }

      if (waBubbleEl && typeof Share.formatWhatsAppMarkup === 'function') {
        waBubbleEl.innerHTML = Share.formatWhatsAppMarkup(str);
      }
    };

    const regenerateMessage = () => {
      if (msgBox) {
        const text = Share.buildReminderMessage(activeType, this.currentReminderBill, this.currentReminderTenant, activeChannel);
        msgBox.value = text;
        updateCharCounter(text);
      }
      updatePrimaryButton();
    };

    regenerateMessage();

    // Bind channel change
    if (channelSelect) {
      channelSelect.onchange = () => {
        activeChannel = channelSelect.value;
        setViewMode(activeChannel === 'whatsapp' ? 'whatsapp' : 'raw');
        regenerateMessage();
      };
    }

    // Bind template change
    if (templateSelect) {
      templateSelect.onchange = () => {
        activeType = templateSelect.value;
        regenerateMessage();
      };
    }

    // Live typing counter
    if (msgBox) {
      msgBox.oninput = () => {
        updateCharCounter(msgBox.value);
      };
    }

    // Bind copy message
    const btnCopy = document.getElementById('btn-copy-reminder-msg');
    if (btnCopy && msgBox) {
      btnCopy.onclick = async () => {
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(msgBox.value);
          } else {
            msgBox.select();
            document.execCommand('copy');
          }
          this.toast('Reminder text copied to clipboard!');
        } catch {
          msgBox.select();
          document.execCommand('copy');
          this.toast('Copied!');
        }
      };
    }

    // Bind primary send action
    if (btnSendPrimary) {
      btnSendPrimary.onclick = () => {
        const phone = (tenant && tenant.phone) || (bill && bill.tenant_phone) || '';
        const email = (tenant && tenant.email) || (bill && bill.tenant_email) || '';
        const text = msgBox ? msgBox.value : '';

        if (activeChannel === 'whatsapp') {
          Share.sendWhatsAppDirect(phone, text);
          this.toast('Opening WhatsApp...');
        } else if (activeChannel === 'email') {
          const subject = `Rent Notice for ${bill ? bill.property_name : (tenant ? tenant.property_name : 'Rental Unit')}`;
          Share.sendEmailDirect(email, subject, text);
          this.toast('Opening Email client...');
        } else {
          // SMS / RCS
          Share.sendSmsRcsDirect(phone, text);
          this.toast('Opening Messages (SMS / RCS)...');
        }
        this.closeModal('modal-reminder');
      };
    }

    this.openModal('modal-reminder');
    this.refreshIcons();
  }
};
