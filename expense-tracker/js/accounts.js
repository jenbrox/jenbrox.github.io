/* ===================================================
   JENTRAX — ACCOUNTS
   Multi-account support: checking, savings, credit, cash.
   Depends on: Utils, Store
   =================================================== */

'use strict';

const Accounts = (() => {

  const ACCOUNT_TYPES = ['checking', 'savings', 'credit', 'cash', 'investment', 'other'];

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

  function deleteAccount(id) {
    Store.saveAccounts(Store.getAccounts().filter(a => a.id !== id));
    return true;
  }

  function getAccountById(id) {
    return Store.getAccounts().find(a => a.id === id) || null;
  }

  function getAllAccounts() {
    return Store.getAccounts().slice().sort((a, b) => a.name.localeCompare(b.name));
  }

  function getNetWorth() {
    const accounts = Store.getAccounts();
    let assets = 0, liabilities = 0;
    for (const a of accounts) {
      if (a.accountType === 'credit') {
        liabilities += Math.abs(a.balance);
      } else {
        assets += a.balance;
      }
    }
    return { assets, liabilities, netWorth: assets - liabilities };
  }

  function adjustBalance(id, amount) {
    const all = Store.getAccounts();
    const acct = all.find(a => a.id === id);
    if (!acct) return false;
    acct.balance += parseFloat(amount);
    acct.updatedAt = new Date().toISOString();
    Store.saveAccounts(all);
    return true;
  }

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
