/* ===== SECTION: sharing.js ===== */
let shareData = { type: '', id: null, message: '', htmlMessage: '', mobile: '', email: '', billId: null };

async function printProfessionalAgreement(id) {
    try {
        const res = await fetch(`/api/renter/${id}`);
        const t = await res.json();

        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const pad = n => n.toString().padStart(2, '0');
        const moveIn = new Date(t.move_in_date);
        const formattedMoveIn = `${moveIn.getFullYear()}-${months[moveIn.getMonth()]}-${pad(moveIn.getDate())}`;
        const fmtLong = d => (isNaN(d.getTime()) ? '--' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));

        let propName = appSettings.property_name || 'RENTBILL PRO';
        let propAddr = appSettings.property_address || 'Property Management System';
        let propTerms = appSettings.agreement_terms || 'Standard conditions apply.';

        const ownerName = t.assigned_upi;
        const ownerAcc = appSettings.receiving_accounts?.find(a => a.owner_name === ownerName);
        if (ownerAcc) {
            if (ownerAcc.property_name) propName = ownerAcc.property_name;
            if (ownerAcc.property_address) propAddr = ownerAcc.property_address;
            if (ownerAcc.agreement_terms) propTerms = ownerAcc.agreement_terms;
        }

        const endDate = t.agreement_expiry_date
            ? new Date(t.agreement_expiry_date)
            : new Date(moveIn.getFullYear(), moveIn.getMonth() + 11, moveIn.getDate());

        const printWindow = window.open('/print/agreement.html', '_blank');
        if (!printWindow) {
            return showNotification("Please allow popups to open the agreement print view", "error");
        }

        printWindow.onload = function () {
            const doc = printWindow.document;
            const set = (elmId, val) => {
                const el = doc.getElementById(elmId);
                if (el) el.innerText = val;
            };

            set('agPropName', propName);
            set('agPropAddr', propAddr);
            set('agRecordNo', `RB/${new Date().getFullYear()}/${t.room_no}/${t.id}`);
            set('agDate', fmtLong(new Date()));
            set('agOwnerName', ownerName || 'Lessor');
            set('agOwnerAddr', propAddr);
            set('agTenantName', t.name);
            set('agTenantOccupation', t.occupation || '—');
            set('agTenantMobile', t.mobile_number ? `+91 ${t.mobile_number}` : '—');
            set('agTenantAadhar', t.aadhar_no || '—');
            set('agTenantAddr', t.perm_address || 'Not provided');
            set('agRoomNo', t.room_no);
            set('agStartDate', formattedMoveIn);
            set('agStartDate2', fmtLong(moveIn));
            set('agEndDate', fmtLong(endDate));
            set('agEndDate2', fmtLong(endDate));
            set('agTenure', '11 Months');
            set('agRent', currencyFormatter.format(t.base_rent));
            set('agMaint', currencyFormatter.format(t.water_maint));
            set('agEbRate', currencyFormatter.format(t.eb_unit_price));
            set('agAdvance', currencyFormatter.format(t.advance_amount));
            set('agClauseRent', currencyFormatter.format(t.base_rent));
            set('agClauseDeposit', currencyFormatter.format(t.advance_amount));
            set('sigOwnerName', ownerName || '');
            set('sigOwnerAddr', propAddr);
            set('sigTenantName', t.name);
            set('sigTenantAddr', t.perm_address || '');

            const coTenants = (t.co_tenant_names || '').trim();
            if (coTenants) {
                const row = doc.getElementById('agCoTenantsRow');
                if (row) row.style.display = '';
                set('agCoTenants', coTenants);
            }

            const emergency = (t.emergency_contact || '').trim();
            if (emergency) {
                const row = doc.getElementById('agEmergencyRow');
                if (row) row.style.display = '';
                set('agEmergency', emergency);
            }

            const extra = doc.getElementById('agExtraTerms');
            if (extra) {
                const lines = propTerms.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length > 0) {
                    let n = 10;
                    extra.innerHTML = lines.map(line => {
                        return `<p class="ag-clause"><strong>${n++}. Additional Term:</strong> ${line}</p>`;
                    }).join('');
                }
            }
        };
    } catch (e) {
        showNotification("System error", "error");
    }
}

async function sendWhatsAppReminder(renterId, month, amount) {
    try {
        const res = await fetch(`/api/renter/${renterId}`);
        const t = await res.json();
        const mobile = t.mobile_number.replace(/\D/g, '');
        
        const periodLabel = month === 'Previous Balance' ? 'previous balance' : `rent for ${month}`;
        const message = `*PAYMENT REMINDER*\n` +
            `--------------------------------------------------\n` +
            `Hi *${t.name}*,\n\n` +
            `Hope you are doing well. This is a friendly reminder that the *${periodLabel}* for Unit *${t.room_no}* is pending.\n\n` +
            `*Total Due: ${currencyFormatter.format(amount)}*\n\n` +
            `Please ignore if already paid. If not, kindly settle the dues at your earliest convenience and share the screenshot.\n\n` +
            `Thank you!\n` +
            `-- RentBill Pro`;

        window.open(`https://wa.me/${mobile}?text=${encodeURIComponent(message)}`, '_blank');
        showNotification("Opening WhatsApp...", "success");
    } catch (e) {
        showNotification("Failed to send reminder", "error");
    }
}

