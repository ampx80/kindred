// Tiny, warm UI sounds built with the Web Audio API (zero assets, zero deps).
// These are the little "kept promise" chimes that make finishing a beat feel
// good. Off by default so we never surprise anyone; a single tap in Settings or
// the notification wizard turns them on. The AudioContext is created lazily and
// resumed on the first gesture, per browser autoplay rules.
const PREF_KEY = 'kindred_sound_on';

let ctx = null;
let enabled = null;

export function soundEnabled() {
  if (enabled == null) {
    try { enabled = localStorage.getItem(PREF_KEY) === '1'; } catch { enabled = false; }
  }
  return enabled;
}
export function setSoundEnabled(on) {
  enabled = !!on;
  try { localStorage.setItem(PREF_KEY, on ? '1' : '0'); } catch {}
  if (on) { getCtx(); if (on) play('tap'); }
}

function getCtx() {
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// One soft sine "bloom" with a quick attack and gentle decay.
function tone(freq, start, dur, gain = 0.08, type = 'sine') {
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ac.currentTime + start);
  g.gain.setValueAtTime(0.0001, ac.currentTime + start);
  g.gain.exponentialRampToValueAtTime(gain, ac.currentTime + start + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + start + dur);
  osc.connect(g); g.connect(ac.destination);
  osc.start(ac.currentTime + start);
  osc.stop(ac.currentTime + start + dur + 0.02);
}

// Named voices. Warm major intervals, never harsh.
const VOICES = {
  tap: () => tone(520, 0, 0.09, 0.05),
  pop: () => tone(680, 0, 0.12, 0.06),
  chime: () => { tone(587.33, 0, 0.5, 0.06); tone(880, 0.04, 0.6, 0.05); },
  success: () => { tone(523.25, 0, 0.28, 0.07); tone(659.25, 0.09, 0.3, 0.06); tone(783.99, 0.18, 0.5, 0.06); },
  celebrate: () => { tone(523.25, 0, 0.3, 0.07); tone(659.25, 0.08, 0.3, 0.07); tone(783.99, 0.16, 0.3, 0.07); tone(1046.5, 0.24, 0.6, 0.06); },
  // Bright coin/sparkle ping: a quick high blip with a shimmering overtone.
  coin: () => { tone(1318.51, 0, 0.1, 0.055, 'triangle'); tone(1975.53, 0.03, 0.14, 0.035, 'sine'); },
  // Ascending triumphant little arpeggio (C-E-G-C).
  levelup: () => { tone(523.25, 0, 0.18, 0.06); tone(659.25, 0.09, 0.18, 0.06); tone(783.99, 0.18, 0.2, 0.06); tone(1046.5, 0.27, 0.4, 0.06); },
  // Warm chord swell for an achievement unlock (major triad blooming together).
  unlock: () => { tone(392, 0, 0.55, 0.05); tone(493.88, 0.02, 0.6, 0.045); tone(587.33, 0.04, 0.65, 0.045); tone(783.99, 0.12, 0.7, 0.04); },
  // Chest-opening shimmer: a soft low swell rising into a sparkle.
  reward: () => { tone(329.63, 0, 0.5, 0.045); tone(659.25, 0.16, 0.35, 0.045, 'triangle'); tone(987.77, 0.28, 0.3, 0.035); tone(1318.51, 0.36, 0.4, 0.03, 'sine'); },
};

export function play(name) {
  try { if (!soundEnabled()) return; (VOICES[name] || VOICES.tap)(); } catch {}
}

// Convenience wrappers.
export const sTap = () => play('tap');
export const sPop = () => play('pop');
export const sChime = () => play('chime');
export const sSuccess = () => play('success');
export const sCelebrate = () => play('celebrate');

// Additive reward cues, same synthesis style, same enabled guard.
export const sCoin = () => play('coin');
export const sLevelUp = () => play('levelup');
export const sUnlock = () => play('unlock');
export const sReward = () => play('reward');

// Rising blip whose pitch climbs with the integer step. Clamped to a pleasant
// range so a long combo never turns shrill. Respects the enabled flag and is
// safe before a user gesture (tone() lazy-creates and guards the AudioContext).
export function sCombo(step = 0) {
  try {
    if (!soundEnabled()) return;
    const n = Math.max(0, Math.min(12, Math.floor(Number(step) || 0)));
    const freq = 523.25 * Math.pow(2, n / 12); // semitone climb from C5, capped one octave up
    tone(freq, 0, 0.11, 0.055, 'triangle');
    tone(freq * 2, 0.02, 0.1, 0.03, 'sine');
  } catch {}
}
