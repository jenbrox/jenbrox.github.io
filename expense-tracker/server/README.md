# Jentrak Backend -- API Reference

Node.js + Express.js + SQLite backend for the Jentrak expense tracker.


---

## Quick Start

```bash
cd expense-tracker/server
npm install
npm start
```

Server starts on http://localhost:5175. SQLite database is created automatically at jentrak.db.

Create a .env file:

```
JWT_SECRET=replace_with_a_strong_random_string
GOOGLE_CLIENT_ID=
FACEBOOK_APP_ID=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
ADMIN_PASSWORD=replace_with_a_strong_password
```


---

## Technology

- Runtime: Node.js 14+
- Framework: Express.js 4.x
- Database: SQLite3 via better-sqlite3, WAL mode, foreign keys enabled
- Authentication: JWT (jsonwebtoken) with bcryptjs for password hashing
- OAuth: Google (google-auth-library), Facebook (Graph API), GitHub (code exchange)
- Security: Helmet.js for HTTP headers, CORS middleware
- Default port: 5175 (override with PORT environment variable)


---

## Database Schema

### users

Stores account credentials and profile information.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT,
  auth_provider TEXT DEFAULT 'local',
  auth_provider_id TEXT,
  avatar_url TEXT,
  signup_ip TEXT,
  country TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

password_hash is null for OAuth-only users. country is filled by a best-effort IP geolocation lookup on signup.

### user_data

Stores all application data for each user as JSON strings. The composite primary key of (user_id, store_key) means each user has one row per store.

```sql
CREATE TABLE user_data (
  user_id TEXT NOT NULL,
  store_key TEXT NOT NULL,
  data TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, store_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

Valid store keys: transactions, categories, settings, recurring, goals, debts, wishlist, accounts.

### analytics_events

Tracks user activity for the admin dashboard.

```sql
CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  user_id TEXT,
  meta TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Event types: signup, login, page_view, link_click.


---

## Authentication Flow

### JWT tokens

All authenticated endpoints require an Authorization header:

```
Authorization: Bearer <token>
```

Tokens are signed with HS256 using the JWT_SECRET environment variable and expire after 30 days. The payload contains userId and email.

If a request returns HTTP 401, the client should discard the stored token and redirect to the login page.

### Password hashing

Passwords are hashed with bcryptjs using 10 salt rounds before storage. The original password is never stored or logged.

### OAuth

Each OAuth provider follows the same server-side pattern:

1. Client sends a provider-specific token or code to the server.
2. Server verifies it with the provider's API.
3. Server creates or updates the user record.
4. Server issues a JWT and returns it with the user profile.

Google requires a GOOGLE_CLIENT_ID. The server verifies the ID token using google-auth-library.

Facebook requires a FACEBOOK_APP_ID. The server exchanges the access token for a user profile via the Graph API.

GitHub requires GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET. The server exchanges the authorisation code for an access token, then fetches the user profile and email.


---

## API Endpoints

### Authentication (no token required)

POST /api/auth/signup
- Body: { email, name, password }
- Password must be at least 6 characters.
- Returns: { token, user }

POST /api/auth/login
- Body: { email, password }
- Returns: { token, user }

POST /api/auth/google
- Body: { idToken }
- Returns: { token, user }

POST /api/auth/facebook
- Body: { accessToken }
- Returns: { token, user }

POST /api/auth/github
- Body: { code }
- Returns: { token, user }

GET /api/auth/providers
- Returns: { google: bool, facebook: bool, github: bool }
- Indicates which OAuth providers have credentials configured.

### Authentication (token required)

GET /api/auth/me
- Returns: { user }

PUT /api/auth/profile
- Body: { name, email }
- Returns: { user }

PUT /api/auth/password
- Body: { oldPassword, newPassword }
- Only available for users with auth_provider "local".

PUT /api/auth/avatar
- Body: { avatar } (base64-encoded image, max 10 MB)
- Returns: { user }

DELETE /api/auth/avatar
- Removes the user's avatar.

### User Data (token required)

All data endpoints are scoped to the authenticated user.

GET /api/data
- Returns all stores as a single object: { transactions: [...], categories: [...], ... }

