# Jentrak -- Expense Tracker PWA

A full-stack Progressive Web App for personal finance management with authentication, cloud sync, interactive charts, and offline support.

Live: https://www.jenniferbroxson.com/expense-tracker/


---

## Features

Transaction management
- Add, edit, and delete income and expense records
- Tag transactions with custom labels
- Filter by type, category, or search query
- Duplicate detection before saving

Budgeting and analytics
- Per-category monthly budgets with progress bars
- Dashboard with income, expenses, net balance, and remaining budget
- Category spending doughnut chart
- Budget vs actual bar chart
- 6-month income/expense trend line
- Year-over-year comparison (appears when 2+ years of data exist)
- Daily spending heatmap
- 3-month cash-flow forecast based on recurring templates and historical averages
- Spending insights (largest expense, top category, average daily spend, month-over-month change)

Savings and planning
- Savings goals with target amounts, deadlines, and progress tracking
- Debt tracker for money owed to you and money you owe, with partial settlement
- Shopping wishlist with priority levels, prices, and product links
- Recurring transaction engine (daily, weekly, bi-weekly, monthly, yearly)

Accounts
- Multiple financial accounts (checking, savings, credit, cash, investment)
- Transfers between accounts
- Net worth calculation (assets minus credit liabilities)

Data management
- Export to JSON, CSV, or Excel
- Import from previous export
- Full data reset

Authentication
- Email and password registration (bcryptjs hashing)
- Google, Facebook, and GitHub OAuth
- JWT tokens with 30-day expiry
- Per-user data isolation on the server

Progressive Web App
- Service worker with cache-first strategy
- Installable on mobile and desktop
- Offline access to cached data
- Automatic sync when connectivity returns

Other
- Dark mode (automatic detection and manual toggle)
- Responsive design for mobile, tablet, and desktop
- Admin analytics dashboard


---

## Architecture

### Frontend

All client code is vanilla JavaScript organised into 14 modules using the revealing module pattern. There are no build tools or framework dependencies beyond Chart.js (loaded from CDN).

Modules are loaded via script tags in dependency order. Each exposes a single global object (e.g. Utils, Store, Transactions).

Data persistence uses a three-tier architecture:

1. In-memory cache -- immediate reads and writes with zero latency.
2. IndexedDB -- persistent local storage that survives page reloads and works offline.
3. Server API -- SQLite-backed cloud storage for cross-device sync and backup.

Writes flow through all three layers. On load, data is read from localStorage first (synchronous), upgraded to IndexedDB, then overwritten by server data if the user is authenticated.

### Backend

Node.js with Express.js, SQLite via better-sqlite3 (WAL mode for concurrent reads), JWT authentication, and Helmet.js security headers.

Three database tables:

- users -- account info, password hash, OAuth provider details
- user_data -- per-user JSON stores (transactions, categories, settings, recurring, goals, debts, wishlist, accounts)
- analytics_events -- page views, logins, signups for the admin dashboard


---

## Getting Started

### Hosted version

Visit https://www.jenniferbroxson.com/expense-tracker/ and create an account.

### Local development

Prerequisites: Node.js 14+, npm.

```bash
cd expense-tracker/server
npm install
npm start
```

The server starts on http://localhost:5175 and serves both the API and the frontend.

Create a .env file in the server directory with at minimum:

```
JWT_SECRET=replace_with_a_strong_random_string
```

Optional variables for social login:

```
GOOGLE_CLIENT_ID=
FACEBOOK_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ADMIN_PASSWORD=replace_with_a_strong_password
```

Social login buttons only appear when the corresponding credentials are set.


---

## Documentation

- server/README.md -- complete API reference with request/response examples, database schema, OAuth setup, and deployment guides
- js/README.md -- module architecture, dependency graph, data-flow diagrams, and guide to adding new features
- ../README.md -- overall repository overview


---

## Authentication

### Email and password

1. User submits email, name, and password to POST /api/auth/signup.
2. Server hashes the password with bcryptjs (10 rounds) and stores the user.
3. Server returns a JWT token and user profile.
4. Client stores the token in localStorage and includes it as a Bearer header on all API requests.
5. Tokens expire after 30 days.

### OAuth

Google, Facebook, and GitHub OAuth flows are supported. Each follows the same pattern:

1. Client obtains a token or authorisation code from the provider.
2. Client sends it to the corresponding server endpoint (e.g. POST /api/auth/google).
3. Server verifies the token with the provider, creates or finds the user, and returns a JWT.

OAuth provider setup requires creating credentials in each provider's developer console and adding the client IDs to .env. See server/README.md for detailed instructions.

### Admin dashboard

Available at /admin.html. Uses HTTP Basic Auth with username "admin" and the ADMIN_PASSWORD from .env.

Provides user counts, signup/login activity, geographic distribution, browser stats, peak usage hours, and the ability to manage individual user accounts.


---

## Offline Behaviour

The service worker caches all static assets (HTML, CSS, JS) during installation. On subsequent visits:

- Cached assets are served immediately while a network fetch updates the cache in the background.
- API routes, login, signup, and admin pages are never cached to ensure fresh authentication state.
- Changes made offline are stored locally and synced to the server when connectivity returns.

Chart.js is loaded from a CDN, so charts require an internet connection on first load. Once cached by the service worker, they work offline.


---

## Deployment

### Frontend (GitHub Pages)

Already configured. Pushes to the main branch trigger automatic deployment. The CNAME file maps to www.jenniferbroxson.com.

### Backend

Deploy the server directory to any Node.js host. Options include Railway, Render, DigitalOcean, Heroku, or AWS.

Requirements:
- Node.js 14+
- Environment variables set on the host (JWT_SECRET at minimum)
- HTTPS configured (required for OAuth redirect URIs)
- SQLite WAL mode is already enabled in server.js

After deployment, ensure CORS is configured for your production domain and that OAuth provider redirect URIs match the deployed URL.


---

## Browser Support

| Browser     | Minimum Version | PWA Support |
|-------------|-----------------|-------------|
| Chrome      | 90+             | Full        |
| Edge        | 90+             | Full        |
| Firefox     | 88+             | Full        |
| Safari      | 14+             | Limited     |

Safari does not support the install prompt. Users must manually use "Add to Home Screen".


---

## Security Checklist

For any production deployment:

- Set a strong random JWT_SECRET (minimum 32 characters)
- Change the ADMIN_PASSWORD from the default
- Use HTTPS everywhere
- Run npm audit regularly and update dependencies
- Configure CORS to allow only your production domain
- Back up the SQLite database on a schedule
- Monitor the admin dashboard for unusual activity


---

## Troubleshooting

App will not sync with server
- Verify the backend is running and reachable.
- Check the browser console for 401 errors (token may have expired).
- Log out and log back in to obtain a fresh token.

Charts not rendering
- Chart.js loads from a CDN. Check internet connectivity.
- Disable ad blockers that may block CDN requests.

Service worker serving stale content
- Open DevTools, go to Application, and click "Clear storage".
- Hard-refresh the page with Ctrl+Shift+R.

OAuth login failing
- Verify the client ID in .env matches the provider's developer console.
- Check that redirect URIs are configured for the current domain.
- Ensure HTTPS is active in production.


---

## Contact

- GitHub: https://github.com/jenbrox
- LinkedIn: https://www.linkedin.com/in/jenniferbroxson
- Email: jenbrox@gmail.com
