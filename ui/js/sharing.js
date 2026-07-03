let shareData = { type: '', id: null, message: '', htmlMessage: '', mobile: '', email: '', billId: null };

async function printProfessionalAgreement(id) {
    try {
        const res = await fetch(`/api/renter/${id}`);
        const t = await res.json();

        const moveInRaw = new Date(t.move_in_date);
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const formattedMoveIn = `${moveInRaw.getFullYear()}-${months[moveInRaw.getMonth()]}-${moveInRaw.getDate().toString().padStart(2, '0')}`;

        // Multi-Property Logic: Use Owner's specific branding if available
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

        const htmlMessage = `
            <div style="background-color: #f8f9fa; padding: 10px; font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.4; max-width: 800px; margin: 0 auto; box-sizing: border-box;">
                <div style="background: white; border: 1px solid #e0e0e0; padding: 25px; border-radius: 8px; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.05); min-height: 27cm;">
                    <!-- Top Header -->
                    <div style="text-align: center; border-bottom: 2px solid var(--primary); padding-bottom: 12px; margin-bottom: 20px;">
                        <h2 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900; color: var(--primary); letter-spacing: 1px;">${propName}</h2>
                        <p style="margin: 4px 0 8px 0; font-size: 11px; color: #666; font-weight: 600;">${propAddr}</p>
                        <div style="display: flex; justify-content: center; gap: 10px; align-items: center; margin-top: 8px;">
                            <span style="background: var(--primary); color: #fff; padding: 4px 18px; font-weight: 900; letter-spacing: 1.5px; font-size: 15px; border-radius: 6px; display: inline-block;">RENTAL AGREEMENT</span>
                        </div>
                        <p style="margin: 8px 0 0 0; font-size: 9px; font-weight: 800; color: #999; text-transform: uppercase; letter-spacing: 1px;">OFFICIAL RECORD NO: RB/${new Date().getFullYear()}/${t.room_no}/${t.id}</p>
                    </div>

                    <!-- Layout Grid -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                        <!-- Tenant Details -->
                        <div style="background: #fcfcfc; padding: 12px; border-radius: 10px; border: 1px solid #eee;">
                            <p style="margin: 0 0 8px 0; font-size: 10px; color: var(--primary); text-transform: uppercase; letter-spacing: 1.2px; font-weight: 900; border-bottom: 1px solid #eee; padding-bottom: 5px;">Tenant Information</p>
                            <p style="margin: 0; font-size: 18px; font-weight: 900; color: #000;">${t.name}</p>
                            <p style="margin: 4px 0 8px 0; font-size: 11px; font-weight: 700; color: #555;">UNIT: <span style="color: var(--primary); font-weight: 900;">${t.room_no}</span></p>
                            
                            <table style="width: 100%; font-size: 10px; border-collapse: collapse;">
                                <tr><td style="padding: 3px 0; color: #777; font-weight: 700;">AADHAR</td><td style="padding: 3px 0; font-weight: 800; text-align: right;">${t.aadhar_no || 'N/A'}</td></tr>
                                <tr><td style="padding: 3px 0; color: #777; font-weight: 700;">MOBILE</td><td style="padding: 3px 0; font-weight: 800; text-align: right;">+91 ${t.mobile_number || 'N/A'}</td></tr>
                                <tr><td style="padding: 3px 0; color: #777; font-weight: 700;">OCCUPATION</td><td style="padding: 3px 0; font-weight: 800; text-align: right;">${t.occupation || 'N/A'}</td></tr>
                            </table>
                            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #eee;">
                                <p style="margin: 0; font-size: 9px; color: #777; font-weight: 700; text-transform: uppercase;">Permanent Address</p>
                                <p style="margin: 3px 0 0 0; font-size: 10px; font-weight: 600; color: #333; line-height: 1.3;">${t.perm_address || 'Not provided'}</p>
                            </div>
                        </div>

                        <!-- Lease Terms -->
                        <div style="background: #fcfcfc; padding: 12px; border-radius: 10px; border: 1px solid #eee;">
                            <p style="margin: 0 0 8px 0; font-size: 10px; color: var(--primary); text-transform: uppercase; letter-spacing: 1.2px; font-weight: 900; border-bottom: 1px solid #eee; padding-bottom: 5px;">Lease & Financials</p>
                            <table style="width: 100%; font-size: 11px; border-collapse: collapse;">
                                <tr><td style="padding: 5px 0; color: #777; font-weight: 700;">START DATE</td><td style="padding: 5px 0; font-weight: 900; text-align: right;">${formattedMoveIn}</td></tr>
                                <tr><td style="padding: 5px 0; color: #777; font-weight: 700;">MONTHLY RENT</td><td style="padding: 5px 0; font-weight: 900; text-align: right; color: #000;">${currencyFormatter.format(t.base_rent)}</td></tr>
                                <tr><td style="padding: 5px 0; color: #777; font-weight: 700;">MAINTENANCE</td><td style="padding: 5px 0; font-weight: 900; text-align: right; color: #000;">${currencyFormatter.format(t.water_maint)}</td></tr>
                                <tr><td style="padding: 5px 0; color: #777; font-weight: 700;">EB UNIT RATE</td><td style="padding: 5px 0; font-weight: 900; text-align: right; color: #000;">${currencyFormatter.format(t.eb_unit_price)}</td></tr>
                                <tr style="border-top: 2px solid var(--primary);"><td style="padding: 8px 0; color: var(--primary); font-weight: 900; font-size: 12px;">SECURITY DEPOSIT</td><td style="padding: 8px 0; font-weight: 900; text-align: right; color: var(--primary); font-size: 14px;">${currencyFormatter.format(t.advance_amount)}</td></tr>
                            </table>
                        </div>
                    </div>

                    <!-- Terms -->
                    <div style="margin-bottom: 25px; border: 1px solid #eee; padding: 15px; border-radius: 10px; background: #fff;">
                        <p style="margin: 0 0 12px 0; font-size: 10px; color: var(--primary); text-transform: uppercase; letter-spacing: 1.2px; font-weight: 900; border-bottom: 1px solid #eee; padding-bottom: 5px;">Terms</p>
                        <div style="font-size: 10px; line-height: 1.5; color: #333; text-align: justify; columns: 1;">
                            ${propTerms.split('\n').map((line, index) => line.trim() ? `<p style="margin: 0 0 8px 0;"><strong>${index + 1}.</strong> ${line}</p>` : '').join('')}
                        </div>
                    </div>

                    <!-- Signature Section -->
                    <div style="margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; padding: 0 20px;">
                        <div style="text-align: center;">
                            <div style="border-top: 1.5px solid #000; padding-top: 8px;">
                                <p style="margin: 0; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Owner Signature</p>
                                <p style="margin: 3px 0 0 0; font-size: 9px; color: #777; font-weight: 600;">Authorized Signatory</p>
                            </div>
                        </div>
                        <div style="text-align: center;">
                            <div style="border-top: 1.5px solid #000; padding-top: 8px;">
                                <p style="margin: 0; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">Tenant Signature</p>
                                <p style="margin: 3px 0 0 0; font-size: 9px; color: #777; font-weight: 600;">(By signing, I agree to the terms)</p>
                            </div>
                        </div>
                    </div>

                    <!-- Witnesses -->
                    <div style="margin-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; padding: 0 20px; opacity: 0.6;">
                        <div style="border-top: 1px dashed #999; padding-top: 6px; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #666;">Witness 1 Name & Signature</div>
                        <div style="border-top: 1px dashed #999; padding-top: 6px; font-size: 8px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #666;">Witness 2 Name & Signature</div>
                    </div>

                    <!-- Footer -->
                    <div style="position: absolute; bottom: 20px; left: 0; right: 0; border-top: 1px solid #eee; padding-top: 12px; text-align: center;">
                        <p style="font-size: 8px; margin: 0; letter-spacing: 3px; font-weight: 800; color: #bbb; text-transform: uppercase;">DIGITALLY GENERATED • RENTBILL PRO • NO SIGNATURE REQUIRED FOR SYSTEM VALIDITY</p>
                    </div>

                </div>
            </div>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Rental Agreement - ${t.name}</title>
                    <style>
                        body { margin: 0; padding: 0; background: white; }
                        @media print {
                            body { padding: 0; }
                            @page { 
                                size: A4;
                                margin: 0.5cm; 
                            }
                        }
                    </style>
                </head>
                <body>
                    ${htmlMessage}
                    <script>
                        window.onload = function() {
                            window.print();
                            window.onafterprint = function() { window.close(); };
                        };
                    </script>
                </body>
            </html>
        `);
        printWindow.document.close();
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

            // Calculate Due Date: 5th of the month following the billing month
            let formattedDueDate = 'N/A';
            try {
                const periodDate = new Date(bill.billing_month + ' 1');
                const dueDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 5);
                formattedDueDate = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
            } catch (de) { console.error("Due date calc failed", de); }

            // Resolve Payment Details from Owner Name
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

            // Resolution for adjustments
            let adjustmentInfo = '';
            let htmlAdjustments = '';
            if (bill.is_paid) {
                if (bill.discount_amount > 0) adjustmentInfo += `Discount Applied: -${currencyFormatter.format(bill.discount_amount)}\n`;
                if (bill.write_off_amount > 0) adjustmentInfo += `Write-Off: -${currencyFormatter.format(bill.write_off_amount)}\n`;
                if (bill.arrears_amount > 0) adjustmentInfo += `Carry Forward: ${currencyFormatter.format(bill.arrears_amount)} (Added to next bill)\n`;
            }

            // Universal Date Handling for Invoice
            let genDate = bill.date_generated ? new Date(bill.date_generated) : new Date();
            if (isNaN(genDate.getTime())) {
                genDate = new Date(); // Final safety fallback
            }

            // Plain text for WhatsApp/Clipboard
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
                `EB (${ebUnits.toFixed(1)} u)  : ${currencyFormatter.format(ebCost)}\n` +
                `   [Readings: ${bill.prev_eb_reading} - ${bill.curr_eb_reading}]\n` +
                (otherFees > 0 ? `Extra Charges  : ${currencyFormatter.format(otherFees)}\n` : '') +
                (bill.arrears_included > 0 ? `Prev. Arrears  : ${currencyFormatter.format(bill.arrears_included)}\n` : '') +
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

            // HTML version for Email
            const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
            const formattedGenDate = `${genDate.getFullYear()}-${months[genDate.getMonth()]}-${genDate.getDate().toString().padStart(2, '0')}`;

            // Multi-Property Logic: Use Owner's specific branding if available
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

            htmlMessage = `
                <div class="print-container" style="background-color: var(--bg-main); padding: 10px; font-family: var(--font-main), sans-serif; color: var(--text-main); line-height: 1.4;">
                    <div class="print-no-break" style="background-color: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 25px; position: relative; max-width: 600px; margin: 0 auto; overflow-wrap: break-word; box-sizing: border-box; box-shadow: var(--shadow); break-inside: avoid;">
                        <!-- Header -->
                        <div style="text-align: center; border-bottom: 1px solid var(--border); padding-bottom: 15px; margin-bottom: 20px; break-inside: avoid;">
                            <h2 style="margin: 0; font-size: 20px; text-transform: uppercase; font-weight: 900; color: var(--primary); letter-spacing: 0.5px;">${propName}</h2>
                            <p style="margin: 4px 0 12px 0; font-size: 10px; color: var(--text-muted); font-weight: 600;">${propAddr}</p>
                            <span style="background: var(--primary); color: white !important; padding: 4px 16px; font-weight: 900; letter-spacing: 1px; font-size: 12px; display: inline-block; margin-bottom: 8px; border-radius: 6px;">${bill.is_paid ? 'PAYMENT RECEIPT' : 'RENT INVOICE'}</span>
                            <p style="margin: 0; font-size: 10px; font-weight: 800; color: var(--text-muted);">BILL NO: ${bill.is_paid ? 'REC' : 'INV'}/${genDate.getFullYear()}/${(genDate.getMonth()+1).toString().padStart(2,'0')}/${t.room_no}/${bill.id}</p>
                        </div>

                        <!-- User Info Section -->
                        <div style="margin-bottom: 20px; background: var(--primary-light); padding: 15px; border-radius: 10px; text-align: center; break-inside: avoid;">
                            <p style="margin: 0; font-size: 9px; color: var(--primary); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 900; opacity: 0.8;">Tenant Details</p>
                            <p style="margin: 6px 0; font-size: 20px; font-weight: 900; color: var(--text-main);">${t.name}</p>
                            <div style="display: inline-block; border: 1.5px solid var(--primary); color: var(--primary); padding: 3px 12px; font-size: 13px; font-weight: 900; margin-top: 4px; border-radius: 6px; background: white;">UNIT: ${t.room_no}</div>
                            <div style="margin-top: 10px; font-size: 14px; font-weight: 800; color: var(--text-main);">PERIOD: ${bill.billing_month.toUpperCase()}</div>
                            ${!bill.is_paid ? `<div style="margin-top: 4px; font-size: 12px; font-weight: 800; color: var(--danger);">DUE BY: ${formattedDueDate}</div>` : ''}
                        </div>

                        <!-- Match-Style Electricity Table -->
                        <div style="margin-bottom: 20px; break-inside: avoid;">
                            <p style="background: var(--primary); color: white !important; display: inline-block; padding: 3px 10px; font-size: 10px; font-weight: 900; margin-bottom: 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Electricity Consumption</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">PREVIOUS READING</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${bill.prev_eb_reading}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">CURRENT READING</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${bill.curr_eb_reading}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">UNITS (x ${t.eb_unit_price})</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${ebUnits.toFixed(1)}</td></tr>
                                <tr style="font-weight: 900; background: var(--bg-main); break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--primary);">TOTAL EB COST</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; color: var(--primary);">${currencyFormatter.format(ebCost)}</td></tr>
                            </table>
                        </div>

                        <!-- Financials -->
                        <div style="margin-bottom: 20px; break-inside: avoid;">
                            <p style="background: var(--primary); color: white !important; display: inline-block; padding: 3px 10px; font-size: 10px; font-weight: 900; margin-bottom: 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Bill Itemization</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
                                <tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">MONTHLY RENT</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(bill.rent_amount)}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">WATER/MAINT</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(bill.water_amount)}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">ELECTRICITY</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(ebCost)}</td></tr>
                                ${otherFees > 0 ? `<tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">EXTRA CHARGES</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(otherFees)}</td></tr>` : ''}
                                ${bill.arrears_included > 0 ? `<tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">PREV. ARREARS</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(bill.arrears_included)}</td></tr>` : ''}
                                ${bill.discount_amount > 0 ? `<tr style="break-inside: avoid;"><td style="padding: 8px 10px; border: 1px solid var(--border); color: var(--danger); font-weight: 700;">DISCOUNT / ADJ (-)</td><td style="padding: 8px 10px; border: 1px solid var(--border); text-align: right; color: var(--danger); font-weight: 800;">-${currencyFormatter.format(bill.discount_amount)}</td></tr>` : ''}
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

                        <!-- Payment Instructions -->
                        <div class="print-no-break" style="break-inside: avoid;">
                            ${!bill.is_paid ? htmlPaymentInfo : ''}
                        </div>

                        <!-- Status Stamp -->
                        <div style="display: flex; justify-content: center; margin: 20px auto 10px auto; break-inside: avoid;">
                            <div style="border: 2px solid ${bill.is_paid ? 'var(--success)' : 'var(--danger)'}; color: ${bill.is_paid ? 'var(--success)' : 'var(--danger)'}; border-radius: 10px; padding: 10px 30px; transform: rotate(-3deg); font-weight: 900; font-size: 22px; text-align: center; text-transform: uppercase; background: white; box-shadow: 4px 4px 0px ${bill.is_paid ? 'var(--bg-success-light)' : 'var(--bg-danger-light)'};">
                                ${bill.is_paid ? 'PAID' : 'PENDING'}
                            </div>
                        </div>

                        <!-- Footer -->
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
                ebReading: 'N/A',
                rentDue: 0,
                ebDue: 0,
                repairs: 0,
                reason: 'None',
                totalRefund: currencyFormatter.format(t.advance_amount),
                refundLabel: 'Total Refund'
            };

            const genDate = new Date();
            const moveInDate = new Date(t.move_in_date).toLocaleDateString('en-IN');
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
                        <!-- Header -->
                        <div style="text-align: center; border-bottom: 1px solid var(--border); padding-bottom: 15px; margin-bottom: 20px; break-inside: avoid;">
                            <h2 style="margin: 0; font-size: 20px; text-transform: uppercase; font-weight: 900; color: var(--primary); letter-spacing: 0.5px;">${propName}</h2>
                            <p style="margin: 4px 0 12px 0; font-size: 10px; color: var(--text-muted); font-weight: 600;">${propAddr}</p>
                            <span style="background: var(--primary); color: white !important; padding: 4px 16px; font-weight: 900; letter-spacing: 1px; font-size: 12px; display: inline-block; margin-bottom: 8px; border-radius: 6px;">EXIT SETTLEMENT</span>
                            <p style="margin: 0; font-size: 10px; font-weight: 800; color: var(--text-muted);">DOC NO: CLR-${t.id}-${genDate.getTime().toString().slice(-6)}</p>
                        </div>

                        <!-- User Info Section -->
                        <div style="margin-bottom: 20px; background: var(--primary-light); padding: 15px; border-radius: 10px; text-align: center; break-inside: avoid;">
                            <p style="margin: 0; font-size: 9px; color: var(--primary); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 900; opacity: 0.8;">Tenant Details</p>
                            <p style="margin: 6px 0; font-size: 20px; font-weight: 900; color: var(--text-main);">${t.name}</p>
                            <div style="display: inline-block; border: 1.5px solid var(--primary); color: var(--primary); padding: 3px 12px; font-size: 13px; font-weight: 900; margin-top: 4px; border-radius: 6px; background: white;">UNIT: ${t.room_no} | STAY: ${moveInDate} - ${vacateDate}</div>
                        </div>

                        <!-- Financials -->
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

                        <!-- Status Stamp -->
                        <div style="display: block; margin: 20px auto 10px auto; width: fit-content; border: 2px solid var(--success); color: var(--success); border-radius: 10px; padding: 10px 30px; transform: rotate(-3deg); font-weight: 900; font-size: 22px; text-align: center; text-transform: uppercase; background: white; box-shadow: 4px 4px 0px var(--bg-success-light); break-inside: avoid;">
                            VERIFIED & CLEARED
                        </div>

                        <!-- Footer -->
                        <div style="margin-top: 20px; border-top: 1px solid var(--border); padding-top: 15px; text-align: center; break-inside: avoid;">
                            <p style="font-size: 9px; margin: 0; letter-spacing: 2px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Generated: ${formattedGenDate} • RentBill Pro Official Document</p>
                        </div>
                    </div>
                </div>`;
        }

        shareData = { type, id, message, htmlMessage, mobile, email, billId };
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
        if (!shareData.email) return showNotification("Tenant email is missing", "error");
        
        showNotification("Sending secure email...", "info");
        const res = await fetch('/api/bills/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                bill_id: shareData.billId || 0, 
                email: shareData.email, 
                message: shareData.htmlMessage || shareData.message 
            })
        });
        
        if (res.ok) {
            showNotification("Email sent successfully", "success");
        } else {
            const err = await res.json();
            showNotification(err.error || "Email failed", "error");
        }
    } else if (channel === 'print') {
        const printArea = document.getElementById('print-area');
        if (printArea) {
            document.body.classList.add('printing-bill');
            // Populate hidden print area with HTML content
            printArea.innerHTML = shareData.htmlMessage;
            printArea.classList.remove('hidden');
            
            // Trigger native print dialog
            window.print();
            
            // Re-hide after print dialog closes
            setTimeout(() => {
                document.body.classList.remove('printing-bill');
                printArea.classList.add('hidden');
                printArea.innerHTML = '';
            }, 500);
        }
    } else if (channel === 'copy') {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareData.message)
                .then(() => showNotification("Text copied to clipboard", "success"))
                .catch(err => {
                    console.error('Could not copy text: ', err);
                    showNotification("Failed to copy text", "error");
                });
        } else {
            // Fallback for older browsers or non-secure contexts
            const textArea = document.createElement("textarea");
            textArea.value = shareData.message;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showNotification("Text copied to clipboard", "success");
            } catch (err) {
                console.error('Fallback copy failed', err);
                showNotification("Failed to copy text", "error");
            }
            document.body.removeChild(textArea);
        }
    }
    closeShareModal();
}

function closeShareModal() {
    document.getElementById('shareModal').classList.add('hidden');
}

function closePreviewModal() {
    const modal = document.getElementById('previewModal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('previewContent').innerHTML = '';
    }
}