async function prepareAndShare(type, id, extraDetails = null) {
    try {
        showNotification("Preparing document...", "info");
        let message = '';
        let mobile = '';
        let email = '';
        let billId = null;
        let htmlMessage = '';

        if (type === 'bill') {
            const bRes = await fetch(`/api/bill/${id}`);
            const bill = await bRes.json();
            const tRes = await fetch(`/api/renter/${bill.renter_id}`);
            const t = await tRes.json();
            billId = bill.id;
            mobile = t.mobile_number.replace(/\D/g, '');
            email = t.email;

            const ebUnits = (bill.curr_eb_reading || 0) - (bill.prev_eb_reading || 0);
            const ebCost = ebUnits * (t.eb_unit_price || 0);

            const waterMetered = (bill.water_calc_mode || t.water_calc_mode || 'FIXED').toUpperCase() === 'METER';
            const wUnits = waterMetered ? Math.max(0, (bill.curr_water_reading || 0) - (bill.prev_water_reading || 0)) : 0;

            let formattedDueDate = 'N/A';
            try {
                const periodDate = new Date(bill.billing_month + ' 1');
                const dueDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 5);
                formattedDueDate = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
            } catch (de) { console.error("Due date calc failed", de); }

            let paymentInfo = '';
            let htmlPaymentInfo = '';
            if (!bill.is_paid && typeof appSettings !== 'undefined') {
                const ownerName = bill.assigned_owner || t.assigned_upi;
                const ownerAcc = appSettings.receiving_accounts?.find(a => a.owner_name === ownerName);

                if (ownerAcc) {
                    paymentInfo = `*PAYMENT DETAILS:*\n`;
                    htmlPaymentInfo = `
                        <div class="print-no-break" style="margin-bottom: 25px; border: 1.5px solid var(--primary); border-radius: 12px; padding: 15px; background: var(--bg-main); break-inside: avoid;">
                            <p style="margin: 0 0 10px 0; font-weight: 900; font-size: 13px; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px;">Payment Instructions</p>
                            <p style="margin: 5px 0; font-size: 12px; font-weight: 700; color: var(--text-main);">Transfer <strong>${currencyFormatter.format(bill.total_amount)}</strong> using the options below:</p>
                    `;

                    if (ownerAcc.upi) {
                        const upiUrl = `upi://pay?pa=${ownerAcc.upi}&pn=RentBill&am=${bill.total_amount}&cu=INR&tn=Rent for ${bill.billing_month}`;
                        const qrDataURL = await generateQRDataURL(upiUrl);
                        
                        paymentInfo += `UPI ID: ${ownerAcc.upi}\n` +
                            `Direct Pay: ${upiUrl}\n`;
                        
                        htmlPaymentInfo += `
                            <div style="background: white; border: 1px dashed var(--primary); border-radius: 10px; padding: 15px; margin: 12px 0; text-align: center; break-inside: avoid;">
                                <div style="margin-bottom: 15px;">
                                    <img src="${qrDataURL}"
                                         alt="UPI QR Code" style="display: block; margin: 0 auto; max-width: 140px; width: 100%;">
                                    <p style="font-size: 10px; color: var(--text-muted); margin-top: 8px; font-weight: 700;">SCAN TO PAY VIA UPI</p>
                                </div>
                                <div style="border-top: 1px solid var(--border); padding-top: 12px;">
                                    <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: 6px; padding: 8px; margin-bottom: 12px; word-break: break-all;">
                                        <code style="font-size: 12px; font-weight: 900; color: var(--primary);">${ownerAcc.upi}</code>
                                    </div>
                                    <a href="${upiUrl.replace(' ', '%20')}" 
                                       target="_blank"
                                       style="text-decoration: none; background: var(--primary); color: #fff !important; display: block; padding: 10px; border-radius: 8px; font-weight: 900; font-size: 12px; letter-spacing: 1px; text-transform: uppercase;">
                                        TAP TO PAY NOW
                                    </a>
                                </div>
                            </div>
                        `;
                    }

                    if (ownerAcc.bank_name) {
                        paymentInfo += (ownerAcc.upi ? `\n` : ``) +
                            `*BANK DETAILS:*\n` +
                            `Bank: ${ownerAcc.bank_name}\n` +
                            `Acc: ${ownerAcc.account_number}\n` +
                            `IFSC: ${ownerAcc.ifsc}\n`;
                        
                        htmlPaymentInfo += `
                            <div style="background: white; border: 1px solid var(--border); border-radius: 10px; padding: 12px; margin-top: 12px; text-align: left; break-inside: avoid;">
                                <p style="margin: 0 0 8px 0; font-size: 11px; font-weight: 900; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Bank Transfer Details</p>
                                <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                    <tr><td style="padding: 4px 0; color: var(--text-muted); font-weight: 600;">BANK</td><td style="padding: 4px 0; font-weight: 900; text-align: right; color: var(--text-main);">${ownerAcc.bank_name}</td></tr>
                                    <tr><td style="padding: 4px 0; color: var(--text-muted); font-weight: 600;">ACC NO</td><td style="padding: 4px 0; font-weight: 900; text-align: right; color: var(--text-main);">${ownerAcc.account_number}</td></tr>
                                    <tr><td style="padding: 4px 0; color: var(--text-muted); font-weight: 600;">IFSC</td><td style="padding: 4px 0; font-weight: 900; text-align: right; color: var(--text-main);">${ownerAcc.ifsc}</td></tr>
                                </table>
                            </div>
                        `;
                    }

                    if (!ownerAcc.upi && !ownerAcc.bank_name) {
                        paymentInfo += `CONTACT OWNER FOR PAYMENT`;
                        htmlPaymentInfo += `<p style="text-align: center; font-weight: bold;">CONTACT OWNER FOR PAYMENT</p>`;
                    }

                    htmlPaymentInfo += `</div>`;
                }
            }

            let adjustmentInfo = '';
            let htmlAdjustments = '';
            if (bill.is_paid) {
                if (bill.discount_amount > 0) adjustmentInfo += `Discount Applied: -${currencyFormatter.format(bill.discount_amount)}\n`;
                if (bill.write_off_amount > 0) adjustmentInfo += `Write-Off: -${currencyFormatter.format(bill.write_off_amount)}\n`;
                if (bill.arrears_amount > 0) adjustmentInfo += `Carry Forward: ${currencyFormatter.format(bill.arrears_amount)} (Added to next bill)\n`;
            }
            if (bill.late_fee > 0) adjustmentInfo += `Late Fee Penalty: ${currencyFormatter.format(bill.late_fee)}\n`;

            let genDate = bill.date_generated ? new Date(bill.date_generated) : new Date();
            if (isNaN(genDate.getTime())) {
                genDate = new Date();
            }

            const otherFees = bill.others;
            const amountInWords = numberToWords(Math.round(bill.total_amount));
            message = `*RENT ${bill.is_paid ? 'RECEIPT' : 'INVOICE'}*\n` +
                `--------------------------------------------------\n` +
                `*STAY PERIOD:* ${bill.billing_month.toUpperCase()}\n` +
                `*TENANT:* ${t.name} (${t.room_no})\n` +
                `*STATUS:* ${bill.is_paid ? '✅ PAID' : '⏳ PENDING'}\n` +
                (!bill.is_paid ? `*DUE DATE:* ${formattedDueDate}\n` : '') +
                `--------------------------------------------------\n` +
                `Base Rent      : ${currencyFormatter.format(bill.rent_amount)}\n` +
                `Water/Maint    : ${currencyFormatter.format(bill.water_amount)}\n` +
                (waterMetered ? `Water (${wUnits} u)   : ${currencyFormatter.format(bill.water_amount)}\n   [Readings: ${bill.prev_water_reading} - ${bill.curr_water_reading}]\n` : '') +
                `EB (${ebUnits.toFixed(1)} u)  : ${currencyFormatter.format(ebCost)}\n` +
                `   [Readings: ${bill.prev_eb_reading} - ${bill.curr_eb_reading}]\n` +
                (otherFees > 0 ? `Extra Charges  : ${currencyFormatter.format(otherFees)}\n` : '') +
                (bill.arrears_included > 0 ? `Prev. Arrears  : ${currencyFormatter.format(bill.arrears_included)}\n` : '') +
                (bill.late_fee > 0 ? `Late Fee Penalty: +${currencyFormatter.format(bill.late_fee)}\n` : '') +
                (bill.discount_amount > 0 ? `Adjustment/Disc: -${currencyFormatter.format(bill.discount_amount)}\n` : '') +
                `--------------------------------------------------\n` +
                `*NET TOTAL    : ${currencyFormatter.format(bill.total_amount)}*\n` +
                `*IN WORDS     : ${amountInWords}*\n` +
                `--------------------------------------------------\n` +
                (bill.is_paid ? `*AMOUNT PAID   : ${currencyFormatter.format(bill.paid_amount)}*\n` + adjustmentInfo : paymentInfo) +
                `--------------------------------------------------\n` +
                `*Please share a screenshot after payments.*\n` +
                `--------------------------------------------------\n` +
                `Generated: ${genDate.toLocaleDateString('en-IN')}\n` +
                `System: RentBill Pro`;

            const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
            const formattedGenDate = `${genDate.getFullYear()}-${months[genDate.getMonth()]}-${genDate.getDate().toString().padStart(2, '0')}`;

            let propName = appSettings.property_name || 'RENTBILL PRO';
            let propAddr = appSettings.property_address || 'Property Management System';

            const ownerName = (bill.is_paid && bill.payment_details) ? bill.payment_details : (bill.assigned_owner || t.assigned_upi);
            const ownerAcc = appSettings.receiving_accounts?.find(a => a.owner_name === ownerName);
            if (ownerAcc) {
                if (ownerAcc.property_name) propName = ownerAcc.property_name;
                if (ownerAcc.property_address) propAddr = ownerAcc.property_address;
            }

            if (bill.is_paid) {
                if (bill.write_off_amount > 0) htmlAdjustments += `<tr style="break-inside: avoid;"><td style="padding: 6px 5px; border: 1px solid #000; color: #d32f2f;">WRITE-OFF (Loss)</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right; color: #d32f2f;">-${currencyFormatter.format(bill.write_off_amount)}</td></tr>`;
                if (bill.arrears_amount > 0) htmlAdjustments += `<tr style="break-inside: avoid;"><td style="padding: 6px 5px; border: 1px solid #000; color: #f57c00;">CARRY FORWARD</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right; color: #f57c00;">${currencyFormatter.format(bill.arrears_amount)}</td></tr>`;
            }
            if (bill.late_fee > 0) htmlAdjustments += `<tr style="break-inside: avoid;"><td style="padding: 6px 5px; border: 1px solid #000; color: #f57c00;">LATE FEE / PENALTY</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right; color: #f57c00;">+${currencyFormatter.format(bill.late_fee)}</td></tr>`;

            htmlMessage = `
                <div class="print-container" style="background-color: var(--bg-main); padding: 10px; font-family: var(--font-main), sans-serif; color: var(--text-main); line-height: 1.4;">
                    <div class="print-no-break" style="background-color: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 25px; position: relative; max-width: 600px; margin: 0 auto; overflow-wrap: break-word; box-sizing: border-box; box-shadow: var(--shadow); break-inside: avoid;">
                        <div style="text-align: center; border-bottom: 1px solid var(--border); padding-bottom: 15px; margin-bottom: 20px; break-inside: avoid;">
                            <h2 style="margin: 0; font-size: 20px; text-transform: uppercase; font-weight: 900; color: var(--primary); letter-spacing: 0.5px;">${propName}</h2>
                            <p style="margin: 4px 0 12px 0; font-size: 10px; color: var(--text-muted); font-weight: 600;">${propAddr}</p>
                            <span style="background: var(--primary); color: white !important; padding: 4px 16px; font-weight: 900; letter-spacing: 1px; font-size: 12px; display: inline-block; margin-bottom: 8px; border-radius: 6px;">${bill.is_paid ? 'PAYMENT RECEIPT' : 'RENT INVOICE'}</span>
                            <p style="margin: 0; font-size: 10px; font-weight: 800; color: var(--text-muted);">BILL NO: ${bill.is_paid ? 'REC' : 'INV'}/${genDate.getFullYear()}/${(genDate.getMonth()+1).toString().padStart(2,'0')}/${t.room_no}/${bill.id}</p>
                        </div>

                        <div style="margin-bottom: 20px; background: var(--primary-light); padding: 15px; border-radius: 10px; text-align: center; break-inside: avoid;">
                            <p style="margin: 0; font-size: 9px; color: var(--primary); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 900; opacity: 0.8;">Tenant Details</p>
                            <p style="margin: 6px 0; font-size: 20px; font-weight: 900; color: var(--text-main);">${t.name}</p>
                            <div style="display: inline-block; border: 1.5px solid var(--primary); color: var(--primary); padding: 3px 12px; font-size: 13px; font-weight: 900; margin-top: 4px; border-radius: 6px; background: white;">UNIT: ${t.room_no}</div>
                            <div style="margin-top: 10px; font-size: 14px; font-weight: 800; color: var(--text-main);">PERIOD: ${bill.billing_month.toUpperCase()}</div>
                            ${!bill.is_paid ? `<div style="margin-top: 4px; font-size: 12px; font-weight: 800; color: var(--danger);">DUE BY: ${formattedDueDate}</div>` : ''}
                        </div>

                        <div style="margin-bottom: 20px; break-inside: avoid;">
                            <p style="background: var(--primary); color: white !important; display: inline-block; padding: 3px 10px; font-size: 10px; font-weight: 900; margin-bottom: 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Electricity Consumption</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">PREVIOUS READING</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${bill.prev_eb_reading}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">CURRENT READING</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${bill.curr_eb_reading}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">UNITS (x ${t.eb_unit_price})</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${ebUnits.toFixed(1)}</td></tr>
                                <tr style="font-weight: 900; background: var(--bg-main); break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--primary);">TOTAL EB COST</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; color: var(--primary);">${currencyFormatter.format(ebCost)}</td></tr>
                            </table>
                        </div>

                        ${waterMetered ? `
                        <div style="margin-bottom: 20px; break-inside: avoid;">
                            <p style="background: var(--primary); color: white !important; display: inline-block; padding: 3px 10px; font-size: 10px; font-weight: 900; margin-bottom: 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Water Consumption</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">PREVIOUS READING</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${bill.prev_water_reading}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">CURRENT READING</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${bill.curr_water_reading}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">UNITS (x ${bill.water_unit_price || t.water_unit_price || 0})</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${wUnits.toFixed(1)}</td></tr>
                                <tr style="font-weight: 900; background: var(--bg-main); break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--primary);">TOTAL WATER COST</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; color: var(--primary);">${currencyFormatter.format(bill.water_amount)}</td></tr>
                            </table>
                        </div>
                        ` : ''}

                        <div style="margin-bottom: 20px; break-inside: avoid;">
                            <p style="background: var(--primary); color: white !important; display: inline-block; padding: 3px 10px; font-size: 10px; font-weight: 900; margin-bottom: 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Bill Itemization</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">MONTHLY RENT</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(bill.rent_amount)}</td></tr>
                                ${bill.maint_amount > 0 ? `<tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">MAINTENANCE</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(bill.maint_amount)}</td></tr>` : ''}
                                ${bill.water_amount > 0 ? `<tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">WATER CHARGE${waterMetered ? ` (${wUnits} u)` : ''}</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(bill.water_amount)}</td></tr>` : ''}
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">ELECTRICITY (EB)</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(ebCost)}</td></tr>
                                ${otherFees > 0 ? `<tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">EXTRA CHARGES</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(otherFees)}</td></tr>` : ''}
                                ${bill.arrears_included > 0 ? `<tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">PREV. ARREARS</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(bill.arrears_included)}</td></tr>` : ''}
                                ${bill.late_fee > 0 ? `<tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: #f57c00; font-weight: 700;">LATE FEE / PENALTY</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; color: #f57c00; font-weight: 800;">+${currencyFormatter.format(bill.late_fee)}</td></tr>` : ''}
                                ${bill.discount_amount > 0 ? `<tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--danger); font-weight: 700;">DISCOUNT / WAIVER (-)</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; color: var(--danger); font-weight: 800;">-${currencyFormatter.format(bill.discount_amount)}</td></tr>` : ''}
                                <tr style="font-weight: 900; background: var(--primary-light); break-inside: avoid;"><td style="padding: 10px; border: 1px solid var(--primary); color: var(--primary); font-size: 14px;">TOTAL DUE</td><td style="padding: 10px; border: 1px solid var(--primary); text-align: right; color: var(--primary); font-size: 14px;">${currencyFormatter.format(bill.total_amount)}</td></tr>
                                ${bill.is_paid ? `
                                    <tr style="font-weight: 900; background: var(--bg-success-light); break-inside: avoid;"><td style="padding: 10px; border: 1px solid var(--success); color: var(--success);">TOTAL PAID</td><td style="padding: 10px; border: 1px solid var(--success); text-align: right; color: var(--success);">${currencyFormatter.format(bill.paid_amount)}</td></tr>
                                    ${htmlAdjustments}
                                ` : ''}
                            </table>
                            <div style="margin-top: 12px; font-size: 11px; font-weight: 800; color: var(--text-main); background: var(--bg-main); padding: 8px; border-radius: 6px; border: 1px dashed var(--border);">
                                <span style="color: var(--text-muted); text-transform: uppercase; font-size: 9px; display: block; margin-bottom: 2px;">Amount in words</span>
                                ${amountInWords}
                            </div>
                        </div>

                        <div class="print-no-break" style="break-inside: avoid;">
                            ${!bill.is_paid ? htmlPaymentInfo : ''}
                        </div>

                        <div style="display: flex; justify-content: center; margin: 20px auto 10px auto; break-inside: avoid;">
                            <div style="border: 2px solid ${bill.is_paid ? 'var(--success)' : 'var(--danger)'}; color: ${bill.is_paid ? 'var(--success)' : 'var(--danger)'}; border-radius: 10px; padding: 10px 30px; transform: rotate(-3deg); font-weight: 900; font-size: 22px; text-align: center; text-transform: uppercase; background: white; box-shadow: 4px 4px 0px ${bill.is_paid ? 'var(--bg-success-light)' : 'var(--bg-danger-light)'};">
                                ${bill.is_paid ? 'PAID' : 'PENDING'}
                            </div>
                        </div>

                        <div style="margin-top: 20px; border-top: 1px solid var(--border); padding-top: 15px; text-align: center; break-inside: avoid;">
                            <p style="font-size: 9px; margin: 0; letter-spacing: 2px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Generated: ${formattedGenDate} • RentBill Pro Official Document</p>
                        </div>
                    </div>
                </div>`;
        } else if (type === 'clearance') {
            const tRes = await fetch(`/api/renter/${id}`);
            const t = await tRes.json();
            mobile = t.mobile_number.replace(/\D/g, '');
            email = t.email;

            const s = extraDetails || {
                advance: t.advance_amount,
                ebReading: t.exit_eb_reading || 'N/A',
                rentDue: t.exit_rent_due || 0,
                ebDue: t.exit_eb_due || 0,
                repairs: t.exit_repairs_deducted || 0,
                reason: t.exit_reason || 'None',
                totalRefund: t.exit_refund_amount || currencyFormatter.format(t.advance_amount),
                refundLabel: t.exit_refund_label || 'Total Refund'
            };

            const genDate = t.vacate_date ? new Date(t.vacate_date) : new Date();
            const moveInDate = t.move_in_date ? new Date(t.move_in_date).toLocaleDateString('en-IN') : 'N/A';
            const vacateDate = genDate.toLocaleDateString('en-IN');

            const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
            const formattedGenDate = `${genDate.getFullYear()}-${months[genDate.getMonth()]}-${genDate.getDate().toString().padStart(2, '0')}`;

            message = `*EXIT SETTLEMENT CLEARANCE*\n` +
                `--------------------------------------------------\n` +
                `*TENANT:* ${t.name} (${t.room_no})\n` +
                `*TENURE:* ${moveInDate} to ${vacateDate}\n` +
                `*STATUS:* ✅ CLEARED\n` +
                `--------------------------------------------------\n` +
                `Security Advance : ${currencyFormatter.format(s.advance)}\n` +
                `Final EB Reading : ${s.ebReading}\n` +
                `--------------------------------------------------\n` +
                `*DEDUCTIONS:*\n` +
                `Pending Rent     : ${currencyFormatter.format(s.rentDue)}\n` +
                `Pending EB       : ${currencyFormatter.format(s.ebDue)}\n` +
                `Repairs/Others   : ${currencyFormatter.format(s.repairs)}\n` +
                (s.reason && s.reason !== 'None' ? `   [Reason: ${s.reason}]\n` : '') +
                `--------------------------------------------------\n` +
                `*${s.refundLabel.toUpperCase()} : ${s.totalRefund}*\n` +
                `--------------------------------------------------\n` +
                `The premises has been inspected and vacated. All dues cleared. Best wishes for your future!\n\n` +
                `Generated on: ${formattedGenDate}\n` +
                `System: RentBill Pro`;

            const propName = appSettings.property_name || 'RENTBILL PRO';
            const propAddr = appSettings.property_address || 'Property Management System';

            htmlMessage = `
                <div class="print-container" style="background-color: var(--bg-main); padding: 10px; font-family: var(--font-main), sans-serif; color: var(--text-main); line-height: 1.4;">
                    <div class="print-no-break" style="background-color: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 25px; position: relative; max-width: 600px; margin: 0 auto; overflow-wrap: break-word; box-sizing: border-box; box-shadow: var(--shadow); break-inside: avoid;">
                        <div style="text-align: center; border-bottom: 1px solid var(--border); padding-bottom: 15px; margin-bottom: 20px; break-inside: avoid;">
                            <h2 style="margin: 0; font-size: 20px; text-transform: uppercase; font-weight: 900; color: var(--primary); letter-spacing: 0.5px;">${propName}</h2>
                            <p style="margin: 4px 0 12px 0; font-size: 10px; color: var(--text-muted); font-weight: 600;">${propAddr}</p>
                            <span style="background: var(--primary); color: white !important; padding: 4px 16px; font-weight: 900; letter-spacing: 1px; font-size: 12px; display: inline-block; margin-bottom: 8px; border-radius: 6px;">EXIT SETTLEMENT</span>
                            <p style="margin: 0; font-size: 10px; font-weight: 800; color: var(--text-muted);">DOC NO: CLR-${t.id}-${genDate.getTime().toString().slice(-6)}</p>
                        </div>

                        <div style="margin-bottom: 20px; background: var(--primary-light); padding: 15px; border-radius: 10px; text-align: center; break-inside: avoid;">
                            <p style="margin: 0; font-size: 9px; color: var(--primary); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 900; opacity: 0.8;">Tenant Details</p>
                            <p style="margin: 6px 0; font-size: 20px; font-weight: 900; color: var(--text-main);">${t.name}</p>
                            <div style="display: inline-block; border: 1.5px solid var(--primary); color: var(--primary); padding: 3px 12px; font-size: 13px; font-weight: 900; margin-top: 4px; border-radius: 6px; background: white;">UNIT: ${t.room_no} | STAY: ${moveInDate} - ${vacateDate}</div>
                        </div>

                        <div style="margin-bottom: 20px; break-inside: avoid;">
                            <p style="background: var(--primary); color: white !important; display: inline-block; padding: 3px 10px; font-size: 10px; font-weight: 900; margin-bottom: 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Settlement Summary</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">SECURITY DEPOSIT</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(s.advance)}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">PENDING RENT (-)</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; color: var(--danger); font-weight: 800;">${currencyFormatter.format(s.rentDue)}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">PENDING EB (-)</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; color: var(--danger); font-weight: 800;">${currencyFormatter.format(s.ebDue)}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">REPAIRS/OTHERS (-)</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; color: var(--danger); font-weight: 800;">${currencyFormatter.format(s.repairs)}</td></tr>
                                <tr style="font-weight: 900; background: var(--primary-light); break-inside: avoid;"><td style="padding: 10px; border: 1px solid var(--primary); color: var(--primary); font-size: 14px;">${s.refundLabel.toUpperCase()}</td><td style="padding: 10px; border: 1px solid var(--primary); text-align: right; color: var(--primary); font-size: 14px;">${s.totalRefund}</td></tr>
                            </table>
                            ${s.reason && s.reason !== 'None' ? `<div style="margin-top: 12px; background: var(--bg-main); padding: 10px; border-radius: 8px; border-left: 4px solid var(--primary); break-inside: avoid;"><p style="margin: 0; font-size: 10px; color: var(--text-muted); text-transform: uppercase; font-weight: 800;">Reason for Charges</p><p style="margin: 4px 0 0 0; font-size: 12px; color: var(--text-main); font-weight: 600;">${s.reason}</p></div>` : ''}
                            <p style="margin-top: 10px; font-size: 11px; font-weight: 800; color: var(--text-muted); text-align: center; background: var(--bg-main); padding: 6px; border-radius: 6px; break-inside: avoid;">Final EB Reading: <span style="color: var(--text-main);">${s.ebReading}</span></p>
                            <p style="margin-top: 20px; font-size: 12px; line-height: 1.5; color: var(--text-main); text-align: center; font-style: italic; break-inside: avoid;">The premises has been inspected and vacated. All dues cleared. Best wishes for your future!</p>
                        </div>

                        <div style="display: block; margin: 20px auto 10px auto; width: fit-content; border: 2px solid var(--success); color: var(--success); border-radius: 10px; padding: 10px 30px; transform: rotate(-3deg); font-weight: 900; font-size: 22px; text-align: center; text-transform: uppercase; background: white; box-shadow: 4px 4px 0px var(--bg-success-light); break-inside: avoid;">
                            VERIFIED & CLEARED
                        </div>

                        <div style="margin-top: 20px; border-top: 1px solid var(--border); padding-top: 15px; text-align: center; break-inside: avoid;">
                            <p style="font-size: 9px; margin: 0; letter-spacing: 2px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Generated: ${formattedGenDate} • RentBill Pro Official Document</p>
                        </div>
                    </div>
                </div>`;
        }

        shareData = { type, id, message, htmlMessage, mobile, email, billId };
        const shareEmailPanel = document.getElementById('shareEmailPanel');
        if (shareEmailPanel) shareEmailPanel.classList.add('hidden');
        const shareEmailStatus = document.getElementById('shareEmailStatus');
        if (shareEmailStatus) shareEmailStatus.innerHTML = '';
        document.getElementById('shareModal').classList.remove('hidden');
        lucide.createIcons();
    } catch (e) {
        console.error(e);
        showNotification("Failed to prepare share options", "error");
    }
}
async function shareTo(channel) {
    if (channel === 'show') {
        closeShareModal();
        const previewModal = document.getElementById('previewModal');
        const previewContent = document.getElementById('previewContent');
        if (previewModal && previewContent) {
            previewContent.innerHTML = shareData.htmlMessage;
            previewModal.classList.remove('hidden');
            setTimeout(() => lucide.createIcons(), 50);
        }
    } else if (channel === 'wa') {
        window.open(`https://wa.me/${shareData.mobile}?text=${encodeURIComponent(shareData.message)}`, '_blank');
    } else if (channel === 'email') {
        const panel = document.getElementById('shareEmailPanel');
        const input = document.getElementById('shareEmailInput');
        const status = document.getElementById('shareEmailStatus');
        if (panel && input) {
            if (shareData.email) input.value = shareData.email;
            input.focus();
            panel.classList.remove('hidden');
            if (status) status.innerHTML = '';
            setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
        }
    } else if (channel === 'email-close') {
        const panel = document.getElementById('shareEmailPanel');
        if (panel) panel.classList.add('hidden');
    } else if (channel === 'print') {
        const printArea = document.getElementById('print-area');
        if (printArea) {
            document.body.classList.add('printing-bill');
            document.body.classList.add('modal-open');
            printArea.innerHTML = shareData.htmlMessage;
            printArea.classList.remove('hidden');

            const shareModal = document.getElementById('shareModal');
            if (shareModal) shareModal.classList.add('hidden');

            setTimeout(() => {
                window.print();
                setTimeout(() => {
                    printArea.classList.add('hidden');
                    printArea.innerHTML = '';
                    document.body.classList.remove('printing-bill');
                    document.body.classList.remove('modal-open');
                }, 500);
            }, 250);
        }
    } else if (channel === 'copy') {
        navigator.clipboard.writeText(shareData.message);
        showNotification("Copied text summary to clipboard", "success");
    }
}

