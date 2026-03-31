const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2
});

function numberToWords(num) {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    function formatAmount(n) {
        if (n < 20) return a[n];
        const tens = Math.floor(n / 10);
        const ones = n % 10;
        return b[tens] + (ones !== 0 ? ' ' + a[ones] : '');
    }

    if ((num = num.toString()).length > 9) return 'Amount too large';
    const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    
    let str = '';
    str += n[1] != 0 ? (formatAmount(Number(n[1])) || a[n[1]]) + 'Crore ' : '';
    str += n[2] != 0 ? (formatAmount(Number(n[2])) || a[n[2]]) + 'Lakh ' : '';
    str += n[3] != 0 ? (formatAmount(Number(n[3])) || a[n[3]]) + 'Thousand ' : '';
    str += n[4] != 0 ? (formatAmount(Number(n[4])) || a[n[4]]) + 'Hundred ' : '';
    str += n[5] != 0 ? ((str != '') ? 'and ' : '') + (formatAmount(Number(n[5])) || a[n[5]]) : '';
    
    return str.trim() + ' Only';
}

function showNotification(msg, type) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    const note = document.createElement('div');
    note.className = `notification ${type}`;
    
    let icon = 'info';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'alert-circle';
    if (type === 'warning') icon = 'alert-triangle';

    note.innerHTML = `
        <i data-lucide="${icon}" style="width: 18px; height: 18px; margin-right: 12px;"></i>
        <span>${msg}</span>
    `;
    container.appendChild(note);
    lucide.createIcons();
    setTimeout(() => {
        note.style.opacity = '0';
        note.style.transform = 'translateX(20px)';
        note.style.transition = 'all 0.4s ease';
        setTimeout(() => note.remove(), 400);
    }, 3000);
}

/**
 * Infinite Scroll Utility
 * @param {HTMLElement} container - The container element for the list
 * @param {Function} fetchData - Async function that returns data [ (offset, limit) -> Promise<Array> ]
 * @param {Function} renderItem - Function that returns HTML string for an item
 * @param {Object} options - { limit: 20, triggerId: 'scroll-trigger' }
 */
function setupInfiniteScroll(container, fetchData, renderItem, options = {}) {
    const limit = options.limit || 20;
    let offset = 0;
    let loading = false;
    let hasMore = true;

    // Create or find trigger
    let trigger = document.getElementById(options.triggerId);
    if (!trigger) {
        trigger = document.createElement('div');
        trigger.id = options.triggerId;
        trigger.style.height = '40px';
        trigger.style.display = 'flex';
        trigger.style.alignItems = 'center';
        trigger.style.justifyContent = 'center';
        trigger.innerHTML = '<div class="loading-spinner hidden" style="font-size: 0.7rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">LOADING MORE RECORDS...</div>';
        container.after(trigger);
    }

    const observer = new IntersectionObserver(async (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
            loading = true;
            const spinner = trigger.querySelector('.loading-spinner');
            if (spinner) spinner.classList.remove('hidden');
            
            try {
                const data = await fetchData(offset, limit);
                if (!data || data.length < limit) {
                    hasMore = false;
                    trigger.classList.add('hidden');
                }
                
                if (data && data.length > 0) {
                    const html = data.map(item => renderItem(item)).join('');
                    container.insertAdjacentHTML('beforeend', html);
                    offset += data.length;
                    lucide.createIcons();
                }
            } catch (e) {
                console.error("Infinite Scroll Error:", e);
            } finally {
                loading = false;
                const spinner = trigger.querySelector('.loading-spinner');
                if (spinner) spinner.classList.add('hidden');
            }
        }
    }, { rootMargin: '100px' });

    observer.observe(trigger);
    
    // Return reset function
    return () => {
        offset = 0;
        loading = false;
        hasMore = true;
        container.innerHTML = '';
        trigger.classList.remove('hidden');
    };
}

function generateQRDataURL(data) {
    return new Promise((resolve) => {
        const div = document.createElement('div');
        new QRCode(div, { text: data, width: 150, height: 150 });
        setTimeout(() => {
            const img = div.querySelector('img');
            resolve(img ? img.src : '');
        }, 50);
    });
}

async function forceRefreshApp() {
    if (!confirm("This will clear app cache and reload. Proceed?")) return;
    
    // Clear Service Workers
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) {
            await registration.unregister();
        }
    }
    
    // Clear Caches
    if ('caches' in window) {
        const cacheNames = await caches.keys();
        for (let name of cacheNames) {
            await caches.delete(name);
        }
    }
    
    window.location.reload(true);
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    applyTheme();
}

function applyTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-mode', isDark);
    
    // Update Theme Color Meta Tag
    let metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', isDark ? '#000000' : '#ffffff');
    
    const btn = document.getElementById('darkModeToggle');
    if (btn) {
        btn.innerHTML = isDark ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
        lucide.createIcons();
    }
}
