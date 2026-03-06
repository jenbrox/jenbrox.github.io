'use strict';

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const https = require('https');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const { OAuth2Client } = require('google-auth-library');

// ── Load .env file if present ──
const envPath = path.join(__dirname, '.env');
try {
  const envContent = require('fs').readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
} catch {}

// ── Config ──
const PORT = process.env.PORT || 5175;
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_EXPIRY = '30d';
const SALT_ROUNDS = 10;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '';
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID || '';
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET || '';

const googleClient = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

// ── Database ──
const DB_PATH = path.join(__dirname, 'jentrak.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT,
    auth_provider TEXT DEFAULT 'local',
    auth_provider_id TEXT,
    avatar_url TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_data (
    user_id TEXT NOT NULL,
    store_key TEXT NOT NULL,
    data TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, store_key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS analytics_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    ip TEXT,
    user_agent TEXT,
    user_id TEXT,
    meta TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// ── Migrate existing tables (add columns if missing) ──
try {
  const cols = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!cols.includes('auth_provider')) {
    db.exec("ALTER TABLE users ADD COLUMN auth_provider TEXT DEFAULT 'local'");
  }
  if (!cols.includes('auth_provider_id')) {
    db.exec("ALTER TABLE users ADD COLUMN auth_provider_id TEXT");
  }
  if (!cols.includes('avatar_url')) {
    db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
  }
  if (!cols.includes('signup_ip')) {
    db.exec("ALTER TABLE users ADD COLUMN signup_ip TEXT");
  }
  if (!cols.includes('country')) {
    db.exec("ALTER TABLE users ADD COLUMN country TEXT");
  }
} catch {}

// Prepared statements
const stmts = {
  findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findUserById: db.prepare('SELECT id, email, name, auth_provider, avatar_url, created_at FROM users WHERE id = ?'),
  findByProvider: db.prepare('SELECT * FROM users WHERE auth_provider = ? AND auth_provider_id = ?'),
  createUser: db.prepare('INSERT INTO users (id, email, name, password_hash, auth_provider, auth_provider_id, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)'),
  updatePassword: db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"),
  updateProfile: db.prepare("UPDATE users SET name = ?, email = ?, updated_at = datetime('now') WHERE id = ?"),
  linkProvider: db.prepare("UPDATE users SET auth_provider = ?, auth_provider_id = ?, avatar_url = COALESCE(?, avatar_url), updated_at = datetime('now') WHERE id = ?"),
  getData: db.prepare('SELECT data FROM user_data WHERE user_id = ? AND store_key = ?'),
  upsertData: db.prepare(`
    INSERT INTO user_data (user_id, store_key, data, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, store_key)
    DO UPDATE SET data = excluded.data, updated_at = datetime('now')
  `),
  getAllData: db.prepare('SELECT store_key, data FROM user_data WHERE user_id = ?'),
  deleteAllData: db.prepare('DELETE FROM user_data WHERE user_id = ?'),
  deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),
  // Analytics
  insertEvent: db.prepare('INSERT INTO analytics_events (event, ip, user_agent, user_id, meta) VALUES (?, ?, ?, ?, ?)'),
  countEvents: db.prepare('SELECT event, COUNT(*) as count FROM analytics_events GROUP BY event'),
  countEventsByDay: db.prepare("SELECT date(created_at) as day, event, COUNT(*) as count FROM analytics_events WHERE created_at >= datetime('now', ?) GROUP BY day, event ORDER BY day"),
  recentEvents: db.prepare('SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT ?'),
  countUsers: db.prepare('SELECT COUNT(*) as count FROM users'),
  recentUsers: db.prepare('SELECT id, email, name, auth_provider, signup_ip, country, created_at FROM users ORDER BY created_at DESC LIMIT ?'),
  allUsers: db.prepare('SELECT id, email, name, auth_provider, signup_ip, country, created_at FROM users ORDER BY created_at DESC'),
  updateUserGeo: db.prepare("UPDATE users SET signup_ip = ?, country = ? WHERE id = ?"),
};

// ── Admin Config ──
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'Jentrak123@';

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket.remoteAddress || '';
}

