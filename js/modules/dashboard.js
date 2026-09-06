// RentBill Pro — Financial & Real-Time KPI Dashboard Engine (Pure Supabase)
import { getSupabaseClient } from '../core/config.js';
import { formatCurrency, refreshLucideIcons } from '../core/ui.js';

export async function loadDashboard() {
  const supabaseClient = getSupabaseClient();

  try {
    if (!supabaseClient) return;

    // LANDLORD DASHBOARD VIEW
    const bannerEl = document.getElementById('tenant-portal-banner');
    if (bannerEl) bannerEl.style.display = 'none';

    let bills = [];
    let renters = [];
    let units = [];
    let expenses = [];
    let pendingProofs = 0;

    try {
      const { data: bData } = await supabaseClient.from('bills').select('net_amount, paid_amount, status').is('deleted_at', null);
      bills = bData || [];
      const { data: rData } = await supabaseClient.from('renters').select('id, is_active, pending_arrears').is('deleted_at', null);
      renters = rData || [];
      const { data: uData } = await supabaseClient.from('units').select('id, status').is('deleted_at', null);
      units = uData || [];
      const { data: eData } = await supabaseClient.from('expenses').select('amount').is('deleted_at', null);
      expenses = eData || [];
      const { data: pData } = await supabaseClient.from('payments').select('id').eq('proof_status', 'PENDING').is('deleted_at', null);
      pendingProofs = (pData || []).length;
    } catch (e) {
      console.warn('Dashboard fetch warning:', e);
    }

    let totalBilled = 0;
    let totalCollected = 0;
    let totalExpenses = 0;
    let arrearsSum = 0;

    (bills || []).forEach(b => {
      totalBilled += Number(b.net_amount) || 0;
      totalCollected += Number(b.paid_amount) || 0;
    });

    (expenses || []).forEach(e => totalExpenses += Number(e.amount) || 0);
    (renters || []).forEach(r => { if (r.is_active) arrearsSum += Number(r.pending_arrears) || 0; });

    const activeTenants = (renters || []).filter(r => r.is_active).length;
    const vacantUnits = (units || []).filter(u => u.status === 'VACANT').length;
    const outstanding = totalBilled - totalCollected;

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
    if (valOutstanding) valOutstanding.textContent = formatCurrency(outstanding > 0 ? outstanding : 0);
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