function buildEmailInvoice(html) {
    if (!html) return html;
    const vars = {
        'var(--primary-gradient)': 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        'var(--success-gradient)': 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
        'var(--danger-gradient)': 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
        'var(--primary-light)': '#eef2ff',
        'var(--bg-primary-light)': '#eef2ff',
        'var(--success-light)': '#ecfdf5',
        'var(--bg-success-light)': '#ecfdf5',
        'var(--danger-light)': '#fef2f2',
        'var(--bg-danger-light)': '#fef2f2',
        'var(--warning-light)': '#fffbeb',
        'var(--bg-warning-light)': '#fffbeb',
        'var(--info-light)': '#eff6ff',
        'var(--bg-info-light)': '#eff6ff',
        'var(--bg-main)': '#f8fafc',
        'var(--bg-card)': '#ffffff',
        'var(--bg-input)': '#f1f5f9',
        'var(--text-main)': '#0f172a',
        'var(--text-muted)': '#64748b',
        'var(--border)': '#e2e8f0',
        'var(--primary)': '#4f46e5',
        'var(--secondary)': '#64748b',
        'var(--success)': '#10b981',
        'var(--danger)': '#ef4444',
        'var(--warning)': '#f59e0b',
        'var(--info)': '#3b82f6',
        'var(--font-main)': "'Segoe UI', Arial, sans-serif",
        'var(--shadow-lg)': '0 8px 16px rgba(0,0,0,0.1)',
        'var(--shadow)': '0 4px 12px rgba(0,0,0,0.08)',
        'var(--shadow-sm)': '0 1px 3px rgba(0,0,0,0.08)',
        'var(--glass-bg)': 'rgba(255,255,255,0.85)'
    };
    let out = html;
    for (const token in vars) out = out.split(token).join(vars[token]);

    const wrap = document.createElement('div');
    wrap.style.display = 'none';
    document.body.appendChild(wrap);
    wrap.innerHTML = out;

    wrap.querySelectorAll('[style*="display: flex"]').forEach(el => {
        if (el.style.justifyContent) {
            el.style.textAlign = 'center';
            el.style.justifyContent = '';
        }
        el.style.display = '';
    });
    wrap.querySelectorAll('[style*="width: fit-content"]').forEach(el => {
        el.style.display = 'block';
        el.style.width = '260px';
        el.style.margin = '20px auto 10px auto';
        el.style.textAlign = 'center';
    });
    wrap.querySelectorAll('div[style*="transform: rotate(-3deg)"]').forEach(el => {
        el.style.display = 'block';
        el.style.width = '260px';
        el.style.margin = '20px auto 10px auto';
        el.style.textAlign = 'center';
    });

    const result = wrap.innerHTML;
    wrap.remove();
    return '<div style="background-color:#f8fafc; margin:0; padding:16px 8px; width:100%;">' + result + '</div>';
}

