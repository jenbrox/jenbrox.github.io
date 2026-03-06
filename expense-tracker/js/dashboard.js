/* ===================================================
   JENTRAX — DASHBOARD
   Computes and renders the dashboard view.
   All data is derived from store on each render.
   Depends on: Utils, Store, Transactions, Categories, UI, Charts
   =================================================== */

'use strict';

const Dashboard = (() => {

  /* ═══════════════════════════════════════════════
     COMPUTE
  ═══════════════════════════════════════════════ */

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

  function renderMonthLabels(monthKey) {
    const label = Utils.monthLabel(monthKey);
    ['dash-month-label', 'pie-month-label', 'bar-month-label'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = label;
    });
  }

  /* ═══════════════════════════════════════════════
     PUBLIC: Render / Update
  ═══════════════════════════════════════════════ */

  function renderDashboard(monthKey) {
    const data = computeDashboardData(monthKey);
    renderMonthLabels(monthKey);
    renderSummaryCards(data);
    renderBudgetWarnings(data.categoryBreakdown);

    // Insights
    const insights = Transactions.getInsights(monthKey);
    UI.renderInsights(insights);

    Charts.updateAllCharts(monthKey);
  }

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
