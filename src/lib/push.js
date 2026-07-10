// Client push + PWA registration. Registers the service worker (installability +
// offline shell), and, on opt-in, subscribes to web push and stores the
// subscription server-side so Aria can send a daily nudge. Web push works on
// Android and on iOS 16.4+ when Kindred is added to the home screen. Delivery is
// only as good as the subscription; if the platform or permission blocks it, we
// fail quietly and the app is unaffected.
import { authHeader } from './account.js';

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try { return await navigator.serviceWorker.register('/sw.js'); } catch { return null; }
}

export function pushSupported() {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && !!VAPID_PUBLIC;
}

export function notificationPermission() {
  return typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

// Returns { ok, reason? }. Requests permission, subscribes, and stores the sub.
export async function enablePush() {
  if (!pushSupported()) return { ok: false, reason: 'not-supported' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerServiceWorker());
  if (!reg) return { ok: false, reason: 'no-sw' };
  try {
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
    const raw = sub.toJSON();
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ endpoint: raw.endpoint, keys: raw.keys }),
    });
    return { ok: true };
  } catch {
    return { ok: false, reason: 'subscribe-failed' };
  }
}

export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg && (await reg.pushManager.getSubscription());
    if (sub) await sub.unsubscribe();
  } catch {}
}
