'use strict';

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

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
    password_hash TEXT NOT NULL,
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
`);

// Prepared statements
const stmts = {
  findUserByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findUserById: db.prepare('SELECT id, email, name, created_at FROM users WHERE id = ?'),
  createUser: db.prepare('INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)'),
  updatePassword: db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?"),
  updateProfile: db.prepare("UPDATE users SET name = ?, email = ?, updated_at = datetime('now') WHERE id = ?"),
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
};

// ── Express App ──
const app = express();

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
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
  stmts.createUser.run(id, email.trim().toLowerCase(), name.trim(), hash);

  const user = { id, email: email.trim().toLowerCase(), name: name.trim() };
  const token = generateToken(user);

  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = stmts.findUserByEmail.get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const user = stmts.findUserById.get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
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

// ── SPA fallback: serve index.html for non-API, non-file routes ──
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, '..', 'login.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(__dirname, '..', 'signup.html')));

// ── Start ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[Jentrak] Server running on http://0.0.0.0:${PORT}`);
});
