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

  // 3b. New feature handlers
  setupBulkActions();
  setupSearchAllMonths();
  setupTemplateHandlers();
  setupNotesHandlers();
  setupPayoffCalculator();

  // 4. Initialize dark mode
  setupDarkMode();

  // 4b. Print report button & calendar
  setupPrintHandler();
  setupCalendarHandlers();

  // 4d. Onboarding tour (first visit only)
  setupOnboarding();

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

  // 7. Setup user menu
  setupUserMenu();
}

function setupUserMenu() {
  const btn = document.getElementById('btn-user-menu');
  const dropdown = document.getElementById('user-dropdown');
  const nameEl = document.getElementById('user-dropdown-name');
  const emailEl = document.getElementById('user-dropdown-email');
  const logoutBtn = document.getElementById('btn-logout');
  const avatarUpload = document.getElementById('avatar-upload');
  const removeAvatarBtn = document.getElementById('btn-remove-avatar');

  if (!btn || !dropdown) return;

  // Populate user info
  const user = Auth.getUser();
  if (user) {
    if (nameEl) nameEl.textContent = user.name || 'User';
    if (emailEl) emailEl.textContent = user.email || '';
    updateAvatarDisplay(user.avatar_url);
  }

  // Toggle dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.hidden = !dropdown.hidden;
  });

  // Close on outside click
  document.addEventListener('click', () => { dropdown.hidden = true; });
  dropdown.addEventListener('click', (e) => e.stopPropagation());

  // Logout
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => Auth.logout());
  }

  // Avatar upload
  if (avatarUpload) {
    avatarUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validate size (10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert('Image too large. Maximum 10MB.');
        avatarUpload.value = '';
        return;
      }

      // Validate type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        avatarUpload.value = '';
        return;
      }

      // Resize and compress to keep DB reasonable
      try {
        const dataUrl = await resizeImage(file, 256);
        const res = await fetch('/api/auth/avatar', {
          method: 'PUT',
          headers: Auth.authHeaders(),
          body: JSON.stringify({ avatar: dataUrl }),
        });
        if (!res.ok) {
          const err = await res.json();
          alert(err.error || 'Failed to upload avatar');
          return;
        }
        // Update local storage
        const userData = Auth.getUser();
        userData.avatar_url = dataUrl;
        localStorage.setItem('jentrak_user', JSON.stringify(userData));
        updateAvatarDisplay(dataUrl);
      } catch {
        alert('Failed to upload avatar. Please try again.');
      }
      avatarUpload.value = '';
    });
  }

  // Remove avatar
  if (removeAvatarBtn) {
    removeAvatarBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/avatar', { method: 'DELETE', headers: Auth.authHeaders() });
        const userData = Auth.getUser();
        userData.avatar_url = null;
        localStorage.setItem('jentrak_user', JSON.stringify(userData));
        updateAvatarDisplay(null);
      } catch {
        alert('Failed to remove avatar.');
      }
    });
  }
}

function updateAvatarDisplay(avatarUrl) {
  // Header avatar
  const headerImg = document.getElementById('user-avatar');
  const headerFallback = document.getElementById('user-avatar-fallback');
  // Dropdown avatar
  const dropdownImg = document.getElementById('dropdown-avatar-img');
  const dropdownFallback = document.getElementById('dropdown-avatar-fallback');
  const removeBtn = document.getElementById('btn-remove-avatar');

  if (avatarUrl) {
    if (headerImg) { headerImg.src = avatarUrl; headerImg.hidden = false; }
    if (headerFallback) headerFallback.style.display = 'none';
    if (dropdownImg) { dropdownImg.src = avatarUrl; dropdownImg.hidden = false; }
    if (dropdownFallback) dropdownFallback.style.display = 'none';
    if (removeBtn) removeBtn.hidden = false;
  } else {
    if (headerImg) { headerImg.hidden = true; headerImg.src = ''; }
    if (headerFallback) headerFallback.style.display = '';
    if (dropdownImg) { dropdownImg.hidden = true; dropdownImg.src = ''; }
    if (dropdownFallback) dropdownFallback.style.display = '';
    if (removeBtn) removeBtn.hidden = true;
  }
}

