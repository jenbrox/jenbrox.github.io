# Expense Tracker

A client-side expense tracking web app with CRUD transactions, category budget management, and interactive charts. Runs entirely in the browser — no server, no build tools, no dependencies beyond Chart.js (loaded from CDN).

**Live:** https://www.jenniferbroxson.com/expense-tracker/

---

## Features

- **Dashboard** — Monthly income, expenses, net balance, and remaining budget at a glance
- **Charts** — Category spending (doughnut), budget vs actual (bar), 6-month trend (line)
- **Transactions** — Add, edit, delete; filter by type and category; monthly navigation
- **Categories** — Custom categories with optional monthly budget limits and progress bars
- **Settings** — Overall monthly budget, currency symbol, date format
- **Data management** — Export/import JSON, reset all data
- **Fully offline** — All data in `localStorage`; charts require CDN internet access

---

## Folder Structure

```
expense-tracker/
├── index.html          # Single-page app shell
├── css/
│   ├── main.css        # Layout, CSS variables, responsive grid
│   ├── components.css  # Cards, buttons, forms, badges, modals, toasts
│   └── charts.css      # Chart container sizing
├── js/
│   ├── utils.js        # Pure utilities (formatting, dates, IDs)
│   ├── store.js        # localStorage read/write layer
│   ├── transactions.js # Transaction CRUD and aggregation queries
│   ├── categories.js   # Category CRUD
│   ├── ui.js           # Navigation, modals, toasts, form helpers, list renderers
│   ├── dashboard.js    # Dashboard computation and rendering
│   ├── charts.js       # Chart.js instance management
│   └── app.js          # Entry point: initialization and event wiring
└── README.md
```

---

## GitHub Pages Deployment

### Option A — Deploy from a dedicated repo to a subdirectory

This is the recommended approach if your main site (`www.jenniferbroxson.com`) is hosted separately.

1. **Create a repository** named `expense-tracker` (or any name) on GitHub.

2. **Push all files** to the `main` branch:
   ```bash
   cd path/to/expense-tracker
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/expense-tracker.git
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to your repository → **Settings** → **Pages**
   - Source: `Deploy from a branch`
   - Branch: `main`, Folder: `/ (root)`
   - Click **Save**

4. **Configure your custom domain:**
   - Add a `CNAME` file to the repository root containing exactly:
     ```
     www.jenniferbroxson.com
     ```
   - In your DNS provider, add a CNAME record: `www` → `YOUR_USERNAME.github.io`
   - GitHub will automatically provision HTTPS (may take up to 24 hours)

5. **Verify the path** — because the repo is not at the root of your domain, you may need to configure where GitHub Pages serves it. If your main site is at the root, this app should appear at `/expense-tracker/` once GitHub Pages is configured.

   > **Note:** GitHub Pages serves each repository at `username.github.io/repo-name` by default. With a custom domain configured at the user/org level, the path segment becomes `/repo-name/`. For a repo named `expense-tracker`, the app is at `/expense-tracker/`.

### Option B — Add to your existing site repository

If your main site lives in a single GitHub repo:

1. Copy the `expense-tracker/` folder into your existing repo at the path `expense-tracker/`
2. Push to the branch that GitHub Pages uses
3. The app will be available at `www.jenniferbroxson.com/expense-tracker/`

All asset paths in `index.html` use `./` relative paths (e.g., `./css/main.css`, `./js/app.js`), so the app works correctly regardless of which subdirectory it lives in.

---

## Local Development

No build step required. Open `index.html` directly or serve with any static file server:

```bash
# Python 3
python -m http.server 8080

# Node.js (npx)
npx serve .

# VS Code Live Server extension
# Right-click index.html → Open with Live Server
```

Then visit `http://localhost:8080/expense-tracker/` (adjust path to match your setup).

> **Note:** Opening `index.html` via `file://` in most browsers works fine. Chrome may restrict some features; use a local server if you encounter issues.

---

## Data Storage

All data is stored in the browser's `localStorage` under keys prefixed with `et_`:

| Key | Contents |
|-----|----------|
| `et_transactions` | Array of transaction objects |
| `et_categories` | Array of category objects |
| `et_settings` | Settings object |

Data is scoped to the origin (`www.jenniferbroxson.com`) and persists until cleared. Use **Settings → Export Data** to back up your data before clearing browser storage.

---

## Offline Behavior

All data management features (add/edit/delete transactions, categories, settings) work offline. The **charts require** Chart.js from jsDelivr CDN — if offline, the chart area will be empty but all other features remain functional.

To enable fully offline charts, download [Chart.js UMD](https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js), place it at `js/vendor/chart.umd.min.js`, and update the script tag in `index.html`:

```html
<!-- Replace: -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js" defer></script>

<!-- With: -->
<script src="./js/vendor/chart.umd.min.js" defer></script>
```

---

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Requires:
- `localStorage` support
- `<dialog>` element support (Chrome 37+, Firefox 98+, Safari 15.4+)
- CSS custom properties

No polyfills are included.
