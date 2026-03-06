/* ===================================================
   JENTRAK — SAVINGS GOALS

   Manages savings goals with target and progress tracking.
   Users set a goal amount and track their savings progress.
   Goals can have optional deadlines and are color-coded.

   Dependencies: Utils, Store
   =================================================== */

'use strict';

const Goals = (() => {

  /* ── CRUD Operations ── */

  /**
   * Creates a new savings goal
   * @param {object} fields - Goal data
   * @param {string} fields.name - Goal name (required)
   * @param {number} fields.targetAmount - Target amount to save (required, positive)
   * @param {number} [fields.savedAmount=0] - Current amount saved
   * @param {string} [fields.deadline] - Optional deadline date (YYYY-MM-DD)
   * @param {string} [fields.color='#6C63FF'] - Color for goal in UI
   * @returns {object} {success: boolean, goal: object, errors: string[]}
   */
  function addGoal(fields) {
    const { valid, errors } = validateFields(fields);
    if (!valid) return { success: false, errors };

    const now = new Date().toISOString();
    const goal = {
      id:          Utils.generateId('goal'),
      name:        fields.name.trim(),
      targetAmount: parseFloat(fields.targetAmount),
      savedAmount:  parseFloat(fields.savedAmount) || 0,
      deadline:    fields.deadline || null,
      color:       fields.color || '#6C63FF',
      createdAt:   now,
      updatedAt:   now,
    };

    const all = Store.getGoals();
    all.push(goal);
    Store.saveGoals(all);
    return { success: true, goal };
  }

  /**
   * Updates an existing goal
   * @param {string} id - Goal ID
   * @param {object} fields - Updated goal fields (same as addGoal)
   * @returns {object} {success: boolean, goal: object, errors: string[]}
   */
  function updateGoal(id, fields) {
    const all = Store.getGoals();
    const idx = all.findIndex(g => g.id === id);
    if (idx === -1) return { success: false, errors: ['Goal not found.'] };

    const { valid, errors } = validateFields(fields);
    if (!valid) return { success: false, errors };

    all[idx] = {
      ...all[idx],
      name:         fields.name.trim(),
      targetAmount: parseFloat(fields.targetAmount),
      savedAmount:  parseFloat(fields.savedAmount) || 0,
      deadline:     fields.deadline || null,
      color:        fields.color || all[idx].color,
      updatedAt:    new Date().toISOString(),
    };

    Store.saveGoals(all);
    return { success: true, goal: all[idx] };
  }

  /**
   * Deletes a goal
   * @param {string} id - Goal ID to delete
   * @returns {boolean} Always true on success
   */
  function deleteGoal(id) {
    const all = Store.getGoals().filter(g => g.id !== id);
    Store.saveGoals(all);
    return true;
  }

  /**
   * Increments the saved amount for a goal
   * Prevents negative values by clamping to 0
   * @param {string} id - Goal ID
   * @param {number} amount - Amount to add (can be negative for subtracting)
   * @returns {object} {success: boolean, goal: object, errors: string[]}
   * @example Goals.addToGoal('goal_123', 50) // Add $50 to goal
   */
  function addToGoal(id, amount) {
    const all = Store.getGoals();
    const goal = all.find(g => g.id === id);
    if (!goal) return { success: false, errors: ['Goal not found.'] };

    goal.savedAmount = Math.max(0, goal.savedAmount + parseFloat(amount));
    goal.updatedAt = new Date().toISOString();
    Store.saveGoals(all);
    return { success: true, goal };
  }

  /**
   * Retrieves a single goal by ID
   * @param {string} id - Goal ID
   * @returns {object|null} Goal object or null if not found
   */
  function getGoalById(id) {
    return Store.getGoals().find(g => g.id === id) || null;
  }

  /**
   * Retrieves all goals, sorted by completion status then name
   * Incomplete goals appear first (sorted by name), completed goals at end
   * @returns {object[]} Sorted array of goal objects
   */
  function getAllGoals() {
    return Store.getGoals().slice().sort((a, b) => {
      // Calculate completion percentage for each goal
      const aPct = a.targetAmount ? a.savedAmount / a.targetAmount : 0;
      const bPct = b.targetAmount ? b.savedAmount / b.targetAmount : 0;
      // Incomplete goals first, then completed goals, both sorted by name
      if (aPct >= 1 && bPct < 1) return 1;
      if (bPct >= 1 && aPct < 1) return -1;
      return a.name.localeCompare(b.name);
    });
  }

  /* ── Validation ── */

  /**
   * Validates goal fields before create/update
   * @param {object} fields - Fields to validate
   * @returns {object} {valid: boolean, errors: string[]}
   * @private
   */
  function validateFields(fields) {
    const errors = [];
    if (!fields.name || fields.name.trim().length === 0) {
      errors.push('Goal name is required.');
    }
    if (!Utils.isPositiveNumber(fields.targetAmount)) {
      errors.push('Target amount must be a positive number.');
    }
    const saved = parseFloat(fields.savedAmount);
    if (fields.savedAmount !== undefined && fields.savedAmount !== '' && (isNaN(saved) || saved < 0)) {
      errors.push('Saved amount must be zero or positive.');
    }
    return { valid: errors.length === 0, errors };
  }

  /* ── Public API ── */
  return {
    addGoal,
    updateGoal,
    deleteGoal,
    addToGoal,
    getGoalById,
    getAllGoals,
  };
})();
