/* ===================================================
   EXPENSE TRACKER — STORE
   Single source of truth for localStorage.
   No other module writes to localStorage directly.
   =================================================== */

'use strict';

const Store = (() => {

  const KEYS = {
    TRANSACTIONS: 'et_transactions',
    CATEGORIES:   'et_categories',
    SETTINGS:     'et_settings',
  };

  // Stable IDs for default categories (hardcoded so existing transactions stay valid after reset)
  const DEFAULT_CATEGORY_IDS = {
    HOUSING:       'cat_default_housing',
    FOOD:          'cat_default_food',
    TRANSPORT:     'cat_default_transport',
    ENTERTAINMENT: 'cat_default_entertainment',
    HEALTH:        'cat_default_health',
    SHOPPING:      'cat_default_shopping',
    UTILITIES:     'cat_default_utilities',
    OTHER:         'cat_default_other',
  };

  const PRESET_COLORS = [
    '#6C63FF', '#22c55e', '#ef4444', '#f59e0b',
    '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
    '#8b5cf6', '#06b6d4', '#84cc16', '#a16207',
  ];

  /* ── Low-level R/W ── */
  function load(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[Store] Failed to parse "${key}":`, e);
      return defaultValue;
    }
  }

  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`[Store] Failed to save "${key}":`, e);
    }
  }

  /* ── Transactions ── */
  function getTransactions() {
    return load(KEYS.TRANSACTIONS, []);
  }

  function saveTransactions(arr) {
    save(KEYS.TRANSACTIONS, arr);
  }

  /* ── Categories ── */
  function getCategories() {
    return load(KEYS.CATEGORIES, []);
  }

  function saveCategories(arr) {
    save(KEYS.CATEGORIES, arr);
  }

  /* ── Settings ── */
  function getSettings() {
    return load(KEYS.SETTINGS, getDefaultSettings());
  }

  function saveSettings(obj) {
    save(KEYS.SETTINGS, obj);
  }

  function getDefaultSettings() {
    return {
      monthlyBudget:   null,
      currency:        'USD',
      currencySymbol:  '$',
      dateFormat:      'MM/DD/YYYY',
    };
  }

  /* ── Seed default data ── */
  function seedDefaultData() {
    // Only seed categories if none exist
    if (getCategories().length === 0) {
      const defaults = [
        { id: DEFAULT_CATEGORY_IDS.HOUSING,       name: 'Housing',       color: '#6C63FF', monthlyBudget: 1200 },
        { id: DEFAULT_CATEGORY_IDS.FOOD,           name: 'Food & Dining', color: '#22c55e', monthlyBudget: 400  },
        { id: DEFAULT_CATEGORY_IDS.TRANSPORT,      name: 'Transport',     color: '#3b82f6', monthlyBudget: 150  },
        { id: DEFAULT_CATEGORY_IDS.ENTERTAINMENT,  name: 'Entertainment', color: '#ec4899', monthlyBudget: 100  },
        { id: DEFAULT_CATEGORY_IDS.HEALTH,         name: 'Health',        color: '#14b8a6', monthlyBudget: 200  },
        { id: DEFAULT_CATEGORY_IDS.SHOPPING,       name: 'Shopping',      color: '#f97316', monthlyBudget: 200  },
        { id: DEFAULT_CATEGORY_IDS.UTILITIES,      name: 'Utilities',     color: '#f59e0b', monthlyBudget: 150  },
        { id: DEFAULT_CATEGORY_IDS.OTHER,          name: 'Other',         color: '#8b5cf6', monthlyBudget: null },
      ].map(c => ({ ...c, createdAt: new Date().toISOString() }));
      saveCategories(defaults);
    }

    // Only seed settings if none exist
    if (localStorage.getItem(KEYS.SETTINGS) === null) {
      saveSettings(getDefaultSettings());
    }
  }

  /* ── Export / Import ── */
  function exportData() {
    return JSON.stringify({
      et_transactions: getTransactions(),
      et_categories:   getCategories(),
      et_settings:     getSettings(),
      exportedAt:      new Date().toISOString(),
      version:         1,
    }, null, 2);
  }

  function importData(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (!Array.isArray(data.et_transactions)) return { success: false, error: 'Missing or invalid transactions array.' };
      if (!Array.isArray(data.et_categories))   return { success: false, error: 'Missing or invalid categories array.' };
      if (typeof data.et_settings !== 'object' || data.et_settings === null) {
        return { success: false, error: 'Missing or invalid settings object.' };
      }
      saveTransactions(data.et_transactions);
      saveCategories(data.et_categories);
      saveSettings(data.et_settings);
      return { success: true };
    } catch (e) {
      return { success: false, error: 'Invalid JSON file.' };
    }
  }

  /* ── Reset ── */
  function resetAllData() {
    localStorage.removeItem(KEYS.TRANSACTIONS);
    localStorage.removeItem(KEYS.CATEGORIES);
    localStorage.removeItem(KEYS.SETTINGS);
    seedDefaultData();
  }

  /* ── Helpers ── */
  function getPresetColors() {
    return PRESET_COLORS.slice();
  }

  function getDefaultCategoryIds() {
    return DEFAULT_CATEGORY_IDS;
  }

  /* ── Public API ── */
  return {
    getTransactions,
    saveTransactions,
    getCategories,
    saveCategories,
    getSettings,
    saveSettings,
    seedDefaultData,
    exportData,
    importData,
    resetAllData,
    getPresetColors,
    getDefaultCategoryIds,
  };
})();
