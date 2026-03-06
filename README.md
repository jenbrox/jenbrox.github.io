# Jennifer Broxson -- Portfolio & Jentrak Expense Tracker

This repository hosts Jennifer Broxson's personal portfolio site and Jentrak, a full-stack Progressive Web App for personal finance management.

Live site: https://www.jenniferbroxson.com


---

## Contents

The repository is split into two projects.

### 1. Portfolio Landing Page (root)

A single-page landing page with name, professional tagline, and links to LinkedIn, GitHub, and email.

Files:

- index.html -- page markup
- style.css -- gradient background, centred layout, hover effects
- Broxson_Jennifer_CV_Git.pdf -- downloadable CV
- CNAME -- custom domain configuration for GitHub Pages

Technologies: vanilla HTML/CSS, Font Awesome 6.5 for icons.


### 2. Jentrak Expense Tracker (expense-tracker/)

A full-featured PWA with user authentication, server-side persistence, and offline support.

Core capabilities:

- Income and expense tracking with per-category budgets
- Interactive charts (spending breakdown, budget progress, 6-month trends, year-over-year comparison, daily heatmap, cash-flow forecast)
- Savings goals with progress tracking
- Debt tracking with partial settlement support
- Shopping wishlist with priority levels
- Recurring transaction templates with automatic monthly generation
- Multi-account net worth calculation
- Data export/import (JSON, CSV, Excel)

Technical highlights:

- Frontend: vanilla JavaScript, Chart.js, IndexedDB
- Backend: Node.js, Express.js, SQLite (WAL mode)
- Auth: JWT with 30-day expiry, bcryptjs password hashing, OAuth2 (Google, Facebook, GitHub)
- Storage: three-tier architecture (in-memory cache, IndexedDB, server)
- PWA: service worker with cache-first strategy for offline access


---

## Project Structure

```
jenbrox.github.io/
├── index.html                  # Portfolio landing page
├── style.css                   # Landing page styles
├── CNAME                       # Custom domain config
├── Broxson_Jennifer_CV_Git.pdf # CV/resume
└── expense-tracker/
    ├── index.html              # Main SPA shell
    ├── login.html              # Login page
    ├── signup.html             # Registration page
    ├── admin.html              # Admin analytics dashboard
    ├── manifest.json           # PWA manifest
    ├── sw.js                   # Service worker
    ├── js/                     # 14 JavaScript modules
    │   ├── app.js              # Entry point and event wiring
    │   ├── store.js            # Three-tier data persistence
    │   ├── auth.js             # JWT management and API calls
    │   ├── transactions.js     # Transaction CRUD and analytics
    │   ├── categories.js       # Category management and budgets
    │   ├── recurring.js        # Recurring transaction engine
    │   ├── goals.js            # Savings goal tracking
    │   ├── debts.js            # Debt and settlement tracking
    │   ├── wishlist.js         # Wishlist management
    │   ├── accounts.js         # Multi-account net worth
    │   ├── dashboard.js        # Dashboard computation and rendering
    │   ├── charts.js           # Chart.js instance management
    │   ├── ui.js               # Navigation, modals, forms, toasts
    │   └── utils.js            # Pure utility functions
    ├── css/
    │   ├── main.css            # Design tokens, layout, dark mode
    │   ├── components.css      # Buttons, cards, forms, modals
    │   └── charts.css          # Chart container sizing
    └── server/
        ├── server.js           # Express API and SQLite database
        ├── .env                # Environment variables (not committed)
        └── jentrak.db          # SQLite database (not committed)
```


---

## Data Flow

1. On load, app.js initialises all modules and calls Store.initStore().
2. The store loads data in sequence: localStorage (sync), IndexedDB (async), then server API (if authenticated).
3. When a user creates or edits a record, the module validates the input, writes to the in-memory cache, then persists to IndexedDB and the server in parallel.
4. The service worker caches all static assets during installation so the app works offline.
5. API requests include a JWT Bearer token. If the server returns 401, the client logs the user out.


---

## Getting Started

### Frontend only

No build tools are needed. Serve the directory with any static file server:

```bash
python -m http.server 8000
```

Visit http://localhost:8000/expense-tracker/.

### Full stack

Prerequisites: Node.js 14+ and npm.

```bash
cd expense-tracker/server
npm install
npm start
```

The server starts on port 5175 and serves both the API and the static frontend.

Create a .env file in the server directory:

```
JWT_SECRET=replace_with_a_strong_random_string
GOOGLE_CLIENT_ID=
FACEBOOK_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ADMIN_PASSWORD=replace_with_a_strong_password
```

Social login providers are only enabled when their credentials are set.


---

## Further Documentation

- expense-tracker/README.md -- full app documentation, feature guide, deployment
- expense-tracker/server/README.md -- API reference, database schema, auth flows
- expense-tracker/js/README.md -- module architecture, dependency graph, data flow


---

## Security

Authentication methods: email/password (bcryptjs, 10 rounds), Google OAuth2, Facebook OAuth, GitHub OAuth.

Protections in place: JWT tokens with 30-day expiry, Helmet.js security headers, CORS, per-user data isolation, input validation on all endpoints.

Admin dashboard access: HTTP Basic Auth. Default credentials are admin / Jentrak123@ -- change ADMIN_PASSWORD in .env for any real deployment.


---

## Browser Support

- Chrome / Edge 90+
- Firefox 88+
- Safari 14+ (limited PWA support)

The service worker and install prompt require HTTPS in production.


---

## Deployment

The frontend deploys automatically through GitHub Pages on push to main. The CNAME file maps to www.jenniferbroxson.com.

The backend must be deployed separately to any Node.js host (Railway, Render, DigitalOcean, AWS, etc.). Ensure HTTPS is configured and environment variables are set on the host.


---

## Contact

- GitHub: https://github.com/jenbrox
- LinkedIn: https://www.linkedin.com/in/jenniferbroxson
- Email: jenbrox@gmail.com
