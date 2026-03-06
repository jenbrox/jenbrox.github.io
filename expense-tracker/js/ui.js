/* ===================================================
   JENTRAX — UI
   Navigation, modals, toasts, form helpers,
   and list renderers.
   Depends on: Utils, Store, Transactions, Categories
   =================================================== */

'use strict';

const UI = (() => {

  /* ═══════════════════════════════════════════════
     SECTION NAVIGATION
  ═══════════════════════════════════════════════ */

  let _currentSection = 'dashboard';

  function showSection(id) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(s => {
      s.hidden = s.id !== id;
    });

    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.nav === id);
    });

    _currentSection = id;
  }

  function currentSection() {
    return _currentSection;
  }

  /* ═══════════════════════════════════════════════
     MODAL SYSTEM  (native <dialog>)
  ═══════════════════════════════════════════════ */

  function openModal(modalId) {
    const dialog = document.getElementById(modalId);
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal();
    }
  }

  function closeModal(modalId) {
    const dialog = document.getElementById(modalId);
    if (dialog && typeof dialog.close === 'function') {
      dialog.close();
    }
  }

  function closeAllModals() {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
  }

  /* ═══════════════════════════════════════════════
     TOAST NOTIFICATIONS
  ═══════════════════════════════════════════════ */

  function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast--out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 3000);
  }

  /* ═══════════════════════════════════════════════
     CONFIRM MODAL
  ═══════════════════════════════════════════════ */

  function showConfirm(message, okLabel, okClass) {
    return new Promise(resolve => {
      document.getElementById('confirm-message').textContent = message;
      const okBtn = document.getElementById('confirm-ok');
      okBtn.textContent = okLabel || 'Delete';
      okBtn.className = `btn ${okClass || 'btn-danger'}`;

      openModal('confirm-modal');

      function onOk() {
        cleanup();
        closeModal('confirm-modal');
        resolve(true);
      }
      function onCancel() {
        cleanup();
        closeModal('confirm-modal');
        resolve(false);
      }
      function cleanup() {
        okBtn.removeEventListener('click', onOk);
        document.getElementById('confirm-cancel').removeEventListener('click', onCancel);
      }

      okBtn.addEventListener('click', onOk, { once: true });
      document.getElementById('confirm-cancel').addEventListener('click', onCancel, { once: true });
    });
  }

  /* ═══════════════════════════════════════════════
     CURRENCY PREFIX SYNC
  ═══════════════════════════════════════════════ */

  function syncCurrencyPrefixes() {
    const symbol = (Store.getSettings().currencySymbol || '$');
    document.querySelectorAll('.input-prefix').forEach(el => {
      el.textContent = symbol;
    });
  }

  /* ═══════════════════════════════════════════════
     TRANSACTION FORM
  ═══════════════════════════════════════════════ */

  function populateTransactionForm(transaction) {
    const settings = Store.getSettings();
    const isEdit = !!transaction;

    // Modal title & submit button
    document.getElementById('txn-modal-title').textContent = isEdit ? 'Edit Transaction' : 'Add Transaction';
    document.getElementById('txn-submit-btn').textContent = isEdit ? 'Save Changes' : 'Add Transaction';
    document.getElementById('txn-edit-id').value = isEdit ? transaction.id : '';

    // Reset field errors
    clearTransactionFormErrors();

    // Type
    const radios = document.querySelectorAll('input[name="txn-type"]');
    const type = isEdit ? transaction.type : 'expense';
    radios.forEach(r => { r.checked = r.value === type; });

    // Amount
    document.getElementById('txn-amount').value = isEdit ? transaction.amount : '';

    // Date
    document.getElementById('txn-date').value = isEdit ? transaction.date : Utils.todayISO();

    // Description
    document.getElementById('txn-description').value = isEdit ? transaction.description : '';

    // Tags
    document.getElementById('txn-tags').value = isEdit && transaction.tags ? transaction.tags.join(', ') : '';

    // Category dropdown
    populateCategoryDropdown('txn-category', isEdit ? transaction.categoryId : '', type);

    // Update currency prefix
    syncCurrencyPrefixes();
  }

  function populateCategoryDropdown(selectId, selectedValue, type) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.innerHTML = '';

    // Add income option when type is income
    if (type === 'income') {
      const opt = document.createElement('option');
      opt.value = '__income__';
      opt.textContent = 'Income';
      opt.selected = !selectedValue || selectedValue === '__income__';
      select.appendChild(opt);
    } else {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Select a category…';
      placeholder.disabled = true;
      placeholder.selected = !selectedValue;
      select.appendChild(placeholder);

      // Add uncategorized option if needed
      if (selectedValue === '__uncategorized__') {
        const unc = document.createElement('option');
        unc.value = '__uncategorized__';
        unc.textContent = 'Uncategorized';
        unc.selected = true;
        select.appendChild(unc);
      }

      Categories.getAllCategories().forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat.id;
        opt.textContent = cat.name;
        opt.selected = cat.id === selectedValue;
        select.appendChild(opt);
      });
    }
  }

  // Listen for type toggle changes to update category dropdown
  function setupTypeToggleListener() {
    document.querySelectorAll('input[name="txn-type"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const currentCatId = document.getElementById('txn-category').value;
        populateCategoryDropdown('txn-category', currentCatId, radio.value);
      });
    });
  }

  function getTransactionFormValues() {
    const id = document.getElementById('txn-edit-id').value;
    const type = document.querySelector('input[name="txn-type"]:checked')?.value || 'expense';
    const amount = document.getElementById('txn-amount').value;
    const categoryId = document.getElementById('txn-category').value;
    const date = document.getElementById('txn-date').value;
    const description = document.getElementById('txn-description').value;
    const tags = document.getElementById('txn-tags').value;

    const errors = {};

    if (!Utils.isPositiveNumber(amount)) {
      errors.amount = 'Enter a valid positive amount.';
    }
    if (!categoryId) {
      errors.category = 'Please select a category.';
    }
    if (!Utils.isValidDate(date)) {
      errors.date = 'Please enter a valid date.';
    }

    const valid = Object.keys(errors).length === 0;

    if (!valid) {
      showTransactionFormErrors(errors);
    }

    return {
      valid,
      errors,
      data: { id, type, amount, categoryId, date, description, tags },
    };
  }

  function showTransactionFormErrors(errors) {
    clearTransactionFormErrors();
    if (errors.amount) {
      document.getElementById('txn-amount').classList.add('error');
      showFieldError('txn-amount-error', errors.amount);
    }
    if (errors.category) {
      document.getElementById('txn-category').classList.add('error');
      showFieldError('txn-category-error', errors.category);
    }
    if (errors.date) {
      document.getElementById('txn-date').classList.add('error');
      showFieldError('txn-date-error', errors.date);
    }
  }

  function clearTransactionFormErrors() {
    ['txn-amount', 'txn-category', 'txn-date'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('error');
    });
    ['txn-amount-error', 'txn-category-error', 'txn-date-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.hidden = true; el.textContent = ''; }
    });
  }

  function showFieldError(elId, msg) {
    const el = document.getElementById(elId);
    if (el) { el.textContent = msg; el.hidden = false; }
  }

  /* ═══════════════════════════════════════════════
     CATEGORY FORM
  ═══════════════════════════════════════════════ */

  function populateCategoryForm(category) {
    const isEdit = !!category;

    document.getElementById('cat-modal-title').textContent = isEdit ? 'Edit Category' : 'Add Category';
    document.getElementById('cat-submit-btn').textContent = isEdit ? 'Save Changes' : 'Add Category';
    document.getElementById('cat-edit-id').value = isEdit ? category.id : '';
    document.getElementById('cat-name').value = isEdit ? category.name : '';
    document.getElementById('cat-budget').value = isEdit && category.monthlyBudget ? category.monthlyBudget : '';

    // Clear errors
    clearCategoryFormErrors();

    // Render color picker
    renderColorPicker(isEdit ? category.color : null);

    syncCurrencyPrefixes();
  }

  function renderColorPicker(selectedColor) {
    const colors = Store.getPresetColors();
    const picker = document.getElementById('color-picker');
    if (!picker) return;

    // Default to first color if none selected
    const current = selectedColor || colors[0];
    picker.innerHTML = '';

    colors.forEach(color => {
      const label = document.createElement('label');
      label.className = 'color-swatch-label';
      label.title = color;
      label.style.color = color; // used for :checked box-shadow via CSS

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'cat-color';
      input.value = color;
      input.checked = color === current;

      const swatch = document.createElement('span');
      swatch.className = 'color-swatch';
      swatch.style.background = color;

      label.appendChild(input);
      label.appendChild(swatch);
      picker.appendChild(label);
    });
  }

  function getCategoryFormValues() {
    const id = document.getElementById('cat-edit-id').value;
    const name = document.getElementById('cat-name').value;
    const color = document.querySelector('input[name="cat-color"]:checked')?.value || '';
    const budget = document.getElementById('cat-budget').value;

    const errors = {};

    if (!name.trim()) {
      errors.name = 'Category name is required.';
    }
    if (!color) {
      errors.color = 'Please select a color.';
    }

    const valid = Object.keys(errors).length === 0;
    if (!valid) showCategoryFormErrors(errors);

    return {
      valid,
      errors,
      data: { id, name, color, monthlyBudget: budget || null },
    };
  }

  function showCategoryFormErrors(errors) {
    clearCategoryFormErrors();
    if (errors.name) {
      document.getElementById('cat-name').classList.add('error');
      showFieldError('cat-name-error', errors.name);
    }
    if (errors.color) {
      showFieldError('cat-color-error', errors.color);
    }
  }

  function clearCategoryFormErrors() {
    const nameEl = document.getElementById('cat-name');
    if (nameEl) nameEl.classList.remove('error');
    ['cat-name-error', 'cat-color-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.hidden = true; el.textContent = ''; }
    });
  }

  /* ═══════════════════════════════════════════════
     TRANSACTION LIST RENDERER
  ═══════════════════════════════════════════════ */

  function renderTransactionList(transactions) {
    const tbody = document.getElementById('transaction-tbody');
    const tfoot = document.getElementById('transaction-tfoot');
    const settings = Store.getSettings();
    const categories = Store.getCategories();
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c; });

    if (!transactions || transactions.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No transactions found. Try adjusting your filters or adding a new one!</td></tr>';
      tfoot.hidden = true;
      return;
    }

    let totalIncome = 0, totalExpenses = 0;

    tbody.innerHTML = transactions.map(t => {
      const cat = catMap[t.categoryId];
      const catName = t.categoryId === '__income__' ? 'Income'
                    : t.categoryId === '__uncategorized__' ? 'Uncategorized'
                    : cat ? cat.name : 'Unknown';
      const catColor = cat ? cat.color : '#94a3b8';
      const dateStr = Utils.formatDate(t.date, settings.dateFormat);
      const amount = Utils.formatCurrency(t.amount, settings);

      if (t.type === 'income') totalIncome += t.amount;
      else totalExpenses += t.amount;

      return `
        <tr data-txn-id="${escapeHtml(t.id)}">
          <td class="col-check"><input type="checkbox" class="txn-checkbox" value="${escapeHtml(t.id)}"></td>
          <td>${escapeHtml(dateStr)}</td>
          <td><span class="badge badge--${t.type}">${t.type === 'income' ? 'Income' : 'Expense'}</span></td>
          <td>
            <span style="display:inline-flex;align-items:center;gap:6px;">
              <span style="width:10px;height:10px;border-radius:50%;background:${escapeHtml(catColor)};display:inline-block;flex-shrink:0;"></span>
              ${escapeHtml(catName)}
            </span>
          </td>
          <td class="col-desc">${escapeHtml(t.description || '—')}</td>
          <td class="col-tags">${(t.tags && t.tags.length) ? t.tags.map(tag => `<span class="tag-badge">${escapeHtml(tag)}</span>`).join(' ') : ''}</td>
          <td class="col-amount amount--${t.type}">${t.type === 'income' ? '+' : '-'}${amount}</td>
          <td class="col-actions">
            <div class="row-actions">
              <button class="btn btn-ghost btn-icon" data-edit-txn="${escapeHtml(t.id)}" aria-label="Edit transaction" title="Edit">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M11.5 1.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
              </button>
              <button class="btn btn-ghost btn-icon" data-delete-txn="${escapeHtml(t.id)}" aria-label="Delete transaction" title="Delete" style="color:var(--color-expense)">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M3 4h9M6 4V2.5h3V4M5.5 4v7.5h4V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Footer totals
    const net = totalIncome - totalExpenses;
    document.getElementById('tfoot-totals').innerHTML = `
      <span style="color:var(--color-income)">+${Utils.formatCurrency(totalIncome, settings)}</span>
      &nbsp;/&nbsp;
      <span style="color:var(--color-expense)">-${Utils.formatCurrency(totalExpenses, settings)}</span>
      &nbsp;=&nbsp;
      <span style="color:${net >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}">${net >= 0 ? '+' : ''}${Utils.formatCurrency(net, settings)}</span>
    `;
    tfoot.hidden = false;
  }

  /* ═══════════════════════════════════════════════
     CATEGORY LIST RENDERER
  ═══════════════════════════════════════════════ */

  function renderCategoryList(monthKey) {
    const categories = Categories.getAllCategories();
    const grid = document.getElementById('categories-grid');
    const settings = Store.getSettings();

    if (categories.length === 0) {
      grid.innerHTML = '<p class="empty-state">No categories yet. Click "Add Category" to create one.</p>';
      return;
    }

    grid.innerHTML = categories.map(cat => {
      const spent = Categories.getMonthlySpend(cat.id, monthKey);
      const budget = cat.monthlyBudget;
      const hasBudget = budget !== null && budget > 0;
      const pct = hasBudget ? Utils.clamp((spent / budget) * 100, 0, 100) : 0;
      const fillClass = pct >= 100 ? 'progress-bar__fill--danger' : pct >= 80 ? 'progress-bar__fill--warning' : '';

      const budgetText = hasBudget
        ? `${Utils.formatCurrency(spent, settings)} / ${Utils.formatCurrency(budget, settings)}`
        : `${Utils.formatCurrency(spent, settings)} spent`;
      const budgetLabel = hasBudget ? `Budget: ${Utils.formatCurrency(budget, settings)}/mo` : 'No budget limit';

      return `
        <div class="category-card">
          <div class="category-card__header">
            <span class="cat-color-dot" style="background:${escapeHtml(cat.color)}"></span>
            <span class="category-card__name">${escapeHtml(cat.name)}</span>
          </div>
          <div class="category-card__stats">
            <span>${budgetLabel}</span>
            <span class="category-card__spent">${budgetText}</span>
          </div>
          ${hasBudget ? `
          <div class="progress-bar" title="${Math.round(pct)}% used">
            <div class="progress-bar__fill ${fillClass}" style="width:${pct}%"></div>
          </div>
          ` : '<div style="height:6px;margin-bottom:var(--space-md)"></div>'}
          <div class="category-card__actions">
            <button class="btn btn-ghost btn-icon" data-edit-cat="${escapeHtml(cat.id)}" aria-label="Edit ${escapeHtml(cat.name)}" title="Edit">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M11.5 1.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon" data-delete-cat="${escapeHtml(cat.id)}" aria-label="Delete ${escapeHtml(cat.name)}" title="Delete" style="color:var(--color-expense)">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M3 4h9M6 4V2.5h3V4M5.5 4v7.5h4V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ═══════════════════════════════════════════════
     RECURRING TRANSACTION FORM
  ═══════════════════════════════════════════════ */

  function populateRecurringForm(rec) {
    const isEdit = !!rec;

    document.getElementById('rec-modal-title').textContent = isEdit ? 'Edit Recurring Transaction' : 'Add Recurring Transaction';
    document.getElementById('rec-submit-btn').textContent = isEdit ? 'Save Changes' : 'Add Recurring';
    document.getElementById('rec-edit-id').value = isEdit ? rec.id : '';

    clearRecurringFormErrors();

    const radios = document.querySelectorAll('input[name="rec-type"]');
    const type = isEdit ? rec.type : 'expense';
    radios.forEach(r => { r.checked = r.value === type; });

    document.getElementById('rec-amount').value = isEdit ? rec.amount : '';
    document.getElementById('rec-day').value = isEdit ? rec.dayOfMonth : '1';
    document.getElementById('rec-description').value = isEdit ? rec.description : '';
    document.getElementById('rec-start-date').value = isEdit ? rec.startDate : Utils.todayISO();
    document.getElementById('rec-end-date').value = isEdit && rec.endDate ? rec.endDate : '';

    populateCategoryDropdown('rec-category', isEdit ? rec.categoryId : '', type);
    syncCurrencyPrefixes();
  }

  function setupRecTypeToggleListener() {
    document.querySelectorAll('input[name="rec-type"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const currentCatId = document.getElementById('rec-category').value;
        populateCategoryDropdown('rec-category', currentCatId, radio.value);
      });
    });
  }

  function getRecurringFormValues() {
    const id = document.getElementById('rec-edit-id').value;
    const type = document.querySelector('input[name="rec-type"]:checked')?.value || 'expense';
    const amount = document.getElementById('rec-amount').value;
    const categoryId = document.getElementById('rec-category').value;
    const dayOfMonth = document.getElementById('rec-day').value;
    const description = document.getElementById('rec-description').value;
    const startDate = document.getElementById('rec-start-date').value;
    const endDate = document.getElementById('rec-end-date').value;

    const errors = {};

    if (!Utils.isPositiveNumber(amount)) {
      errors.amount = 'Enter a valid positive amount.';
    }
    if (!categoryId) {
      errors.category = 'Please select a category.';
    }
    const day = parseInt(dayOfMonth, 10);
    if (isNaN(day) || day < 1 || day > 28) {
      errors.day = 'Day must be between 1 and 28.';
    }

    const valid = Object.keys(errors).length === 0;
    if (!valid) showRecurringFormErrors(errors);

    return {
      valid,
      errors,
      data: { id, type, amount, categoryId, dayOfMonth, description, startDate, endDate },
    };
  }

  function showRecurringFormErrors(errors) {
    clearRecurringFormErrors();
    if (errors.amount) {
      document.getElementById('rec-amount').classList.add('error');
      showFieldError('rec-amount-error', errors.amount);
    }
    if (errors.category) {
      document.getElementById('rec-category').classList.add('error');
      showFieldError('rec-category-error', errors.category);
    }
    if (errors.day) {
      document.getElementById('rec-day').classList.add('error');
      showFieldError('rec-day-error', errors.day);
    }
  }

  function clearRecurringFormErrors() {
    ['rec-amount', 'rec-category', 'rec-day'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('error');
    });
    ['rec-amount-error', 'rec-category-error', 'rec-day-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.hidden = true; el.textContent = ''; }
    });
  }

  /* ═══════════════════════════════════════════════
     RECURRING LIST RENDERER
  ═══════════════════════════════════════════════ */

  function renderRecurringList() {
    const recurring = Recurring.getAllRecurring();
    const container = document.getElementById('recurring-list');
    const settings = Store.getSettings();
    const categories = Store.getCategories();
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c; });

    if (recurring.length === 0) {
      container.innerHTML = '<p class="empty-state">No recurring transactions yet. Click "Add Recurring" to set up automatic monthly transactions.</p>';
      return;
    }

    container.innerHTML = recurring.map(rec => {
      const cat = catMap[rec.categoryId];
      const catName = rec.categoryId === '__income__' ? 'Income'
                    : cat ? cat.name : 'Unknown';
      const catColor = cat ? cat.color : '#94a3b8';
      const amount = Utils.formatCurrency(rec.amount, settings);
      const ordinal = getOrdinal(rec.dayOfMonth);
      const statusClass = rec.isActive ? 'recurring-card--active' : 'recurring-card--paused';
      const statusLabel = rec.isActive ? 'Active' : 'Paused';
      const statusBadge = rec.isActive ? 'badge--income' : 'badge--expense';

      return `
        <div class="recurring-card ${statusClass}">
          <div class="recurring-card__header">
            <div class="recurring-card__info">
              <span class="badge badge--${rec.type}">${rec.type === 'income' ? 'Income' : 'Expense'}</span>
              <span class="badge ${statusBadge}">${statusLabel}</span>
            </div>
            <div class="recurring-card__amount amount--${rec.type}">${rec.type === 'income' ? '+' : '-'}${amount}</div>
          </div>
          <div class="recurring-card__body">
            <div class="recurring-card__desc">${escapeHtml(rec.description || 'No description')}</div>
            <div class="recurring-card__meta">
              <span style="display:inline-flex;align-items:center;gap:4px;">
                <span style="width:8px;height:8px;border-radius:50%;background:${escapeHtml(catColor)};display:inline-block;"></span>
                ${escapeHtml(catName)}
              </span>
              <span>Every ${ordinal} of the month</span>
            </div>
          </div>
          <div class="recurring-card__actions">
            <button class="btn btn-ghost btn-icon" data-toggle-rec="${escapeHtml(rec.id)}" aria-label="${rec.isActive ? 'Pause' : 'Activate'}" title="${rec.isActive ? 'Pause' : 'Activate'}">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                ${rec.isActive
                  ? '<rect x="4" y="3" width="2.5" height="9" rx="0.5" fill="currentColor"/><rect x="8.5" y="3" width="2.5" height="9" rx="0.5" fill="currentColor"/>'
                  : '<path d="M4 2.5l8 5-8 5V2.5z" fill="currentColor"/>'}
              </svg>
            </button>
            <button class="btn btn-ghost btn-icon" data-edit-rec="${escapeHtml(rec.id)}" aria-label="Edit" title="Edit">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M11.5 1.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon" data-delete-rec="${escapeHtml(rec.id)}" aria-label="Delete" title="Delete" style="color:var(--color-expense)">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M3 4h9M6 4V2.5h3V4M5.5 4v7.5h4V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function getOrdinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  /* ═══════════════════════════════════════════════
     GOALS FORM
  ═══════════════════════════════════════════════ */

  function populateGoalForm(goal) {
    const isEdit = !!goal;

    document.getElementById('goal-modal-title').textContent = isEdit ? 'Edit Goal' : 'Add Savings Goal';
    document.getElementById('goal-submit-btn').textContent = isEdit ? 'Save Changes' : 'Add Goal';
    document.getElementById('goal-edit-id').value = isEdit ? goal.id : '';

    document.getElementById('goal-name').value = isEdit ? goal.name : '';
    document.getElementById('goal-target').value = isEdit ? goal.targetAmount : '';
    document.getElementById('goal-saved').value = isEdit ? goal.savedAmount : '';
    document.getElementById('goal-deadline').value = isEdit && goal.deadline ? goal.deadline : '';

    clearGoalFormErrors();
    renderGoalColorPicker(isEdit ? goal.color : null);
    syncCurrencyPrefixes();
  }

  function renderGoalColorPicker(selectedColor) {
    const colors = Store.getPresetColors();
    const picker = document.getElementById('goal-color-picker');
    if (!picker) return;

    const current = selectedColor || colors[0];
    picker.innerHTML = '';

    colors.forEach(color => {
      const label = document.createElement('label');
      label.className = 'color-swatch-label';
      label.title = color;
      label.style.color = color;

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'goal-color';
      input.value = color;
      input.checked = color === current;

      const swatch = document.createElement('span');
      swatch.className = 'color-swatch';
      swatch.style.background = color;

      label.appendChild(input);
      label.appendChild(swatch);
      picker.appendChild(label);
    });
  }

  function getGoalFormValues() {
    const id = document.getElementById('goal-edit-id').value;
    const name = document.getElementById('goal-name').value;
    const targetAmount = document.getElementById('goal-target').value;
    const savedAmount = document.getElementById('goal-saved').value;
    const deadline = document.getElementById('goal-deadline').value;
    const color = document.querySelector('input[name="goal-color"]:checked')?.value || '#6C63FF';

    const errors = {};
    if (!name.trim()) errors.name = 'Goal name is required.';
    if (!Utils.isPositiveNumber(targetAmount)) errors.target = 'Enter a valid target amount.';

    const valid = Object.keys(errors).length === 0;
    if (!valid) showGoalFormErrors(errors);

    return { valid, errors, data: { id, name, targetAmount, savedAmount, deadline, color } };
  }

  function showGoalFormErrors(errors) {
    clearGoalFormErrors();
    if (errors.name) {
      document.getElementById('goal-name').classList.add('error');
      showFieldError('goal-name-error', errors.name);
    }
    if (errors.target) {
      document.getElementById('goal-target').classList.add('error');
      showFieldError('goal-target-error', errors.target);
    }
  }

  function clearGoalFormErrors() {
    ['goal-name', 'goal-target'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('error');
    });
    ['goal-name-error', 'goal-target-error'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.hidden = true; el.textContent = ''; }
    });
  }

  /* ═══════════════════════════════════════════════
     GOALS LIST RENDERER
  ═══════════════════════════════════════════════ */

  function renderGoalsList() {
    const goals = Goals.getAllGoals();
    const grid = document.getElementById('goals-grid');
    const settings = Store.getSettings();

    if (goals.length === 0) {
      grid.innerHTML = '<p class="empty-state">No savings goals yet. Click "Add Goal" to start saving toward something!</p>';
      return;
    }

    grid.innerHTML = goals.map(goal => {
      const pct = goal.targetAmount > 0 ? Utils.clamp((goal.savedAmount / goal.targetAmount) * 100, 0, 100) : 0;
      const isComplete = pct >= 100;
      const remaining = Math.max(0, goal.targetAmount - goal.savedAmount);
      const fillClass = isComplete ? 'progress-bar__fill--complete' : '';
      const deadlineStr = goal.deadline ? Utils.formatDate(goal.deadline, settings.dateFormat) : '';

      return `
        <div class="goal-card ${isComplete ? 'goal-card--complete' : ''}">
          <div class="goal-card__header">
            <span class="goal-card__color" style="background:${escapeHtml(goal.color)}"></span>
            <span class="goal-card__name">${escapeHtml(goal.name)}</span>
            ${isComplete ? '<span class="badge badge--income">Reached!</span>' : ''}
          </div>
          <div class="goal-card__amounts">
            <span class="goal-card__saved">${Utils.formatCurrency(goal.savedAmount, settings)}</span>
            <span class="goal-card__target">of ${Utils.formatCurrency(goal.targetAmount, settings)}</span>
          </div>
          <div class="progress-bar progress-bar--goal">
            <div class="progress-bar__fill ${fillClass}" style="width:${pct}%;background:${escapeHtml(goal.color)}"></div>
          </div>
          <div class="goal-card__meta">
            <span>${Math.round(pct)}% saved</span>
            ${!isComplete ? `<span>${Utils.formatCurrency(remaining, settings)} to go</span>` : ''}
            ${deadlineStr ? `<span>Target: ${deadlineStr}</span>` : ''}
          </div>
          <div class="goal-card__actions">
            ${!isComplete ? `
            <button class="btn btn-secondary btn-sm" data-fund-goal="${escapeHtml(goal.id)}">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              Add Funds
            </button>` : ''}
            <button class="btn btn-ghost btn-icon" data-edit-goal="${escapeHtml(goal.id)}" aria-label="Edit" title="Edit">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M11.5 1.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon" data-delete-goal="${escapeHtml(goal.id)}" aria-label="Delete" title="Delete" style="color:var(--color-expense)">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M3 4h9M6 4V2.5h3V4M5.5 4v7.5h4V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ═══════════════════════════════════════════════
     INSIGHTS RENDERER
  ═══════════════════════════════════════════════ */

  const INSIGHT_ICONS = {
    'arrow-up':     '<path d="M8 14V2M8 2L3 7M8 2l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    'crown':        '<path d="M2 12l2-8 4 4 4-4 2 8H2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" fill="none"/>',
    'calendar':     '<rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3" fill="none"/><path d="M2 7h12M5 1v3M11 1v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    'hash':         '<path d="M4 1v14M10 1v14M1 5h14M1 11h14" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>',
    'trending-up':  '<path d="M2 12l4-4 3 3 5-5M10 6h4v4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    'trending-down':'<path d="M2 4l4 4 3-3 5 5M10 10h4V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  };

  function renderInsights(insights) {
    const grid = document.getElementById('insights-grid');
    if (!grid) return;

    if (!insights || insights.length === 0) {
      grid.innerHTML = '';
      grid.style.display = 'none';
      return;
    }

    grid.style.display = '';
    const settings = Store.getSettings();

    grid.innerHTML = insights.map(ins => {
      let displayValue;
      if (ins.isCount) {
        displayValue = ins.value;
      } else if (ins.isPercent) {
        displayValue = `${ins.isNegative ? '-' : '+'}${Math.round(ins.value)}%`;
      } else {
        displayValue = Utils.formatCurrency(ins.value, settings);
      }

      const iconSvg = INSIGHT_ICONS[ins.icon] || INSIGHT_ICONS['hash'];

      return `
        <div class="insight-card">
          <div class="insight-card__icon" style="background:${escapeHtml(ins.color)}20;color:${escapeHtml(ins.color)}">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">${iconSvg}</svg>
          </div>
          <div class="insight-card__content">
            <div class="insight-card__label">${escapeHtml(ins.label)}</div>
            <div class="insight-card__value">${escapeHtml(String(displayValue))}</div>
            <div class="insight-card__detail">${escapeHtml(ins.detail)}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  /* ═══════════════════════════════════════════════
     FILTER CATEGORY DROPDOWN
  ═══════════════════════════════════════════════ */

  function populateFilterCategoryDropdown(monthKey) {
    const select = document.getElementById('filter-category');
    if (!select) return;

    // Get categories that have transactions in this month
    const txns = Transactions.getTransactionsForMonth(monthKey);
    const usedIds = [...new Set(txns.map(t => t.categoryId))];
    const categories = Store.getCategories().filter(c => usedIds.includes(c.id));

    const current = select.value;
    select.innerHTML = '<option value="all">All categories</option>';

    if (usedIds.includes('__income__')) {
      select.innerHTML += '<option value="__income__">Income</option>';
    }
    if (usedIds.includes('__uncategorized__')) {
      select.innerHTML += '<option value="__uncategorized__">Uncategorized</option>';
    }

    categories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      opt.selected = cat.id === current;
      select.appendChild(opt);
    });
  }

  /* ═══════════════════════════════════════════════
     SETTINGS FORM
  ═══════════════════════════════════════════════ */

  function loadSettingsForm() {
    const s = Store.getSettings();
    const budgetEl = document.getElementById('setting-monthly-budget');
    const symbolEl = document.getElementById('setting-currency-symbol');
    const dateEl   = document.getElementById('setting-date-format');

    if (budgetEl) budgetEl.value = s.monthlyBudget !== null ? s.monthlyBudget : '';
    if (symbolEl) symbolEl.value = s.currencySymbol || '$';
    if (dateEl)   dateEl.value   = s.dateFormat || 'MM/DD/YYYY';
  }

  function getSettingsFormValues() {
    const budget = document.getElementById('setting-monthly-budget').value;
    const symbol = document.getElementById('setting-currency-symbol').value.trim();
    const format = document.getElementById('setting-date-format').value;

    return {
      monthlyBudget:  budget ? parseFloat(budget) : null,
      currencySymbol: symbol || '$',
      currency:       'USD',
      dateFormat:     format || 'MM/DD/YYYY',
    };
  }

  /* ═══════════════════════════════════════════════
     HELPERS
  ═══════════════════════════════════════════════ */

  function escapeHtml(str) {
    if (str === undefined || str === null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ═══════════════════════════════════════════════
     DEBT FORM & LIST
  ═══════════════════════════════════════════════ */

  function populateDebtForm(debt) {
    const isEdit = !!debt;

    document.getElementById('debt-modal-title').textContent = isEdit ? 'Edit Debt' : 'Add Debt';
    document.getElementById('debt-submit-btn').textContent = isEdit ? 'Save Changes' : 'Add Debt';
    document.getElementById('debt-edit-id').value = isEdit ? debt.id : '';

    document.getElementById('debt-person').value = isEdit ? debt.personName : '';
    document.getElementById('debt-amount').value = isEdit ? debt.amount : '';
    document.getElementById('debt-description').value = isEdit ? debt.description : '';
    document.getElementById('debt-due-date').value = isEdit && debt.dueDate ? debt.dueDate : '';

    const radios = document.querySelectorAll('input[name="debt-direction"]');
    const direction = isEdit ? debt.direction : 'owed_to_me';
    radios.forEach(r => { r.checked = r.value === direction; });

    syncCurrencyPrefixes();
  }

  function getDebtFormValues() {
    const id = document.getElementById('debt-edit-id').value;
    const personName = document.getElementById('debt-person').value;
    const amount = document.getElementById('debt-amount').value;
    const direction = document.querySelector('input[name="debt-direction"]:checked')?.value || 'owed_to_me';
    const description = document.getElementById('debt-description').value;
    const dueDate = document.getElementById('debt-due-date').value;

    const errors = {};
    if (!personName.trim()) errors.person = 'Person name is required.';
    if (!Utils.isPositiveNumber(amount)) errors.amount = 'Enter a valid positive amount.';

    const valid = Object.keys(errors).length === 0;

    return {
      valid,
      errors,
      data: { id, personName, amount: parseFloat(amount) || 0, direction, description, dueDate },
    };
  }

  function renderDebtsList() {
    const debts = Debts.getAllDebts();
    const container = document.getElementById('debts-list');
    const settings = Store.getSettings();

    if (!container) return;

    if (debts.length === 0) {
      container.innerHTML = '<p class="empty-state">No debts tracked yet. Click "Add Debt" to start tracking.</p>';
      return;
    }

    container.innerHTML = debts.map(debt => {
      const amount = Utils.formatCurrency(debt.amount, settings);
      const settledAmount = debt.settledAmount || 0;
      const pct = debt.amount > 0 ? Utils.clamp((settledAmount / debt.amount) * 100, 0, 100) : 0;
      const isSettled = pct >= 100;
      const directionLabel = debt.direction === 'owed_to_me' ? 'They owe me' : 'I owe';
      const directionClass = debt.direction === 'owed_to_me' ? 'badge--income' : 'badge--expense';
      const dueDateStr = debt.dueDate ? Utils.formatDate(debt.dueDate, settings.dateFormat) : '';

      return `
        <div class="debt-card ${isSettled ? 'debt-card--settled' : ''}">
          <div class="debt-card__header">
            <span class="debt-card__person">${escapeHtml(debt.personName)}</span>
            <span class="badge ${directionClass}">${directionLabel}</span>
          </div>
          <div class="debt-card__amount">${amount}</div>
          ${debt.description ? `<div class="debt-card__desc">${escapeHtml(debt.description)}</div>` : ''}
          ${dueDateStr ? `<div class="debt-card__due">Due: ${escapeHtml(dueDateStr)}</div>` : ''}
          <div class="debt-card__progress">
            <span>${Utils.formatCurrency(settledAmount, settings)} / ${amount} settled</span>
            <div class="progress-bar">
              <div class="progress-bar__fill ${isSettled ? 'progress-bar__fill--complete' : ''}" style="width:${pct}%"></div>
            </div>
          </div>
          <div class="debt-card__actions">
            ${!isSettled ? `
            <button class="btn btn-secondary btn-sm" data-settle-debt="${escapeHtml(debt.id)}">Settle</button>` : ''}
            <button class="btn btn-ghost btn-icon" data-edit-debt="${escapeHtml(debt.id)}" aria-label="Edit" title="Edit">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M11.5 1.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon" data-delete-debt="${escapeHtml(debt.id)}" aria-label="Delete" title="Delete" style="color:var(--color-expense)">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M3 4h9M6 4V2.5h3V4M5.5 4v7.5h4V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderDebtsSummary() {
    const container = document.getElementById('debts-summary');
    if (!container) return;

    const summary = Debts.getSummary();
    const settings = Store.getSettings();

    container.innerHTML = `
      <div class="summary-cards">
        <div class="summary-card">
          <span class="summary-card__label">Owed to Me</span>
          <span class="summary-card__value" style="color:var(--color-income)">${Utils.formatCurrency(summary.owedToMe, settings)}</span>
        </div>
        <div class="summary-card">
          <span class="summary-card__label">I Owe</span>
          <span class="summary-card__value" style="color:var(--color-expense)">${Utils.formatCurrency(summary.iOwe, settings)}</span>
        </div>
        <div class="summary-card">
          <span class="summary-card__label">Net</span>
          <span class="summary-card__value" style="color:${summary.net >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}">${summary.net >= 0 ? '+' : ''}${Utils.formatCurrency(summary.net, settings)}</span>
        </div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════
     WISHLIST FORM & LIST
  ═══════════════════════════════════════════════ */

  function populateWishForm(item) {
    const isEdit = !!item;

    document.getElementById('wish-modal-title').textContent = isEdit ? 'Edit Wish' : 'Add Wish';
    document.getElementById('wish-submit-btn').textContent = isEdit ? 'Save Changes' : 'Add Wish';
    document.getElementById('wish-edit-id').value = isEdit ? item.id : '';

    document.getElementById('wish-name').value = isEdit ? item.name : '';
    document.getElementById('wish-price').value = isEdit ? item.price : '';
    document.getElementById('wish-url').value = isEdit && item.url ? item.url : '';
    document.getElementById('wish-notes').value = isEdit && item.notes ? item.notes : '';

    const priorityEl = document.getElementById('wish-priority');
    if (priorityEl) priorityEl.value = isEdit ? item.priority : 'medium';

    syncCurrencyPrefixes();
  }

  function getWishFormValues() {
    const id = document.getElementById('wish-edit-id').value;
    const name = document.getElementById('wish-name').value;
    const price = document.getElementById('wish-price').value;
    const priority = document.getElementById('wish-priority').value;
    const url = document.getElementById('wish-url').value;
    const notes = document.getElementById('wish-notes').value;

    const errors = {};
    if (!name.trim()) errors.name = 'Item name is required.';

    const valid = Object.keys(errors).length === 0;

    return {
      valid,
      errors,
      data: { id, name, price: parseFloat(price) || 0, priority, url, notes },
    };
  }

  function renderWishlistGrid() {
    const items = Wishlist.getAllItems();
    const container = document.getElementById('wishlist-grid');
    const settings = Store.getSettings();

    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = '<p class="empty-state">No wishlist items yet. Click "Add Wish" to start your list!</p>';
      return;
    }

    const priorityColors = { high: 'var(--color-expense)', medium: '#f59e0b', low: 'var(--color-income)' };

    container.innerHTML = items.map(item => {
      const purchased = !!item.purchased;
      const priceStr = item.price > 0 ? Utils.formatCurrency(item.price, settings) : '';
      const priorityColor = priorityColors[item.priority] || priorityColors.medium;
      const priorityLabel = item.priority ? item.priority.charAt(0).toUpperCase() + item.priority.slice(1) : 'Medium';

      return `
        <div class="wish-card ${purchased ? 'wish-card--purchased' : ''}">
          <div class="wish-card__header">
            <span class="wish-card__name">${escapeHtml(item.name)}</span>
            <span class="badge" style="background:${priorityColor}20;color:${priorityColor}">${escapeHtml(priorityLabel)}</span>
          </div>
          ${priceStr ? `<div class="wish-card__price">${priceStr}</div>` : ''}
          ${item.url ? `<a class="wish-card__link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">View Link</a>` : ''}
          ${item.notes ? `<div class="wish-card__notes">${escapeHtml(item.notes)}</div>` : ''}
          <div class="wish-card__actions">
            <button class="btn btn-secondary btn-sm" data-toggle-wish="${escapeHtml(item.id)}">${purchased ? 'Unmark' : 'Purchased'}</button>
            <button class="btn btn-ghost btn-icon" data-edit-wish="${escapeHtml(item.id)}" aria-label="Edit" title="Edit">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M11.5 1.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon" data-delete-wish="${escapeHtml(item.id)}" aria-label="Delete" title="Delete" style="color:var(--color-expense)">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M3 4h9M6 4V2.5h3V4M5.5 4v7.5h4V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderWishlistTotal() {
    const container = document.getElementById('wishlist-total');
    if (!container) return;

    const total = Wishlist.getTotalCost();
    const settings = Store.getSettings();
    container.textContent = Utils.formatCurrency(total, settings);
  }

  /* ═══════════════════════════════════════════════
     ACCOUNT FORM & LIST
  ═══════════════════════════════════════════════ */

  function populateAccountForm(account) {
    const isEdit = !!account;

    document.getElementById('acct-modal-title').textContent = isEdit ? 'Edit Account' : 'Add Account';
    document.getElementById('acct-submit-btn').textContent = isEdit ? 'Save Changes' : 'Add Account';
    document.getElementById('acct-edit-id').value = isEdit ? account.id : '';

    document.getElementById('acct-name').value = isEdit ? account.name : '';
    document.getElementById('acct-balance').value = isEdit ? account.balance : '';

    const typeEl = document.getElementById('acct-type');
    if (typeEl) typeEl.value = isEdit ? account.accountType : 'checking';

    renderAccountColorPicker(isEdit ? account.color : null);
    syncCurrencyPrefixes();
  }

  function renderAccountColorPicker(selectedColor) {
    const colors = Store.getPresetColors();
    const picker = document.getElementById('acct-color-picker');
    if (!picker) return;

    const current = selectedColor || colors[0];
    picker.innerHTML = '';

    colors.forEach(color => {
      const label = document.createElement('label');
      label.className = 'color-swatch-label';
      label.title = color;
      label.style.color = color;

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'acct-color';
      input.value = color;
      input.checked = color === current;

      const swatch = document.createElement('span');
      swatch.className = 'color-swatch';
      swatch.style.background = color;

      label.appendChild(input);
      label.appendChild(swatch);
      picker.appendChild(label);
    });
  }

  function getAccountFormValues() {
    const id = document.getElementById('acct-edit-id').value;
    const name = document.getElementById('acct-name').value;
    const accountType = document.getElementById('acct-type').value;
    const balance = document.getElementById('acct-balance').value;
    const color = document.querySelector('input[name="acct-color"]:checked')?.value || '';

    const errors = {};
    if (!name.trim()) errors.name = 'Account name is required.';

    const valid = Object.keys(errors).length === 0;

    return {
      valid,
      errors,
      data: { id, name, accountType, balance: parseFloat(balance) || 0, color },
    };
  }

  function renderAccountsGrid() {
    const accounts = Accounts.getAllAccounts();
    const container = document.getElementById('accounts-grid');
    const settings = Store.getSettings();

    if (!container) return;

    if (accounts.length === 0) {
      container.innerHTML = '<p class="empty-state">No accounts yet. Click "Add Account" to track your balances.</p>';
      return;
    }

    container.innerHTML = accounts.map(acct => {
      const balanceStr = Utils.formatCurrency(Math.abs(acct.balance), settings);
      const balanceSign = acct.balance >= 0 ? '' : '-';
      const typeLabel = acct.accountType ? acct.accountType.charAt(0).toUpperCase() + acct.accountType.slice(1) : '';

      return `
        <div class="account-card">
          <div class="account-card__header">
            <span class="account-card__color" style="background:${escapeHtml(acct.color || '#6C63FF')}"></span>
            <span class="account-card__name">${escapeHtml(acct.name)}</span>
            <span class="badge">${escapeHtml(typeLabel)}</span>
          </div>
          <div class="account-card__balance">${balanceSign}${balanceStr}</div>
          <div class="account-card__actions">
            <button class="btn btn-ghost btn-icon" data-edit-acct="${escapeHtml(acct.id)}" aria-label="Edit" title="Edit">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M11.5 1.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
            </button>
            <button class="btn btn-ghost btn-icon" data-delete-acct="${escapeHtml(acct.id)}" aria-label="Delete" title="Delete" style="color:var(--color-expense)">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M3 4h9M6 4V2.5h3V4M5.5 4v7.5h4V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderAccountsSummary() {
    const container = document.getElementById('accounts-summary');
    if (!container) return;

    const netWorth = Accounts.getNetWorth();
    const settings = Store.getSettings();

    container.innerHTML = `
      <div class="summary-cards">
        <div class="summary-card">
          <span class="summary-card__label">Assets</span>
          <span class="summary-card__value" style="color:var(--color-income)">${Utils.formatCurrency(netWorth.assets, settings)}</span>
        </div>
        <div class="summary-card">
          <span class="summary-card__label">Liabilities</span>
          <span class="summary-card__value" style="color:var(--color-expense)">${Utils.formatCurrency(netWorth.liabilities, settings)}</span>
        </div>
        <div class="summary-card">
          <span class="summary-card__label">Net Worth</span>
          <span class="summary-card__value" style="color:${netWorth.netWorth >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}">${netWorth.netWorth >= 0 ? '' : '-'}${Utils.formatCurrency(Math.abs(netWorth.netWorth), settings)}</span>
        </div>
      </div>
    `;
  }

  function populateTransferDropdowns() {
    const accounts = Accounts.getAllAccounts();
    const fromSelect = document.getElementById('transfer-from');
    const toSelect = document.getElementById('transfer-to');

    if (!fromSelect || !toSelect) return;

    [fromSelect, toSelect].forEach(select => {
      select.innerHTML = '<option value="" disabled selected>Select account…</option>';
      accounts.forEach(acct => {
        const opt = document.createElement('option');
        opt.value = acct.id;
        opt.textContent = acct.name;
        select.appendChild(opt);
      });
    });
  }

  /* ═══════════════════════════════════════════════
     UNDO TOAST
  ═══════════════════════════════════════════════ */

  function showUndoToast(message, undoCallback) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast toast--info';
    toast.innerHTML = `
      <span>${escapeHtml(message)}</span>
      <button class="btn btn-ghost btn-sm toast__undo-btn">Undo</button>
    `;

    const undoBtn = toast.querySelector('.toast__undo-btn');
    let dismissed = false;

    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      toast.classList.add('toast--out');
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }

    undoBtn.addEventListener('click', () => {
      if (!dismissed && typeof undoCallback === 'function') {
        undoCallback();
      }
      dismiss();
    }, { once: true });

    container.appendChild(toast);

    setTimeout(() => {
      dismiss();
    }, 5000);
  }

  /* ═══════════════════════════════════════════════
     NET WORTH CARDS (DASHBOARD)
  ═══════════════════════════════════════════════ */

  function renderNetWorthCards() {
    const container = document.getElementById('net-worth-cards');
    const summaryEl = document.getElementById('net-worth-summary');

    if (!container) return;

    const accounts = Accounts.getAllAccounts();

    if (accounts.length === 0) {
      if (summaryEl) summaryEl.hidden = true;
      container.innerHTML = '';
      return;
    }

    if (summaryEl) summaryEl.hidden = false;

    const netWorth = Accounts.getNetWorth();
    const settings = Store.getSettings();

    container.innerHTML = `
      <div class="summary-cards">
        <div class="summary-card">
          <span class="summary-card__label">Assets</span>
          <span class="summary-card__value" style="color:var(--color-income)">${Utils.formatCurrency(netWorth.assets, settings)}</span>
        </div>
        <div class="summary-card">
          <span class="summary-card__label">Liabilities</span>
          <span class="summary-card__value" style="color:var(--color-expense)">${Utils.formatCurrency(netWorth.liabilities, settings)}</span>
        </div>
        <div class="summary-card">
          <span class="summary-card__label">Net Worth</span>
          <span class="summary-card__value" style="color:${netWorth.netWorth >= 0 ? 'var(--color-income)' : 'var(--color-expense)'}">${netWorth.netWorth >= 0 ? '' : '-'}${Utils.formatCurrency(Math.abs(netWorth.netWorth), settings)}</span>
        </div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════
     TEMPLATE LIST RENDERER
  ═══════════════════════════════════════════════ */

  function renderTemplateList() {
    const templates = Store.getTemplates();
    const container = document.getElementById('template-list');
    if (!container) return;

    const categories = Store.getCategories();
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c; });
    const settings = Store.getSettings();

    if (templates.length === 0) {
      container.innerHTML = '<p class="empty-state">No templates yet. Save a transaction as a template to quickly add it again.</p>';
      return;
    }

    container.innerHTML = templates.map(tpl => {
      const cat = catMap[tpl.categoryId];
      const catColor = cat ? cat.color : '#94a3b8';
      const amountClass = tpl.type === 'income' ? 'template-item__amount--income' : 'template-item__amount--expense';
      const sign = tpl.type === 'income' ? '+' : '-';

      return `
        <div class="template-item" data-use-template="${escapeHtml(tpl.id)}">
          <span class="template-item__dot" style="background:${escapeHtml(catColor)}"></span>
          <span class="template-item__name">${escapeHtml(tpl.name)}</span>
          <span class="template-item__amount ${amountClass}">${sign}${Utils.formatCurrency(tpl.amount, settings)}</span>
          <button class="btn btn-ghost btn-icon template-item__delete" data-delete-template="${escapeHtml(tpl.id)}" title="Delete template" onclick="event.stopPropagation()">
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true"><path d="M3 4h9M6 4V2.5h3V4M5.5 4v7.5h4V4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
      `;
    }).join('');
  }

  /* ═══════════════════════════════════════════════
     NOTES HISTORY RENDERER
  ═══════════════════════════════════════════════ */

  function renderNotesHistory() {
    const notes = Store.getNotes();
    const container = document.getElementById('notes-history');
    if (!container) return;

    const otherNotes = notes
      .filter(n => n.text && n.text.trim())
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
      .slice(0, 12);

    if (otherNotes.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = '<h2 style="font-size:1rem;font-weight:700;margin-bottom:var(--space-md);">Previous Notes</h2>' +
      otherNotes.map(n => `
        <div class="notes-history__item">
          <div class="notes-history__month">${Utils.monthLabel(n.monthKey)}</div>
          <div class="notes-history__text">${escapeHtml(n.text)}</div>
        </div>
      `).join('');
  }

  /* ═══════════════════════════════════════════════
     PAYOFF RESULTS RENDERER
  ═══════════════════════════════════════════════ */

  function renderPayoffResults(result) {
    const container = document.getElementById('payoff-results');
    if (!container || !result) return;

    const settings = Store.getSettings();

    container.innerHTML = `
      <div class="payoff-strategy">
        <div class="payoff-strategy__name">Snowball Method</div>
        <div class="payoff-strategy__detail">
          Pay smallest debts first for quick wins.
          <br><span class="payoff-strategy__months">${result.snowball.months}</span> months
          <br>Total paid: ${Utils.formatCurrency(result.snowball.totalPaid, settings)}
        </div>
      </div>
      <div class="payoff-strategy">
        <div class="payoff-strategy__name">Avalanche Method</div>
        <div class="payoff-strategy__detail">
          Pay largest debts first to minimize total cost.
          <br><span class="payoff-strategy__months">${result.avalanche.months}</span> months
          <br>Total paid: ${Utils.formatCurrency(result.avalanche.totalPaid, settings)}
        </div>
      </div>
      <div class="payoff-strategy">
        <div class="payoff-strategy__name">Total Debt</div>
        <div class="payoff-strategy__detail">
          <span class="payoff-strategy__months">${Utils.formatCurrency(result.totalDebt, settings)}</span>
          <br>Outstanding balance across all debts
        </div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════════ */

  return {
    showSection,
    currentSection,
    openModal,
    closeModal,
    closeAllModals,
    showToast,
    showConfirm,
    syncCurrencyPrefixes,
    populateTransactionForm,
    populateCategoryDropdown,
    setupTypeToggleListener,
    getTransactionFormValues,
    populateCategoryForm,
    renderColorPicker,
    getCategoryFormValues,
    renderTransactionList,
    renderCategoryList,
    populateRecurringForm,
    setupRecTypeToggleListener,
    getRecurringFormValues,
    renderRecurringList,
    populateGoalForm,
    getGoalFormValues,
    renderGoalsList,
    renderInsights,
    populateFilterCategoryDropdown,
    loadSettingsForm,
    getSettingsFormValues,
    escapeHtml,
    // Debts
    populateDebtForm,
    getDebtFormValues,
    renderDebtsList,
    renderDebtsSummary,
    // Wishlist
    populateWishForm,
    getWishFormValues,
    renderWishlistGrid,
    renderWishlistTotal,
    // Accounts
    populateAccountForm,
    renderAccountColorPicker,
    getAccountFormValues,
    renderAccountsGrid,
    renderAccountsSummary,
    populateTransferDropdowns,
    // Undo toast
    showUndoToast,
    // Net worth (dashboard)
    renderNetWorthCards,
    // Templates
    renderTemplateList,
    // Notes
    renderNotesHistory,
    // Payoff
    renderPayoffResults,
  };
})();
