# JavaScript Modules Architecture

Comprehensive guide to the 14 JavaScript modules that power Jentrak's frontend.

---

## Overview

All modules use the Revealing Module Pattern (IIFE + return public API). This provides:
- Encapsulation (private functions not exposed)
- Clean public API
- No external dependencies (except Chart.js CDN)
- Minimal code size

Global Scope: Each module is a global const object:
```javascript
const Utils = (() => { /* ... */ })();  // Available as window.Utils
const Store = (() => { /* ... */ })();  // Available as window.Store
// etc.
```

---

## Module Dependency Graph

```
┌─ Utils (pure utilities, no dependencies)
│
├─ Auth (depends on Utils)
│
└─ Store (depends on Utils, Auth, and all data modules)
    ├─ Transactions (depends on Utils)
    ├─ Categories (depends on Utils, Transactions)
    ├─ Recurring (depends on Utils, Transactions)
    ├─ Goals (depends on Utils)
    ├─ Debts (depends on Utils)
    ├─ Wishlist (depends on Utils)
    └─ Accounts (depends on Utils)

Dashboard (depends on Utils, Transactions)
UI (depends on all of the above)
Charts (depends on Utils, Transactions)
App (orchestrates everything)
```

Golden Rule: A module can only depend on modules listed above it in the dependency graph. This prevents circular dependencies.

---

## Module Details

### 1. `utils.js` (Pure Utilities)

Purpose: Date/number/string formatting, ID generation, validation.
Dependencies: None
Size: ~5 KB

Key Functions:
- `generateId(prefix)` - Create unique IDs: `txn_1709892345000_a3b2`
- `formatCurrency(amount, settings)` - Format as currency with symbol
- `formatDate(isoDate, format)` - Convert YYYY-MM-DD to other formats
- `getMonthKey(isoDate)` - Extract YYYY-MM from ISO date
- `getCurrentMonthKey()` - Get current month as YYYY-MM
- `lastNMonthKeys(n)` - Array of last N months
- `todayISO()` - Today as YYYY-MM-DD
- `isPositiveNumber(val)` - Validate positive numbers
- `isValidDate(str)` - Validate ISO date format
- `debounce(fn, ms)` - Debounce function execution

Usage:
```javascript
const id = Utils.generateId('txn');     // txn_1709892345000_a3b2
const formatted = Utils.formatCurrency(123.45, {currencySymbol: '$'});  // $123.45
const date = Utils.formatDate('2026-03-15', 'MM/DD/YYYY');  // 03/15/2026
```

---

### 2. `auth.js` (Authentication)

Purpose: JWT token management, API calls, logout flow.
Dependencies: Utils
Size: ~4 KB

Key Functions:
- `getToken()` - Retrieve JWT from localStorage
- `getUser()` - Retrieve user profile from localStorage
- `isLoggedIn()` - Check if user is authenticated
- `logout()` - Clear token and redirect to login
- `requireAuth()` - Enforce authentication (redirect if not logged in)
- `authHeaders()` - Build headers with Bearer token
- `loadAllData()` - Fetch all user data from server
- `saveStore(storeName, data)` - Sync single store to server
- `saveAllStores(stores)` - Bulk sync all stores to server
- `verifyToken()` - Validate token with server

Usage:
```javascript
if (!Auth.isLoggedIn()) {
  Auth.requireAuth();  // Redirects to login
}

fetch('/api/data', {
  headers: Auth.authHeaders()  // Includes Authorization: Bearer <token>
});
```

Token Flow:
1. Login → server returns JWT
2. Store in localStorage: `jentrak_token`
3. Include in all API requests: `Authorization: Bearer <token>`
4. Server validates token on each request
5. 401 response → logout() called

---

### 3. `store.js` (Data Persistence)

Purpose: Three-tier data storage with server sync.
Dependencies: Utils, Auth (+ all data modules)
Size: ~27 KB (largest module)

Three-Tier Architecture:
```
┌─────────────────────┐
│  In-Memory Cache    │  (instant reads/writes)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   IndexedDB (IDB)   │  (persistent, fast, offline-capable)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Server / SQLite    │  (reliable backup, multi-device sync)
└─────────────────────┘
```

