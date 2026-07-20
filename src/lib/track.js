// Client telemetry. Batches small events and flushes them to /api/events with
// sendBeacon (so nothing is lost on tab close) or fetch+keepalive. It also mirrors
// counts into the local, private analytics store. We never send content - only an
// event name and tiny scalar props (a count, a domain slug, a step number). A
// stable anon id lets us count real humans and return-rate even before sign-in.
import { authHeader, getAccount } from './account.js';
import { track as trackLocal, pingVisit } from './analytics.js';

const ANON_KEY = 'kindred_anon_id';
const ENDPOINT = '/api/events';
const FLUSH_MS = 8000;
const MAX_QUEUE = 40;

let queue = [];
let timer = null;
let started = false;

function anonId() {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2));
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch { return null; }
}

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(flush, FLUSH_MS);
}

// Fire and forget. Uses sendBeacon when possible so a closing tab still delivers.
export function flush(useBeacon = false) {
  if (timer) { clearTimeout(timer); timer = null; }
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  const payload = JSON.stringify({ anonId: anonId(), events: batch });

  try {
    const authed = !!getAccount();
    // Beacon cannot carry auth headers; only use it when signed out or on unload.
    if (useBeacon && !authed && navigator.sendBeacon) {
      const ok = navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
      if (ok) return;
    }
    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // On failure, drop rather than grow unbounded; telemetry is best-effort.
  }
}

export function track(name, props = {}) {
  try {
    trackLocal(name);
    queue.push({ name, props, t: Date.now() });
    if (queue.length >= MAX_QUEUE) flush();
    else scheduleFlush();
  } catch {}
}

export function trackPageview(path) {
  track('page_view', { path: String(path || '').slice(0, 80) });
}

// Wire lifecycle flushes once. Call from main.jsx.
export function initTracking() {
  if (started || typeof window === 'undefined') return;
  started = true;
  pingVisit();
  track('app_open', { ref: (document.referrer || '').slice(0, 80) });
  const onHide = () => { if (document.visibilityState === 'hidden') flush(true); };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', () => flush(true));
}
