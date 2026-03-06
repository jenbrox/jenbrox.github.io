/* ===================================================
   JENTRAX — APP
   Entry point: initializes and wires all modules.
   No business logic lives here.
   Depends on: Utils, Store, Transactions, Categories,
               UI, Dashboard, Charts, Debts, Wishlist, Accounts
   =================================================== */

'use strict';

/* ═══════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════ */

const AppState = {
  dashboardMonth:     Utils.getCurrentMonthKey(),
  transactionMonth:   Utils.getCurrentMonthKey(),
  typeFilter:         'all',
  categoryFilter:     'all',
  searchQuery:        '',
};

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => init());

async function init() {
  // 0. Initialize IndexedDB store (migrates from localStorage if needed)
  await Store.initStore();

  // 1. Seed default data (no-op if data already exists)
  Store.seedDefaultData();

  // 2. Initialize Chart.js instances (canvas must be in DOM)
  Charts.initCharts();

  // 2b. Process recurring transactions for current month
  const generated = Recurring.processRecurring();
  if (generated > 0) {
    setTimeout(() => UI.showToast(`${generated} recurring transaction${generated !== 1 ? 's' : ''} added for this month.`, 'success'), 500);
  }

  // 3. Wire all event handlers
  setupNavigation();
  setupModalCloseHandlers();
  setupTransactionHandlers();
  setupCategoryHandlers();
  setupRecurringHandlers();
  setupGoalHandlers();
  setupSettingsHandlers();
  setupDataHandlers();
  setupMonthNavHandlers();
  setupFilterHandlers();
  setupDebtHandlers();
  setupWishlistHandlers();
  setupAccountHandlers();
  setupKeyboardShortcuts();
  UI.setupTypeToggleListener();
  UI.setupRecTypeToggleListener();

  // 4. Initialize dark mode
  setupDarkMode();

  // 4b. Print report button
  setupPrintHandler();

  // 4c. Logo click navigates to dashboard
  document.querySelector('.app-logo')?.addEventListener('click', () => navigateTo('dashboard'));
  document.querySelector('.app-logo').style.cursor = 'pointer';

  // 5. Read initial section from URL hash
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);

  // 6. Register PWA service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

/* ═══════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════ */

function navigateTo(sectionId) {
  const valid = ['dashboard', 'transactions', 'categories', 'recurring', 'goals', 'debts', 'wishlist', 'accounts', 'settings'];
  const target = valid.includes(sectionId) ? sectionId : 'dashboard';

  UI.showSection(target);
  window.location.hash = target;

  if (target === 'dashboard') {
    renderDashboardView();
  } else if (target === 'transactions') {
    renderTransactionsView();
  } else if (target === 'categories') {
    renderCategoriesView();
  } else if (target === 'recurring') {
    renderRecurringView();
  } else if (target === 'goals') {
    renderGoalsView();
  } else if (target === 'debts') {
    renderDebtsView();
  } else if (target === 'wishlist') {
    renderWishlistView();
  } else if (target === 'accounts') {
    renderAccountsView();
  } else if (target === 'settings') {
    UI.loadSettingsForm();
  }
}

function setupNavigation() {
  // Tab nav clicks
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigateTo(link.dataset.nav);
    });
  });

  // Browser back/forward
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    navigateTo(hash);
  });
}

/* ═══════════════════════════════════════════════
   DASHBOARD VIEW
═══════════════════════════════════════════════ */

function renderDashboardView() {
  updateMonthLabel('dash-month-label', AppState.dashboardMonth);
  Dashboard.renderDashboard(AppState.dashboardMonth);
}


/* ═══════════════════════════════════════════════
   TRANSACTIONS VIEW
═══════════════════════════════════════════════ */

function renderTransactionsView() {
  updateMonthLabel('txn-month-label', AppState.transactionMonth);
  UI.populateFilterCategoryDropdown(AppState.transactionMonth);
  renderFilteredTransactions();
}

