let shareData = { type: '', id: null, message: '', htmlMessage: '', mobile: '', email: '', billId: null };

async function printProfessionalAgreement(id) {
    try {
        const res = await fetch(`/api/renter/${id}`);
        const t = await res.json();

        const moveInRaw = new Date(t.move_in_date);
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const formattedMoveIn = `${moveInRaw.getFullYear()}-${months[moveInRaw.getMonth()]}-${moveInRaw.getDate().toString().padStart(2, '0')}`;

        const propName = appSettings.property_name || 'RENTBILL PRO';
        const propAddr = appSettings.property_address || 'Property Management System';

        const htmlMessage = `
            <div style="background-color: #fff; padding: 40px; font-family: var(--font-main), sans-serif; color: var(--text-main); line-height: 1.6; max-width: 800px; margin: 0 auto; box-sizing: border-box;">
                <div style="border: 1px solid var(--border); padding: 40px; border-radius: 4px; position: relative;">
                    <!-- Top Header -->
                    <div style="text-align: center; border-bottom: 2px solid var(--primary); padding-bottom: 20px; margin-bottom: 30px;">
                        <h2 style="margin: 0; font-size: 24px; text-transform: uppercase; font-weight: 900; color: var(--primary); letter-spacing: 1px;">${propName}</h2>
                        <p style="margin: 8px 0 15px 0; font-size: 13px; color: var(--text-muted); font-weight: 600;">${propAddr}</p>
                        <span style="background: var(--primary); color: #fff; padding: 6px 20px; font-weight: 900; letter-spacing: 2px; font-size: 16px; border-radius: 4px; display: inline-block;">RENTAL AGREEMENT</span>
                        <p style="margin: 15px 0 0 0; font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">OFFICIAL RECORD NO: RB-${t.id}-${Date.now().toString().slice(-6)}</p>
                    </div>

                    <!-- User Info Section -->
                    <div style="margin-bottom: 40px; background: var(--bg-main); padding: 25px; border-radius: 8px; text-align: center; border: 1px solid var(--border);">
                        <p style="margin: 0; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 2px; font-weight: 800;">Tenant Information</p>
                        <p style="margin: 10px 0; font-size: 26px; font-weight: 900; color: var(--text-main);">${t.name}</p>
                        <div style="display: inline-block; border: 1.5px solid var(--primary); color: var(--primary); padding: 4px 18px; font-size: 14px; font-weight: 900; margin-top: 5px; border-radius: 8px; background: white;">UNIT: ${t.room_no}</div>
                    </div>

                    <!-- Financials -->
                    <div style="margin-bottom: 40px;">
                        <p style="background: var(--primary); color: #fff; display: inline-block; padding: 4px 15px; font-size: 12px; font-weight: 900; border-radius: 4px; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">Lease & Financial Terms</p>
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr><td style="padding: 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">LEASE START DATE</td><td style="padding: 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${formattedMoveIn}</td></tr>
                            <tr><td style="padding: 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">MONTHLY RENT</td><td style="padding: 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(t.base_rent)}</td></tr>
                            <tr><td style="padding: 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">WATER/MAINTENANCE</td><td style="padding: 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(t.water_maint)}</td></tr>
                            <tr><td style="padding: 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">EB UNIT RATE</td><td style="padding: 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(t.eb_unit_price)}</td></tr>
                            <tr style="font-weight: 900; background: var(--primary-light);"><td style="padding: 15px 12px; border: 1px solid var(--primary); color: var(--primary);">SECURITY DEPOSIT</td><td style="padding: 15px 12px; border: 1px solid var(--primary); text-align: right; color: var(--primary); font-size: 16px;">${currencyFormatter.format(t.advance_amount)}</td></tr>
                        </table>
                    </div>

                    <!-- Terms -->
                    <div style="margin-bottom: 40px; page-break-before: auto; padding-top: 20px;">
                        <p style="background: var(--primary); color: #fff !important; display: inline-block; padding: 4px 15px; font-size: 12px; font-weight: 900; border-radius: 4px; margin-bottom: 20px; text-transform: uppercase; letter-spacing: 1px;">House Rules & Standard Conditions</p>
                        <div style="font-size: 13px; line-height: 1.8; color: #000 !important; text-align: justify;">
                            ${(appSettings.agreement_terms || 'Standard conditions apply.').split('\n').map(line => line.trim() ? `<p style="margin: 0 0 10px 0;">${line}</p>` : '').join('')}
                        </div>
                    </div>

                    <!-- Signature Section for Print -->
                    <div style="margin-top: 80px; display: flex; justify-content: space-between; padding: 0 30px;">
                        <div style="text-align: center; border-top: 1.5px solid var(--text-main); width: 180px; padding-top: 8px; font-size: 12px; font-weight: 800; color: var(--text-main);">OWNER SIGNATURE</div>
                        <div style="text-align: center; border-top: 1.5px solid var(--text-main); width: 180px; padding-top: 8px; font-size: 12px; font-weight: 800; color: var(--text-main);">TENANT SIGNATURE</div>
                    </div>

                    <!-- Footer -->
                    <div style="margin-top: 60px; border-top: 1px solid var(--border); padding-top: 20px; text-align: center;">
                        <p style="font-size: 10px; margin: 0; letter-spacing: 3px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">OFFICIAL DOCUMENT // GENERATED VIA RENTBILL PRO SYSTEM</p>
                    </div>

                    <!-- Stamp -->
                    <div style="position: absolute; top: 180px; right: 50px; border: 3px double var(--primary); padding: 10px 20px; transform: rotate(15deg); opacity: 0.15; font-weight: 900; color: var(--primary); font-size: 22px; text-transform: uppercase; border-radius: 8px;">
                        Verified Record
                    </div>
                </div>
            </div>`;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Rental Agreement - ${t.name}</title>
                    <style>
                        body { margin: 0; padding: 0; }
                        @media print {
                            body { padding: 0; }
                            @page { margin: 1cm; }
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

            const ebUnits = bill.curr_eb_reading - bill.prev_eb_reading;
            const ebCost = ebUnits * t.eb_unit_price;

            // Calculate Due Date: 5th of the month following the billing month
            const periodDate = new Date(bill.billing_month + ' 1');
            const dueDate = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 5);
            const formattedDueDate = dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

            // Resolve Payment Details from Owner Name
            let paymentInfo = '';
            let htmlPaymentInfo = '';
            if (!bill.is_paid && t.assigned_upi && typeof appSettings !== 'undefined') {
                const ownerName = t.assigned_upi;
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
            if (bill.is_paid) {
                if (bill.discount_amount > 0) adjustmentInfo += `Discount Applied: -${currencyFormatter.format(bill.discount_amount)}\n`;
                if (bill.write_off_amount > 0) adjustmentInfo += `Write-Off: -${currencyFormatter.format(bill.write_off_amount)}\n`;
                if (bill.arrears_amount > 0) adjustmentInfo += `Carry Forward: ${currencyFormatter.format(bill.arrears_amount)} (Added to next bill)\n`;
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
                `Generated: ${new Date(bill.date_generated).toLocaleDateString('en-IN')}\n` +
                `System: RentBill Pro`;

            // HTML version for Email
            const genDate = new Date(bill.date_generated);
            const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
            const formattedGenDate = `${genDate.getFullYear()}-${months[genDate.getMonth()]}-${genDate.getDate().toString().padStart(2, '0')}`;

            const propName = appSettings.property_name || 'RENTBILL PRO';
            const propAddr = appSettings.property_address || 'Property Management System';

            htmlAdjustments = '';
            if (bill.is_paid) {
                if (bill.write_off_amount > 0) htmlAdjustments += `<tr style="break-inside: avoid;"><td style="padding: 6px 5px; border: 1px solid #000; color: #d32f2f;">WRITE-OFF (Loss)</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right; color: #d32f2f;">-${currencyFormatter.format(bill.write_off_amount)}</td></tr>`;
                if (bill.arrears_amount > 0) htmlAdjustments += `<tr style="break-inside: avoid;"><td style="padding: 6px 5px; border: 1px solid #000; color: #f57c00;">CARRY FORWARD</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right; color: #f57c00;">${currencyFormatter.format(bill.arrears_amount)}</td></tr>`;
            }

            htmlMessage = `
                <div style="background-color: var(--bg-main); padding: 20px 10px; font-family: var(--font-main), sans-serif; color: var(--text-main); line-height: 1.5;">
                    <div class="print-no-break" style="background-color: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 30px; position: relative; max-width: 600px; margin: 0 auto; overflow-wrap: break-word; box-sizing: border-box; box-shadow: var(--shadow); break-inside: avoid;">
                        <!-- Header -->
                        <div style="text-align: center; border-bottom: 1px solid var(--border); padding-bottom: 20px; margin-bottom: 25px; break-inside: avoid;">
                            <h2 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900; color: var(--primary); letter-spacing: 0.5px;">${propName}</h2>
                            <p style="margin: 6px 0 15px 0; font-size: 11px; color: var(--text-muted); font-weight: 600;">${propAddr}</p>
                            <span style="background: var(--primary); color: white !important; padding: 6px 18px; font-weight: 900; letter-spacing: 1px; font-size: 13px; display: inline-block; margin-bottom: 10px; border-radius: 8px;">${bill.is_paid ? 'PAYMENT RECEIPT' : 'RENT INVOICE'}</span>
                            <p style="margin: 0; font-size: 11px; font-weight: 800; color: var(--text-muted);">BILL NO: ${bill.is_paid ? 'REC' : 'INV'}-${bill.id}-${genDate.getTime().toString().slice(-6)}</p>
                        </div>

                        <!-- User Info Section -->
                        <div style="margin-bottom: 30px; background: var(--primary-light); padding: 20px; border-radius: 12px; text-align: center; break-inside: avoid;">
                            <p style="margin: 0; font-size: 10px; color: var(--primary); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 900; opacity: 0.8;">Tenant Details</p>
                            <p style="margin: 8px 0; font-size: 24px; font-weight: 900; color: var(--text-main);">${t.name}</p>
                            <div style="display: inline-block; border: 1.5px solid var(--primary); color: var(--primary); padding: 4px 14px; font-size: 14px; font-weight: 900; margin-top: 5px; border-radius: 8px; background: white;">UNIT: ${t.room_no}</div>
                            <div style="margin-top: 15px; font-size: 15px; font-weight: 800; color: var(--text-main);">PERIOD: ${bill.billing_month.toUpperCase()}</div>
                            ${!bill.is_paid ? `<div style="margin-top: 6px; font-size: 13px; font-weight: 800; color: var(--danger);">DUE BY: ${formattedDueDate}</div>` : ''}
                        </div>

                        <!-- Match-Style Electricity Table -->
                        <div style="margin-bottom: 25px; break-inside: avoid;">
                            <p style="background: var(--primary); color: white !important; display: inline-block; padding: 4px 12px; font-size: 11px; font-weight: 900; margin-bottom: 12px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Electricity Consumption</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">PREVIOUS READING</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${bill.prev_eb_reading}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">CURRENT READING</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${bill.curr_eb_reading}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">UNITS (x ${t.eb_unit_price})</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${ebUnits.toFixed(1)}</td></tr>
                                <tr style="font-weight: 900; background: var(--bg-main); break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--primary);">TOTAL EB COST</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; color: var(--primary);">${currencyFormatter.format(ebCost)}</td></tr>
                            </table>
                        </div>

                        <!-- Financials -->
                        <div style="margin-bottom: 25px; break-inside: avoid;">
                            <p style="background: var(--primary); color: white !important; display: inline-block; padding: 4px 12px; font-size: 11px; font-weight: 900; margin-bottom: 12px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Bill Itemization</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">MONTHLY RENT</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(bill.rent_amount)}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">WATER/MAINT</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(bill.water_amount)}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">ELECTRICITY</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(ebCost)}</td></tr>
                                ${otherFees > 0 ? `<tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">EXTRA CHARGES</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(otherFees)}</td></tr>` : ''}
                                ${bill.arrears_included > 0 ? `<tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">PREV. ARREARS</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(bill.arrears_included)}</td></tr>` : ''}
                                ${bill.discount_amount > 0 ? `<tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--danger); font-weight: 700;">DISCOUNT / ADJ (-)</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; color: var(--danger); font-weight: 800;">-${currencyFormatter.format(bill.discount_amount)}</td></tr>` : ''}
                                <tr style="font-weight: 900; background: var(--primary-light); break-inside: avoid;"><td style="padding: 12px; border: 1px solid var(--primary); color: var(--primary); font-size: 15px;">TOTAL DUE</td><td style="padding: 12px; border: 1px solid var(--primary); text-align: right; color: var(--primary); font-size: 15px;">${currencyFormatter.format(bill.total_amount)}</td></tr>
                                ${bill.is_paid ? `
                                    <tr style="font-weight: 900; background: var(--bg-success-light); break-inside: avoid;"><td style="padding: 12px; border: 1px solid var(--success); color: var(--success);">TOTAL PAID</td><td style="padding: 12px; border: 1px solid var(--success); text-align: right; color: var(--success);">${currencyFormatter.format(bill.paid_amount)}</td></tr>
                                    ${htmlAdjustments}
                                ` : ''}
                            </table>
                            <div style="margin-top: 15px; font-size: 12px; font-weight: 800; color: var(--text-main); background: var(--bg-main); padding: 10px; border-radius: 8px; border: 1px dashed var(--border);">
                                <span style="color: var(--text-muted); text-transform: uppercase; font-size: 10px; display: block; margin-bottom: 2px;">Amount in words</span>
                                ${amountInWords}
                            </div>
                        </div>

                        <!-- Payment Instructions -->
                        <div class="print-no-break" style="break-inside: avoid;">
                            ${!bill.is_paid ? htmlPaymentInfo : ''}
                        </div>

                        <!-- Status Stamp -->
                        <div style="display: flex; justify-content: center; margin: 30px auto 10px auto; break-inside: avoid;">
                            <div style="border: 2px solid ${bill.is_paid ? 'var(--success)' : 'var(--danger)'}; color: ${bill.is_paid ? 'var(--success)' : 'var(--danger)'}; border-radius: 12px; padding: 12px 35px; transform: rotate(-3deg); font-weight: 900; font-size: 26px; text-align: center; text-transform: uppercase; background: white; box-shadow: 4px 4px 0px ${bill.is_paid ? 'var(--bg-success-light)' : 'var(--bg-danger-light)'};">
                                ${bill.is_paid ? 'PAID' : 'PENDING'}
                            </div>
                        </div>

                        <!-- Footer -->
                        <div style="margin-top: 30px; border-top: 1px solid var(--border); padding-top: 20px; text-align: center; break-inside: avoid;">
                            <p style="font-size: 10px; margin: 0; letter-spacing: 2px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Generated: ${formattedGenDate} • RentBill Pro Official Document</p>
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
                <div style="background-color: var(--bg-main); padding: 20px 10px; font-family: var(--font-main), sans-serif; color: var(--text-main); line-height: 1.5;">
                    <div style="background-color: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 30px; position: relative; max-width: 600px; margin: 0 auto; overflow-wrap: break-word; box-sizing: border-box; box-shadow: var(--shadow);">
                        <!-- Header -->
                        <div style="text-align: center; border-bottom: 1px solid var(--border); padding-bottom: 20px; margin-bottom: 25px;">
                            <h2 style="margin: 0; font-size: 22px; text-transform: uppercase; font-weight: 900; color: var(--primary); letter-spacing: 0.5px;">${propName}</h2>
                            <p style="margin: 6px 0 15px 0; font-size: 11px; color: var(--text-muted); font-weight: 600;">${propAddr}</p>
                            <span style="background: var(--primary); color: white !important; padding: 6px 18px; font-weight: 900; letter-spacing: 1px; font-size: 13px; display: inline-block; margin-bottom: 10px; border-radius: 8px;">EXIT SETTLEMENT</span>
                            <p style="margin: 0; font-size: 11px; font-weight: 800; color: var(--text-muted);">DOC NO: CLR-${t.id}-${genDate.getTime().toString().slice(-6)}</p>
                        </div>

                        <!-- User Info Section -->
                        <div style="margin-bottom: 30px; background: var(--primary-light); padding: 20px; border-radius: 12px; text-align: center; break-inside: avoid;">
                            <p style="margin: 0; font-size: 10px; color: var(--primary); text-transform: uppercase; letter-spacing: 1.5px; font-weight: 900; opacity: 0.8;">Tenant Details</p>
                            <p style="margin: 8px 0; font-size: 24px; font-weight: 900; color: var(--text-main);">${t.name}</p>
                            <div style="display: inline-block; border: 1.5px solid var(--primary); color: var(--primary); padding: 4px 14px; font-size: 13px; font-weight: 900; margin-top: 5px; border-radius: 8px; background: white;">UNIT: ${t.room_no} | STAY: ${moveInDate} - ${vacateDate}</div>
                        </div>

                        <!-- Financials -->
                        <div style="margin-bottom: 25px; break-inside: avoid;">
                            <p style="background: var(--primary); color: white !important; display: inline-block; padding: 4px 12px; font-size: 11px; font-weight: 900; margin-bottom: 12px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Settlement Summary</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">SECURITY DEPOSIT</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; font-weight: 800;">${currencyFormatter.format(s.advance)}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">PENDING RENT (-)</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; color: var(--danger); font-weight: 800;">${currencyFormatter.format(s.rentDue)}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">PENDING EB (-)</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; color: var(--danger); font-weight: 800;">${currencyFormatter.format(s.ebDue)}</td></tr>
                                <tr style="break-inside: avoid;"><td style="padding: 10px 12px; border: 1px solid var(--border); color: var(--text-muted); font-weight: 700;">REPAIRS/OTHERS (-)</td><td style="padding: 10px 12px; border: 1px solid var(--border); text-align: right; color: var(--danger); font-weight: 800;">${currencyFormatter.format(s.repairs)}</td></tr>
                                <tr style="font-weight: 900; background: var(--primary-light); break-inside: avoid;"><td style="padding: 12px; border: 1px solid var(--primary); color: var(--primary); font-size: 15px;">${s.refundLabel.toUpperCase()}</td><td style="padding: 12px; border: 1px solid var(--primary); text-align: right; color: var(--primary); font-size: 15px;">${s.totalRefund}</td></tr>
                            </table>
                            ${s.reason && s.reason !== 'None' ? `<div style="margin-top: 15px; background: var(--bg-main); padding: 12px; border-radius: 8px; border-left: 4px solid var(--primary); break-inside: avoid;"><p style="margin: 0; font-size: 11px; color: var(--text-muted); text-transform: uppercase; font-weight: 800;">Reason for Charges</p><p style="margin: 4px 0 0 0; font-size: 13px; color: var(--text-main); font-weight: 600;">${s.reason}</p></div>` : ''}
                            <p style="margin-top: 12px; font-size: 12px; font-weight: 800; color: var(--text-muted); text-align: center; background: var(--bg-main); padding: 8px; border-radius: 8px; break-inside: avoid;">Final EB Reading: <span style="color: var(--text-main);">${s.ebReading}</span></p>
                            <p style="margin-top: 25px; font-size: 13px; line-height: 1.6; color: var(--text-main); text-align: center; font-style: italic; break-inside: avoid;">The premises has been inspected and vacated. All dues cleared. Best wishes for your future!</p>
                        </div>

                        <!-- Status Stamp -->
                        <div style="display: block; margin: 30px auto 10px auto; width: fit-content; border: 2px solid var(--success); color: var(--success); border-radius: 12px; padding: 12px 30px; transform: rotate(-3deg); font-weight: 900; font-size: 22px; text-align: center; text-transform: uppercase; background: white; box-shadow: 4px 4px 0px var(--bg-success-light); break-inside: avoid;">
                            VERIFIED & CLEARED
                        </div>

                        <!-- Footer -->
                        <div style="margin-top: 30px; border-top: 1px solid var(--border); padding-top: 20px; text-align: center; break-inside: avoid;">
                            <p style="font-size: 10px; margin: 0; letter-spacing: 2px; font-weight: 800; color: var(--text-muted); text-transform: uppercase;">Generated: ${formattedGenDate} • RentBill Pro Official Document</p>
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
    if (channel === 'wa') {
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
    }
    closeShareModal();
}

function closeShareModal() {
    document.getElementById('shareModal').classList.add('hidden');
}
