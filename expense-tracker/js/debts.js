/* ===================================================
   JENTRAK — DEBTS

   Tracks personal debts in both directions:
   - Money owed TO you (loans you've given)
   - Money you OWE (loans you've taken)

   Features partial settlements and auto-completion when fully paid.

   Dependencies: Utils, Store
   =================================================== */

'use strict';

const Debts = (() => {

  /**
   * Creates a new debt record
   * @param {object} fields - Debt data
   * @param {string} fields.personName - Name of person (lender or borrower, required)
   * @param {number} fields.amount - Principal amount (required, positive)
   * @param {string} fields.direction - Either 'owed_to_me' or 'i_owe' (required)
   * @param {string} [fields.description] - Optional description/purpose
   * @param {string} [fields.dueDate] - Optional due date (YYYY-MM-DD)
   * @returns {object} {success: boolean, debt: object, errors: string[]}
   */
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

  /**
   * Updates an existing debt
   * @param {string} id - Debt ID
   * @param {object} fields - Fields to update (same as addDebt)
   * @returns {object} {success: boolean, debt: object, errors: string[]}
   */
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

  /**
   * Deletes a debt
   * @param {string} id - Debt ID to delete
   * @returns {boolean} Always true on success
   */
  function deleteDebt(id) {
    const all = Store.getDebts().filter(d => d.id !== id);
    Store.saveDebts(all);
    return true;
  }

  /**
   * Records a payment against a debt (partial or full settlement)
   * Automatically marks debt as settled when settledAmount >= amount
   * @param {string} id - Debt ID
   * @param {number} amount - Payment amount
   * @returns {object} {success: boolean, debt: object, errors: string[]}
   */
  function settleDebt(id, amount) {
    const all = Store.getDebts();
    const debt = all.find(d => d.id === id);
    if (!debt) return { success: false, errors: ['Debt not found.'] };

    // Cap settled amount at total debt amount
    debt.settledAmount = Math.min(debt.amount, (debt.settledAmount || 0) + parseFloat(amount));
    if (debt.settledAmount >= debt.amount) debt.settled = true;
    debt.updatedAt = new Date().toISOString();

    Store.saveDebts(all);
    return { success: true, debt };
  }

  /**
   * Retrieves a single debt by ID
   * @param {string} id - Debt ID
   * @returns {object|null} Debt object or null if not found
   */
  function getDebtById(id) {
    return Store.getDebts().find(d => d.id === id) || null;
  }

  /**
   * Retrieves all debts, sorted by settlement status then creation date
   * Active debts appear first (newest first), settled debts last
   * @returns {object[]} Sorted array of debt objects
   */
  function getAllDebts() {
    return Store.getDebts().slice().sort((a, b) => {
      if (a.settled !== b.settled) return a.settled ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  /**
   * Calculates debt summary for the dashboard
   * Only includes unsettled debts
   * @returns {object} {owedToMe: number, iOwe: number, net: number}
   * net = owedToMe - iOwe (positive = net creditor, negative = net debtor)
   */
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

  function calculatePayoffPlan(monthlyPayment) {
    const debts = Store.getDebts().filter(d => !d.settled && d.direction === 'i_owe');
    if (debts.length === 0 || !monthlyPayment || monthlyPayment <= 0) return null;

    const snowball = simulatePayoff(debts.slice().sort((a, b) => {
      const remA = a.amount - (a.settledAmount || 0);
      const remB = b.amount - (b.settledAmount || 0);
      return remA - remB;
    }), monthlyPayment);

    const avalanche = simulatePayoff(debts.slice().sort((a, b) => {
      const remB = b.amount - (b.settledAmount || 0);
      const remA = a.amount - (a.settledAmount || 0);
      return remB - remA;
    }), monthlyPayment);

    return { snowball, avalanche, totalDebt: debts.reduce((sum, d) => sum + (d.amount - (d.settledAmount || 0)), 0) };
  }

  function simulatePayoff(sortedDebts, monthlyPayment) {
    const remaining = sortedDebts.map(d => d.amount - (d.settledAmount || 0));
    let months = 0;
    let totalPaid = 0;
    const maxMonths = 600;
    while (remaining.some(r => r > 0) && months < maxMonths) {
      months++;
      let budget = monthlyPayment;
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] <= 0) continue;
        const payment = Math.min(remaining[i], budget);
        remaining[i] -= payment;
        totalPaid += payment;
        budget -= payment;
        if (budget <= 0) break;
      }
    }
    return { months, totalPaid };
  }

  return {
    addDebt,
    updateDebt,
    deleteDebt,
    settleDebt,
    getDebtById,
    getAllDebts,
    getSummary,
    calculatePayoffPlan,
    simulatePayoff,
  };
})();
