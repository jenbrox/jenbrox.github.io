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
    ['dash-month-label', 'dash-month-label-mobile', 'pie-month-label', 'bar-month-label'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = label;
    });
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
  };
})();