async function sendShareEmail() {
    const input = document.getElementById('shareEmailInput');
    const status = document.getElementById('shareEmailStatus');
    const panel = document.getElementById('shareEmailPanel');
    const email = (input ? input.value : '').trim();
    if (!email) {
        if (status) status.innerHTML = '<span style="color: var(--danger);">Please enter a recipient email address.</span>';
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        if (status) status.innerHTML = '<span style="color: var(--danger);">Please enter a valid email address.</span>';
        return;
    }

    if (status) status.innerHTML = '<span style="color: var(--info);">Sending invoice email...</span>';
    try {
        const res = await fetch('/api/bills/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bill_id: shareData.billId || 0,
                email,
                message: buildEmailInvoice(shareData.htmlMessage) || shareData.message
            })
        });
        if (res.ok) {
            if (status) status.innerHTML = '<span style="color: var(--success);">Invoice emailed successfully to ' + email + '</span>';
            showNotification("Email sent successfully", "success");
            setTimeout(() => { if (panel) panel.classList.add('hidden'); }, 1500);
        } else {
            const err = await res.json().catch(() => ({}));
            if (status) status.innerHTML = '<span style="color: var(--danger);">' + (err.error || 'Email failed') + '</span>';
            showNotification(err.error || "Email failed", "error");
        }
    } catch (e) {
        if (status) status.innerHTML = '<span style="color: var(--danger);">Network error sending email.</span>';
        showNotification("Network error sending email", "error");
    }
}

