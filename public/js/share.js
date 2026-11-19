// Share and Invoice formatting utilities with robust Mobile Share & in-app fallback

const Share = {
  // Format month string into readable text (e.g. '2026-09' -> 'September 2026')
  formatMonth(monthStr) {
    if (!monthStr) return '';
    const str = String(monthStr).trim();
    const match = str.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const d = new Date(year, month, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    }
    return str;
  },

  // Format date string into clean readable format (e.g. '2026-10-05' -> '05 Oct 2026')
  formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    const str = String(dateStr).trim();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const year = match[1];
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthIdx = parseInt(match[2], 10) - 1;
      const month = monthNames[monthIdx] || match[2];
      const day = match[3];
      return `${day} ${month} ${year}`;
    }
    return str;
  },

  // Convert number to Indian currency words format
  amountInWords(amount) {
    if (!amount || isNaN(amount) || amount <= 0) return 'Zero Rupees Only';

    const units = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function twoDigits(num) {
      if (num < 20) return units[num];
      const t = tens[Math.floor(num / 10)];
      const u = units[num % 10];
      return u ? `${t} ${u}` : t;
    }

    function threeDigits(num) {
      const h = Math.floor(num / 100);
      const rem = num % 100;
      const parts = [];
      if (h > 0) parts.push(`${units[h]} Hundred`);
      if (rem > 0) parts.push(twoDigits(rem));
      return parts.join(' ');
    }

    const intPart = Math.floor(amount);
    const paise = Math.round((amount - intPart) * 100);

    const crores = Math.floor(intPart / 10000000);
    let rem = intPart % 10000000;
    const lakhs = Math.floor(rem / 100000);
    rem = rem % 100000;
    const thousands = Math.floor(rem / 1000);
    const hundreds = rem % 1000;

    const parts = [];
    if (crores > 0) parts.push(`${threeDigits(crores)} Crore`);
    if (lakhs > 0) parts.push(`${twoDigits(lakhs)} Lakh`);
    if (thousands > 0) parts.push(`${twoDigits(thousands)} Thousand`);
    if (hundreds > 0) parts.push(threeDigits(hundreds));

    let words = parts.join(' ') || 'Zero';
    words += ' Rupees';
    if (paise > 0) {
      words += ` and ${twoDigits(paise)} Paise`;
    }
    words += ' Only';
    return words;
  },

  // Build standard NPCI UPI payment deep link (upi://pay?...)
  buildUpiUri(bill, tenant = null) {
    if (!bill && !tenant) return '';
    const upi = (bill && bill.payment_upi) || (tenant && tenant.payment_upi) || '';
    if (!upi) return '';

    let balanceNum = 0;
    let totalNum = 0;
    if (bill) {
      totalNum = bill.total_amount || 0;
      balanceNum = (bill.balance_amount !== undefined && bill.balance_amount !== null)
        ? bill.balance_amount
        : (totalNum - (bill.paid_amount || 0));
    }
    const payAmt = balanceNum > 0 ? balanceNum.toFixed(2) : totalNum.toFixed(2);
    const propName = (bill && bill.property_name) || (tenant && tenant.property_name) || 'RentBill';
    const month = this.formatMonth((bill && bill.billing_month) || '');
    const payee = encodeURIComponent(propName);
    const note = encodeURIComponent(`Rent ${month} ${propName}`.trim());

    return `upi://pay?pa=${encodeURIComponent(upi)}&pn=${payee}&am=${payAmt}&cu=INR&tn=${note}`;
  },

  // Render QR code into an HTML container element or ID
  renderUpiQrCode(containerOrId, upiUri, size = 130) {
    if (!upiUri) return null;
    const elem = typeof containerOrId === 'string' ? document.getElementById(containerOrId) : containerOrId;
    if (!elem) return null;
    elem.innerHTML = '';
    if (typeof QRCode === 'undefined') {
      console.warn('QRCode library is not loaded');
      return null;
    }
    return new QRCode(elem, {
      text: upiUri,
      width: size,
      height: size,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
  },

  // Generate an offscreen canvas containing the UPI QR code for direct drawing into receipt images
  getUpiQrCanvas(upiUri, size = 110) {
    if (!upiUri || typeof QRCode === 'undefined') return null;
    const div = document.createElement('div');
    new QRCode(div, {
      text: upiUri,
      width: size,
      height: size,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    return div.querySelector('canvas');
  },

  // Format the full bill breakdown text (Clean, professional, detailed invoice format)
  buildBillText(bill) {
    const currency = window.APP_CURRENCY || '₹';
    const numFmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (n || '0.00'));
    const divider = '------------------------------------------';
    const billDate = this.formatDate(bill.created_at || new Date().toISOString());

    const lines = [
      `RENT & UTILITY INVOICE`,
      divider,
      `Invoice No:    #${bill.bill_number}`,
      `Bill Date:     ${billDate}`,
      `Rent For:      ${this.formatMonth(bill.billing_month)}`,
      `Due Date:      ${bill.due_date || 'N/A'}`,
      divider,
      `TENANT & PROPERTY:`,
      `Tenant Name:   ${bill.tenant_name}`,
      `Property/Unit: ${bill.property_name}`,
      divider,
      `ITEMIZED CHARGES:`,
      `➤ Base Rent:         ${currency}${numFmt(bill.base_rent)}`,
    ];

    if (bill.electricity_units > 0 || bill.electricity_amount > 0) {
      lines.push(`➤ Electricity:       ${currency}${numFmt(bill.electricity_amount)}`);
      if (bill.electricity_units > 0 && bill.electricity_rate !== undefined && bill.electricity_rate !== null) {
        lines.push(`  └➤ Consumption:    ${bill.electricity_units} units @ ${currency}${bill.electricity_rate}/unit`);
      }
      if (bill.prev_electricity_meter !== undefined && bill.curr_electricity_meter !== undefined && bill.prev_electricity_meter !== null && bill.curr_electricity_meter !== null) {
        lines.push(`  └➤ Meter Reading:  ${bill.prev_electricity_meter} to ${bill.curr_electricity_meter}`);
      }
    }

    if (bill.water_amount > 0) {
      lines.push(`➤ Water:             ${currency}${numFmt(bill.water_amount)}`);
      if (bill.water_billing_type === 'METER' && bill.water_units > 0) {
        lines.push(`  └➤ Consumption:    ${bill.water_units} units @ ${currency}${bill.water_rate || 0}/unit`);
        if (bill.prev_water_meter !== undefined && bill.curr_water_meter !== undefined && bill.prev_water_meter !== null && bill.curr_water_meter !== null) {
          lines.push(`  └➤ Meter Reading:  ${bill.prev_water_meter} to ${bill.curr_water_meter}`);
        }
      } else {
        lines.push(`  └➤ Billing Type:   Fixed Monthly Charge`);
      }
    }

    if (bill.maintenance_amount > 0) {
      lines.push(`➤ Maintenance:       ${currency}${numFmt(bill.maintenance_amount)}`);
    }

    if (bill.other_charges > 0) {
      lines.push(`➤ Other Charges:     ${currency}${numFmt(bill.other_charges)}`);
      if (bill.other_charges_desc) {
        lines.push(`  └➤ Description:    ${bill.other_charges_desc}`);
      }
    }

    if (bill.discount_amount > 0) {
      lines.push(`➤ Concession:       -${currency}${numFmt(bill.discount_amount)}`);
      if (bill.discount_reason) {
        lines.push(`  └➤ Reason:         ${bill.discount_reason}`);
      }
    }

    if (bill.previous_balance > 0) {
      lines.push(`➤ Previous Balance:  ${currency}${numFmt(bill.previous_balance)}`);
      lines.push(`  └➤ Type:           Carried-Forward Arrears`);
    }

    lines.push(divider);
    lines.push(`TOTAL INVOICE DUE:   ${currency}${numFmt(bill.total_amount)}`);
    lines.push(`  └➤ In Words:       ${this.amountInWords(bill.total_amount)}`);

    const balance = (bill.balance_amount !== undefined && bill.balance_amount !== null)
      ? bill.balance_amount
      : (bill.total_amount - (bill.paid_amount || 0));

    if (bill.paid_amount > 0) {
      lines.push(`Amount Paid:         ${currency}${numFmt(bill.paid_amount)}`);
      lines.push(`OUTSTANDING BALANCE: ${currency}${numFmt(balance)}`);
      if (balance > 0) {
        lines.push(`  └➤ In Words:       ${this.amountInWords(balance)}`);
      }
    }

    if (bill.payment_upi || bill.payment_bank_name) {
      lines.push(divider);
      lines.push(`PAYMENT DETAILS:`);
      if (bill.payment_upi) {
        lines.push(`➤ UPI Payment:`);
        lines.push(`  └➤ UPI ID:         ${bill.payment_upi}`);
        const upiUri = this.buildUpiUri(bill);
        if (upiUri) {
          lines.push(`  └➤ Pay Link:       ${upiUri}`);
        }
      }
      if (bill.payment_bank_name) {
        lines.push(`➤ Bank Transfer:`);
        lines.push(`  └➤ Bank Name:      ${bill.payment_bank_name}`);
        if (bill.payment_account_no) {
          lines.push(`  └➤ Account No:     ${bill.payment_account_no}`);
        }
        if (bill.payment_ifsc) {
          lines.push(`  └➤ IFSC Code:      ${bill.payment_ifsc}`);
        }
      }
    }

    const isPaid = bill.status === 'PAID' || (bill.balance_amount !== undefined && bill.balance_amount <= 0 && bill.total_amount > 0);
    if (!isPaid) {
      lines.push(divider);
      lines.push(`📌 Share payment screenshot once paid.`);
    }

    if (bill.notes) {
      lines.push(divider);
      lines.push(`Notes:`);
      lines.push(`  └➤ ${bill.notes}`);
    }

    lines.push(divider);
    lines.push(`Generated via RentBill`);

    return lines.join('\n');
  },

  // Format concise SMS / RCS bill notice (fits mobile text messages, zero messy asterisks)
  buildSmsRcsBillText(bill, isCompact = false) {
    const currency = window.APP_CURRENCY || '₹';
    const numFmt = (n) => (typeof n === 'number' ? n.toFixed(2) : (n || '0.00'));
    const due = bill.due_date || '';
    const billDate = this.formatDate(bill.created_at || new Date().toISOString());
    const balance = (bill.balance_amount !== undefined && bill.balance_amount !== null)
      ? bill.balance_amount
      : (bill.total_amount - (bill.paid_amount || 0));
    const isPaid = bill.status === 'PAID' || (bill.balance_amount !== undefined && bill.balance_amount <= 0 && bill.total_amount > 0);

    let payDetails = '';
    if (bill.payment_upi) {
      payDetails = `Pay via UPI: ${bill.payment_upi}`;
    } else if (bill.payment_bank_name) {
      payDetails = `Pay to Bank: ${bill.payment_bank_name} (A/C: ${bill.payment_account_no || ''}, IFSC: ${bill.payment_ifsc || ''})`;
    }

    if (isCompact) {
      let msg = `RentBill: Hi ${bill.tenant_name}, rent bill for ${bill.property_name} (${this.formatMonth(bill.billing_month)}) dated ${billDate} is ${currency}${numFmt(bill.total_amount)}. Due: ${due}.`;
      if (balance > 0 && balance !== bill.total_amount) {
        msg += ` Due Bal: ${currency}${numFmt(balance)}.`;
      }
      if (payDetails) msg += ` ${payDetails}.`;
      if (!isPaid) msg += ` Share payment screenshot once paid.`;
      msg += ` Thank you!`;
      return msg;
    }

    const lines = [
      `RENT INVOICE (${this.formatMonth(bill.billing_month)})`,
      `Tenant: ${bill.tenant_name}`,
      `Unit: ${bill.property_name}`,
      `Bill No: #${bill.bill_number}`,
      `Bill Date: ${billDate}`,
      `Due Date: ${due}`,
      `------------------------------------------`,
      `➤ Base Rent: ${currency}${numFmt(bill.base_rent)}`,
    ];

    if (bill.electricity_amount > 0 || bill.electricity_units > 0) {
      lines.push(`➤ Electricity: ${currency}${numFmt(bill.electricity_amount)}`);
      let elecSub = [];
      if (bill.electricity_units > 0) elecSub.push(`${bill.electricity_units} units @ ${currency}${bill.electricity_rate || 0}`);
      if (bill.prev_electricity_meter !== undefined && bill.curr_electricity_meter !== undefined && bill.prev_electricity_meter !== null && bill.curr_electricity_meter !== null) {
        elecSub.push(`Meter: ${bill.prev_electricity_meter} to ${bill.curr_electricity_meter}`);
      }
      if (elecSub.length > 0) lines.push(`  └➤ ${elecSub.join(' | ')}`);
    }
    if (bill.water_amount > 0) {
      lines.push(`➤ Water: ${currency}${numFmt(bill.water_amount)}`);
      if (bill.water_billing_type === 'METER' && bill.water_units > 0) {
        let waterSub = [`${bill.water_units} units @ ${currency}${bill.water_rate || 0}`];
        if (bill.prev_water_meter !== undefined && bill.curr_water_meter !== undefined && bill.prev_water_meter !== null && bill.curr_water_meter !== null) {
          waterSub.push(`Meter: ${bill.prev_water_meter} to ${bill.curr_water_meter}`);
        }
        lines.push(`  └➤ ${waterSub.join(' | ')}`);
      }
    }
    if (bill.maintenance_amount > 0) {
      lines.push(`➤ Maintenance: ${currency}${numFmt(bill.maintenance_amount)}`);
    }
    if (bill.other_charges > 0) {
      lines.push(`➤ Other Charges: ${currency}${numFmt(bill.other_charges)}`);
      if (bill.other_charges_desc) {
        lines.push(`  └➤ ${bill.other_charges_desc}`);
      }
    }
    if (bill.discount_amount > 0) {
      lines.push(`➤ Concession: -${currency}${numFmt(bill.discount_amount)}`);
      if (bill.discount_reason) {
        lines.push(`  └➤ ${bill.discount_reason}`);
      }
    }
    if (bill.previous_balance > 0) {
      lines.push(`➤ Previous Balance: ${currency}${numFmt(bill.previous_balance)}`);
    }
    lines.push(`------------------------------------------`);
    lines.push(`TOTAL DUE: ${currency}${numFmt(bill.total_amount)}`);
    if (bill.paid_amount > 0) {
      lines.push(`  └➤ Paid: ${currency}${numFmt(bill.paid_amount)} | Balance Due: ${currency}${numFmt(balance)}`);
    }
    if (payDetails) {
      lines.push(payDetails);
    }
    if (!isPaid) {
      lines.push(`Share payment screenshot once paid.`);
    }
    lines.push(`Thank you! - RentBill`);
    return lines.join('\n');
  },

  // Primary share action:
  // Must execute immediately in synchronous user gesture thread for mobile browser permission
  shareBill(bill) {
    if (!bill) return;

    const title = `Rent Bill - ${bill.property_name} (${this.formatMonth(bill.billing_month)})`;
    // Default to rich formatted bill text for mobile share sheet & WhatsApp
    const defaultText = this.buildBillText(bill);
    const shareData = { title: title, text: defaultText };

    let canNativeShare = false;
    try {
      if (navigator.share) {
        if (typeof navigator.canShare === 'function') {
          canNativeShare = navigator.canShare(shareData);
        } else {
          canNativeShare = true;
        }
      }
    } catch {
      canNativeShare = false;
    }

    if (canNativeShare) {
      navigator.share(shareData)
        .then(() => {})
        .catch((err) => {
          if (err && err.name !== 'AbortError') {
            this.openFallbackShareModal(bill, defaultText);
          }
        });
      return;
    }

    // Fallback dialog
    this.openFallbackShareModal(bill, defaultText);
  },

  // Calculate real character, word, and SMS segment stats
  calculateTextStats(text) {
    const str = text || '';
    const chars = str.length;
    const words = str.trim() ? str.trim().split(/\s+/).length : 0;
    const smsParts = Math.max(1, Math.ceil(chars / 160));
    return { chars, words, smsParts };
  },

  // Format WhatsApp formatting markup (*bold*, _italics_, ~strike~, `code`) safely into HTML
  formatWhatsAppMarkup(text) {
    if (!text) return '';
    // 1. Escape HTML
    let safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 2. Code blocks (```code```)
    safe = safe.replace(/```([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.06); padding:4px 6px; border-radius:4px; font-family:monospace; margin:4px 0;"><code>$1</code></pre>');

    // 3. Inline code (`code`)
    safe = safe.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // 4. Bold: *text* (word/boundary sensitive)
    safe = safe.replace(/(^|[\s(])\*([^\s*][^*]*?[^\s*]|\S)\*([)\s.,!?:;]|$)/g, '$1<strong>$2</strong>$3');

    // 5. Italic: _text_
    safe = safe.replace(/(^|[\s(])_([^\s_][^_]*?[^\s_]|\S)_([)\s.,!?:;]|$)/g, '$1<em>$2</em>$3');

    // 6. Strikethrough: ~text~
    safe = safe.replace(/(^|[\s(])~([^\s~][^~]*?[^\s~]|\S)~([)\s.,!?:;]|$)/g, '$1<del>$2</del>$3');

    // 7. Auto-link URLs
    safe = safe.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

    return safe;
  },

  // Open the in-app Share Modal dialog
  openFallbackShareModal(bill, initialText) {
    const previewEl = document.getElementById('share-preview-text');
    const charCountEl = document.getElementById('share-char-count');

    const charRealEl = document.getElementById('share-char-count-real');
    const wordCountEl = document.getElementById('share-word-count');
    const smsPartsEl = document.getElementById('share-sms-parts');

    const btnViewWa = document.getElementById('btn-view-whatsapp');
    const btnViewRaw = document.getElementById('btn-view-raw');
    const waScreen = document.getElementById('share-whatsapp-screen');
    const rawContainer = document.getElementById('share-raw-container');

    const waNameEl = document.getElementById('share-wa-tenant-name');
    const waAvatarEl = document.getElementById('share-wa-avatar-char');
    const waBubbleEl = document.getElementById('share-wa-bubble-content');
    const waTimeEl = document.getElementById('share-wa-time');

    // Populate WhatsApp Chat Screen Header & Time
    const tenantName = (bill.tenant_name || 'Tenant').trim();
    if (waNameEl) waNameEl.textContent = tenantName;
    if (waAvatarEl) waAvatarEl.textContent = (tenantName[0] || 'T').toUpperCase();
    if (waTimeEl) {
      const now = new Date();
      waTimeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    // Toggle between WhatsApp View and Raw Text View
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
    setViewMode('whatsapp');

    let fullText = initialText || this.buildBillText(bill);

    const updateStatsDisplay = (text) => {
      const stats = this.calculateTextStats(text);
      if (charRealEl) charRealEl.innerHTML = `<strong>${stats.chars}</strong> chars`;
      if (wordCountEl) wordCountEl.innerHTML = `<strong>${stats.words}</strong> words`;
      if (smsPartsEl) smsPartsEl.innerHTML = `<strong>${stats.smsParts}</strong> SMS`;
      if (charCountEl) {
        charCountEl.textContent = `${stats.chars} chars`;
      }
    };

    const updateWhatsAppBubble = (text) => {
      if (waBubbleEl) {
        waBubbleEl.innerHTML = this.formatWhatsAppMarkup(text);
      }
    };

    const updatePreview = () => {
      if (previewEl) previewEl.value = fullText;
      updateStatsDisplay(fullText);
      updateWhatsAppBubble(fullText);
    };

    // Live typing updates both stats and WhatsApp chat bubble
    if (previewEl) {
      previewEl.oninput = () => {
        const val = previewEl.value;
        fullText = val;
        updateStatsDisplay(val);
        updateWhatsAppBubble(val);
      };
    }

    // Default to rich WhatsApp format
    updatePreview();

    const cleanPhone = (bill.tenant_phone || '').replace(/[^0-9]/g, '');

    // Bind SMS / RCS channel button: sends clean SMS text
    const btnSms = document.getElementById('btn-share-channel-sms');
    if (btnSms) {
      btnSms.onclick = () => {
        const text = currentFormat === 'sms' && previewEl ? previewEl.value : smsText;
        this.sendSmsRcsDirect(cleanPhone, text);
      };
    }

    // Bind WhatsApp channel button: sends rich WhatsApp text
    const btnWa = document.getElementById('btn-share-channel-wa');
    if (btnWa) {
      btnWa.onclick = () => {
        const text = currentFormat === 'full' && previewEl ? previewEl.value : fullText;
        this.sendWhatsAppDirect(cleanPhone, text);
      };
    }

    // Bind Email channel button
    const btnEmail = document.getElementById('btn-share-channel-email');
    if (btnEmail) {
      btnEmail.onclick = () => {
        const text = previewEl ? previewEl.value : fullText;
        const subject = `Rent Bill for ${bill.property_name} - ${this.formatMonth(bill.billing_month)}`;
        let email = bill.tenant_email || '';
        if (!email && window.App && Array.isArray(window.App.tenants)) {
          const t = window.App.tenants.find(item => item.id === bill.tenant_id);
          if (t && t.email) email = t.email;
        }
        this.sendEmailDirect(email, subject, text);
      };
    }

    // Bind Copy Text button
    const btnCopy = document.getElementById('btn-share-channel-copy');
    if (btnCopy) {
      btnCopy.onclick = async () => {
        const textToCopy = previewEl ? previewEl.value : (currentFormat === 'sms' ? smsText : fullText);
        try {
          if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(textToCopy);
          } else {
            previewEl.select();
            document.execCommand('copy');
          }
          if (window.App && typeof window.App.toast === 'function') {
            window.App.toast('Bill text copied to clipboard!');
          }
        } catch {
          previewEl.select();
          document.execCommand('copy');
          if (window.App && typeof window.App.toast === 'function') {
            window.App.toast('Copied to clipboard!');
          }
        }
      };
    }

    // Populate Dynamic UPI QR Preview Card if UPI is available
    const upiCard = document.getElementById('share-upi-card');
    const upiUri = this.buildUpiUri(bill);
    if (upiCard) {
      if (bill.payment_upi && upiUri) {
        upiCard.style.display = 'flex';
        const vpaEl = document.getElementById('share-upi-id-text');
        const amtEl = document.getElementById('share-upi-amount-text');
        const payBtn = document.getElementById('share-btn-upi-pay');
        const curr = window.APP_CURRENCY || '₹';
        const dueAmt = (bill.balance_amount !== undefined && bill.balance_amount !== null && bill.balance_amount > 0)
          ? bill.balance_amount
          : (bill.total_amount || 0);

        if (vpaEl) vpaEl.textContent = `UPI: ${bill.payment_upi}`;
        if (amtEl) amtEl.textContent = `Due: ${curr}${dueAmt.toFixed(2)}`;
        if (payBtn) payBtn.href = upiUri;

        this.renderUpiQrCode('share-upi-qrcode', upiUri, 64);
      } else {
        upiCard.style.display = 'none';
      }
    }

    // Display modal
    if (window.App && typeof window.App.openModal === 'function') {
      window.App.openModal('modal-share');
    } else {
      document.getElementById('modal-share')?.classList.add('active');
    }
    if (window.lucide) window.lucide.createIcons();
  },

  // Print invoice using browser print engine
  printInvoice() {
    setTimeout(() => {
      window.print();
    }, 30);
  },

  // Generate and download studio-grade HD receipt image (PNG) via Canvas
  async downloadReceiptImage(bill) {
    if (!bill) return;

    const curr = window.APP_CURRENCY || '₹';
    const numFmt = (n) => {
      const val = typeof n === 'number' ? n : (parseFloat(n) || 0);
      return val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    // Lookup tenant and property details for richer metadata
    const tenant = (window.App && Array.isArray(window.App.tenants))
      ? window.App.tenants.find(t => t.id === bill.tenant_id)
      : null;
    const property = (window.App && Array.isArray(window.App.properties))
      ? window.App.properties.find(p => p.id === bill.property_id)
      : null;

    const email = bill.tenant_email || (tenant && tenant.email) || '';
    const address = (property && property.address) ? property.address : '';
    let coOccupants = '';
    if (tenant && Array.isArray(tenant.co_occupants) && tenant.co_occupants.length > 0) {
      coOccupants = tenant.co_occupants.map(c => `${c.name}${c.phone ? ` (${c.phone})` : ''}`).join(', ');
    } else if (tenant && tenant.co_occupant_name) {
      coOccupants = `${tenant.co_occupant_name}${tenant.co_occupant_phone ? ` (${tenant.co_occupant_phone})` : ''}`;
    }

    const issueDate = bill.created_at ? (bill.created_at.split('T')[0] || bill.created_at.split(' ')[0]) : '';
    const status = bill.status || 'PENDING';

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = 2; // Retina 2x scale for ultra-crisp text
    // 16:9 vertical ratio (9:16 portrait ratio: 720 x 1280 -> 1440 x 2560 px output)
    const width = 720;
    const height = 1280;

    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // Cross-browser rounded rect helper
    function roundRect(c, x, y, w, h, r) {
      if (typeof c.roundRect === 'function') {
        c.beginPath();
        c.roundRect(x, y, w, h, r);
      } else {
        c.beginPath();
        c.moveTo(x + r, y);
        c.lineTo(x + w - r, y);
        c.quadraticCurveTo(x + w, y, x + w, y + r);
        c.lineTo(x + w, y + h - r);
        c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        c.lineTo(x + r, y + h);
        c.quadraticCurveTo(x, y + h, x, y + h - r);
        c.lineTo(x, y + r);
        c.quadraticCurveTo(x, y, x + r, y);
        c.closePath();
      }
    }

    // 1. Background (Pure clean canvas with no top border color)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Header Section
    let y = 48;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('RENT INVOICE / RECEIPT', 32, y);

    // Status Badge Pill
    const badgeColors = {
      PAID: { bg: '#dcfce7', text: '#15803d', border: '#86efac' },
      OVERDUE: { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5' },
      PENDING: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' }
    };
    const bColor = badgeColors[status] || badgeColors.PENDING;
    ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const textWidth = ctx.measureText(status).width;
    const badgeW = textWidth + 24;
    const badgeX = width - 32 - badgeW;

    ctx.fillStyle = bColor.bg;
    roundRect(ctx, badgeX, y - 18, badgeW, 26, 13);
    ctx.fill();
    ctx.strokeStyle = bColor.border;
    ctx.lineWidth = 1;
    roundRect(ctx, badgeX, y - 18, badgeW, 26, 13);
    ctx.stroke();

    ctx.fillStyle = bColor.text;
    ctx.textAlign = 'center';
    ctx.fillText(status, badgeX + badgeW / 2, y - 1);

    // Invoice Sub-headers
    y += 24;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Invoice #: ${bill.bill_number}`, 32, y);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Bill Date: ${issueDate}`, 32, y + 18);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Rent For: ${this.formatMonth(bill.billing_month)}`, width - 32, y);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Due Date: ${bill.due_date}`, width - 32, y + 18);

    // Section Divider
    y += 30;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, y);
    ctx.lineTo(width - 32, y);
    ctx.stroke();

    // 3. Parties Section (Billed To & Premises Card)
    y += 16;
    let partyH = 76;
    if (email) partyH += 18;
    if (coOccupants) partyH += 18;
    if (address) partyH += 18;

    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, 32, y, width - 64, partyH, 8);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    roundRect(ctx, 32, y, width - 64, partyH, 8);
    ctx.stroke();

    // Left Column: Tenant
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('BILLED TO (TENANT)', 48, y + 20);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(bill.tenant_name, 48, y + 38);

    ctx.fillStyle = '#334155';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Mobile: ${bill.tenant_phone}`, 48, y + 55);

    let curTenantY = y + 55;
    if (email) {
      curTenantY += 16;
      ctx.fillStyle = '#64748b';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Email: ${email}`, 48, curTenantY);
    }
    if (coOccupants) {
      curTenantY += 16;
      ctx.fillStyle = '#64748b';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Co-occupant(s): ${coOccupants}`, 48, curTenantY);
    }

    // Right Column: Property Unit
    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('RENTAL PREMISES', width - 48, y + 20);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(bill.property_name, width - 48, y + 38);

    if (address) {
      ctx.fillStyle = '#64748b';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(address, width - 48, y + 55);
    }

    y += partyH + 20;

    // 4. Itemized Table Header
    ctx.fillStyle = '#f1f5f9';
    roundRect(ctx, 32, y, width - 64, 32, 6);
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    roundRect(ctx, 32, y, width - 64, 32, 6);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('LINE ITEM / DESCRIPTION', 48, y + 20);
    ctx.fillText('DETAILS / READINGS', 290, y + 20);

    ctx.textAlign = 'right';
    ctx.fillText(`AMOUNT (${curr})`, width - 48, y + 20);
    y += 32;

    // Helper for table rows
    const drawItemRow = (title, detail, amountStr, isDiscount = false, isArrears = false) => {
      const rowHeight = detail ? 40 : 34;
      y += 4;

      ctx.textAlign = 'left';
      ctx.fillStyle = isDiscount ? '#16a34a' : (isArrears ? '#dc2626' : '#0f172a');
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(title, 48, y + 16);

      if (detail) {
        ctx.fillStyle = '#64748b';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(detail, 290, y + 16);
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = isDiscount ? '#16a34a' : (isArrears ? '#dc2626' : '#0f172a');
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(amountStr, width - 48, y + 16);

      y += rowHeight;
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(32, y);
      ctx.lineTo(width - 32, y);
      ctx.stroke();
    };

    // Draw line items
    drawItemRow('Base House Rent', `Rent for ${this.formatMonth(bill.billing_month)}`, `${curr}${numFmt(bill.base_rent)}`);

    if (bill.electricity_amount > 0) {
      drawItemRow(
        'Electricity Charges',
        `${bill.electricity_units} units @ ${curr}${bill.electricity_rate} (Meter: ${bill.prev_electricity_meter} to ${bill.curr_electricity_meter})`,
        `${curr}${numFmt(bill.electricity_amount)}`
      );
    }
    if (bill.water_amount > 0) {
      if (bill.water_billing_type === 'METER') {
        drawItemRow(
          'Water Charges',
          `${bill.water_units} units @ ${curr}${bill.water_rate} (Meter: ${bill.prev_water_meter} to ${bill.curr_water_meter})`,
          `${curr}${numFmt(bill.water_amount)}`
        );
      } else {
        drawItemRow('Water Charges', 'Fixed Monthly Charge', `${curr}${numFmt(bill.water_amount)}`);
      }
    }
    if (bill.maintenance_amount > 0) {
      drawItemRow('Maintenance Charges', 'Society & Maintenance', `${curr}${numFmt(bill.maintenance_amount)}`);
    }
    if (bill.other_charges > 0) {
      drawItemRow('Other Charges', bill.other_charges_desc || 'Adjustment', `${curr}${numFmt(bill.other_charges)}`);
    }
    if (bill.discount_amount > 0) {
      drawItemRow('Discount', bill.discount_reason || 'Concession', `-${curr}${numFmt(bill.discount_amount)}`, true, false);
    }
    if (bill.previous_balance > 0) {
      drawItemRow('Previous Arrears', 'Carried forward unpaid balance', `${curr}${numFmt(bill.previous_balance)}`, false, true);
    }

    // 5. Total Summary Card
    y += 16;
    const summaryCardH = bill.paid_amount > 0 ? 104 : 68;
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, 32, y, width - 64, summaryCardH, 8);
    ctx.fill();
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 32, y, width - 64, summaryCardH, 8);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('TOTAL AMOUNT DUE:', 48, y + 26);

    ctx.textAlign = 'right';
    ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${curr}${numFmt(bill.total_amount)}`, width - 48, y + 26);

    if (bill.paid_amount > 0) {
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(48, y + 42);
      ctx.lineTo(width - 48, y + 42);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.fillStyle = '#15803d';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Amount Paid: ${curr}${numFmt(bill.paid_amount)}`, 48, y + 68);

      ctx.textAlign = 'right';
      ctx.fillStyle = bill.balance_amount > 0 ? '#dc2626' : '#15803d';
      ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Balance Due: ${curr}${numFmt(bill.balance_amount)}`, width - 48, y + 68);
    }

    y += summaryCardH + 14;

    // 6. Amount in Words Box
    const wordsBoxH = (bill.paid_amount > 0 && bill.balance_amount > 0) ? 58 : 40;
    ctx.fillStyle = '#f8fafc';
    roundRect(ctx, 32, y, width - 64, wordsBoxH, 4);
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    roundRect(ctx, 32, y, width - 64, wordsBoxH, 4);
    ctx.stroke();

    // Accent line on left of words box
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(32, y, 4, wordsBoxH);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e293b';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Amount in Words: ${this.amountInWords(bill.total_amount)}`, 48, y + 24);

    if (bill.paid_amount > 0 && bill.balance_amount > 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Balance in Words: ${this.amountInWords(bill.balance_amount)}`, 48, y + 44);
    }

    y += wordsBoxH + 16;

    // 7. Payment Details (Pay To) Box with Dynamic UPI QR Code
    if (bill.payment_upi || bill.payment_bank_name) {
      const upiUri = this.buildUpiUri(bill, tenant);
      const qrCanvas = (bill.payment_upi && upiUri) ? this.getUpiQrCanvas(upiUri, 92) : null;
      const payBoxH = qrCanvas ? 116 : 76;

      ctx.fillStyle = '#f8fafc';
      roundRect(ctx, 32, y, width - 64, payBoxH, 6);
      ctx.fill();

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      roundRect(ctx, 32, y, width - 64, payBoxH, 6);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#1e40af';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('PAYMENT DETAILS (PAY TO):', 48, y + 20);

      ctx.fillStyle = '#0f172a';
      if (bill.payment_upi) {
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(`UPI ID: ${bill.payment_upi}`, 48, y + 40);
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText('Accepted: GPay • PhonePe • Paytm • BHIM', 48, y + 58);
      }
      ctx.fillStyle = '#0f172a';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      if (bill.payment_bank_name) ctx.fillText(`Bank: ${bill.payment_bank_name}`, 48, y + (qrCanvas ? 76 : 60));
      if (bill.payment_account_no) ctx.fillText(`A/C: ${bill.payment_account_no}`, qrCanvas ? 48 : 360, y + (qrCanvas ? 94 : 42));
      if (bill.payment_ifsc) ctx.fillText(`IFSC: ${bill.payment_ifsc}`, qrCanvas ? 260 : 360, y + (qrCanvas ? 94 : 60));

      // Draw scannable UPI QR Code Card on the right
      if (qrCanvas) {
        const qrCardX = width - 32 - 110;
        const qrCardY = y + 10;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, qrCardX, qrCardY, 96, 96, 6);
        ctx.fill();
        ctx.strokeStyle = '#cbd5e1';
        ctx.lineWidth = 1;
        roundRect(ctx, qrCardX, qrCardY, 96, 96, 6);
        ctx.stroke();

        ctx.drawImage(qrCanvas, qrCardX + 8, qrCardY + 6, 80, 80);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('SCAN TO PAY', qrCardX + 48, qrCardY + 91);
      }

      y += payBoxH + 16;
    }

    // 8. Payment Confirmation Notice for Unpaid Bills
    if (status !== 'PAID') {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#0284c7';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('📌 Share payment screenshot once paid.', 32, y + 16);
      y += 20;
    }

    // 9. Notes
    if (bill.notes) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = 'italic 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Note: ${bill.notes}`, 32, y + 16);
    }

    // 9. Footer Notice (Anchored at the bottom of the 16:9 vertical canvas)
    const footerY = height - 36;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(32, footerY - 18);
    ctx.lineTo(width - 32, footerY - 18);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('This is a computer-generated invoice/receipt. Valid without physical signature.', 32, footerY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Generated via RentBill', width - 32, footerY);

    // 10. Download as PNG
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed creating image blob'));
          return;
        }
        try {
          const fileName = `Receipt-${bill.bill_number}-${bill.billing_month}.png`;
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = fileName;
          link.href = url;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 1000);

          if (window.App && typeof window.App.toast === 'function') {
            window.App.toast('Receipt image saved to your device!');
          }
          resolve(true);
        } catch (e) {
          reject(e);
        }
      }, 'image/png');
    });
  },

  // Universal Multi-Channel Reminder Message Builders (SMS/RCS, WhatsApp, Email)
  buildReminderMessage(type, bill, tenant, channel = 'sms_rcs') {
    const curr = window.APP_CURRENCY || '₹';
    const appName = window.APP_NAME || 'RentBill';
    const numFmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })));
    const pad = (str, len) => {
      const s = String(str ?? '');
      return s.length >= len ? s : s + ' '.repeat(len - s.length);
    };

    const tenantName = ((tenant && tenant.name) || (bill && bill.tenant_name) || 'Tenant').trim();
    const propName = ((tenant && tenant.property_name) || (bill && bill.property_name) || 'Rental Premises').trim();
    const billNum = bill ? (bill.bill_number || '') : '';
    const month = this.formatMonth((bill && bill.billing_month) || '');
    const dueFormatted = this.formatDate(bill ? bill.due_date : '');
    const divider = '------------------------------------------';

    const totalNum = bill ? Number(bill.total_amount || 0) : (tenant && tenant.rent_amount ? Number(tenant.rent_amount) : 0);
    const paidNum = bill ? Number(bill.paid_amount || 0) : 0;
    const balanceNum = bill
      ? ((bill.balance_amount !== undefined && bill.balance_amount !== null) ? Number(bill.balance_amount) : Math.max(0, totalNum - paidNum))
      : totalNum;

    const totalStr = `${curr}${numFmt(totalNum)}`;
    const balanceStr = `${curr}${numFmt(balanceNum)}`;
    const paidStr = `${curr}${numFmt(paidNum)}`;

    const upi = (bill && bill.payment_upi) || (tenant && tenant.payment_upi) || '';
    const bank = (bill && bill.payment_bank_name) || (tenant && tenant.payment_bank_name) || '';
    const acc = (bill && bill.payment_account_no) || (tenant && tenant.payment_account_no) || '';
    const ifsc = (bill && bill.payment_ifsc) || (tenant && tenant.payment_ifsc) || '';

    // Direct UPI intent payment link
    let upiPayLink = '';
    if (upi) {
      const payAmt = balanceNum > 0 ? balanceNum.toFixed(2) : totalNum.toFixed(2);
      const note = encodeURIComponent(`Rent ${month} ${propName}`.trim());
      const payee = encodeURIComponent(propName || 'RentBill');
      upiPayLink = `upi://pay?pa=${encodeURIComponent(upi)}&pn=${payee}&am=${payAmt}&cu=INR&tn=${note}`;
    }

    // --- Build itemized charge lines ---
    const charges = [];
    if (bill) {
      if (bill.base_rent > 0) {
        charges.push({ name: 'Base Rent', amount: bill.base_rent, detail: '' });
      }
      if (bill.electricity_amount > 0 || bill.electricity_units > 0) {
        let elecDetail = `${bill.electricity_units || 0} units @ ${curr}${bill.electricity_rate || 0}/unit`;
        if (bill.prev_electricity_meter !== undefined && bill.curr_electricity_meter !== undefined && bill.prev_electricity_meter !== null && bill.curr_electricity_meter !== null) {
          elecDetail += ` (Meter: ${bill.prev_electricity_meter} to ${bill.curr_electricity_meter})`;
        }
        charges.push({ name: 'Electricity', amount: bill.electricity_amount || 0, detail: elecDetail });
      }
      if (bill.water_amount > 0) {
        let waterDetail = '';
        if (bill.water_billing_type === 'METER' && bill.water_units > 0) {
          waterDetail = `${bill.water_units} units @ ${curr}${bill.water_rate || 0}/unit`;
          if (bill.prev_water_meter !== undefined && bill.curr_water_meter !== undefined && bill.prev_water_meter !== null && bill.curr_water_meter !== null) {
            waterDetail += ` (Meter: ${bill.prev_water_meter} to ${bill.curr_water_meter})`;
          }
        }
        charges.push({ name: 'Water', amount: bill.water_amount, detail: waterDetail });
      }
      if (bill.maintenance_amount > 0) {
        charges.push({ name: 'Maintenance', amount: bill.maintenance_amount, detail: '' });
      }
      if (bill.other_charges > 0) {
        charges.push({ name: bill.other_charges_desc || 'Other Charges', amount: bill.other_charges, detail: '' });
      }
      if (bill.previous_balance > 0) {
        charges.push({ name: 'Previous Arrears', amount: bill.previous_balance, detail: '' });
      }
      if (bill.discount_amount > 0) {
        charges.push({ name: `Discount (${bill.discount_reason || 'Concession'})`, amount: -bill.discount_amount, detail: '', isDiscount: true });
      }
    }

    // Notice Titles & Statuses
    let noticeTitle = 'RENT PAYMENT NOTICE';
    let statusText = 'PENDING';
    let dueLabel = dueFormatted;

    if (type === 'due_today') {
      noticeTitle = 'RENT PAYMENT DUE TODAY';
      statusText = 'DUE TODAY';
      dueLabel = `TODAY (${dueFormatted})`;
    } else if (type === 'overdue') {
      noticeTitle = 'URGENT: OVERDUE PAYMENT NOTICE';
      statusText = 'OVERDUE';
      dueLabel = `${dueFormatted} (OVERDUE)`;
    } else if (type === 'receipt') {
      noticeTitle = 'PAYMENT RECEIPT & ACKNOWLEDGMENT';
      statusText = balanceNum > 0 ? 'PARTIAL PAYMENT' : 'PAID IN FULL';
    }

    // 1. SMS / RCS Channel (Concise & Standard GSM segment friendly)
    if (channel === 'sms_rcs') {
      let bdownSms = '';
      if (charges.length > 0) {
        const parts = charges.map(c => `${c.name}: ${curr}${Math.round(c.amount)}`);
        bdownSms = ` [${parts.join(', ')} | Total: ${totalStr}${paidNum > 0 ? `, Paid: ${paidStr}` : ''}, Bal: ${balanceStr}]`;
      }
      let paySms = '';
      if (upi) {
        paySms = ` Pay via UPI: ${upi}${upiPayLink ? ` (${upiPayLink})` : ''}`;
      } else if (bank) {
        paySms = ` Pay via Bank: ${bank} A/C: ${acc} IFSC: ${ifsc}`;
      }

      switch (type) {
        case 'due_today':
          return `${appName}: Hi ${tenantName}, rent for ${propName} (${month}) of ${balanceStr} is DUE TODAY (${dueFormatted}).${bdownSms}${paySms}. Kindly transfer today and share confirmation. Thank you!`;
        case 'overdue':
          return `URGENT NOTICE: Hi ${tenantName}, rent of ${balanceStr} for ${propName} (${month}) was due on ${dueFormatted} and is OVERDUE.${bdownSms}${paySms}. Please clear dues immediately. Thank you - ${appName}`;
        case 'receipt':
          return `${appName}: Hi ${tenantName}, payment received for ${propName} (${month}). Total: ${totalStr}, Paid: ${paidStr}, Balance: ${balanceStr}.${balanceNum > 0 ? paySms : ''} Thank you!`;
        case 'gentle':
        default:
          return `${appName}: Hi ${tenantName}, rent notice for ${propName} (${month}) of ${balanceStr} is due on ${dueFormatted}.${bdownSms}${paySms}. Kindly share confirmation once paid. Thank you!`;
      }
    }

    // 2. Email Channel (Clean Plain Text with Aligned Columns)
    if (channel === 'email') {
      const lines = [
        noticeTitle,
        divider,
      ];

      if (billNum) lines.push(`${pad('Invoice No:', 15)}#${billNum}`);
      if (month) lines.push(`${pad('Rent For:', 15)}${month}`);
      if (dueFormatted !== 'N/A') lines.push(`${pad('Due Date:', 15)}${dueLabel}`);
      lines.push(`${pad('Notice Status:', 15)}${statusText}`);
      lines.push(divider);

      lines.push('TENANT & PREMISES:');
      lines.push(`${pad('Tenant Name:', 15)}${tenantName}`);
      lines.push(`${pad('Property/Unit:', 15)}${propName}`);
      lines.push(divider);

      if (charges.length > 0) {
        lines.push('ITEMIZED CHARGES:');
        charges.forEach(c => {
          const sign = c.isDiscount ? '-' : '';
          lines.push(`➤ ${pad(c.name + ':', 21)}${sign}${curr}${numFmt(Math.abs(c.amount))}`);
          if (c.detail) {
            lines.push(`  └➤ ${c.detail}`);
          }
        });
        lines.push(divider);
      }

      if (type === 'receipt') {
        lines.push('PAYMENT SUMMARY:');
        lines.push(`${pad('Total Billed:', 21)}${totalStr}`);
        lines.push(`${pad('Amount Paid:', 21)}${paidStr}`);
        lines.push(`${pad('Balance Remaining:', 21)}${balanceStr}`);
      } else {
        lines.push(`${pad('TOTAL BILLED:', 21)}${totalStr}`);
        if (paidNum > 0) lines.push(`${pad('Amount Paid:', 21)}${paidStr}`);
        lines.push(`${pad('BALANCE DUE:', 21)}${balanceStr}`);
      }
      lines.push(divider);

      if ((upi || bank) && (type !== 'receipt' || balanceNum > 0)) {
        lines.push('PAYMENT METHODS:');
        if (upi) {
          lines.push('➤ UPI Payment:');
          lines.push(`  └➤ ${pad('UPI ID:', 13)}${upi}`);
          if (upiPayLink) lines.push(`  └➤ ${pad('Pay Link:', 13)}${upiPayLink}`);
        }
        if (bank) {
          lines.push('➤ Bank Transfer:');
          lines.push(`  └➤ ${pad('Bank:', 13)}${bank}`);
          if (acc) lines.push(`  └➤ ${pad('A/C No:', 13)}${acc}`);
          if (ifsc) lines.push(`  └➤ ${pad('IFSC:', 13)}${ifsc}`);
        }
        lines.push(divider);
      }

      let emailClosing = '';
      if (type === 'due_today') {
        emailClosing = `Dear ${tenantName},\n\nThis is a friendly reminder that your rent payment for ${propName} (${month}) is due today. Kindly transfer via UPI or direct bank transfer and share the payment confirmation or reference number.\n\nThank you,\n${appName} Management`;
      } else if (type === 'overdue') {
        emailClosing = `Action Required: Dear ${tenantName},\n\nYour rent payment of ${balanceStr} for ${propName} (${month}) is past due. Please settle the outstanding balance immediately using the payment options above to avoid disruption or late charges. If already paid, kindly reply with the transaction reference.\n\nThank you,\n${appName} Management`;
      } else if (type === 'receipt') {
        emailClosing = balanceNum > 0
          ? `Dear ${tenantName},\n\nWe acknowledge with thanks receipt of your payment of ${paidStr} for ${propName} (${month}). The remaining balance of ${balanceStr} is due on ${dueFormatted}.\n\nWarm regards,\n${appName} Management`
          : `Dear ${tenantName},\n\nWe acknowledge with thanks receipt of your payment of ${paidStr} for ${propName} (${month}). Your account is fully settled.\n\nWarm regards,\n${appName} Management`;
      } else {
        emailClosing = `Dear ${tenantName},\n\nThis is a friendly payment notice regarding your premises at ${propName} for ${month}. Kindly clear the balance on or before ${dueFormatted} and reply with the payment confirmation.\n\nThank you,\n${appName} Management`;
      }

      lines.push(emailClosing);
      return lines.join('\n');
    }

    // 3. Default: WhatsApp Channel (Structured, Aligned, Clean Rich Formatting)
    const lines = [
      `*${noticeTitle}*`,
      divider,
    ];

    if (billNum) lines.push(`${pad('*Invoice No:*', 17)}#${billNum}`);
    if (month) lines.push(`${pad('*Rent For:*', 17)}${month}`);
    if (dueFormatted !== 'N/A') lines.push(`${pad('*Due Date:*', 17)}${dueLabel}`);
    lines.push(`${pad('*Notice Status:*', 17)}${statusText}`);
    lines.push(divider);

    lines.push('*TENANT & PREMISES:*');
    lines.push(`${pad('*Tenant Name:*', 17)}${tenantName}`);
    lines.push(`${pad('*Property/Unit:*', 17)}${propName}`);
    lines.push(divider);

    if (charges.length > 0) {
      lines.push('*ITEMIZED CHARGES:*');
      charges.forEach(c => {
        const sign = c.isDiscount ? '-' : '';
        lines.push(`➤ ${pad('*' + c.name + ':*', 21)}${sign}${curr}${numFmt(Math.abs(c.amount))}`);
        if (c.detail) {
          lines.push(`  └➤ _${c.detail}_`);
        }
      });
      lines.push(divider);
    }

    if (type === 'receipt') {
      lines.push('*PAYMENT SUMMARY:*');
      lines.push(`${pad('*Total Billed:*', 23)}${totalStr}`);
      lines.push(`${pad('*Amount Paid:*', 23)}${paidStr}`);
      lines.push(`${pad('*Balance Remaining:*', 23)}*${balanceStr}*`);
    } else {
      lines.push(`${pad('*TOTAL BILLED:*', 23)}${totalStr}`);
      if (paidNum > 0) lines.push(`${pad('*Amount Paid:*', 23)}${paidStr}`);
      lines.push(`${pad('*BALANCE DUE:*', 23)}*${balanceStr}*`);
    }
    lines.push(divider);

    if ((upi || bank) && (type !== 'receipt' || balanceNum > 0)) {
      lines.push('*PAYMENT METHODS:*');
      if (upi) {
        lines.push('➤ *UPI Payment:*');
        lines.push(`  └➤ ${pad('*UPI ID:*', 14)}\`${upi}\``);
        if (upiPayLink) lines.push(`  └➤ ${pad('*Pay Link:*', 14)}${upiPayLink}`);
      }
      if (bank) {
        lines.push('➤ *Bank Transfer:*');
        lines.push(`  └➤ ${pad('*Bank:*', 14)}${bank}`);
        if (acc) lines.push(`  └➤ ${pad('*A/C No:*', 14)}\`${acc}\``);
        if (ifsc) lines.push(`  └➤ ${pad('*IFSC:*', 14)}\`${ifsc}\``);
      }
      lines.push(divider);
    }

    let waClosing = '';
    if (type === 'due_today') {
      waClosing = `Dear ${tenantName}, friendly reminder that your rent payment for *${propName}* (${month}) is due today. Kindly transfer via UPI or bank transfer and share the payment confirmation screenshot.\n\nThank you!\n- *${appName} Management*`;
    } else if (type === 'overdue') {
      waClosing = `*Action Required:* Dear ${tenantName}, your rent payment of *${balanceStr}* for *${propName}* (${month}) is overdue. Please settle the balance immediately using the payment options above to avoid disruption or late charges. If already paid, kindly reply with the transaction reference.\n\nThank you!\n- *${appName} Management*`;
    } else if (type === 'receipt') {
      waClosing = balanceNum > 0
        ? `Dear ${tenantName}, thank you for your payment of *${paidStr}*. The remaining balance of *${balanceStr}* is due on *${dueFormatted}*.\n\nWarm regards,\n- *${appName} Management*`
        : `Dear ${tenantName}, thank you! We have received your payment of *${paidStr}* for *${propName}* (${month}). Your rent is fully settled.\n\nWarm regards,\n- *${appName} Management*`;
    } else {
      waClosing = `Dear ${tenantName}, this is a friendly reminder to clear your rent for *${propName}* (${month}) on or before *${dueFormatted}*. Once transferred, kindly share the payment confirmation screenshot.\n\nThank you!\n- *${appName} Management*`;
    }

    lines.push(waClosing);
    return lines.join('\n');
  },

  // Open native mobile SMS / RCS Messages app directly
  sendSmsRcsDirect(phone, text) {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(text);
    // iOS Messages prefers '&body=', Android prefers '?body='
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const sep = isIOS ? '&' : '?';
    const smsUrl = cleanPhone ? `sms:${cleanPhone}${sep}body=${encoded}` : `sms:${sep}body=${encoded}`;
    window.location.href = smsUrl;
  },

  // Open native Email client
  sendEmailDirect(email, subject, text) {
    const mailto = `mailto:${email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    window.location.href = mailto;
  },

  // Open WhatsApp directly with phone and text
  sendWhatsAppDirect(phone, text) {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone;
    const encoded = encodeURIComponent(text);
    const url = phoneWithCountry
      ? `https://api.whatsapp.com/send?phone=${phoneWithCountry}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  },

  // Format tenant ledger statement as clean text
  formatLedgerStatementText(ledger) {
    const curr = window.APP_CURRENCY || '₹';
    const t = ledger.tenant;
    const lines = [
      `TENANT FINANCIAL STATEMENT`,
      `---------------------------------`,
      `Tenant: ${t.name}`,
      `Phone: ${t.phone || 'N/A'}`,
      `Property: ${t.property_name || 'N/A'}`,
      `Statement Date: ${new Date().toLocaleDateString('en-IN')}`,
      `---------------------------------`,
      `Total Invoiced: ${curr}${ledger.total_billed.toFixed(2)}`,
      `Total Received: ${curr}${ledger.total_paid.toFixed(2)}`,
      `CURRENT BALANCE: ${curr}${ledger.current_balance.toFixed(2)}`,
      `---------------------------------`,
      `TRANSACTION HISTORY:`,
    ];

    (ledger.entries || []).forEach(e => {
      if (e.type === 'BILL') {
        lines.push(`➤ [${e.date}] ${e.description} | Invoiced: ${curr}${e.debit.toFixed(2)} | Balance: ${curr}${e.running_balance.toFixed(2)}`);
      } else {
        lines.push(`➤ [${e.date}] ${e.description} | Paid: ${curr}${e.credit.toFixed(2)} | Balance: ${curr}${e.running_balance.toFixed(2)}`);
      }
    });

    lines.push(`---------------------------------`);
    lines.push(`Generated by RentBill`);
    return lines.join('\n');
  },

  // Share tenant financial statement via Native Share, WhatsApp, or Clipboard
  async shareStatement(ledger, tenant) {
    if (!ledger) {
      if (window.App && window.App.showToast) {
        window.App.showToast('Statement details are not available yet', 'warning');
      }
      return;
    }

    const t = tenant || ledger.tenant || {};
    const text = this.formatLedgerStatementText(ledger);
    const title = `Tenant Statement - ${t.name || 'Tenant'}`;
    const shareData = { title: title, text: text };

    let canNativeShare = false;
    try {
      if (navigator.share) {
        if (typeof navigator.canShare === 'function') {
          canNativeShare = navigator.canShare(shareData);
        } else {
          canNativeShare = true;
        }
      }
    } catch {
      canNativeShare = false;
    }

    if (canNativeShare) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // User closed share sheet
      }
    }

    // Direct WhatsApp share if phone number exists
    if (t.phone) {
      this.sendWhatsAppDirect(t.phone, text);
    } else {
      // Copy to clipboard fallback
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          if (window.App && window.App.showToast) {
            window.App.showToast('Statement copied to clipboard!', 'success');
          }
        } else {
          window.prompt('Copy statement below:', text);
        }
      } catch {
        window.prompt('Copy statement below:', text);
      }
    }
  }
};
