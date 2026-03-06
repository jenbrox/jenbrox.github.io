# Jentrak Backend — API Reference & Setup Guide

Node.js + Express.js + SQLite backend for the Jentrak expense tracker PWA.

---

## Quick Start

### Installation
```bash
cd expense-tracker/server
npm install
```

### Configuration (create `.env`)
```env
JWT_SECRET=your_secret_key_here
GOOGLE_CLIENT_ID=your_google_client_id
FACEBOOK_APP_ID=your_facebook_app_id
GITHUB_CLIENT_ID=your_github_client_id
ADMIN_PASSWORD=admin_password_here
```

### Running Locally
```bash
npm start
```
- Server starts on `http://localhost:5175`
- SQLite database created at `jentrak.db`
- Static files served from parent `expense-tracker/` directory

---

## Architecture

### Tech Stack
- **Runtime**: Node.js 14+
- **Framework**: Express.js 4.x
- **Database**: SQLite3 (better-sqlite3, WAL mode)
- **Auth**: JWT (jsonwebtoken) + bcryptjs
- **OAuth**: Google, Facebook, GitHub
- **Security**: Helmet.js, CORS

### Database Location
- **Development**: `expense-tracker/server/jentrak.db`
- **Production**: Set via environment or Docker volume

### Port
- Default: `5175`
- Override: Set `PORT` environment variable

---

## Database Schema

### `users` Table
Stores user account information.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,              -- Format: user_<24-char-hex>
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  password_hash TEXT,                -- Null for OAuth-only users
  auth_provider TEXT,                -- 'local', 'google', 'facebook', 'github'
  auth_provider_id TEXT,             -- Provider's user ID
  avatar_url TEXT,
  signup_ip TEXT,
  country TEXT,                      -- Filled via IP geolocation
  created_at TEXT,                   -- ISO timestamp
  updated_at TEXT                    -- ISO timestamp
)
```

**Indexes:**
- `email` (unique) - fast login lookup
- `auth_provider_id` - OAuth token exchange

### `user_data` Table
Stores all user app data as JSON (one row per store per user).

```sql
CREATE TABLE user_data (
  user_id TEXT NOT NULL,
  store_key TEXT NOT NULL,          -- 'transactions', 'categories', etc.
  data TEXT NOT NULL,                -- JSON string of store contents
  updated_at TEXT,                   -- ISO timestamp
  PRIMARY KEY (user_id, store_key)
)
```

**Store Keys** (8 stores per user):
1. `transactions` - Income and expense records
2. `categories` - Custom categories with budgets
3. `settings` - User settings (currency, date format, etc.)
4. `recurring` - Recurring transaction templates
5. `goals` - Savings goals
6. `debts` - Loan tracking
7. `wishlist` - Shopping list items
8. `accounts` - Bank/financial accounts

### `analytics_events` Table
Tracks user activity for admin dashboard.

```sql
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,         -- 'signup', 'login', 'page_view', 'link_click'
  user_id TEXT,                      -- Null for non-authenticated events
  ip_address TEXT,
  user_agent TEXT,
  metadata TEXT,                     -- JSON with event-specific data
  created_at TEXT                    -- ISO timestamp
)
```

---

## Authentication

### JWT Token Flow

1. **Signup/Login** (POST `/api/auth/signup` or `/api/auth/login`)
   - User submits email + password
   - Server validates credentials
   - Password hashed with bcryptjs (10 rounds) before storage
   - Server returns `{ token, user }`
   - Client stores token in `localStorage.jentrak_token`

2. **Subsequent Requests**
   - Client includes header: `Authorization: Bearer <token>`
   - Server validates token with `jsonwebtoken`
   - If valid, request proceeds; if expired/invalid, returns 401
   - Client intercepts 401 and redirects to login page

3. **Token Details**
   - Algorithm: HS256 (HMAC SHA256)
   - Secret: `JWT_SECRET` environment variable
   - Expiry: 30 days from issue
   - Payload: `{ userId, email, iat, exp }`

### OAuth2 Flow

#### Google
```
1. Frontend: Redirect to Google consent screen
2. Google: Returns ID token to frontend
3. Frontend: POST /api/auth/google { idToken }
4. Backend: Verify token with Google OAuth2Client
5. Backend: Create/update user, return JWT
```

**Setup:**
- Create OAuth2 credentials at [Google Cloud Console](https://console.cloud.google.com)
- Set authorized redirect URIs: `https://www.jenniferbroxson.com/`
- Add `GOOGLE_CLIENT_ID` to `.env`

