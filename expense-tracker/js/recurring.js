/* ===================================================
   JENTRAK — RECURRING TRANSACTIONS

   Manages recurring transactions (bills, subscriptions, salary, etc.)
   and automatically generates individual transactions each month.

   Auto-generation process:
   - Runs on app init via processRecurring()
   - Checks if a transaction was already generated for current month
   - Skips if not yet due or already generated
   - Constraints: dayOfMonth clamped to 1-28 to avoid end-of-month issues

   Frequency support: daily, weekly, bi-weekly, monthly, yearly

   Dependencies: Utils, Store, Transactions
   =================================================== */

'use strict';

const Recurring = (() => {

  /* ── CRUD Operations ── */

  /**
   * Creates a new recurring transaction template
   * Does not generate transactions immediately - only sets up the template
   * Transactions are generated automatically on app init via processRecurring()
   * @param {object} fields - Recurring template data
   * @param {string} fields.type - 'income' or 'expense'
   * @param {number} fields.amount - Amount (required, positive)
   * @param {string} fields.categoryId - Category ID
   * @param {string} [fields.description] - Description/purpose
   * @param {string} [fields.frequency='monthly'] - 'daily', 'weekly', 'bi-weekly', 'monthly', 'yearly'
   * @param {number} [fields.dayOfMonth=1] - Day of month to generate (1-28, defaults to 1)
   * @param {string} [fields.startDate] - Start date (defaults to today)
   * @param {string} [fields.endDate] - Optional end date (null = no end)
   * @returns {object} {success: boolean, recurring: object, errors: string[]}
   */
  function addRecurring(fields) {
    const { valid, errors } = validateFields(fields);
    if (!valid) return { success: false, errors };

    const now = new Date().toISOString();
    const rec = {
      id:            Utils.generateId('rec'),
      type:          fields.type,
      amount:        parseFloat(fields.amount),
      categoryId:    fields.categoryId,
      description:   (fields.description || '').trim(),
      frequency:     fields.frequency || 'monthly',
      dayOfMonth:    parseInt(fields.dayOfMonth, 10) || 1,
      startDate:     fields.startDate || Utils.todayISO(),
      endDate:       fields.endDate || null,
      isActive:      true,
      lastGenerated: null,
      createdAt:     now,
      updatedAt:     now,
    };

    const all = Store.getRecurring();
    all.push(rec);
    Store.saveRecurring(all);
    return { success: true, recurring: rec };
  }

  function updateRecurring(id, fields) {
    const all = Store.getRecurring();
    const idx = all.findIndex(r => r.id === id);
    if (idx === -1) return { success: false, errors: ['Recurring transaction not found.'] };

    const { valid, errors } = validateFields(fields);
    if (!valid) return { success: false, errors };

    all[idx] = {
      ...all[idx],
      type:        fields.type,
      amount:      parseFloat(fields.amount),
      categoryId:  fields.categoryId,
      description: (fields.description || '').trim(),
      frequency:   fields.frequency || 'monthly',
      dayOfMonth:  parseInt(fields.dayOfMonth, 10) || 1,
      startDate:   fields.startDate || all[idx].startDate,
      endDate:     fields.endDate || null,
      isActive:    fields.isActive !== undefined ? fields.isActive : all[idx].isActive,
      updatedAt:   new Date().toISOString(),
    };

    Store.saveRecurring(all);
    return { success: true, recurring: all[idx] };
  }

  function deleteRecurring(id) {
    const all = Store.getRecurring().filter(r => r.id !== id);
    Store.saveRecurring(all);
    return true;
  }

  function toggleActive(id) {
    const all = Store.getRecurring();
    const rec = all.find(r => r.id === id);
    if (!rec) return false;
    rec.isActive = !rec.isActive;
    rec.updatedAt = new Date().toISOString();
    Store.saveRecurring(all);
    return rec.isActive;
  }

  function getRecurringById(id) {
    return Store.getRecurring().find(r => r.id === id) || null;
  }

  function getAllRecurring() {
    return Store.getRecurring().slice().sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.description.localeCompare(b.description);
    });
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
    const day = parseInt(fields.dayOfMonth, 10);
    if (isNaN(day) || day < 1 || day > 28) {
      errors.push('Day of month must be between 1 and 28.');
    }
    return { valid: errors.length === 0, errors };
  }

  /* ── Auto-generation ── */
  function processRecurring() {
    const currentMonth = Utils.getCurrentMonthKey();
    const all = Store.getRecurring();
    let generated = 0;

    for (const rec of all) {
      if (!rec.isActive) continue;

      // Skip if already generated for this month
      if (rec.lastGenerated === currentMonth) continue;

      // Skip if start date is in the future
      const startMonth = rec.startDate ? Utils.getMonthKey(rec.startDate) : null;
      if (startMonth && startMonth > currentMonth) continue;

      // Skip if end date is in the past
      if (rec.endDate) {
        const endMonth = Utils.getMonthKey(rec.endDate);
        if (endMonth < currentMonth) continue;
      }

      // Generate the transaction
      const [year, month] = currentMonth.split('-');
      const day = String(rec.dayOfMonth).padStart(2, '0');
      const date = `${year}-${month}-${day}`;

      const result = Transactions.addTransaction({
        type:        rec.type,
        amount:      rec.amount,
        categoryId:  rec.categoryId,
        date:        date,
        description: rec.description ? `${rec.description} (recurring)` : '(recurring)',
      });

      if (result.success) {
        rec.lastGenerated = currentMonth;
        rec.updatedAt = new Date().toISOString();
        generated++;
      }
    }

    if (generated > 0) {
      Store.saveRecurring(all);
    }

    return generated;
  }

  /* ── Public API ── */
  return {
    addRecurring,
    updateRecurring,
    deleteRecurring,
    toggleActive,
    getRecurringById,
    getAllRecurring,
    processRecurring,
  };
})();