function renderFilteredTransactions() {
  let txns = Transactions.getFilteredTransactions(
    AppState.transactionMonth,
    AppState.typeFilter,
    AppState.categoryFilter
  );

  // Apply search filter
  if (AppState.searchQuery) {
    const q = AppState.searchQuery.toLowerCase();
    const categories = Store.getCategories();
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c.name.toLowerCase(); });

    txns = txns.filter(t => {
      const desc = (t.description || '').toLowerCase();
      const catName = catMap[t.categoryId] || '';
      const amount = String(t.amount);
      const tags = (t.tags || []).join(' ').toLowerCase();
      return desc.includes(q) || catName.includes(q) || amount.includes(q) || tags.includes(q);
    });
  }

  UI.renderTransactionList(txns);
}

function setupMonthNavHandlers() {
  document.getElementById('dash-prev-month')?.addEventListener('click', () => {
    AppState.dashboardMonth = Utils.offsetMonth(AppState.dashboardMonth, -1);
    renderDashboardView();
  });
  document.getElementById('dash-next-month')?.addEventListener('click', () => {
    AppState.dashboardMonth = Utils.offsetMonth(AppState.dashboardMonth, 1);
    renderDashboardView();
  });
  document.getElementById('txn-prev-month')?.addEventListener('click', () => {
    AppState.transactionMonth = Utils.offsetMonth(AppState.transactionMonth, -1);
    AppState.categoryFilter = 'all';
    renderTransactionsView();
  });
  document.getElementById('txn-next-month')?.addEventListener('click', () => {
    AppState.transactionMonth = Utils.offsetMonth(AppState.transactionMonth, 1);
    AppState.categoryFilter = 'all';
    renderTransactionsView();
  });
}

function setupFilterHandlers() {
  document.querySelectorAll('[data-type-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-type-filter]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.typeFilter = btn.dataset.typeFilter;
      renderFilteredTransactions();
    });
  });
  document.getElementById('filter-category')?.addEventListener('change', e => {
    AppState.categoryFilter = e.target.value;
    renderFilteredTransactions();
  });

  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', Utils.debounce(e => {
      AppState.searchQuery = e.target.value.trim();
      renderFilteredTransactions();
    }, 250));
  }
}

/* ═══════════════════════════════════════════════
   CATEGORIES VIEW
═══════════════════════════════════════════════ */

function renderCategoriesView() {
  UI.renderCategoryList(AppState.dashboardMonth);
}

/* ═══════════════════════════════════════════════
   MODAL CLOSE HANDLERS
═══════════════════════════════════════════════ */

function setupModalCloseHandlers() {
  // [data-close-modal] buttons
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => {
      UI.closeModal(btn.dataset.closeModal);
    });
  });

  // Escape key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeTransactionPanel();
      UI.closeAllModals();
    }
  });

  // Click outside the dialog (on backdrop)
  document.querySelectorAll('dialog.modal').forEach(dialog => {
    dialog.addEventListener('click', e => {
      const rect = dialog.getBoundingClientRect();
      const outside = (
        e.clientX < rect.left || e.clientX > rect.right ||
        e.clientY < rect.top  || e.clientY > rect.bottom
      );
      if (outside) dialog.close();
    });
  });
}

/* ═══════════════════════════════════════════════
   TRANSACTION HANDLERS
═══════════════════════════════════════════════ */

function setupTransactionHandlers() {
  // "+ Add Transaction" button (header)
  document.getElementById('btn-add-transaction')?.addEventListener('click', () => {
    UI.populateTransactionForm(null);
    openTransactionPanel();
  });

  // Close panel buttons
  document.getElementById('btn-close-panel')?.addEventListener('click', closeTransactionPanel);
  document.getElementById('btn-cancel-panel')?.addEventListener('click', closeTransactionPanel);

  // Transaction form submit
  document.getElementById('transaction-form')?.addEventListener('submit', e => {
    e.preventDefault();
    handleTransactionSubmit();
  });

  // Edit / delete via event delegation on tbody
  document.getElementById('transaction-tbody')?.addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit-txn]');
    const deleteBtn = e.target.closest('[data-delete-txn]');

    if (editBtn) {
      const txn = Transactions.getTransactionById(editBtn.dataset.editTxn);
      if (txn) {
        UI.populateTransactionForm(txn);
        openTransactionPanel();
      }
    }

    if (deleteBtn) {
      handleDeleteTransaction(deleteBtn.dataset.deleteTxn);
    }
  });
}

