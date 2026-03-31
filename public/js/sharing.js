let shareData = { type: '', id: null, message: '', htmlMessage: '', mobile: '', email: '', billId: null };

async function sendProfessionalAgreement(id) {
    try {
        const res = await fetch(`/api/renter/${id}`);
        const t = await res.json();

        if (!t.email) return showNotification("Tenant email is missing!", "error");

        const agreementDate = new Date().toLocaleDateString('en-IN');
        const message = `
RENTAL AGREEMENT
--------------------------------------------------
DATE: ${agreementDate}
PARTIES: Landlord & ${t.name} (Tenant)

1. PREMISES: Unit No: ${t.room_no}
2. OCCUPANT: ${t.name} | Mob: ${t.mobile_number}
3. PERMANENT ADDR: ${t.perm_address || 'As per ID Proof'}

FINANCIAL SCHEDULE:
--------------------------------------------------
Monthly Base Rent   : ${currencyFormatter.format(t.base_rent)}
Security Advance    : ${currencyFormatter.format(t.advance_amount)}
Water/Maintenance   : ${currencyFormatter.format(t.water_maint)}
EB Unit Rate        : ${currencyFormatter.format(t.eb_unit_price)} per unit

STANDARD TERMS:
- Lease Period      : 11 Months from ${t.move_in_date.slice(0, 10)}
- Notice Period     : 30 Days from either party
- Painting/Cleaning : Charges deductible from advance upon exit
- Payment Schedule  : Monthly dues before 5th of every month

This is a computer-generated professional agreement for record purposes.
--------------------------------------------------
Issued by RentBill
        `.trim();

        const moveInRaw = new Date(t.move_in_date);
        const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
        const formattedMoveIn = `${moveInRaw.getFullYear()}-${months[moveInRaw.getMonth()]}-${moveInRaw.getDate().toString().padStart(2, '0')}`;

        const htmlMessage = `
            <div style="background-color: #f0f0f0; padding: 15px 5px; font-family: 'Courier New', Courier, monospace; color: #000; line-height: 1.5;">
                <div style="background-color: #fff; border: 3px solid #000; padding: 20px; position: relative; box-shadow: 6px 6px 0px #000; max-width: 600px; margin: 0 auto; overflow-wrap: break-word;">
                    <!-- Top Header -->
                    <div style="text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                        <span style="background: #000; color: #fff; padding: 5px 15px; font-weight: bold; letter-spacing: 3px;">RENTAL AGREEMENT</span>
                        <h1 style="margin: 15px 0 5px 0; font-size: 24px; text-transform: uppercase;">Agreement Details</h1>
                        <p style="margin: 0; font-size: 12px; font-weight: bold;">RECORD NO: RB-${t.id}-${Date.now().toString().slice(-6)}</p>
                    </div>

                    <!-- User Info Section -->
                    <div style="margin-bottom: 25px; border-bottom: 1px dashed #000; padding-bottom: 15px; text-align: center;">
                        <p style="margin: 2px 0; font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Tenant Information</p>
                        <p style="margin: 5px 0; font-size: 18px; font-weight: bold; color: #000;">${t.name}</p>
                        <div style="display: inline-block; background: #000; color: #fff; padding: 3px 12px; font-size: 13px; font-weight: bold; margin-top: 5px;">UNIT: ${t.room_no}</div>
                    </div>

                    <!-- Financials -->
                    <div style="margin-bottom: 25px;">
                        <p style="background: #000; color: #fff; display: inline-block; padding: 2px 10px; font-size: 14px; margin-bottom: 10px;">RENT & CHARGES</p>
                        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                            <tr><td style="padding: 5px; border: 1px solid #000;">START DATE</td><td style="padding: 5px; border: 1px solid #000; text-align: right;">${formattedMoveIn}</td></tr>
                            <tr><td style="padding: 5px; border: 1px solid #000;">MONTHLY RENT</td><td style="padding: 5px; border: 1px solid #000; text-align: right;">${currencyFormatter.format(t.base_rent)}</td></tr>
                            <tr><td style="padding: 5px; border: 1px solid #000;">WATER/MAINT</td><td style="padding: 5px; border: 1px solid #000; text-align: right;">${currencyFormatter.format(t.water_maint)}</td></tr>
                            <tr><td style="padding: 5px; border: 1px solid #000;">EB UNIT RATE</td><td style="padding: 5px; border: 1px solid #000; text-align: right;">${currencyFormatter.format(t.eb_unit_price)}</td></tr>
                            <tr style="font-weight: bold; background: #eee;"><td style="padding: 5px; border: 1px solid #000;">SECURITY DEPOSIT</td><td style="padding: 5px; border: 1px solid #000; text-align: right;">${currencyFormatter.format(t.advance_amount)}</td></tr>
                        </table>
                    </div>

                    <!-- Terms -->
                    <div style="margin-bottom: 25px;">
                        <p style="background: #000; color: #fff; display: inline-block; padding: 2px 10px; font-size: 14px; margin-bottom: 10px;">HOUSE RULES & TERMS</p>
                        <ul style="padding-left: 20px; font-size: 11px; line-height: 1.5; margin: 0; text-align: justify;">
                            <li><strong>LEASE PERIOD:</strong> 11 Months. Extension subject to mutual agreement and rent revision.</li>
                            <li><strong>PAYMENT:</strong> Rent must be paid on or before the 5th of every month. A late fee may apply for delays.</li>
                            <li><strong>SECURITY DEPOSIT:</strong> Interest-free advance, refundable only after handing over vacant possession and original keys.</li>
                            <li><strong>MAINTENANCE & REPAIRS:</strong> Tenant is responsible for internal repairs (electrical/plumbing) and maintaining the premises in good condition.</li>
                            <li><strong>USAGE:</strong> Premises to be used for residential purposes only. No commercial activity or subletting allowed.</li>
                            <li><strong>MODIFICATIONS:</strong> No structural changes, drilling, or painting without the Owner's written consent.</li>
                            <li><strong>NOTICE PERIOD:</strong> 1 month (30 days) written notice required from either party for termination.</li>
                            <li><strong>EXIT CONDITION:</strong> Painting, deep cleaning, and any damage repair charges will be deducted from the security advance.</li>
                            <li><strong>INSPECTION:</strong> Owner reserves the right to inspect the premises with 24-hour prior notice.</li>
                        </ul>
                    </div>

                    <!-- Footer Barcode simulation -->
                    <div style="margin-top: 30px; border-top: 2px solid #000; padding-top: 10px; text-align: center;">
                        <div style="height: 15px; background: repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 5px); margin-bottom: 5px;"></div>
                        <p style="font-size: 10px; margin: 0; letter-spacing: 5px;">CONFIDENTIAL RECORD // RENTBILL SYSTEM</p>
                    </div>

                    <!-- Stamp -->
                    <div style="position: absolute; top: 150px; right: 40px; border: 4px double #000; padding: 5px 10px; transform: rotate(15deg); opacity: 0.8; font-weight: bold; color: #000; font-size: 18px;">
                        CERTIFIED
                    </div>
                </div>
            </div>`;

        showNotification("Sending Agreement Email...", "info");
        const mailRes = await fetch('/api/bills/email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bill_id: 0, email: t.email, message: htmlMessage })
        });

        if (mailRes.ok) {
            showNotification("Agreement sent successfully", "success");
        } else {
            const err = await mailRes.json();
            showNotification(err.error || "Failed to send email", "error");
        }
    } catch (e) {
        showNotification("System error", "error");
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

            // Resolve Payment Details from Owner Name
            let paymentInfo = '';
            let htmlPaymentInfo = '';
            if (!bill.is_paid && t.assigned_upi && typeof appSettings !== 'undefined') {
                const ownerName = t.assigned_upi;
                const ownerAcc = appSettings.receiving_accounts?.find(a => a.owner_name === ownerName);

                if (ownerAcc) {
                    paymentInfo = `*PAYMENT DETAILS:*\n`;
                    htmlPaymentInfo = `
                        <div style="margin-bottom: 20px; border: 2px solid #000; padding: 12px; background: #fafafa;">
                            <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 13px; text-decoration: underline;">HOW TO PAY</p>
                            <p style="margin: 5px 0; font-size: 12px;">Transfer <strong>${currencyFormatter.format(bill.total_amount)}</strong> using details below:</p>
                    `;

                    if (ownerAcc.upi) {
                        paymentInfo += `UPI ID: ${ownerAcc.upi}\n` +
                            `Direct Pay: upi://pay?pa=${ownerAcc.upi}&pn=RentBill&am=${bill.total_amount}&cu=INR&tn=${encodeURIComponent(`Rent for ${bill.billing_month}`)}\n`;
                        
                        htmlPaymentInfo += `
                            <div style="background: #fff; border: 1px dashed #000; padding: 10px; margin: 10px 0; text-align: center;">
                                <div style="margin-bottom: 12px;">
                                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${ownerAcc.upi}&pn=RentBill&am=${bill.total_amount}&cu=INR&tn=Rent for ${bill.billing_month}`)}" 
                                         alt="UPI QR Code" style="display: block; margin: 0 auto; border: 5px solid #fff; box-shadow: 0 0 5px rgba(0,0,0,0.1); max-width: 150px; width: 100%;">
                                    <p style="font-size: 9px; color: #666; margin-top: 5px;">Scan with any UPI App</p>
                                </div>
                                <div style="border-top: 1px solid #eee; padding-top: 10px;">
                                    <div style="background: #f9f9f9; border: 1px solid #ddd; padding: 6px; margin-bottom: 10px; word-break: break-all;">
                                        <code style="font-size: 12px; font-weight: bold; color: #000;">${ownerAcc.upi}</code>
                                    </div>
                                    <a href="upi://pay?pa=${ownerAcc.upi}&pn=RentBill&am=${bill.total_amount}&cu=INR&tn=Rent%20for%20${bill.billing_month.replace(' ', '%20')}" 
                                       target="_blank"
                                       style="text-decoration: none; background: #000; color: #fff; display: block; padding: 8px; border-radius: 4px; font-weight: bold; font-size: 12px;">
                                        TAP TO PAY
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
                            <div style="background: #fff; border: 1px dashed #000; padding: 10px; margin-top: 10px; text-align: left;">
                                <p style="margin: 0 0 5px 0; font-size: 11px; font-weight: bold; text-transform: uppercase;">Bank Transfer Details</p>
                                <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                                    <tr><td style="padding: 2px 0; color: #666;">BANK</td><td style="padding: 2px 0; font-weight: bold; text-align: right;">${ownerAcc.bank_name}</td></tr>
                                    <tr><td style="padding: 2px 0; color: #666;">ACC NO</td><td style="padding: 2px 0; font-weight: bold; text-align: right;">${ownerAcc.account_number}</td></tr>
                                    <tr><td style="padding: 2px 0; color: #666;">IFSC</td><td style="padding: 2px 0; font-weight: bold; text-align: right;">${ownerAcc.ifsc}</td></tr>
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
            const otherFees = bill.others - bill.arrears_included;
            const amountInWords = numberToWords(Math.round(bill.total_amount));
            message = `*RENT ${bill.is_paid ? 'RECEIPT' : 'INVOICE'} - ${bill.billing_month.toUpperCase()}*\n` +
                `--------------------------------------------------\n` +
                `*TENANT:* ${t.name} (${t.room_no})\n` +
                `*STATUS:* ${bill.is_paid ? '✅ PAID' : '⏳ PENDING'}\n` +
                `--------------------------------------------------\n` +
                `Base Rent      : ${currencyFormatter.format(bill.rent_amount)}\n` +
                `Water/Maint    : ${currencyFormatter.format(bill.water_amount)}\n` +
                `EB (${ebUnits.toFixed(1)} u)  : ${currencyFormatter.format(ebCost)}\n` +
                `   [Readings: ${bill.prev_eb_reading} - ${bill.curr_eb_reading}]\n` +
                (otherFees > 0 ? `Extra Charges  : ${currencyFormatter.format(otherFees)}\n` : '') +
                (bill.arrears_included > 0 ? `Prev. Arrears  : ${currencyFormatter.format(bill.arrears_included)}\n` : '') +
                `--------------------------------------------------\n` +
                `*NET TOTAL    : ${currencyFormatter.format(bill.total_amount)}*\n` +
                `*IN WORDS     : ${amountInWords}*\n` +
                `--------------------------------------------------\n` +
                (bill.is_paid ? `*AMOUNT PAID   : ${currencyFormatter.format(bill.paid_amount)}*\n` + adjustmentInfo : paymentInfo) +
                `--------------------------------------------------\n` +
                `Generated: ${new Date(bill.date_generated).toLocaleDateString('en-IN')}\n` +
                `System: RentBill Pro`;

            // HTML version for Email
            const genDate = new Date(bill.date_generated);
            const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
            const formattedGenDate = `${genDate.getFullYear()}-${months[genDate.getMonth()]}-${genDate.getDate().toString().padStart(2, '0')}`;

            let htmlAdjustments = '';
            if (bill.is_paid) {
                if (bill.discount_amount > 0) htmlAdjustments += `<tr><td style="padding: 6px 5px; border: 1px solid #000; color: #2e7d32;">DISCOUNT (Waiver)</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right; color: #2e7d32;">-${currencyFormatter.format(bill.discount_amount)}</td></tr>`;
                if (bill.write_off_amount > 0) htmlAdjustments += `<tr><td style="padding: 6px 5px; border: 1px solid #000; color: #d32f2f;">WRITE-OFF (Loss)</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right; color: #d32f2f;">-${currencyFormatter.format(bill.write_off_amount)}</td></tr>`;
                if (bill.arrears_amount > 0) htmlAdjustments += `<tr><td style="padding: 6px 5px; border: 1px solid #000; color: #f57c00;">CARRY FORWARD</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right; color: #f57c00;">${currencyFormatter.format(bill.arrears_amount)}</td></tr>`;
            }

            htmlMessage = `
                <div style="background-color: #f0f0f0; padding: 10px 5px; font-family: 'Courier New', Courier, monospace; color: #000; line-height: 1.4;">
                    <div style="background-color: #fff; border: 3px solid #000; padding: 15px; position: relative; box-shadow: 4px 4px 0px #000; max-width: 600px; margin: 0 auto; overflow-wrap: break-word; box-sizing: border-box;">
                        <!-- Header -->
                        <div style="text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                            <span style="background: #000; color: #fff; padding: 5px 10px; font-weight: bold; letter-spacing: 2px; font-size: 12px; display: inline-block; margin-bottom: 5px;">${bill.is_paid ? 'PAYMENT RECEIPT' : 'RENT BILL'}</span>
                            <h1 style="margin: 5px 0; font-size: 20px; text-transform: uppercase;">Payment Details</h1>
                            <p style="margin: 0; font-size: 11px; font-weight: bold;">BILL NO: ${bill.is_paid ? 'REC' : 'INV'}-${bill.id}-${genDate.getTime().toString().slice(-6)}</p>
                        </div>

                        <!-- User Info Section -->
                        <div style="margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 15px; text-align: center;">
                            <p style="margin: 2px 0; font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Tenant Details</p>
                            <p style="margin: 5px 0; font-size: 18px; font-weight: bold; color: #000;">${t.name}</p>
                            <div style="display: inline-block; background: #000; color: #fff; padding: 2px 10px; font-size: 12px; font-weight: bold; margin-top: 5px;">UNIT: ${t.room_no} | ${bill.billing_month.toUpperCase()}</div>
                        </div>

                        <!-- Match-Style Electricity Table -->
                        <div style="margin-bottom: 20px;">
                            <p style="background: #000; color: #fff; display: inline-block; padding: 2px 8px; font-size: 12px; margin-bottom: 10px;">ELECTRICITY CALCULATION</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <tr><td style="padding: 6px 5px; border: 1px solid #000;">PREVIOUS READING</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right;">${bill.prev_eb_reading}</td></tr>
                                <tr><td style="padding: 6px 5px; border: 1px solid #000;">CURRENT READING</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right;">${bill.curr_eb_reading}</td></tr>
                                <tr><td style="padding: 6px 5px; border: 1px solid #000;">UNITS USED (x ${t.eb_unit_price})</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right;">${ebUnits.toFixed(1)}</td></tr>
                                <tr style="font-weight: bold; background: #eee;"><td style="padding: 6px 5px; border: 1px solid #000;">TOTAL ELECTRICITY</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right;">${currencyFormatter.format(ebCost)}</td></tr>
                            </table>
                        </div>

                        <!-- Financials -->
                        <div style="margin-bottom: 20px;">
                            <p style="background: #000; color: #fff; display: inline-block; padding: 2px 8px; font-size: 12px; margin-bottom: 10px;">BILL DETAILS</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <tr><td style="padding: 6px 5px; border: 1px solid #000;">MONTHLY RENT</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right;">${currencyFormatter.format(bill.rent_amount)}</td></tr>
                                <tr><td style="padding: 6px 5px; border: 1px solid #000;">WATER/MAINT</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right;">${currencyFormatter.format(bill.water_amount)}</td></tr>
                                <tr><td style="padding: 6px 5px; border: 1px solid #000;">ELECTRICITY</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right;">${currencyFormatter.format(ebCost)}</td></tr>
                                ${otherFees > 0 ? `<tr><td style="padding: 6px 5px; border: 1px solid #000;">EXTRA CHARGES</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right;">${currencyFormatter.format(otherFees)}</td></tr>` : ''}
                                ${bill.arrears_included > 0 ? `<tr><td style="padding: 6px 5px; border: 1px solid #000; color: #d32f2f;">PREV. ARREARS</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right; color: #d32f2f;">${currencyFormatter.format(bill.arrears_included)}</td></tr>` : ''}
                                <tr style="font-weight: bold; background: #eee;"><td style="padding: 6px 5px; border: 1px solid #000;">TOTAL DUE</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right;">${currencyFormatter.format(bill.total_amount)}</td></tr>
                                ${bill.is_paid ? `
                                    <tr style="font-weight: bold; background: #fafafa;"><td style="padding: 8px 5px; border: 1px solid #000;">TOTAL PAID</td><td style="padding: 8px 5px; border: 1px solid #000; text-align: right;">${currencyFormatter.format(bill.paid_amount)}</td></tr>
                                    ${htmlAdjustments}
                                ` : ''}
                            </table>
                            <div style="margin-top: 10px; font-size: 11px; font-weight: bold; font-style: italic;">
                                Amount in words: ${amountInWords}
                            </div>
                        </div>

                        <!-- Payment Instructions -->
                        ${!bill.is_paid ? htmlPaymentInfo : ''}

                        <!-- Status Stamp -->
                        <div style="display: block; margin: 15px auto; width: fit-content; border: 4px double #000; padding: 5px 15px; transform: rotate(-5deg); font-weight: bold; font-size: 18px; text-align: center;">
                            ${bill.is_paid ? 'PAID' : 'PENDING'}
                        </div>

                        <!-- Footer -->
                        <div style="margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; text-align: center;">
                            <div style="height: 10px; background: repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 5px); margin-bottom: 5px;"></div>
                            <p style="font-size: 9px; margin: 0; letter-spacing: 3px;">GENERATED: ${formattedGenDate} // RENTBILL SYSTEM</p>
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

            htmlMessage = `
                <div style="background-color: #f0f0f0; padding: 10px 5px; font-family: 'Courier New', Courier, monospace; color: #000; line-height: 1.4;">
                    <div style="background-color: #fff; border: 3px solid #000; padding: 15px; position: relative; box-shadow: 4px 4px 0px #000; max-width: 600px; margin: 0 auto; overflow-wrap: break-word; box-sizing: border-box;">
                        <!-- Header -->
                        <div style="text-align: center; border-bottom: 3px solid #000; padding-bottom: 10px; margin-bottom: 20px;">
                            <span style="background: #000; color: #fff; padding: 5px 10px; font-weight: bold; letter-spacing: 2px; font-size: 12px; display: inline-block; margin-bottom: 5px;">EXIT SETTLEMENT</span>
                            <h1 style="margin: 5px 0; font-size: 20px; text-transform: uppercase;">Closing Details</h1>
                            <p style="margin: 0; font-size: 11px; font-weight: bold;">DOC NO: CLR-${t.id}-${genDate.getTime().toString().slice(-6)}</p>
                        </div>

                        <!-- User Info Section -->
                        <div style="margin-bottom: 20px; border-bottom: 1px dashed #000; padding-bottom: 15px; text-align: center;">
                            <p style="margin: 2px 0; font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px;">Tenant Details</p>
                            <p style="margin: 5px 0; font-size: 18px; font-weight: bold; color: #000;">${t.name}</p>
                            <div style="display: inline-block; background: #000; color: #fff; padding: 2px 10px; font-size: 12px; font-weight: bold; margin-top: 5px;">UNIT: ${t.room_no} | STAY: ${moveInDate} - ${vacateDate}</div>
                        </div>

                        <!-- Financials -->
                        <div style="margin-bottom: 20px;">
                            <p style="background: #000; color: #fff; display: inline-block; padding: 2px 8px; font-size: 12px; margin-bottom: 10px;">SETTLEMENT SUMMARY</p>
                            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                                <tr><td style="padding: 6px 5px; border: 1px solid #000;">SECURITY DEPOSIT</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right;">${currencyFormatter.format(s.advance)}</td></tr>
                                <tr><td style="padding: 6px 5px; border: 1px solid #000; color: #d32f2f;">PENDING RENT (-)</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right; color: #d32f2f;">${currencyFormatter.format(s.rentDue)}</td></tr>
                                <tr><td style="padding: 6px 5px; border: 1px solid #000; color: #d32f2f;">PENDING EB (-)</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right; color: #d32f2f;">${currencyFormatter.format(s.ebDue)}</td></tr>
                                <tr><td style="padding: 6px 5px; border: 1px solid #000; color: #d32f2f;">REPAIRS/OTHERS (-)</td><td style="padding: 6px 5px; border: 1px solid #000; text-align: right; color: #d32f2f;">${currencyFormatter.format(s.repairs)}</td></tr>
                                <tr style="font-weight: bold; background: #eee;"><td style="padding: 8px 5px; border: 1px solid #000;">${s.refundLabel.toUpperCase()}</td><td style="padding: 8px 5px; border: 1px solid #000; text-align: right;">${s.totalRefund}</td></tr>
                            </table>
                            ${s.reason && s.reason !== 'None' ? `<p style="margin-top: 10px; font-size: 11px;"><strong>Reason for Charges:</strong> ${s.reason}</p>` : ''}
                            <p style="margin-top: 10px; font-size: 11px;"><strong>Final EB Reading:</strong> ${s.ebReading}</p>
                            <p style="margin-top: 15px; font-size: 12px; line-height: 1.5;">The room has been checked and handed over. All dues are cleared. We wish you the best for your future.</p>
                        </div>

                        <!-- Status Stamp -->
                        <div style="display: block; margin: 20px auto; width: fit-content; border: 4px double #000; padding: 5px 15px; transform: rotate(-5deg); font-weight: bold; font-size: 18px; text-align: center;">
                            CLEARED
                        </div>

                        <!-- Footer -->
                        <div style="margin-top: 20px; border-top: 2px solid #000; padding-top: 10px; text-align: center;">
                            <div style="height: 10px; background: repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 5px); margin-bottom: 5px;"></div>
                            <p style="font-size: 9px; margin: 0; letter-spacing: 3px;">GENERATED: ${formattedGenDate} // RENTBILL SYSTEM</p>
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
    } else if (channel === 'copy') {
        const plainText = shareData.message;
        navigator.clipboard.writeText(plainText).then(() => {
            showNotification("Text copied to clipboard", "success");
        });
    }
    closeShareModal();
}

function closeShareModal() {
    document.getElementById('shareModal').classList.add('hidden');
}
