/* ===================================================
   JENTRAK — DASHBOARD

   Computes and renders the main dashboard view.
   All figures are derived fresh from the Store on every
   render so the display always reflects the latest data.

   Responsibilities:
     - Aggregate income, expenses, and budget for a month
     - Update the four summary stat cards
     - Show per-category budget warnings (80 %+ usage)
     - Trigger chart and insight updates

   Depends on: Utils, Store, Transactions, Categories, UI, Charts
   =================================================== */

'use strict';

const Dashboard = (() => {

  /* ═══════════════════════════════════════════════
     COMPUTE
  ═══════════════════════════════════════════════ */

  // Pulls the month summary and per-category breakdown from Transactions,
  // then derives budget utilisation percentages and remaining amounts.
  function computeDashboardData(monthKey) {
    const settings = Store.getSettings();
    const summary = Transactions.summarizeMonth(monthKey);
    const categoryBreakdown = Transactions.summarizeByCategory(monthKey);
    const overallBudget = settings.monthlyBudget;
    const remaining = overallBudget !== null ? overallBudget - summary.expenses : null;
    const budgetPct = overallBudget ? Utils.clamp((summary.expenses / overallBudget) * 100, 0, 100) : null;

    return {
      monthKey,
      income:            summary.income,
      expenses:          summary.expenses,
      net:               summary.net,
      incomeCount:       summary.incomeCount,
      expenseCount:      summary.expenseCount,
      overallBudget,
      remainingBudget:   remaining,
      budgetPercentUsed: budgetPct,
      categoryBreakdown,
    };
  }

  /* ═══════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════ */

  // Writes computed totals into the four dashboard stat cards:
  // Income, Expenses, Net (positive/negative colouring), and Remaining Budget.
  function renderSummaryCards(data) {
    const settings = Store.getSettings();
    const fmt = v => Utils.formatCurrency(v, settings);

    // Income
    document.getElementById('stat-income').textContent = fmt(data.income);
    document.getElementById('stat-income-count').textContent =
      `${data.incomeCount} transaction${data.incomeCount !== 1 ? 's' : ''}`;

    // Expenses
    document.getElementById('stat-expenses').textContent = fmt(data.expenses);
    document.getElementById('stat-expenses-count').textContent =
      `${data.expenseCount} transaction${data.expenseCount !== 1 ? 's' : ''}`;

    // Net
    const netEl = document.getElementById('stat-net');
    netEl.textContent = (data.net >= 0 ? '+' : '-') + fmt(Math.abs(data.net));
    netEl.className = 'stat-value ' + (data.net >= 0 ? 'stat-value--positive' : 'stat-value--negative');
    document.getElementById('stat-net-label').textContent = data.net >= 0 ? 'On track' : 'Overspent';

    // Remaining Budget
    const remainEl = document.getElementById('stat-remaining');
    const budgetLabelEl = document.getElementById('stat-budget-label');
    if (data.overallBudget !== null) {
      const rem = data.remainingBudget;
      remainEl.textContent = (rem >= 0 ? '' : '-') + fmt(Math.abs(rem));
      remainEl.className = 'stat-value ' + (rem >= 0 ? 'stat-value--positive' : 'stat-value--negative');
      budgetLabelEl.textContent = `of ${fmt(data.overallBudget)} budget (${Math.round(data.budgetPercentUsed)}% used)`;
    } else {
      remainEl.textContent = '—';
      remainEl.className = 'stat-value';
      budgetLabelEl.textContent = 'No overall budget set';
    }
  }

  // Injects warning banners for any category at 80 % or more of its budget.
  // Categories over 100 % get a danger-level banner instead of a warning.
  function renderBudgetWarnings(categoryBreakdown) {
    const container = document.getElementById('budget-warnings');
    if (!container) return;

    const warnings = categoryBreakdown.filter(c => c.budget && c.percentUsed >= 80);
    if (warnings.length === 0) {
      container.innerHTML = '';
      return;
    }

    const settings = Store.getSettings();
    container.innerHTML = warnings.map(c => {
      const over = c.percentUsed >= 100;
      return `
        <div class="warning-banner ${over ? 'warning-banner--danger' : 'warning-banner--warning'}">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 2L1 14h14L8 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
            <path d="M8 6v4M8 11.5v.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          ${over
            ? `<strong>${UI.escapeHtml(c.categoryName)}</strong> is over budget — spent ${Utils.formatCurrency(c.totalSpent, settings)} of ${Utils.formatCurrency(c.budget, settings)}`
            : `<strong>${UI.escapeHtml(c.categoryName)}</strong> is at ${Math.round(c.percentUsed)}% of budget (${Utils.formatCurrency(c.totalSpent, settings)} / ${Utils.formatCurrency(c.budget, settings)})`
          }
        </div>
      `;
    }).join('');
  }

  // Sets the human-readable month label (e.g. "March 2026") on the
  // dashboard heading and on each chart section title.
  function renderMonthLabels(monthKey) {
    const label = Utils.monthLabel(monthKey);
    ['dash-month-label', 'pie-month-label', 'bar-month-label'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = label;
    });
  }

  /* ═══════════════════════════════════════════════
     WIDGETS
  ═══════════════════════════════════════════════ */

  function renderSpendingStreak(monthKey) {
    const container = document.getElementById('spending-streak');
    if (!container) return;

    const streak = Transactions.getSpendingStreak(monthKey);
    if (streak.currentStreak === 0 && streak.longestStreak === 0) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    container.hidden = false;
    container.innerHTML = `
      <div class="streak-card">
        <div class="streak-card__current">
          <span class="streak-card__number">${streak.currentStreak}</span>
          <span class="streak-card__label">day${streak.currentStreak !== 1 ? 's' : ''} no-spend streak</span>
        </div>
        <div class="streak-card__best">
          Best this month: ${streak.longestStreak} day${streak.longestStreak !== 1 ? 's' : ''}
        </div>
      </div>
    `;
  }

  function renderBudgetPace(monthKey) {
    const container = document.getElementById('budget-pace');
    if (!container) return;

    const pace = Transactions.getBudgetPace(monthKey);
    if (!pace || pace.daysElapsed === 0) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    const settings = Store.getSettings();
    container.hidden = false;
    const statusClass = pace.onTrack ? 'pace-card--on-track' : 'pace-card--over';
    const statusLabel = pace.onTrack ? 'On Track' : 'Over Budget Pace';

    container.innerHTML = `
      <div class="pace-card ${statusClass}">
        <div class="pace-card__header">
          <span class="pace-card__status">${statusLabel}</span>
          <span class="pace-card__rate">${Utils.formatCurrency(pace.dailyRate, settings)}/day</span>
        </div>
        <div class="pace-card__detail">
          Projected month-end: ${Utils.formatCurrency(pace.projected, settings)}
          (${pace.daysElapsed} of ${pace.daysInMonth} days)
        </div>
      </div>
    `;
  }

  function renderTopMerchants(monthKey) {
    const container = document.getElementById('top-merchants');
    if (!container) return;

    const top = Transactions.getTopDescriptions(monthKey, 5);
    if (!top || top.length === 0) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    const settings = Store.getSettings();
    container.hidden = false;

    container.innerHTML = `
      <div class="merchants-card">
        <h3 class="merchants-card__title">Top Spending</h3>
        <ul class="merchants-list">
          ${top.map((item, i) => `
            <li class="merchants-list__item">
              <span class="merchants-list__rank">${i + 1}</span>
              <span class="merchants-list__name">${item.description}</span>
              <span class="merchants-list__count">${item.count}x</span>
              <span class="merchants-list__total">${Utils.formatCurrency(item.total, settings)}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  function renderBillReminders() {
    const container = document.getElementById('bill-reminders');
    if (!container) return;

    const recurring = Store.getRecurring().filter(r => r.isActive && r.type === 'expense');
    if (recurring.length === 0) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    const settings = Store.getSettings();
    const today = new Date();
    const currentDay = today.getDate();
    const categories = Store.getCategories();
    const catMap = {};
    for (const c of categories) catMap[c.id] = c;

    const upcoming = recurring
      .map(r => {
        const cat = catMap[r.categoryId];
        const daysUntil = r.dayOfMonth >= currentDay ? r.dayOfMonth - currentDay : (new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate() - currentDay + r.dayOfMonth);
        return { ...r, catName: cat ? cat.name : 'Unknown', catColor: cat ? cat.color : '#94a3b8', daysUntil };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 5);

    container.hidden = false;
    container.innerHTML = `
      <div class="reminders-card">
        <h3 class="reminders-card__title">Upcoming Bills</h3>
        <ul class="reminders-list">
          ${upcoming.map(r => `
            <li class="reminders-list__item">
              <span class="reminders-list__dot" style="background:${r.catColor}"></span>
              <span class="reminders-list__name">${r.description || r.catName}</span>
              <span class="reminders-list__amount">${Utils.formatCurrency(r.amount, settings)}</span>
              <span class="reminders-list__due">${r.daysUntil === 0 ? 'Today' : r.daysUntil === 1 ? 'Tomorrow' : r.daysUntil + ' days'}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  function renderSavingsSuggestion(monthKey) {
    const container = document.getElementById('savings-suggestion');
    if (!container) return;

    const summary = Transactions.summarizeMonth(monthKey);
    const settings = Store.getSettings();

    if (summary.net <= 0) {
      container.innerHTML = '';
      container.hidden = true;
      return;
    }

    const suggestedSave = Math.round(summary.net * 0.2 * 100) / 100;
    container.hidden = false;
    container.innerHTML = `
      <div class="suggestion-card">
        <div class="suggestion-card__icon">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16zm0 3v5l3.5 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </div>
        <div class="suggestion-card__text">
          <span class="suggestion-card__label">Savings Suggestion</span>
          <span class="suggestion-card__amount">Save ${Utils.formatCurrency(suggestedSave, settings)} this month</span>
          <span class="suggestion-card__detail">20% of your ${Utils.formatCurrency(summary.net, settings)} surplus</span>
        </div>
      </div>
    `;
  }

  /* ═══════════════════════════════════════════════
     PUBLIC: Render / Update
  ═══════════════════════════════════════════════ */

  // Full dashboard render: computes data, updates cards, warnings,
  // insights, net-worth sidebar, and refreshes every chart.
  function renderDashboard(monthKey) {
    const data = computeDashboardData(monthKey);
    renderMonthLabels(monthKey);
    renderSummaryCards(data);
    renderBudgetWarnings(data.categoryBreakdown);
    renderSpendingStreak(monthKey);
    renderBudgetPace(monthKey);
    renderTopMerchants(monthKey);
    renderBillReminders();
    renderSavingsSuggestion(monthKey);

    // Insights
    const insights = Transactions.getInsights(monthKey);
    UI.renderInsights(insights);

    // Net Worth from Accounts
    if (typeof Accounts !== 'undefined') {
      UI.renderNetWorthCards();
    }

    Charts.updateAllCharts(monthKey);
  }

  // Convenience wrapper: only re-renders when the user is actually
  // viewing the dashboard section, to avoid unnecessary DOM work.
  function updateDashboard(monthKey) {
    if (UI.currentSection() === 'dashboard') {
      renderDashboard(monthKey);
    }
  }

  /* ═══════════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════════ */

  return {
    renderDashboard,
    updateDashboard,
    computeDashboardData,
    renderSpendingStreak,
    renderBudgetPace,
    renderTopMerchants,
    renderBillReminders,
    renderSavingsSuggestion,
  };
})();
