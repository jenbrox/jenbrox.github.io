/* ===================================================
   JENTRAX — CHARTS
   Manages all Chart.js instances.
   Create once in initCharts(), update only thereafter.
   Depends on: Utils, Store, Transactions (global Chart)
   =================================================== */

'use strict';

const Charts = (() => {

  const CHART_INSTANCES = {};

  /* ═══════════════════════════════════════════════
     SHARED HELPERS
  ═══════════════════════════════════════════════ */

  function currencyTooltipCallback(context) {
    const settings = Store.getSettings();
    const label = context.dataset.label || '';
    const value = Utils.formatCurrency(context.parsed.y ?? context.parsed, settings);
    return label ? `${label}: ${value}` : value;
  }

  function currencyAxisCallback(value) {
    const settings = Store.getSettings();
    return Utils.formatCurrency(value, settings);
  }

  /* ═══════════════════════════════════════════════
     CENTER-TEXT PLUGIN  (doughnut empty state)
  ═══════════════════════════════════════════════ */

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

  function updateCategoryPieChart(monthKey) {
    const chart = CHART_INSTANCES.pie;
    if (!chart) return;

    const data = Transactions.summarizeByCategory(monthKey);
    chart.data.labels = data.map(d => d.categoryName);
    chart.data.datasets[0].data = data.map(d => d.totalSpent);
    chart.data.datasets[0].backgroundColor = data.map(d => d.color);
    chart.update();
  }

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

  function updateTrendLineChart(numMonths) {
    const chart = CHART_INSTANCES.line;
    if (!chart) return;

    const trend = Transactions.getMonthlyTrend(numMonths || 6);
    chart.data.labels = trend.map(t => t.label);
    chart.data.datasets[0].data = trend.map(t => t.income);
    chart.data.datasets[1].data = trend.map(t => t.expenses);
    chart.update();
  }

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

  function updateAllCharts(monthKey) {
    updateCategoryPieChart(monthKey);
    updateBudgetBarChart(monthKey);
    updateTrendLineChart(6);
    updateYoYChart();
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
  };
})();