function closeShareModal() {
    document.getElementById('shareModal').classList.add('hidden');
}

function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    if (modal) modal.classList.add('hidden');
}

/* ===== SECTION: navigation.js ===== */
const AppRouter = {
    sections: {
        'dashboard-section': () => {
            loadDashboardStats();
        },
        'tenants-section': (sub) => {
            const defaultSub = sub || 'tenants-billing';
            switchSubSection('tenants-section', defaultSub);
        },
        'owners-section': (sub) => {
            loadSettings();
            const defaultSub = sub || 'owners-received';
            switchSubSection('owners-section', defaultSub);
        },
        'property-section': (sub) => {
            loadSettings();
            const defaultSub = sub || 'property-units';
            switchSubSection('property-section', defaultSub);
        },
        'settings-section': (sub) => {
            const defaultSub = sub || 'settings-config';
            switchSubSection('settings-section', defaultSub);
        }
    },
    subSections: {
        'owners-received': () => {
            if (typeof loadReceivedPayments === 'function') loadReceivedPayments();
        },
        'tenants-billing': () => {
            loadTenants();
        },
        'tenants-ledger': () => {
            initHistorySection(false);
        },
        'tenants-registry': () => {
            loadSettings();
            loadManageTenants();
            if (typeof loadVault === 'function') loadVault();
        },
        'tenants-vault': () => {
            if (typeof loadVault === 'function') loadVault();
        },
        'tenants-archived': () => {
            if (typeof toggleHistory === 'function') toggleHistory(true);
        },
        'owners-payouts': () => {
            if (typeof populateWithdrawalFilters === 'function') populateWithdrawalFilters();
            if (typeof loadWithdrawals === 'function') loadWithdrawals();
        },
        'owners-accounts': () => {
            loadSettings();
        },
        'settings-config': () => {
            loadSettings();
            if (typeof loadSettingsTenantAccounts === 'function') loadSettingsTenantAccounts();
        },
        'settings-database': () => {
            loadSettings();
        },
        'property-units': () => {
            if (typeof renderPropertyUnitsTable === 'function') renderPropertyUnitsTable();
        },
        'property-expenses': () => {
            loadExpenses();
        },
        'property-maintenance': () => {
            if (typeof loadTasks === 'function') loadTasks();
        },
        'property-audit': () => {
            const fromInput = document.getElementById('auditFromDate');
            const toInput = document.getElementById('auditToDate');
            if (fromInput && toInput && !fromInput.value) {
                if (typeof setAuditPeriod === 'function') setAuditPeriod('current');
            }
        }
    }
};

function showSection(sectionId, subSectionId = null) {
    window.location.hash = sectionId;
    document.querySelectorAll('.app-section').forEach(s => s.classList.add('hidden'));
    
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.remove('hidden');
        if (AppRouter.sections[sectionId]) {
            AppRouter.sections[sectionId](subSectionId);
        }
    }

    document.querySelectorAll('.nav-btn, .bnav-item').forEach(btn => {
        const oc = btn.getAttribute('onclick');
        const isActive = oc && oc.includes(sectionId);
        btn.classList.toggle('active', isActive);
    });

    if (typeof SyncEngine !== 'undefined') SyncEngine.trackSection(sectionId, subSectionId);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Close sidebar on mobile after navigation
    closeSidebar();
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const hamburger = document.querySelector('.hamburger-btn');
    
    if (!sidebar || !overlay) return;
    
    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('active', isOpen);
    
    if (hamburger) {
        hamburger.setAttribute('aria-expanded', isOpen);
        const icon = hamburger.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', isOpen ? 'x' : 'menu');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
    
    // Prevent body scroll when sidebar is open
    document.body.style.overflow = isOpen ? 'hidden' : '';
}

function closeSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const hamburger = document.querySelector('.hamburger-btn');
    
    if (!sidebar || !overlay) return;
    
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
    
    if (hamburger) {
        hamburger.setAttribute('aria-expanded', 'false');
        const icon = hamburger.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', 'menu');
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    }
    
    document.body.style.overflow = '';
}