Stores Managed:
- `transactions` - Income & expense records
- `categories` - Custom categories + budgets
- `settings` - User preferences
- `recurring` - Recurring transaction templates
- `goals` - Savings goals
- `debts` - Loan tracking
- `wishlist` - Shopping list
- `accounts` - Bank accounts + balances

Key Functions:
- `initStore()` - Initialize all data layers on app load
- `getTransactions()`, `getCategories()`, etc. - Get store data
- `saveTransactions()`, `saveCategories()`, etc. - Save to all layers
- `persist(storeName, data)` - Internal persist to all layers
- `seedDefaultData()` - Create default categories on first load
- `exportData(format)` - Export as JSON/CSV/Excel
- `importData(data)` - Restore from export

Data Flow:
```
User Action (Add Transaction)
    │
    ▼
Module Validation (Transactions.addTransaction)
    │
    ▼
In-Memory Update (instant)
    │
    ▼
Store.persist() Call
    │
    ├─► IndexedDB Write (async)
    │
    ├─► localStorage Write (sync fallback)
    │
    └─► Auth.saveStore() to Server (async, only if logged in)
```

---

### 4. `transactions.js` (Expense/Income CRUD)

Purpose: Create, read, update, delete transactions + analytics.
Dependencies: Utils, Store (via data getters)
Size: ~13 KB

Key Functions:
- `addTransaction(fields)` - Create transaction
- `updateTransaction(id, fields)` - Edit transaction
- `deleteTransaction(id)` - Remove transaction
- `getTransactionById(id)` - Fetch single transaction
- `getTransactionsByMonth(monthKey)` - Get month's transactions
- `summarizeMonth(monthKey)` - Income/expense/net totals
- `summarizeByCategory(monthKey)` - Spending by category
- `getInsights(monthKey)` - Generate insight text
- `reassignCategory(fromId, toId)` - Reassign transactions when deleting category

Transaction Object:
```javascript
{
  id: "txn_1709892345000_a3b2",
  type: "expense",              // or "income"
  amount: 45.50,
  categoryId: "cat_utilities",
  date: "2026-03-06",           // ISO format
  description: "Electric bill",
  tags: ["monthly", "utility"],
  createdAt: "2026-03-06T10:30:00Z",
  updatedAt: "2026-03-06T10:30:00Z"
}
```

Usage:
```javascript
Transactions.addTransaction({
  type: 'expense',
  amount: 50,
  categoryId: 'cat_food',
  date: Utils.todayISO(),
  description: 'Groceries'
});

const summary = Transactions.summarizeMonth('2026-03');
console.log(summary);
// { income: 3500, expenses: 1200, net: 2300, count: 45 }
```

---

### 5. `categories.js` (Categories & Budgets)

Purpose: Manage expense categories with optional monthly budgets.
Dependencies: Utils, Store, Transactions
Size: ~4 KB

Key Functions:
- `addCategory(fields)` - Create custom category
- `updateCategory(id, fields)` - Edit category
- `deleteCategory(id)` - Remove (reassigns transactions)
- `getCategoryById(id)` - Fetch single category
- `getAllCategories()` - Get all, sorted by name
- `getMonthlySpend(categoryId, monthKey)` - Spending for month
- `getPresetColors()` - Available color options

Category Object:
```javascript
{
  id: "cat_food",
  name: "Groceries",
  color: "#2ecc71",              // Hex color
  monthlyBudget: 500,            // Optional budget limit
  createdAt: "2026-01-15T10:30:00Z"
}
```

Built-in Default Categories (created on first use):
```javascript
Housing, Food, Transport, Utilities, Entertainment, Healthcare,
Insurance, Shopping, Dining, Subscriptions, Personal, Pets,
Gifts, Education, Savings, Miscellaneous
```

Usage:
```javascript
Categories.addCategory({
  name: 'Groceries',
  color: '#2ecc71',
  monthlyBudget: 500
});

const spent = Categories.getMonthlySpend('cat_food', '2026-03');
const budget = 500;
const percent = (spent / budget) * 100;  // Show progress bar
```

---

### 6. `recurring.js` (Recurring Transactions)

Purpose: Template-based recurring transaction auto-generation.
Dependencies: Utils, Store, Transactions
Size: ~5 KB

