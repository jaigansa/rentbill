// RentBill Pro — Financial & Real-Time KPI Dashboard Engine (Pure Presentation)
import { getSupabaseClient } from '../core/config.js';
import { formatCurrency, refreshLucideIcons } from '../core/ui.js';

export async function loadDashboard() {
  const client = getSupabaseClient();

  try {
    if (!client) return;

    // LANDLORD DASHBOARD VIEW
    const bannerEl = document.getElementById('tenant-portal-banner');
    if (bannerEl) bannerEl.style.display = 'none';

    let totalBilled = 0;
    let totalCollected = 0;
    let totalExpenses = 0;
    let outstanding = 0;
    let arrearsSum = 0;
    let activeTenants = 0;
    let vacantUnits = 0;
    let pendingProofs = 0;

    // 1. Fetch Official Reconciled Accounting Ledger from Go Domain Engine
    if (client.getLedger) {
      const { data: ledger } = await client.getLedger();
      if (ledger) {
        totalBilled = ledger.total_billed || 0;
        totalCollected = ledger.total_collected || 0;
        totalExpenses = ledger.total_expenses || 0;
        outstanding = ledger.outstanding > 0 ? ledger.outstanding : 0;
      }
    }

    // 2. Fetch Directory Counts (pure presentation counts)
    try {
      const { data: rData } = await client.from('renters').select('id, is_active, pending_arrears').is('deleted_at', null);
      const renters = rData || [];
      activeTenants = renters.filter(r => r.is_active).length;
      renters.forEach(r => { if (r.is_active) arrearsSum += Number(r.pending_arrears) || 0; });

      const { data: uData } = await client.from('units').select('id, status').is('deleted_at', null);
      const units = uData || [];
      vacantUnits = units.filter(u => u.status === 'VACANT').length;

      const { data: pData } = await client.from('payments').select('id').eq('proof_status', 'PENDING').is('deleted_at', null);
      pendingProofs = (pData || []).length;
    } catch (e) {
      console.warn('Directory count fetch notice:', e);
    }

    // 3. Render Server-Calculated Figures Directly to DOM (Zero UI Math)
    const valBilled = document.getElementById('val-billed');
    const valCollected = document.getElementById('val-collected');
    const valOutstanding = document.getElementById('val-outstanding');
    const valArrears = document.getElementById('val-arrears');
    const valExpenses = document.getElementById('val-expenses');
    const valTenants = document.getElementById('val-tenants');
    const valVacant = document.getElementById('val-vacant');
    const valProofs = document.getElementById('val-proofs');

    if (valBilled) valBilled.textContent = formatCurrency(totalBilled);
    if (valCollected) valCollected.textContent = formatCurrency(totalCollected);
    if (valOutstanding) valOutstanding.textContent = formatCurrency(outstanding);
    if (valArrears) valArrears.textContent = formatCurrency(arrearsSum);
    if (valExpenses) valExpenses.textContent = formatCurrency(totalExpenses);
    if (valTenants) valTenants.textContent = activeTenants;
    if (valVacant) valVacant.textContent = vacantUnits;
    if (valProofs) valProofs.textContent = pendingProofs;

    refreshLucideIcons();
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}
