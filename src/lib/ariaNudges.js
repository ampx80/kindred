// Proactive Aria. A small, well-mannered nudge scheduler so Kindred reaches out
// at the right moments instead of only ever waiting to be opened. It listens to
// the game "moments" bus and the telemetry bus, watches the clock, and now and
// then surfaces one warm, on-brand line from Aria. Everything here is optional
// and defensive: it never throws, is safe if the DOM or any API is missing, and
// works the same on web and native. initAriaNudges() is called ONCE at startup.
//
// Manners: at most 2 nudges per calendar day, never inside 3 hours of each
// other, and each kind of nudge shows at most once a day. Warmth, never guilt.
import { onGameMoment } from './game.js';
import { onTrack } from './track.js';
import { useStore } from './store.js';

const KEY = 'kindred_nudges';
const MAX_PER_DAY = 2;
const MIN_GAP_MS = 3 * 60 * 60 * 1000;      // never two nudges within 3 hours
const MAX_TIMEOUT_MS = 2147483647;          // largest safe setTimeout delay
const MIDDAY_AFTER_MS = 4 * 60 * 1000;      // settle in for a few minutes first
const COMEBACK_DAYS = 2;                    // "welcome back" after a couple days
const EVENING_HOUR = 19;                    // reflect nudge after ~7pm local

// Any of these, seen today, means the person has already acted meaningfully.
const MEANINGFUL = new Set([
  'goal_done', 'checkin', 'reflection', 'reflection_saved', 'day_closed',
  'journal_saved', 'win_added', 'rec_done', 'interview_complete',
]);
// A "closed day" is inferred from an evening reflection or an explicit close.
const CLOSED = new Set(['day_closed', 'reflection', 'reflection_saved']);

// ---- tiny helpers (all guarded) --------------------------------------------
function dayKey(d = new Date()) {
  try {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  } catch { return 'unknown'; }
}
function nowMs() { try { return Date.now(); } catch { return 0; } }
function pick(list) {
  try { return list[Math.floor(Math.random() * list.length)]; } catch { return list && list[0]; }
}
function chance(p) { try { return Math.random() < p; } catch { return false; } }

function firstName() {
  try {
    const n = useStore && useStore.getState && useStore.getState();
    const name = n && n.profile && n.profile.name;
    return (typeof name === 'string' && name.trim()) ? name.trim().split(/\s+/)[0] : '';
  } catch { return ''; }
}

// ---- persisted state --------------------------------------------------------
function blank() {
  return { lastAt: 0, day: dayKey(), count: 0, lastOpen: 0, shownKeys: {}, acts: {} };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...blank(), ...JSON.parse(raw) };
  } catch {}
  return blank();
}
function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}
// Roll the daily counters over when the local date changes. lastAt/lastOpen are
// wall-clock and intentionally survive the rollover so gap math stays honest.
function rollDay(s) {
  const today = dayKey();
  if (s.day !== today) {
    s.day = today;
    s.count = 0;
    s.shownKeys = {};
    s.acts = {};
  }
  return s;
}

let state = load();

function canShow() {
  try {
    rollDay(state);
    if (state.count >= MAX_PER_DAY) return false;
    if (state.lastAt && (nowMs() - state.lastAt) < MIN_GAP_MS) return false;
    return true;
  } catch { return false; }
}

// Show a nudge of a given kind, honoring every rate limit. Returns true if shown.
function nudge(key, text) {
  try {
    if (!key || !text) return false;
    rollDay(state);
    if (state.shownKeys[key]) return false;   // once per day per kind
    if (!canShow()) return false;
    say(text);
    state.lastAt = nowMs();
    state.count = (state.count || 0) + 1;
    state.shownKeys[key] = true;
    save(state);
    return true;
  } catch { return false; }
}

// ---- the visible message ----------------------------------------------------
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  try {
    if (typeof document === 'undefined' || !document.head) return;
    const style = document.createElement('style');
    style.setAttribute('data-aria-nudge', '1');
    style.textContent =
      '@keyframes ariaOrbPulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.35);opacity:.55}}' +
      '@media (prefers-reduced-motion: reduce){.aria-nudge-orb{animation:none !important}}';
    document.head.appendChild(style);
    stylesInjected = true;
  } catch {}
}

function say(text) {
  // (a) broadcast for any future in-app listener (an Aria bubble, a log, ...)
  try { window.dispatchEvent(new CustomEvent('kindred:aria-say', { detail: { text } })); } catch {}
  // (b) always render it ourselves so warmth is visible even with no listener
  try { renderToast(text); } catch {}
}

