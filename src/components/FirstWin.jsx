// The "instant first win": the very first minute of Kindred should feel like a
// warm embrace, not a tutorial. It listens for the first 'levelup' moment (which
// fires right after the interview grants its big XP burst) and, if we have never
// shown it before, blooms a full-screen celebratory welcome with Aria, the level
// reached, the starter sparks earned, and one dead-simple next step. It marks
// itself done the instant it shows, so it can never appear a second time.
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './icons.jsx';
import { onGameMoment, useGame } from '../lib/game.js';
import { sCelebrate, sChime } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { celebrate } from '../lib/celebrate.js';
import FxBackdrop from './FxBackdrop.jsx';

const DONE_KEY = 'kindred_firstwin_done';

function alreadyDone() {
  try { return localStorage.getItem(DONE_KEY) === '1'; } catch { return false; }
}
function markDone() {
  try { localStorage.setItem(DONE_KEY, '1'); } catch {}
}

export default function FirstWin() {
  const nav = useNavigate();
  const game = useGame();
  const [showing, setShowing] = useState(false);

  // Subscribe to game moments; the first level up after onboarding is our cue.
  useEffect(() => {
    if (alreadyDone()) return undefined;
    const off = onGameMoment((m) => {
      if (!m || m.type !== 'levelup') return;
      if (alreadyDone()) return;
      // Mark done immediately so it can never fire twice, even mid-animation.
      markDone();
      setShowing(true);
    });
    return off;
  }, []);

  // The warm flourish, once, when the overlay appears.
  useEffect(() => {
    if (!showing) return;
    celebrate({ count: 150, spread: 1.1 });
    haptic('celebrate');
    sCelebrate();
    // a soft second bloom of confetti a beat later, for a fuller embrace
    const t = setTimeout(() => { try { celebrate({ count: 60, spread: 0.9 }); } catch {} }, 520);
    return () => clearTimeout(t);
  }, [showing]);

  if (!showing) return null;

  const level = game?.level ?? 1;
  const sparks = game?.sparks ?? 0;

  const close = () => {
    try { sChime(); haptic('light'); } catch {}
    setShowing(false);
  };
  const goToday = () => {
    try { sChime(); haptic('medium'); } catch {}
    setShowing(false);
    nav('/today');
  };

  return (
    <div className="fw-overlay" role="dialog" aria-modal="true" aria-label="Your first win">
      <FxBackdrop density={50} glow="250,138,74" grid />
      <style>{`
        .fw-overlay {
          position: fixed; inset: 0; z-index: 2147483000;
          display: flex; align-items: center; justify-content: center;
          padding: calc(env(safe-area-inset-top, 0px) + 24px) 20px
                   calc(env(safe-area-inset-bottom, 0px) + 24px) 20px;
          background:
            radial-gradient(120% 90% at 50% 0%, var(--gold-bg, #fbf0d9) 0%, transparent 60%),
            radial-gradient(120% 120% at 50% 120%, var(--accent-50, #fdf2ec) 0%, transparent 55%),
            var(--paper, #fdfbf7);
          animation: fw-fade 420ms ease both;
          overflow-y: auto; isolation: isolate;
        }
        /* Warm veil so the card floats above the aurora + motes with real depth. */
        .fw-overlay::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(90% 70% at 50% 46%,
            transparent 0%,
            color-mix(in srgb, var(--paper, #fdfbf7) 34%, transparent) 78%);
          z-index: 1;
        }
        .fw-card {
          position: relative; z-index: 2;
          width: 100%; max-width: 448px;
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 18px;
          padding: 34px 26px 28px;
          border-radius: 30px;
          animation: fw-rise 560ms cubic-bezier(.16,.84,.34,1) both;
        }
        /* Soft holographic aura hugging the glass card. */
        .fw-card::before {
          content: ''; position: absolute; inset: -1.5px; border-radius: inherit;
          padding: 1.5px; pointer-events: none;
          background: linear-gradient(150deg,
            rgba(var(--fx-amber), .55), rgba(var(--fx-magenta), .3) 40%,
            rgba(var(--fx-violet), .28) 62%, rgba(var(--fx-cyan), .35));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          opacity: .9;
        }

        /* ---- ARIA ORB: rotating ring + breathing halo threshold ---- */
        .fw-orb-wrap {
          position: relative; display: grid; place-items: center;
          margin-bottom: 2px;
        }
        .fw-orb-wrap::before {
          content: ''; position: absolute; width: 150px; height: 150px;
          border-radius: 50%;
          background: radial-gradient(circle,
            rgba(var(--fx-amber), .45) 0%, rgba(var(--fx-gold), .18) 45%, transparent 70%);
          opacity: .8; animation: fw-halo 3.4s ease-in-out infinite;
        }
        .fw-orb-ring {
          position: relative; display: grid; place-items: center;
          width: 116px; height: 116px; border-radius: 50%;
          --fx-glow: var(--fx-amber);
        }
        .fw-orb-ring .aria-orb { position: relative; z-index: 1; }

        .fw-eyebrow {
          position: relative; z-index: 1;
          font-size: 13px; letter-spacing: .18em; text-transform: uppercase;
          color: var(--accent-600, #c9603a); font-weight: 800;
          --fx-glow: var(--fx-amber);
          animation: fw-eyebrow-in 620ms var(--fx-ease, ease) both;
        }
        .fw-headline {
          font-family: var(--font-display, Georgia, serif);
          font-size: 31px; line-height: 1.14; margin: 0; font-weight: 700;
          animation: fw-materialize 900ms cubic-bezier(.16,.84,.34,1) both;
        }
        .fw-headline .fw-holo {
          background: var(--fx-holo);
          background-size: 300% 100%;
          -webkit-background-clip: text; background-clip: text;
          color: transparent; -webkit-text-fill-color: transparent;
          animation: fx-holo-shift 7s linear infinite;
        }
        .fw-sub {
          font-size: 16px; line-height: 1.5; color: var(--n-600, #6b6259);
          margin: 0; max-width: 34ch;
          animation: fw-rise 640ms 120ms cubic-bezier(.16,.84,.34,1) both;
        }
        .fw-stats {
          display: flex; gap: 12px; width: 100%;
          margin: 4px 0 2px;
        }
        .fw-stat {
          position: relative; flex: 1 1 0; min-width: 0;
          border-radius: var(--r-md, 18px);
          padding: 18px 12px;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
          --fx-glow: var(--fx-amber);
          animation: fw-pod-in 700ms cubic-bezier(.16,.84,.34,1) both;
        }
        .fw-stat:nth-child(1) { animation-delay: 180ms; }
        .fw-stat:nth-child(2) { animation-delay: 300ms; --fx-glow: var(--fx-gold); }
        /* Iridescent hairline hugging each glass pod. */
        .fw-stat::before {
          content: ''; position: absolute; inset: 0; border-radius: inherit;
          padding: 1px; pointer-events: none;
          background: linear-gradient(160deg,
            rgba(var(--fx-glow), .6), rgba(var(--fx-magenta), .2) 55%, rgba(var(--fx-cyan), .3));
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          opacity: .85;
        }
        .fw-stat-val {
          font-family: var(--font-display, Georgia, serif);
          font-size: 30px; line-height: 1; font-weight: 700;
          color: var(--ink, #2a2320);
          display: inline-flex; align-items: center; gap: 6px;
        }
        .fw-stat-num {
          background: var(--fx-holo); background-size: 300% 100%;
          -webkit-background-clip: text; background-clip: text;
          color: transparent; -webkit-text-fill-color: transparent;
          animation: fx-holo-shift 7s linear infinite;
          font-variant-numeric: tabular-nums;
        }
        .fw-stat-label {
          font-size: 12.5px; letter-spacing: .04em;
          color: var(--n-500, #8a8177); text-transform: uppercase; font-weight: 600;
        }
        .fw-gold { color: var(--gold, #dd9a2e); }
        .fw-actions {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; width: 100%; margin-top: 6px;
          animation: fw-rise 700ms 220ms cubic-bezier(.16,.84,.34,1) both;
        }
        .fw-cta {
          position: relative; overflow: hidden;
          width: 100%; justify-content: center;
          font-size: 16.5px; padding: 15px 20px; gap: 10px;
          --fx-glow: var(--fx-amber);
          border-radius: var(--r-pill, 999px);
        }
        /* Light sweep gliding across the primary CTA. */
        .fw-cta::after {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg, transparent 32%,
            rgba(255,255,255,.55) 50%, transparent 68%);
          transform: translateX(-120%);
          animation: fw-cta-sweep 3.6s var(--fx-ease, ease) infinite;
          animation-delay: 900ms;
        }
        .fw-cta > * { position: relative; z-index: 1; }
        .fw-ghost {
          background: none; border: none; cursor: pointer;
          font-size: 14.5px; color: var(--n-500, #8a8177);
          padding: 8px 12px; border-radius: 10px;
          font: inherit; font-weight: 600;
          transition: color 160ms ease;
        }
        .fw-ghost:hover { color: var(--n-700, #4a423b); }
        @keyframes fw-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fw-rise {
          from { opacity: 0; transform: translateY(22px) scale(.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fw-halo {
          0%, 100% { transform: scale(1); opacity: .7; }
          50% { transform: scale(1.16); opacity: 1; }
        }
        @keyframes fw-eyebrow-in {
          from { opacity: 0; letter-spacing: .32em; }
          to { opacity: 1; letter-spacing: .18em; }
        }
        @keyframes fw-materialize {
          0% { opacity: 0; transform: translateY(10px) scale(.985); filter: blur(9px); }
          60% { opacity: 1; filter: blur(0); }
          100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
        }
        @keyframes fw-pod-in {
          from { opacity: 0; transform: translateY(16px) scale(.94); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fw-cta-sweep {
          0% { transform: translateX(-120%); }
          55%, 100% { transform: translateX(120%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .fw-overlay, .fw-card, .fw-headline, .fw-sub, .fw-eyebrow,
          .fw-stat, .fw-actions { animation: none !important; }
          .fw-orb-wrap::before { animation: none !important; }
          .fw-headline .fw-holo, .fw-stat-num { animation: none !important; }
          .fw-cta::after { display: none; }
        }
      `}</style>

      <div className="fw-card fx-glass-deep">
        <div className="fw-orb-wrap">
          <span className="fw-orb-ring fx-ring fx-neon-breathe" aria-hidden>
            <span className="aria-orb" style={{ width: 88, height: 88 }} />
          </span>
        </div>

        <div className="fw-eyebrow fx-neon-text">Aria is with you</div>
        <h1 className="fw-headline">
          <span className="fw-holo">You are in. This is your first win.</span>
        </h1>
        <p className="fw-sub">
          Welcome to Kindred. You just took the first step, and it counts. Here is
          what you have already earned.
        </p>

        <div className="fw-stats">
          <div className="fw-stat fx-glass fx-neon">
            <span className="fw-stat-val">
              <Icon name="trophy" size={22} className="fw-gold" />
              <span className="fw-stat-num">{level}</span>
            </span>
            <span className="fw-stat-label">Level reached</span>
          </div>
          <div className="fw-stat fx-glass fx-neon">
            <span className="fw-stat-val">
              <Icon name="sparkles" size={22} className="fw-gold" />
              <span className="fw-stat-num">{sparks}</span>
            </span>
            <span className="fw-stat-label">Starter sparks</span>
          </div>
        </div>

        <div className="fw-actions">
          <button type="button" className="btn btn-primary fw-cta fx-neon-breathe" onClick={goToday}>
            Let us do one small thing
            <Icon name="arrowRight" size={18} />
          </button>
          <button type="button" className="fw-ghost" onClick={close}>
            Explore on my own
          </button>
        </div>
      </div>
    </div>
  );
}
