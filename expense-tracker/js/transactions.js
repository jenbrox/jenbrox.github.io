/* ===================================================
   JENTRAK — TRANSACTIONS

   CRUD operations for income and expense records, along
   with analytical queries used by the dashboard and charts.

   Handles validation, tag parsing, month-based filtering,
   category aggregation, trend analysis, cash-flow forecasting,
   spending heatmaps, and duplicate detection.

   Depends on: Utils, Store
   =================================================== */

'use strict';

const Transactions = (() => {

  /* ── CRUD ── */

  // Creates a new transaction after validating all required fields.
  // Returns { success, transaction } on success or { success, errors } on failure.
  function addTransaction(fields) {
    const { valid, errors } = validateFields(fields);
    if (!valid) return { success: false, errors };

    const now = new Date().toISOString();
    const txn = {
      id:          Utils.generateId('txn'),
      type:        fields.type,
      amount:      parseFloat(fields.amount),
      categoryId:  fields.categoryId,
      date:        fields.date,
      description: (fields.description || '').trim(),
      tags:        parseTags(fields.tags),
      createdAt:   now,
      updatedAt:   now,
    };

    const all = Store.getTransactions();
    all.push(txn);
    Store.saveTransactions(all);
    return { success: true, transaction: txn };
  }

  // Updates an existing transaction by ID. Merges new field values while
  // preserving the original creation timestamp. Returns the updated record.
  function updateTransaction(id, fields) {
    const all = Store.getTransactions();
    const idx = all.findIndex(t => t.id === id);
    if (idx === -1) return { success: false, errors: ['Transaction not found.'] };

    const { valid, errors } = validateFields(fields);
    if (!valid) return { success: false, errors };

    all[idx] = {
      ...all[idx],
      type:        fields.type,
      amount:      parseFloat(fields.amount),
      categoryId:  fields.categoryId,
      date:        fields.date,
      description: (fields.description || '').trim(),
      tags:        parseTags(fields.tags),
      updatedAt:   new Date().toISOString(),
    };

    Store.saveTransactions(all);
    return { success: true, transaction: all[idx] };
  }

  // Removes a transaction by ID. Returns true if a record was deleted.
  function deleteTransaction(id) {
    const all = Store.getTransactions();
    const filtered = all.filter(t => t.id !== id);
    if (filtered.length === all.length) return false;
    Store.saveTransactions(filtered);
    return true;
  }

  // Looks up a single transaction by its unique ID.
  function getTransactionById(id) {
    return Store.getTransactions().find(t => t.id === id) || null;
  }

  /* ── Tag Parsing ── */

  // Normalises a tag value into a lowercase trimmed array.
  // Accepts a comma-separated string or an existing array.
  function parseTags(input) {
    if (Array.isArray(input)) return input;
    if (!input || typeof input !== 'string') return [];
    return input.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  }

  /* ── Validation ── */

  // Checks that type is income/expense, amount is positive,
  // a category is selected, and the date is a valid ISO string.
  function validateFields(fields) {
    const errors = [];
    if (!fields.type || !['income', 'expense'].includes(fields.type)) {
      errors.push('Type must be income or expense.');
    }
    if (!Utils.isPositiveNumber(fields.amount)) {
      errors.push('Amount must be a positive number.');
    }
    if (!fields.categoryId) {
      errors.push('Category is required.');
    }
    if (!Utils.isValidDate(fields.date)) {
      errors.push('Date is required and must be valid.');
    }
    return { valid: errors.length === 0, errors };
  }

  /* ── Queries ── */

  // Returns all transactions whose date falls within the given month,
  // sorted newest-first by date string comparison.
  function getTransactionsForMonth(monthKey) {
    return Store.getTransactions()
      .filter(t => Utils.getMonthKey(t.date) === monthKey)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  // Narrows the month's transactions by an optional type ('income'/'expense')
  // and/or category ID. Pass 'all' or falsy to skip a filter.
  function getFilteredTransactions(monthKey, typeFilter, categoryFilter) {
    return getTransactionsForMonth(monthKey).filter(t => {
      if (typeFilter && typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter && categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
      return true;
    });
  }

  /* ── Aggregations ── */

  // Totals income and expenses for a single month, returning
  // { income, expenses, net, incomeCount, expenseCount }.
  function summarizeMonth(monthKey) {
    const txns = getTransactionsForMonth(monthKey);
    let income = 0, expenses = 0, incomeCount = 0, expenseCount = 0;
    for (const t of txns) {
      if (t.type === 'income') {
        income += t.amount;
        incomeCount++;
      } else {
        expenses += t.amount;
        expenseCount++;
      }
    }
    return { income, expenses, net: income - expenses, incomeCount, expenseCount };
  }

  // Groups expense transactions by category for the given month.
  // Each entry includes totalSpent, the category's budget, and the
  // percentage of budget consumed. Sorted by spend descending.
  function summarizeByCategory(monthKey) {
    const txns = getTransactionsForMonth(monthKey).filter(t => t.type === 'expense');
    const categories = Store.getCategories();
    const catMap = {};
    for (const c of categories) catMap[c.id] = c;

    const grouped = {};
    for (const t of txns) {
      if (!grouped[t.categoryId]) {
        const cat = catMap[t.categoryId];
        grouped[t.categoryId] = {
          categoryId:   t.categoryId,
          categoryName: cat ? cat.name : 'Uncategorized',
          color:        cat ? cat.color : '#94a3b8',
          totalSpent:   0,
          budget:       cat ? cat.monthlyBudget : null,
        };
      }
      grouped[t.categoryId].totalSpent += t.amount;
    }

    return Object.values(grouped).map(g => ({
      ...g,
      percentUsed: g.budget ? (g.totalSpent / g.budget) * 100 : null,
    })).sort((a, b) => b.totalSpent - a.totalSpent);
  }

  // Builds an array of { monthKey, label, income, expenses } objects
  // for the last N months, used by the trend line chart.
  function getMonthlyTrend(numMonths = 6) {
    const monthKeys = Utils.lastNMonthKeys(numMonths);
    return monthKeys.map(key => {
      const { income, expenses } = summarizeMonth(key);
      return { monthKey: key, label: Utils.monthLabel(key), income, expenses };
    });
  }

  /* ── Year-over-Year Data ── */

  // Compares monthly expense totals across calendar years.
  // Returns Chart.js-ready datasets only when two or more years of
  // data exist; otherwise returns empty arrays.
  function getYearOverYearData() {
    const txns = Store.getTransactions().filter(t => t.type === 'expense');
    if (txns.length === 0) return { years: [], monthLabels: [], datasets: [] };

    const byYearMonth = {};
    const yearsSet = new Set();

    for (const t of txns) {
      const [y, m] = t.date.split('-');
      yearsSet.add(y);
      const key = `${y}-${m}`;
      byYearMonth[key] = (byYearMonth[key] || 0) + t.amount;
    }

    const years = [...yearsSet].sort();
    if (years.length < 2) return { years: [], monthLabels: [], datasets: [] };

    const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const colors = ['#6C63FF','#22c55e','#f59e0b','#ec4899','#3b82f6','#ef4444','#14b8a6','#8b5cf6'];

    const datasets = years.map((year, i) => {
      const data = [];
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, '0')}`;
        data.push(byYearMonth[key] || 0);
      }
      return {
        label: year,
        data,
        borderColor: colors[i % colors.length],
        backgroundColor: colors[i % colors.length] + '18',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: false,
        tension: 0.3,
      };
    });

    return { years, monthLabels, datasets };
  }

  /* ── Top Spending Insights ── */

  // Generates an array of insight cards for the dashboard:
  //   1. Largest single expense
  //   2. Highest-spend category
  //   3. Average daily spending
  //   4. Transaction count breakdown
  //   5. Month-over-month change (only when prior month data exists)
  function getInsights(monthKey) {
    const txns = Store.getTransactions();
    const monthTxns = txns.filter(t => Utils.getMonthKey(t.date) === monthKey);
    const expenses = monthTxns.filter(t => t.type === 'expense');
    const categories = Store.getCategories();
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c; });

    const insights = [];

    if (expenses.length === 0) return insights;

    // 1. Highest single expense
    const maxExpense = expenses.reduce((a, b) => a.amount > b.amount ? a : b);
    const maxCat = catMap[maxExpense.categoryId];
    insights.push({
      icon: 'arrow-up',
      label: 'Largest Expense',
      value: maxExpense.amount,
      detail: maxExpense.description || (maxCat ? maxCat.name : 'Unknown'),
      color: '#ef4444',
    });

    // 2. Most spent category
    const catTotals = {};
    for (const t of expenses) {
      catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
    }
    const topCatId = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
    if (topCatId) {
      const cat = catMap[topCatId[0]];
      insights.push({
        icon: 'crown',
        label: 'Top Category',
        value: topCatId[1],
        detail: cat ? cat.name : 'Unknown',
        color: cat ? cat.color : '#6C63FF',
      });
    }

    // 3. Average daily spending
    const daysInMonth = new Date(
      parseInt(monthKey.split('-')[0]),
      parseInt(monthKey.split('-')[1]),
      0
    ).getDate();
    const totalExpenses = expenses.reduce((s, t) => s + t.amount, 0);
    const avgDaily = totalExpenses / daysInMonth;
    insights.push({
      icon: 'calendar',
      label: 'Avg Daily Spend',
      value: avgDaily,
      detail: `${daysInMonth} days in month`,
      color: '#f59e0b',
    });

    // 4. Transaction count
    insights.push({
      icon: 'hash',
      label: 'Total Transactions',
      value: monthTxns.length,
      detail: `${expenses.length} expenses, ${monthTxns.length - expenses.length} income`,
      color: '#6C63FF',
      isCount: true,
    });

    // 5. Month-over-month change
    const prevMonth = Utils.offsetMonth(monthKey, -1);
    const prevExpenses = txns.filter(t => Utils.getMonthKey(t.date) === prevMonth && t.type === 'expense');
    const prevTotal = prevExpenses.reduce((s, t) => s + t.amount, 0);
    if (prevTotal > 0) {
      const change = ((totalExpenses - prevTotal) / prevTotal) * 100;
      insights.push({
        icon: change >= 0 ? 'trending-up' : 'trending-down',
        label: 'vs Last Month',
        value: Math.abs(change),
        detail: `${change >= 0 ? 'More' : 'Less'} than ${Utils.monthLabel(prevMonth)}`,
        color: change >= 0 ? '#ef4444' : '#22c55e',
        isPercent: true,
        isNegative: change < 0,
      });
    }

    return insights;
  }

  // Returns all categories referenced by at least one transaction
  function getCategoriesInUse() {
    const txns = Store.getTransactions();
    return [...new Set(txns.map(t => t.categoryId))];
  }

  // Reassign all transactions from one categoryId to another
  function reassignCategory(fromId, toId) {
    const all = Store.getTransactions().map(t =>
      t.categoryId === fromId ? { ...t, categoryId: toId, updatedAt: new Date().toISOString() } : t
    );
    Store.saveTransactions(all);
  }

  /* ── Duplicate Detection ── */

  // Searches for existing transactions that match the same amount,
  // date, category, and type. Useful for warning users before saving
  // what may be an accidental duplicate entry.
  function findDuplicates(fields) {
    const all = Store.getTransactions();
    const amount = parseFloat(fields.amount);
    const date = fields.date;
    const catId = fields.categoryId;
    return all.filter(t =>
      t.amount === amount &&
      t.date === date &&
      t.categoryId === catId &&
      t.type === fields.type
    );
  }

  /* ── Cash Flow Forecast ── */

  // Projects income and expenses for the next N months by combining
  // active recurring templates with a rolling 3-month average of
  // historical spending. Used by the forecast bar chart.
  function getCashFlowForecast(months = 3) {
    const recurring = typeof Recurring !== 'undefined' ? Recurring.getAllRecurring().filter(r => r.isActive) : [];
    const currentMonth = Utils.getCurrentMonthKey();
    const forecast = [];

    for (let i = 1; i <= months; i++) {
      const monthKey = Utils.offsetMonth(currentMonth, i);
      let projectedIncome = 0, projectedExpenses = 0;

      for (const r of recurring) {
        if (r.type === 'income') projectedIncome += r.amount;
        else projectedExpenses += r.amount;
      }

      // Add average of last 3 months non-recurring spending
      const pastMonths = [];
      for (let j = 1; j <= 3; j++) {
        const pk = Utils.offsetMonth(currentMonth, -j);
        pastMonths.push(summarizeMonth(pk));
      }
      if (pastMonths.length > 0) {
        const avgExpenses = pastMonths.reduce((s, m) => s + m.expenses, 0) / pastMonths.length;
        const avgIncome = pastMonths.reduce((s, m) => s + m.income, 0) / pastMonths.length;
        const recurringExpenseTotal = recurring.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
        const recurringIncomeTotal = recurring.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
        projectedExpenses = Math.max(projectedExpenses, avgExpenses);
        projectedIncome = Math.max(projectedIncome, avgIncome);
      }

      forecast.push({
        monthKey,
        label: Utils.monthLabel(monthKey),
        projectedIncome,
        projectedExpenses,
        projectedNet: projectedIncome - projectedExpenses,
      });
    }
    return forecast;
  }

  /* ── Spending Heatmap Data ── */

  // Returns one { day, amount } entry per calendar day of the month.
  // Days with no expenses report amount 0. Feeds the heatmap bar chart.
  function getSpendingHeatmap(monthKey) {
    const txns = getTransactionsForMonth(monthKey).filter(t => t.type === 'expense');
    const dayMap = {};
    for (const t of txns) {
      const day = parseInt(t.date.split('-')[2], 10);
      dayMap[day] = (dayMap[day] || 0) + t.amount;
    }
    const [y, m] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const data = [];
    for (let d = 1; d <= daysInMonth; d++) {
      data.push({ day: d, amount: dayMap[d] || 0 });
    }
    return data;
  }

  /* ── Advanced Analytics ── */

  // Counts consecutive days with zero expenses in the given month.
  // currentStreak counts backwards from today (or last day if past month).
  // longestStreak is the longest such run found anywhere in the month.
  function getSpendingStreak(monthKey) {
    const txns = getTransactionsForMonth(monthKey).filter(t => t.type === 'expense');
    const daySet = new Set();
    for (const t of txns) {
      const day = parseInt(t.date.split('-')[2], 10);
      daySet.add(day);
    }

    const [y, m] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    // Determine the starting day for the current streak
    const today = new Date();
    const currentMonthKey = Utils.getCurrentMonthKey();
    let startDay;
    if (monthKey === currentMonthKey) {
      startDay = today.getDate();
    } else {
      startDay = daysInMonth;
    }

    // Current streak: consecutive zero-expense days going backwards from startDay
    let currentStreak = 0;
    for (let d = startDay; d >= 1; d--) {
      if (!daySet.has(d)) {
        currentStreak++;
      } else {
        break;
      }
    }

    // Longest streak: scan entire month for longest run of zero-expense days
    let longestStreak = 0;
    let run = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (!daySet.has(d)) {
        run++;
        if (run > longestStreak) longestStreak = run;
      } else {
        run = 0;
      }
    }

    return { currentStreak, longestStreak };
  }

  // Returns spending in a single category over the last N months.
  // Each entry has { label, amount } suitable for a mini trend chart.
  function getCategoryTrend(categoryId, numMonths = 6) {
    const currentMonth = Utils.getCurrentMonthKey();
    const results = [];
    for (let i = numMonths - 1; i >= 0; i--) {
      const mk = Utils.offsetMonth(currentMonth, -i);
      const txns = getTransactionsForMonth(mk).filter(
        t => t.type === 'expense' && t.categoryId === categoryId
      );
      const amount = txns.reduce((s, t) => s + t.amount, 0);
      results.push({ label: Utils.monthLabel(mk), amount });
    }
    return results;
  }

  // Splits a month into weekly buckets (days 1-7 = Week 1, 8-14 = Week 2, etc.)
  // and totals income and expenses per bucket.
  function getWeeklyBreakdown(monthKey) {
    const txns = getTransactionsForMonth(monthKey);
    const [y, m] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const numWeeks = Math.ceil(daysInMonth / 7);

    const weeks = [];
    for (let w = 0; w < numWeeks; w++) {
      weeks.push({ week: `Week ${w + 1}`, income: 0, expenses: 0 });
    }

    for (const t of txns) {
      const day = parseInt(t.date.split('-')[2], 10);
      const weekIdx = Math.floor((day - 1) / 7);
      if (t.type === 'income') {
        weeks[weekIdx].income += t.amount;
      } else {
        weeks[weekIdx].expenses += t.amount;
      }
    }

    return weeks;
  }

  // Returns the top N transaction descriptions by total amount spent.
  // Aggregates across all expense transactions in the month, skipping empty descriptions.
  function getTopDescriptions(monthKey, limit = 5) {
    const txns = getTransactionsForMonth(monthKey).filter(
      t => t.type === 'expense' && t.description && t.description.trim() !== ''
    );

    const descMap = {};
    for (const t of txns) {
      const desc = t.description.trim();
      if (!descMap[desc]) {
        descMap[desc] = { description: desc, count: 0, total: 0 };
      }
      descMap[desc].count++;
      descMap[desc].total += t.amount;
    }

    return Object.values(descMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  // Projects total month-end spending based on current daily rate.
  // Compares the projection against the total budget to flag onTrack.
  function getBudgetPace(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();

    const today = new Date();
    const currentMonthKey = Utils.getCurrentMonthKey();
    let daysElapsed;
    if (monthKey === currentMonthKey) {
      daysElapsed = today.getDate();
    } else {
      daysElapsed = daysInMonth;
    }

    const txns = getTransactionsForMonth(monthKey).filter(t => t.type === 'expense');
    const totalSpent = txns.reduce((s, t) => s + t.amount, 0);
    const dailyRate = daysElapsed > 0 ? totalSpent / daysElapsed : 0;
    const projected = dailyRate * daysInMonth;

    // Sum all category budgets to get total budget
    const categories = Store.getCategories();
    const totalBudget = categories.reduce((s, c) => s + (c.monthlyBudget || 0), 0);
    const onTrack = totalBudget > 0 ? projected <= totalBudget : true;

    return { dailyRate, projected, daysElapsed, daysInMonth, onTrack };
  }

  // Searches across ALL transactions for matching description, tags, or category name.
  // Returns matching transactions sorted by date descending. Case-insensitive.
  function searchAllMonths({ query, limit = 50 } = {}) {
    if (!query || typeof query !== 'string' || query.trim() === '') return [];
    const q = query.trim().toLowerCase();

    const categories = Store.getCategories();
    const catMap = {};
    for (const c of categories) catMap[c.id] = c;

    const all = Store.getTransactions();
    const matches = all.filter(t => {
      // Match description
      if (t.description && t.description.toLowerCase().includes(q)) return true;
      // Match tags
      if (t.tags && t.tags.some(tag => tag.toLowerCase().includes(q))) return true;
      // Match category name
      const cat = catMap[t.categoryId];
      if (cat && cat.name.toLowerCase().includes(q)) return true;
      return false;
    });

    return matches
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  /* ── Public API ── */
  return {
    addTransaction,
    updateTransaction,
    deleteTransaction,
    getTransactionById,
    getTransactionsForMonth,
    getFilteredTransactions,
    summarizeMonth,
    summarizeByCategory,
    getMonthlyTrend,
    getYearOverYearData,
    getInsights,
    getCategoriesInUse,
    reassignCategory,
    findDuplicates,
    getCashFlowForecast,
    getSpendingHeatmap,
    getSpendingStreak,
    getCategoryTrend,
    getWeeklyBreakdown,
    getTopDescriptions,
    getBudgetPace,
    searchAllMonths,
  };
})();