Key Functions:
- `addRecurring(fields)` - Create recurring template
- `updateRecurring(id, fields)` - Edit template
- `deleteRecurring(id)` - Remove template
- `processRecurring()` - Generate transactions for current month (called on app init)
- `getAllRecurring()` - Get all templates

Recurring Object:
```javascript
{
  id: "rec_salary",
  type: "income",                // or "expense"
  amount: 3500,
  categoryId: "cat_income",
  description: "Monthly salary",
  frequency: "monthly",          // or daily, weekly, bi-weekly, yearly
  dayOfMonth: 1,                 // 1-28 (avoids month-end issues)
  startDate: "2026-01-01",
  endDate: null,                 // Or "2026-12-31" for limited duration
  isActive: true,
  lastGenerated: "2026-03-01"    // Prevents duplicate generation
}
```

Frequency Options:
- `daily` - Every day
- `weekly` - Same day each week
- `bi-weekly` - Every 2 weeks
- `monthly` - Same day each month (clamped to 1-28)
- `yearly` - Same day each year

Auto-Generation Flow:
```
App Init
    │
    ▼
Recurring.processRecurring() Called
    │
    ├─ For each recurring template:
    │  ├─ Check if startDate has passed
    │  ├─ Check if endDate hasn't passed
    │  ├─ Check if already generated for current month (lastGenerated)
    │  └─ If all checks pass → create transaction for current month
    │
    ▼
Transactions Updated, UI Refreshes
```

---

### 7. `goals.js` (Savings Goals)

Purpose: Create and track savings goals.
Dependencies: Utils, Store
Size: ~4 KB

Key Functions:
- `addGoal(fields)` - Create savings goal
- `updateGoal(id, fields)` - Edit goal
- `deleteGoal(id)` - Remove goal
- `addToGoal(id, amount)` - Increment saved amount
- `getGoalById(id)` - Fetch single goal
- `getAllGoals()` - Get all (incomplete first, then completed, both sorted by name)

Goal Object:
```javascript
{
  id: "goal_vacation",
  name: "Vacation Fund",
  targetAmount: 2000,
  savedAmount: 750,              // Current progress
  deadline: "2026-07-01",        // Optional
  color: "#3498db",
  createdAt: "2026-01-15T10:30:00Z",
  updatedAt: "2026-03-06T10:30:00Z"
}
```

Usage:
```javascript
Goals.addGoal({
  name: 'Vacation',
  targetAmount: 2000,
  deadline: '2026-07-01',
  color: '#3498db'
});

Goals.addToGoal('goal_vacation', 100);  // Add $100 to goal
```

---

### 8. `debts.js` (Loan Tracking)

Purpose: Track money owed to and from you.
Dependencies: Utils, Store
Size: ~4 KB

Key Functions:
- `addDebt(fields)` - Record debt
- `updateDebt(id, fields)` - Edit debt
- `deleteDebt(id)` - Remove debt
- `settleDebt(id, amount)` - Record payment (partial or full)
- `getDebtById(id)` - Fetch single debt
- `getAllDebts()` - Get all (unsettled first, then settled)
- `getSummary()` - Net debt position

Debt Object:
```javascript
{
  id: "debt_bob",
  personName: "Bob",
  amount: 500,                   // Principal amount
  direction: "owed_to_me",       // or "i_owe"
  description: "Loan from 2025",
  dueDate: "2026-06-01",         // Optional
  settled: false,
  settledAmount: 0,              // Amount paid so far
  createdAt: "2026-01-15T10:30:00Z",
  updatedAt: "2026-03-06T10:30:00Z"
}
```

Usage:
```javascript
Debts.addDebt({
  personName: 'Alice',
  amount: 200,
  direction: 'i_owe',
  description: 'Birthday loan'
});

Debts.settleDebt('debt_alice', 100);  // Pay $100 toward debt

const summary = Debts.getSummary();
console.log(summary);
// { owedToMe: 500, iOwe: 200, net: 300 }
```

---

### 9. `wishlist.js` (Shopping List)

Purpose: Track items you want to buy with priorities and prices.
Dependencies: Utils, Store
Size: ~3 KB