function trackEvent(event, req, userId, meta) {
  try {
    const ip = getClientIp(req);
    const ua = req.headers['user-agent'] || '';
    stmts.insertEvent.run(event, ip, ua, userId || null, meta ? JSON.stringify(meta) : null);
  } catch {}
}

// Look up country from IP using free API (non-blocking, best-effort)
function lookupGeo(ip, userId) {
  if (!ip || ip === '127.0.0.1' || ip === '::1') return;
  const cleanIp = ip.replace('::ffff:', '');
  httpsGetJson(`https://ipapi.co/${encodeURIComponent(cleanIp)}/json/`)
    .then(data => {
      if (data && data.country_name) {
        stmts.updateUserGeo.run(cleanIp, data.country_name, userId);
      } else {
        stmts.updateUserGeo.run(cleanIp, null, userId);
      }
    })
    .catch(() => {
      stmts.updateUserGeo.run(cleanIp, null, userId);
    });
}

// ── Express App ──
const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from parent directory (expense-tracker/)
app.use(express.static(path.join(__dirname, '..')));

// ── Auth Middleware ──
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function generateToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function userResponse(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url || null,
    auth_provider: user.auth_provider || 'local',
  };
}

// Find or create a user from social login
function findOrCreateSocialUser(provider, providerId, email, name, avatarUrl) {
  // 1. Check if user already exists by provider+id
  let user = stmts.findByProvider.get(provider, providerId);
  if (user) return { user, isNew: false };

  // 2. Check if user exists by email (link accounts)
  user = stmts.findUserByEmail.get(email);
  if (user) {
    // Link social provider to existing account if it was local or different
    if (user.auth_provider === 'local' || user.auth_provider !== provider) {
      stmts.linkProvider.run(provider, providerId, avatarUrl, user.id);
    }
    return { user: stmts.findUserByEmail.get(email), isNew: false };
  }

  // 3. Create new user
  const id = 'user_' + crypto.randomBytes(12).toString('hex');
  stmts.createUser.run(id, email.toLowerCase(), name, null, provider, providerId, avatarUrl);
  return { user: stmts.findUserByEmail.get(email), isNew: true };
}

// ── Helper: fetch JSON over HTTPS ──
function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON response')); }
      });
    }).on('error', reject);
  });
}

function httpsPost(url, postData, headers) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...headers },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON response')); }
      });
    });
    req.on('error', reject);
    req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    req.end();
  });
}

// ── Auth Routes ──
app.post('/api/auth/signup', (req, res) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    return res.status(400).json({ error: 'Email, name, and password are required' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email address' });
  }

  const existing = stmts.findUserByEmail.get(email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const id = 'user_' + crypto.randomBytes(12).toString('hex');
  const hash = bcrypt.hashSync(password, SALT_ROUNDS);
  stmts.createUser.run(id, email.trim().toLowerCase(), name.trim(), hash, 'local', null, null);

  const user = { id, email: email.trim().toLowerCase(), name: name.trim() };
  const token = generateToken(user);

  trackEvent('signup', req, id, { provider: 'local' });
  lookupGeo(getClientIp(req), id);
  res.status(201).json({ token, user: userResponse({ ...user, auth_provider: 'local' }) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = stmts.findUserByEmail.get(email.trim().toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // If user signed up with social only (no password), tell them
  if (!user.password_hash) {
    const provider = user.auth_provider || 'social';
    return res.status(401).json({ error: `This account uses ${provider} sign-in. Please use the "${provider}" button.` });
  }

  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user);
  trackEvent('login', req, user.id, { provider: 'local' });
  res.json({ token, user: userResponse(user) });
});

// ── Google Sign-In ──
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;
  if (!credential) return res.status(400).json({ error: 'Google credential is required' });

  if (!googleClient) {
    return res.status(500).json({ error: 'Google sign-in is not configured on this server' });
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub, email, name, picture } = payload;

    if (!email) return res.status(400).json({ error: 'Google account has no email' });

    const { user, isNew } = findOrCreateSocialUser('google', sub, email, name || email.split('@')[0], picture);
    const token = generateToken(user);
    trackEvent(isNew ? 'signup' : 'login', req, user.id, { provider: 'google' });
    if (isNew) lookupGeo(getClientIp(req), user.id);
    res.json({ token, user: userResponse(user) });
  } catch (err) {
    console.error('[Auth] Google verification failed:', err.message);
    res.status(401).json({ error: 'Invalid Google credential' });
  }
});

