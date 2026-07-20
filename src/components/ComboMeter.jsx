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
  const orbit = tier === 'b' && !reduced && !closing;

  return (
    <div className="cm-root" aria-hidden="true">
      <div
        className={
          `cm-chip cm-t-${tier} ${closing ? 'cm-out' : 'cm-in'} ${shake ? 'cm-shake' : ''} ${reduced ? '' : 'cm-live'}`
        }
      >
        {/* Decorative energy layers: a breathing plasma halo behind the pill and a
            holographic sheen sweeping across its glass surface. */}
        <span className="cm-sheen" aria-hidden="true" />

        {/* Remounting on `pop` replays the bounce; the ring resets to full at the
            same instant the combo window resets, so the jump reads as correct. */}
        <span key={pop} className={reduced ? 'cm-body' : 'cm-body cm-pop'}>
          <span className="cm-ring">
            {/* Recharge flash - fires once per hit when the body remounts. */}
            {!reduced && <span className="cm-recharge" aria-hidden="true" />}
            <svg width="34" height="34" viewBox="0 0 34 34">
              <defs>
                <linearGradient id="cmGradA" x1="0" y1="0" x2="1" y2="1">
                  <stop className="cm-g-a0" offset="0%" />
                  <stop className="cm-g-a1" offset="100%" />
                </linearGradient>
                <linearGradient id="cmGradB" x1="0" y1="0" x2="1" y2="1">
                  <stop className="cm-g-b0" offset="0%" />
                  <stop className="cm-g-b1" offset="60%" />
                  <stop className="cm-g-b2" offset="100%" />
                </linearGradient>
              </defs>
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
            {orbit && (
              <span className="cm-orbits" aria-hidden="true">
                <i className="cm-spark cm-spark-1" />
                <i className="cm-spark cm-spark-2" />
                <i className="cm-spark cm-spark-3" />
              </span>
            )}
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
          position: relative;
          isolation: isolate;
          display: flex;
          align-items: center;
          gap: .4rem;
          padding: .32rem .6rem .32rem .34rem;
          border-radius: 999px;
          border: 1.5px solid var(--accent-300);
          background:
            linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,0) 55%),
            var(--paper);
          -webkit-backdrop-filter: blur(6px) saturate(1.15);
          backdrop-filter: blur(6px) saturate(1.15);
          box-shadow:
            0 6px 20px rgba(46, 36, 30, .16),
            inset 0 1px 0 rgba(255,255,255,.5);
          will-change: transform, opacity;
        }
        /* Breathing plasma halo behind the pill. Opacity/scale only, GPU-friendly. */
        .cm-chip::before {
          content: "";
          position: absolute;
          inset: -6px;
          border-radius: 999px;
          background: radial-gradient(60% 120% at 26% 50%,
            rgba(var(--fx-amber), .55), rgba(var(--fx-magenta), .28) 55%, transparent 75%);
          filter: blur(7px);
          opacity: .5;
          z-index: -1;
          transform: scale(1);
        }
        .cm-live.cm-t-a::before { animation: cm-halo 2.6s ease-in-out infinite; }
        .cm-live.cm-t-b::before { animation: cm-halo-hot 1.35s ease-in-out infinite; }

        /* Holographic sheen sweeping across the glass. */
        .cm-sheen {
          position: absolute;
          inset: 0;
          border-radius: 999px;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }
        .cm-sheen::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(115deg,
            transparent 30%,
            rgba(255,255,255,.55) 48%,
            rgba(var(--fx-cyan), .35) 52%,
            transparent 70%);
          transform: translateX(-120%);
        }
        .cm-live .cm-sheen::before { animation: cm-sheen 3.4s ease-in-out infinite; }
        .cm-live.cm-t-b .cm-sheen::before { animation-duration: 2.1s; }

        .cm-body {
          position: relative;
          z-index: 1;
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
        .cm-ring svg { display: block; transform: rotate(0deg); position: relative; z-index: 1; }
        .cm-ring-track { stroke: var(--line); opacity: .7; }
        .cm-ring-bar {
          stroke: var(--accent-600);
          transition: stroke-dashoffset 250ms linear, stroke 240ms ease;
          filter: drop-shadow(0 0 2.5px rgba(var(--fx-amber), .7));
        }

        /* Ring gradient stops - amber to magenta at 1.5x. */
        .cm-g-a0 { stop-color: rgb(var(--fx-amber)); }
        .cm-g-a1 { stop-color: rgb(var(--fx-magenta)); }
        /* Hot iridescent gold to violet at 2x. */
        .cm-g-b0 { stop-color: rgb(var(--fx-gold)); }
        .cm-g-b1 { stop-color: rgb(var(--fx-magenta)); }
        .cm-g-b2 { stop-color: rgb(var(--fx-violet)); }

        /* Recharge flash - a bright ring pulse that plays once when a hit lands. */
        .cm-recharge {
          position: absolute;
          inset: 2px;
          border-radius: 999px;
          border: 2px solid rgba(var(--fx-gold), .9);
          box-shadow: 0 0 10px rgba(var(--fx-amber), .75);
          opacity: 0;
          z-index: 2;
          pointer-events: none;
          animation: cm-recharge 620ms ease-out;
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
          z-index: 3;
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

        /* Orbiting plasma sparks - only at 2x, motion-safe. */
        .cm-orbits {
          position: absolute;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }
        .cm-spark {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 3px;
          height: 3px;
          margin: -1.5px 0 0 -1.5px;
          border-radius: 999px;
          background: rgb(var(--fx-gold));
          box-shadow: 0 0 5px rgba(var(--fx-gold), .95), 0 0 9px rgba(var(--fx-magenta), .6);
          transform-origin: center;
        }
        .cm-spark-1 { animation: cm-orbit 1.6s linear infinite; }
        .cm-spark-2 { animation: cm-orbit 1.6s linear infinite; animation-delay: -.53s; background: rgb(var(--fx-magenta)); }
        .cm-spark-3 { animation: cm-orbit 1.6s linear infinite; animation-delay: -1.06s; background: rgb(var(--fx-violet)); }

        /* 1.5x - warm amber-magenta */
        .cm-t-a { border-color: var(--accent-300); }
        .cm-t-a .cm-ring-bar {
          stroke: url(#cmGradA);
          filter: drop-shadow(0 0 3px rgba(var(--fx-amber), .7)) drop-shadow(0 0 5px rgba(var(--fx-magenta), .4));
        }
        .cm-t-a .cm-mult,
        .cm-t-a .cm-word { color: var(--accent-700); }

        /* 2x - hot iridescent gold-violet */
        .cm-t-b {
          border-color: rgb(var(--fx-gold));
          background:
            linear-gradient(135deg, rgba(255,255,255,.28), rgba(var(--fx-magenta), .08) 55%),
            var(--gold-bg);
          box-shadow:
            0 8px 26px rgba(var(--fx-gold), .42),
            0 0 18px rgba(var(--fx-violet), .3),
            inset 0 1px 0 rgba(255,255,255,.55);
        }
        .cm-t-b .cm-ring-bar {
          stroke: url(#cmGradB);
          filter: drop-shadow(0 0 4px rgba(var(--fx-gold), .85)) drop-shadow(0 0 7px rgba(var(--fx-violet), .5));
        }
        .cm-t-b .cm-mult,
        .cm-t-b .cm-word {
          color: rgb(var(--fx-gold));
          text-shadow: 0 0 8px rgba(var(--fx-gold), .55);
        }
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
        @keyframes cm-halo {
          0%, 100% { opacity: .4; transform: scale(.96); }
          50%      { opacity: .7; transform: scale(1.05); }
        }
        @keyframes cm-halo-hot {
          0%, 100% { opacity: .55; transform: scale(.97); }
          50%      { opacity: 1; transform: scale(1.1); }
        }
        @keyframes cm-sheen {
          0%   { transform: translateX(-120%); }
          55%  { transform: translateX(120%); }
          100% { transform: translateX(120%); }
        }
        @keyframes cm-recharge {
          0%   { opacity: 0; transform: scale(.7); }
          25%  { opacity: 1; transform: scale(1.05); }
          100% { opacity: 0; transform: scale(1.3); }
        }
        @keyframes cm-orbit {
          from { transform: rotate(0deg) translateX(15px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(15px) rotate(-360deg); }
        }

        @media (prefers-reduced-motion: reduce) {
          .cm-in, .cm-out, .cm-pop, .cm-shake,
          .cm-recharge, .cm-orbits, .cm-spark,
          .cm-chip::before, .cm-sheen::before { animation: none; }
          .cm-out { opacity: 0; }
          .cm-sheen::before { display: none; }
          .cm-chip::before { opacity: .45; transform: none; }
          .cm-ring-bar { transition: stroke 240ms ease; }
        }
      `}</style>
    </div>
  );
}
