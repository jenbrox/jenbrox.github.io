/* ===================================================
   JENTRAK — AUTH
   Handles authentication state and API communication.
   Must be loaded before Store.
   =================================================== */

'use strict';

const Auth = (() => {

  const TOKEN_KEY = 'jentrak_token';
  const USER_KEY = 'jentrak_user';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function isLoggedIn() {
    return !!getToken();
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = './login.html';
  }

  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = './login.html';
      return false;
    }
    return true;
  }

  function authHeaders() {
    const token = getToken();
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  }

  // ── API helpers ──

  async function apiGet(url) {
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async function apiPut(url, body) {
    const res = await fetch(url, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  // ── Data sync ──

  async function loadAllData() {
    try {
      return await apiGet('/api/data');
    } catch {
      console.warn('[Auth] Failed to load data from server, using local cache.');
      return null;
    }
  }

  async function saveStore(storeName, data) {
    try {
      await apiPut(`/api/data/${storeName}`, { data });
    } catch {
      console.warn(`[Auth] Failed to sync ${storeName} to server.`);
    }
  }

  async function saveAllStores(stores) {
    try {
      await apiPut('/api/data', { stores });
    } catch {
      console.warn('[Auth] Failed to sync all stores to server.');
    }
  }

  async function verifyToken() {
    try {
      const result = await apiGet('/api/auth/me');
      if (result && result.user) {
        localStorage.setItem(USER_KEY, JSON.stringify(result.user));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  return {
    getToken,
    getUser,
    isLoggedIn,
    logout,
    requireAuth,
    authHeaders,
    loadAllData,
    saveStore,
    saveAllStores,
    verifyToken,
  };
})();
