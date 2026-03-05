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

  /* ── CSV Export / Import ── */
  function exportCSV() {
    const transactions = getTransactions();
    const categories   = getCategories();
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c.name; });

    const escape = val => '"' + String(val == null ? '' : val).replace(/"/g, '""') + '"';
    const resolveCatName = id => id === '__income__' ? 'Income' : id === '__uncategorized__' ? 'Uncategorized' : catMap[id] || id || '';

    const header = ['ID', 'Type', 'Amount', 'Category', 'Date', 'Description', 'Created At'];
    const rows = transactions.map(t => [
      t.id,
      t.type,
      t.amount,
      resolveCatName(t.categoryId),
      t.date,
      t.description || '',
      t.createdAt,
    ]);

    return [header, ...rows].map(row => row.map(escape).join(',')).join('\r\n');
  }

  function importCSV(csvString) {
    try {
      const lines = csvString.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
      if (lines.length < 2) return { success: false, error: 'CSV file is empty or has no data rows.' };

      const parseRow = line => {
        const result = [];
        let cur = '', inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQuotes) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') { inQuotes = false; }
            else { cur += ch; }
          } else {
            if (ch === '"') { inQuotes = true; }
            else if (ch === ',') { result.push(cur); cur = ''; }
            else { cur += ch; }
          }
        }
        result.push(cur);
        return result;
      };

      const headers = parseRow(lines[0]).map(h => h.trim().toLowerCase());
      const idx = {
        id:          headers.indexOf('id'),
        type:        headers.indexOf('type'),
        amount:      headers.indexOf('amount'),
        category:    headers.indexOf('category'),
        date:        headers.indexOf('date'),
        description: headers.indexOf('description'),
      };

      if (idx.type === -1 || idx.amount === -1 || idx.date === -1) {
        return { success: false, error: 'CSV is missing required columns: Type, Amount, Date.' };
      }

      const categories = getCategories();
      const catByName  = {};
      categories.forEach(c => { catByName[c.name.toLowerCase()] = c.id; });

      const newCategories = [];
      let colorIdx = categories.length;

      const getOrCreateCatId = name => {
        if (!name) return null;
        const key = name.toLowerCase();
        if (catByName[key]) return catByName[key];
        const id = 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        catByName[key] = id;
        newCategories.push({ id, name, color: PRESET_COLORS[colorIdx++ % PRESET_COLORS.length], monthlyBudget: null, createdAt: new Date().toISOString() });
        return id;
      };

      const now = new Date().toISOString();
      const imported = [];
      const errors   = [];

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const cols = parseRow(lines[i]);
        const type   = (cols[idx.type] || '').trim().toLowerCase();
        const amount = parseFloat(cols[idx.amount]);
        const date   = (cols[idx.date] || '').trim();

        if (type !== 'expense' && type !== 'income') {
          errors.push(`Row ${i + 1}: invalid type "${cols[idx.type]}"`);
          continue;
        }
        if (isNaN(amount) || amount <= 0) {
          errors.push(`Row ${i + 1}: invalid amount "${cols[idx.amount]}"`);
          continue;
        }

        const catName  = idx.category !== -1 ? (cols[idx.category] || '').trim() : '';
        const catId    = type === 'income' ? '__income__' : getOrCreateCatId(catName);
        const desc     = idx.description !== -1 ? (cols[idx.description] || '').trim() : '';
        const existId  = idx.id !== -1 ? (cols[idx.id] || '').trim() : '';

        imported.push({
          id:          existId || ('txn_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6)),
          type,
          amount,
          categoryId:  catId,
          date,
          description: desc,
          createdAt:   now,
          updatedAt:   now,
        });
      }

      if (imported.length === 0) {
        return { success: false, error: 'No valid rows found.' + (errors.length ? ' Errors: ' + errors.join('; ') : '') };
      }

      if (newCategories.length > 0) saveCategories([...getCategories(), ...newCategories]);
      saveTransactions(imported);
      return { success: true, imported: imported.length, errors };
    } catch (e) {
      return { success: false, error: 'Failed to parse CSV file.' };
    }
  }

  /* ── Excel Export / Import ── */
  function exportExcel(filename) {
    if (typeof XLSX === 'undefined') {
      return { success: false, error: 'Excel library not loaded yet. Please try again.' };
    }
    const transactions = getTransactions();
    const categories   = getCategories();
    const settings     = getSettings();
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c.name; });
    const resolveCatName = id => id === '__income__' ? 'Income' : id === '__uncategorized__' ? 'Uncategorized' : catMap[id] || id || '';

    const txnRows = transactions.map(t => ({
      ID:          t.id,
      Type:        t.type,
      Amount:      t.amount,
      Category:    resolveCatName(t.categoryId),
      Date:        t.date,
      Description: t.description || '',
      'Created At': t.createdAt,
    }));

    const catRows = categories.map(c => ({
      ID:             c.id,
      Name:           c.name,
      Color:          c.color,
      'Monthly Budget': c.monthlyBudget != null ? c.monthlyBudget : '',
      'Created At':   c.createdAt,
    }));

    const settingsRow = [{
      'Monthly Budget':  settings.monthlyBudget != null ? settings.monthlyBudget : '',
      Currency:          settings.currency,
      'Currency Symbol': settings.currencySymbol,
      'Date Format':     settings.dateFormat,
    }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnRows.length ? txnRows : [{}]),     'Transactions');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(catRows.length ? catRows : [{}]),     'Categories');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(settingsRow), 'Settings');

    XLSX.writeFile(wb, filename);
    return { success: true };
  }

  function importExcel(arrayBuffer) {
    if (typeof XLSX === 'undefined') {
      return { success: false, error: 'Excel library not loaded yet. Please try again.' };
    }
    try {
      const wb = XLSX.read(arrayBuffer, { type: 'array' });

      const sheetToObjects = name => {
        const ws = wb.Sheets[name];
        if (!ws) return null;
        return XLSX.utils.sheet_to_json(ws, { defval: '' });
      };

      const txnSheet = sheetToObjects('Transactions');
      const catSheet = sheetToObjects('Categories');
      const setSheet = sheetToObjects('Settings');

      if (!txnSheet && !catSheet) {
        return { success: false, error: 'Excel file must contain a Transactions or Categories sheet.' };
      }

      if (txnSheet) {
        const now = new Date().toISOString();
        const existingCats = getCategories();
        const catByName    = {};
        (catSheet || existingCats).forEach(c => { catByName[(c.Name || c.name || '').toLowerCase()] = c.ID || c.id; });

        const newCategories = [];
        let colorIdx = existingCats.length;

        const getOrCreateCatId = name => {
          if (!name) return null;
          const key = name.toLowerCase();
          if (catByName[key]) return catByName[key];
          const id = 'cat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
          catByName[key] = id;
          newCategories.push({ id, name, color: PRESET_COLORS[colorIdx++ % PRESET_COLORS.length], monthlyBudget: null, createdAt: now });
          return id;
        };

        const transactions = txnSheet.map((row, i) => {
          const type   = String(row.Type || '').trim().toLowerCase();
          const amount = parseFloat(row.Amount);
          const catId  = type === 'income' ? '__income__' : getOrCreateCatId(String(row.Category || '').trim());
          return {
            id:          String(row.ID || ('txn_' + Date.now() + i + '_' + Math.random().toString(36).slice(2, 6))),
            type:        (type === 'income' || type === 'expense') ? type : 'expense',
            amount:      isNaN(amount) ? 0 : amount,
            categoryId:  catId,
            date:        String(row.Date || '').trim(),
            description: String(row.Description || '').trim(),
            createdAt:   String(row['Created At'] || now),
            updatedAt:   now,
          };
        });

        if (newCategories.length > 0 && !catSheet) saveCategories([...existingCats, ...newCategories]);
        saveTransactions(transactions);
      }

      if (catSheet) {
        const categories = catSheet.map(row => ({
          id:            String(row.ID || ('cat_' + Math.random().toString(36).slice(2, 10))),
          name:          String(row.Name || '').trim(),
          color:         String(row.Color || '#8b5cf6').trim(),
          monthlyBudget: row['Monthly Budget'] !== '' ? parseFloat(row['Monthly Budget']) || null : null,
          createdAt:     String(row['Created At'] || new Date().toISOString()),
        }));
        saveCategories(categories);
      }

      if (setSheet && setSheet.length > 0) {
        const row = setSheet[0];
        const settings = {
          monthlyBudget:  row['Monthly Budget'] !== '' ? parseFloat(row['Monthly Budget']) || null : null,
          currency:       String(row.Currency || 'USD').trim(),
          currencySymbol: String(row['Currency Symbol'] || '$').trim(),
          dateFormat:     String(row['Date Format'] || 'MM/DD/YYYY').trim(),
        };
        saveSettings(settings);
      }

      return { success: true };
    } catch (e) {
      return { success: false, error: 'Failed to read Excel file.' };
    }
  }

  /* ── Clear / Reset ── */
  function clearTransactions() {
    saveTransactions([]);
  }

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
    exportCSV,
    importCSV,
    exportExcel,
    importExcel,
    clearTransactions,
    resetAllData,
    getPresetColors,
    getDefaultCategoryIds,
  };
})();