Key Functions:
- `addItem(fields)` - Add item to wishlist
- `updateItem(id, fields)` - Edit item
- `deleteItem(id)` - Remove item
- `togglePurchased(id)` - Mark as bought or not bought
- `getItemById(id)` - Fetch single item
- `getAllItems()` - Get all (unpurchased first by priority, then purchased)
- `getTotalCost()` - Sum of unpurchased items with prices

Item Object:
```javascript
{
  id: "wish_laptop",
  name: "New Laptop",
  price: 1200,                   // Optional
  url: "https://amazon.com/...", // Optional product link
  notes: "17-inch, i7, 16GB RAM",
  priority: "high",              // high, medium, or low
  purchased: false,
  createdAt: "2026-01-15T10:30:00Z",
  updatedAt: "2026-03-06T10:30:00Z"
}
```

Usage:
```javascript
Wishlist.addItem({
  name: 'Gaming Monitor',
  price: 400,
  priority: 'high',
  url: 'https://amazon.com/...'
});

Wishlist.togglePurchased('wish_monitor');  // Mark as bought
```

---

### 10. `accounts.js` (Multi-Account Net Worth)

Purpose: Track multiple financial accounts and calculate net worth.
Dependencies: Utils, Store
Size: ~3 KB

Key Functions:
- `addAccount(fields)` - Create account
- `updateAccount(id, fields)` - Edit account
- `deleteAccount(id)` - Remove account
- `getAccountById(id)` - Fetch single account
- `getAllAccounts()` - Get all (sorted by name)
- `getNetWorth()` - Calculate assets, liabilities, net worth
- `adjustBalance(id, amount)` - Update balance
- `transfer(fromId, toId, amount)` - Move money between accounts

Account Object:
```javascript
{
  id: "acct_checking",
  name: "Checking Account",
  accountType: "checking",       // checking, savings, credit, cash, investment, other
  balance: 5000,
  color: "#3498db",
  isActive: true,
  createdAt: "2026-01-15T10:30:00Z",
  updatedAt: "2026-03-06T10:30:00Z"
}
```

Net Worth Calculation:
```
Assets = Checking + Savings + Cash + Investment + Other
Liabilities = Credit Account Balances
Net Worth = Assets - Liabilities
```

Usage:
```javascript
Accounts.addAccount({
  name: 'Checking',
  accountType: 'checking',
  balance: 5000
});

const worth = Accounts.getNetWorth();
console.log(worth);
// { assets: 15000, liabilities: 2000, netWorth: 13000 }

Accounts.transfer('acct_checking', 'acct_savings', 500);  // Move $500
```

---

### 11. `dashboard.js` (Dashboard Rendering)

Purpose: Compute dashboard metrics and manage dashboard rendering.
Dependencies: Utils, Transactions
Size: ~6 KB

Key Functions:
- `computeDashboardData(monthKey)` - Aggregate all stats for a month
- `renderDashboardCards(monthKey)` - Display summary cards (income, expenses, net, budget)
- `renderBudgetWarnings()` - Show alerts for categories at 80%+ budget
- `renderInsights()` - Display AI-generated insights

Dashboard Data:
```javascript
{
  monthKey: "2026-03",
  totalIncome: 3500,
  totalExpenses: 1200,
  netIncome: 2300,
  budgetRemaining: 1800,         // (if monthly budget is set)
  budgetUsed: 1200,
  budgetTotal: 3000,
  categorySpending: [
    { name: "Food", amount: 300, budget: 400, percent: 75 },
    /* ... */
  ],
  isOverBudget: false,
  highSpendingCategories: []     // Categories at 80%+ budget
}
```

Usage:
```javascript
const data = Dashboard.computeDashboardData('2026-03');
Dashboard.renderDashboardCards('2026-03');  // Show summary cards
Dashboard.renderInsights();                 // Show spending tips
```

---

### 12. `charts.js` (Chart.js Wrapper)

Purpose: Create and update interactive charts.
Dependencies: Utils, Transactions (+ Chart.js CDN)
Size: ~15 KB

Charts Managed:
1. Doughnut: Category spending breakdown
2. Bar: Budget vs actual by category
3. Line: 6-month spending trend

Key Functions:
- `initCharts()` - Create Chart instances on page load
- `updateAllCharts(monthKey)` - Refresh all chart data
- `getChartData(monthKey)` - Compute data for charts

