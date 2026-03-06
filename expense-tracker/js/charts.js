/* ===================================================
   JENTRAK — CHARTS

   Manages all Chart.js instances used on the dashboard.
   Each chart is created once during initCharts() and then
   updated in place whenever the active month changes.

   Charts:
     - Category doughnut  (spending breakdown by category)
     - Budget vs Actual bar (per-category budget comparison)
     - Monthly trend line  (income vs expenses over 6 months)
     - Year-over-year line (same months across calendar years)
     - Spending heatmap bar (daily spend intensity)
     - Cash-flow forecast bar (projected income/expenses)

   Depends on: Utils, Store, Transactions, and the global Chart object
   =================================================== */

'use strict';

const Charts = (() => {

  const CHART_INSTANCES = {};

  /* ═══════════════════════════════════════════════
     SHARED HELPERS
  ═══════════════════════════════════════════════ */

  // Formats a chart tooltip value as the user's chosen currency.
  function currencyTooltipCallback(context) {
    const settings = Store.getSettings();
    const label = context.dataset.label || '';
    const value = Utils.formatCurrency(context.parsed.y ?? context.parsed, settings);
    return label ? `${label}: ${value}` : value;
  }

  // Formats a Y-axis tick label as currency.
  function currencyAxisCallback(value) {
    const settings = Store.getSettings();
    return Utils.formatCurrency(value, settings);
  }

  /* ═══════════════════════════════════════════════
     CENTER-TEXT PLUGIN  (doughnut empty state)
  ═══════════════════════════════════════════════ */

  // Custom Chart.js plugin that draws "No expense data" in the centre
  // of the doughnut chart when every slice is zero.
  const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart) {
      if (chart.config.type !== 'doughnut') return;
      const total = chart.data.datasets[0]?.data?.reduce((a, b) => a + b, 0) ?? 0;
      if (total > 0) return;
      const { ctx, chartArea } = chart;
      if (!chartArea) return;
      const { left, top, right, bottom } = chartArea;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '14px var(--font-sans, sans-serif)';
      ctx.fillText('No expense data', (left + right) / 2, (top + bottom) / 2);
      ctx.restore();
    },
  };

  /* ═══════════════════════════════════════════════
     INIT  — call once after DOM is ready
  ═══════════════════════════════════════════════ */

  // Creates every Chart.js instance once after the DOM is ready.
  // Sets global font, legend position, and animation defaults, then
  // builds each chart on its respective canvas element.
  function initCharts() {
    if (typeof Chart === 'undefined') {
      console.warn('[Charts] Chart.js not loaded yet, deferring...');
      return;
    }

    // Register the custom plugin
    Chart.register(centerTextPlugin);

    // Apply global defaults
    Chart.defaults.font.family = "'Segoe UI', system-ui, -apple-system, sans-serif";
    Chart.defaults.plugins.legend.position = 'bottom';
    Chart.defaults.animation.duration = 300;

    // ── Category Doughnut ──
    CHART_INSTANCES.pie = new Chart(
      document.getElementById('chart-category-pie').getContext('2d'),
      {
        type: 'doughnut',
        data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 2, borderColor: '#fff' }] },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16 } },
            tooltip: {
              callbacks: {
                label(context) {
                  const settings = Store.getSettings();
                  const val = Utils.formatCurrency(context.parsed, settings);
                  const total = context.dataset.data.reduce((a, b) => a + b, 0);
                  const pct = total > 0 ? Math.round((context.parsed / total) * 100) : 0;
                  return `${context.label}: ${val} (${pct}%)`;
                },
              },
            },
          },
        },
      }
    );

    // ── Budget vs Actual Bar ──
    CHART_INSTANCES.bar = new Chart(
      document.getElementById('chart-budget-bar').getContext('2d'),
      {
        type: 'bar',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Budget',
              data: [],
              backgroundColor: 'rgba(100,116,139,.25)',
              borderColor: 'rgba(100,116,139,.5)',
              borderWidth: 1,
              borderRadius: 4,
            },
            {
              label: 'Actual',
              data: [],
              backgroundColor: [],
              borderWidth: 0,
              borderRadius: 4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'rect', padding: 16 } },
            tooltip: {
              callbacks: { label: currencyTooltipCallback },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: currencyAxisCallback },
              grid: { color: 'rgba(0,0,0,.05)' },
            },
            x: { grid: { display: false } },
          },
        },
      }
    );

    // ── Year-over-Year Comparison ──
    const yoyCanvas = document.getElementById('chart-yoy');
    if (yoyCanvas) {
      CHART_INSTANCES.yoy = new Chart(
        yoyCanvas.getContext('2d'),
        {
          type: 'line',
          data: { labels: [], datasets: [] },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16 } },
              tooltip: {
                callbacks: { label: currencyTooltipCallback },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { callback: currencyAxisCallback },
                grid: { color: 'rgba(0,0,0,.05)' },
              },
              x: { grid: { display: false } },
            },
          },
        }
      );
    }

    // ── Spending Heatmap ──
    const heatmapCanvas = document.getElementById('chart-heatmap');
    if (heatmapCanvas) {
      CHART_INSTANCES.heatmap = new Chart(
        heatmapCanvas.getContext('2d'),
        {
          type: 'bar',
          data: {
            labels: [],
            datasets: [{
              label: 'Daily Spending',
              data: [],
              backgroundColor: [],
              borderWidth: 0,
              borderRadius: 4,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: { label: currencyTooltipCallback },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { callback: currencyAxisCallback },
                grid: { color: 'rgba(0,0,0,.05)' },
              },
              x: { grid: { display: false } },
            },
          },
        }
      );
    }

    // ── Cash Flow Forecast ──
    const forecastCanvas = document.getElementById('chart-forecast');
    if (forecastCanvas) {
      CHART_INSTANCES.forecast = new Chart(
        forecastCanvas.getContext('2d'),
        {
          type: 'bar',
          data: {
            labels: [],
            datasets: [
              {
                label: 'Projected Income',
                data: [],
                backgroundColor: 'rgba(34,197,94,.65)',
                borderColor: '#22c55e',
                borderWidth: 1,
                borderRadius: 4,
              },
              {
                label: 'Projected Expenses',
                data: [],
                backgroundColor: 'rgba(239,68,68,.65)',
                borderColor: '#ef4444',
                borderWidth: 1,
                borderRadius: 4,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'rect', padding: 16 } },
              tooltip: {
                callbacks: { label: currencyTooltipCallback },
              },
            },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { callback: currencyAxisCallback },
                grid: { color: 'rgba(0,0,0,.05)' },
              },
              x: { grid: { display: false } },
            },
          },
        }
      );
    }

    // ── Monthly Trend Line ──
    CHART_INSTANCES.line = new Chart(
      document.getElementById('chart-trend-line').getContext('2d'),
      {
        type: 'line',
        data: {
          labels: [],
          datasets: [
            {
              label: 'Income',
              data: [],
              borderColor: '#22c55e',
              backgroundColor: 'rgba(34,197,94,.08)',
              borderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: true,
              tension: 0.35,
            },
            {
              label: 'Expenses',
              data: [],
              borderColor: '#ef4444',
              backgroundColor: 'rgba(239,68,68,.08)',
              borderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              fill: true,
              tension: 0.35,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', padding: 16 } },
            tooltip: {
              callbacks: { label: currencyTooltipCallback },
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { callback: currencyAxisCallback },
              grid: { color: 'rgba(0,0,0,.05)' },
            },
            x: { grid: { display: false } },
          },
        },
      }
    );
  }

  /* ═══════════════════════════════════════════════
     UPDATE FUNCTIONS
  ═══════════════════════════════════════════════ */

  // Refreshes the category doughnut with the current month's expense breakdown.
  function updateCategoryPieChart(monthKey) {
    const chart = CHART_INSTANCES.pie;
    if (!chart) return;

    const data = Transactions.summarizeByCategory(monthKey);
    chart.data.labels = data.map(d => d.categoryName);
    chart.data.datasets[0].data = data.map(d => d.totalSpent);
    chart.data.datasets[0].backgroundColor = data.map(d => d.color);
    chart.update();
  }

  // Updates the budget-vs-actual bar chart. Only categories with a
  // monthly budget appear. Bars that exceed the budget are coloured red.
  function updateBudgetBarChart(monthKey) {
    const chart = CHART_INSTANCES.bar;
    if (!chart) return;

    const data = Transactions.summarizeByCategory(monthKey).filter(c => c.budget !== null);

    if (data.length === 0) {
      chart.data.labels = ['No budgeted categories'];
      chart.data.datasets[0].data = [0];
      chart.data.datasets[1].data = [0];
      chart.data.datasets[1].backgroundColor = ['#6C63FF'];
      chart.update();
      return;
    }

    chart.data.labels = data.map(d => d.categoryName);
    chart.data.datasets[0].data = data.map(d => d.budget);
    chart.data.datasets[1].data = data.map(d => d.totalSpent);
    chart.data.datasets[1].backgroundColor = data.map(d =>
      d.budget && d.totalSpent > d.budget ? '#ef4444' : '#6C63FF'
    );
    chart.update();
  }

  // Redraws the income-vs-expenses trend line for the last N months.
  function updateTrendLineChart(numMonths) {
    const chart = CHART_INSTANCES.line;
    if (!chart) return;

    const trend = Transactions.getMonthlyTrend(numMonths || 6);
    chart.data.labels = trend.map(t => t.label);
    chart.data.datasets[0].data = trend.map(t => t.income);
    chart.data.datasets[1].data = trend.map(t => t.expenses);
    chart.update();
  }

  // Populates the year-over-year comparison chart. Hides the chart
  // card entirely when fewer than two calendar years of data exist.
  function updateYoYChart() {
    const chart = CHART_INSTANCES.yoy;
    const card = document.getElementById('yoy-chart-card');
    if (!chart || !card) return;

    const yoyData = Transactions.getYearOverYearData();
    if (yoyData.years.length < 2) {
      card.style.display = 'none';
      return;
    }

    card.style.display = '';
    chart.data.labels = yoyData.monthLabels;
    chart.data.datasets = yoyData.datasets;
    chart.update();
  }

  // Renders a per-day spending heatmap for the selected month.
  // Bar opacity scales linearly with the day's spend relative to the max.
  function updateHeatmapChart(monthKey) {
    const chart = CHART_INSTANCES.heatmap;
    if (!chart) return;

    const data = Transactions.getSpendingHeatmap(monthKey);
    const amounts = data.map(d => d.amount);
    const maxVal = Math.max(...amounts, 1);

    const colors = amounts.map(val => {
      if (val === 0) return 'rgba(108,99,255,0.05)';
      const intensity = 0.15 + (val / maxVal) * 0.85;
      return `rgba(108,99,255,${intensity.toFixed(2)})`;
    });

    chart.data.labels = data.map(d => d.day);
    chart.data.datasets[0].data = amounts;
    chart.data.datasets[0].backgroundColor = colors;
    chart.update();

    const monthLabel = document.getElementById('heatmap-month-label');
    if (monthLabel) {
      const [y, m] = monthKey.split('-');
      const dt = new Date(Number(y), Number(m) - 1);
      monthLabel.textContent = dt.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
  }

  // Draws the 3-month cash-flow forecast. Hides the card when there
  // is no data to project (e.g. no recurring templates or history).
  function updateForecastChart() {
    const chart = CHART_INSTANCES.forecast;
    const card = document.getElementById('forecast-card');
    if (!chart) return;

    const data = Transactions.getCashFlowForecast(3);

    if (!data || data.length === 0) {
      if (card) card.style.display = 'none';
      return;
    }

    if (card) card.style.display = '';
    chart.data.labels = data.map(d => d.label);
    chart.data.datasets[0].data = data.map(d => d.projectedIncome);
    chart.data.datasets[1].data = data.map(d => d.projectedExpenses);
    chart.update();
  }

  // Convenience method called by Dashboard.renderDashboard() to
  // refresh every chart in a single call.
  function updateAllCharts(monthKey) {
    updateCategoryPieChart(monthKey);
    updateBudgetBarChart(monthKey);
    updateTrendLineChart(6);
    updateYoYChart();
    updateHeatmapChart(monthKey);
    updateForecastChart();
  }

  /* ═══════════════════════════════════════════════
     PUBLIC API
  ═══════════════════════════════════════════════ */

  return {
    initCharts,
    updateAllCharts,
    updateCategoryPieChart,
    updateBudgetBarChart,
    updateTrendLineChart,
    updateYoYChart,
    updateHeatmapChart,
    updateForecastChart,
  };
})();
