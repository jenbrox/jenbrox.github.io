/* ===================================================
   JENTRAX — DEBTS
   Track who owes you and who you owe.
   Depends on: Utils, Store
   =================================================== */

'use strict';

const Debts = (() => {

  function addDebt(fields) {
    const errors = [];
    if (!fields.personName || !fields.personName.trim()) errors.push('Person name is required.');
    if (!Utils.isPositiveNumber(fields.amount)) errors.push('Amount must be positive.');
    if (!fields.direction || !['owed_to_me', 'i_owe'].includes(fields.direction)) errors.push('Direction is required.');
    if (errors.length) return { success: false, errors };

    const now = new Date().toISOString();
    const debt = {
      id: Utils.generateId('debt'),
      personName: fields.personName.trim(),
      amount: parseFloat(fields.amount),
      direction: fields.direction,
      description: (fields.description || '').trim(),
      dueDate: fields.dueDate || null,
      settled: false,
      settledAmount: 0,
      createdAt: now,
      updatedAt: now,
    };

    const all = Store.getDebts();
    all.push(debt);
    Store.saveDebts(all);
    return { success: true, debt };
  }

  function updateDebt(id, fields) {
    const all = Store.getDebts();
    const idx = all.findIndex(d => d.id === id);
    if (idx === -1) return { success: false, errors: ['Debt not found.'] };

    const errors = [];
    if (!fields.personName || !fields.personName.trim()) errors.push('Person name is required.');
    if (!Utils.isPositiveNumber(fields.amount)) errors.push('Amount must be positive.');
    if (errors.length) return { success: false, errors };

    all[idx] = {
      ...all[idx],
      personName: fields.personName.trim(),
      amount: parseFloat(fields.amount),
      direction: fields.direction || all[idx].direction,
      description: (fields.description || '').trim(),
      dueDate: fields.dueDate || null,
      updatedAt: new Date().toISOString(),
    };

    Store.saveDebts(all);
    return { success: true, debt: all[idx] };
  }

  function deleteDebt(id) {
    const all = Store.getDebts().filter(d => d.id !== id);
    Store.saveDebts(all);
    return true;
  }

  function settleDebt(id, amount) {
    const all = Store.getDebts();
    const debt = all.find(d => d.id === id);
    if (!debt) return { success: false, errors: ['Debt not found.'] };

    debt.settledAmount = Math.min(debt.amount, (debt.settledAmount || 0) + parseFloat(amount));
    if (debt.settledAmount >= debt.amount) debt.settled = true;
    debt.updatedAt = new Date().toISOString();

    Store.saveDebts(all);
    return { success: true, debt };
  }

  function getDebtById(id) {
    return Store.getDebts().find(d => d.id === id) || null;
  }

  function getAllDebts() {
    return Store.getDebts().slice().sort((a, b) => {
      if (a.settled !== b.settled) return a.settled ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  function getSummary() {
    const debts = Store.getDebts().filter(d => !d.settled);
    let owedToMe = 0, iOwe = 0;
    for (const d of debts) {
      const remaining = d.amount - (d.settledAmount || 0);
      if (d.direction === 'owed_to_me') owedToMe += remaining;
      else iOwe += remaining;
    }
    return { owedToMe, iOwe, net: owedToMe - iOwe };
  }

  return {
    addDebt,
    updateDebt,
    deleteDebt,
    settleDebt,
    getDebtById,
    getAllDebts,
    getSummary,
  };
})();
