# Jennifer Broxson's Portfolio & Jentrak Expense Tracker

This repository hosts Jennifer Broxson's personal portfolio and a full-featured Progressive Web App (PWA) expense tracker called **Jentrak**.

**Live Site**: [www.jenniferbroxson.com](https://www.jenniferbroxson.com)

---

## Contents

This repository contains two main projects:

### 1. Portfolio Landing Page (Root)
A minimal, elegant landing page with social links and CV.

**Files:**
- `index.html` - Landing page markup
- `style.css` - Landing page styles (gradient background, centered layout)
- `Broxson_Jennifer_CV_Git.pdf` - CV/resume
- `favicon.svg` - Site icon

**Tech:**
- Vanilla HTML/CSS
- Font Awesome icons for social links
- Responsive design

### 2. Jentrak Expense Tracker (`expense-tracker/`)
A full-featured, full-stack PWA for managing personal finances with multi-user support, authentication, and cloud sync.

## Key Features

**Transaction Management**
- Transaction tracking (income & expenses)
- Visual analytics (charts & spending summaries)
- Multi-account net worth tracking
- Per-category budget tracking with alerts

**Savings & Planning**
- Savings goals with progress tracking
- Debt tracking (loans given & taken)
- Shopping wishlist with priorities
- Recurring transaction automation

**Technical Features**
- User authentication (email, Google, Facebook, GitHub OAuth)
- Cloud data sync & backup
- Progressive Web App (offline support, installable)
- Dark mode support
- Fully responsive design

**Tech Stack:**
- **Frontend**: Vanilla JavaScript (no framework), Chart.js, IndexedDB
- **Backend**: Node.js + Express.js
- **Database**: SQLite (persistent data storage)
- **Auth**: JWT tokens + bcryptjs + OAuth2
- **Storage**: Three-tier (localStorage → IndexedDB → Server)
- **PWA**: Service Worker for offline-first caching

---

## Architecture Overview

### Frontend Structure (`expense-tracker/`)
```
expense-tracker/
├── index.html              # Main SPA shell
├── login.html              # Login page
├── signup.html             # Registration page
├── admin.html              # Admin dashboard
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker (offline support)
├── js/                     # JavaScript modules (14 files)
│   ├── app.js              # Entry point, event wiring
│   ├── store.js            # Three-tier data persistence
│   ├── auth.js             # JWT auth & API calls
│   ├── transactions.js     # CRUD + analytics
│   ├── categories.js       # Categories & budgets
│   ├── recurring.js        # Recurring transaction auto-gen
│   ├── goals.js            # Savings goals
│   ├── debts.js            # Debt tracking
│   ├── wishlist.js         # Shopping list
│   ├── accounts.js         # Multi-account support
│   ├── dashboard.js        # Dashboard rendering
│   ├── charts.js           # Chart.js integration
│   ├── ui.js               # DOM manipulation & modals
│   └── utils.js            # Utility functions
├── css/                    # Stylesheets
│   ├── main.css            # Design tokens, layout, dark mode
│   ├── components.css      # Component styles
│   └── charts.css          # Chart styling
└── server/                 # Backend (Node.js + Express)
    ├── server.js           # Express app, routes, SQLite
    ├── jentrak.db          # SQLite database (persisted)
    └── .env                # Environment variables
```

### Data Flow
1. User loads the app → `app.js` initializes modules
2. `Store.initStore()` loads data in sequence: localStorage → IndexedDB → server
3. User makes a change → Module saves to cache → `Store.persist()` syncs to IndexedDB + server
4. Service Worker caches static assets for offline access
5. On login/signup, JWT token is stored and included in all API requests

### Three-Tier Storage Architecture
- **Layer 1 (Synchronous)**: In-memory cache - instant read/write
- **Layer 2 (Async Primary)**: IndexedDB - fast local persistence
- **Layer 3 (Cloud)**: Server API - reliable backup & multi-device sync

---

## Getting Started

### Frontend Only (Development)
No build step required! The frontend is vanilla JavaScript.

```bash
# Serve the app locally
python -m http.server 8000
# Visit: http://localhost:8000/expense-tracker/
```

For the full experience with data persistence, you'll need the backend.

### Full Stack (Backend + Frontend)

**Prerequisites:**
- Node.js 14+
- npm or yarn

**Setup:**
```bash
cd expense-tracker/server
npm install
npm start
```

The server will start on `http://localhost:5175`

**Environment Variables** (`.env`):
```
JWT_SECRET=your_secret_key_here
GOOGLE_CLIENT_ID=your_google_client_id
FACEBOOK_APP_ID=your_facebook_app_id
GITHUB_CLIENT_ID=your_github_client_id
ADMIN_PASSWORD=admin_password
```

---

## Documentation

### For Developers

- **[`expense-tracker/README.md`](expense-tracker/README.md)** - Full app documentation, data schema, feature guide
- **[`expense-tracker/server/README.md`](expense-tracker/server/README.md)** - Backend API reference, database schema, auth flow
- **[`expense-tracker/js/README.md`](expense-tracker/js/README.md)** - JavaScript module architecture & data flow

### Inline Documentation
Each JavaScript file includes JSDoc comments explaining:
- Module purpose and dependencies
- Function parameters, return values, and examples
- Complex logic explanations

---

## Security & Authentication

**Supported Auth Methods:**
1. **Email/Password**: Local registration with bcryptjs hashing
2. **OAuth2**: Google, Facebook, GitHub

**Security Features:**
- JWT tokens with 30-day expiry
- Password hashing (bcryptjs, 10 rounds)
- CORS enabled
- Helmet.js security headers
- Per-user data isolation on server

**Admin Access:**
- HTTP Basic Auth for admin dashboard
- Default credentials: `admin`/`Jentrak123@` (configurable in `.env`)

---

## Testing

Currently, the app doesn't have automated tests. Recommended testing approaches:

1. **Manual Testing**: Use the UI to test all features
2. **Browser DevTools**: Check console errors, network requests
3. **Admin Dashboard**: View analytics, user stats, debug data

---

## Browser Support

**Modern Browsers:**
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**PWA Features:**
- Service Worker (offline support) ✓
- App manifest (install prompt) ✓
- HTTPS required for production

---

## Key Modules Overview

| Module | Responsibility |
|--------|---|
| `app.js` | App initialization, routing, event wiring |
| `store.js` | Data persistence (localStorage → IndexedDB → server) |
| `auth.js` | JWT authentication, API headers, token management |
| `transactions.js` | Expense/income CRUD, analytics, insights |
| `categories.js` | Category CRUD, budget tracking, spending calculation |
| `recurring.js` | Auto-generation of monthly recurring transactions |
| `goals.js` | Savings goal creation, progress tracking |
| `debts.js` | Loan tracking (both directions) & settlement |
| `wishlist.js` | Shopping list with priorities & prices |
| `accounts.js` | Multi-account management, net worth calculation |
| `dashboard.js` | Summary card rendering & insights display |
| `charts.js` | Chart.js wrapper for spending visualizations |
| `ui.js` | DOM manipulation, modals, forms, toasts |
| `utils.js` | Utility functions (ID generation, date formatting, etc.) |

For detailed info on each module, see [`expense-tracker/js/README.md`](expense-tracker/js/README.md).

---

## Deployment

**Frontend (GitHub Pages):**
- Automatically deployed from this repo
- CNAME: `www.jenniferbroxson.com`

**Backend:**
- Deploy Node.js server separately (e.g., Heroku, DigitalOcean, AWS)
- Update API endpoint in frontend if using custom domain
- Ensure HTTPS is enabled for OAuth redirects

---

## License

This project is open source. Feel free to use, modify, and share!

---

## Contact

- **GitHub**: [@jenbrox](https://github.com/jenbrox)
- **LinkedIn**: [Jennifer Broxson](https://www.linkedin.com/in/jenniferbroxson)
- **Email**: jenbrox@gmail.com
