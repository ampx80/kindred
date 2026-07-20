// Kindred's Weekly Recap - an Instagram-story-style wrap of the week with Aria.
// It quietly waits until there is real activity to celebrate (any of the game
// engine's meaningful counts), then, once per ISO week, takes over the screen
// with 2-4 cinematic, tap-through slides: segmented progress bars at the top,
// auto-advancing gradient scenes, big serif type, count-up numbers, and a warm
// closing line from Aria with Share + Done. It can also be summoned any time via
// window.dispatchEvent(new Event('kindred:show-recap')). On close or completion
// it stamps the current week so it will not reshow, and stores a fresh XP +
// counts baseline so next week's numbers read as "this week". Fully reduced-
// motion aware: no auto-advance, no parallax, manual tap navigation only.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGame } from '../lib/game.js';
import { celebrate } from '../lib/celebrate.js';
import { haptic } from '../lib/haptics.js';
import { sChime, sCelebrate } from '../lib/sound.js';
import * as store from '../lib/store.js';
import FxBackdrop from './FxBackdrop.jsx';

const RECAP_WEEK_KEY = 'kindred_recap_week';
const BASELINE_KEY = 'kindred_recap_baseline';
const AUTO_MS = 4500;
const SLIDES = 4;
const ACTIVITY_KEYS = ['day_closed', 'goal_done', 'reflection_saved', 'journal_saved', 'person_touch', 'feature_generated'];

// One holographic glow color per slide (comma rgb triplets) so the aurora +
// particle scene shifts hue as the story advances. Amber -> magenta -> gold ->
// violet keeps it warm-iridescent rather than cold sci-fi.
const SLIDE_GLOW = ['250,138,74', '233,120,160', '245,190,110', '150,130,245'];

const REDUCED = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ISO-ish week key, Monday-anchored, matching lib/game.js so the "once per week"
// gate lines up with the engine's own weekly quests.
function weekKey(d = new Date()) {
  const dt = new Date(d);
  const day = (dt.getDay() + 6) % 7; // Monday = 0
  dt.setDate(dt.getDate() - day);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

// A number that eases up from 0 to its target the moment its slide is active.
// Static (shows the final value) under reduced motion.
function CountUp({ to, active, dur = 1150 }) {
  const reduced = REDUCED();
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (!active) { setV(reduced ? to : 0); return; }
    if (reduced || to <= 0) { setV(to); return; }
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, to]); // eslint-disable-line
  return <>{v}</>;
}

