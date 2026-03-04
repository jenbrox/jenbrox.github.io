/* ===================================================
   EXPENSE TRACKER — UTILS
   Pure utility functions: no DOM access, no side effects.
   =================================================== */

'use strict';

const Utils = (() => {

  /* ── ID Generation ── */
  function generateId(prefix = 'id') {
    const hex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
    return `${prefix}_${Date.now()}_${hex}`;
  }

  /* ── Currency Formatting ── */
  function formatCurrency(amount, settings) {
    const symbol = (settings && settings.currencySymbol) ? settings.currencySymbol : '$';
    if (typeof amount !== 'number' || isNaN(amount)) return `${symbol}0.00`;
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount));
    return `${symbol}${formatted}`;
  }

  /* ── Date Formatting ── */
  function formatDate(isoDateString, format) {
    if (!isoDateString) return '';
    // Parse YYYY-MM-DD without timezone shift
    const [year, month, day] = isoDateString.split('-');
    if (!year || !month || !day) return isoDateString;

    const fmt = format || 'MM/DD/YYYY';
    return fmt
      .replace('YYYY', year)
      .replace('MM', month.padStart(2, '0'))
      .replace('DD', day.padStart(2, '0'));
  }

  /* ── Month Key Utilities ── */
  function getMonthKey(isoDateString) {
    if (!isoDateString) return '';
    return isoDateString.slice(0, 7); // "2026-03"
  }

  function getCurrentMonthKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  function monthLabel(monthKey) {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // Returns a monthKey that is N months before/after a given key
  function offsetMonth(monthKey, delta) {
    const [year, month] = monthKey.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  // Generates an array of monthKey strings for the last N months (inclusive of current)
  function lastNMonthKeys(n) {
    const current = getCurrentMonthKey();
    const keys = [];
    for (let i = n - 1; i >= 0; i--) {
      keys.push(offsetMonth(current, -i));
    }
    return keys;
  }

  /* ── Today in YYYY-MM-DD ── */
  function todayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /* ── Validation ── */
  function isPositiveNumber(val) {
    const n = parseFloat(val);
    return !isNaN(n) && isFinite(n) && n > 0;
  }

  function isValidDate(str) {
    if (!str) return false;
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(str)) return false;
    const d = new Date(str);
    return !isNaN(d.getTime());
  }

  /* ── Misc ── */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function debounce(fn, ms) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  /* ── Public API ── */
  return {
    generateId,
    formatCurrency,
    formatDate,
    getMonthKey,
    getCurrentMonthKey,
    monthLabel,
    offsetMonth,
    lastNMonthKeys,
    todayISO,
    isPositiveNumber,
    isValidDate,
    clamp,
    debounce,
  };
})();
