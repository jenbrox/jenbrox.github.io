/* ===================================================
   JENTRAK — AUTH

   Manages JWT authentication state and API communication.
   Responsibilities:
   - Store/retrieve JWT token from localStorage
   - Store/retrieve logged-in user info
   - Add auth headers (Bearer token) to all API requests
   - Sync app data to/from backend server
   - Handle 401 errors by redirecting to login
   - Verify token validity on app load

   Must be loaded before Store module (Store depends on Auth).
   =================================================== */

'use strict';

const Auth = (() => {

  /**
   * localStorage keys for persisting auth state
   * Token is a JWT obtained after login/signup
   * User is a JSON object with user profile info
   */
  const TOKEN_KEY = 'jentrak_token';
  const USER_KEY = 'jentrak_user';

  /**
   * Retrieves the stored JWT token from localStorage
   * @returns {string|null} JWT token or null if not logged in
   */
  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Retrieves the stored user profile object from localStorage
   * Safely parses JSON and returns null on error
   * @returns {object|null} User object {id, email, name, avatarUrl, ...} or null
   */
  function getUser() {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  /**
   * Checks if a valid token exists (user is logged in)
   * @returns {boolean} True if a token is stored locally
   */
  function isLoggedIn() {
    return !!getToken();
  }

  /**
   * Logs out the current user by removing stored token and user info
   * Redirects to login page after clearing state
   */
  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = './login.html';
  }

  /**
   * Enforces authentication requirement
   * Redirects to login page if user is not logged in
   * Call this on app init (e.g., in app.js) to protect the expense tracker
   * @returns {boolean} True if user is logged in, false if redirecting to login
   */
  function requireAuth() {
    if (!isLoggedIn()) {
      window.location.href = './login.html';
      return false;
    }
    return true;
  }

  /**
   * Builds HTTP headers with authorization info
   * Includes JWT Bearer token if logged in
   * Always includes Content-Type: application/json
   * @returns {object} Headers object ready for fetch()
   * @example
   * fetch('/api/data', { headers: authHeaders() })
   */
  function authHeaders() {
    const token = getToken();
    return token
      ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      : { 'Content-Type': 'application/json' };
  }

  /* ── API Helpers ── */

  /**
   * Makes an authenticated GET request to the API
   * Automatically includes JWT token in Authorization header
   * Logs out user if token is invalid (401 response)
   * @param {string} url - API endpoint (e.g., '/api/data')
   * @returns {Promise<object|null>} Parsed JSON response, or null on 401
   * @throws Error if response is not ok (except 401)
   */
  async function apiGet(url) {
    const res = await fetch(url, { headers: authHeaders() });
    if (res.status === 401) { logout(); return null; }
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  /**
   * Makes an authenticated PUT request to the API
   * Used for updating/saving data on the server
   * Automatically includes JWT token in Authorization header
   * Logs out user if token is invalid (401 response)
   * @param {string} url - API endpoint (e.g., '/api/data/transactions')
   * @param {object} body - Data to send (will be JSON.stringify'd)
   * @returns {Promise<object|null>} Parsed JSON response, or null on 401
   * @throws Error if response is not ok (except 401)
   */
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

  /* ── Data Sync ── */

  /**
   * Fetches all user data from the server
   * Called on app initialization to load server data into the Store
   * Server data takes priority over local cache
   * Errors are logged but don't fail (falls back to local cache)
   * @returns {Promise<object|null>} Object with all stores {transactions, categories, ...} or null on error
   */
  async function loadAllData() {
    try {
      return await apiGet('/api/data');
    } catch {
      console.warn('[Auth] Failed to load data from server, using local cache.');
      return null;
    }
  }

  /**
   * Syncs a single store (e.g., transactions) to the server
   * Called by Store.persist() after local changes
   * Errors are logged but don't block further operations
   * @param {string} storeName - Name of the store (e.g., 'transactions', 'categories')
   * @param {object} data - Store data to save
   * @returns {Promise<void>}
   */
  async function saveStore(storeName, data) {
    try {
      await apiPut(`/api/data/${storeName}`, { data });
    } catch {
      console.warn(`[Auth] Failed to sync ${storeName} to server.`);
    }
  }

  /**
   * Bulk syncs all stores to the server in one request
   * More efficient than multiple saveStore() calls
   * Used during app initialization to push local data to server
   * @param {object} stores - Object with all stores {transactions, categories, ...}
   * @returns {Promise<void>}
   */
  async function saveAllStores(stores) {
    try {
      await apiPut('/api/data', { stores });
    } catch {
      console.warn('[Auth] Failed to sync all stores to server.');
    }
  }

  /**
   * Verifies that the stored JWT token is still valid
   * Calls /api/auth/me to check token validity and fetch updated user info
   * Updates user profile in localStorage if valid
   * Called on app initialization to ensure token hasn't expired
   * @returns {Promise<boolean>} True if token is valid, false if invalid or error
   */
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
