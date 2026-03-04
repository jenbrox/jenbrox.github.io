/* ===================================================
   EXPENSE TRACKER — APP
   Entry point: initializes and wires all modules.
   No business logic lives here.
   Depends on: Utils, Store, Transactions, Categories,
               UI, Dashboard, Charts
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
};

/* ═══════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', init);

function init() {
  // 1. Seed default data (no-op if data already exists)
  Store.seedDefaultData();

  // 2. Initialize Chart.js instances (canvas must be in DOM)
  Charts.initCharts();

  // 3. Wire all event handlers
  setupNavigation();
  setupModalCloseHandlers();
  setupTransactionHandlers();
  setupCategoryHandlers();
  setupSettingsHandlers();
  setupDataHandlers();
  setupMonthNavHandlers();
  setupFilterHandlers();
  UI.setupTypeToggleListener();

  // 4. Read initial section from URL hash
  const hash = window.location.hash.replace('#', '') || 'dashboard';
  navigateTo(hash);
}

/* ═══════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════ */

function navigateTo(sectionId) {
  const valid = ['dashboard', 'transactions', 'categories', 'settings'];
  const target = valid.includes(sectionId) ? sectionId : 'dashboard';

  UI.showSection(target);
  window.location.hash = target;

  if (target === 'dashboard') {
    renderDashboardView();
  } else if (target === 'transactions') {
    renderTransactionsView();
  } else if (target === 'categories') {
    renderCategoriesView();
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
  const txns = Transactions.getFilteredTransactions(
    AppState.transactionMonth,
    AppState.typeFilter,
    AppState.categoryFilter
  );
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
    if (e.key === 'Escape') UI.closeAllModals();
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
    UI.openModal('transaction-modal');
  });

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
        UI.openModal('transaction-modal');
      }
    }

    if (deleteBtn) {
      handleDeleteTransaction(deleteBtn.dataset.deleteTxn);
    }
  });
}

async function handleTransactionSubmit() {
  const { valid, data } = UI.getTransactionFormValues();
  if (!valid) return;

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

  UI.closeModal('transaction-modal');
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

  Transactions.deleteTransaction(id);
  UI.showToast('Transaction deleted.', 'success');
  renderTransactionsView();
  Dashboard.updateDashboard(AppState.dashboardMonth);
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
    a.download = `expense-tracker-export-${Utils.todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    UI.showToast('Data exported.', 'success');
  });

  // Import
  document.getElementById('btn-import-file')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      const result = Store.importData(ev.target.result);
      if (result.success) {
        UI.showToast('Data imported successfully.', 'success');
        refreshAllViews();
      } else {
        UI.showToast(`Import failed: ${result.error}`, 'error');
      }
      e.target.value = ''; // reset file input
    };
    reader.readAsText(file);
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

function updateMonthLabel(elId, monthKey) {
  const el = document.getElementById(elId);
  if (el) el.textContent = Utils.monthLabel(monthKey);
}

function refreshAllViews() {
  UI.syncCurrencyPrefixes();
  renderDashboardView();
  if (UI.currentSection() === 'transactions') renderTransactionsView();
  if (UI.currentSection() === 'categories') renderCategoriesView();
}
