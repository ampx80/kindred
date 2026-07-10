// Client account layer: holds the session token + account, talks to /api/auth,
// and notifies subscribers on sign-in / sign-out. Token lives in localStorage so
// a returning user stays signed in. Local-first stays the anonymous default;
// creating an account upgrades the same life to durable + cross-device.
const TOKEN_KEY = 'kindred_token';
const ACCT_KEY = 'kindred_account';

let token = null;
let account = null;
try {
  token = localStorage.getItem(TOKEN_KEY) || null;
  account = JSON.parse(localStorage.getItem(ACCT_KEY) || 'null');
} catch {}

const subs = new Set();
const emit = () => subs.forEach(fn => fn(account));

export function onAccount(fn) { subs.add(fn); fn(account); return () => subs.delete(fn); }
export function getAccount() { return account; }
export function getToken() { return token; }
export function isSignedIn() { return !!token; }

function persist() {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
    if (account) localStorage.setItem(ACCT_KEY, JSON.stringify(account)); else localStorage.removeItem(ACCT_KEY);
  } catch {}
}

async function call(action, payload) {
  const r = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.ok) throw new Error(j.error || 'Something went wrong. Try again.');
  return j;
}

export async function signup(email, password) {
  const j = await call('signup', { email, password });
  token = j.token; account = j.account; persist(); emit(); return j;
}
export async function login(email, password) {
  const j = await call('login', { email, password });
  token = j.token; account = j.account; persist(); emit(); return j;
}
export function logout() { token = null; account = null; persist(); emit(); }

// Used by Settings after a server-side account delete.
export function forgetAccountLocal() { token = null; account = null; persist(); emit(); }

export function authHeader() { return token ? { Authorization: `Bearer ${token}` } : {}; }