function switchSubSection(parentSectionId, subSectionId) {
    const parent = document.getElementById(parentSectionId);
    if (!parent) return;
    
    parent.querySelectorAll('.sub-section').forEach(ss => ss.classList.add('hidden'));
    
    const target = document.getElementById(subSectionId);
    if (target) {
        target.classList.remove('hidden');
        if (AppRouter.subSections[subSectionId]) {
            AppRouter.subSections[subSectionId]();
        }
    }
    
    parent.querySelectorAll('.sub-nav-btn').forEach(btn => {
        const oc = btn.getAttribute('onclick');
        const isActive = oc && oc.includes(subSectionId);
        btn.classList.toggle('active', isActive);
    });
    
    if (typeof SyncEngine !== 'undefined') SyncEngine.trackSection(parentSectionId, subSectionId);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function quickRegisterTenant() {
    showSection('tenants-section', 'tenants-billing');
    const form = document.getElementById('entrance-form');
    if (form && form.classList.contains('hidden')) {
        toggleRegForm();
    } else if (form) {
        form.scrollIntoView({ behavior: 'smooth' });
    }
}

function quickRecordPayout() {
    showSection('owners-section', 'owners-payouts');
    const form = document.getElementById('withdrawal-form');
    if (form && form.classList.contains('hidden')) {
        toggleWithdrawalForm();
    } else if (form) {
        form.scrollIntoView({ behavior: 'smooth' });
    }
}

function quickAddExpense() {
    showSection('settings-section', 'settings-expenses');
    const form = document.getElementById('expense-form');
    if (form && form.classList.contains('hidden')) {
        toggleExpenseForm();
    } else if (form) {
        form.scrollIntoView({ behavior: 'smooth' });
    }
}

function quickDownloadBackup() {
    if (typeof backupDatabase === 'function') {
        backupDatabase();
    } else {
        showSection('settings-section', 'settings-database');
    }
}

function quickPay(renterId, billId, amount) {
    if (typeof openTenantLedgerModal === 'function') {
        openTenantLedgerModal(renterId);
    } else if (typeof openTenantDetailModal === 'function') {
        openTenantDetailModal(renterId);
    } else {
        showSection('tenants-section');
    }
}

let currentOnboardingStep = 0;

const onboardingSteps = [
    {
        title: "Step 1: Setup Bank & UPI Accounts",
        icon: "wallet",
        desc: "Before registering tenants or generating bills, configure your property receiving accounts (UPI ID / Bank details). This assigns payments to correct property accounts.",
        actionText: "Configure Receiving Accounts",
        actionFn: () => {
            closeOnboardingModal();
            showSection('owners-section', 'owners-accounts');
        }
    },
    {
        title: "Step 2: Register Units & Tenants",
        icon: "users",
        desc: "Add your active tenants with Room Number, Base Rent, Move-in Date, and 11-Month Expiry. Choose between Fixed Rate Water (e.g. ₹200/mo flat) or Water Meter Unit Calculation.",
        actionText: "Register First Unit / Tenant",
        actionFn: () => {
            closeOnboardingModal();
            showSection('tenants-section', 'tenants-registry');
            if (document.getElementById('entrance-form')?.classList.contains('hidden')) {
                toggleRegForm();
            }
        }
    },
    {
        title: "Step 3: Generate Monthly Bills & Batch Billing",
        icon: "zap",
        desc: "Create individual bills or use 1-Click Batch Billing to generate invoices for all occupied units simultaneously with automatic EB and Water meter unit mathematics.",
        actionText: "Open Batch Billing Grid",
        actionFn: () => {
            closeOnboardingModal();
            if (typeof openBatchBillingModal === 'function') openBatchBillingModal();
        }
    },
    {
        title: "Step 4: Verify Payment Proofs & WhatsApp Reminders",
        icon: "check-square",
        desc: "Tenants can upload UPI payment screenshots from their portal. Review UTR transaction numbers directly on your Admin Dashboard with 1-click Approve/Reject actions, or send 1-click WhatsApp reminders.",
        actionText: "Go to Admin Dashboard",
        actionFn: () => {
            closeOnboardingModal();
            showSection('dashboard-section');
        }
    },
    {
        title: "Step 5: 11-Month Lease Agreement Renewal",
        icon: "file-clock",
        desc: "The app automatically monitors 11-month rental agreements expiring within 30 days. Extend lease validity by 11 months anytime with 1 click.",
        actionText: "View Expiring Agreements",
        actionFn: () => {
            closeOnboardingModal();
            showSection('dashboard-section');
            document.getElementById('cardLeaseExpiries')?.scrollIntoView({ behavior: 'smooth' });
        }
    }
];

function openOnboardingModal(step = 0) {
    currentOnboardingStep = step;
    const modal = document.getElementById('onboardingOverlay');
    if (modal) {
        modal.classList.remove('hidden');
        renderOnboardingStep(currentOnboardingStep);
    }
}

function closeOnboardingModal() {
    const modal = document.getElementById('onboardingOverlay');
    if (modal) modal.classList.add('hidden');
    localStorage.setItem('rentbill_onboarded', 'true');
}

function renderOnboardingStep(index) {
    currentOnboardingStep = index;
    const step = onboardingSteps[index];
    const body = document.getElementById('onboardingStepBody');
    const counter = document.getElementById('onboardStepCounter');
    const prevBtn = document.getElementById('btnOnboardPrev');
    const nextBtn = document.getElementById('btnOnboardNext');

    if (counter) counter.innerText = `Step ${index + 1} of ${onboardingSteps.length}`;
    if (prevBtn) prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
    if (nextBtn) nextBtn.innerText = index === onboardingSteps.length - 1 ? 'Finish Tour' : 'Next';

    for (let i = 0; i < onboardingSteps.length; i++) {
        const pill = document.getElementById(`onboardPill-${i}`);
        if (pill) {
            if (i === index) {
                pill.style.background = 'var(--primary)';
                pill.style.color = 'white';
                pill.style.borderColor = 'var(--primary)';
            } else {
                pill.style.background = 'var(--bg-card)';
                pill.style.color = 'var(--text-main)';
                pill.style.borderColor = 'var(--border)';
            }
        }
    }

    if (body) {
        body.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 1rem; align-items: flex-start;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="width: 44px; height: 44px; background: var(--primary-light); color: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <i data-lucide="${step.icon}" style="width: 24px; height: 24px;"></i>
                    </div>
                    <h4 style="font-size: 1.05rem; font-weight: 900; color: var(--text-main); margin: 0;">${step.title}</h4>
                </div>
                <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.5; margin: 0;">${step.desc}</p>
                <div style="margin-top: 0.5rem; width: 100%;">
                    <button onclick="onboardingSteps[${index}].actionFn()" class="btn btn-primary" style="width: 100%; height: 44px; border-radius: 10px; font-weight: 800; display: flex; align-items: center; justify-content: center; gap: 8px;">
                        <i data-lucide="arrow-right-circle" style="width: 18px; height: 18px;"></i> ${step.actionText}
                    </button>
                </div>
            </div>
        `;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}

function onboardingNextStep() {
    if (currentOnboardingStep < onboardingSteps.length - 1) {
        renderOnboardingStep(currentOnboardingStep + 1);
    } else {
        closeOnboardingModal();
    }
}

function onboardingPrevStep() {
    if (currentOnboardingStep > 0) {
        renderOnboardingStep(currentOnboardingStep - 1);
    }
}

/* ===== SECTION: dashboard.js ===== */
async function loadDashboardStats() {
    const refreshBtn = document.querySelector('button[onclick="loadDashboardStats()"]');
    if (refreshBtn) refreshBtn.classList.add('loading-spin');

    try {
        const [tenants, expenses, finSummary, withdrawals, tenantLedger, paidBills, pendingBills] = await Promise.all([ 
            API.tenants.getAll(), 
            API.expenses.getAll(),
            API.bills.getFinancialSummary(),
            API.withdrawals.getAll(),
            API.bills.getTenantLedger(),
            API.bills.getAllPaidBills(),
            API.bills.getPendingBills()
        ]);
        
        window.dashboardState = { tenants, expenses, finSummary, withdrawals, tenantLedger, allPaidBills: paidBills, allPendingBills: pendingBills };

        const statActive = document.getElementById('statActive');
        const statAdvance = document.getElementById('statTotalAdvance');
        const statRent = document.getElementById('statTotalRent');
        const statPending = document.getElementById('statTotalPending');

        if (statActive) statActive.innerText = tenants.filter(t => t.is_active === 1).length;
        if (statAdvance) statAdvance.innerText = currencyFormatter.format(finSummary.total_advances || 0);
        
        const totalRent = tenants.filter(t => t.is_active === 1).reduce((sum, t) => sum + (t.base_rent || 0), 0);
        if (statRent) statRent.innerText = currencyFormatter.format(totalRent);
        
        const totalPending = tenantLedger.filter(e => e.balance > 0).reduce((sum, e) => sum + e.balance, 0);
        if (statPending) statPending.innerText = currencyFormatter.format(totalPending);

        populateDashboardPropertyFilter();

        filterDashboardByProperty();
        loadActivityLogs();

        if (refreshBtn) refreshBtn.classList.remove('loading-spin');
    } catch (e) {
        console.error("Dashboard Load Failed", e);
        if (refreshBtn) refreshBtn.classList.remove('loading-spin');
    }
}

async function loadActivityLogs() {
    const filter = document.getElementById('activityFilter')?.value || 'ALL';
    const container = document.getElementById('activityLog');
    if (!container) return;

    API.system.getLogs(filter).then(logs => {
        if (!logs || logs.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 2rem;">
                    <i data-lucide="inbox" style="width: 32px; height: 32px; opacity: 0.5;"></i>
                    <p style="font-size: 0.8rem; font-weight: 500; margin: 0;">No activity found</p>
                </div>
            `;
            if (typeof lucide !== 'undefined') lucide.createIcons();
            return;
        }

        container.innerHTML = logs.map(l => {
            let icon = 'info';
            let color = 'var(--text-muted)';
            if (l.action.includes('PAYMENT')) { icon = 'check-circle'; color = 'var(--success)'; }
            if (l.action.includes('BILL')) { icon = 'file-text'; color = 'var(--warning)'; }
            if (l.action.includes('EXPENSE')) { icon = 'trending-down'; color = 'var(--danger)'; }
            if (l.action.includes('OWNER_PAYOUT')) { icon = 'wallet'; color = 'var(--primary)'; }
            if (l.action.includes('TENANT')) { icon = 'user'; color = 'var(--primary)'; }
            if (l.action.includes('MAINTENANCE')) { icon = 'wrench'; color = 'var(--info)'; }
            if (l.action.includes('DOCUMENT')) { icon = 'file'; color = 'var(--info)'; }

            const dateObj = new Date(l.timestamp);
            const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
            const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

            return `
                <div class="list-item" role="listitem">
                    <div class="list-item-avatar" style="background: ${color}15; color: ${color};">
                        <i data-lucide="${icon}" style="width: 16px; height: 16px;"></i>
                    </div>
                    <div class="list-item-content">
                        <div class="list-item-title">${l.details}</div>
                        <div class="list-item-subtitle">${l.action.replace(/_/g, ' ')}</div>
                    </div>
                    <div class="list-item-meta">
                        <span class="list-item-time">${dateStr}</span>
                        <span class="list-item-time">${time}</span>
                    </div>
                </div>
            `;
        }).join('');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    });
}