function openTransactionPanel() {
  document.getElementById('app-layout')?.classList.add('panel-open');
  document.getElementById('transaction-panel')?.classList.add('open');
  // Resize charts after the transition
  setTimeout(() => {
    if (typeof Charts !== 'undefined' && Charts.updateAllCharts) {
      Charts.updateAllCharts(AppState.dashboardMonth);
    }
  }, 350);
}

function closeTransactionPanel() {
  document.getElementById('app-layout')?.classList.remove('panel-open');
  document.getElementById('transaction-panel')?.classList.remove('open');
  setTimeout(() => {
    if (typeof Charts !== 'undefined' && Charts.updateAllCharts) {
      Charts.updateAllCharts(AppState.dashboardMonth);
    }
  }, 350);
}

async function handleTransactionSubmit() {
  const { valid, data } = UI.getTransactionFormValues();
  if (!valid) return;

  // Duplicate detection for new transactions
  const dupeWarning = document.getElementById('duplicate-warning');
  if (dupeWarning) dupeWarning.hidden = true;
  if (!data.id && typeof Transactions.findDuplicates === 'function') {
    const dupes = Transactions.findDuplicates(data);
    if (dupes && dupes.length > 0) {
      if (dupeWarning) dupeWarning.hidden = false;
    }
  }

  let result;
  if (data.id) {
    result = Transactions.updateTransaction(data.id, data);
  } else {
    result = Transactions.addTransaction(data);
  }

  if (!result.success) {
    UI.showToast(result.errors.join(' '), 'error');
    return;
  }

  closeTransactionPanel();
  UI.showToast(data.id ? 'Transaction updated.' : 'Transaction added.', 'success');

  // Refresh views
  renderTransactionsView();
  Dashboard.updateDashboard(AppState.dashboardMonth);

  // Sync dashboard month to transaction month if on the transactions tab
  if (UI.currentSection() === 'transactions') {
    AppState.dashboardMonth = AppState.transactionMonth;
  }
}

async function handleDeleteTransaction(id) {
  const confirmed = await UI.showConfirm('Delete this transaction? This cannot be undone.', 'Delete', 'btn-danger');
  if (!confirmed) return;

  const deletedTxn = Transactions.getTransactionById(id);
  Transactions.deleteTransaction(id);
  renderTransactionsView();
  Dashboard.updateDashboard(AppState.dashboardMonth);

  // Undo support: show undo toast if available, otherwise fall back to simple toast
  if (deletedTxn && typeof UI.showUndoToast === 'function') {
    UI.showUndoToast('Transaction deleted.', () => {
      Transactions.addTransaction(deletedTxn);
      renderTransactionsView();
      Dashboard.updateDashboard(AppState.dashboardMonth);
    });
  } else {
    UI.showToast('Transaction deleted.', 'success');
  }
}

/* ═══════════════════════════════════════════════
   CATEGORY HANDLERS
═══════════════════════════════════════════════ */

function setupCategoryHandlers() {
  // "+ Add Category" button
  document.getElementById('btn-add-category')?.addEventListener('click', () => {
    UI.populateCategoryForm(null);
    UI.openModal('category-modal');
  });

  // Category form submit
  document.getElementById('category-form')?.addEventListener('submit', e => {
    e.preventDefault();
    handleCategorySubmit();
  });

  // Edit / delete via delegation on categories grid
  document.getElementById('categories-grid')?.addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit-cat]');
    const deleteBtn = e.target.closest('[data-delete-cat]');

    if (editBtn) {
      const cat = Categories.getCategoryById(editBtn.dataset.editCat);
      if (cat) {
        UI.populateCategoryForm(cat);
        UI.openModal('category-modal');
      }
    }

    if (deleteBtn) {
      handleDeleteCategory(deleteBtn.dataset.deleteCat);
    }
  });
}

async function handleCategorySubmit() {
  const { valid, data } = UI.getCategoryFormValues();
  if (!valid) return;

  let result;
  if (data.id) {
    result = Categories.updateCategory(data.id, data);
  } else {
    result = Categories.addCategory(data);
  }

  if (!result.success) {
    UI.showToast(result.errors.join(' '), 'error');
    return;
  }

  UI.closeModal('category-modal');
  UI.showToast(data.id ? 'Category updated.' : 'Category added.', 'success');
  renderCategoriesView();
  Dashboard.updateDashboard(AppState.dashboardMonth);
}

