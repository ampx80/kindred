// StreakGuard - a caring evening nudge that protects a ritual streak the person
// has already earned. It is loss-aversion done kindly: no guilt, no shame, just a
// warm reminder from Aria that a good thing is still within reach tonight and one
// small act keeps it going. It appears only when there is genuinely something to
// protect (streak >= 2), the day is not yet closed, it is evening (>= 6pm local),
// and it has not already been dismissed today. It offers a one-tap path back to
// Today, an optional streak freeze if they own one, and a quiet close. A gently
// "cooling" flame does the emotional work - flickering lower and bluer to signal
// risk - and holds still for anyone who prefers reduced motion. No em-dashes.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { useToast } from '../components/UI.jsx';
import { sChime } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { useGame, useFreeze, onGameMoment } from '../lib/game.js';
import * as store from '../lib/store.js';

// Local-time day key (not UTC) so evening detection and per-day dismissal line up
// with the wall clock the person is actually looking at.
function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const dismissKey = () => `kindred_streakguard_${localDayKey()}`;

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Robust "is today's ritual fully closed" read. dayProgress() may hand back a
// rich object with `complete` / `rings`, or a simpler { checkin, moves, reflect }
// map. Treat any truthy (or positive-count) beat as done.
function ritualComplete(dp) {
  if (!dp || typeof dp !== 'object') return false;
  if (typeof dp.complete === 'boolean') return dp.complete;
  if (Array.isArray(dp.rings) && dp.rings.length) return dp.rings.every(r => r && r.done);
  const beats = ['checkin', 'moves', 'reflect'];
  const present = beats.filter(k => k in dp);
  if (!present.length) return false;
  return present.every(k => {
    const v = dp[k];
    return typeof v === 'number' ? v > 0 : !!v;
  });
}

// Returns the streak number to show, or 0 when the guard should stay hidden.
function computeStreak() {
  try {
    if (typeof window === 'undefined') return 0;
    const streak = (store.ritualStreak?.() ) || 0;
    if (streak < 2) return 0;                         // nothing precious to protect yet
    if (ritualComplete(store.dayProgress?.())) return 0;  // already closed, hide
    if (new Date().getHours() < 18) return 0;         // only in the evening
    if (localStorage.getItem(dismissKey()) === '1') return 0; // dismissed today
    return streak;
  } catch {
    return 0;
  }
}

