/* ===================================================
   JENTRAK — CATEGORIES

   Manages expense categories and budgets.
   Each category can have an optional monthly budget to track spending goals.

   Responsibilities:
   - Create, update, delete categories
   - Validate category fields (name, color)
   - Calculate monthly spending per category
   - Handle category deletion (reassigns transactions to "uncategorized")
   - Provide color presets for UI

   Dependencies: Utils, Store, Transactions
   =================================================== */

'use strict';

const Categories = (() => {

  /* ── CRUD Operations ── */

  /**
   * Creates a new expense category
   * Validates fields before creating
   * @param {object} fields - Category data
   * @param {string} fields.name - Category name (required, trimmed)
   * @param {string} fields.color - Hex color code (e.g., '#FF5733', required)
   * @param {number} [fields.monthlyBudget] - Optional monthly budget limit
   * @returns {object} {success: boolean, category: object, errors: string[]}
   * @example
   * Categories.addCategory({
   *   name: 'Groceries',
   *   color: '#2ecc71',
   *   monthlyBudget: 500
   * })
   */
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

  /**
   * Updates an existing category
   * @param {string} id - Category ID to update
   * @param {object} fields - Fields to update (same structure as addCategory)
   * @returns {object} {success: boolean, category: object, errors: string[]}
   */
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

  /**
   * Deletes a category
   * Automatically reassigns all transactions using this category to "__uncategorized__"
   * Allows safe deletion even when category is in use
   * @param {string} id - Category ID to delete
   * @returns {object} {success: boolean, reassignedCount: number}
   */
  function deleteCategory(id) {
    const inUseIds = Transactions.getCategoriesInUse();
    const usageCount = Store.getTransactions().filter(t => t.categoryId === id).length;

    if (usageCount > 0) {
      // Reassign all transactions to "__uncategorized__" before deleting
      Transactions.reassignCategory(id, '__uncategorized__');
    }

    const all = Store.getCategories().filter(c => c.id !== id);
    Store.saveCategories(all);
    return { success: true, reassignedCount: usageCount };
  }

  /**
   * Retrieves a single category by ID
   * @param {string} id - Category ID
   * @returns {object|null} Category object or null if not found
   */
  function getCategoryById(id) {
    return Store.getCategories().find(c => c.id === id) || null;
  }

  /**
   * Retrieves all categories, sorted alphabetically by name
   * @returns {object[]} Array of category objects, sorted by name
   */
  function getAllCategories() {
    return Store.getCategories()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /* ── Validation ── */

  /**
   * Validates category fields before create/update
   * @param {object} fields - Fields to validate
   * @returns {object} {valid: boolean, errors: string[]}
   * @private
   */
  function validateFields(fields) {
    const errors = [];
    // Category name is required and cannot be whitespace-only
    if (!fields.name || fields.name.trim().length === 0) {
      errors.push('Name is required.');
    }
    // Color must be a valid hex code (#RRGGBB)
    if (!fields.color || !/^#[0-9a-fA-F]{6}$/.test(fields.color)) {
      errors.push('A valid color is required.');
    }
    // Monthly budget is optional but must be positive if provided
    if (fields.monthlyBudget !== undefined && fields.monthlyBudget !== null && fields.monthlyBudget !== '') {
      if (isNaN(parseFloat(fields.monthlyBudget)) || parseFloat(fields.monthlyBudget) < 0) {
        errors.push('Monthly budget must be a positive number.');
      }
    }
    return { valid: errors.length === 0, errors };
  }

  /* ── Helpers ── */

  /**
   * Retrieves preset color options for UI color picker
   * Comes from Store presets
   * @returns {string[]} Array of hex color codes
   */
  function getPresetColors() {
    return Store.getPresetColors();
  }

  /**
   * Calculates total expenses for a category in a specific month
   * Used to display budget progress bars and spending summaries
   * @param {string} categoryId - Category ID
   * @param {string} monthKey - Month key (YYYY-MM)
   * @returns {number} Total amount spent in that month for that category
   * @example getMonthlySpend('cat_123', '2026-03') // Returns 245.50
   */
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