#### Facebook
```
1. Frontend: Redirect to Facebook login
2. Facebook: Returns access token to frontend
3. Frontend: POST /api/auth/facebook { accessToken }
4. Backend: Exchange token for user profile via Graph API
5. Backend: Create/update user, return JWT
```

**Setup:**
- Create app at [Facebook Developers](https://developers.facebook.com)
- Set OAuth redirect URIs
- Add `FACEBOOK_APP_ID` to `.env`

#### GitHub
```
1. Frontend: Redirect to GitHub authorization
2. GitHub: Returns authorization code to frontend
3. Frontend: POST /api/auth/github { code }
4. Backend: Exchange code for access token
5. Backend: Fetch user profile and emails
6. Backend: Create/update user, return JWT
```

**Setup:**
- Create OAuth app at [GitHub Settings](https://github.com/settings/developers)
- Set Authorization callback URL
- Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` to `.env`

---

## API Endpoints

### Auth Routes (No Auth Required)

#### POST `/api/auth/signup`
Register a new user with email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_abc123def456",
    "email": "user@example.com",
    "name": "John Doe",
    "auth_provider": "local"
  }
}
```

**Errors:**
- `400`: Email already exists
- `400`: Invalid email or password too short
- `500`: Server error

#### POST `/api/auth/login`
Login with email/password.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response:** `200 OK`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { /* user object */ }
}
```

**Errors:**
- `401`: Invalid credentials
- `404`: User not found

#### POST `/api/auth/google`
Login with Google ID token.

**Request:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response:** `200 OK` (same as signup/login)

#### POST `/api/auth/facebook`
Login with Facebook access token.

**Request:**
```json
{
  "accessToken": "EAABs..."
}
```

**Response:** `200 OK`

#### POST `/api/auth/github`
Login with GitHub authorization code.

**Request:**
```json
{
  "code": "e9ef..."
}
```

**Response:** `200 OK`

#### GET `/api/auth/providers`
Check which OAuth providers are enabled.

**Response:** `200 OK`
```json
{
  "google": true,
  "facebook": false,
  "github": true
}
```

---

### Auth Routes (Requires JWT)

#### GET `/api/auth/me`
Get current user info and validate token.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "user": {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "avatar_url": "https://...",
    "auth_provider": "local"
  }
}
```

**Errors:**
- `401`: Invalid or expired token

#### PUT `/api/auth/profile`
Update user profile (name, email).

**Request:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com"
}
```

**Response:** `200 OK` (returns updated user)

#### PUT `/api/auth/password`
Change password (for local users only).

**Request:**
```json
{
  "oldPassword": "CurrentPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response:** `200 OK`
**Errors:**
- `400`: Old password incorrect
- `400`: Weak new password

#### PUT `/api/auth/avatar`
Upload avatar image (max 10MB).

**Request:**
```json
{
  "avatar": "data:image/png;base64,iVBORw0KG..."
}
```

**Response:** `200 OK` (returns updated user)

#### DELETE `/api/auth/avatar`
Remove avatar.

**Response:** `200 OK`

---

### Data Routes (Requires JWT)

All data is per-user and isolated on the server.

#### GET `/api/data`
Fetch all user stores (transactions, categories, etc.).

**Response:** `200 OK`
```json
{
  "transactions": [ /* array */ ],
  "categories": [ /* array */ ],
  "settings": { /* object */ },
  "recurring": [ /* array */ ],
  "goals": [ /* array */ ],
  "debts": [ /* array */ ],
  "wishlist": [ /* array */ ],
  "accounts": [ /* array */ ]
}
```

#### GET `/api/data/:store`
Fetch a single store.

**Examples:**
- `GET /api/data/transactions`
- `GET /api/data/categories`

**Response:** `200 OK`
```json
[ /* array of items */ ]
```

#### PUT `/api/data/:store`
Save a single store (replace all contents).

**Request:**
```json
{
  "data": [ /* array of items */ ]
}
```

**Response:** `200 OK`

#### PUT `/api/data`
Bulk save multiple stores in one request.

**Request:**
```json
{
  "stores": {
    "transactions": [ /* array */ ],
    "categories": [ /* array */ ],
    /* ... other stores ... */
  }
}
```

**Response:** `200 OK`

#### DELETE `/api/data`
Clear all user data (irreversible).

**Response:** `200 OK`
**Warning:** This deletes all transactions, categories, goals, etc.

---

### Analytics Routes (No Auth Required)

#### POST `/api/track`
Track user events (page views, link clicks).

**Request:**
```json
{
  "eventType": "page_view",
  "metadata": {
    "page": "dashboard",
    "timestamp": "2026-03-06T12:00:00Z"
  }
}
```

**Response:** `200 OK`

---

### Admin Routes (HTTP Basic Auth)

Admin endpoints require HTTP Basic Auth with credentials:
- Username: `admin`
- Password: Value of `ADMIN_PASSWORD` env var

**Example header:**
```
Authorization: Basic YWRtaW46cGFzc3dvcmQxMjM=
```

#### POST `/api/admin/login`
Verify admin credentials.

**Response:** `200 OK`
```json
{ "authenticated": true }
```

#### GET `/api/admin/stats`
Get overall platform statistics.

**Response:** `200 OK`
```json
{
  "totalUsers": 42,
  "signupsToday": 3,
  "signupsThisMonth": 18,
  "totalLogins": 234,
  "pageViews": 1205
}
```

#### GET `/api/admin/stats/extended`
Get detailed analytics.

**Response:** `200 OK`
```json
{
  "totalUsers": 42,
  "activeUsersLast7days": 28,
  "activeUsersLast30days": 38,
  "retentionRate": 0.85,
  "databaseSize": "2.5 MB",
  "uptimeDays": 45
}
```

#### GET `/api/admin/chart?days=30`
Get event counts by day for charting.

**Response:** `200 OK`
```json
[
  { "date": "2026-03-01", "count": 42 },
  { "date": "2026-03-02", "count": 38 },
  /* ... */
]
```

#### GET `/api/admin/users`
List all users with basic info.

**Response:** `200 OK`
```json
[
  {
    "id": "user_abc123",
    "email": "user@example.com",
    "name": "John Doe",
    "created_at": "2026-01-15T10:30:00Z",
    "lastLogin": "2026-03-06T09:45:00Z"
  },
  /* ... */
]
```

#### GET `/api/admin/events?limit=50`
Get recent analytics events.

**Response:** `200 OK`
```json
[
  {
    "event_type": "login",
    "user_id": "user_abc123",
    "created_at": "2026-03-06T09:45:00Z"
  },
  /* ... */
]
```

#### GET `/api/admin/user/:id`
Get detailed info for a specific user.

**Response:** `200 OK`
```json
{
  "id": "user_abc123",
  "email": "user@example.com",
  "name": "John Doe",
  "signupDate": "2026-01-15T10:30:00Z",
  "lastLogin": "2026-03-06T09:45:00Z",
  "loginCount": 12,
  "dataSize": "245 KB",
  "transactionCount": 87
}
```

#### DELETE `/api/admin/user/:id`
Delete a user and all their data (irreversible).

**Response:** `200 OK`
**Warning:** This is permanent

#### PUT `/api/admin/user/:id/reset-password`
Reset user's password to a temporary one.

**Request:**
```json
{
  "tempPassword": "TempPass123!"
}
```

**Response:** `200 OK`

#### GET `/api/admin/countries`
Get user signups by country.

**Response:** `200 OK`
```json
[
  { "country": "United States", "count": 24 },
  { "country": "Canada", "count": 6 },
  /* ... */
]
```

#### GET `/api/admin/peak-hours`
Get login activity by hour of day.

**Response:** `200 OK`
```json
[
  { "hour": 0, "count": 5 },
  { "hour": 1, "count": 3 },
  /* ... hour 0-23 ... */
]
```

#### GET `/api/admin/browsers`
Get user agent statistics.

**Response:** `200 OK`
```json
[
  { "browser": "Chrome", "count": 28 },
  { "browser": "Firefox", "count": 8 },
  /* ... */
]
```

#### GET `/api/admin/growth`
Get user signups over time.

**Response:** `200 OK`
```json
[
  { "date": "2026-01-01", "cumulativeUsers": 10, "newSignups": 3 },
  { "date": "2026-01-02", "cumulativeUsers": 12, "newSignups": 2 },
  /* ... */
]
```

#### GET `/api/admin/export/users`
Export all users to CSV.

**Response:** `200 OK` (CSV file download)

#### GET `/api/admin/export/events`
Export all events to CSV.

**Response:** `200 OK` (CSV file download)

---

## ⚙️ Environment Variables

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| `PORT` | No | `5175` | Server port (default: 5175) |
| `JWT_SECRET` | **Yes** | `super_secret_key_here` | JWT signing secret |
| `GOOGLE_CLIENT_ID` | No | `abc123...` | Google OAuth client ID |
| `FACEBOOK_APP_ID` | No | `abc123...` | Facebook app ID |
| `GITHUB_CLIENT_ID` | No | `abc123...` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | No | `secret...` | GitHub OAuth secret |
| `ADMIN_PASSWORD` | No | `admin123` | Admin dashboard password |
| `NODE_ENV` | No | `production` | Set to `production` for deployment |

---

## 📊 Security Best Practices

### Production Checklist
- [ ] **JWT_SECRET**: Generate strong random secret (min 32 chars)
- [ ] **ADMIN_PASSWORD**: Change from default
- [ ] **HTTPS**: Always use HTTPS in production
- [ ] **CORS**: Configure for your domain only
- [ ] **Database**: Backup regularly
- [ ] **Dependencies**: Run `npm audit` and update regularly
- [ ] **Logs**: Monitor error logs
- [ ] **Rate Limiting**: Consider adding rate limit middleware
- [ ] **Environment**: Use `.env` file (never commit secrets)
- [ ] **OAuth Credentials**: Keep secret keys private

### Implemented Security Features
✅ Password hashing with bcryptjs (10 rounds)
✅ JWT token expiry (30 days)
✅ Per-user data isolation
✅ Helmet.js headers
✅ CORS configuration
✅ Input validation
✅ Error messages don't leak info
✅ WAL mode for SQLite (better concurrency)
✅ Foreign key constraints enabled

---

## Troubleshooting

### Database locked error
- SQLite WAL mode is enabled (good for concurrency)
- If persistent, check for long-running queries
- Restart server: `npm start`

### JWT token invalid/expired
- Tokens expire after 30 days
- User must re-login
- Check `JWT_SECRET` matches between server restart

### OAuth not working
- Verify client IDs in `.env`
- Check redirect URIs configured in OAuth apps
- Ensure HTTPS in production
- Check browser console for specific errors

### Memory leak on long uptime
- Process all user data requests asynchronously
- Monitor with `node --max-old-space-size=2048 server.js`
- Consider adding process monitoring (PM2)

---

## Deployment

### Using PM2 (Process Manager)
```bash
npm install -g pm2
pm2 start server.js --name "jentrak"
pm2 startup
pm2 save
```

### Using Docker
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5175
CMD ["npm", "start"]
```

```bash
docker build -t jentrak .
docker run -p 5175:5175 -e JWT_SECRET=your_secret jentrak
```

### Using systemd (Linux)
Create `/etc/systemd/system/jentrak.service`:
```ini
[Unit]
Description=Jentrak Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/server
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable jentrak
sudo systemctl start jentrak
```

---

## License

Open source — use, modify, and share!

---

## 📧 Support

Issues? Contact Jennifer:
- **Email**: jenbrox@gmail.com
- **GitHub**: https://github.com/jenbrox
- **LinkedIn**: https://www.linkedin.com/in/jenniferbroxson
