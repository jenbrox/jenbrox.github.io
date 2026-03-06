/* ===================================================
   JENTRAX — SAVINGS GOALS
   CRUD for savings goals with progress tracking.
   Depends on: Utils, Store
   =================================================== */

'use strict';

const Goals = (() => {

  /* ── CRUD ── */
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

  function deleteGoal(id) {
    const all = Store.getGoals().filter(g => g.id !== id);
    Store.saveGoals(all);
    return true;
  }

  function addToGoal(id, amount) {
    const all = Store.getGoals();
    const goal = all.find(g => g.id === id);
    if (!goal) return { success: false, errors: ['Goal not found.'] };

    goal.savedAmount = Math.max(0, goal.savedAmount + parseFloat(amount));
    goal.updatedAt = new Date().toISOString();
    Store.saveGoals(all);
    return { success: true, goal };
  }

  function getGoalById(id) {
    return Store.getGoals().find(g => g.id === id) || null;
  }

  function getAllGoals() {
    return Store.getGoals().slice().sort((a, b) => {
      const aPct = a.targetAmount ? a.savedAmount / a.targetAmount : 0;
      const bPct = b.targetAmount ? b.savedAmount / b.targetAmount : 0;
      if (aPct >= 1 && bPct < 1) return 1;
      if (bPct >= 1 && aPct < 1) return -1;
      return a.name.localeCompare(b.name);
    });
  }

  /* ── Validation ── */
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