async function handleDeleteCategory(id) {
  const cat = Categories.getCategoryById(id);
  if (!cat) return;

  const txnCount = Store.getTransactions().filter(t => t.categoryId === id).length;
  const message = txnCount > 0
    ? `Delete "${cat.name}"? Its ${txnCount} transaction${txnCount !== 1 ? 's' : ''} will be marked as Uncategorized.`
    : `Delete category "${cat.name}"? This cannot be undone.`;

  const confirmed = await UI.showConfirm(message, 'Delete', 'btn-danger');
  if (!confirmed) return;

  Categories.deleteCategory(id);
  UI.showToast('Category deleted.', 'success');
  renderCategoriesView();
  renderFilteredTransactions();
  Dashboard.updateDashboard(AppState.dashboardMonth);
}

/* ═══════════════════════════════════════════════
   RECURRING VIEW & HANDLERS
═══════════════════════════════════════════════ */

function renderRecurringView() {
  UI.renderRecurringList();
}

function setupRecurringHandlers() {
  // "+ Add Recurring" button
  document.getElementById('btn-add-recurring')?.addEventListener('click', () => {
    UI.populateRecurringForm(null);
    UI.openModal('recurring-modal');
  });

  // Recurring form submit
  document.getElementById('recurring-form')?.addEventListener('submit', e => {
    e.preventDefault();
    handleRecurringSubmit();
  });

  // Edit / delete / toggle via delegation on recurring list
  document.getElementById('recurring-list')?.addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit-rec]');
    const deleteBtn = e.target.closest('[data-delete-rec]');
    const toggleBtn = e.target.closest('[data-toggle-rec]');

    if (editBtn) {
      const rec = Recurring.getRecurringById(editBtn.dataset.editRec);
      if (rec) {
        UI.populateRecurringForm(rec);
        UI.openModal('recurring-modal');
      }
    }

    if (deleteBtn) {
      handleDeleteRecurring(deleteBtn.dataset.deleteRec);
    }

    if (toggleBtn) {
      const newState = Recurring.toggleActive(toggleBtn.dataset.toggleRec);
      UI.showToast(newState ? 'Recurring transaction activated.' : 'Recurring transaction paused.', 'success');
      renderRecurringView();
    }
  });
}

async function handleRecurringSubmit() {
  const { valid, data } = UI.getRecurringFormValues();
  if (!valid) return;

  let result;
  if (data.id) {
    result = Recurring.updateRecurring(data.id, data);
  } else {
    result = Recurring.addRecurring(data);
  }

  if (!result.success) {
    UI.showToast(result.errors.join(' '), 'error');
    return;
  }

  UI.closeModal('recurring-modal');
  UI.showToast(data.id ? 'Recurring transaction updated.' : 'Recurring transaction added.', 'success');
  renderRecurringView();
}

async function handleDeleteRecurring(id) {
  const confirmed = await UI.showConfirm('Delete this recurring transaction? This will not remove already-generated transactions.', 'Delete', 'btn-danger');
  if (!confirmed) return;

  Recurring.deleteRecurring(id);
  UI.showToast('Recurring transaction deleted.', 'success');
  renderRecurringView();
}

/* ═══════════════════════════════════════════════
   GOALS VIEW & HANDLERS
═══════════════════════════════════════════════ */

function renderGoalsView() {
  UI.renderGoalsList();
}

function setupGoalHandlers() {
  document.getElementById('btn-add-goal')?.addEventListener('click', () => {
    UI.populateGoalForm(null);
    UI.openModal('goal-modal');
  });

  document.getElementById('goal-form')?.addEventListener('submit', e => {
    e.preventDefault();
    handleGoalSubmit();
  });

  document.getElementById('goal-add-form')?.addEventListener('submit', e => {
    e.preventDefault();
    handleGoalAddFunds();
  });

  document.getElementById('goals-grid')?.addEventListener('click', e => {
    const editBtn = e.target.closest('[data-edit-goal]');
    const deleteBtn = e.target.closest('[data-delete-goal]');
    const fundBtn = e.target.closest('[data-fund-goal]');

    if (editBtn) {
      const goal = Goals.getGoalById(editBtn.dataset.editGoal);
      if (goal) {
        UI.populateGoalForm(goal);
        UI.openModal('goal-modal');
      }
    }

    if (deleteBtn) {
      handleDeleteGoal(deleteBtn.dataset.deleteGoal);
    }

    if (fundBtn) {
      document.getElementById('goal-add-id').value = fundBtn.dataset.fundGoal;
      document.getElementById('goal-add-amount').value = '';
      UI.openModal('goal-add-modal');
    }
  });
}

