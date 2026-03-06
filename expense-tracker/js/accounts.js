/* ===================================================
   JENTRAK — ACCOUNTS

   Manages multiple financial accounts and net worth tracking.
   Supports various account types: checking, savings, credit, cash, investment, other.

   Net worth calculation:
   - Assets: all accounts except credit
   - Liabilities: credit account balances
   - Net worth = assets - liabilities

   Supports transfers between accounts.

   Dependencies: Utils, Store
   =================================================== */

'use strict';

const Accounts = (() => {

  /**
   * Valid account types
   * Credit accounts are treated as liabilities for net worth calculations
   */
  const ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'cash', 'investment', 'other'];

  /**
   * Adds a new financial account
   * @param {object} fields - Account data
   * @param {string} fields.name - Account name (required, e.g., "Checking", "Credit Card")
   * @param {string} fields.accountType - Type of account from ACCOUNT_TYPES (required)
   * @param {number} [fields.balance=0] - Starting balance
   * @param {string} [fields.color='#6C63FF'] - Color for UI display
   * @returns {object} {success: boolean, account: object, errors: string[]}
   */
  function addAccount(fields) {
    const errors = [];
    if (!fields.name || !fields.name.trim()) errors.push('Account name is required.');
    if (!ACCOUNT_TYPES.includes(fields.accountType)) errors.push('Invalid account type.');
    if (errors.length) return { success: false, errors };

    const now = new Date().toISOString();
    const account = {
      id: Utils.generateId('acct'),
      name: fields.name.trim(),
      accountType: fields.accountType,
      balance: parseFloat(fields.balance) || 0,
      color: fields.color || '#6C63FF',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    const all = Store.getAccounts();
    all.push(account);
    Store.saveAccounts(all);
    return { success: true, account };
  }

  /**
   * Updates an account
   * @param {string} id - Account ID
   * @param {object} fields - Fields to update (same as addAccount)
   * @returns {object} {success: boolean, account: object, errors: string[]}
   */
  function updateAccount(id, fields) {
    const all = Store.getAccounts();
    const idx = all.findIndex(a => a.id === id);
    if (idx === -1) return { success: false, errors: ['Account not found.'] };

    all[idx] = {
      ...all[idx],
      name: (fields.name || all[idx].name).trim(),
      accountType: fields.accountType || all[idx].accountType,
      balance: fields.balance !== undefined ? parseFloat(fields.balance) || 0 : all[idx].balance,
      color: fields.color || all[idx].color,
      updatedAt: new Date().toISOString(),
    };

    Store.saveAccounts(all);
    return { success: true, account: all[idx] };
  }

  /**
   * Deletes an account
   * @param {string} id - Account ID to delete
   * @returns {boolean} Always true on success
   */
  function deleteAccount(id) {
    Store.saveAccounts(Store.getAccounts().filter(a => a.id !== id));
    return true;
  }

  /**
   * Retrieves a single account by ID
   * @param {string} id - Account ID
   * @returns {object|null} Account object or null if not found
   */
  function getAccountById(id) {
    return Store.getAccounts().find(a => a.id === id) || null;
  }

  /**
   * Retrieves all accounts, sorted alphabetically by name
   * @returns {object[]} Sorted array of account objects
   */
  function getAllAccounts() {
    return Store.getAccounts().slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Calculates net worth across all accounts
   * Credit accounts are treated as liabilities (negative impact on net worth)
   * @returns {object} {assets: number, liabilities: number, netWorth: number}
   * Assets include: checking, savings, cash, investment, other
   * Liabilities are credit account balances
   */
  function getNetWorth() {
    const accounts = Store.getAccounts();
    let assets = 0, liabilities = 0;
    for (const a of accounts) {
      // Credit accounts are liabilities
      if (a.accountType === 'credit') {
        liabilities += Math.abs(a.balance);
      } else {
        // All other account types are assets
        assets += a.balance;
      }
    }
    return { assets, liabilities, netWorth: assets - liabilities };
  }

  /**
   * Adjusts the balance of an account (for deposits/withdrawals)
   * Used internally by transfer() and manually for direct adjustments
   * @param {string} id - Account ID
   * @param {number} amount - Amount to add/subtract (positive or negative)
   * @returns {boolean} True if successful, false if account not found
   * @private
   */
  function adjustBalance(id, amount) {
    const all = Store.getAccounts();
    const acct = all.find(a => a.id === id);
    if (!acct) return false;
    acct.balance += parseFloat(amount);
    acct.updatedAt = new Date().toISOString();
    Store.saveAccounts(all);
    return true;
  }

  /**
   * Transfers money between two accounts
   * Debits from source account and credits to destination account
   * @param {string} fromId - Source account ID
   * @param {string} toId - Destination account ID
   * @param {number} amount - Amount to transfer (must be positive)
   * @returns {object} {success: boolean, errors: string[]}
   * @example Accounts.transfer('acct_123', 'acct_456', 100)
   */
  function transfer(fromId, toId, amount) {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return { success: false, errors: ['Invalid amount.'] };
    adjustBalance(fromId, -amt);
    adjustBalance(toId, amt);
    return { success: true };
  }

  return {
    ACCOUNT_TYPES,
    addAccount,
    updateAccount,
    deleteAccount,
    getAccountById,
    getAllAccounts,
    getNetWorth,
    adjustBalance,
    transfer,
  };
})();