function resizeImage(file, maxSize) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > h) { if (w > maxSize) { h = Math.round(h * maxSize / w); w = maxSize; } }
        else { if (h > maxSize) { w = Math.round(w * maxSize / h); h = maxSize; } }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ═══════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════ */

function navigateTo(sectionId) {
  const valid = ['dashboard', 'transactions', 'categories', 'recurring', 'goals', 'debts', 'wishlist', 'accounts', 'notes', 'settings'];
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
  } else if (target === 'notes') {
    loadNotesForMonth();
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
  updateMonthLabel('dash-month-label-mobile', AppState.dashboardMonth);
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
  const searchAll = document.getElementById('search-all-months')?.checked && AppState.searchQuery;

  let txns;
  if (searchAll) {
    // Search across all months
    txns = Transactions.searchAllMonths({ query: AppState.searchQuery, limit: 100 });
  } else {
    txns = Transactions.getFilteredTransactions(
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
  document.getElementById('dash-prev-month-mobile')?.addEventListener('click', () => {
    AppState.dashboardMonth = Utils.offsetMonth(AppState.dashboardMonth, -1);
    renderDashboardView();
  });
  document.getElementById('dash-next-month-mobile')?.addEventListener('click', () => {
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

  // Capture previous saved amount for milestone detection
  const goalBefore = Goals.getGoalById(id);
  const previousSaved = goalBefore ? goalBefore.savedAmount : 0;

  const result = Goals.addToGoal(id, parseFloat(amount));
  if (!result.success) {
    UI.showToast(result.errors.join(' '), 'error');
    return;
  }

  UI.closeModal('goal-add-modal');
  const goal = result.goal;
  const pct = goal.targetAmount > 0 ? Math.round((goal.savedAmount / goal.targetAmount) * 100) : 0;

  // Check for milestones
  const milestones = Goals.checkMilestones(id, previousSaved);
  if (milestones.length > 0) {
    const highest = milestones[milestones.length - 1];
    if (highest >= 100) {
      UI.showToast(`Goal reached! Congratulations!`, 'success');
    } else {
      UI.showToast(`Milestone! You've reached ${highest}% of "${goal.name}"!`, 'success');
    }
  } else {
    UI.showToast(`Added funds. ${pct}% of goal reached.`, 'success');
  }
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
  // Show payoff calculator if there are active debts
  const calc = document.getElementById('payoff-calculator');
  if (calc) {
    const debts = Store.getDebts ? Store.getDebts() : [];
    calc.hidden = debts.filter(d => !d.isPaidOff).length === 0;
  }
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

/* ═══════════════════════════════════════════════
   CALENDAR MODAL
═══════════════════════════════════════════════ */

let calendarMonth = null;

function openCalendar() {
  calendarMonth = AppState.dashboardMonth;
  renderCalendar();
  UI.openModal('calendar-modal');
}

function renderCalendar() {
  const [year, month] = calendarMonth.split('-').map(Number);
  const settings = Store.getSettings();
  const categories = Store.getCategories();
  const catMap = {};
  for (const c of categories) catMap[c.id] = c;

  // Update title
  const title = document.getElementById('calendar-modal-title');
  if (title) title.textContent = Utils.monthLabel(calendarMonth);

  // Hide day detail panel
  const detail = document.getElementById('calendar-day-detail');
  if (detail) detail.hidden = true;

  // Get all transactions for this month
  const txns = Transactions.getTransactionsForMonth(calendarMonth);

  // Group transactions by day number
  const byDay = {};
  for (const t of txns) {
    const day = parseInt(t.date.split('-')[2], 10);
    if (!byDay[day]) byDay[day] = [];
    byDay[day].push(t);
  }

  const grid = document.getElementById('calendar-grid');
  if (!grid) return;

  const today = new Date();
  const todayDay = (today.getFullYear() === year && today.getMonth() + 1 === month) ? today.getDate() : -1;

  const firstDow = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();

  // Build HTML
  let html = '';
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  for (const dn of dayNames) {
    html += `<div class="calendar-grid__day-header">${dn}</div>`;
  }

  // Empty cells before first day
  for (let i = 0; i < firstDow; i++) {
    html += '<div class="calendar-cell calendar-cell--empty"></div>';
  }

  // Day cells
  for (let d = 1; d <= daysInMonth; d++) {
    const dayTxns = byDay[d] || [];
    const hasData = dayTxns.length > 0;
    let income = 0, expense = 0;
    const dots = [];

    for (const t of dayTxns) {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
      const cat = catMap[t.categoryId];
      if (cat && dots.length < 5) dots.push(cat.color || '#6C63FF');
    }

    let classes = 'calendar-cell';
    if (hasData) classes += ' calendar-cell--has-data';
    if (d === todayDay) classes += ' calendar-cell--today';

    html += `<div class="${classes}" data-day="${d}">`;
    html += `<span class="calendar-cell__day">${d}</span>`;

    if (income > 0) {
      html += `<span class="calendar-cell__income">+${Utils.formatCurrency(income, settings)}</span>`;
    }
    if (expense > 0) {
      html += `<span class="calendar-cell__expense">-${Utils.formatCurrency(expense, settings)}</span>`;
    }

    if (dots.length > 0) {
      html += '<div class="calendar-cell__dot-row">';
      for (const color of dots) {
        html += `<span class="calendar-cell__dot" style="background:${color}"></span>`;
      }
      html += '</div>';
    }

    html += '</div>';
  }

  grid.innerHTML = html;

  // Click handlers on day cells
  grid.querySelectorAll('.calendar-cell--has-data').forEach(cell => {
    cell.addEventListener('click', () => {
      const day = parseInt(cell.dataset.day, 10);
      showCalendarDayDetail(day, byDay[day], catMap, settings);
      grid.querySelectorAll('.calendar-cell--selected').forEach(c => c.classList.remove('calendar-cell--selected'));
      cell.classList.add('calendar-cell--selected');
    });
  });
}

function showCalendarDayDetail(day, txns, catMap, settings) {
  const detail = document.getElementById('calendar-day-detail');
  const titleEl = document.getElementById('calendar-detail-title');
  const summaryEl = document.getElementById('calendar-detail-summary');
  const listEl = document.getElementById('calendar-detail-list');
  if (!detail || !titleEl || !summaryEl || !listEl) return;

  const [year, month] = calendarMonth.split('-').map(Number);
  const dateStr = new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
  titleEl.textContent = dateStr;

  let income = 0, expense = 0;
  for (const t of txns) {
    if (t.type === 'income') income += t.amount;
    else expense += t.amount;
  }

  let summaryHtml = '';
  if (income > 0) summaryHtml += `<span class="income">+${Utils.formatCurrency(income, settings)}</span>`;
  if (expense > 0) summaryHtml += `<span class="expense">-${Utils.formatCurrency(expense, settings)}</span>`;
  summaryEl.innerHTML = summaryHtml;

  let listHtml = '';
  for (const t of txns) {
    const cat = catMap[t.categoryId];
    const catName = cat ? cat.name : '';
    const catColor = cat ? cat.color : '#94a3b8';
    const amountClass = t.type === 'income' ? 'calendar-txn__amount--income' : 'calendar-txn__amount--expense';
    const sign = t.type === 'income' ? '+' : '-';
    const desc = t.description || catName || (t.type === 'income' ? 'Income' : 'Expense');

    listHtml += `<li class="calendar-txn">`;
    listHtml += `<span class="calendar-txn__dot" style="background:${catColor}"></span>`;
    listHtml += `<span class="calendar-txn__desc">${Utils.escapeHtml(desc)}</span>`;
    if (catName) listHtml += `<span class="calendar-txn__cat">${Utils.escapeHtml(catName)}</span>`;
    listHtml += `<span class="calendar-txn__amount ${amountClass}">${sign}${Utils.formatCurrency(t.amount, settings)}</span>`;
    listHtml += `</li>`;
  }
  listEl.innerHTML = listHtml;
  detail.hidden = false;
}

function setupCalendarHandlers() {
  // Click on month labels opens calendar
  ['dash-month-label', 'dash-month-label-mobile'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.style.cursor = 'pointer';
      el.title = 'Open calendar';
      el.addEventListener('click', openCalendar);
    }
  });

  // Calendar month navigation
  document.getElementById('cal-prev-month')?.addEventListener('click', () => {
    calendarMonth = Utils.offsetMonth(calendarMonth, -1);
    renderCalendar();
  });
  document.getElementById('cal-next-month')?.addEventListener('click', () => {
    calendarMonth = Utils.offsetMonth(calendarMonth, 1);
    renderCalendar();
  });
}

function setupPrintHandler() {
  const printAction = () => {
    navigateTo('dashboard');
    setTimeout(() => window.print(), 200);
  };
  document.getElementById('btn-print-report')?.addEventListener('click', printAction);
  document.getElementById('btn-print-report-mobile')?.addEventListener('click', printAction);
}

/* ═══════════════════════════════════════════════
   BULK ACTIONS
═══════════════════════════════════════════════ */

function setupBulkActions() {
  const toolbar = document.getElementById('bulk-toolbar');
  const selectAllTop = document.getElementById('bulk-select-all');
  const selectAllTable = document.getElementById('table-select-all');
  const deleteBtn = document.getElementById('bulk-delete');
  const countEl = document.getElementById('bulk-count');

  function updateBulkUI() {
    const checked = document.querySelectorAll('.txn-checkbox:checked');
    const count = checked.length;
    if (toolbar) toolbar.hidden = count === 0;
    if (countEl) countEl.textContent = `${count} selected`;
    if (selectAllTop) selectAllTop.checked = count > 0 && count === document.querySelectorAll('.txn-checkbox').length;
    if (selectAllTable) selectAllTable.checked = selectAllTop?.checked || false;
  }

  // Delegate checkbox changes on the transaction table body
  document.getElementById('transaction-list')?.addEventListener('change', e => {
    if (e.target.classList.contains('txn-checkbox')) updateBulkUI();
  });

  // Select-all in toolbar
  selectAllTop?.addEventListener('change', () => {
    document.querySelectorAll('.txn-checkbox').forEach(cb => { cb.checked = selectAllTop.checked; });
    updateBulkUI();
  });

  // Select-all in table header
  selectAllTable?.addEventListener('change', () => {
    document.querySelectorAll('.txn-checkbox').forEach(cb => { cb.checked = selectAllTable.checked; });
    updateBulkUI();
  });

  // Delete selected
  deleteBtn?.addEventListener('click', async () => {
    const checked = document.querySelectorAll('.txn-checkbox:checked');
    if (checked.length === 0) return;

    const confirmed = await UI.showConfirm(
      `Delete ${checked.length} transaction${checked.length !== 1 ? 's' : ''}? This cannot be undone.`,
      'Delete', 'btn-danger'
    );
    if (!confirmed) return;

    checked.forEach(cb => {
      Transactions.deleteTransaction(cb.value);
    });

    UI.showToast(`${checked.length} transaction(s) deleted.`, 'success');
    if (toolbar) toolbar.hidden = true;
    renderTransactionsView();
    Dashboard.updateDashboard(AppState.dashboardMonth);
  });
}

/* ═══════════════════════════════════════════════
   SEARCH ALL MONTHS
═══════════════════════════════════════════════ */

function setupSearchAllMonths() {
  const toggle = document.getElementById('search-all-months');
  if (!toggle) return;

  toggle.addEventListener('change', () => {
    renderFilteredTransactions();
  });
}

/* ═══════════════════════════════════════════════
   QUICK-ADD TEMPLATES
═══════════════════════════════════════════════ */

function setupTemplateHandlers() {
  // Open template modal
  document.getElementById('btn-quick-add')?.addEventListener('click', () => {
    // Populate category dropdown
    const catSelect = document.getElementById('tpl-category');
    if (catSelect) {
      const cats = Store.getCategories();
      catSelect.innerHTML = '<option value="">— Select —</option>' +
        cats.map(c => `<option value="${c.id}">${Utils.escapeHtml(c.name)}</option>`).join('');
    }
    UI.renderTemplateList();
    UI.openModal('template-modal');
  });

  // Save new template
  document.getElementById('template-form')?.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('tpl-name')?.value.trim();
    const amount = parseFloat(document.getElementById('tpl-amount')?.value);
    const type = document.getElementById('tpl-type')?.value || 'expense';
    const categoryId = document.getElementById('tpl-category')?.value || '';
    const description = document.getElementById('tpl-description')?.value.trim() || '';

    if (!name) { UI.showToast('Template name is required.', 'error'); return; }
    if (!Utils.isPositiveNumber(amount)) { UI.showToast('Enter a valid amount.', 'error'); return; }

    const templates = Store.getTemplates();
    templates.push({
      id: Utils.generateId(),
      name, amount, type, categoryId, description,
      createdAt: new Date().toISOString(),
    });
    Store.saveTemplates(templates);

    document.getElementById('template-form').reset();
    UI.renderTemplateList();
    UI.showToast('Template saved.', 'success');
  });

  // Use / delete template via delegation
  document.getElementById('template-list')?.addEventListener('click', e => {
    const useBtn = e.target.closest('[data-use-tpl]');
    const delBtn = e.target.closest('[data-delete-tpl]');

    if (useBtn) {
      const tplId = useBtn.dataset.useTpl;
      const templates = Store.getTemplates();
      const tpl = templates.find(t => t.id === tplId);
      if (!tpl) return;

      const txnData = {
        date: Utils.todayISO(),
        amount: tpl.amount,
        type: tpl.type,
        categoryId: tpl.categoryId,
        description: tpl.description,
      };
      const result = Transactions.addTransaction(txnData);
      if (result.success) {
        UI.closeModal('template-modal');
        UI.showToast(`Added ${tpl.name} transaction.`, 'success');
        renderTransactionsView();
        Dashboard.updateDashboard(AppState.dashboardMonth);
      } else {
        UI.showToast(result.errors.join(' '), 'error');
      }
    }

    if (delBtn) {
      const tplId = delBtn.dataset.deleteTpl;
      let templates = Store.getTemplates();
      templates = templates.filter(t => t.id !== tplId);
      Store.saveTemplates(templates);
      UI.renderTemplateList();
      UI.showToast('Template deleted.', 'success');
    }
  });
}

/* ═══════════════════════════════════════════════
   NOTES / JOURNAL
═══════════════════════════════════════════════ */

let notesMonth = null;

function setupNotesHandlers() {
  notesMonth = Utils.getCurrentMonthKey();
  updateNotesMonthLabel();

  // Month navigation
  document.getElementById('notes-prev-month')?.addEventListener('click', () => {
    notesMonth = Utils.offsetMonth(notesMonth, -1);
    updateNotesMonthLabel();
    loadNotesForMonth();
  });
  document.getElementById('notes-next-month')?.addEventListener('click', () => {
    notesMonth = Utils.offsetMonth(notesMonth, 1);
    updateNotesMonthLabel();
    loadNotesForMonth();
  });

  // Save
  document.getElementById('btn-save-notes')?.addEventListener('click', () => {
    const text = document.getElementById('notes-textarea')?.value || '';
    const notes = Store.getNotes();
    const existing = notes.find(n => n.monthKey === notesMonth);
    if (existing) {
      existing.text = text;
      existing.updatedAt = new Date().toISOString();
    } else {
      notes.push({ id: Utils.generateId(), monthKey: notesMonth, text, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    Store.saveNotes(notes);
    const statusEl = document.getElementById('notes-status');
    if (statusEl) statusEl.textContent = 'Saved!';
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
    UI.renderNotesHistory();
  });

  // Load current month on first render
  loadNotesForMonth();
}

function updateNotesMonthLabel() {
  const el = document.getElementById('notes-month-label');
  if (el) el.textContent = Utils.monthLabel(notesMonth);
}

function loadNotesForMonth() {
  const notes = Store.getNotes();
  const note = notes.find(n => n.monthKey === notesMonth);
  const textarea = document.getElementById('notes-textarea');
  if (textarea) textarea.value = note ? note.text : '';
  const statusEl = document.getElementById('notes-status');
  if (statusEl) statusEl.textContent = '';
  UI.renderNotesHistory();
}

/* ═══════════════════════════════════════════════
   DEBT PAYOFF CALCULATOR
═══════════════════════════════════════════════ */

function setupPayoffCalculator() {
  document.getElementById('btn-calc-payoff')?.addEventListener('click', () => {
    const input = document.getElementById('payoff-monthly');
    const monthly = parseFloat(input?.value);
    if (!Utils.isPositiveNumber(monthly)) {
      UI.showToast('Enter a valid monthly payment amount.', 'error');
      return;
    }
    const result = Debts.calculatePayoffPlan(monthly);
    UI.renderPayoffResults(result);
  });
}

/* ═══════════════════════════════════════════════
   ONBOARDING TOUR
═══════════════════════════════════════════════ */

function setupOnboarding() {
  const ONBOARDING_KEY = 'et_onboarding_done';
  if (localStorage.getItem(ONBOARDING_KEY)) return;

  const steps = [
    { title: 'Welcome to Jentrak!', text: 'Your personal expense tracker. Let\'s take a quick tour of the main features.' },
    { title: 'Dashboard', text: 'See your monthly income, expenses, budget status, and spending insights at a glance.' },
    { title: 'Transactions', text: 'Add income and expenses, search, filter, and manage your financial records.' },
    { title: 'Categories & Budgets', text: 'Organize spending into categories and set budget limits to stay on track.' },
    { title: 'Goals & Debts', text: 'Track savings goals and manage debt payoff strategies.' },
    { title: 'Quick Add', text: 'Use the lightning bolt button in the header to instantly add transactions from saved templates.' },
    { title: 'You\'re All Set!', text: 'Start by adding your first transaction. Press "N" anytime to quickly add one.' },
  ];

  let currentStep = 0;
  const overlay = document.getElementById('onboarding-overlay');
  const contentEl = document.getElementById('onboarding-step-content');
  const dotsEl = document.getElementById('onboarding-dots');
  const nextBtn = document.getElementById('onboarding-next');
  const skipBtn = document.getElementById('onboarding-skip');

  if (!overlay || !contentEl) return;

  function renderStep() {
    const step = steps[currentStep];
    contentEl.innerHTML = `<h3>${step.title}</h3><p>${step.text}</p>`;
    dotsEl.innerHTML = steps.map((_, i) =>
      `<span class="onboarding-dot${i === currentStep ? ' onboarding-dot--active' : ''}"></span>`
    ).join('');
    nextBtn.textContent = currentStep === steps.length - 1 ? 'Get Started' : 'Next';
  }

  function finish() {
    overlay.hidden = true;
    localStorage.setItem(ONBOARDING_KEY, 'true');
  }

  nextBtn?.addEventListener('click', () => {
    if (currentStep < steps.length - 1) {
      currentStep++;
      renderStep();
    } else {
      finish();
    }
  });

  skipBtn?.addEventListener('click', finish);

  // Show onboarding
  renderStep();
  overlay.hidden = false;
}

/* ═══════════════════════════════════════════════
   GOAL MILESTONES (enhanced add-funds)
═══════════════════════════════════════════════ */

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