async function handleGoalSubmit() {
  const { valid, data } = UI.getGoalFormValues();
  if (!valid) return;

  let result;
  if (data.id) {
    result = Goals.updateGoal(data.id, data);
  } else {
    result = Goals.addGoal(data);
  }

  if (!result.success) {
    UI.showToast(result.errors.join(' '), 'error');
    return;
  }

  UI.closeModal('goal-modal');
  UI.showToast(data.id ? 'Goal updated.' : 'Goal added.', 'success');
  renderGoalsView();
}

function handleGoalAddFunds() {
  const id = document.getElementById('goal-add-id').value;
  const amount = document.getElementById('goal-add-amount').value;

  if (!Utils.isPositiveNumber(amount)) {
    UI.showToast('Enter a valid positive amount.', 'error');
    return;
  }

  const result = Goals.addToGoal(id, parseFloat(amount));
  if (!result.success) {
    UI.showToast(result.errors.join(' '), 'error');
    return;
  }

  UI.closeModal('goal-add-modal');
  const goal = result.goal;
  const pct = goal.targetAmount > 0 ? Math.round((goal.savedAmount / goal.targetAmount) * 100) : 0;
  UI.showToast(pct >= 100 ? `Goal reached! Congratulations!` : `Added funds. ${pct}% of goal reached.`, 'success');
  renderGoalsView();
}

async function handleDeleteGoal(id) {
  const confirmed = await UI.showConfirm('Delete this savings goal? This cannot be undone.', 'Delete', 'btn-danger');
  if (!confirmed) return;

  Goals.deleteGoal(id);
  UI.showToast('Goal deleted.', 'success');
  renderGoalsView();
}

/* ═══════════════════════════════════════════════
   DEBTS VIEW & HANDLERS
═══════════════════════════════════════════════ */

function renderDebtsView() {
  UI.renderDebtsList();
  UI.renderDebtsSummary();
}

function setupDebtHandlers() {
  // "+ Add Debt" button
  document.getElementById('btn-add-debt')?.addEventListener('click', () => {
    UI.populateDebtForm(null);
    UI.openModal('debt-modal');
  });

  // Debt form submit
  document.getElementById('debt-form')?.addEventListener('submit', e => {
    e.preventDefault();
    handleDebtSubmit();
  });

  // Edit / delete / settle via delegation on debts list
  document.getElementById('debts-list')?.addEventListener('click', e => {
    const editBtn   = e.target.closest('[data-edit-debt]');
    const deleteBtn = e.target.closest('[data-delete-debt]');
    const settleBtn = e.target.closest('[data-settle-debt]');

    if (editBtn) {
      const debt = Debts.getDebtById(editBtn.dataset.editDebt);
      if (debt) {
        UI.populateDebtForm(debt);
        UI.openModal('debt-modal');
      }
    }

    if (deleteBtn) {
      handleDeleteDebt(deleteBtn.dataset.deleteDebt);
    }

    if (settleBtn) {
      handleSettleDebt(settleBtn.dataset.settleDebt);
    }
  });

  // Settle form submit
  document.getElementById('debt-settle-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const id     = document.getElementById('debt-settle-id').value;
    const amount = parseFloat(document.getElementById('debt-settle-amount')?.value);

    if (!Utils.isPositiveNumber(amount)) {
      UI.showToast('Enter a valid positive amount.', 'error');
      return;
    }

    const result = Debts.settleDebt(id, amount);
    if (!result.success) {
      UI.showToast(result.errors.join(' '), 'error');
      return;
    }

    UI.closeModal('debt-settle-modal');
    UI.showToast('Payment recorded.', 'success');
    renderDebtsView();
  });
}

