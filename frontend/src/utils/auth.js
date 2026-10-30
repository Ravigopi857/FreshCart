/**
 * auth.js — Centralised authentication token & user helpers.
 *
 * Storage strategy:
 *   - localStorage  → persists across page refreshes and browser restarts.
 *   - sessionStorage was the original choice but clears on tab/window close,
 *     breaking admin workflows after a page refresh (Bug #1).
 *
 * Security note: localStorage is susceptible to XSS just like sessionStorage.
 * The meaningful mitigation is a strict Content-Security-Policy header on the
 * server (not implemented here but documented in .env.example) and
 * short-lived tokens.  HttpOnly cookies would be the next step up, but they
 * require a same-origin or CORS-credentialed setup that is out of scope for
 * this refactor.  Tokens expire after 7 days (set in authRoutes.js).
 */

const TOKEN_KEY = "freshcart_token";
const USER_KEY = "freshcart_user";

/** Store authentication data after a successful login. */
export function saveAuth(token, user) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // Private browsing with storage blocked — fall back to sessionStorage.
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

/** Read the JWT token. Returns null when not logged in. */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

/** Read the persisted user object. Returns null when not logged in. */
export function getSavedUser() {
  try {
    const raw =
      localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Remove all authentication data (logout). */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

/**
 * Return an Axios-compatible Authorization header object,
 * or an empty object if no token is stored.
 */
export function authHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