export default function StreakGuard() {
  const navigate = useNavigate();
  const toast = useToast();
  const game = useGame();
  const freezes = (game && game.freezes) || 0;
  const reduced = reducedMotion();

  const [streak, setStreak] = useState(() => computeStreak());

  const recheck = useCallback(() => { setStreak(computeStreak()); }, []);

  // Re-check on mount, whenever the game engine fires a moment (they may have just
  // completed the ritual - hide instantly), and on a slow minute tick so crossing
  // into the evening flips it on without a reload.
  useEffect(() => {
    recheck();
    const offMoment = onGameMoment(() => recheck());
    const id = setInterval(recheck, 60 * 1000);
    return () => { try { offMoment?.(); } catch {} clearInterval(id); };
  }, [recheck]);

  // The game snapshot changing (e.g. a freeze spent) is also a good re-check point.
  useEffect(() => { recheck(); }, [game, recheck]);

  if (!streak) return null;

  const dismissForDay = () => {
    try { localStorage.setItem(dismissKey(), '1'); } catch {}
    setStreak(0);
  };

  const keepGoing = () => {
    try { sChime(); } catch {}
    try { haptic('light'); } catch {}
    dismissForDay();
    navigate('/today');
  };

  const spendFreeze = () => {
    let ok = false;
    try { ok = useFreeze(); } catch {}
    if (ok) {
      toast('Streak freeze used. Rest easy tonight.', 'ok');
      try { haptic('success'); } catch {}
    }
    dismissForDay();
  };

  return (
    <div className="sg-wrap" role="status" aria-live="polite">
      <div className={`sg-card${reduced ? ' sg-still' : ''}`}>
        <button type="button" className="sg-close" onClick={dismissForDay} aria-label="Not tonight">
          <Icon name="x" size={16} />
        </button>

        <div className="sg-flamewrap" aria-hidden="true">
          <span className={`sg-flame${reduced ? ' sg-flame-still' : ''}`}>
            <svg viewBox="0 0 24 24" width="30" height="34">
              <path className="sg-flame-outer" d="M12 23a7 7 0 0 0 7-7c0-4-3-6.5-4-9.5-.7 1.4-1.6 2-2.4 2.4C13 6 13 3.5 10 1c.5 3-1.5 4.5-2.8 6.2A8.8 8.8 0 0 0 5 16a7 7 0 0 0 7 7Z" />
              <path className="sg-flame-inner" d="M12 22a3.5 3.5 0 0 0 3.5-3.5c0-1.8-1.2-3-2-4.4-.5 1-1 1.4-1.6 1.7.2-1.3-.4-2.6-1.4-3.6-.3 1.7-1.3 2.6-2 3.8A4 4 0 0 0 8.5 18.5 3.5 3.5 0 0 0 12 22Z" />
            </svg>
          </span>
          <span className="sg-orb aria-orb" aria-hidden="true" style={{ width: 34, height: 34 }} />
        </div>

        <div className="sg-body">
          <p className="sg-title">
            Your <span className="sg-num">{streak}</span>-day streak is still alive.
          </p>
          <p className="sg-copy">One small thing keeps it going. No rush, no pressure - I just did not want it to slip by quietly.</p>

          <div className="sg-actions">
            <button type="button" className="sg-btn sg-primary" onClick={keepGoing}>
              Keep it going <Icon name="arrowRight" size={16} />
            </button>
            {freezes > 0 && (
              <button type="button" className="sg-btn sg-ghost" onClick={spendFreeze}>
                Use a streak freeze
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .sg-wrap {
          position: fixed; left: 0; right: 0;
          bottom: calc(86px + env(safe-area-inset-bottom));
          z-index: 90;
          display: flex; justify-content: center;
          padding: 0 1rem;
          pointer-events: none;
        }
        .sg-card {
          pointer-events: auto;
          position: relative;
          width: 100%; max-width: 440px;
          display: flex; align-items: flex-start; gap: .9rem;
          padding: 1rem 1.1rem 1.05rem;
          background: var(--paper, #fff);
          color: var(--ink);
          border: 1px solid var(--line);
          border-radius: var(--r-md, 18px);
          box-shadow: 0 18px 44px -18px rgba(40, 22, 12, .5);
          animation: sgRise .34s cubic-bezier(.16, 1.16, .3, 1) both;
        }
        .sg-still { animation: sgFade .2s ease both; }

        .sg-close {
          position: absolute; top: .55rem; right: .55rem;
          width: 28px; height: 28px; display: grid; place-items: center;
          border: none; border-radius: 999px; cursor: pointer;
          background: transparent; color: var(--n-400);
          transition: background .15s ease, color .15s ease;
        }
        .sg-close:hover { background: var(--n-100); color: var(--ink); }

        .sg-flamewrap {
          position: relative; flex: none;
          width: 46px; height: 46px;
          display: grid; place-items: center;
          margin-top: .1rem;
        }
        .sg-flame {
          display: inline-grid; place-items: center;
          transform-origin: 50% 100%;
          filter: drop-shadow(0 2px 6px rgba(224, 121, 78, .35));
          animation: sgFlicker 1.35s ease-in-out infinite, sgCool 5s ease-in-out infinite alternate;
        }
        .sg-flame-outer { fill: var(--accent-600, #d0693e); transition: fill .3s ease; }
        .sg-flame-inner { fill: var(--gold, #e6b357); opacity: .92; }
        .sg-orb {
          position: absolute; right: -6px; bottom: -6px;
          border: 2px solid var(--paper, #fff);
          border-radius: 999px;
        }

        .sg-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: .35rem; }
        .sg-title {
          font-family: var(--font-display, inherit);
          font-size: 1.12rem; line-height: 1.25; font-weight: 700;
          letter-spacing: -.01em; margin: 0; color: var(--ink);
        }
        .sg-num { color: var(--accent-700, #b8532e); font-variant-numeric: tabular-nums; }
        .sg-copy { margin: 0; color: var(--n-600); font-size: .95rem; line-height: 1.5; }

        .sg-actions { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .55rem; }
        .sg-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: .35rem;
          padding: .58rem 1rem; border-radius: var(--r-pill, 999px);
          font-size: .95rem; font-weight: 650; cursor: pointer;
          border: 1px solid transparent;
          transition: transform .12s ease, background .15s ease, box-shadow .18s ease;
        }
        .sg-btn:active { transform: translateY(1px); }
        .sg-primary {
          background: var(--accent, #e0794e); color: #fff;
          box-shadow: 0 10px 22px -12px rgba(217, 107, 67, .85);
        }
        .sg-primary:hover { background: var(--accent-600, #d0693e); }
        .sg-ghost { background: transparent; color: var(--n-700, var(--ink)); border-color: var(--line); }
        .sg-ghost:hover { background: var(--n-100); }

        @keyframes sgRise { from { opacity: 0; transform: translateY(16px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes sgFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes sgFlicker {
          0%, 100% { transform: scaleY(1) scaleX(1) translateY(0); }
          25% { transform: scaleY(.9) scaleX(1.03) translateY(1px); }
          50% { transform: scaleY(1.05) scaleX(.97) translateY(-.5px); }
          75% { transform: scaleY(.88) scaleX(1.02) translateY(1.5px); }
        }
        /* The flame "cools": dimmer, shorter, drifting bluer to signal the streak
           is at risk without ever saying anything harsh. */
        @keyframes sgCool {
          0% { filter: drop-shadow(0 2px 6px rgba(224, 121, 78, .35)); opacity: 1; }
          100% { filter: drop-shadow(0 2px 5px rgba(120, 160, 208, .4)) hue-rotate(35deg) saturate(.8) brightness(.94); opacity: .82; }
        }

        .sg-flame-still, .sg-flame-still.sg-flame { animation: none !important; filter: drop-shadow(0 2px 5px rgba(224, 121, 78, .3)); }

        @media (min-width: 861px) {
          .sg-wrap { bottom: calc(1.2rem + env(safe-area-inset-bottom)); justify-content: flex-end; padding: 0 1.4rem; }
          .sg-card { max-width: 400px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .sg-card { animation: sgFade .18s ease both !important; }
          .sg-flame { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