async function handleDebtSubmit() {
  const { valid, data } = UI.getDebtFormValues();
  if (!valid) return;

  let result;
  if (data.id) {
    result = Debts.updateDebt(data.id, data);
  } else {
    result = Debts.addDebt(data);
  }

  if (!result.success) {
    UI.showToast(result.errors.join(' '), 'error');
    return;
  }

  UI.closeModal('debt-modal');
  UI.showToast(data.id ? 'Debt updated.' : 'Debt added.', 'success');
  renderDebtsView();
}

async function handleDeleteDebt(id) {
  const confirmed = await UI.showConfirm('Delete this debt? This cannot be undone.', 'Delete', 'btn-danger');
  if (!confirmed) return;

  Debts.deleteDebt(id);
  UI.showToast('Debt deleted.', 'success');
  renderDebtsView();
}

function handleSettleDebt(id) {
  document.getElementById('debt-settle-id').value = id;
  if (document.getElementById('debt-settle-amount')) {
    document.getElementById('debt-settle-amount').value = '';
  }
  UI.openModal('debt-settle-modal');
}

/* ═══════════════════════════════════════════════
   WISHLIST VIEW & HANDLERS
═══════════════════════════════════════════════ */

function renderWishlistView() {
  UI.renderWishlistGrid();
  UI.renderWishlistTotal();
}

function setupWishlistHandlers() {
  // "+ Add Wish" button
  document.getElementById('btn-add-wish')?.addEventListener('click', () => {
    UI.populateWishForm(null);
    UI.openModal('wish-modal');
  });

  // Wish form submit
  document.getElementById('wish-form')?.addEventListener('submit', e => {
    e.preventDefault();
    handleWishSubmit();
  });

  // Edit / delete / toggle via delegation on wishlist grid
  document.getElementById('wishlist-grid')?.addEventListener('click', e => {
    const editBtn   = e.target.closest('[data-edit-wish]');
    const deleteBtn = e.target.closest('[data-delete-wish]');
    const toggleBtn = e.target.closest('[data-toggle-wish]');

    if (editBtn) {
      const item = Wishlist.getItemById(editBtn.dataset.editWish);
      if (item) {
        UI.populateWishForm(item);
        UI.openModal('wish-modal');
      }
    }

    if (deleteBtn) {
      handleDeleteWish(deleteBtn.dataset.deleteWish);
    }

    if (toggleBtn) {
      Wishlist.togglePurchased(toggleBtn.dataset.toggleWish);
      renderWishlistView();
    }
  });
}

async function handleWishSubmit() {
  const { valid, data } = UI.getWishFormValues();
  if (!valid) return;

  let result;
  if (data.id) {
    result = Wishlist.updateItem(data.id, data);
  } else {
    result = Wishlist.addItem(data);
  }

  if (!result.success) {
    UI.showToast(result.errors.join(' '), 'error');
    return;
  }

  UI.closeModal('wish-modal');
  UI.showToast(data.id ? 'Wish updated.' : 'Wish added.', 'success');
  renderWishlistView();
}

async function handleDeleteWish(id) {
  const confirmed = await UI.showConfirm('Delete this wishlist item? This cannot be undone.', 'Delete', 'btn-danger');
  if (!confirmed) return;

  Wishlist.deleteItem(id);
  UI.showToast('Wishlist item deleted.', 'success');
  renderWishlistView();
}

/* ═══════════════════════════════════════════════
   ACCOUNTS VIEW & HANDLERS
═══════════════════════════════════════════════ */

function renderAccountsView() {
  UI.renderAccountsGrid();
  UI.renderAccountsSummary();
}

