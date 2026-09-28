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

  // Generate and download HD receipt image (PNG) directly via Canvas (100% offline, zero external dependencies)
  downloadReceiptImage(bill) {
    if (!bill) return;

    const curr = window.APP_CURRENCY || '₹';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const scale = 2; // Retina 2x scale for sharp text

    const width = 640;
    // Calculate required height based on dynamic sections
    let height = 580;
    if (bill.electricity_amount > 0) height += 35;
    if (bill.water_amount > 0) height += 35;
    if (bill.maintenance_amount > 0) height += 30;
    if (bill.other_charges > 0) height += 30;
    if (bill.discount_amount > 0) height += 30;
    if (bill.previous_balance > 0) height += 35;
    if (bill.payment_upi || bill.payment_bank_name) height += 90;
    if (bill.notes) height += 35;

    canvas.width = width * scale;
    canvas.height = height * scale;
    ctx.scale(scale, scale);

    // 1. Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 2. Top Header Accent Banner
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, width, 6);

    // 3. Header Text & Invoice Number
    let y = 38;
    ctx.fillStyle = '#1e40af';
    ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
    ctx.fillText('RENT INVOICE / RECEIPT', 28, y);

    ctx.textAlign = 'right';
    // Status Badge background
    const status = bill.status || 'PENDING';
    ctx.fillStyle = status === 'PAID' ? '#dcfce7' : (status === 'OVERDUE' ? '#fee2e2' : '#fef3c7');
    const statusText = status;
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    const textWidth = ctx.measureText(statusText).width;
    ctx.beginPath();
    ctx.roundRect(width - 28 - textWidth - 16, y - 18, textWidth + 16, 24, 12);
    ctx.fill();

    ctx.fillStyle = status === 'PAID' ? '#15803d' : (status === 'OVERDUE' ? '#b91c1c' : '#b45309');
    ctx.fillText(statusText, width - 36, y - 2);

    y += 24;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#64748b';
    ctx.font = '13px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Bill #${bill.bill_number} • Period: ${bill.billing_month}`, 28, y);

    ctx.textAlign = 'right';
    ctx.fillText(`Due Date: ${bill.due_date}`, width - 28, y);

    // Divider
    y += 18;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(28, y);
    ctx.lineTo(width - 28, y);
    ctx.stroke();

    // 4. Tenant & Unit Info
    y += 26;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(bill.tenant_name, 28, y);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Phone: ${bill.tenant_phone}`, 28, y + 18);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(bill.property_name, width - 28, y);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('Property Unit', width - 28, y + 18);

    // 5. Line Items Table Header
    y += 44;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(28, y - 6, width - 56, 28);
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(28, y - 6, width - 56, 28);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('DESCRIPTION', 38, y + 12);

    ctx.textAlign = 'right';
    ctx.fillText(`AMOUNT (${curr})`, width - 38, y + 12);

    // Helper for table rows
    const drawRow = (desc, sub, amount, isRed = false, isGreen = false) => {
      y += 30;
      ctx.textAlign = 'left';
      ctx.fillStyle = isRed ? '#dc2626' : (isGreen ? '#16a34a' : '#1e293b');
      ctx.font = (isRed || isGreen) ? 'bold 13px system-ui, -apple-system, sans-serif' : '13px system-ui, -apple-system, sans-serif';
      ctx.fillText(desc, 38, y);

      if (sub) {
        ctx.fillStyle = '#64748b';
        ctx.font = '11px system-ui, -apple-system, sans-serif';
        ctx.fillText(sub, 38, y + 14);
      }

      ctx.textAlign = 'right';
      ctx.fillStyle = isRed ? '#dc2626' : (isGreen ? '#16a34a' : '#0f172a');
      ctx.font = (isRed || isGreen) ? 'bold 13px system-ui, -apple-system, sans-serif' : '13px system-ui, -apple-system, sans-serif';
      const prefix = isGreen ? '-' : '';
      ctx.fillText(`${prefix}${curr}${amount.toFixed(2)}`, width - 38, y);

      if (sub) y += 6;
      ctx.strokeStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(28, y + 8);
      ctx.lineTo(width - 28, y + 8);
      ctx.stroke();
    };

    // Table rows
    drawRow('Base House Rent', '', bill.base_rent);

    if (bill.electricity_amount > 0) {
      drawRow(`Electricity (${bill.electricity_units} units @ ${curr}${bill.electricity_rate})`, `Meter: ${bill.prev_electricity_meter} -> ${bill.curr_electricity_meter}`, bill.electricity_amount);
    }
    if (bill.water_amount > 0) {
      if (bill.water_billing_type === 'METER') {
        drawRow(`Water (${bill.water_units} units @ ${curr}${bill.water_rate})`, `Meter: ${bill.prev_water_meter} -> ${bill.curr_water_meter}`, bill.water_amount);
      } else {
        drawRow('Water Charges (Fixed)', '', bill.water_amount);
      }
    }
    if (bill.maintenance_amount > 0) {
      drawRow('Maintenance Charges', '', bill.maintenance_amount);
    }
    if (bill.other_charges > 0) {
      drawRow(`Other Charges: ${bill.other_charges_desc || 'Adjustment'}`, '', bill.other_charges);
    }
    if (bill.discount_amount > 0) {
      drawRow(`Discount: ${bill.discount_reason || 'Concession'}`, '', bill.discount_amount, false, true);
    }
    if (bill.previous_balance > 0) {
      drawRow('Previous Arrears / Unpaid Due', 'Carried forward from previous bill', bill.previous_balance, true);
    }

    // 6. Total Summary Box
    y += 24;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(28, y, width - 56, 68);
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(28, y, width - 56, 68);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 15px system-ui, -apple-system, sans-serif';
    ctx.fillText('TOTAL AMOUNT DUE:', 40, y + 26);

    ctx.textAlign = 'right';
    ctx.fillText(`${curr}${bill.total_amount.toFixed(2)}`, width - 40, y + 26);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#15803d';
    ctx.font = '13px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Paid: ${curr}${bill.paid_amount.toFixed(2)}`, 40, y + 50);

    ctx.textAlign = 'right';
    ctx.fillStyle = bill.balance_amount > 0 ? '#dc2626' : '#15803d';
    ctx.font = 'bold 14px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Balance: ${curr}${bill.balance_amount.toFixed(2)}`, width - 40, y + 50);

    // 7. Amount in words
    y += 84;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#475569';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText(`Amount in Words: ${this.amountInWords(bill.total_amount)}`, 28, y);

    // 8. Payment Details Box (UPI / Bank)
    if (bill.payment_upi || bill.payment_bank_name) {
      y += 18;
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(28, y, width - 56, 60);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1;
      ctx.strokeRect(28, y, width - 56, 60);

      ctx.fillStyle = '#1e40af';
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      ctx.fillText('PAYMENT DETAILS:', 38, y + 18);

      ctx.fillStyle = '#0f172a';
      ctx.font = '12px system-ui, -apple-system, sans-serif';
      let payStr = '';
      if (bill.payment_upi) payStr += `UPI: ${bill.payment_upi}  `;
      if (bill.payment_bank_name) payStr += `• Bank: ${bill.payment_bank_name} (${bill.payment_account_no || ''})  `;
      if (bill.payment_ifsc) payStr += `• IFSC: ${bill.payment_ifsc}`;
      ctx.fillText(payStr, 38, y + 38);
      y += 60;
    }

    if (bill.notes) {
      y += 18;
      ctx.fillStyle = '#64748b';
      ctx.font = 'italic 12px system-ui, -apple-system, sans-serif';
      ctx.fillText(`Note: ${bill.notes}`, 28, y);
    }

    // 9. Watermark footer
    y += 24;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Generated by RentBill • Smart Rental Management', width / 2, y);

    // 10. Trigger Download
    try {
      const link = document.createElement('a');
      link.download = `Receipt-${bill.bill_number}-${bill.billing_month}.png`;
      link.href = canvas.toDataURL('image/png');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      if (window.App && typeof window.App.toast === 'function') {
        window.App.toast('Receipt image saved to your device!');
      }
    } catch (e) {
      alert('Failed saving receipt image: ' + e.message);
    }
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
