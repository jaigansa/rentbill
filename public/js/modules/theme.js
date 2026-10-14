// Theme Controller: Dark Mode, Light Mode, and System Theme Preference Synchronization
import { toast } from './utils.js';

export const Theme = {
  currentTheme: 'system', // 'system' | 'light' | 'dark'

  initTheme() {
    this.currentTheme = localStorage.getItem('rb_theme') || 'system';
    this.applyTheme(this.currentTheme, false);

    // Synchronize when OS theme preference changes
    if (window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleMediaChange = () => {
        if (this.currentTheme === 'system') {
          this.applyTheme('system', false);
        }
      };
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleMediaChange);
      } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handleMediaChange);
      }
    }

    // Top navbar quick toggle button
    const btnToggle = document.getElementById('btn-toggle-theme');
    if (btnToggle) {
      btnToggle.addEventListener('click', () => {
        this.toggleTheme();
      });
    }

    // Settings modal theme dropdown
    const themeSelect = document.getElementById('settings-theme-select');
    if (themeSelect) {
      themeSelect.value = this.currentTheme;
      themeSelect.addEventListener('change', (e) => {
        this.setTheme(e.target.value);
      });
    }
  },

  isDark() {
    if (this.currentTheme === 'dark') return true;
    if (this.currentTheme === 'light') return false;
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  },

  toggleTheme() {
    const nextTheme = this.isDark() ? 'light' : 'dark';
    this.setTheme(nextTheme);
    toast(nextTheme === 'dark' ? 'Dark theme enabled' : 'Light theme enabled', 'info');
  },

  setTheme(theme) {
    this.currentTheme = theme;
    localStorage.setItem('rb_theme', theme);
    this.applyTheme(theme, true);
  },

  applyTheme(theme) {
    const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);

    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }

    // Update browser chrome meta theme color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#090d16' : '#2563eb');
    }

    // Update top toggle button icon and tooltip
    const icon = document.getElementById('theme-toggle-icon');
    const btnToggle = document.getElementById('btn-toggle-theme');
    if (icon) {
      icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    }
    if (btnToggle) {
      btnToggle.title = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
    }

    // Keep settings dropdown synchronized
    const themeSelect = document.getElementById('settings-theme-select');
    if (themeSelect && themeSelect.value !== theme) {
      themeSelect.value = theme;
    }

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }
};