Chart Features:
- Respects dark mode (reads CSS variables)
- Custom plugin shows "No data" on empty chart
- Responsive sizing
- Click-to-filter capability (future enhancement)

Usage:
```javascript
Charts.initCharts();  // Call once on page load
Charts.updateAllCharts('2026-03');  // Call when month changes
```

---

### 13. `ui.js` (DOM & Modals)

Purpose: All DOM manipulation, forms, modals, toasts, navigation.
Dependencies: Utils, Auth, All data modules (large cross-cutting module)
Size: ~63 KB (largest by lines of code)

Subsystems:
- Navigation: Hash-based routing between sections
- Forms: Input binding, validation feedback
- Modals: Dialog open/close/submit
- Toasts: Success/error notifications
- Lists: Render transaction lists, category lists, etc.
- Settings: User menu, dark mode toggle, logout
- Charts: Integration with Charts module

Key Functions:
- `init()` - Wire up event handlers
- `showModal(modalId)` - Open dialog
- `closeModal(modalId)` - Close dialog
- `showToast(message, type)` - Show notification (success/error)
- `showSection(sectionId)` - Navigate to section
- `populateForm(formId, data)` - Fill form with data
- `escapeHtml(str)` - XSS prevention
- `renderTransactionList()` - Display transactions
- `renderCategoryList()` - Display categories
- etc. (many more rendering functions)

Usage:
```javascript
UI.showToast('Transaction saved!', 'success');
UI.showModal('transactionModal');
UI.showSection('dashboard');
```

---

### 14. `app.js` (Orchestrator & Entry Point)

Purpose: Initialize all modules, wire event handlers, manage app lifecycle.
Dependencies: All other modules
Size: ~43 KB

Initialization Sequence (on `DOMContentLoaded`):
```
1. Store.initStore()           - Load data from localStorage → IndexedDB → server
2. Store.seedDefaultData()     - Create default categories if first use
3. Auth.verifyToken()          - Validate JWT with server
4. Charts.initCharts()         - Create Chart instances
5. Recurring.processRecurring()- Auto-generate monthly recurring transactions
6. UI.init()                   - Wire event handlers
7. Dashboard render            - Display initial dashboard
8. Service Worker register     - Enable offline support
```

Key Functions:
- `init()` - Run initialization sequence
- `setupXxxHandlers()` - Wire event listeners for each section
  - `setupTransactionHandlers()`
  - `setupCategoryHandlers()`
  - `setupDashboardHandlers()`
  - etc.
- `handleHashChange()` - Navigate between sections on URL hash change
- `setupUserMenu()` - Display user avatar, email, logout button

Hash-Based Routing:
```
#dashboard       → Dashboard view
#transactions    → Transactions CRUD
#categories      → Categories CRUD
#settings        → Settings
#goals           → Goals view
#debts           → Debts view
#wishlist        → Wishlist view
#accounts        → Accounts view
#recurring       → Recurring templates
```

---

## Data Flow Example: Adding a Transaction

Here's how data flows through the system when a user adds a transaction:

```
User clicks "Add Transaction"
        │
        ▼
UI.showModal('transactionModal')    (DOM: show form dialog)
        │
        ▼
User fills form + clicks Save
        │
        ▼
App event handler triggers
        │
        ▼
Transactions.addTransaction(fields) (Validation + ID generation)
        │
        ▼
Store saves to all three layers:
├─► In-memory cache (instant)
├─► IndexedDB (fast)
└─► Auth.saveStore() → Server (async)
        │
        ▼
Dashboard updates:
├─► Transactions.summarizeMonth()  (Recalculate totals)
├─► Charts.updateAllCharts()       (Refresh visualizations)
└─► UI.renderDashboardCards()      (Update summary cards)
        │
        ▼
UI.showToast('Transaction added!', 'success')
        │
        ▼
UI.closeModal()                     (DOM: hide form)
```

---

## Adding a New Feature: Step-by-Step

Example: Adding a "Tags" feature for transactions.

### Step 1: Choose Where Logic Lives
- Add to `Transactions` module (CRUD operations)
- Add to `Dashboard` module (if displaying tags)
- Add to `UI` module (form inputs, rendering)