export default function WeeklyRecap() {
  const snapshot = useGame();
  const [showing, setShowing] = useState(false);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [data, setData] = useState(null);
  const openedRef = useRef(false);
  const downRef = useRef({ t: 0, x: 0 });
  const reduced = REDUCED();

  // Build a frozen snapshot of the week's numbers and take over the screen.
  const open = useCallback(() => {
    const counts = snapshot.counts || {};
    let baseline = null;
    try { baseline = JSON.parse(localStorage.getItem(BASELINE_KEY) || 'null'); } catch {}
    const hasBaseline = baseline && typeof baseline.xp === 'number';
    const bc = hasBaseline && baseline.counts ? baseline.counts : null;
    const wk = (k) => {
      const total = counts[k] || 0;
      return bc ? Math.max(0, total - (bc[k] || 0)) : total;
    };
    let streak = 0;
    try { streak = store.ritualStreak?.() || 0; } catch {}
    let name = '';
    try { name = (store.getProfile?.() || {}).name || ''; } catch {}

    setData({
      rank: snapshot.rank || 'Spark',
      level: snapshot.level || 1,
      daysClosed: wk('day_closed'),
      promisesKept: wk('goal_done'),
      reflections: wk('reflection_saved'),
      journal: wk('journal_saved'),
      people: wk('person_touch'),
      created: wk('feature_generated'),
      weekXp: hasBaseline ? Math.max(0, (snapshot.xp || 0) - baseline.xp) : (snapshot.xp || 0),
      isFirst: !hasBaseline,
      streak,
      name,
    });
    setSlide(0);
    setPaused(false);
    setShowing(true);
    try { celebrate({ count: 150, spread: 1.15 }); } catch {}
    try { haptic('celebrate'); } catch {}
    try { sCelebrate(); } catch {}
  }, [snapshot]);

  // Stamp the week + store the new baseline so this recap is done for the week
  // and next week's numbers read as "since now".
  const finish = useCallback(() => {
    const wk = weekKey();
    try { localStorage.setItem(RECAP_WEEK_KEY, wk); } catch {}
    try {
      localStorage.setItem(BASELINE_KEY, JSON.stringify({
        weekK: wk,
        xp: snapshot.xp || 0,
        counts: { ...(snapshot.counts || {}) },
      }));
    } catch {}
    setShowing(false);
  }, [snapshot]);

  // Auto-trigger once per week on mount, only when there is something to honor.
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    const wk = weekKey();
    let seen = null;
    try { seen = localStorage.getItem(RECAP_WEEK_KEY); } catch {}
    const counts = snapshot.counts || {};
    const meaningful = ACTIVITY_KEYS.some((k) => (counts[k] || 0) > 0);
    if (seen !== wk && meaningful) open();
  }, [open, snapshot]);

  // Manual summon from anywhere in the app.
  useEffect(() => {
    const onShow = () => open();
    window.addEventListener('kindred:show-recap', onShow);
    return () => window.removeEventListener('kindred:show-recap', onShow);
  }, [open]);

  const go = useCallback((dir) => {
    setSlide((s) => {
      const n = s + dir;
      if (n < 0) return 0;
      if (n >= SLIDES) { finish(); return s; }
      return n;
    });
  }, [finish]);

  // The active segment's fill finishing is what advances the story. It never
  // fires under reduced motion (no animation) or while paused (play-state held).
  const onFillEnd = useCallback(() => {
    setSlide((s) => {
      if (s + 1 < SLIDES) { try { sChime(); } catch {} return s + 1; }
      return s; // land on the last slide; Share / Done take over
    });
  }, []);

  // Escape closes; lock body scroll while the story owns the screen.
  useEffect(() => {
    if (!showing) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [showing, finish, go]);

  // Press-and-hold pauses (like a story); a quick tap on the left third goes
  // back, elsewhere goes forward.
  const onDown = useCallback((e) => {
    downRef.current = { t: Date.now(), x: e.clientX };
    setPaused(true);
  }, []);
  const onUp = useCallback((e) => {
    setPaused(false);
    const dt = Date.now() - downRef.current.t;
    if (dt < 260) {
      const w = window.innerWidth || 1;
      if (e.clientX < w * 0.32) go(-1);
      else go(1);
      try { haptic('light'); } catch {}
    }
  }, [go]);
  const onCancel = useCallback(() => setPaused(false), []);

  const share = useCallback(() => {
    try {
      window.dispatchEvent(new CustomEvent('kindred:share', {
        detail: {
          title: 'My week with Kindred',
          subtitle: data?.rank || 'Spark',
          stat: data?.daysClosed || 0,
        },
      }));
    } catch {}
    try { haptic('light'); } catch {}
    finish();
  }, [data, finish]);

  if (!showing || !data) return null;

  const secondary = [
    data.journal > 0 ? `${data.journal} journal ${data.journal === 1 ? 'entry' : 'entries'}` : null,
    data.people > 0 ? `${data.people} ${data.people === 1 ? 'person' : 'people'} reached` : null,
    data.created > 0 ? `${data.created} created with Aria` : null,
  ].filter(Boolean);

  const closingLine = data.name
    ? `Whatever next week holds, I will be right here. Proud of you, ${data.name}.`
    : 'Whatever next week holds, I will be right here. Proud of you.';

  return (
    <div
      className="kwr-scrim"
      data-slide={slide}
      role="dialog"
      aria-modal="true"
      aria-label="Your week with Kindred"
    >
      {/* shifting gradient scene + soft floating light */}
      <div className="kwr-bg" aria-hidden>
        <span className="kwr-orb kwr-orb--a" />
        <span className="kwr-orb kwr-orb--b" />
        <span className="kwr-orb kwr-orb--c" />
      </div>

      {/* per-slide holographic aurora + particle field; hue shifts with the
          story. Keyed by slide so each scene fades in fresh. FxBackdrop is
          reduced-motion aware (static aurora, no particle loop). */}
      <FxBackdrop
        key={slide}
        className="kwr-fx"
        density={55}
        glow={SLIDE_GLOW[slide] || SLIDE_GLOW[0]}
        grid
      />

      {/* segmented story progress */}
      <div className="kwr-segs" aria-hidden>
        {Array.from({ length: SLIDES }).map((_, i) => {
          const state = i < slide ? 'done' : i === slide ? 'active' : 'todo';
          const animate = i === slide && !reduced;
          return (
            <div className="kwr-seg" key={i}>
              <span
                className="kwr-seg-fill"
                data-state={state}
                style={animate ? { animationPlayState: paused ? 'paused' : 'running' } : undefined}
                onAnimationEnd={animate ? onFillEnd : undefined}
              />
            </div>
          );
        })}
      </div>

      {/* close affordance (always reachable) */}
      <button className="kwr-close" onClick={finish} aria-label="Close recap">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {/* full-screen tap layer (nav + hold-to-pause). Content floats above it. */}
      <div
        className="kwr-tap"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerLeave={onCancel}
        onPointerCancel={onCancel}
      />

      {/* slides */}
      <div className="kwr-stage">
        <div className="kwr-slide" key={slide}>
          {slide === 0 && (
            <div className="kwr-intro">
              <span className="aria-orb kwr-aria fx-float" aria-hidden />
              <span className="kwr-kicker fx-neon-text">This week in review</span>
              <h1 className="kwr-h1 serif fx-holo-text kwrx-hologlow">Your week<br />with Aria</h1>
              <div className="kwr-rankchip fx-glass fx-neon-breathe">
                <span className="kwr-rankchip-lvl">Level {data.level}</span>
                <span className="kwr-rankchip-dot" aria-hidden />
                <span className="kwr-rankchip-rank">{data.rank}</span>
              </div>
              <p className="kwr-lead">A few quiet minutes to see what you built. Tap to move through it.</p>
            </div>
          )}

          {slide === 1 && (
            <div className="kwr-stats">
              <span className="kwr-kicker fx-neon-text">By the numbers</span>
              <h2 className="kwr-h2 serif fx-holo-text kwrx-hologlow">You showed up.</h2>
              <div className="kwr-statgrid">
                <div className="kwr-stat fx-glass fx-ring kwrx-pod">
                  <span className="kwr-statnum fx-holo-text"><CountUp to={data.daysClosed} active={slide === 1} /></span>
                  <span className="kwr-statlabel">Days closed</span>
                </div>
                <div className="kwr-stat fx-glass fx-ring kwrx-pod">
                  <span className="kwr-statnum fx-holo-text"><CountUp to={data.promisesKept} active={slide === 1} /></span>
                  <span className="kwr-statlabel">Promises kept</span>
                </div>
                <div className="kwr-stat fx-glass fx-ring kwrx-pod">
                  <span className="kwr-statnum fx-holo-text"><CountUp to={data.reflections} active={slide === 1} /></span>
                  <span className="kwr-statlabel">Reflections</span>
                </div>
              </div>
              {secondary.length > 0 && (
                <p className="kwr-secondary">{secondary.join('  ·  ')}</p>
              )}
            </div>
          )}

          {slide === 2 && (
            <div className="kwr-momentum">
              <span className="kwr-kicker fx-neon-text">Momentum</span>
              <div className="kwr-xp kwrx-xp">
                <span className="kwr-xp-plus">{data.isFirst ? '' : '+'}</span>
                <span className="kwr-xp-num"><CountUp to={data.weekXp} active={slide === 2} dur={1300} /></span>
                <span className="kwr-xp-unit">XP</span>
              </div>
              <p className="kwr-xp-cap">{data.isFirst ? 'earned with Aria so far' : 'earned this week'}</p>
              <div className="kwr-streakwrap">
                <div className="kwr-streak fx-glass fx-neon-breathe">
                  <span className="kwr-streak-flame" aria-hidden>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3 2.2.7 4 2.6 4 5a4 4 0 0 1-8 0c0-1.2.5-2.4 1.2-3.2.3 1 .8 1.7 1.3 2.2zM12 2s4 3.5 4 8a7 7 0 0 1-3 5.7" />
                    </svg>
                  </span>
                  <span className="kwr-streak-num"><CountUp to={data.streak} active={slide === 2} /></span>
                  <span className="kwr-streak-label">day ritual streak</span>
                </div>
              </div>
            </div>
          )}

          {slide === 3 && (
            <div className="kwr-closing">
              <span className="aria-orb kwr-aria fx-float" aria-hidden />
              <p className="kwr-said serif kwrx-said">{closingLine}</p>
              <div className="kwr-rankchip kwr-rankchip--soft fx-glass fx-neon-breathe">
                <span className="kwr-rankchip-rank">{data.rank}</span>
              </div>
              <div className="kwr-actions">
                <button className="btn btn-primary kwr-btn fx-neon fx-neon-breathe kwrx-share" onClick={share}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                    <path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5" />
                  </svg>
                  Share
                </button>
                <button className="btn btn-ghost kwr-btn kwr-btn--done fx-glass" onClick={finish}>Done</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .kwr-scrim {
          position: fixed; inset: 0; z-index: 1400;
          display: flex; flex-direction: column;
          overflow: hidden; color: #fff5ec;
          background: #1a0f0b;
          animation: kwrFade .32s var(--ease) both;
          -webkit-tap-highlight-color: transparent; touch-action: manipulation;
          user-select: none; -webkit-user-select: none;
          /* Retint the global glass + neon primitives for this deep, warm scene
             so .fx-glass / .fx-neon read as dark iridescent rather than light. */
          --fx-glass: 42,26,20; --fx-glass-a: .30;
          --fx-line: 255,236,214; --fx-hairline: .16;
          --fx-glow: 250,138,74;
          transition: --fx-glow .8s var(--ease);
        }
        /* Neon accent hue tracks the active slide (matches FxBackdrop glow). */
        .kwr-scrim[data-slide="0"] { --fx-glow: 250,138,74; }
        .kwr-scrim[data-slide="1"] { --fx-glow: 233,120,160; }
        .kwr-scrim[data-slide="2"] { --fx-glow: 245,190,110; }
        .kwr-scrim[data-slide="3"] { --fx-glow: 150,130,245; }

        /* --- shifting gradient scenes, one per slide --- */
        .kwr-bg { position: absolute; inset: 0; z-index: 0; transition: background .8s var(--ease); }
        .kwr-scrim[data-slide="0"] .kwr-bg { background: radial-gradient(120% 120% at 50% 16%, #7a3b22, #3a1c13 52%, #1a0f0b 88%); }
        .kwr-scrim[data-slide="1"] .kwr-bg { background: radial-gradient(120% 120% at 26% 20%, #7c2c46, #3a1620 52%, #170c10 88%); }
        .kwr-scrim[data-slide="2"] .kwr-bg { background: radial-gradient(120% 120% at 74% 20%, #7d5518, #37260e 52%, #150f08 88%); }
        .kwr-scrim[data-slide="3"] .kwr-bg { background: radial-gradient(120% 120% at 50% 82%, #6a2c40, #2c1620 50%, #140a0e 88%); }

        /* holographic aurora + particle field, layered above the base gradient
           but below all content and the tap layer. */
        .kwr-fx { z-index: 1; opacity: .9; mix-blend-mode: screen; animation: kwrxScene 1.1s var(--fx-ease) both; }

        .kwr-orb { position: absolute; border-radius: 50%; filter: blur(60px); opacity: .55; will-change: transform; }
        .kwr-orb--a { width: 46vw; max-width: 460px; aspect-ratio: 1; top: -8%; left: -6%; background: radial-gradient(circle, rgba(224,121,78,.65), transparent 68%); animation: kwrFloatA 22s ease-in-out infinite; }
        .kwr-orb--b { width: 42vw; max-width: 420px; aspect-ratio: 1; bottom: -10%; right: -8%; background: radial-gradient(circle, rgba(217,93,120,.55), transparent 68%); animation: kwrFloatB 27s ease-in-out infinite; }
        .kwr-orb--c { width: 38vw; max-width: 380px; aspect-ratio: 1; top: 40%; left: 44%; background: radial-gradient(circle, rgba(221,154,46,.42), transparent 70%); animation: kwrFloatC 31s ease-in-out infinite; }

        /* --- story segments --- */
        .kwr-segs {
          position: relative; z-index: 30; display: flex; gap: 6px;
          padding: calc(.7rem + env(safe-area-inset-top, 0px)) calc(.9rem + env(safe-area-inset-right, 0px)) .3rem calc(.9rem + env(safe-area-inset-left, 0px));
        }
        .kwr-seg { flex: 1; height: 3px; border-radius: 999px; background: rgba(255,245,236,.20); overflow: hidden; box-shadow: inset 0 0 0 1px rgba(var(--fx-line), .06); }
        .kwr-seg-fill {
          display: block; height: 100%; width: 0; border-radius: 999px;
          background: linear-gradient(90deg, rgb(var(--fx-gold)), rgb(var(--fx-glow)) 55%, rgb(var(--fx-magenta)));
          box-shadow: 0 0 6px rgba(var(--fx-glow), .9), 0 0 14px rgba(var(--fx-glow), .55);
        }
        .kwr-seg-fill[data-state="done"] { width: 100%; }
        .kwr-seg-fill[data-state="todo"] { width: 0; }
        .kwr-seg-fill[data-state="active"] { width: 100%; animation: kwrFill ${AUTO_MS}ms linear forwards; }

        .kwr-close {
          position: absolute; z-index: 40; top: calc(.65rem + env(safe-area-inset-top, 0px)); right: calc(.75rem + env(safe-area-inset-right, 0px));
          width: 38px; height: 38px; display: grid; place-items: center; cursor: pointer;
          border-radius: 999px; border: 1px solid rgba(255,245,236,.28); background: rgba(20,12,9,.32);
          color: #fff5ec; backdrop-filter: blur(6px); transition: background .15s, transform .12s var(--ease);
        }
        .kwr-close:hover { background: rgba(20,12,9,.5); }
        .kwr-close:active { transform: scale(.94); }

        .kwr-tap { position: absolute; inset: 0; z-index: 15; }

        .kwr-stage { position: relative; z-index: 20; flex: 1; display: flex; align-items: center; justify-content: center;
          padding: 1.2rem calc(1.5rem + env(safe-area-inset-right, 0px)) calc(1.6rem + env(safe-area-inset-bottom, 0px)) calc(1.5rem + env(safe-area-inset-left, 0px));
          perspective: 1200px; /* gives each slide a subtle push-in depth */
          pointer-events: none; /* taps fall through to the tap layer; buttons opt back in */ }
        .kwr-slide { width: 100%; max-width: 560px; text-align: center; animation: kwrRise .62s var(--fx-ease) both; }

        .kwr-kicker { display: inline-block; font-size: .76rem; font-weight: 800; letter-spacing: .22em; text-transform: uppercase; color: rgba(255,236,214,.82); margin-bottom: .9rem; }
        .kwr-aria { width: 76px; height: 76px; margin: 0 auto 1.1rem; display: block; }

        /* color/fill comes from .fx-holo-text; glow from .kwrx-hologlow */
        .kwr-h1 { margin: 0; font-weight: 600; font-size: clamp(2.9rem, 12vw, 4.6rem); line-height: 1.02; letter-spacing: -.02em; }
        .kwr-h2 { margin: 0 0 1.5rem; font-weight: 600; font-size: clamp(2.1rem, 8vw, 3rem); }

        .kwr-rankchip { display: inline-flex; align-items: center; gap: .55rem; margin-top: 1.3rem; padding: .5rem 1.05rem; border-radius: 999px;
          font-weight: 700; letter-spacing: .01em; }
        .kwr-rankchip--soft { margin-top: 1rem; }
        .kwr-rankchip-lvl { font-size: .98rem; color: rgba(255,236,214,.85); }
        .kwr-rankchip-dot { width: 5px; height: 5px; border-radius: 999px; background: rgba(255,236,214,.6); }
        .kwr-rankchip-rank { font-family: var(--font-display); font-size: 1.12rem; color: #fff; }
        .kwr-lead { margin: 1.5rem auto 0; max-width: 30ch; font-size: 1.06rem; line-height: 1.55; color: rgba(255,240,228,.8); }

        /* --- stats slide --- */
        .kwr-statgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .8rem; }
        /* glass + conic ring supplied by .fx-glass / .fx-ring; keep only layout here */
        .kwr-stat { display: flex; flex-direction: column; align-items: center; gap: .3rem; padding: 1rem .4rem; border-radius: var(--r-lg); }
        .kwrx-pod { animation: kwrxPodIn .6s var(--fx-ease) both; }
        .kwrx-pod:nth-child(2) { animation-delay: .08s; }
        .kwrx-pod:nth-child(3) { animation-delay: .16s; }
        .kwr-statnum { font-family: var(--font-display); font-weight: 700; font-size: clamp(2.8rem, 13vw, 4.2rem); line-height: 1; font-variant-numeric: tabular-nums; filter: drop-shadow(0 4px 18px rgba(var(--fx-glow), .5)); }
        .kwr-statlabel { font-size: .82rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: rgba(255,236,214,.78); }
        .kwr-secondary { margin: 1.4rem auto 0; font-size: 1rem; color: rgba(255,240,228,.82); }

        /* --- momentum slide --- */
        .kwr-momentum { display: flex; flex-direction: column; align-items: center; }
        .kwr-xp { display: flex; align-items: baseline; justify-content: center; gap: .12em; margin-top: .3rem; }
        .kwr-xp-plus { font-family: var(--font-display); font-weight: 700; font-size: clamp(2.4rem, 9vw, 3.4rem); color: rgba(255,236,214,.9); }
        .kwr-xp-num { font-family: var(--font-display); font-weight: 700; font-size: clamp(4.4rem, 22vw, 8rem); line-height: .92; font-variant-numeric: tabular-nums;
          background: linear-gradient(165deg, #ffe6a6 4%, #f6c39a 42%, #f2a6b6 96%); -webkit-background-clip: text; background-clip: text; color: transparent; filter: drop-shadow(0 10px 30px rgba(0,0,0,.35)); }
        .kwr-xp-unit { font-family: var(--font-display); font-weight: 700; font-size: clamp(1.6rem, 6vw, 2.4rem); color: rgba(255,236,214,.9); }
        .kwr-xp-cap { margin: .5rem 0 0; font-size: 1rem; font-weight: 600; letter-spacing: .02em; color: rgba(255,240,228,.78); }
        .kwr-streakwrap { margin-top: 2rem; }
        .kwr-streak { display: inline-flex; align-items: center; gap: .6rem; padding: .7rem 1.2rem; border-radius: 999px; }
        .kwr-streak-flame { color: #ffcf8f; display: inline-flex; }
        .kwr-streak-num { font-family: var(--font-display); font-weight: 700; font-size: 1.9rem; color: #fff; font-variant-numeric: tabular-nums; }
        .kwr-streak-label { font-size: .96rem; font-weight: 600; color: rgba(255,240,228,.82); }

        /* --- closing slide --- */
        .kwr-closing { display: flex; flex-direction: column; align-items: center; }
        .kwr-said { margin: 0; max-width: 22ch; font-weight: 600; font-size: clamp(1.7rem, 6.4vw, 2.5rem); line-height: 1.28; color: #fff; text-shadow: 0 4px 24px rgba(0,0,0,.32); }
        .kwr-actions { pointer-events: auto; display: flex; gap: .75rem; margin-top: 2rem; flex-wrap: wrap; justify-content: center; }
        .kwr-btn { pointer-events: auto; font-size: 1.05rem; padding: .85rem 1.7rem; border-radius: var(--r-pill); }
        /* glassy neon share: translucent tinted pill + breathing halo (from
           .fx-neon-breathe) + a soft holo light-sweep across the surface */
        .kwrx-share { position: relative; overflow: hidden; color: #fff5ec;
          border: 1px solid rgba(var(--fx-glow), .55);
          background: rgba(var(--fx-glow), .18);
          -webkit-backdrop-filter: blur(10px) saturate(150%); backdrop-filter: blur(10px) saturate(150%);
          text-shadow: 0 0 10px rgba(var(--fx-glow), .45); }
        .kwrx-share::after {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg, transparent 32%, rgba(255,255,255,.5) 50%, transparent 68%);
          transform: translateX(-120%); animation: fx-sweep 3.8s var(--fx-ease) infinite; }
        .kwrx-share:hover { background: rgba(var(--fx-glow), .26); }
        /* glass supplied by .fx-glass; keep only text color + hover feedback */
        .kwr-btn--done { color: #fff5ec; border-color: transparent; }
        .kwr-btn--done:hover { background: rgba(var(--fx-line), .16); }

        /* --- bespoke holographic accents (kwrx- prefix) --- */
        .kwrx-hologlow { filter: drop-shadow(0 6px 26px rgba(var(--fx-glow), .42)); }
        .kwrx-said { text-shadow: 0 0 20px rgba(var(--fx-glow), .38), 0 4px 24px rgba(0,0,0,.32); }
        .kwrx-xp .kwr-xp-num { filter: drop-shadow(0 10px 30px rgba(var(--fx-glow), .5)); }
        .kwr-kicker.fx-neon-text { color: rgba(255,244,232,.92); }

        @keyframes kwrFade { from { opacity: 0; } to { opacity: 1; } }
        /* cinematic push-in depth for each slide */
        @keyframes kwrRise { from { opacity: 0; transform: translate3d(0, 26px, 0) scale(.965); } to { opacity: 1; transform: none; } }
        @keyframes kwrxScene { from { opacity: 0; transform: scale(1.06); } to { opacity: .9; transform: none; } }
        @keyframes kwrxPodIn { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes kwrFill { from { width: 0; } to { width: 100%; } }
        @keyframes kwrFloatA { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(40px,44px) scale(1.12); } }
        @keyframes kwrFloatB { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-44px,-34px) scale(1.14); } }
        @keyframes kwrFloatC { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(30px,-40px) scale(1.08); } }

        @media (max-width: 560px) {
          .kwr-statgrid { gap: .5rem; }
          .kwr-stat { padding: .8rem .2rem; }
        }

        @media (prefers-reduced-motion: reduce) {
          .kwr-scrim, .kwr-slide { animation: none !important; }
          .kwr-scrim, .kwr-bg { transition: none !important; }
          .kwr-orb { animation: none !important; }
          .kwr-seg-fill[data-state="active"] { animation: none !important; width: 100%; }
          /* static holographic scene: no scene fade, no parallax, no sweeps */
          .kwr-fx, .kwrx-pod { animation: none !important; }
          .kwr-fx { opacity: .9; transform: none; }
          .kwrx-share::after { display: none; }
        }
      `}</style>
    </div>
  );
}
