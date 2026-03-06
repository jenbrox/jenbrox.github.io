/* ===================================================
   JENTRAX — TRANSACTIONS
   CRUD operations and analytical queries.
   Depends on: Utils, Store
   =================================================== */

'use strict';

const Transactions = (() => {

  /* ── CRUD ── */
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

  function deleteTransaction(id) {
    const all = Store.getTransactions();
    const filtered = all.filter(t => t.id !== id);
    if (filtered.length === all.length) return false;
    Store.saveTransactions(filtered);
    return true;
  }

  function getTransactionById(id) {
    return Store.getTransactions().find(t => t.id === id) || null;
  }

  /* ── Tag Parsing ── */
  function parseTags(input) {
    if (Array.isArray(input)) return input;
    if (!input || typeof input !== 'string') return [];
    return input.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
  }

  /* ── Validation ── */
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
  function getTransactionsForMonth(monthKey) {
    return Store.getTransactions()
      .filter(t => Utils.getMonthKey(t.date) === monthKey)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  function getFilteredTransactions(monthKey, typeFilter, categoryFilter) {
    return getTransactionsForMonth(monthKey).filter(t => {
      if (typeFilter && typeFilter !== 'all' && t.type !== typeFilter) return false;
      if (categoryFilter && categoryFilter !== 'all' && t.categoryId !== categoryFilter) return false;
      return true;
    });
  }

  /* ── Aggregations ── */
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

  function getMonthlyTrend(numMonths = 6) {
    const monthKeys = Utils.lastNMonthKeys(numMonths);
    return monthKeys.map(key => {
      const { income, expenses } = summarizeMonth(key);
      return { monthKey: key, label: Utils.monthLabel(key), income, expenses };
    });
  }

  /* ── Year-over-Year Data ── */
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
  };
})();
