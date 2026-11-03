export function showToast(message, type = 'info', duration = 3200) {
  if (!message) return;
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toastEl = document.createElement('div');
  toastEl.className = `toast-msg toast-${type}`;

  let iconName = 'info';
  if (type === 'success') iconName = 'check-circle-2';
  else if (type === 'warning') iconName = 'alert-triangle';
  else if (type === 'error' || type === 'danger') iconName = 'alert-circle';

  toastEl.innerHTML = `
    <i data-lucide="${iconName}" style="width:16px; height:16px; flex-shrink:0;"></i>
    <span>${message}</span>
  `;
  container.appendChild(toastEl);
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }

  setTimeout(() => {
    toastEl.classList.add('toast-out');
    setTimeout(() => {
      if (toastEl.parentNode) toastEl.remove();
    }, 220);
  }, duration);
}

export function toast(message, type = 'info') {
  return showToast(message, type);
}

export const Utils = {
  bindVisualViewport() {
    if (window.visualViewport) {
      const updateViewport = () => {
        const vv = window.visualViewport;
        document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
      };
      window.visualViewport.addEventListener('resize', updateViewport);
      window.visualViewport.addEventListener('scroll', updateViewport);
      updateViewport();
    }
  },

  refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  },

  showToast(message, type = 'info', duration = 3000) {
    return showToast(message, type, duration);
  },

  toast(message, type = 'info') {
    return showToast(message, type);
  },

  // Smart currency formatter: cleanly formats large numbers (Crores, Lakhs, Thousands)
  formatMoney(amount, compact = false) {
    const curr = window.APP_CURRENCY || '₹';
    const num = Number(amount) || 0;
    const isNeg = num < 0;
    const abs = Math.abs(num);

    if (compact) {
      // 1 Crore = 10,000,000 (100 Lakhs)
      if (abs >= 10000000) {
        const cr = abs / 10000000;
        const formattedCr = cr >= 100 ? cr.toFixed(1) : cr.toFixed(2);
        return `${isNeg ? '-' : ''}${curr}${parseFloat(formattedCr)} Cr`;
      }
      // 1 Lakh = 100,000
      if (abs >= 100000) {
        const l = abs / 100000;
        const formattedL = l >= 100 ? l.toFixed(1) : l.toFixed(2);
        return `${isNeg ? '-' : ''}${curr}${parseFloat(formattedL)} L`;
      }
    }

    // Standard view with Indian comma grouping
    const hasPaise = (abs % 1) !== 0;
    const formatted = abs.toLocaleString('en-IN', {
      minimumFractionDigits: hasPaise ? 2 : 0,
      maximumFractionDigits: 2
    });
    return `${isNeg ? '-' : ''}${curr}${formatted}`;
  },

  formatFullMoney(amount) {
    const curr = window.APP_CURRENCY || '₹';
    const num = Number(amount) || 0;
    return `${num < 0 ? '-' : ''}${curr}${Math.abs(num).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  },

  formatMonth(monthStr) {
    if (typeof Share !== 'undefined' && Share.formatMonth) {
      return Share.formatMonth(monthStr);
    }
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

  setupDateBadge() {
    const today = new Date();
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    const badge = document.getElementById('current-date-badge');
    if (badge) badge.textContent = today.toLocaleDateString(undefined, options);

    // Billing Month default: previous month (YYYY-MM)
    const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const prevYyyy = prevMonthDate.getFullYear();
    const prevMm = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
    const billMonth = document.getElementById('bill-month');
    if (billMonth) {
      billMonth.value = `${prevYyyy}-${prevMm}`;
      const monthText = document.getElementById('bill-month-text');
      if (monthText) monthText.textContent = this.formatMonth(billMonth.value);
    }

    // Due Date default: 5th day of current month (YYYY-MM-05)
    const currYyyy = today.getFullYear();
    const currMm = String(today.getMonth() + 1).padStart(2, '0');
    const dueDateStr = `${currYyyy}-${currMm}-05`;
    const dueDateInput = document.getElementById('bill-due-date');
    if (dueDateInput) dueDateInput.value = dueDateStr;

    const payDateInput = document.getElementById('pay-date');
    if (payDateInput) payDateInput.value = today.toISOString().split('T')[0];

    const moveInInput = document.getElementById('tenant-move-in');
    if (moveInInput) moveInInput.value = today.toISOString().split('T')[0];
  },

  getUnitTypeSvg(type = '') {
    const t = (type || '').toLowerCase();
    if (t.includes('house') || t.includes('villa') || t.includes('home')) {
      // Independent House / Villa
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>`;
    }
    if (t.includes('room') || t.includes('bed') || t.includes('pg') || t.includes('single') || t.includes('studio')) {
      // Room / Bed / PG / Studio
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 4v16"/>
        <path d="M2 8h18a2 2 0 0 1 2 2v10"/>
        <path d="M2 17h20"/>
        <path d="M6 8v9"/>
      </svg>`;
    }
    if (t.includes('shop') || t.includes('commercial') || t.includes('store') || t.includes('office')) {
      // Commercial / Storefront / Shop
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l1-5h16l1 5"/>
        <path d="M3 9v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9"/>
        <path d="M9 22V12h6v10"/>
        <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/>
      </svg>`;
    }
    // Default: Multi-Storey Apartment / Residential Flat
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
      <path d="M9 22v-4h6v4"/>
      <path d="M8 6h.01"/><path d="M16 6h.01"/>
      <path d="M8 10h.01"/><path d="M16 10h.01"/>
      <path d="M8 14h.01"/><path d="M16 14h.01"/>
    </svg>`;
  },

  // Client-side CSV/Excel spreadsheet generator with UTF-8 BOM
  downloadCSV(filename, headers, rows) {
    if (!headers || !headers.length) return;
    const escapeCol = (val) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const headerLine = headers.map(escapeCol).join(',');
    const dataLines = (rows || []).map(row => row.map(escapeCol).join(','));
    const csvContent = '\uFEFF' + [headerLine, ...dataLines].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
