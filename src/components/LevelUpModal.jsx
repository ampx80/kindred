// A show-stopping, full-screen level-up celebration. It listens to the game
// engine's "moments" bus and, whenever a 'levelup' fires, enqueues it and takes
// over the screen with a radiant burst: a springy "Level N", the new rank in
// Kindred's serif voice, a warm one-line note spoken by Aria, and the sparks
// bonus earned. Confetti, haptics and a soft chime land on show. Big XP jumps
// (like completing your profile) can cross several levels at once; those queue
// and play back one after another. Returns null the rest of the time.
import { useEffect, useRef, useState, useCallback } from 'react';
import { onGameMoment } from '../lib/game.js';
import { celebrate } from '../lib/celebrate.js';
import { haptic } from '../lib/haptics.js';
import { sCelebrate, sChime } from '../lib/sound.js';
import * as sfx from '../lib/sound.js';
import { Typer } from './UI.jsx';

// Aria's congratulations, varied so it never feels canned. {level} and {rank}
// are filled at enqueue time and frozen onto the queued item.
const ARIA_LINES = [
  'That is real progress. Level {level} looks good on you.',
  'Look at you go. Welcome to {rank}.',
  'I am so proud of you. You just reached level {level}.',
  'Every small thing added up to this. Here is level {level}.',
  'You kept showing up, and it shows. You are {rank} now.',
  'This one is all yours. Level {level}, well earned.',
  'A new chapter. Say hello to {rank}.',
];

const REDUCED = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let SEQ = 0;

