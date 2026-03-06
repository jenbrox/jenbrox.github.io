/* ===================================================
   JENTRAX — STORE
   Single source of truth using IndexedDB with
   localStorage fallback. No other module accesses
   storage directly.
   =================================================== */

'use strict';

const Store = (() => {

  const DB_NAME = 'ExpenseTrackerDB';
  const DB_VERSION = 1;
  const STORES = ['transactions', 'categories', 'settings', 'recurring', 'goals', 'debts', 'wishlist', 'accounts', 'templates', 'notes'];

  const LS_KEYS = {
    TRANSACTIONS: 'et_transactions',
    CATEGORIES:   'et_categories',
    SETTINGS:     'et_settings',
    RECURRING:    'et_recurring',
    GOALS:        'et_goals',
    DEBTS:        'et_debts',
    WISHLIST:     'et_wishlist',
    ACCOUNTS:     'et_accounts',
    TEMPLATES:    'et_templates',
    NOTES:        'et_notes',
  };

  // Stable IDs for default categories
  const DEFAULT_CATEGORY_IDS = {
    HOUSING:       'cat_default_housing',
    FOOD:          'cat_default_food',
    TRANSPORT:     'cat_default_transport',
    ENTERTAINMENT: 'cat_default_entertainment',
    HEALTH:        'cat_default_health',
    SHOPPING:      'cat_default_shopping',
    UTILITIES:     'cat_default_utilities',
    INSURANCE:     'cat_default_insurance',
    EDUCATION:     'cat_default_education',
    SUBSCRIPTIONS: 'cat_default_subscriptions',
    PERSONAL_CARE: 'cat_default_personal_care',
    TRAVEL:        'cat_default_travel',
    GIFTS:         'cat_default_gifts',
    PETS:          'cat_default_pets',
    SAVINGS:       'cat_default_savings',
    OTHER:         'cat_default_other',
  };

  const PRESET_COLORS = [
    '#6C63FF', '#22c55e', '#ef4444', '#f59e0b',
    '#3b82f6', '#ec4899', '#14b8a6', '#f97316',
    '#8b5cf6', '#06b6d4', '#84cc16', '#a16207',
  ];

  /* ═══════════════════════════════════════════════
     IN-MEMORY CACHE
     All reads come from cache; writes go to cache
     + async persist to IndexedDB.
  ═══════════════════════════════════════════════ */

  const _cache = {
    transactions: [],
    categories:   [],
    settings:     null,
    recurring:    [],
    goals:        [],
    debts:        [],
    wishlist:     [],
    accounts:     [],
    templates:    [],
    notes:        [],
  };

  let _db = null;
  let _dbReady = false;

  /* ═══════════════════════════════════════════════
     INDEXEDDB SETUP
  ═══════════════════════════════════════════════ */

  function openDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('[Store] IndexedDB not available, using localStorage only.');
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        STORES.forEach(name => {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name);
          }
        });
      };

      request.onsuccess = (e) => {
        _db = e.target.result;
        _dbReady = true;
        resolve(_db);
      };

      request.onerror = (e) => {
        console.warn('[Store] IndexedDB open failed:', e.target.error);
        reject(e.target.error);
      };
    });
  }

  function idbGet(storeName, key) {
    return new Promise((resolve, reject) => {
      if (!_db) { resolve(null); return; }
      const tx = _db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  }

  function idbPut(storeName, key, value) {
    return new Promise((resolve, reject) => {
      if (!_db) { resolve(); return; }
      const tx = _db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function idbClear(storeName) {
    return new Promise((resolve, reject) => {
      if (!_db) { resolve(); return; }
      const tx = _db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  /* ═══════════════════════════════════════════════
     PERSIST HELPER — writes cache to IndexedDB + server
  ═══════════════════════════════════════════════ */

  function persist(storeName, key, data) {
    // Also write to localStorage as fallback
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[Store] localStorage write failed:', e);
    }

    if (_dbReady) {
      idbPut(storeName, 'data', data).catch(e => {
        console.warn(`[Store] IndexedDB persist failed for ${storeName}:`, e);
      });
    }

    // Sync to server if authenticated
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      Auth.saveStore(storeName, data);
    }
  }

  /* ═══════════════════════════════════════════════
     LOAD FROM STORAGE — localStorage first (sync),
     then upgrade to IndexedDB data if available
  ═══════════════════════════════════════════════ */

  function loadFromLocalStorage(key, defaultValue) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return JSON.parse(raw);
    } catch (e) {
      console.warn(`[Store] Failed to parse "${key}":`, e);
      return defaultValue;
    }
  }

  function loadCacheFromLocalStorage() {
    _cache.transactions = loadFromLocalStorage(LS_KEYS.TRANSACTIONS, []);
    _cache.categories   = loadFromLocalStorage(LS_KEYS.CATEGORIES, []);
    _cache.settings     = loadFromLocalStorage(LS_KEYS.SETTINGS, null);
    _cache.recurring    = loadFromLocalStorage(LS_KEYS.RECURRING, []);
    _cache.goals        = loadFromLocalStorage(LS_KEYS.GOALS, []);
    _cache.debts        = loadFromLocalStorage(LS_KEYS.DEBTS, []);
    _cache.wishlist     = loadFromLocalStorage(LS_KEYS.WISHLIST, []);
    _cache.accounts     = loadFromLocalStorage(LS_KEYS.ACCOUNTS, []);
    _cache.templates    = loadFromLocalStorage(LS_KEYS.TEMPLATES, []);
    _cache.notes        = loadFromLocalStorage(LS_KEYS.NOTES, []);
  }

  async function migrateToIndexedDB() {
    if (!_dbReady) return;

    // For each store: if IndexedDB has data, use it; otherwise migrate from localStorage
    for (const storeName of STORES) {
      const existing = await idbGet(storeName, 'data');
      if (existing !== null) {
        // IndexedDB has data — update cache from it
        _cache[storeName] = existing;
      } else if (_cache[storeName] !== null && (Array.isArray(_cache[storeName]) ? _cache[storeName].length > 0 : true)) {
        // Migrate localStorage data to IndexedDB
        await idbPut(storeName, 'data', _cache[storeName]);
      }
    }
  }

  /* ═══════════════════════════════════════════════
     INITIALIZE — called once from app.js
  ═══════════════════════════════════════════════ */

  async function initStore() {
    // 1. Immediately load from localStorage (synchronous)
    loadCacheFromLocalStorage();

    // 2. Try to open IndexedDB and migrate
    try {
      await openDB();
      await migrateToIndexedDB();
    } catch (e) {
      console.warn('[Store] Running in localStorage-only mode.');
    }

    // 3. If authenticated, load data from server (overrides local)
    if (typeof Auth !== 'undefined' && Auth.isLoggedIn()) {
      try {
        const serverData = await Auth.loadAllData();
        if (serverData && Object.keys(serverData).length > 0) {
          // Server has data — use it
          for (const storeName of STORES) {
            if (serverData[storeName] !== undefined) {
              _cache[storeName] = serverData[storeName];
            }
          }
        } else if (_cache.transactions.length > 0 || _cache.categories.length > 0) {
          // Server empty but local has data — push local to server (first-time migration)
          const stores = {};
          for (const storeName of STORES) {
            if (_cache[storeName] !== null && (Array.isArray(_cache[storeName]) ? _cache[storeName].length > 0 : true)) {
              stores[storeName] = _cache[storeName];
            }
          }
          if (Object.keys(stores).length > 0) {
            Auth.saveAllStores(stores);
          }
        }
      } catch (e) {
        console.warn('[Store] Server sync failed, using local data.');
      }
    }
  }

  /* ═══════════════════════════════════════════════
     SYNCHRONOUS GETTERS / SETTERS (from cache)
  ═══════════════════════════════════════════════ */

  /* ── Transactions ── */
  function getTransactions() {
    return _cache.transactions;
  }

  function saveTransactions(arr) {
    _cache.transactions = arr;
    persist('transactions', LS_KEYS.TRANSACTIONS, arr);
  }

  /* ── Categories ── */
  function getCategories() {
    return _cache.categories;
  }

  function saveCategories(arr) {
    _cache.categories = arr;
    persist('categories', LS_KEYS.CATEGORIES, arr);
  }

  /* ── Recurring ── */
  function getRecurring() {
    return _cache.recurring;
  }

  function saveRecurring(arr) {
    _cache.recurring = arr;
    persist('recurring', LS_KEYS.RECURRING, arr);
  }

  /* ── Goals ── */
  function getGoals() {
    return _cache.goals;
  }

  function saveGoals(arr) {
    _cache.goals = arr;
    persist('goals', LS_KEYS.GOALS, arr);
  }

  /* ── Debts ── */
  function getDebts() { return _cache.debts; }
  function saveDebts(arr) { _cache.debts = arr; persist('debts', LS_KEYS.DEBTS, arr); }

  /* ── Wishlist ── */
  function getWishlist() { return _cache.wishlist; }
  function saveWishlist(arr) { _cache.wishlist = arr; persist('wishlist', LS_KEYS.WISHLIST, arr); }

  /* ── Accounts ── */
  function getAccounts() { return _cache.accounts; }
  function saveAccounts(arr) { _cache.accounts = arr; persist('accounts', LS_KEYS.ACCOUNTS, arr); }

  /* ── Templates ── */
  function getTemplates() { return _cache.templates; }
  function saveTemplates(arr) { _cache.templates = arr; persist('templates', LS_KEYS.TEMPLATES, arr); }

  /* ── Notes ── */
  function getNotes() { return _cache.notes; }
  function saveNotes(arr) { _cache.notes = arr; persist('notes', LS_KEYS.NOTES, arr); }

  /* ── Settings ── */
  function getSettings() {
    return _cache.settings || getDefaultSettings();
  }

  function saveSettings(obj) {
    _cache.settings = obj;
    persist('settings', LS_KEYS.SETTINGS, obj);
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
    if (getCategories().length === 0) {
      const defaults = [
        { id: DEFAULT_CATEGORY_IDS.HOUSING,       name: 'Housing',        color: '#6C63FF', monthlyBudget: 1200 },
        { id: DEFAULT_CATEGORY_IDS.FOOD,           name: 'Food & Dining', color: '#22c55e', monthlyBudget: 400  },
        { id: DEFAULT_CATEGORY_IDS.TRANSPORT,      name: 'Transport',     color: '#3b82f6', monthlyBudget: 150  },
        { id: DEFAULT_CATEGORY_IDS.ENTERTAINMENT,  name: 'Entertainment', color: '#ec4899', monthlyBudget: 100  },
        { id: DEFAULT_CATEGORY_IDS.HEALTH,         name: 'Health',        color: '#14b8a6', monthlyBudget: 200  },
        { id: DEFAULT_CATEGORY_IDS.SHOPPING,       name: 'Shopping',      color: '#f97316', monthlyBudget: 200  },
        { id: DEFAULT_CATEGORY_IDS.UTILITIES,      name: 'Utilities',     color: '#f59e0b', monthlyBudget: 150  },
        { id: DEFAULT_CATEGORY_IDS.INSURANCE,      name: 'Insurance',     color: '#0ea5e9', monthlyBudget: 300  },
        { id: DEFAULT_CATEGORY_IDS.EDUCATION,      name: 'Education',     color: '#a855f7', monthlyBudget: 200  },
        { id: DEFAULT_CATEGORY_IDS.SUBSCRIPTIONS,  name: 'Subscriptions', color: '#e11d48', monthlyBudget: 50   },
        { id: DEFAULT_CATEGORY_IDS.PERSONAL_CARE,  name: 'Personal Care', color: '#f472b6', monthlyBudget: 100  },
        { id: DEFAULT_CATEGORY_IDS.TRAVEL,         name: 'Travel',        color: '#06b6d4', monthlyBudget: 300  },
        { id: DEFAULT_CATEGORY_IDS.GIFTS,          name: 'Gifts & Donations', color: '#d946ef', monthlyBudget: 100 },
        { id: DEFAULT_CATEGORY_IDS.PETS,           name: 'Pets',          color: '#84cc16', monthlyBudget: 100  },
        { id: DEFAULT_CATEGORY_IDS.SAVINGS,        name: 'Savings & Investments', color: '#10b981', monthlyBudget: 500 },
        { id: DEFAULT_CATEGORY_IDS.OTHER,          name: 'Other',         color: '#8b5cf6', monthlyBudget: null },
      ].map(c => ({ ...c, createdAt: new Date().toISOString() }));
      saveCategories(defaults);
    }

    if (_cache.settings === null) {
      saveSettings(getDefaultSettings());
    }
  }

  /* ═══════════════════════════════════════════════
     EXPORT / IMPORT
  ═══════════════════════════════════════════════ */

  function exportData() {
    return JSON.stringify({
      et_transactions: getTransactions(),
      et_categories:   getCategories(),
      et_settings:     getSettings(),
      et_recurring:    getRecurring(),
      et_goals:        getGoals(),
      et_debts:        getDebts(),
      et_wishlist:     getWishlist(),
      et_accounts:     getAccounts(),
      et_templates:    getTemplates(),
      et_notes:        getNotes(),
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
      if (Array.isArray(data.et_recurring)) saveRecurring(data.et_recurring);
      if (Array.isArray(data.et_goals)) saveGoals(data.et_goals);
      if (Array.isArray(data.et_debts)) saveDebts(data.et_debts);
      if (Array.isArray(data.et_wishlist)) saveWishlist(data.et_wishlist);
      if (Array.isArray(data.et_accounts)) saveAccounts(data.et_accounts);
      if (Array.isArray(data.et_templates)) saveTemplates(data.et_templates);
      if (Array.isArray(data.et_notes)) saveNotes(data.et_notes);
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
    _cache.transactions = [];
    _cache.categories = [];
    _cache.settings = null;
    _cache.recurring = [];
    _cache.goals = [];
    _cache.debts = [];
    _cache.wishlist = [];
    _cache.accounts = [];
    _cache.templates = [];
    _cache.notes = [];

    // Clear localStorage
    Object.values(LS_KEYS).forEach(key => localStorage.removeItem(key));

    // Clear IndexedDB
    if (_dbReady) {
      STORES.forEach(name => idbClear(name).catch(() => {}));
    }

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
    initStore,
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
    getRecurring,
    saveRecurring,
    getGoals,
    saveGoals,
    getDebts,
    saveDebts,
    getWishlist,
    saveWishlist,
    getAccounts,
    saveAccounts,
    getTemplates,
    saveTemplates,
    getNotes,
    saveNotes,
  };
})();
