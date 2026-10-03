// Reminders Module
// Automated & Manual Reminder Engine: WhatsApp, SMS/RCS, and Email notifications

export const Reminders = {
  currentReminderBill: null,
  currentReminderTenant: null,

  async openReminderModalForTenant(tenantId) {
    const tenant = this.tenants.find(t => t.id == tenantId) || await API.getTenant(tenantId).catch(() => null);
    if (!tenant) return;

    // Find latest unpaid or most recent bill for this tenant
    const tenantBills = (this.bills || []).filter(b => b.tenant_id == tenantId);
    const bill = tenantBills.find(b => b.status !== 'PAID') || tenantBills[0] || null;

    this.showReminderDialog(bill, tenant);
  },

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

    const channelPills = document.querySelectorAll('#modal-reminder .channel-pill');
    channelPills.forEach(p => {
      if (p.getAttribute('data-channel') === activeChannel) p.classList.add('active');
      else p.classList.remove('active');
    });

    const templatePills = document.querySelectorAll('#modal-reminder .template-pill');
    templatePills.forEach(p => {
      if (p.getAttribute('data-tpl') === activeType) p.classList.add('active');
      else p.classList.remove('active');
    });

    const msgBox = document.getElementById('reminder-message-text');
    const counterEl = document.getElementById('reminder-char-counter');
    const btnSendPrimary = document.getElementById('btn-send-reminder-primary');
    const btnSendIcon = document.getElementById('btn-send-primary-icon');
    const btnSendText = document.getElementById('btn-send-primary-text');

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
      if (!counterEl) return;
      const chars = (text || '').length;
      if (activeChannel === 'sms_rcs') {
        const smsSegments = Math.ceil(chars / 160) || 1;
        counterEl.textContent = `${chars} chars (${smsSegments} SMS / RCS)`;
      } else {
        counterEl.textContent = `${chars} chars`;
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

    // Bind channel clicks
    channelPills.forEach(p => {
      p.onclick = () => {
        channelPills.forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        activeChannel = p.getAttribute('data-channel');
        regenerateMessage();
      };
    });

    // Bind template clicks
    templatePills.forEach(p => {
      p.onclick = () => {
        templatePills.forEach(x => x.classList.remove('active'));
        p.classList.add('active');
        activeType = p.getAttribute('data-tpl');
        regenerateMessage();
      };
    });

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
        } catch (e) {
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