export default function LevelUpModal() {
  const [queue, setQueue] = useState([]);
  const btnRef = useRef(null);
  const current = queue[0] || null;

  // Listen for level-up moments and enqueue a frozen, display-ready item.
  useEffect(() => {
    return onGameMoment((m) => {
      if (!m || m.type !== 'levelup') return;
      const level = Number(m.level) || 1;
      const from = Number.isFinite(m.from) ? m.from : level - 1;
      const rank = m.rank || 'a new rank';
      const gained = Math.max(0, level - from) * 10; // engine grants 10 sparks per level
      const line = ARIA_LINES[(Math.random() * ARIA_LINES.length) | 0]
        .replace('{level}', String(level))
        .replace('{rank}', rank);
      setQueue((q) => [...q, { token: ++SEQ, level, from, rank, gained, line }]);
    });
  }, []);

  const dismiss = useCallback(() => {
    setQueue((q) => q.slice(1));
    haptic('light');
  }, []);

  // Fire the celebration whenever a new item reaches the front of the queue.
  useEffect(() => {
    if (!current) return;
    try { celebrate({ count: 160, spread: 1.2 }); } catch {}
    try { haptic('celebrate'); } catch {}
    try { (sfx.sLevelUp ? sfx.sLevelUp() : sCelebrate()); } catch {}

    // A second, wider burst a beat later for a richer flourish (skipped when
    // the user prefers reduced motion; celebrate() already no-ops there too).
    let t2;
    if (!REDUCED()) {
      t2 = setTimeout(() => {
        try {
          celebrate({ x: window.innerWidth * 0.28, y: window.innerHeight * 0.34, count: 60, spread: 0.9 });
          celebrate({ x: window.innerWidth * 0.72, y: window.innerHeight * 0.34, count: 60, spread: 0.9 });
          sChime();
        } catch {}
      }, 420);
    }

    // Auto-dismiss so the celebration never traps the screen.
    const auto = setTimeout(dismiss, 6000);
    // Pull focus to the primary action for keyboard + screen-reader users.
    const focus = setTimeout(() => { try { btnRef.current?.focus(); } catch {} }, 60);

    return () => { clearTimeout(auto); clearTimeout(focus); if (t2) clearTimeout(t2); };
  }, [current?.token, dismiss]);

  // Escape dismisses; lock body scroll while the overlay owns the screen.
  useEffect(() => {
    if (!current) return;
    const onKey = (e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dismiss(); } };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [current, dismiss]);

  if (!current) return null;

  const remaining = queue.length - 1;

  return (
    <div
      className="lum-scrim"
      role="dialog"
      aria-modal="true"
      aria-label={`Level ${current.level} reached. You are now ${current.rank}.`}
      onClick={dismiss}
    >
      <div className="lum-card" onClick={(e) => e.stopPropagation()}>
        <div className="lum-numwrap">
          <span className="lum-rays" aria-hidden />
          <span className="lum-glow" aria-hidden />
          <span className="lum-orbit lum-orbit--a" aria-hidden />
          <span className="lum-orbit lum-orbit--b" aria-hidden />

          <span className="lum-kicker">Level up</span>
          <div className="lum-num" aria-hidden>
            <span className="lum-num-tag">LVL</span>
            <span className="lum-num-val">{current.level}</span>
          </div>
        </div>

        <h2 className="lum-rank">{current.rank}</h2>

        {current.gained > 0 && (
          <div className="lum-sparks" aria-label={`Plus ${current.gained} sparks`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
              <path d="M19 15l.9 2.4L22 18.3l-2.1.9L19 21l-.9-1.8-2.1-.9 2.1-.9z" />
            </svg>
            <span>+{current.gained} sparks</span>
          </div>
        )}

        <div className="lum-aria">
          <span className="aria-orb" aria-hidden style={{ width: 56, height: 56 }} />
          <p className="lum-said serif">
            <Typer key={current.token} text={current.line} speed={24} />
          </p>
        </div>

        <button ref={btnRef} className="btn btn-primary lum-cta" onClick={dismiss}>
          Keep going
        </button>

        {remaining > 0 && (
          <span className="lum-more">{remaining} more milestone{remaining > 1 ? 's' : ''} to celebrate</span>
        )}
      </div>

      <style>{`
        .lum-scrim {
          position: fixed; inset: 0; z-index: 1300;
          display: flex; align-items: center; justify-content: center;
          padding: calc(1.2rem + env(safe-area-inset-top, 0px)) calc(1.1rem + env(safe-area-inset-right, 0px)) calc(1.2rem + env(safe-area-inset-bottom, 0px)) calc(1.1rem + env(safe-area-inset-left, 0px));
          background: radial-gradient(120% 120% at 50% 22%, rgba(60,38,24,.58), rgba(30,20,14,.82));
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          animation: lumFade .3s var(--ease) both;
        }
        .lum-card {
          position: relative; width: 100%; max-width: 430px;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          gap: 1.05rem; padding: 2.4rem 1.7rem 1.9rem;
          border-radius: var(--r-xl); overflow: hidden;
          background:
            radial-gradient(140% 90% at 50% -10%, rgba(255,246,236,.96), rgba(255,253,250,.98) 60%),
            linear-gradient(180deg, #fffdfa, #fbf3ea);
          border: 1px solid rgba(255,255,255,.7);
          box-shadow: 0 40px 90px -20px rgba(70,40,20,.55), 0 0 0 1px rgba(221,154,46,.18), inset 0 1px 0 rgba(255,255,255,.9);
          animation: lumPop .62s cubic-bezier(.2,1.15,.35,1) both;
        }
        /* radiant halo, centered on the number */
        .lum-numwrap { position: relative; display: flex; flex-direction: column; align-items: center; gap: .35rem; width: 100%; padding: 1.1rem 0 .3rem; }
        .lum-rays {
          position: absolute; left: 50%; top: 52%; width: 460px; height: 460px;
          transform: translate(-50%,-50%); pointer-events: none; z-index: 0; opacity: .8;
          background: repeating-conic-gradient(from 0deg, rgba(224,121,78,.16) 0deg 5deg, rgba(224,121,78,0) 5deg 17deg);
          -webkit-mask: radial-gradient(circle, #000 8%, rgba(0,0,0,.5) 34%, transparent 66%);
          mask: radial-gradient(circle, #000 8%, rgba(0,0,0,.5) 34%, transparent 66%);
          animation: lumSpin 24s linear infinite;
        }
        .lum-glow {
          position: absolute; left: 50%; top: 52%; width: 300px; height: 300px;
          transform: translate(-50%,-50%); pointer-events: none; z-index: 0; border-radius: 50%;
          background: radial-gradient(circle, rgba(242,201,76,.5), rgba(217,107,67,.22) 46%, transparent 70%);
          filter: blur(4px); animation: lumPulse 3.4s ease-in-out infinite;
        }
        .lum-orbit {
          position: absolute; left: 50%; top: 52%; border-radius: 50%;
          transform: translate(-50%,-50%); pointer-events: none; z-index: 0;
          border: 1.5px solid rgba(221,154,46,.28);
        }
        .lum-orbit--a { width: 210px; height: 210px; animation: lumRing 2.6s ease-out infinite; }
        .lum-orbit--b { width: 210px; height: 210px; animation: lumRing 2.6s ease-out .9s infinite; }

        .lum-kicker {
          position: relative; z-index: 1;
          font-size: .74rem; font-weight: 800; letter-spacing: .22em; text-transform: uppercase;
          color: var(--accent-700);
          padding: .3rem .7rem; border-radius: var(--r-pill);
          background: var(--gold-bg); box-shadow: inset 0 0 0 1px rgba(221,154,46,.35);
        }
        .lum-num { position: relative; z-index: 1; display: flex; align-items: baseline; justify-content: center; gap: .5rem; }
        .lum-num-tag {
          font-family: var(--font-display); font-weight: 600; font-size: 1.5rem; letter-spacing: .04em;
          color: var(--accent-300); align-self: flex-start; margin-top: .8rem;
        }
        .lum-num-val {
          font-family: var(--font-display); font-weight: 700; line-height: .9;
          font-size: clamp(6rem, 34vw, 9.5rem);
          background: linear-gradient(165deg, #f2c94c 4%, #e0794e 46%, #d95d78 96%);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          filter: drop-shadow(0 10px 26px rgba(217,107,67,.35));
          animation: lumSpring .72s cubic-bezier(.16,1.3,.3,1) both .06s;
        }
        .lum-rank {
          position: relative; z-index: 1; margin: 0;
          font-family: var(--font-display); font-weight: 600; font-size: clamp(1.5rem, 6vw, 2rem);
          color: var(--ink); animation: lumRise .5s var(--ease) both .22s;
        }
        .lum-sparks {
          position: relative; z-index: 1; display: inline-flex; align-items: center; gap: .4rem;
          font-weight: 750; font-size: 1rem; color: var(--gold);
          padding: .4rem .85rem; border-radius: var(--r-pill);
          background: var(--gold-bg); box-shadow: inset 0 0 0 1px rgba(221,154,46,.3);
          animation: lumRise .5s var(--ease) both .32s;
        }
        .lum-aria {
          position: relative; z-index: 1; display: flex; align-items: center; gap: .8rem;
          width: 100%; text-align: left; padding: .9rem 1rem; border-radius: var(--r-md);
          background: var(--accent-50); box-shadow: inset 0 0 0 1px var(--line);
          animation: lumRise .5s var(--ease) both .42s;
        }
        .lum-said { margin: 0; font-size: 1.06rem; line-height: 1.45; color: var(--ink); }
        .lum-cta { position: relative; z-index: 1; width: 100%; margin-top: .1rem; font-size: 1.05rem; padding: .85rem 1.2rem; animation: lumRise .5s var(--ease) both .52s; }
        .lum-more { position: relative; z-index: 1; font-size: .85rem; color: var(--n-600); }

        @keyframes lumFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lumPop { from { opacity: 0; transform: translateY(16px) scale(.94); } to { opacity: 1; transform: none; } }
        @keyframes lumSpring { 0% { opacity: 0; transform: scale(.3); } 60% { opacity: 1; transform: scale(1.08); } 100% { transform: scale(1); } }
        @keyframes lumRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes lumSpin { to { transform: translate(-50%,-50%) rotate(360deg); } }
        @keyframes lumPulse { 0%,100% { opacity: .7; transform: translate(-50%,-50%) scale(1); } 50% { opacity: 1; transform: translate(-50%,-50%) scale(1.08); } }
        @keyframes lumRing { 0% { opacity: .5; width: 150px; height: 150px; } 100% { opacity: 0; width: 380px; height: 380px; } }

        @media (prefers-reduced-motion: reduce) {
          .lum-scrim, .lum-card, .lum-num-val, .lum-rank, .lum-sparks, .lum-aria, .lum-cta { animation: none !important; }
          .lum-rays, .lum-glow, .lum-orbit { animation: none !important; }
          .lum-orbit { display: none; }
          .lum-card { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