function renderToast(text) {
  if (typeof document === 'undefined' || !document.body) return;
  injectStyles();

  let reduced = false;
  try { reduced = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch {}
  let narrow = false;
  try { narrow = (window.innerWidth || 0) <= 640; } catch {}

  const wrap = document.createElement('div');
  wrap.setAttribute('role', 'status');
  wrap.setAttribute('aria-live', 'polite');
  const bottom = narrow ? 'calc(env(safe-area-inset-bottom, 0px) + 92px)' : '24px';
  wrap.style.cssText = [
    'position:fixed',
    'left:50%',
    `bottom:${bottom}`,
    'transform:translateX(-50%)' + (reduced ? '' : ' translateY(12px)'),
    'z-index:60',
    'display:flex',
    'align-items:flex-start',
    'gap:10px',
    'max-width:320px',
    'width:calc(100vw - 32px)',
    'box-sizing:border-box',
    'padding:12px 14px',
    'background:var(--paper, #fff)',
    'border:1px solid var(--line, #eadfd3)',
    'border-radius:16px',
    'box-shadow:0 10px 30px rgba(60,40,20,.16), 0 2px 8px rgba(60,40,20,.08)',
    'color:var(--ink, #2e241e)',
    'font:500 15px/1.4 var(--font-body, system-ui, -apple-system, Segoe UI, Roboto, sans-serif)',
    'cursor:pointer',
    'opacity:0',
    'transition:opacity .28s ease, transform .28s ease',
    '-webkit-tap-highlight-color:transparent',
  ].join(';');

  const orb = document.createElement('span');
  orb.className = 'aria-nudge-orb';
  orb.style.cssText = [
    'flex:0 0 auto',
    'width:10px',
    'height:10px',
    'margin-top:5px',
    'border-radius:50%',
    'background:radial-gradient(circle at 30% 30%, #f6c88a, var(--accent-600, #c25a35))',
    'box-shadow:0 0 8px rgba(194,90,53,.55)',
    reduced ? '' : 'animation:ariaOrbPulse 2.4s ease-in-out infinite',
  ].join(';');

  const body = document.createElement('span');
  body.style.cssText = 'flex:1 1 auto;min-width:0';
  body.textContent = String(text);

  wrap.appendChild(orb);
  wrap.appendChild(body);
  document.body.appendChild(wrap);

  // entrance on the next frame so the transition runs
  const enter = () => {
    try {
      wrap.style.opacity = '1';
      wrap.style.transform = 'translateX(-50%)';
    } catch {}
  };
  try { requestAnimationFrame(() => requestAnimationFrame(enter)); } catch { enter(); }

  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    try {
      wrap.style.opacity = '0';
      if (!reduced) wrap.style.transform = 'translateX(-50%) translateY(8px)';
    } catch {}
    setTimeout(() => { try { wrap.remove(); } catch {} }, 320);
  };

  try { wrap.addEventListener('click', remove); } catch {}
  safeTimeout(remove, 6000);
}

// ---- scheduling primitives --------------------------------------------------
function safeTimeout(fn, ms) {
  try {
    const delay = Math.max(0, Math.min(Number(ms) || 0, MAX_TIMEOUT_MS));
    return setTimeout(() => { try { fn(); } catch {} }, delay);
  } catch { return null; }
}

function actedToday() {
  try {
    rollDay(state);
    return Object.keys(state.acts || {}).some(k => MEANINGFUL.has(k));
  } catch { return false; }
}
function closedToday() {
  try {
    rollDay(state);
    return Object.keys(state.acts || {}).some(k => CLOSED.has(k));
  } catch { return false; }
}

