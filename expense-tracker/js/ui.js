/* ===================================================
   EXPENSE TRACKER — UI
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
      data: { id, type, amount, categoryId, date, description },
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
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No transactions found. Try adjusting your filters or adding a new one!</td></tr>';
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
        <tr>
          <td>${escapeHtml(dateStr)}</td>
          <td><span class="badge badge--${t.type}">${t.type === 'income' ? 'Income' : 'Expense'}</span></td>
          <td>
            <span style="display:inline-flex;align-items:center;gap:6px;">
              <span style="width:10px;height:10px;border-radius:50%;background:${escapeHtml(catColor)};display:inline-block;flex-shrink:0;"></span>
              ${escapeHtml(catName)}
            </span>
          </td>
          <td class="col-desc">${escapeHtml(t.description || '—')}</td>
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
    populateFilterCategoryDropdown,
    loadSettingsForm,
    getSettingsFormValues,
    escapeHtml,
  };
})();