async function populateActionQueues(tenants, ledger) {
    const now = new Date();
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const billingTargetMonth = prevMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const currentMonthLabel = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const qBilling = document.getElementById('queueBilling');
    if (qBilling) {
        const day = now.getDate();
        const countEl = document.getElementById('countBilling');
        
        const report = await API.bills.getMonthlyReport(billingTargetMonth) || [];
        const unbilled = report.filter(u => !u.is_billed);
        
        if (countEl) countEl.innerText = unbilled.length;
        
        if (unbilled.length > 0) {
            const isOverdue = day > 3;
            qBilling.innerHTML = unbilled.map(u => `
                <div onclick="draftBillNow(${u.renter_id}, '${billingTargetMonth}')" class="tenant-row" style="padding: 0.75rem; cursor: pointer; display: flex; justify-content: space-between; align-items: center; border: 1.5px solid ${isOverdue ? 'var(--danger)' : 'var(--border)'}; border-radius: 10px; background: ${isOverdue ? 'var(--bg-danger-light)' : 'transparent'};">
                    <div style="min-width: 0; flex: 1;">
                        <div style="font-weight: 800; font-size: 0.85rem; color: ${isOverdue ? 'var(--danger)' : 'var(--text-main)'};">${u.name}</div>
                        <div style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Unit ${u.room_no} • ${billingTargetMonth}</div>
                    </div>
                    <div style="font-size: 0.7rem; font-weight: 900; color: ${isOverdue ? 'var(--danger)' : 'var(--warning)'}; text-transform: uppercase; letter-spacing: 0.5px;">
                        ${isOverdue ? '⚠️ OVERDUE' : 'Create Bill'}
                    </div>
                </div>
            `).join('');
            
            if (isOverdue) {
                const warningHeader = `<div style="padding: 0.5rem; background: var(--danger); color: white; border-radius: 8px; font-size: 0.65rem; font-weight: 900; text-align: center; margin-bottom: 0.5rem; letter-spacing: 1px;">BIG WARNING: ${billingTargetMonth.toUpperCase()} BILLING OVERDUE</div>`;
                qBilling.insertAdjacentHTML('afterbegin', warningHeader);
            }
        } else {
            qBilling.innerHTML = '<p style="text-align:center; font-size:0.7rem; color:var(--text-muted); padding: 1rem;">All units billed for ' + billingTargetMonth + '.</p>';
        }
    }

    const qProofs = document.getElementById('queuePendingProofs');
    if (qProofs) {
        try {
            const proofs = await API.bills.getPendingProofs() || [];
            const countEl = document.getElementById('countPendingProofs');
            if (countEl) countEl.innerText = proofs.length;

            if (proofs.length > 0) {
                qProofs.innerHTML = proofs.map(p => `
                    <div class="tenant-row" style="padding: 0.75rem; border: 1.5px solid var(--success); border-radius: 10px; background: var(--bg-success-light); display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                        <div style="min-width: 0; flex: 1;">
                            <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-main);">${p.renter_name} (Unit ${p.room_no})</div>
                            <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700;">
                                ${p.billing_month} • Ref: <span style="user-select: all; color: var(--primary);">${p.proof_ref || 'N/A'}</span>
                            </div>
                        </div>
                        <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                            <div style="font-weight: 950; font-size: 0.9rem; color: var(--success);">${currencyFormatter.format(p.total_amount)}</div>
                            <div style="display: flex; gap: 4px;">
                                ${p.proof_photo ? `<a href="${p.proof_photo}" target="_blank" class="btn btn-secondary btn-sm" style="padding: 2px 6px; font-size: 0.6rem; border-radius: 4px;" title="View Image">📷 View</a>` : ''}
                                <button onclick="approveProof(${p.bill_id})" class="btn btn-success btn-sm" style="padding: 2px 8px; font-size: 0.65rem; border-radius: 4px; font-weight: 800;" title="Approve">✓ Approve</button>
                                <button onclick="rejectProof(${p.bill_id})" class="btn btn-danger btn-sm" style="padding: 2px 6px; font-size: 0.65rem; border-radius: 4px; font-weight: 800;" title="Reject">✕</button>
                            </div>
                        </div>
                    </div>
                `).join('');
            } else {
                qProofs.innerHTML = '<p style="text-align:center; font-size:0.7rem; color:var(--text-muted); padding: 0.75rem;">No payment approvals pending.</p>';
            }
        } catch (e) {
            console.error("Failed to load pending proofs", e);
        }
    }

    const qExpiries = document.getElementById('queueLeaseExpiries');
    if (qExpiries) {
        try {
            const expiries = await API.tenants.getExpiringAgreements() || [];
            const countEl = document.getElementById('countLeaseExpiries');
            if (countEl) countEl.innerText = expiries.length;

            if (expiries.length > 0) {
                qExpiries.innerHTML = expiries.map(e => {
                    const badgeText = e.is_expired ? `EXPIRED ${Math.abs(e.days_left)} DAYS AGO` : `EXPIRES IN ${e.days_left} DAYS`;
                    const badgeBg = e.is_expired ? 'var(--bg-danger-light)' : 'var(--bg-warning-light)';
                    const badgeColor = e.is_expired ? 'var(--danger)' : 'var(--warning)';

                    return `
                        <div class="tenant-row" style="padding: 0.75rem; border: 1.5px solid ${badgeColor}; border-radius: 10px; background: ${badgeBg}; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                            <div style="min-width: 0; flex: 1;">
                                <div style="font-weight: 800; font-size: 0.85rem; color: var(--text-main);">${e.name} (Unit ${e.room_no})</div>
                                <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700;">
                                    Expiry Date: ${dateOnly(e.agreement_expiry_date)}
                                </div>
                            </div>
                            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                                <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; border-color: ${badgeColor}; font-size: 0.55rem; padding: 2px 6px;">${badgeText}</span>
                                <button onclick="renewLeaseAgreement(${e.id})" class="btn btn-primary btn-sm" style="padding: 2px 8px; font-size: 0.65rem; border-radius: 4px; font-weight: 800;" title="Renew Lease for 11 Months">
                                    <i data-lucide="rotate-cw" style="width: 12px; height: 12px;"></i> Renew (+11 Mos)
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            } else {
                qExpiries.innerHTML = '<p style="text-align:center; font-size:0.7rem; color:var(--text-muted); padding: 0.75rem;">All lease agreements up to date!</p>';
            }
        } catch (err) {
            console.error("Failed to load expiring agreements", err);
        }
    }

    const qTasks = document.getElementById('queueTasks');
    if (qTasks) {
        try {
            const tasks = await API.maintenance.getAll();
            const openTasks = tasks.filter(t => t.status !== 'Resolved').slice(0, 10);
            
            const countEl = document.getElementById('countTasks');
            if (countEl) countEl.innerText = openTasks.length;
            
            qTasks.innerHTML = openTasks.length ? openTasks.map(t => `
                <div onclick="showSection('settings-section', 'settings-maintenance')" class="tenant-row" style="padding: 0.75rem; cursor: pointer; border: 1.5px solid var(--border); border-radius: 10px;">
                    <div style="font-weight: 800; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${t.title}</div>
                    <div style="display:flex; justify-content: space-between; margin-top: 4px;">
                        <div style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted);">${t.unit_room}</div>
                        <div class="badge" style="font-size: 0.55rem; padding: 2px 6px; background: ${t.status === 'Pending' ? 'var(--bg-danger-light)' : 'var(--bg-warning-light)'}; color: ${t.status === 'Pending' ? 'var(--danger)' : 'var(--warning)'};">${t.status}</div>
                    </div>
                </div>
            `).join('') : '<p style="text-align:center; font-size:0.7rem; color:var(--text-muted); padding: 1rem;">No pending tasks.</p>';
        } catch(e) { qTasks.innerHTML = ''; }
    }
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function updateMonthlyTracker(tenants) {
    const container = document.getElementById('monthlyTracker');
    if (!container) return;

    const now = new Date();
    const monthStr = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    
    API.bills.getMonthlyReport(monthStr).then(report => {
        if (!report || report.length === 0) {
            container.innerHTML = '<p style="text-align:center; font-size:0.7rem;">No data.</p>';
            return;
        }
        container.innerHTML = report.map(u => `
            <div title="Unit ${u.room_no}: ${u.is_paid ? 'Paid' : (u.is_billed ? 'Unpaid' : 'Not Billed')}" style="width: 14px; height: 14px; border-radius: 4px; background: ${u.is_paid ? 'var(--success)' : (u.is_billed ? 'var(--warning)' : 'var(--border)')};"></div>
        `).join('');
    }).catch(e => console.error(e));
}

function updateOwnerSettlements(paidBills, expenses, withdrawals) {
    const dashboardList = document.getElementById('ownerSettlementList');
    const detailedList = document.getElementById('detailedOwnerSettlementList');
    
    if (!dashboardList && !detailedList) return;

    const settlements = {};
    
    if (appSettings.receiving_accounts) {
        appSettings.receiving_accounts.forEach(acc => {
            if (!settlements[acc.owner_name]) {
                settlements[acc.owner_name] = { income: 0, expenses: 0, payouts: 0 };
            }
        });
    }

    paidBills.forEach(b => {
        const owner = b.received_by || b.assigned_owner || 'Building';
        if (!settlements[owner]) settlements[owner] = { income: 0, expenses: 0, payouts: 0 };
        settlements[owner].income += (b.paid_amount || 0);
    });

    expenses.forEach(e => {
        const owner = e.owner_name || 'Building';
        if (!settlements[owner]) settlements[owner] = { income: 0, expenses: 0, payouts: 0 };
        settlements[owner].expenses += (e.amount || 0);
    });

    withdrawals.forEach(w => {
        const owner = w.owner_name || 'Building';
        if (!settlements[owner]) settlements[owner] = { income: 0, expenses: 0, payouts: 0 };
        settlements[owner].payouts += (w.amount || 0);
    });

    const owners = Object.keys(settlements);
    const html = owners.length === 0 
        ? '<p style="text-align:center; font-size:0.7rem; color:var(--text-muted);">No owners found.</p>'
        : owners.map(name => {
            const s = settlements[name];
            const net = s.income - s.expenses - s.payouts;
            return `
                <div class="tenant-row" style="padding: 1rem; border: 1.5px solid var(--border); border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <div style="font-weight: 900; font-size: 0.9rem;">${name}</div>
                        <div style="font-size: 0.6rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-top: 4px;">
                            Income: ₹${s.income.toFixed(0)} | Outflow: ₹${(s.expenses + s.payouts).toFixed(0)}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Final Payable</div>
                        <div style="font-weight: 950; font-size: 1.1rem; color: ${net > 0 ? 'var(--success)' : 'var(--text-muted)'};">
                            ${currencyFormatter.format(net)}
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    if (dashboardList) dashboardList.innerHTML = html;
    if (detailedList) detailedList.innerHTML = html;
}

function loadTrendChart(owner) {
    const ctx = document.getElementById('trendChart');
    if (!ctx) return;

    API.bills.getTrends(owner).then(data => {
        if (!data || data.length === 0) return;

        const isDark = document.body.classList.contains('dark-mode');
        const textColor = isDark ? '#94a3b8' : '#64748b';

        if (window.myTrendChart) window.myTrendChart.destroy();

        window.myTrendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.map(d => d.month),
                datasets: [
                    {
                        label: 'Income',
                        data: data.map(d => d.income),
                        borderColor: '#10b981',
                        backgroundColor: '#10b98120',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    },
                    {
                        label: 'Outflow',
                        data: data.map(d => d.expenses),
                        borderColor: '#ef4444',
                        backgroundColor: '#ef444410',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: true,
                        tension: 0.4,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { display: false, beginAtZero: true },
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { size: 10, weight: 'bold' } }
                    }
                }
            }
        });
    });
}

