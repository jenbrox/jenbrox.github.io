# Jentrak — Progressive Web App Expense Tracker

A full-featured expense tracker PWA with user authentication, cloud sync, real-time analytics, and offline support.

**Live**: https://www.jenniferbroxson.com/expense-tracker/

---

## ✨ Features

### Core Expense Tracking
- **Dashboard**: Monthly summary (income, expenses, net, remaining budget)
- **Transactions**: Add/edit/delete income & expenses with tags
- **Categories**: Custom categories with optional monthly budgets and progress bars
- **Recurring**: Auto-generate monthly bills, subscriptions, salary
- **Analytics**: Interactive charts (spending by category, budget progress, 6-month trends)

### Advanced Features
- **💰 Multi-Account**: Track checking, savings, credit, cash, investments
- **💳 Debts**: Track loans you've given and owe (with partial settlements)
- **🎯 Goals**: Set savings goals and track progress
- **🛒 Wishlist**: Shopping list with priorities, prices, and URLs
- **📊 Insights**: AI-powered spending insights and budget warnings

### Technical
- **🔐 Authentication**: Email/password + OAuth (Google, Facebook, GitHub)
- **☁️ Cloud Sync**: All data backed up and synced across devices
- **📱 Progressive Web App**: Installable app, works offline
- **📈 Analytics**: Admin dashboard with user stats and insights
- **🌓 Dark Mode**: Automatic + manual toggle
- **📲 Responsive**: Mobile-first design, works on any screen size

---

## 🏗️ Architecture

### Frontend Stack
- **Framework**: Vanilla JavaScript (no dependencies except Chart.js)
- **Storage**: Three-tier (in-memory → IndexedDB → server)
- **PWA**: Service Worker for offline-first caching
- **Charts**: Chart.js for data visualization
- **Styling**: CSS with custom properties and dark mode support

### Backend Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite with WAL mode
- **Auth**: JWT + bcryptjs + OAuth2
- **Security**: Helmet.js, CORS, password hashing

### Three-Tier Data Persistence
1. **In-Memory Cache** (instant, no persistence)
2. **IndexedDB** (fast, persistent, offline-capable)
3. **Server/SQLite** (reliable, synced across devices)

---

## 🚀 Getting Started

### Option 1: Use the Hosted Version
Simply visit https://www.jenniferbroxson.com/expense-tracker/ and create an account!

### Option 2: Run Locally

**Prerequisites:**
- Node.js 14+ and npm
- Git

**Setup Backend:**
```bash
cd expense-tracker/server
npm install
```

**Configure Environment** (create `.env`):
```env
JWT_SECRET=your_secret_key_here
GOOGLE_CLIENT_ID=your_google_client_id
FACEBOOK_APP_ID=your_facebook_app_id
GITHUB_CLIENT_ID=your_github_client_id
ADMIN_PASSWORD=admin_password_here
```

**Start Server:**
```bash
npm start
```

Server runs on `http://localhost:5175`

**Access Frontend:**
- Open `http://localhost:5175` in your browser
- Or serve the expense-tracker folder separately:
  ```bash
  python -m http.server 8000  # In the expense-tracker directory
  # Visit http://localhost:8000
  ```

---

## 📖 Documentation

### Quick Links
- **[Frontend Modules Guide](js/README.md)** - Architecture, data flow, module docs
- **[Backend API Reference](server/README.md)** - All endpoints, database schema, auth flow
- **[Parent README](../README.md)** - Overall project overview

### Key Files
| File | Purpose |
|------|---------|
| `index.html` | Main SPA shell with all UI sections |
| `login.html` | Login page |
| `signup.html` | Registration page |
| `admin.html` | Admin analytics dashboard |
| `manifest.json` | PWA configuration |
| `sw.js` | Service Worker (offline support) |
| `js/app.js` | App initialization and routing |
| `js/store.js` | Three-tier data persistence |
| `server/server.js` | Express backend |

---

## 🔐 Authentication

### Supported Methods
1. **Email/Password**: Traditional registration and login
2. **Google OAuth**: Single sign-on via Google
3. **Facebook OAuth**: Single sign-on via Facebook
4. **GitHub OAuth**: Single sign-on via GitHub

### How It Works
1. User logs in → server validates and returns JWT token
2. JWT stored in `localStorage` and included in all API requests
3. Server validates token on each request
4. Token expires after 30 days (user must re-login)
5. All user data is isolated per user in database

### Social OAuth Setup
For social login to work locally or in production:

1. **Google**: Create OAuth2 credentials at [Google Cloud Console](https://console.cloud.google.com)
   - Authorized redirect URIs: `http://localhost:5175/`, `https://www.jenniferbroxson.com/`
   - Set `GOOGLE_CLIENT_ID` in `.env`

2. **Facebook**: Create app at [Facebook Developers](https://developers.facebook.com)
   - Valid OAuth redirect URIs: `http://localhost:5175/`, `https://www.jenniferbroxson.com/`
   - Set `FACEBOOK_APP_ID` in `.env`

3. **GitHub**: Create OAuth app at [GitHub Settings](https://github.com/settings/developers)
   - Authorization callback URL: `http://localhost:5175/`, `https://www.jenniferbroxson.com/`
   - Set `GITHUB_CLIENT_ID` in `.env`

> **Note**: Social login buttons only appear if corresponding env vars are set

---

## 💾 Data Management

### What Gets Stored
- Transactions (income & expenses)
- Categories and budgets
- Recurring transaction templates
- Savings goals
- Debts and settlements
- Wishlist items
- Accounts and balances
- User settings

### Export/Import
- **Export**: Download data as JSON or Excel (xlsx)
- **Import**: Restore from previous export
- **Reset**: Delete all data (careful!)

---

## 📊 Analytics & Admin Dashboard

The admin dashboard provides insights:
- **Total Users**: Signup count and growth
- **Activity**: Login frequency, page views
- **Usage**: Peak hours, top browsers, geographic distribution
- **Engagement**: 7-day and 30-day active user rates
- **Data Health**: Database size, user data storage usage
- **User Management**: View users, reset passwords, delete users

**Access**: `https://www.jenniferbroxson.com/expense-tracker/admin.html`
**Default Credentials**: `admin` / `Jentrak123@` (change in `.env`)

---

## 🌐 Offline Support

### Service Worker Strategy
- **Cache-First**: Static assets (JS, CSS, HTML) served from cache with network fallback
- **Network-First**: API requests always fetch fresh from server
- **Skip Caching**: Login/signup pages and API routes never cached

### Offline Capabilities
✅ **Works Offline:**
- View existing data
- Create/edit transactions (syncs when online)
- Navigate between sections
- Dark mode toggle

❌ **Needs Internet:**
- Login/signup
- Real-time data sync
- OAuth providers
- Charts (Chart.js from CDN)

### Service Worker Caching
The SW caches all app shell files during installation. When offline:
1. User views cached pages with local data
2. Changes made offline are stored locally
3. When connection restored, changes sync to server
4. Service Worker skips cache for API and auth routes

---

## 🎨 Customization

### Theming
Edit CSS custom properties in `expense-tracker/css/main.css`:
```css
:root {
  --primary-color: #6C63FF;  /* Change app primary color */
  --danger-color: #e74c3c;
  --success-color: #27ae60;
  /* ... more colors ... */
}
```

### Preset Colors
Categories come with 16 default colors. Edit in `js/store.js`:
```javascript
function seedDefaultData() {
  // Modify color array here
  const colors = ['#FF5733', '#33FF57', ...];
}
```

---

## 📱 Installing as App

### On Mobile (iOS/Android)
1. Open browser → visit app URL
2. Tap **Share** → **Add to Home Screen**
3. App appears as installed app with icon

### On Desktop (Windows/Mac)
1. Click **Install** button in browser address bar (if visible)
2. App opens in windowed mode
3. Accessible from Start Menu / Applications

---

## 🧪 Testing

### Manual Testing Checklist
- [ ] Create account with email
- [ ] Login with password
- [ ] Try OAuth (Google/Facebook/GitHub)
- [ ] Add transaction and verify in dashboard
- [ ] Create custom category with budget
- [ ] Set up recurring transaction
- [ ] Create savings goal
- [ ] Export data to JSON
- [ ] Go offline and verify app still works
- [ ] Try dark mode toggle
- [ ] Test responsive design on mobile

### Admin Testing
- [ ] Login to admin dashboard
- [ ] View user stats
- [ ] Check database size
- [ ] View recent events
- [ ] Export user list to CSV

---

## 🚀 Deployment

### Frontend (GitHub Pages)
Already configured in this repo:
- Automatic deployment on push to main
- CNAME configured for `www.jenniferbroxson.com`

### Backend
Deploy Node.js server to your choice of:
- **Heroku** (simple, has free tier)
- **DigitalOcean** (affordable VPS)
- **AWS EC2** (scalable)
- **Railway** (modern platform)
- **Render** (easy deployment)

**Requirements:**
- Node.js 14+
- Set environment variables on hosting platform
- Configure HTTPS (required for OAuth)
- For SQLite: Use WAL mode (already configured) for better concurrency

**After Deployment:**
- Update API endpoint in frontend if using custom server domain
- Ensure CORS is configured correctly
- Test OAuth redirects with production URLs

---

## 🔒 Security Considerations

### Production Checklist
- [ ] Change admin password in `.env`
- [ ] Generate strong `JWT_SECRET`
- [ ] Use HTTPS everywhere (enforced by OAuth)
- [ ] Keep dependencies updated (`npm audit fix`)
- [ ] Configure CORS for your domain only
- [ ] Set secure database backups
- [ ] Monitor admin dashboard for suspicious activity
- [ ] Use environment variables for secrets (never commit `.env`)
- [ ] Enable CSRF protection if adding forms

---

## 📊 Browser Support

| Browser | Min Version | PWA Support |
|---------|-------------|-------------|
| Chrome | 90+ | ✅ Full |
| Firefox | 88+ | ✅ Full |
| Safari | 14+ | ⚠️ Limited |
| Edge | 90+ | ✅ Full |

**Safari PWA Notes:**
- No service worker (uses app cache instead)
- No installation prompt
- Manual "Add to Home Screen" only

---

## 🐛 Troubleshooting

### "App won't sync with server"
- Check network connection
- Verify JWT token hasn't expired
- Check browser console for API errors
- Ensure backend is running

### "Charts not showing"
- Check internet connection (Chart.js loads from CDN)
- Disable ad blockers that might block CDN
- Check browser console for errors

### "Service Worker won't update"
- Clear browser cache
- Go to DevTools → Application → Clear Storage
- Hard refresh (Ctrl+Shift+R)

### "OAuth login not working"
- Verify client ID is correct in `.env`
- Check redirect URIs are configured in OAuth app settings
- Ensure you're using HTTPS in production
- Check console for specific error messages

---

## 📝 License & Credits

- **Chart.js**: Charting library (Apache 2.0)
- **SheetJS**: Excel export support
- **Google Fonts**: Typography

---

## 📧 Support

Found a bug or have a suggestion? Contact Jennifer:
- **Email**: jenbrox@gmail.com
- **GitHub Issues**: [Report on GitHub](https://github.com/jenbrox/jenbrox.github.io/issues)
- **LinkedIn**: [Jennifer Broxson](https://www.linkedin.com/in/jenniferbroxson)

---

Last updated: March 2026
