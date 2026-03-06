/* ===================================================
   JENTRAX — CATEGORIES
   CRUD for categories (budget is a category property).
   Depends on: Utils, Store, Transactions
   =================================================== */

'use strict';

const Categories = (() => {

  /* ── CRUD ── */
  function addCategory(fields) {
    const { valid, errors } = validateFields(fields);
    if (!valid) return { success: false, errors };

    const cat = {
      id:            Utils.generateId('cat'),
      name:          fields.name.trim(),
      color:         fields.color,
      monthlyBudget: fields.monthlyBudget ? parseFloat(fields.monthlyBudget) : null,
      createdAt:     new Date().toISOString(),
    };

    const all = Store.getCategories();
    all.push(cat);
    Store.saveCategories(all);
    return { success: true, category: cat };
  }

  function updateCategory(id, fields) {
    const all = Store.getCategories();
    const idx = all.findIndex(c => c.id === id);
    if (idx === -1) return { success: false, errors: ['Category not found.'] };

    const { valid, errors } = validateFields(fields);
    if (!valid) return { success: false, errors };

    all[idx] = {
      ...all[idx],
      name:          fields.name.trim(),
      color:         fields.color,
      monthlyBudget: fields.monthlyBudget ? parseFloat(fields.monthlyBudget) : null,
    };

    Store.saveCategories(all);
    return { success: true, category: all[idx] };
  }

  function deleteCategory(id) {
    const inUseIds = Transactions.getCategoriesInUse();
    const usageCount = Store.getTransactions().filter(t => t.categoryId === id).length;

    if (usageCount > 0) {
      // Reassign to "__uncategorized__" before deleting
      Transactions.reassignCategory(id, '__uncategorized__');
    }

    const all = Store.getCategories().filter(c => c.id !== id);
    Store.saveCategories(all);
    return { success: true, reassignedCount: usageCount };
  }

  function getCategoryById(id) {
    return Store.getCategories().find(c => c.id === id) || null;
  }

  function getAllCategories() {
    return Store.getCategories()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /* ── Validation ── */
  function validateFields(fields) {
    const errors = [];
    if (!fields.name || fields.name.trim().length === 0) {
      errors.push('Name is required.');
    }
    if (!fields.color || !/^#[0-9a-fA-F]{6}$/.test(fields.color)) {
      errors.push('A valid color is required.');
    }
    if (fields.monthlyBudget !== undefined && fields.monthlyBudget !== null && fields.monthlyBudget !== '') {
      if (isNaN(parseFloat(fields.monthlyBudget)) || parseFloat(fields.monthlyBudget) < 0) {
        errors.push('Monthly budget must be a positive number.');
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /* ── Helpers ── */
  function getPresetColors() {
    return Store.getPresetColors();
  }

  // Returns monthly spend for a category in a given month
  function getMonthlySpend(categoryId, monthKey) {
    return Store.getTransactions()
      .filter(t => t.type === 'expense' && t.categoryId === categoryId && Utils.getMonthKey(t.date) === monthKey)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  /* ── Public API ── */
  return {
    addCategory,
    updateCategory,
    deleteCategory,
    getCategoryById,
    getAllCategories,
    getPresetColors,
    getMonthlySpend,
  };
})();