let currentDashboardOwnerFilter = '';

function filterDashboardByProperty() {
    const filter = document.getElementById('dashboardPropertyFilter')?.value || '';
    currentDashboardOwnerFilter = filter;
    
    if (!window.dashboardState) return;
    const { tenants, expenses, finSummary, withdrawals, tenantLedger, allPaidBills, allPendingBills } = window.dashboardState;
    
    const filteredTenants = filter ? tenants.filter(t => t.assigned_upi === filter) : tenants;
    const filteredLedger = filter ? tenantLedger.filter(t => t.assigned_owner === filter) : tenantLedger;
    const filteredPaidBills = filter ? allPaidBills.filter(b => (b.received_by || b.assigned_owner) === filter) : allPaidBills;
    const filteredPendingBills = filter ? allPendingBills.filter(b => (b.received_by || b.assigned_owner) === filter) : allPendingBills;
    const filteredExpenses = filter ? expenses.filter(e => e.owner_name === filter) : expenses;
    const filteredWithdrawals = filter ? withdrawals.filter(w => w.owner_name === filter) : withdrawals;

    const statActive = document.getElementById('statActive');
    const statAdvance = document.getElementById('statTotalAdvance');
    const statRent = document.getElementById('statTotalRent');

    if (statActive) statActive.innerText = filteredTenants.filter(t => t.is_active === 1).length;
    
    const totalAdvance = filteredTenants.filter(t => t.is_active === 1).reduce((sum, t) => sum + (t.advance_amount || 0), 0);
    if (statAdvance) statAdvance.innerText = currencyFormatter.format(totalAdvance);
    
    const totalRent = filteredTenants.filter(t => t.is_active === 1).reduce((sum, t) => sum + (t.base_rent || 0), 0);
    if (statRent) statRent.innerText = currencyFormatter.format(totalRent);

    populateActionQueues(filteredTenants, filteredLedger);

    updateMonthlyTracker(filteredTenants);
    updateOwnerSettlements(filteredPaidBills, filteredExpenses, filteredWithdrawals);
    if (typeof loadTrendChart === 'function') loadTrendChart(filter);
    if (typeof loadCollectionsChart === 'function') loadCollectionsChart(filteredPendingBills, filteredPaidBills);
    if (typeof loadExpenseCategoryChart === 'function') loadExpenseCategoryChart(filteredExpenses);
}

function populateDashboardPropertyFilter() {
    const filterSelect = document.getElementById('dashboardPropertyFilter');
    if (!filterSelect || !appSettings.receiving_accounts) return;
    
    const currentVal = filterSelect.value;
    
    filterSelect.innerHTML = '<option value="">All Buildings</option>';
    appSettings.receiving_accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.owner_name;
        opt.innerText = `${acc.owner_name.toUpperCase()} • ${acc.label.toUpperCase()}`;
        filterSelect.appendChild(opt);
    });
    
     if (currentVal && Array.from(filterSelect.options).some(o => o.value === currentVal)) {
        filterSelect.value = currentVal;
    }
}

async function approveProof(billId) {
    try {
        await API.bills.verifyProof(billId, 'approve', 'UPI / Online');
        showNotification("Payment approved & bill marked paid!", "success");
        loadDashboardStats();
    } catch (e) {
        showNotification(e.message || "Failed to approve payment", "error");
    }
}

async function rejectProof(billId) {
    if (!confirm("Are you sure you want to reject this payment proof?")) return;
    try {
        await API.bills.verifyProof(billId, 'reject');
        showNotification("Payment proof rejected", "info");
        loadDashboardStats();
    } catch (e) {
        showNotification(e.message || "Failed to reject proof", "error");
    }
}

async function renewLeaseAgreement(id) {
    try {
        const res = await API.tenants.renewAgreement(id);
        showNotification(res.message || "Agreement renewed for 11 months!", "success");
        loadDashboardStats();
    } catch (e) {
        showNotification(e.message || "Failed to renew agreement", "error");
    }
}

/* ===== SECTION: app.js ===== */
let appSettings = {};
let editMode = false;
let editId = null;
window.allTenants = [];
window.historyTenants = [];

window.onload = async () => {
    injectTemplates();
    applyTheme();
    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        await loadSettings();
        await refreshGlobalTenantCache();
        applyPermissions();
        if (!localStorage.getItem('rentbill_onboarded')) {
            setTimeout(() => {
                if (typeof openOnboardingModal === 'function') openOnboardingModal(0);
            }, 600);
        }
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
    initNetworkListeners();
};

function initNetworkListeners() {
    const updateStatus = () => {
        const indicator = document.getElementById('offlineIndicator');
        if (indicator) {
            indicator.classList.toggle('hidden', navigator.onLine);
            if (typeof lucide !== 'undefined') lucide.createIcons();
        }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    window.addEventListener('sync-complete', () => {
        loadDashboardStats();
        refreshGlobalTenantCache();
    });
    
    updateStatus();
}

function applyPermissions() {
    const role = localStorage.getItem('userRole') || 'owner';
    if (role === 'staff') {
        document.body.classList.add('role-staff');
        document.querySelectorAll('button[onclick*="settings-section"]').forEach(btn => btn.style.display = 'none');
        
        document.querySelectorAll('button[onclick*="owners-section"]').forEach(btn => btn.style.display = 'none');

        const style = document.createElement('style');
        style.id = 'staff-permissions-style';
        style.innerHTML = `
            .role-staff .btn-danger:not(.logout-btn):not([onclick*="logout"]), 
            .role-staff .delete-btn,
            .role-staff button[onclick*="delete"],
            .role-staff button[onclick*="markVacant"],
            .role-staff #settings-audit,
            .role-staff #settings-database,
            .role-staff .no-staff { 
                display: none !important; 
            }
        `;
        document.head.appendChild(style);
    }
}

async function refreshGlobalTenantCache() {
    try {
        const [active, history] = await Promise.all([
            API.tenants.getAll(),
            API.tenants.getHistory()
        ]);
        window.allTenants = active || [];
        window.historyTenants = history || [];
    } catch (e) { console.error("Cache refresh failed", e); }
}



function injectTemplates() {
    document.getElementById('pinOverlay').innerHTML = Templates.authOverlay;
    document.getElementById('modalContainer').innerHTML = Templates.modals;
    const mainApp = document.getElementById('mainApp');
    mainApp.innerHTML = `
        ${Templates.navigation}
        <main class="content">
            ${Templates.dashboard}
            ${Templates.tenants}
            ${Templates.owners}
            ${Templates.property}
            ${Templates.settings}
        </main>
    `;
}

async function confirmActionWithPin() {
    const pinInput = document.getElementById('deletePinInput');
    if (!pinInput) return;
    const pin = pinInput.value;
    if (!pin) return showNotification("PIN required", "error");

    try {
        await API.auth.checkPin(pin);
        
        if (typeof pendingDeleteId !== 'undefined' && pendingDeleteId) {
            await API.tenants.delete(pendingDeleteId);
            showNotification("Removed", "success");
            if (typeof resetForm === 'function') resetForm();
            showSection('tenants-section');
            pendingDeleteId = null;
        } else if (typeof pendingDeleteBillId !== 'undefined' && pendingDeleteBillId) {
            await API.bills.delete(pendingDeleteBillId);
            showNotification("Deleted", "success");
            showSection('tenants-section');
            pendingDeleteBillId = null;
        }
        
        closeDeleteModal();
        if (typeof loadManageTenants === 'function') loadManageTenants();
        if (typeof loadDashboardStats === 'function') loadDashboardStats();
    } catch (e) {
        showNotification(e.message || "Authorization failed", "error");
    }
}

function closeDeleteModal() {
    const modal = document.getElementById('deletePinModal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('modal-open');
    if (typeof pendingDeleteId !== 'undefined') pendingDeleteId = null;
    if (typeof pendingDeleteBillId !== 'undefined') pendingDeleteBillId = null;
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(modal => {
            if (modal.id === 'pinOverlay' && !localStorage.getItem('isLoggedIn')) return;
            modal.classList.add('hidden');
        });
        
        if (typeof closeSettlementModal === 'function') closeSettlementModal();
        if (typeof closePaymentModal === 'function') closePaymentModal();
        if (typeof closePreviewModal === 'function') closePreviewModal();
        if (typeof closeShareModal === 'function') closeShareModal();
        if (typeof closeTaskModal === 'function') closeTaskModal();
        if (typeof toggleTaskForm === 'function' && document.getElementById('maintenance-form') && !document.getElementById('maintenance-form').classList.contains('hidden')) toggleTaskForm();
        if (typeof toggleUploadForm === 'function' && document.getElementById('uploadModal') && !document.getElementById('uploadModal').classList.contains('hidden')) toggleUploadForm();
    }
});
