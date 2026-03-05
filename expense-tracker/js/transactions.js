/* ===================================================
   EXPENSE TRACKER — TRANSACTIONS
   CRUD operations and analytical queries.
   Depends on: Utils, Store
   =================================================== */

'use strict';

const Transactions = (() => {

  /* ── CRUD ── */
  function addTransaction(fields) {
    const { valid, errors } = validateFields(fields);
    if (!valid) return { success: false, errors };

    const now = new Date().toISOString();
    const txn = {
      id:          Utils.generateId('txn'),
      type:        fields.type,
      amount:      parseFloat(fields.amount),
      categoryId:  fields.categoryId,
      date:        fields.date,
      description: (fields.description || '').trim(),
      createdAt:   now,
      updatedAt:   now,
    };

    const all = Store.getTransactions();
    all.push(txn);
    Store.saveTransactions(all);
    return { success: true, transaction: txn };
  }

  function updateTransaction(id, fields) {
    const all = Store.getTransactions();
    const idx = all.findIndex(t => t.id === id);
    if (idx === -1) return { success: false, errors: ['Transaction not found.'] };

    const { valid, errors } = validateFields(fields);
    if (!valid) return { success: false, errors };

    all[idx] = {
      ...all[idx],
      type:        fields.type,
      amount:      parseFloat(fields.amount),
      categoryId:  fields.categoryId,
      date:        fields.date,
      description: (fields.description || '').trim(),
      updatedAt:   new Date().toISOString(),
    };

    Store.saveTransactions(all);
    return { success: true, transaction: all[idx] };
  }

  function deleteTransaction(id) {
    const all = Store.getTransactions();
    const filtered = all.filter(t => t.id !== id);
    if (filtered.length === all.length) return false;
    Store.saveTransactions(filtered);
    return true;
  }

  function getTransactionById(id) {
    return Store.getTransactions().find(t => t.id === id) || null;
  }

  /* ── Validation ── */
  function validateFields(fields) {
    const errors = [];
    if (!fields.type || !['income', 'expense'].includes(fields.type)) {
      errors.push('Type must be income or expense.');
    }
    if (!Utils.isPositiveNumber(fields.amount)) {
      errors.push('Amount must be a positive number.');
    }
    if (!fields.categoryId) {
      errors.push('Category is required.');
    }
    if (!Utils.isValidDate(fields.date)) {
      errors.push('Date is required and must be valid.');
    }
    return { valid: errors.length === 0, errors };
  }

  /* ── Queries ── */
  function getTransactionsForMonth(monthKey) {
    return Store.getTransactions()
      .filter(t => Utils.getMonthKey(t.date) === monthKey)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function getFilteredTransactions(monthKey, typeFilter, categoryFilter) {
    return getTransactionsForMonth(monthKey).filter(t => {
      if (typeFilter && typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter && categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
      return true;
    });
  }

  /* ── Aggregations ── */
  function summarizeMonth(monthKey) {
    const txns = getTransactionsForMonth(monthKey);
    let income = 0, expenses = 0, incomeCount = 0, expenseCount = 0;
    for (const t of txns) {
      if (t.type === 'income') {
        income += t.amount;
        incomeCount++;
      } else {
        expenses += t.amount;
        expenseCount++;
      }
    }
    return { income, expenses, net: income - expenses, incomeCount, expenseCount };
  }

  function summarizeByCategory(monthKey) {
    const txns = getTransactionsForMonth(monthKey).filter(t => t.type === 'expense');
    const categories = Store.getCategories();
    const catMap = {};
    for (const c of categories) catMap[c.id] = c;

    const grouped = {};
    for (const t of txns) {
      if (!grouped[t.categoryId]) {
        const cat = catMap[t.categoryId];
        grouped[t.categoryId] = {
          categoryId:   t.categoryId,
          categoryName: cat ? cat.name : 'Uncategorized',
          color:        cat ? cat.color : '#94a3b8',
          totalSpent:   0,
          budget:       cat ? cat.monthlyBudget : null,
        };
      }
      grouped[t.categoryId].totalSpent += t.amount;
    }

    return Object.values(grouped).map(g => ({
      ...g,
      percentUsed: g.budget ? (g.totalSpent / g.budget) * 100 : null,
    })).sort((a, b) => b.totalSpent - a.totalSpent);
  }

  function getMonthlyTrend(numMonths = 6) {
    const monthKeys = Utils.lastNMonthKeys(numMonths);
    return monthKeys.map(key => {
      const { income, expenses } = summarizeMonth(key);
      return { monthKey: key, label: Utils.monthLabel(key), income, expenses };
    });
  }

  // Returns all categories referenced by at least one transaction
  function getCategoriesInUse() {
    const txns = Store.getTransactions();
    return [...new Set(txns.map(t => t.categoryId))];
  }

  // Reassign all transactions from one categoryId to another
  function reassignCategory(fromId, toId) {
    const all = Store.getTransactions().map(t =>
      t.categoryId === fromId ? { ...t, categoryId: toId, updatedAt: new Date().toISOString() } : t
    );
    Store.saveTransactions(all);
  }

  /* ── Public API ── */
  return {
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getTransactionById,
    getTransactionsForMonth,
    getFilteredTransactions,
    summarizeMonth,
    summarizeByCategory,
    getMonthlyTrend,
    getCategoriesInUse,
    reassignCategory,
  };
})();