// ── Facebook Login ──
app.post('/api/auth/facebook', async (req, res) => {
  const { accessToken } = req.body;
  if (!accessToken) return res.status(400).json({ error: 'Facebook access token is required' });

  try {
    const fbUser = await httpsGetJson(
      `https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`
    );

    if (fbUser.error) {
      return res.status(401).json({ error: fbUser.error.message || 'Invalid Facebook token' });
    }

    const { id, name, email, picture } = fbUser;
    if (!email) {
      return res.status(400).json({ error: 'Facebook account has no email. Please grant email permission.' });
    }

    const avatarUrl = picture?.data?.url || null;
    const { user, isNew } = findOrCreateSocialUser('facebook', id, email, name || 'User', avatarUrl);
    const token = generateToken(user);
    trackEvent(isNew ? 'signup' : 'login', req, user.id, { provider: 'facebook' });
    if (isNew) lookupGeo(getClientIp(req), user.id);
    res.json({ token, user: userResponse(user) });
  } catch (err) {
    console.error('[Auth] Facebook verification failed:', err.message);
    res.status(401).json({ error: 'Facebook authentication failed' });
  }
});

// ── GitHub OAuth ──
app.post('/api/auth/github', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'GitHub authorization code is required' });

  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    return res.status(500).json({ error: 'GitHub sign-in is not configured on this server' });
  }

  try {
    // Exchange code for access token
    const tokenRes = await httpsPost(
      'https://github.com/login/oauth/access_token',
      { client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code },
      { 'Accept': 'application/json' }
    );

    if (tokenRes.error || !tokenRes.access_token) {
      return res.status(401).json({ error: tokenRes.error_description || 'GitHub token exchange failed' });
    }

    // Fetch user profile
    const ghUser = await httpsGetJson(`https://api.github.com/user`).catch(() => null);
    // Actually need to pass auth header — use a direct request
    const ghProfile = await new Promise((resolve, reject) => {
      https.get('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${tokenRes.access_token}`,
          'User-Agent': 'Jentrak-App',
          'Accept': 'application/json',
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      }).on('error', reject);
    });

    if (!ghProfile || ghProfile.message) {
      return res.status(401).json({ error: 'Failed to fetch GitHub profile' });
    }

    // Fetch email if not public
    let email = ghProfile.email;
    if (!email) {
      const emails = await new Promise((resolve, reject) => {
        https.get('https://api.github.com/user/emails', {
          headers: {
            'Authorization': `Bearer ${tokenRes.access_token}`,
            'User-Agent': 'Jentrak-App',
            'Accept': 'application/json',
          },
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); }
            catch { resolve([]); }
          });
        }).on('error', () => resolve([]));
      });
      const primary = Array.isArray(emails) ? emails.find(e => e.primary && e.verified) || emails[0] : null;
      email = primary?.email;
    }

    if (!email) {
      return res.status(400).json({ error: 'No email found on your GitHub account. Please add a public email.' });
    }

    const { user, isNew } = findOrCreateSocialUser(
      'github',
      String(ghProfile.id),
      email,
      ghProfile.name || ghProfile.login,
      ghProfile.avatar_url
    );
    const token = generateToken(user);
    trackEvent(isNew ? 'signup' : 'login', req, user.id, { provider: 'github' });
    if (isNew) lookupGeo(getClientIp(req), user.id);
    res.json({ token, user: userResponse(user) });
  } catch (err) {
    console.error('[Auth] GitHub verification failed:', err.message);
    res.status(401).json({ error: 'GitHub authentication failed' });
  }
});

// ── Social config endpoint (tells frontend which providers are enabled) ──
app.get('/api/auth/providers', (req, res) => {
  res.json({
    google: !!GOOGLE_CLIENT_ID,
    facebook: !!FACEBOOK_APP_ID,
    github: !!GITHUB_CLIENT_ID,
    google_client_id: GOOGLE_CLIENT_ID || null,
    facebook_app_id: FACEBOOK_APP_ID || null,
    github_client_id: GITHUB_CLIENT_ID || null,
  });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = stmts.findUserById.get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: userResponse(user) });
});

