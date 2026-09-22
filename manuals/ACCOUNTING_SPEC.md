# RentBill Pro — Accounting & Ledger Specification

## 1. Core Principles

Financial precision in RentBill Pro is strictly governed by three design mandates:
1. **Integer Arithmetic (Paise):** To eliminate binary floating-point rounding errors (e.g., `0.1 + 0.2 != 0.3`), all financial storage and internal calculations in Go are executed in integer paise (`1 INR = 100 paise`).
2. **Server-Side Accounting Domain:** The GUI never calculates financial balances or invoice sums independently. All calculations are executed by `backend/internal/accounting/engine.go` or verified by Go endpoints.
3. **Double-Entry Reconciliation:** All bills represent accounts receivable; all verified payments represent accounts payable / cash inflows; all expenses and owner payouts represent outflows.

---

## 2. Bill Calculation Model

### 2.1 Formulae

Given an invoice input:
- **Base Rent ($R$):** Stored in paise.
- **Electricity Consumption:**
  $$\Delta E = \max(0, E_{\text{current}} - E_{\text{prev}})$$
  $$C_E = \text{round}(\Delta E \times \text{Rate}_E)$$
- **Water Consumption:**
  $$\Delta W = \max(0, W_{\text{current}} - W_{\text{prev}})$$
  $$C_W = \text{round}(\Delta W \times \text{Rate}_W)$$
- **Gross Charges ($G$):**
  $$G = R + C_E + C_W + M_{\text{fixed}} + F_{\text{late}} + A_{\text{past}}$$
  *(where $M_{\text{fixed}}$ is fixed maintenance, $F_{\text{late}}$ is late fee, and $A_{\text{past}}$ is past arrears)*
- **Net Payable ($N$):**
  $$N = \max(0, G - D_{\text{discount}})$$

### 2.2 Meter Rollover / Reset Handling
If a utility meter is replaced or reset to zero:
- A `meter_resets` audit log record is created with `reset_at` timestamp and new initial baseline.
- If $E_{\text{current}} < E_{\text{prev}}$ and no reset occurred, an error is returned to prevent negative consumption.

---

## 3. Bill Payment Status Transitions

The status of any bill is dynamically derived from:
- $N$ = Net Payable Amount
- $P$ = Total Verified Paid Amount ($P = \sum \text{payments}$)
- $V$ = Void Flag

$$\text{Status} = \begin{cases} 
\text{VOID} & \text{if } V = \text{true} \\
\text{PAID} & \text{if } P \ge N \\
\text{PARTIAL} & \text{if } P > 0 \text{ and } P < N \\
\text{UNPAID} & \text{if } P = 0 
\end{cases}$$

> **Note on Zero-Net Bills:** If a bill has $N = 0$ (e.g., 100% discount waiver) and receives a payment ($P > 0$), it is marked as `PARTIAL` rather than `PAID` to flag an account credit review.

---

## 4. Ledger Reconciliation

The property ledger reconciliation computes cumulative property performance:

$$\text{Billed Receivables} = \sum_{\text{bills where status} \ne \text{VOID}} \text{net\_amount}$$

$$\text{Cash Collected} = \sum_{\text{payments where status} = \text{VERIFIED}} \text{amount}$$

$$\text{Total Outstanding} = \max(0, \text{Billed Receivables} - \text{Cash Collected})$$

$$\text{Total Outflows} = \sum \text{expenses} + \sum \text{withdrawals}$$

$$\text{Net Cash Flow} = \text{Cash Collected} - \text{Total Outflows}$$

Any soft-deleted records (`deleted_at IS NOT NULL`) are strictly excluded from all reconciliations.