### Step 2: Add Data Structure
```javascript
// In Transactions.addTransaction, include:
const transaction = {
  // ... existing fields ...
  tags: fields.tags ? fields.tags.split(',').map(t => t.trim()) : []
};
```

### Step 3: Add CRUD Functions
```javascript
// In Transactions module:
function filterByTag(tag, monthKey) {
  return Store.getTransactions()
    .filter(t => t.tags.includes(tag))
    .filter(t => Utils.getMonthKey(t.date) === monthKey);
}

function getAllTags() {
  const allTags = new Set();
  for (const t of Store.getTransactions()) {
    t.tags?.forEach(tag => allTags.add(tag));
  }
  return Array.from(allTags).sort();
}
```

### Step 4: Update UI
```javascript
// In UI module, add tag input to form:
const tagInput = document.querySelector('input[name="tags"]');
tagInput.value = transaction.tags?.join(', ') || '';

// Add tag rendering:
function renderTransactionWithTags(transaction) {
  const tags = transaction.tags?.map(tag =>
    `<span class="tag">${tag}</span>`
  ).join('');
  // ...
}
```

### Step 5: Wire Up Events
```javascript
// In app.js, add handler:
function setupTagHandlers() {
  const tagLinks = document.querySelectorAll('.tag');
  tagLinks.forEach(link => {
    link.addEventListener('click', e => {
      const tag = e.target.textContent;
      const filtered = Transactions.filterByTag(tag, currentMonth);
      UI.renderFilteredTransactions(filtered);
    });
  });
}
```

---

## Testing Modules

### Unit Testing Example
```javascript
// Test Transactions module
function testAddTransaction() {
  const before = Store.getTransactions().length;

  Transactions.addTransaction({
    type: 'expense',
    amount: 50,
    categoryId: 'cat_food',
    date: Utils.todayISO(),
    description: 'Test'
  });

  const after = Store.getTransactions().length;
  console.assert(after === before + 1, 'Transaction not added');
  console.log('✓ testAddTransaction passed');
}

// Run tests
testAddTransaction();
```

### Integration Testing
Test the full flow:
1. Initialize app
2. Add transaction
3. Verify in dashboard
4. Verify in localStorage
5. Go offline
6. Make changes
7. Go online
8. Verify sync

---

## Dependency Import Order

Critical: Modules must load in dependency order!

```html
<!-- Order matters! -->
<script src="js/utils.js" defer></script>
<script src="js/auth.js" defer></script>
<script src="js/store.js" defer></script>
<script src="js/transactions.js" defer></script>
<script src="js/categories.js" defer></script>
<script src="js/recurring.js" defer></script>
<script src="js/goals.js" defer></script>
<script src="js/debts.js" defer></script>
<script src="js/wishlist.js" defer></script>
<script src="js/accounts.js" defer></script>
<script src="js/dashboard.js" defer></script>
<script src="js/charts.js" defer></script>
<script src="js/ui.js" defer></script>
<script src="js/app.js" defer></script>
```

If you change the order, the app will break with "undefined" errors!

---

## Performance Tips

1. Minimize DOM Queries: Cache selectors
   ```javascript
   const form = document.getElementById('form');  // Cache this
   form.addEventListener('submit', handleSubmit);
   ```

2. Debounce Search: Don't filter on every keystroke
   ```javascript
   const debouncedSearch = Utils.debounce(search, 300);
   input.addEventListener('input', debouncedSearch);
   ```

3. Batch Updates: Update UI once, not for each item
   ```javascript
   const html = items.map(item => renderItem(item)).join('');
   container.innerHTML = html;  // One DOM update
   ```

4. Lazy Render: Only render visible items
   ```javascript
   // Render first 50, load more on scroll
   ```

---

## Code Style

All modules follow these conventions:
- JSDoc comments for public functions
- Inline comments for complex logic
- Consistent variable naming (camelCase)
- Error handling with try/catch
- No console logs except errors (use UI.showToast instead)
- Pure functions where possible (especially Utils)

---

## Further Reading

- [Parent README](../README.md) - Overall project overview
- [Backend API Reference](../server/README.md) - Server endpoints
- [Main README](../../README.md) - Repository overview