app.put('/api/auth/profile', authenticate, (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required' });

  const emailLower = email.trim().toLowerCase();
  const existing = stmts.findUserByEmail.get(emailLower);
  if (existing && existing.id !== req.userId) {
    return res.status(409).json({ error: 'Email already in use by another account' });
  }

  stmts.updateProfile.run(name.trim(), emailLower, req.userId);
  res.json({ user: { id: req.userId, email: emailLower, name: name.trim() } });
});

app.put('/api/auth/password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const user = stmts.findUserByEmail.get(req.userEmail);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }

  const hash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
  stmts.updatePassword.run(hash, req.userId);
  res.json({ message: 'Password updated' });
});

app.put('/api/auth/avatar', authenticate, (req, res) => {
  const { avatar } = req.body;
  if (!avatar) return res.status(400).json({ error: 'Avatar data is required' });

  // Validate it's a data URL image and check size (~10MB base64 ≈ 13.3MB string)
  if (!avatar.startsWith('data:image/')) {
    return res.status(400).json({ error: 'Invalid image format' });
  }
  if (avatar.length > 14 * 1024 * 1024) {
    return res.status(400).json({ error: 'Image too large. Maximum 10MB.' });
  }

  db.prepare("UPDATE users SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?").run(avatar, req.userId);
  res.json({ avatar_url: avatar });
});

app.delete('/api/auth/avatar', authenticate, (req, res) => {
  db.prepare("UPDATE users SET avatar_url = NULL, updated_at = datetime('now') WHERE id = ?").run(req.userId);
  res.json({ success: true });
});

// ── Data Routes (user-scoped) ──
const VALID_STORES = ['transactions', 'categories', 'settings', 'recurring', 'goals', 'debts', 'wishlist', 'accounts'];

app.get('/api/data', authenticate, (req, res) => {
  const rows = stmts.getAllData.all(req.userId);
  const result = {};
  for (const row of rows) {
    try { result[row.store_key] = JSON.parse(row.data); }
    catch { result[row.store_key] = row.data; }
  }
  res.json(result);
});

app.get('/api/data/:store', authenticate, (req, res) => {
  const { store } = req.params;
  if (!VALID_STORES.includes(store)) return res.status(400).json({ error: 'Invalid store' });

  const row = stmts.getData.get(req.userId, store);
  if (!row) return res.json({ data: store === 'settings' ? null : [] });

  try { res.json({ data: JSON.parse(row.data) }); }
  catch { res.json({ data: row.data }); }
});

app.put('/api/data/:store', authenticate, (req, res) => {
  const { store } = req.params;
  if (!VALID_STORES.includes(store)) return res.status(400).json({ error: 'Invalid store' });

  const { data } = req.body;
  if (data === undefined) return res.status(400).json({ error: 'Data is required' });

  stmts.upsertData.run(req.userId, store, JSON.stringify(data));
  res.json({ success: true });
});

app.put('/api/data', authenticate, (req, res) => {
  const { stores } = req.body;
  if (!stores || typeof stores !== 'object') return res.status(400).json({ error: 'Stores object is required' });

  const upsertMany = db.transaction((userId, stores) => {
    for (const [key, data] of Object.entries(stores)) {
      if (VALID_STORES.includes(key)) {
        stmts.upsertData.run(userId, key, JSON.stringify(data));
      }
    }
  });

  upsertMany(req.userId, stores);
  res.json({ success: true });
});

app.delete('/api/data', authenticate, (req, res) => {
  stmts.deleteAllData.run(req.userId);
  res.json({ success: true });
});

// ── Page visit tracking ──
app.post('/api/track', (req, res) => {
  const { event, meta } = req.body;
  const allowed = ['page_view', 'link_click'];
  if (!event || !allowed.includes(event)) return res.status(400).json({ error: 'Invalid event' });
  trackEvent(event, req, null, meta);
  res.json({ ok: true });
});

// ── Admin Auth Middleware ──
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }
  const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
  const [user, pass] = decoded.split(':');
  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
  next();
}

// ── Admin API Routes ──
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const adminToken = Buffer.from(`${username}:${password}`).toString('base64');
  res.json({ token: adminToken });
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const events = stmts.countEvents.all();
  const userCount = stmts.countUsers.get().count;
  const eventMap = {};
  for (const e of events) eventMap[e.event] = e.count;

  res.json({
    total_users: userCount,
    total_signups: eventMap['signup'] || 0,
    total_logins: eventMap['login'] || 0,
    total_page_views: eventMap['page_view'] || 0,
    total_link_clicks: eventMap['link_click'] || 0,
  });
});

