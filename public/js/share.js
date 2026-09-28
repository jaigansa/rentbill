// Share and Invoice formatting utilities with robust Mobile Share & in-app fallback

const Share = {
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

  // Format the full bill breakdown text (Rich WhatsApp / detailed format)
  buildBillText(bill) {
    const currency = window.APP_CURRENCY || '₹';
    const numFmt = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : (n || '0.00'));

    const lines = [
      `🏠 *RENT & UTILITY INVOICE*`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📄 *Bill No:* #${bill.bill_number}`,
      `👤 *Tenant:* ${bill.tenant_name}`,
      `🏢 *Unit:* ${bill.property_name}`,
      `📅 *Month:* ${bill.billing_month}`,
      `⏰ *Due Date:* ${bill.due_date}`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      `📋 *CHARGES BREAKDOWN:*`,
      `▫️ *Base Rent:* ${currency}${numFmt(bill.base_rent)}`,
    ];

    if (bill.electricity_units > 0 || bill.electricity_amount > 0) {
      let elecLine = `▫️ *Electricity:* ${bill.electricity_units} units @ ${currency}${bill.electricity_rate} = ${currency}${numFmt(bill.electricity_amount)}`;
      if (bill.prev_electricity_meter !== undefined && bill.curr_electricity_meter !== undefined) {
        elecLine += `\n   ↳ _Meter: ${bill.prev_electricity_meter} ➔ ${bill.curr_electricity_meter}_`;
      }
      lines.push(elecLine);
    }

    if (bill.water_amount > 0) {
      if (bill.water_billing_type === 'METER' && bill.water_units > 0) {
        lines.push(
          `▫️ *Water (Metered):* ${bill.water_units} units @ ${currency}${bill.water_rate} = ${currency}${numFmt(bill.water_amount)}\n` +
          `   ↳ _Meter: ${bill.prev_water_meter} ➔ ${bill.curr_water_meter}_`
        );
      } else {
        lines.push(`▫️ *Water (Fixed):* ${currency}${numFmt(bill.water_amount)}`);
      }
    }

    if (bill.maintenance_amount > 0) {
      lines.push(`▫️ *Maintenance:* ${currency}${numFmt(bill.maintenance_amount)}`);
    }

    if (bill.other_charges > 0) {
      lines.push(`▫️ *Other Charges (${bill.other_charges_desc || 'Adjustment'}):* ${currency}${numFmt(bill.other_charges)}`);
    }

    if (bill.discount_amount > 0) {
      lines.push(`▫️ *Discount (${bill.discount_reason || 'Concession'}):* -${currency}${numFmt(bill.discount_amount)}`);
    }

    if (bill.previous_balance > 0) {
      lines.push(`▫️ *Previous Arrears:* ${currency}${numFmt(bill.previous_balance)}`);
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`💰 *TOTAL DUE: ${currency}${numFmt(bill.total_amount)}*`);
    lines.push(`📝 *In Words:* _${this.amountInWords(bill.total_amount)}_`);

    const balance = (bill.balance_amount !== undefined && bill.balance_amount !== null)
      ? bill.balance_amount
      : (bill.total_amount - (bill.paid_amount || 0));

    if (bill.paid_amount > 0) {
      lines.push(`✅ *Paid Amount:* ${currency}${numFmt(bill.paid_amount)}`);
      lines.push(`⚠️ *Balance Due: ${currency}${numFmt(balance)}*`);
      if (balance > 0) {
        lines.push(`📝 *Balance in Words:* _${this.amountInWords(balance)}_`);
      }
    }

    if (bill.payment_upi || bill.payment_bank_name) {
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`💳 *PAYMENT DETAILS (PAY TO):*`);
      if (bill.payment_upi) lines.push(`▫️ *UPI ID:* \`${bill.payment_upi}\``);
      if (bill.payment_bank_name) lines.push(`▫️ *Bank:* ${bill.payment_bank_name}`);
      if (bill.payment_account_no) lines.push(`▫️ *A/C No:* \`${bill.payment_account_no}\``);
      if (bill.payment_ifsc) lines.push(`▫️ *IFSC:* \`${bill.payment_ifsc}\``);
    }

    if (bill.notes) {
      lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      lines.push(`📌 *Note:* ${bill.notes}`);
    }

    lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`_Generated via RentBill_`);

    return lines.join('\n');
  },

  // Format concise SMS / RCS bill notice (fits mobile text messages, zero messy asterisks)
  buildSmsRcsBillText(bill, isCompact = false) {
    const currency = window.APP_CURRENCY || '₹';
    const numFmt = (n) => (typeof n === 'number' ? n.toFixed(2) : (n || '0.00'));
    const due = bill.due_date || '';
    const balance = (bill.balance_amount !== undefined && bill.balance_amount !== null)
      ? bill.balance_amount
      : (bill.total_amount - (bill.paid_amount || 0));

    let payDetails = '';
    if (bill.payment_upi) {
      payDetails = `Pay via UPI: ${bill.payment_upi}`;
    } else if (bill.payment_bank_name) {
      payDetails = `Pay to Bank: ${bill.payment_bank_name} (A/C: ${bill.payment_account_no || ''}, IFSC: ${bill.payment_ifsc || ''})`;
    }

    if (isCompact) {
      let msg = `RentBill: Hi ${bill.tenant_name}, rent bill for ${bill.property_name} (${bill.billing_month}) is ${currency}${numFmt(bill.total_amount)}. Due: ${due}.`;
      if (balance > 0 && balance !== bill.total_amount) {
        msg += ` Due Bal: ${currency}${numFmt(balance)}.`;
      }
      if (payDetails) msg += ` ${payDetails}.`;
      msg += ` Thank you!`;
      return msg;
    }

    const lines = [
      `RENT NOTICE (${bill.billing_month})`,
      `Tenant: ${bill.tenant_name}`,
      `Unit: ${bill.property_name}`,
      `Bill #: ${bill.bill_number}`,
      `Due Date: ${due}`,
      `-----------------------------`,
      `Base Rent: ${currency}${numFmt(bill.base_rent)}`,
    ];

    if (bill.electricity_amount > 0) {
      lines.push(`Electricity: ${bill.electricity_units} units = ${currency}${numFmt(bill.electricity_amount)}`);
    }
    if (bill.water_amount > 0) {
      lines.push(`Water: ${currency}${numFmt(bill.water_amount)}`);
    }
    if (bill.maintenance_amount > 0) {
      lines.push(`Maintenance: ${currency}${numFmt(bill.maintenance_amount)}`);
    }
    if (bill.other_charges > 0) {
      lines.push(`Other Charges: ${currency}${numFmt(bill.other_charges)}`);
    }
    if (bill.discount_amount > 0) {
      lines.push(`Discount: -${currency}${numFmt(bill.discount_amount)}`);
    }
    if (bill.previous_balance > 0) {
      lines.push(`Previous Due: ${currency}${numFmt(bill.previous_balance)}`);
    }
    lines.push(`-----------------------------`);
    lines.push(`TOTAL DUE: ${currency}${numFmt(bill.total_amount)}`);
    if (bill.paid_amount > 0) {
      lines.push(`Paid: ${currency}${numFmt(bill.paid_amount)} | Balance: ${currency}${numFmt(balance)}`);
    }
    if (payDetails) {
      lines.push(payDetails);
    }
    lines.push(`Thank you! - RentBill`);
    return lines.join('\n');
  },

  // Primary share action:
  // Must execute immediately in synchronous user gesture thread for mobile browser permission
  shareBill(bill) {
    if (!bill) return;

    const title = `Rent Bill - ${bill.property_name} (${bill.billing_month})`;
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
    } catch (e) {
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

  // Open the in-app Share Modal dialog
  openFallbackShareModal(bill, initialText) {
    const previewEl = document.getElementById('share-preview-text');
    const charCountEl = document.getElementById('share-char-count');
    const btnFmtSms = document.getElementById('btn-share-fmt-sms');
    const btnFmtFull = document.getElementById('btn-share-fmt-full');

    let currentFormat = 'full'; // 'full' (WhatsApp) or 'sms'
    const fullText = this.buildBillText(bill);
    const smsText = this.buildSmsRcsBillText(bill, false);

    const updatePreview = (fmt) => {
      currentFormat = fmt;
      const activeText = fmt === 'sms' ? smsText : fullText;
      if (previewEl) previewEl.value = activeText;
      if (charCountEl) {
        const chars = activeText.length;
        const smsParts = Math.ceil(chars / 160);
        charCountEl.textContent = fmt === 'sms'
          ? `${chars} chars (${smsParts} SMS / RCS message)`
          : `${chars} chars`;
      }
      if (btnFmtSms) {
        if (fmt === 'sms') btnFmtSms.classList.add('active');
        else btnFmtSms.classList.remove('active');
      }
      if (btnFmtFull) {
        if (fmt === 'full') btnFmtFull.classList.add('active');
        else btnFmtFull.classList.remove('active');
      }
    };

    if (btnFmtSms) btnFmtSms.onclick = () => updatePreview('sms');
    if (btnFmtFull) btnFmtFull.onclick = () => updatePreview('full');

    // Default to rich WhatsApp format
    updatePreview('full');

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
        const subject = `Rent Bill for ${bill.property_name} - ${bill.billing_month}`;
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
        } catch (e) {
          previewEl.select();
          document.execCommand('copy');
          if (window.App && typeof window.App.toast === 'function') {
            window.App.toast('Copied to clipboard!');
          }
        }
      };
    }

    // Display modal
    if (window.App && typeof window.App.openModal === 'function') {
      window.App.openModal('modal-share');
    } else {
      document.getElementById('modal-share')?.classList.add('active');
    }
  },

  // Print invoice using browser print engine
  printInvoice() {
    window.print();
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
    ctx.fillText(`Date: ${issueDate}`, 32, y + 18);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`Billing Month: ${bill.billing_month}`, width - 32, y);

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
    drawItemRow('Base House Rent', `Rent for ${bill.billing_month}`, `${curr}${numFmt(bill.base_rent)}`);

    if (bill.electricity_amount > 0) {
      drawItemRow(
        'Electricity Charges',
        `${bill.electricity_units} units @ ${curr}${bill.electricity_rate} (Meter: ${bill.prev_electricity_meter} ➔ ${bill.curr_electricity_meter})`,
        `${curr}${numFmt(bill.electricity_amount)}`
      );
    }
    if (bill.water_amount > 0) {
      if (bill.water_billing_type === 'METER') {
        drawItemRow(
          'Water Charges',
          `${bill.water_units} units @ ${curr}${bill.water_rate} (Meter: ${bill.prev_water_meter} ➔ ${bill.curr_water_meter})`,
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

    // 7. Payment Details (Pay To) Box
    if (bill.payment_upi || bill.payment_bank_name) {
      ctx.fillStyle = '#f8fafc';
      roundRect(ctx, 32, y, width - 64, 76, 6);
      ctx.fill();

      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      roundRect(ctx, 32, y, width - 64, 76, 6);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.textAlign = 'left';
      ctx.fillStyle = '#1e40af';
      ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('PAYMENT DETAILS (PAY TO):', 48, y + 22);

      ctx.fillStyle = '#0f172a';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      if (bill.payment_upi) ctx.fillText(`UPI ID: ${bill.payment_upi}`, 48, y + 42);
      if (bill.payment_bank_name) ctx.fillText(`Bank: ${bill.payment_bank_name}`, 48, y + 60);
      if (bill.payment_account_no) ctx.fillText(`A/C: ${bill.payment_account_no}`, 360, y + 42);
      if (bill.payment_ifsc) ctx.fillText(`IFSC: ${bill.payment_ifsc}`, 360, y + 60);

      y += 92;
    }

    // 8. Notes
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
    const tenantName = (tenant && tenant.name) || (bill && bill.tenant_name) || 'Tenant';
    const propName = (tenant && tenant.property_name) || (bill && bill.property_name) || 'Rental Unit';
    const billNum = bill ? bill.bill_number : '';
    const month = bill ? bill.billing_month : '';
    const due = bill ? bill.due_date : '';
    const total = bill ? `${curr}${bill.total_amount.toFixed(2)}` : '';
    const balance = bill ? `${curr}${(bill.balance_amount || bill.total_amount).toFixed(2)}` : '';
    const upi = (bill && bill.payment_upi) || (tenant && tenant.payment_upi) || '';
    const bank = (bill && bill.payment_bank_name) || (tenant && tenant.payment_bank_name) || '';

    let payDetailsWa = '';
    if (upi) payDetailsWa += `\n*UPI ID:* ${upi}`;
    if (bank) payDetailsWa += `\n*Bank:* ${bank} (A/C: ${bill ? bill.payment_account_no : tenant.payment_account_no || ''}, IFSC: ${bill ? bill.payment_ifsc : tenant.payment_ifsc || ''})`;

    let payDetailsSms = '';
    if (upi) payDetailsSms = `Pay via UPI: ${upi}`;
    else if (bank) payDetailsSms = `Pay to Bank: ${bank} (${bill ? bill.payment_account_no : tenant.payment_account_no || ''}, IFSC: ${bill ? bill.payment_ifsc : tenant.payment_ifsc || ''})`;

    if (channel === 'sms_rcs') {
      switch (type) {
        case 'gentle':
          return `RentBill: Hi ${tenantName}, friendly reminder that your rent for ${propName} (${month}) of ${balance} is due on ${due}. ${payDetailsSms}. Thank you!`;
        case 'due_today':
          return `RentBill: Hi ${tenantName}, your rent for ${propName} (${month}) of ${balance} is DUE TODAY (${due}). Please pay using: ${payDetailsSms}. Kindly share confirmation once paid. Thank you!`;
        case 'overdue':
          return `URGENT NOTICE: Hi ${tenantName}, rent of ${balance} for ${propName} (${month}) was due on ${due} and is now OVERDUE. Please clear dues immediately: ${payDetailsSms}. Thank you - RentBill`;
        case 'receipt':
          return `RentBill: Hi ${tenantName}, payment received for ${propName} (${month}). Bill #${billNum}. Total: ${total}. Balance: ${balance}. Thank you!`;
        default:
          return `RentBill: Hi ${tenantName}, rent for ${propName} (${month}) is ${balance}. Due: ${due}. ${payDetailsSms}. Thank you!`;
      }
    }

    if (channel === 'email') {
      return `Dear ${tenantName},\n\nThis is a notification regarding your rental unit ${propName} for the period ${month}.\n\nBill Details:\n• Bill Number: ${billNum}\n• Billing Month: ${month}\n• Due Date: ${due}\n• Total Amount: ${total}\n• Balance Outstanding: ${balance}\n\nPayment Information:${payDetailsWa.replace(/\*/g, '')}\n\nIf you have already processed this payment, kindly disregard this notice or reply with the transaction reference.\n\nWarm regards,\nProperty Management - RentBill`;
    }

    // Default: WhatsApp format (with rich formatting & emojis)
    switch (type) {
      case 'gentle':
        return `Hello ${tenantName},\n\nThis is a friendly reminder that your rent bill for *${propName}* (${month}) of *${balance}* is due on *${due}*.\n\nKindly complete the payment at your convenience:${payDetailsWa}\n\nThank you!\n- RentBill Management`;

      case 'due_today':
        return `Dear ${tenantName},\n\nYour rent bill for *${propName}* (${month}) amounting to *${balance}* is *DUE TODAY* (${due}).\n\nPlease transfer the amount today using:${payDetailsWa}\n\nKindly share the transaction screenshot once paid.\nThank you!`;

      case 'overdue':
        return `⚠️ *PAYMENT OVERDUE NOTICE*\n\nDear ${tenantName},\n\nThis is an urgent reminder that your rent payment of *${balance}* for *${propName}* (${month}) was due on *${due}* and is currently *OVERDUE*.\n\nPlease clear the outstanding dues immediately:${payDetailsWa}\n\nIf you have already paid, please share the transaction reference.\nThank you.`;

      case 'receipt':
        return `✅ *PAYMENT RECEIVED - THANK YOU!*\n\nDear ${tenantName},\n\nWe have received your payment for *${propName}* (${month}).\n*Bill No:* ${billNum}\n*Total Bill:* ${total}\n*Outstanding Balance:* ${balance}\n\nThank you for your prompt payment!\n- RentBill Management`;

      default:
        return `Hello ${tenantName},\nYour rent bill for ${propName} (${month}) is ${balance}. Due date: ${due}. Thank you!`;
    }
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

  // Device native share sheet
  async sendNativeShare(title, text) {
    if (navigator.share) {
      try {
        await navigator.share({ title: title, text: text });
        return true;
      } catch (err) {
        if (err && err.name === 'AbortError') return true;
      }
    }
    return false;
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
      `📊 TENANT FINANCIAL STATEMENT`,
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
        lines.push(`• [${e.date}] ${e.description} | Invoiced: ${curr}${e.debit.toFixed(2)} | Balance: ${curr}${e.running_balance.toFixed(2)}`);
      } else {
        lines.push(`• [${e.date}] ${e.description} | Paid: ${curr}${e.credit.toFixed(2)} | Balance: ${curr}${e.running_balance.toFixed(2)}`);
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
    } catch (e) {
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
      } catch (e) {
        window.prompt('Copy statement below:', text);
      }
    }
  }
};