function setupAccountHandlers() {
  // "+ Add Account" button
  document.getElementById('btn-add-account')?.addEventListener('click', () => {
    UI.populateAccountForm(null);
    UI.openModal('account-modal');
  });

  // Account form submit
  document.getElementById('account-form')?.addEventListener('submit', e => {
    e.preventDefault();
    handleAccountSubmit();
  });

  // Edit / delete via delegation on accounts grid
  document.getElementById('accounts-grid')?.addEventListener('click', e => {
    const editBtn   = e.target.closest('[data-edit-acct]');
    const deleteBtn = e.target.closest('[data-delete-acct]');

    if (editBtn) {
      const acct = Accounts.getAccountById(editBtn.dataset.editAcct);
      if (acct) {
        UI.populateAccountForm(acct);
        UI.openModal('account-modal');
      }
    }

    if (deleteBtn) {
      handleDeleteAccount(deleteBtn.dataset.deleteAcct);
    }
  });

  // Transfer button
  document.getElementById('btn-transfer')?.addEventListener('click', () => {
    UI.populateTransferDropdowns();
    UI.openModal('transfer-modal');
  });

  // Transfer form submit
  document.getElementById('transfer-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const fromId = document.getElementById('transfer-from')?.value;
    const toId   = document.getElementById('transfer-to')?.value;
    const amount = parseFloat(document.getElementById('transfer-amount')?.value);

    if (!fromId || !toId || fromId === toId) {
      UI.showToast('Select two different accounts.', 'error');
      return;
    }
    if (!Utils.isPositiveNumber(amount)) {
      UI.showToast('Enter a valid positive amount.', 'error');
      return;
    }

    const result = Accounts.transfer(fromId, toId, amount);
    if (!result.success) {
      UI.showToast(result.errors.join(' '), 'error');
      return;
    }

    UI.closeModal('transfer-modal');
    UI.showToast('Transfer completed.', 'success');
    renderAccountsView();
  });
}

async function handleAccountSubmit() {
  const { valid, data } = UI.getAccountFormValues();
  if (!valid) return;

  let result;
  if (data.id) {
    result = Accounts.updateAccount(data.id, data);
  } else {
    result = Accounts.addAccount(data);
  }

  if (!result.success) {
    UI.showToast(result.errors.join(' '), 'error');
    return;
  }

  UI.closeModal('account-modal');
  UI.showToast(data.id ? 'Account updated.' : 'Account added.', 'success');
  renderAccountsView();
}

async function handleDeleteAccount(id) {
  const confirmed = await UI.showConfirm('Delete this account? This cannot be undone.', 'Delete', 'btn-danger');
  if (!confirmed) return;

  Accounts.deleteAccount(id);
  UI.showToast('Account deleted.', 'success');
  renderAccountsView();
}

/* ═══════════════════════════════════════════════
   KEYBOARD SHORTCUTS
═══════════════════════════════════════════════ */

function setupKeyboardShortcuts() {
  document.addEventListener('keydown', e => {
    // Skip if user is typing in a form element or a modal is open
    const tag = (e.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (document.querySelector('dialog[open]')) return;

    switch (e.key) {
      case 'n':
        openTransactionPanel();
        UI.populateTransactionForm(null);
        break;
      case 'd':
        navigateTo('dashboard');
        break;
      case 't':
        navigateTo('transactions');
        break;
      case 'c':
        navigateTo('categories');
        break;
      case 'r':
        navigateTo('recurring');
        break;
      case 'g':
        navigateTo('goals');
        break;
      case '/': {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
        break;
      }
    }
  });
}

/* ═══════════════════════════════════════════════
   SETTINGS HANDLERS
═══════════════════════════════════════════════ */

function setupSettingsHandlers() {
  document.getElementById('settings-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const values = UI.getSettingsFormValues();
    Store.saveSettings(values);
    UI.syncCurrencyPrefixes();
    UI.showToast('Settings saved.', 'success');
    Dashboard.updateDashboard(AppState.dashboardMonth);
    if (UI.currentSection() === 'transactions') renderFilteredTransactions();
  });
}

/* ═══════════════════════════════════════════════
   DATA MANAGEMENT HANDLERS
═══════════════════════════════════════════════ */

