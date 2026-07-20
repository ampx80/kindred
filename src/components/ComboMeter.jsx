// ComboMeter - a session streak meter that rewards rapid consecutive actions.
// Reads the game engine's combo state, drains a 90s timer ring, escalates color
// as the multiplier climbs (accent at 1.5x, gold + shake at 2x), and pops on
// every new bit of XP. Lives near the top-right of the viewport, out of the way
// of the HUD and the bottom tab bar. Renders nothing when no combo is running.
import { useEffect, useRef, useState } from 'react';
import { comboState, onGameMoment } from '../lib/game.js';
import { sTap } from '../lib/sound.js';
import * as sfx from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';

const WINDOW_MS = 90 * 1000;
const RING_R = 14;
const RING_C = 2 * Math.PI * RING_R; // circumference

function prefersReduced() {
  return typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export default function ComboMeter() {
  // cs = the combo snapshot we are currently displaying (null when hidden).
  const [cs, setCs] = useState(null);
  const [closing, setClosing] = useState(false);
  const [pop, setPop] = useState(0);
  const [reduced, setReduced] = useState(prefersReduced);

  const csRef = useRef(null);
  const prevCount = useRef(0);
  const closeTimer = useRef(null);

  // Track the reduced-motion preference live.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(mq.matches);
    try { mq.addEventListener('change', onChange); }
    catch { mq.addListener(onChange); }
    return () => {
      try { mq.removeEventListener('change', onChange); }
      catch { mq.removeListener(onChange); }
    };
  }, []);

  // One evaluator, shared by the poll interval and the 'xp' moment. Reading
  // through refs keeps it free of stale closures.
  useEffect(() => {
    const evaluate = () => {
      const s = comboState();
      if (s.active && s.multiplier > 1) {
        if (s.count > prevCount.current) {
          // A fresh consecutive action: bounce, chirp, and buzz.
          setPop(p => p + 1);
          try { (sfx.sCombo ? sfx.sCombo(s.count) : sTap()); } catch {}
          try { haptic('light'); } catch {}
        }
        prevCount.current = s.count;
        if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
        setClosing(false);
        csRef.current = s;
        setCs(s);
      } else {
        prevCount.current = 0;
        if (csRef.current && !closeTimer.current) {
          setClosing(true);
          closeTimer.current = setTimeout(() => {
            csRef.current = null;
            closeTimer.current = null;
            setClosing(false);
            setCs(null);
          }, 420);
        }
      }
    };

    // Re-check promptly on every XP moment, and keep a light poll running so we
    // catch combo bumps and the draining timer between moments.
    const offMoment = onGameMoment((m) => { if (m && m.type === 'xp') evaluate(); });
    const id = setInterval(evaluate, 250);
    evaluate();

    return () => {
      offMoment();
      clearInterval(id);
      if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    };
  }, []);

  if (!cs) return null;

  const mult = cs.multiplier;
  const tier = mult >= 2 ? 'b' : 'a';
  const remaining = Math.max(0, cs.at + WINDOW_MS - Date.now());
  const frac = Math.max(0, Math.min(1, remaining / WINDOW_MS));
  const offset = RING_C * (1 - frac);
  const shake = tier === 'b' && !reduced && !closing;
  const multLabel = String(mult); // 1.5 or 2

  return (
    <div className="cm-root" aria-hidden="true">
      <div
        className={
          `cm-chip cm-t-${tier} ${closing ? 'cm-out' : 'cm-in'} ${shake ? 'cm-shake' : ''}`
        }
      >
        {/* Remounting on `pop` replays the bounce; the ring resets to full at the
            same instant the combo window resets, so the jump reads as correct. */}
        <span key={pop} className={reduced ? 'cm-body' : 'cm-body cm-pop'}>
          <span className="cm-ring">
            <svg width="34" height="34" viewBox="0 0 34 34">
              <circle
                className="cm-ring-track"
                cx="17" cy="17" r={RING_R}
                fill="none" strokeWidth="3"
              />
              <circle
                className="cm-ring-bar"
                cx="17" cy="17" r={RING_R}
                fill="none" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={offset}
                transform="rotate(-90 17 17)"
              />
            </svg>
            <span className="cm-mult">x{multLabel}</span>
          </span>
          <span className="cm-text">
            <b className="cm-word">combo</b>
            <span className="cm-hint">keep going</span>
          </span>
        </span>
      </div>

      <style>{`
        .cm-root {
          position: fixed;
          top: calc(70px + env(safe-area-inset-top, 0px));
          right: calc(12px + env(safe-area-inset-right, 0px));
          z-index: 60;
          pointer-events: none;
        }
        .cm-chip {
          display: flex;
          align-items: center;
          gap: .4rem;
          padding: .32rem .6rem .32rem .34rem;
          border-radius: 999px;
          border: 1.5px solid var(--accent-300);
          background: var(--paper);
          box-shadow: 0 6px 20px rgba(46, 36, 30, .16);
          will-change: transform, opacity;
        }
        .cm-body {
          display: flex;
          align-items: center;
          gap: .4rem;
        }
        .cm-ring {
          position: relative;
          width: 34px;
          height: 34px;
          flex: 0 0 auto;
          display: grid;
          place-items: center;
        }
        .cm-ring svg { display: block; transform: rotate(0deg); }
        .cm-ring-track { stroke: var(--line); }
        .cm-ring-bar {
          stroke: var(--accent-600);
          transition: stroke-dashoffset 250ms linear, stroke 240ms ease;
        }
        .cm-mult {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: .74rem;
          letter-spacing: -.02em;
          color: var(--accent-700);
        }
        .cm-text {
          display: flex;
          flex-direction: column;
          line-height: 1;
          padding-right: .1rem;
        }
        .cm-word {
          font-size: .7rem;
          font-weight: 800;
          letter-spacing: .08em;
          text-transform: uppercase;
          color: var(--accent-700);
        }
        .cm-hint {
          margin-top: .16rem;
          font-size: .58rem;
          font-weight: 700;
          letter-spacing: .05em;
          text-transform: uppercase;
          color: var(--n-400);
        }

        /* 1.5x - warm accent */
        .cm-t-a { border-color: var(--accent-300); }
        .cm-t-a .cm-ring-bar { stroke: var(--accent-600); }
        .cm-t-a .cm-mult,
        .cm-t-a .cm-word { color: var(--accent-700); }

        /* 2x - gold, hotter */
        .cm-t-b {
          border-color: var(--gold);
          background: var(--gold-bg);
          box-shadow: 0 8px 24px rgba(221, 154, 46, .34);
        }
        .cm-t-b .cm-ring-bar { stroke: var(--gold); }
        .cm-t-b .cm-mult,
        .cm-t-b .cm-word { color: var(--gold); }
        .cm-t-b .cm-hint { color: var(--n-600); }

        .cm-in { animation: cm-in 260ms cubic-bezier(.2, .9, .3, 1.2) both; }
        .cm-out { animation: cm-out 400ms ease forwards; }
        .cm-pop { animation: cm-pop 340ms cubic-bezier(.2, .9, .3, 1.4); }
        .cm-shake { animation: cm-shake 900ms ease-in-out infinite; }

        @keyframes cm-in {
          from { opacity: 0; transform: translateY(-8px) scale(.9); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cm-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(-6px) scale(.92); }
        }
        @keyframes cm-pop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.16); }
          100% { transform: scale(1); }
        }
        @keyframes cm-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          25%      { transform: translateX(-1.2px) rotate(-1.1deg); }
          75%      { transform: translateX(1.2px) rotate(1.1deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .cm-in, .cm-out, .cm-pop, .cm-shake { animation: none; }
          .cm-out { opacity: 0; }
          .cm-ring-bar { transition: stroke 240ms ease; }
        }
      `}</style>
    </div>
  );
}