app.get('/api/admin/chart', adminAuth, (req, res) => {
  const days = req.query.days || '30';
  const rows = stmts.countEventsByDay.all(`-${parseInt(days)} days`);
  res.json(rows);
});

app.get('/api/admin/users', adminAuth, (req, res) => {
  const users = stmts.allUsers.all();
  res.json(users);
});

app.get('/api/admin/events', adminAuth, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const events = stmts.recentEvents.all(limit);
  res.json(events);
});

app.get('/api/admin/stats/extended', adminAuth, (req, res) => {
  try {
    const fs = require('fs');
    const totalUsers = stmts.countUsers.get().count;

    const active7d = db.prepare(
      "SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE event = 'login' AND created_at >= datetime('now', '-7 days')"
    ).get().count;

    const active30d = db.prepare(
      "SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE event = 'login' AND created_at >= datetime('now', '-30 days')"
    ).get().count;

    const inactiveUsers = totalUsers - active30d;

    const totalWithLogins = db.prepare(
      "SELECT COUNT(DISTINCT user_id) as count FROM analytics_events WHERE event = 'login'"
    ).get().count;

    const multiLoginUsers = db.prepare(
      "SELECT COUNT(*) as count FROM (SELECT user_id FROM analytics_events WHERE event = 'login' GROUP BY user_id HAVING COUNT(*) > 1)"
    ).get().count;

    const retentionRate = totalWithLogins > 0 ? Math.round((multiLoginUsers / totalWithLogins) * 10000) / 100 : 0;

    const dbSize = fs.statSync(DB_PATH).size;
    const uptime = process.uptime();

    const usersCount = totalUsers;
    const userDataCount = db.prepare('SELECT COUNT(*) as count FROM user_data').get().count;
    const eventsCount = db.prepare('SELECT COUNT(*) as count FROM analytics_events').get().count;

    res.json({
      active_7d: active7d,
      active_30d: active30d,
      inactive_users: inactiveUsers,
      retention_rate: retentionRate,
      db_size: dbSize,
      uptime,
      table_counts: { users: usersCount, user_data: userDataCount, analytics_events: eventsCount },
    });
  } catch (err) {
    console.error('[Admin] Extended stats error:', err.message);
    res.status(500).json({ error: 'Failed to fetch extended stats' });
  }
});

