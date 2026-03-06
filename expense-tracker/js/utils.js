/* ===================================================
   JENTRAX — UTILS
   Pure utility functions: no DOM access, no side effects.
   =================================================== */

'use strict';

const Utils = (() => {

  /* ── ID Generation ── */
  /**
   * Generates a unique ID with timestamp and random hex suffix
   * Suitable for object keys in IndexedDB and localStorage
   * @param {string} [prefix='id'] - Prefix for the ID (e.g., 'txn' for transaction)
   * @returns {string} Unique ID in format: prefix_timestamp_randomhex
   * @example generateId('txn') // 'txn_1709892345000_a3b2'
   */
  function generateId(prefix = 'id') {
    const hex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
    return `${prefix}_${Date.now()}_${hex}`;
  }

  /* ── Currency Formatting ── */
  /**
   * Formats a number as currency with proper symbol and decimal places
   * Uses user's currency symbol preference or defaults to USD ($)
   * @param {number} amount - The amount to format (can be negative)
   * @param {object} [settings] - Optional settings object
   * @param {string} [settings.currencySymbol='$'] - Currency symbol to use
   * @returns {string} Formatted currency (e.g., "$123.45")
   * @example formatCurrency(123.456, {currencySymbol: '€'}) // '€123.46'
   */
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
  /**
   * Formats an ISO date string (YYYY-MM-DD) into a readable format
   * Avoids timezone shifts by parsing manually
   * @param {string} isoDateString - ISO format date (YYYY-MM-DD)
   * @param {string} [format='MM/DD/YYYY'] - Format template with replaceable tokens
   * @returns {string} Formatted date or empty string if invalid
   * @example formatDate('2026-03-15', 'DD/MM/YYYY') // '15/03/2026'
   */
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
  /**
   * Extracts the month key (YYYY-MM) from an ISO date string
   * Month keys are used to organize transactions by month
   * @param {string} isoDateString - ISO format date (YYYY-MM-DD)
   * @returns {string} Month key in format YYYY-MM (e.g., "2026-03")
   * @example getMonthKey('2026-03-15') // '2026-03'
   */
  function getMonthKey(isoDateString) {
    if (!isoDateString) return '';
    return isoDateString.slice(0, 7); // "2026-03"
  }

  /**
   * Gets the current month key (YYYY-MM format)
   * @returns {string} Current month in format YYYY-MM
   */
  function getCurrentMonthKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /**
   * Converts a month key into a human-readable label
   * @param {string} monthKey - Month key in format YYYY-MM
   * @returns {string} Formatted label (e.g., "March 2026")
   * @example monthLabel('2026-03') // 'March 2026'
   */
  function monthLabel(monthKey) {
    if (!monthKey) return '';
    const [year, month] = monthKey.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  /**
   * Calculates a month key that is N months before/after a given key
   * Handles year transitions automatically
   * @param {string} monthKey - Starting month key (YYYY-MM)
   * @param {number} delta - Number of months to offset (-12 to go back a year, +1 for next month)
   * @returns {string} New month key in format YYYY-MM
   * @example offsetMonth('2026-03', -1) // '2026-02'
   * @example offsetMonth('2026-01', -1) // '2025-12'
   */
  function offsetMonth(monthKey, delta) {
    const [year, month] = monthKey.split('-').map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  }

  /**
   * Generates an array of the last N month keys (inclusive of current)
   * Useful for generating 6-month or 12-month lookback arrays
   * @param {number} n - Number of months to include (latest first)
   * @returns {string[]} Array of month keys in descending order
   * @example lastNMonthKeys(3) // ['2026-03', '2026-02', '2026-01']
   */
  function lastNMonthKeys(n) {
    const current = getCurrentMonthKey();
    const keys = [];
    for (let i = n - 1; i >= 0; i--) {
      keys.push(offsetMonth(current, -i));
    }
    return keys;
  }

  /* ── Today in YYYY-MM-DD ── */
  /**
   * Gets today's date in ISO format (YYYY-MM-DD)
   * Useful for setting default date on transaction forms
   * @returns {string} Today's date in format YYYY-MM-DD
   * @example todayISO() // '2026-03-06'
   */
  function todayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /* ── Validation ── */
  /**
   * Validates that a value is a positive, finite number
   * Used to validate transaction amounts
   * @param {*} val - Value to validate (any type)
   * @returns {boolean} True if val is a positive, finite number
   * @example isPositiveNumber(123.45) // true
   * @example isPositiveNumber(-5) // false
   * @example isPositiveNumber('not a number') // false
   */
  function isPositiveNumber(val) {
    const n = parseFloat(val);
    return !isNaN(n) && isFinite(n) && n > 0;
  }

  /**
   * Validates that a string is a valid ISO date (YYYY-MM-DD)
   * Also checks that the date itself is valid (e.g., not Feb 30)
   * @param {string} str - String to validate
   * @returns {boolean} True if str is a valid ISO date
   * @example isValidDate('2026-03-15') // true
   * @example isValidDate('2026-02-30') // false
   * @example isValidDate('not-a-date') // false
   */
  function isValidDate(str) {
    if (!str) return false;
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(str)) return false;
    const d = new Date(str);
    return !isNaN(d.getTime());
  }

  /* ── Misc ── */
  /**
   * Constrains a value to be within a min/max range
   * Used to keep values within valid bounds
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum allowed value
   * @param {number} max - Maximum allowed value
   * @returns {number} Clamped value
   * @example clamp(150, 0, 100) // 100
   * @example clamp(-5, 0, 100) // 0
   */
  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  /**
   * Creates a debounced version of a function that delays execution
   * Resets timer if called again within the delay period
   * Useful for search/filter inputs and saving during user typing
   * @param {function} fn - Function to debounce
   * @param {number} ms - Delay in milliseconds before execution
   * @returns {function} Debounced version of fn
   * @example
   * const debouncedSave = debounce(() => saveData(), 500);
   * input.addEventListener('change', debouncedSave); // Waits 500ms after last change
   */
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