function setupDataHandlers() {
  // Export
  document.getElementById('btn-export')?.addEventListener('click', () => {
    const json = Store.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jentrak-export-${Utils.todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('Data exported.', 'success');
  });

  // Export CSV
  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const csv  = Store.exportCSV();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `jentrak-transactions-${Utils.todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('Transactions exported as CSV.', 'success');
  });

  // Export Excel
  document.getElementById('btn-export-excel')?.addEventListener('click', () => {
    const result = Store.exportExcel(`jentrak-export-${Utils.todayISO()}.xlsx`);
    if (result.success) {
      UI.showToast('Data exported as Excel.', 'success');
    } else {
      UI.showToast(`Export failed: ${result.error}`, 'error');
    }
  });

  // Import (JSON / CSV / Excel)
  document.getElementById('btn-import-file')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();

    if (ext === 'csv') {
      const reader = new FileReader();
      reader.onload = ev => {
        const result = Store.importCSV(ev.target.result);
        if (result.success) {
          const warn = result.errors && result.errors.length
            ? ` (${result.errors.length} row(s) skipped)` : '';
          UI.showToast(`Imported ${result.imported} transaction(s).${warn}`, 'success');
          refreshAllViews();
        } else {
          UI.showToast(`Import failed: ${result.error}`, 'error');
        }
        e.target.value = '';
      };
      reader.readAsText(file);

    } else if (ext === 'xlsx') {
      const reader = new FileReader();
      reader.onload = ev => {
        const result = Store.importExcel(ev.target.result);
        if (result.success) {
          UI.showToast('Excel data imported successfully.', 'success');
          refreshAllViews();
        } else {
          UI.showToast(`Import failed: ${result.error}`, 'error');
        }
        e.target.value = '';
      };
      reader.readAsArrayBuffer(file);

    } else {
      // Default: JSON
      const reader = new FileReader();
      reader.onload = ev => {
        const result = Store.importData(ev.target.result);
        if (result.success) {
          UI.showToast('Data imported successfully.', 'success');
          refreshAllViews();
        } else {
          UI.showToast(`Import failed: ${result.error}`, 'error');
        }
        e.target.value = '';
      };
      reader.readAsText(file);
    }
  });

  // Clear Transactions
  document.getElementById('btn-clear-transactions')?.addEventListener('click', async () => {
    const confirmed = await UI.showConfirm(
      'This will permanently delete ALL transactions. Categories and settings will be kept.',
      'Clear All Transactions',
      'btn-danger'
    );
    if (!confirmed) return;
    Store.clearTransactions();
    refreshAllViews();
    UI.showToast('All transactions cleared.', 'success');
  });

  // Reset
  document.getElementById('btn-reset')?.addEventListener('click', async () => {
    const confirmed = await UI.showConfirm(
      'This will permanently delete ALL transactions, categories, and settings. This cannot be undone.',
      'Reset Everything',
      'btn-danger'
    );
    if (!confirmed) return;
    Store.resetAllData();
    AppState.dashboardMonth = Utils.getCurrentMonthKey();
    AppState.transactionMonth = Utils.getCurrentMonthKey();
    AppState.typeFilter = 'all';
    AppState.categoryFilter = 'all';
    UI.showToast('All data has been reset.', 'warning');
    refreshAllViews();
    UI.loadSettingsForm();
  });
}

/* ═══════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   DARK MODE
═══════════════════════════════════════════════ */

function setupDarkMode() {
  const saved = localStorage.getItem('et_dark_mode');
  if (saved === 'true') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  document.getElementById('btn-dark-mode')?.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('et_dark_mode', 'false');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('et_dark_mode', 'true');
    }
  });
}

function updateMonthLabel(elId, monthKey) {
  const el = document.getElementById(elId);
  if (el) el.textContent = Utils.monthLabel(monthKey);
}

function setupPrintHandler() {
  document.getElementById('btn-print-report')?.addEventListener('click', () => {
    // Ensure we're on the dashboard
    navigateTo('dashboard');
    // Short delay to ensure the dashboard is rendered
    setTimeout(() => window.print(), 200);
  });
}

function refreshAllViews() {
  UI.syncCurrencyPrefixes();
  renderDashboardView();
  if (UI.currentSection() === 'transactions') renderTransactionsView();
  if (UI.currentSection() === 'categories') renderCategoriesView();
  if (UI.currentSection() === 'recurring') renderRecurringView();
  if (UI.currentSection() === 'goals') renderGoalsView();
  if (UI.currentSection() === 'debts') renderDebtsView();
  if (UI.currentSection() === 'wishlist') renderWishlistView();
  if (UI.currentSection() === 'accounts') renderAccountsView();
}