app.get('/api/admin/user/:id', adminAuth, (req, res) => {
  try {
    const userId = req.params.id;
    const user = db.prepare('SELECT id, email, name, auth_provider, signup_ip, country, created_at FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const lastLogin = db.prepare(
      "SELECT created_at FROM analytics_events WHERE event = 'login' AND user_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(userId);

    const loginCount = db.prepare(
      "SELECT COUNT(*) as count FROM analytics_events WHERE event = 'login' AND user_id = ?"
    ).get(userId).count;

    const dataRows = db.prepare('SELECT store_key, data FROM user_data WHERE user_id = ?').all(userId);
    const dataUsage = dataRows.map(row => {
      let itemCount = 0;
      try {
        const parsed = JSON.parse(row.data);
        itemCount = Array.isArray(parsed) ? parsed.length : 1;
      } catch {}
      return { store_key: row.store_key, item_count: itemCount };
    });

    const loginHistory = db.prepare(
      "SELECT created_at, ip, user_agent FROM analytics_events WHERE event = 'login' AND user_id = ? ORDER BY created_at DESC LIMIT 20"
    ).all(userId);

    res.json({
      user,
      last_login: lastLogin ? lastLogin.created_at : null,
      login_count: loginCount,
      data_usage: dataUsage,
      login_history: loginHistory,
    });
  } catch (err) {
    console.error('[Admin] User detail error:', err.message);
    res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

app.delete('/api/admin/user/:id', adminAuth, (req, res) => {
  try {
    const userId = req.params.id;
    stmts.deleteAllData.run(userId);
    stmts.deleteUser.run(userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Delete user error:', err.message);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.put('/api/admin/user/:id/reset-password', adminAuth, (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const hash = bcrypt.hashSync(newPassword, SALT_ROUNDS);
    stmts.updatePassword.run(hash, userId);
    res.json({ success: true });
  } catch (err) {
    console.error('[Admin] Reset password error:', err.message);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

app.get('/api/admin/countries', adminAuth, (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT country, COUNT(*) as count FROM users WHERE country IS NOT NULL GROUP BY country ORDER BY count DESC'
    ).all();
    res.json(rows);
  } catch (err) {
    console.error('[Admin] Countries error:', err.message);
    res.status(500).json({ error: 'Failed to fetch country data' });
  }
});

app.get('/api/admin/peak-hours', adminAuth, (req, res) => {
  try {
    const rows = db.prepare(
      "SELECT strftime('%H', created_at) as hour, COUNT(*) as count FROM analytics_events WHERE event IN ('login', 'page_view') GROUP BY hour ORDER BY hour"
    ).all();
    res.json(rows);
  } catch (err) {
    console.error('[Admin] Peak hours error:', err.message);
    res.status(500).json({ error: 'Failed to fetch peak hours data' });
  }
});

app.get('/api/admin/browsers', adminAuth, (req, res) => {
  try {
    const rows = db.prepare(
      "SELECT user_agent, COUNT(*) as count FROM analytics_events WHERE user_agent IS NOT NULL AND user_agent != '' GROUP BY user_agent ORDER BY count DESC LIMIT 50"
    ).all();
    res.json(rows);
  } catch (err) {
    console.error('[Admin] Browsers error:', err.message);
    res.status(500).json({ error: 'Failed to fetch browser data' });
  }
});

app.get('/api/admin/growth', adminAuth, (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT date(created_at) as day, COUNT(*) as count FROM users GROUP BY day ORDER BY day'
    ).all();
    res.json(rows);
  } catch (err) {
    console.error('[Admin] Growth error:', err.message);
    res.status(500).json({ error: 'Failed to fetch growth data' });
  }
});

app.get('/api/admin/export/users', adminAuth, (req, res) => {
  try {
    const users = stmts.allUsers.all();
    let csv = 'Name,Email,Provider,Country,IP,Joined\n';
    for (const u of users) {
      const name = (u.name || '').replace(/"/g, '""');
      const email = (u.email || '').replace(/"/g, '""');
      const provider = (u.auth_provider || '').replace(/"/g, '""');
      const country = (u.country || '').replace(/"/g, '""');
      const ip = (u.signup_ip || '').replace(/"/g, '""');
      const joined = (u.created_at || '').replace(/"/g, '""');
      csv += `"${name}","${email}","${provider}","${country}","${ip}","${joined}"\n`;
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users_export.csv"');
    res.send(csv);
  } catch (err) {
    console.error('[Admin] Export users error:', err.message);
    res.status(500).json({ error: 'Failed to export users' });
  }
});

app.get('/api/admin/export/events', adminAuth, (req, res) => {
  try {
    const events = db.prepare('SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT 1000').all();
    let csv = 'Event,IP,User Agent,User ID,Meta,Time\n';
    for (const e of events) {
      const event = (e.event || '').replace(/"/g, '""');
      const ip = (e.ip || '').replace(/"/g, '""');
      const ua = (e.user_agent || '').replace(/"/g, '""');
      const userId = (e.user_id || '').replace(/"/g, '""');
      const meta = (e.meta || '').replace(/"/g, '""');
      const time = (e.created_at || '').replace(/"/g, '""');
      csv += `"${event}","${ip}","${ua}","${userId}","${meta}","${time}"\n`;
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="events_export.csv"');
    res.send(csv);
  } catch (err) {
    console.error('[Admin] Export events error:', err.message);
    res.status(500).json({ error: 'Failed to export events' });
  }
});

// ── Serve admin page ──
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, '..', 'admin.html')));

// ── SPA fallback: serve index.html for non-API, non-file routes ──
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, '..', 'signup.html')));

// ── Start ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Jentrak] Server running on http://0.0.0.0:${PORT}`);
  console.log(`[Jentrak] Social providers: Google=${!!GOOGLE_CLIENT_ID}, Facebook=${!!FACEBOOK_APP_ID}, GitHub=${!!GITHUB_CLIENT_ID}`);
});