GET /api/data/:store
- Returns the contents of a single store.
- Valid store names: transactions, categories, settings, recurring, goals, debts, wishlist, accounts.

PUT /api/data/:store
- Body: { data: [...] }
- Replaces the entire store.

PUT /api/data
- Body: { stores: { transactions: [...], categories: [...], ... } }
- Bulk-saves multiple stores in one request.

DELETE /api/data
- Deletes all data for the authenticated user. This is irreversible.

### Analytics (no token required)

POST /api/track
- Body: { event, meta }
- Accepted event values: page_view, link_click.
- Records the event with the client's IP and user agent.

### Admin (HTTP Basic Auth required)

All admin endpoints require an Authorization header with Basic auth. Username is "admin" and the password is the ADMIN_PASSWORD environment variable.

POST /api/admin/login
- Verifies admin credentials. Returns { authenticated: true }.

GET /api/admin/stats
- Returns total users, signups today, signups this month, total logins, and page views.

GET /api/admin/stats/extended
- Returns active users (7-day and 30-day), retention rate, database size, and uptime.

GET /api/admin/chart?days=30
- Returns event counts grouped by day for the specified period.

GET /api/admin/users
- Lists all users with ID, email, name, signup date, and last login.

GET /api/admin/events?limit=50
- Returns the most recent analytics events.

GET /api/admin/user/:id
- Returns detailed information for a specific user including login count and data size.

DELETE /api/admin/user/:id
- Deletes the user and all their data. Irreversible.

PUT /api/admin/user/:id/reset-password
- Body: { tempPassword }
- Sets the user's password to the provided value.

GET /api/admin/countries
- Returns user signups grouped by country.

GET /api/admin/peak-hours
- Returns login activity grouped by hour of day (0-23).

GET /api/admin/browsers
- Returns user agent statistics.

GET /api/admin/growth
- Returns cumulative user signups over time.

GET /api/admin/export/users
- Downloads all users as a CSV file.

GET /api/admin/export/events
- Downloads all events as a CSV file.


---

## Environment Variables

| Variable              | Required | Description                                        |
|-----------------------|----------|----------------------------------------------------|
| PORT                  | No       | Server port. Default: 5175.                        |
| JWT_SECRET            | Yes      | Secret key for signing JWT tokens.                 |
| GOOGLE_CLIENT_ID      | No       | Google OAuth client ID.                            |
| FACEBOOK_APP_ID       | No       | Facebook app ID.                                   |
| GITHUB_CLIENT_ID      | No       | GitHub OAuth client ID.                            |
| GITHUB_CLIENT_SECRET  | No       | GitHub OAuth client secret.                        |
| ADMIN_PASSWORD        | No       | Password for the admin dashboard. Default: Jentrak123@. |


---

## Deployment

### PM2 (process manager)

```bash
npm install -g pm2
pm2 start server.js --name jentrak
pm2 startup
pm2 save
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 5175
CMD ["node", "server.js"]
```

```bash
docker build -t jentrak .
docker run -p 5175:5175 -e JWT_SECRET=your_secret jentrak
```

### systemd (Linux)

Create /etc/systemd/system/jentrak.service:

```ini
[Unit]
Description=Jentrak Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/server
ExecStart=/usr/bin/node server.js
Restart=always
Environment=JWT_SECRET=your_secret

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable jentrak
sudo systemctl start jentrak
```


---

## Production Security Checklist

- Generate a JWT_SECRET of at least 32 random characters.
- Change ADMIN_PASSWORD from the default.
- Serve over HTTPS (required for OAuth).
- Configure CORS to accept only your production domain.
- Run npm audit periodically and update dependencies.
- Back up jentrak.db on a regular schedule.
- Monitor the admin dashboard for unusual signup or login patterns.


---

## Troubleshooting

Database locked errors
- WAL mode is already enabled. If the error persists, check for long-running queries or restart the server.

JWT invalid or expired
- Tokens last 30 days. The user must log in again after expiry.
- Verify JWT_SECRET has not changed between server restarts.

OAuth not working
- Confirm the client ID and secret in .env match the provider console.
- Confirm redirect URIs include the exact production URL.
- Check the server logs for the specific error message.
