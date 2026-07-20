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
import FxBackdrop from './FxBackdrop.jsx';

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
  const [sparkN, setSparkN] = useState(0); // animated count-up for the sparks chip
  const btnRef = useRef(null);
  const current = queue[0] || null;

  // Count the sparks bonus up from zero for a satisfying tally (instant under
  // reduced motion). Purely visual; the accessible label still uses the real total.
  useEffect(() => {
    const target = current ? current.gained : 0;
    if (target <= 0) { setSparkN(0); return; }
    if (REDUCED()) { setSparkN(target); return; }
    let raf = 0;
    const start = performance.now();
    const dur = 950;
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setSparkN(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [current?.token]);

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
  const reduced = REDUCED();

  return (
    <div
      className="lum-scrim fx-scan"
      role="dialog"
      aria-modal="true"
      aria-label={`Level ${current.level} reached. You are now ${current.rank}.`}
      onClick={dismiss}
    >
      {/* Full-screen portal: aurora + synth grid + rising particle field. */}
      <FxBackdrop density={64} glow="250,138,74" grid />

      <div className="lum-card fx-glass-deep fx-ring" onClick={(e) => e.stopPropagation()}>
        <div className="lum-numwrap">
          {!reduced && <span className="lum-rays" aria-hidden />}
          <span className="lum-glow" aria-hidden />
          {!reduced && <span className="lum-shock" aria-hidden />}
          {!reduced && (
            <>
              <span className="lum-orbit lum-orbit--a" aria-hidden />
              <span className="lum-orbit lum-orbit--b" aria-hidden />
              <span className="lum-mote-orbit lum-mo--1" aria-hidden><span className="lum-mote" /></span>
              <span className="lum-mote-orbit lum-mo--2" aria-hidden><span className="lum-mote" /></span>
              <span className="lum-mote-orbit lum-mo--3" aria-hidden><span className="lum-mote" /></span>
            </>
          )}

          <span className="lum-kicker fx-glass">Level up</span>
          <div className="lum-num" aria-hidden>
            <span className="lum-num-tag fx-holo-text">LVL</span>
            <span className="lum-num-stack">
              <span className="lum-num-bloom">{current.level}</span>
              <span className="lum-num-val fx-holo-text">{current.level}</span>
            </span>
          </div>
        </div>

        <h2 className={`lum-rank fx-holo-text${reduced ? '' : ' lum-rank--glitch'}`} data-rank={current.rank}>
          {current.rank}
        </h2>

        {current.gained > 0 && (
          <div className="lum-sparks fx-neon fx-neon-breathe" aria-label={`Plus ${current.gained} sparks`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
              <path d="M19 15l.9 2.4L22 18.3l-2.1.9L19 21l-.9-1.8-2.1-.9 2.1-.9z" />
            </svg>
            <span>+{sparkN} sparks</span>
          </div>
        )}

        <div className="lum-aria fx-glass">
          <span className="aria-orb" aria-hidden style={{ width: 56, height: 56 }} />
          <p className="lum-said serif">
            <Typer key={current.token} text={current.line} speed={24} />
          </p>
        </div>

        <button ref={btnRef} className="btn btn-primary lum-cta fx-neon-breathe" onClick={dismiss}>
          <span className="lum-cta-label">Keep going</span>
        </button>

        {remaining > 0 && (
          <span className="lum-more">{remaining} more milestone{remaining > 1 ? 's' : ''} to celebrate</span>
        )}
      </div>

      <style>{`
        .lum-scrim {
          --fx-glow: 250,138,74;
          position: fixed; inset: 0; z-index: 1300;
          display: flex; align-items: center; justify-content: center;
          padding: calc(1.2rem + env(safe-area-inset-top, 0px)) calc(1.1rem + env(safe-area-inset-right, 0px)) calc(1.2rem + env(safe-area-inset-bottom, 0px)) calc(1.1rem + env(safe-area-inset-left, 0px));
          background:
            radial-gradient(120% 120% at 50% 18%, rgba(60,38,24,.62), rgba(22,16,26,.9)),
            radial-gradient(90% 70% at 50% 120%, rgba(90,60,150,.32), transparent 70%);
          backdrop-filter: blur(7px); -webkit-backdrop-filter: blur(7px);
          animation: lumFade .3s var(--ease) both;
        }
        /* central glass card, sitting inside its rotating iridescent ring */
        .lum-card {
          --fx-glow: 250,138,74;
          position: relative; z-index: 1; width: 100%; max-width: 430px;
          display: flex; flex-direction: column; align-items: center; text-align: center;
          gap: 1.05rem; padding: 2.4rem 1.7rem 1.9rem;
          border-radius: var(--r-xl);
          background:
            radial-gradient(140% 90% at 50% -10%, rgba(255,246,236,.82), rgba(255,251,247,.7) 60%),
            linear-gradient(180deg, rgba(255,253,250,.66), rgba(251,243,234,.6));
          box-shadow:
            0 44px 96px -22px rgba(50,26,46,.6),
            0 0 60px -12px rgba(250,138,74,.4),
            inset 0 1px 0 rgba(255,255,255,.85);
          animation: lumPop .62s cubic-bezier(.2,1.15,.35,1) both;
        }
        /* radiant halo, centered on the number */
        .lum-numwrap { position: relative; display: flex; flex-direction: column; align-items: center; gap: .35rem; width: 100%; padding: 1.1rem 0 .3rem; }
        /* volumetric rays fanning out behind the number */
        .lum-rays {
          position: absolute; left: 50%; top: 52%; width: 480px; height: 480px;
          transform: translate(-50%,-50%); pointer-events: none; z-index: 0; opacity: .85;
          background: repeating-conic-gradient(from 0deg,
            rgba(250,138,74,.22) 0deg 4deg, rgba(233,120,160,0) 4deg 9deg,
            rgba(150,130,245,.16) 9deg 13deg, rgba(110,205,220,0) 13deg 19deg);
          -webkit-mask: radial-gradient(circle, #000 6%, rgba(0,0,0,.55) 32%, transparent 66%);
          mask: radial-gradient(circle, #000 6%, rgba(0,0,0,.55) 32%, transparent 66%);
          animation: lumSpin 26s linear infinite;
          mix-blend-mode: screen;
        }
        .lum-glow {
          position: absolute; left: 50%; top: 52%; width: 320px; height: 320px;
          transform: translate(-50%,-50%); pointer-events: none; z-index: 0; border-radius: 50%;
          background: radial-gradient(circle, rgba(250,138,74,.55), rgba(233,120,160,.24) 44%, transparent 70%);
          filter: blur(6px); animation: lumPulse 3.4s ease-in-out infinite;
        }
        /* shockwave that expands once as the modal appears */
        .lum-shock {
          position: absolute; left: 50%; top: 52%; width: 60px; height: 60px;
          transform: translate(-50%,-50%); pointer-events: none; z-index: 0; border-radius: 50%;
          border: 3px solid rgba(250,138,74,.7);
          box-shadow: 0 0 24px rgba(250,138,74,.55);
          animation: lumShock 1.05s cubic-bezier(.16,.8,.3,1) .06s both;
        }
        .lum-orbit {
          position: absolute; left: 50%; top: 52%; border-radius: 50%;
          transform: translate(-50%,-50%); pointer-events: none; z-index: 0;
          border: 1.5px solid rgba(250,138,74,.3);
          box-shadow: 0 0 18px rgba(250,138,74,.2) inset;
        }
        .lum-orbit--a { width: 210px; height: 210px; animation: lumRing 2.8s ease-out infinite; }
        .lum-orbit--b { width: 210px; height: 210px; animation: lumRing 2.8s ease-out .95s infinite; }

        /* orbiting energy motes: a 0-size wrapper spins, the mote rides its radius */
        .lum-mote-orbit {
          position: absolute; left: 50%; top: 52%; width: 0; height: 0; z-index: 0; pointer-events: none;
        }
        .lum-mote {
          position: absolute; width: 11px; height: 11px; margin: -5.5px 0 0 -5.5px; border-radius: 50%;
          background: radial-gradient(circle, #fff, rgba(var(--fx-glow),.95) 42%, transparent 72%);
          box-shadow: 0 0 14px rgba(var(--fx-glow),.9);
        }
        .lum-mo--1 { animation: lumSpinCW 5.5s linear infinite; }
        .lum-mo--1 .lum-mote { transform: translateX(118px); }
        .lum-mo--2 { --fx-glow: 233,120,160; animation: lumSpinCCW 8s linear infinite; }
        .lum-mo--2 .lum-mote { transform: translateX(150px); }
        .lum-mo--3 { --fx-glow: 150,130,245; animation: lumSpinCW 11s linear infinite; }
        .lum-mo--3 .lum-mote { transform: translateX(92px) translateY(-40px); }

        .lum-kicker {
          position: relative; z-index: 1;
          font-size: .74rem; font-weight: 800; letter-spacing: .22em; text-transform: uppercase;
          color: var(--accent-700);
          padding: .3rem .8rem; border-radius: var(--r-pill);
        }
        .lum-num { position: relative; z-index: 1; display: flex; align-items: baseline; justify-content: center; gap: .5rem; }
        .lum-num-tag {
          font-family: var(--font-display); font-weight: 700; font-size: 1.5rem; letter-spacing: .04em;
          align-self: flex-start; margin-top: .8rem; background-size: 300% 100%;
        }
        .lum-num-stack { position: relative; display: inline-flex; }
        .lum-num-val {
          font-family: var(--font-display); font-weight: 700; line-height: .9;
          font-size: clamp(6rem, 34vw, 9.5rem); background-size: 300% 100%;
          animation: fx-holo-shift 6s linear infinite, lumSpring .72s cubic-bezier(.16,1.3,.3,1) both .06s;
        }
        /* blurred colored twin behind the holo number = strong neon bloom */
        .lum-num-bloom {
          position: absolute; inset: 0; z-index: -1; pointer-events: none;
          font-family: var(--font-display); font-weight: 700; line-height: .9;
          font-size: clamp(6rem, 34vw, 9.5rem); color: rgba(250,138,74,.85);
          filter: blur(20px); opacity: .9;
          animation: lumBloom 3.2s ease-in-out infinite, lumSpring .72s cubic-bezier(.16,1.3,.3,1) both .06s;
        }
        .lum-rank {
          position: relative; z-index: 1; margin: 0;
          font-family: var(--font-display); font-weight: 700; font-size: clamp(1.5rem, 6vw, 2rem);
          background-size: 300% 100%;
          animation: fx-holo-shift 6s linear infinite, lumRise .5s var(--ease) both .22s;
        }
        .lum-rank--glitch { animation: fx-holo-shift 6s linear infinite, lumRankIn .8s var(--ease) both .18s, lumGlitch 2.6s steps(1) .95s 2; }
        .lum-sparks {
          position: relative; z-index: 1; display: inline-flex; align-items: center; gap: .4rem;
          font-weight: 800; font-size: 1rem; color: var(--gold);
          padding: .42rem .95rem; border-radius: var(--r-pill);
          background: linear-gradient(180deg, rgba(255,248,236,.92), rgba(255,241,222,.86));
          animation: lumRise .5s var(--ease) both .32s;
        }
        .lum-sparks svg { filter: drop-shadow(0 0 6px rgba(250,138,74,.7)); }
        .lum-aria {
          position: relative; z-index: 1; display: flex; align-items: center; gap: .8rem;
          width: 100%; text-align: left; padding: .9rem 1rem; border-radius: var(--r-md);
          animation: lumRise .5s var(--ease) both .42s;
        }
        .lum-said { margin: 0; font-size: 1.06rem; line-height: 1.45; color: var(--ink); }
        .lum-cta {
          position: relative; z-index: 1; width: 100%; margin-top: .1rem; overflow: hidden;
          font-size: 1.05rem; padding: .9rem 1.2rem; color: #fff; border: 0;
          border-radius: var(--r-pill);
          background:
            linear-gradient(180deg, rgba(255,255,255,.16), rgba(255,255,255,0)),
            linear-gradient(100deg, rgb(250,138,74), rgb(233,120,160) 55%, rgb(150,130,245));
          background-size: auto, 200% 100%;
          animation: lumRise .5s var(--ease) both .52s, lumCtaShift 7s linear infinite;
        }
        .lum-cta::after {
          content: ""; position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(115deg, transparent 34%, rgba(255,255,255,.55) 50%, transparent 66%);
          transform: translateX(-120%); animation: fx-sweep 3.8s var(--fx-ease) 1s infinite;
        }
        .lum-cta-label { position: relative; z-index: 1; }
        .lum-more { position: relative; z-index: 1; font-size: .85rem; color: var(--n-600); }

        @keyframes lumFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lumPop { from { opacity: 0; transform: translateY(16px) scale(.94); } to { opacity: 1; transform: none; } }
        @keyframes lumSpring { 0% { opacity: 0; transform: scale(.3); } 60% { opacity: 1; transform: scale(1.08); } 100% { transform: scale(1); } }
        @keyframes lumRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes lumRankIn { 0% { opacity: 0; transform: translateY(10px); filter: blur(6px); } 100% { opacity: 1; transform: none; filter: blur(0); } }
        @keyframes lumGlitch {
          0%, 92%, 100% { transform: none; clip-path: none; }
          93% { transform: translateX(-2px); clip-path: inset(12% 0 62% 0); }
          95% { transform: translateX(3px); clip-path: inset(58% 0 20% 0); }
          97% { transform: translateX(-2px); clip-path: inset(34% 0 44% 0); }
        }
        @keyframes lumSpin { to { transform: translate(-50%,-50%) rotate(360deg); } }
        @keyframes lumSpinCW { to { transform: rotate(360deg); } }
        @keyframes lumSpinCCW { to { transform: rotate(-360deg); } }
        @keyframes lumPulse { 0%,100% { opacity: .7; transform: translate(-50%,-50%) scale(1); } 50% { opacity: 1; transform: translate(-50%,-50%) scale(1.08); } }
        @keyframes lumBloom { 0%,100% { opacity: .7; filter: blur(20px); } 50% { opacity: 1; filter: blur(28px); } }
        @keyframes lumRing { 0% { opacity: .5; width: 150px; height: 150px; } 100% { opacity: 0; width: 380px; height: 380px; } }
        @keyframes lumShock { 0% { opacity: .8; width: 60px; height: 60px; border-width: 3px; } 100% { opacity: 0; width: 540px; height: 540px; border-width: 1px; } }
        @keyframes lumCtaShift { to { background-position: 0 0, 200% 0; } }

        @media (prefers-reduced-motion: reduce) {
          .lum-scrim, .lum-card, .lum-num-val, .lum-num-bloom, .lum-rank, .lum-rank--glitch,
          .lum-sparks, .lum-aria, .lum-cta { animation: none !important; }
          .lum-rays, .lum-glow, .lum-orbit, .lum-mote-orbit { animation: none !important; }
          .lum-orbit, .lum-mote-orbit, .lum-shock, .lum-rays { display: none; }
          .lum-cta::after { display: none; }
          .lum-card { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}