// ---- line libraries (warm, varied, never guilt-tripping, ASCII only) --------
function morningLines(name) {
  return name ? [
    `Good morning, ${name}. A fresh page. What is one small thing that would make today feel good?`,
    `Morning, ${name}. No agenda from me yet, just glad you are here. Ease into it.`,
    `Hey ${name}. New day, clean slate. Whatever you do with it is enough.`,
    `Good morning, ${name}. I have got your back today. Where do you want to start?`,
    `${name}, morning. Take a breath. The day is yours to shape, gently.`,
  ] : [
    'Good morning. A fresh page. What is one small thing that would make today feel good?',
    'Morning. No agenda from me yet, just glad you are here. Ease into it.',
    'Hey there. New day, clean slate. Whatever you do with it is enough.',
    'Good morning. I have got your back today. Where do you want to start?',
    'Morning. Take a breath. The day is yours to shape, gently.',
  ];
}
function middayLines(name) {
  const n = name ? `${name}, ` : '';
  return [
    `${n}whenever you have a minute, one tiny move counts. No rush at all.`,
    `Just checking in. If today has been full, that is okay too. I am here when you are ready.`,
    `${n}a two minute check-in can shift a whole afternoon. Only if it feels right.`,
    `No pressure. Even a single small step today is worth noticing.`,
    `${n}I am around. If you want to make one thing happen today, I will help.`,
  ];
}
function eveningLines(name) {
  const n = name ? `${name}, ` : '';
  return [
    `${n}how did today actually feel? A short reflection is a kind way to close it.`,
    `Evening. If you have a moment, looking back on today can be quietly grounding.`,
    `${n}before the day wraps, want to name one thing that went okay?`,
    `A gentle nudge to close the day when you are ready. No wrong way to do it.`,
    `${n}the day is winding down. A minute of reflection, if you feel like it.`,
  ];
}
function comebackLines(name) {
  return name ? [
    `Welcome back, ${name}. No catching up needed. We just pick up from here.`,
    `Good to see you, ${name}. However long it has been, today is a fine place to start again.`,
    `Hey ${name}, glad you are back. Nothing to make up for. Let us just begin.`,
    `${name}, welcome back. Life happens. I am right here whenever you are.`,
  ] : [
    'Welcome back. No catching up needed. We just pick up from here.',
    'Good to see you again. However long it has been, today is a fine place to start.',
    'Glad you are back. Nothing to make up for. Let us just begin.',
    'Welcome back. Life happens. I am right here whenever you are.',
  ];
}
function levelupEchoLines(name) {
  const n = name ? `${name}, ` : '';
  return [
    `${n}that leveled you up. Real momentum, quietly earned.`,
    `Look at you climbing. I am proud of the steadiness behind it.`,
    `${n}another level. It adds up more than you think.`,
  ];
}
function achievementEchoLines(name) {
  const n = name ? `${name}, ` : '';
  return [
    `${n}that one meant something. Well done.`,
    `A milestone worth pausing on. I saw it.`,
    `${n}earned, not given. Nicely done.`,
  ];
}

// ---- triggers ---------------------------------------------------------------
function runOpenTriggers() {
  try {
    rollDay(state);
    const name = firstName();
    const prevOpen = state.lastOpen || 0;
    const isNewDayOpen = !prevOpen || dayKey(new Date(prevOpen)) !== dayKey();
    const gapDays = prevOpen ? (nowMs() - prevOpen) / 86400000 : 0;

    // Record this open now so reloads within the day do not re-greet.
    state.lastOpen = nowMs();
    save(state);

    if (prevOpen && gapDays >= COMEBACK_DAYS) {
      // A real return after a couple days takes priority over the morning line.
      safeTimeout(() => nudge('comeback', pick(comebackLines(name))), 4000);
    } else if (isNewDayOpen) {
      safeTimeout(() => nudge('morning', pick(morningLines(name))), 3000);
    }

    // Midday: after a few minutes, only if nothing meaningful happened yet.
    safeTimeout(() => {
      try { if (!actedToday()) nudge('midday', pick(middayLines(firstName()))); } catch {}
    }, MIDDAY_AFTER_MS);

    scheduleEvening();
  } catch {}
}

function scheduleEvening() {
  try {
    const now = new Date();
    const target = new Date(now);
    target.setHours(EVENING_HOUR, 0, 0, 0);
    let delay = target.getTime() - now.getTime();
    if (delay <= 0) delay = 45 * 1000;        // already evening: check shortly
    else delay += 30 * 1000;                  // just past the hour
    safeTimeout(tryEvening, delay);
  } catch {}
}
function tryEvening() {
  try {
    const h = new Date().getHours();
    if (h < EVENING_HOUR) return;             // clock drifted; skip quietly
    if (closedToday()) return;                 // day already reflected on
    nudge('evening', pick(eveningLines(firstName())));
  } catch {}
}

// ---- wiring -----------------------------------------------------------------
let started = false;
export function initAriaNudges() {
  try {
    if (started || typeof window === 'undefined') return;
    started = true;

    // Observe real activity so midday/evening know if the day has been lived in.
    onTrack((name) => {
      try {
        if (!name) return;
        rollDay(state);
        if (MEANINGFUL.has(name) || CLOSED.has(name)) {
          state.acts[name] = nowMs();
          save(state);
        }
      } catch {}
    });

    // A short, occasional warm echo on the biggest moments. Kept rare so it
    // never piles onto the app's own celebration.
    onGameMoment((m) => {
      try {
        if (!m || !m.type) return;
        if (m.type === 'levelup' && chance(0.4)) {
          nudge('echo_levelup', pick(levelupEchoLines(firstName())));
        } else if (m.type === 'achievement' && chance(0.5)) {
          nudge('echo_achievement', pick(achievementEchoLines(firstName())));
        }
      } catch {}
    });

    runOpenTriggers();
  } catch {}
}
