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
          overflow-y: auto;
        }
        .fw-card {
          width: 100%; max-width: 440px;
          display: flex; flex-direction: column; align-items: center;
          text-align: center; gap: 18px;
          animation: fw-rise 560ms cubic-bezier(.16,.84,.34,1) both;
        }
        .fw-orb-wrap {
          position: relative; display: grid; place-items: center;
          margin-bottom: 2px;
        }
        .fw-orb-wrap::before {
          content: ''; position: absolute; width: 120px; height: 120px;
          border-radius: 50%;
          background: radial-gradient(circle, var(--gold, #dd9a2e) 0%, transparent 70%);
          opacity: .28; animation: fw-halo 3.4s ease-in-out infinite;
        }
        .fw-eyebrow {
          font-size: 13px; letter-spacing: .14em; text-transform: uppercase;
          color: var(--accent-600, #c9603a); font-weight: 700;
        }
        .fw-headline {
          font-family: var(--font-display, Georgia, serif);
          font-size: 30px; line-height: 1.15; color: var(--ink, #2a2320);
          margin: 0; font-weight: 700;
        }
        .fw-sub {
          font-size: 16px; line-height: 1.5; color: var(--n-600, #6b6259);
          margin: 0; max-width: 34ch;
        }
        .fw-stats {
          display: flex; gap: 12px; width: 100%;
          margin: 4px 0 2px;
        }
        .fw-stat {
          flex: 1 1 0; min-width: 0;
          border: 1px solid var(--line, #ece5da);
          border-radius: var(--r-md, 16px);
          background: rgba(255,255,255,.72);
          padding: 16px 12px;
          display: flex; flex-direction: column; align-items: center; gap: 6px;
        }
        .fw-stat-val {
          font-family: var(--font-display, Georgia, serif);
          font-size: 30px; line-height: 1; font-weight: 700;
          color: var(--ink, #2a2320);
          display: inline-flex; align-items: center; gap: 6px;
        }
        .fw-stat-label {
          font-size: 12.5px; letter-spacing: .04em;
          color: var(--n-500, #8a8177); text-transform: uppercase; font-weight: 600;
        }
        .fw-gold { color: var(--gold, #dd9a2e); }
        .fw-actions {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; width: 100%; margin-top: 6px;
        }
        .fw-cta {
          width: 100%; justify-content: center;
          font-size: 16.5px; padding: 15px 20px; gap: 10px;
        }
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
          0%, 100% { transform: scale(1); opacity: .24; }
          50% { transform: scale(1.14); opacity: .36; }
        }
        @media (prefers-reduced-motion: reduce) {
          .fw-overlay, .fw-card { animation: none; }
          .fw-orb-wrap::before { animation: none; }
        }
      `}</style>

      <div className="fw-card">
        <div className="fw-orb-wrap">
          <span className="aria-orb" aria-hidden style={{ width: 88, height: 88 }} />
        </div>

        <div className="fw-eyebrow">Aria is with you</div>
        <h1 className="fw-headline">You are in. This is your first win.</h1>
        <p className="fw-sub">
          Welcome to Kindred. You just took the first step, and it counts. Here is
          what you have already earned.
        </p>

        <div className="fw-stats">
          <div className="fw-stat">
            <span className="fw-stat-val">
              <Icon name="trophy" size={22} className="fw-gold" />
              {level}
            </span>
            <span className="fw-stat-label">Level reached</span>
          </div>
          <div className="fw-stat">
            <span className="fw-stat-val fw-gold">
              <Icon name="sparkles" size={22} className="fw-gold" />
              {sparks}
            </span>
            <span className="fw-stat-label">Starter sparks</span>
          </div>
        </div>

        <div className="fw-actions">
          <button type="button" className="btn btn-primary fw-cta" onClick={goToday}>
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
