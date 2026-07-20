// The native bridge. When Kindred runs inside its Capacitor iOS/Android shell,
// this wires the app up to feel truly native: it dismisses the splash on first
// paint, themes the status bar, honors the Android hardware back button, resizes
// for the keyboard, tags the DOM so CSS can add notch/home-indicator safe areas,
// and registers for native push. It also routes the app's relative /api calls to
// the production backend, since a native shell serves its own local origin.
//
// Everything is guarded: on the web this module is inert (initNative returns
// immediately), and all plugin imports are dynamic so the web bundle never pays
// for them.

const PROD_API_BASE = 'https://kindred-weld-five.vercel.app';

// Capacitor injects window.Capacitor in native shells. We read it off the global
// so nothing here hard-depends on @capacitor/core at runtime on the web.
function cap() {
  return (typeof window !== 'undefined' && window.Capacitor) || null;
}
export function isNative() {
  const c = cap();
  return !!(c && typeof c.isNativePlatform === 'function' && c.isNativePlatform());
}
export function platform() {
  const c = cap();
  return (c && typeof c.getPlatform === 'function' && c.getPlatform()) || 'web';
}

// In a native shell the WebView origin is capacitor://localhost or http://localhost,
// so any relative "/api/..." fetch would hit the local bundle instead of the real
// backend. We transparently rewrite same-origin absolute-path requests to point at
// production. Third-party absolute URLs (fonts, bible-api, Open Library) pass through
// untouched. This lets the entire app plus every engine work in native with no
// per-call-site refactor.
function installApiRouter() {
  if (typeof window === 'undefined' || !window.fetch || window.__kindredFetchPatched) return;
  const origin = window.location && window.location.origin;
  const orig = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      if (typeof input === 'string') {
        if (input.startsWith('/')) input = PROD_API_BASE + input;
        else if (origin && input.startsWith(origin + '/')) input = PROD_API_BASE + input.slice(origin.length);
      } else if (input && typeof Request !== 'undefined' && input instanceof Request) {
        let url = input.url;
        if (origin && url.startsWith(origin + '/')) {
          url = PROD_API_BASE + url.slice(origin.length);
          input = new Request(url, input);
        }
      }
    } catch { /* fall through to original */ }
    return orig(input, init);
  };
  window.__kindredFetchPatched = true;
}

// Absolute URL for a backend path, usable anywhere (native -> production, web -> same origin).
export function apiUrl(path) {
  if (isNative() && typeof path === 'string' && path.startsWith('/')) return PROD_API_BASE + path;
  return path;
}

export async function initNative() {
  if (!isNative()) return;
  installApiRouter();

  const p = platform();
  const root = document.documentElement;
  root.classList.add('is-native', `plat-${p}`);

  // Load the native plugins we use. Any that are missing simply no-op.
  const load = (name) => import(/* @vite-ignore */ name).catch(() => null);
  const [splashMod, statusMod, appMod, kbMod] = await Promise.all([
    load('@capacitor/splash-screen'),
    load('@capacitor/status-bar'),
    load('@capacitor/app'),
    load('@capacitor/keyboard'),
  ]);

  // Status bar: match the warm paper background, dark content by default, and
  // follow the app's own light/dark theme when it changes.
  if (statusMod && statusMod.StatusBar) {
    const { StatusBar, Style } = statusMod;
    const syncBar = async () => {
      try {
        const dark = root.classList.contains('dark') || root.dataset.theme === 'dark';
        await StatusBar.setStyle({ style: dark ? Style.Light : Style.Dark });
        if (p === 'android') await StatusBar.setBackgroundColor({ color: dark ? '#1a1614' : '#faf5ef' });
      } catch {}
    };
    syncBar();
    try {
      const mo = new MutationObserver(syncBar);
      mo.observe(root, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    } catch {}
  }

  // Keyboard: keep inputs comfortably visible without layout jumps.
  if (kbMod && kbMod.Keyboard) {
    try {
      kbMod.Keyboard.addListener('keyboardWillShow', () => root.classList.add('kb-open'));
      kbMod.Keyboard.addListener('keyboardWillHide', () => root.classList.remove('kb-open'));
    } catch {}
  }

  // Android hardware back button: navigate back in the app, or exit at the root.
  if (appMod && appMod.App) {
    try {
      appMod.App.addListener('backButton', () => {
        if (window.history.length > 1) window.history.back();
        else appMod.App.exitApp();
      });
    } catch {}
  }

  // Dismiss the splash once the first screen has painted.
  if (splashMod && splashMod.SplashScreen) {
    const hide = () => { try { splashMod.SplashScreen.hide(); } catch {} };
    if (document.readyState === 'complete') setTimeout(hide, 350);
    else window.addEventListener('load', () => setTimeout(hide, 350), { once: true });
  }

  // Fire push registration in the background; never block startup on it.
  registerNativePush().catch(() => {});
}

// Register for native push (APNs on iOS, FCM on Android) and hand the device
// token to the backend so scheduled nudges can reach the person. Sending from the
// server side needs APNs/FCM credentials configured at deploy time; the token
// plumbing is ready here regardless.
export async function registerNativePush() {
  if (!isNative()) return;
  const mod = await import('@capacitor/push-notifications').catch(() => null);
  if (!mod || !mod.PushNotifications) return;
  const { PushNotifications } = mod;
  try {
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== 'granted') return;

    PushNotifications.addListener('registration', (token) => {
      let auth = {};
      try {
        const t = localStorage.getItem('kindred_token');
        if (t) auth.Authorization = `Bearer ${t}`;
      } catch {}
      fetch(apiUrl('/api/native-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...auth },
        body: JSON.stringify({ token: token.value, platform: platform() }),
      }).catch(() => {});
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      try {
        const url = action && action.notification && action.notification.data && action.notification.data.url;
        if (url && url.startsWith('/')) window.location.assign(url);
      } catch {}
    });

    await PushNotifications.register();
  } catch { /* permission denied or unsupported; stay quiet */ }
}
