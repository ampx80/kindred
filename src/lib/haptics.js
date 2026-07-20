// Gentle haptics via the Vibration API (Android / supporting browsers; a no-op on
// iOS Safari and desktop, which is fine). Used to give a physical "click" to the
// moments that matter: completing a beat, closing the day, hitting a milestone.
// Respects prefers-reduced-motion and a shared on/off preference with sound.
const PREF_KEY = 'kindred_haptics_on';
let enabled = null;

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function hapticsEnabled() {
  if (enabled == null) {
    try {
      const v = localStorage.getItem(PREF_KEY);
      enabled = v == null ? true : v === '1';   // on by default; it is subtle and opt-outable
    } catch { enabled = true; }
  }
  return enabled;
}
export function setHapticsEnabled(on) {
  enabled = !!on;
  try { localStorage.setItem(PREF_KEY, on ? '1' : '0'); } catch {}
}

const PATTERNS = {
  light: 10,
  medium: 18,
  success: [14, 40, 22],
  celebrate: [10, 30, 10, 30, 40],
  warn: [30, 60, 30],
};

// Inside the native shell we drive the real Taptic Engine (iOS) / vibrator
// (Android) through Capacitor's Haptics plugin, which feels far crisper than the
// web Vibration API. Read off the injected global so the web path stays free of
// any Capacitor dependency.
function nativeHaptics() {
  const c = typeof window !== 'undefined' && window.Capacitor;
  if (c && typeof c.isNativePlatform === 'function' && c.isNativePlatform() && c.Plugins && c.Plugins.Haptics) {
    return c.Plugins.Haptics;
  }
  return null;
}

export function haptic(kind = 'light') {
  try {
    if (!hapticsEnabled() || reduced()) return;
    const nh = nativeHaptics();
    if (nh) {
      if (kind === 'success' || kind === 'celebrate') nh.notification({ type: 'SUCCESS' }).catch(() => {});
      else if (kind === 'warn') nh.notification({ type: 'WARNING' }).catch(() => {});
      else nh.impact({ style: kind === 'medium' ? 'MEDIUM' : 'LIGHT' }).catch(() => {});
      // A celebrate gets a quick second tap for a richer flourish.
      if (kind === 'celebrate') setTimeout(() => { try { nh.impact({ style: 'HEAVY' }).catch(() => {}); } catch {} }, 90);
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.vibrate) return;
    navigator.vibrate(PATTERNS[kind] || PATTERNS.light);
  } catch {}
}
