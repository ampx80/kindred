// SparkReveal - a lightweight, globally-hosted "gain" indicator for Kindred.
// It listens to the game engine's XP moments and floats a small warm chip
// upward for each gain, gently stacking when several fire in a burst. It also
// answers a window event ('kindred:spark-reveal') with a centered rarity burst.
// Purely visual: the host is pointer-events:none, floats near the top center
// (below any HUD, clear of the bottom tab bar), respects reduced motion, and
// renders nothing when idle.
import { useEffect, useRef, useState } from 'react';
import { onGameMoment } from '../lib/game.js';
import { RARITY } from '../lib/gameContent.js';
import * as sfx from '../lib/sound.js';

const MAX_CHIPS = 4;          // small cap; drop oldest beyond this
const CHIP_LIFE_MS = 1100;    // float + fade duration
const REVEAL_LIFE_MS = 1700;  // rarity burst duration
const SOUND_THROTTLE_MS = 280; // at most a few coin blips per second

export default function SparkReveal() {
  const [chips, setChips] = useState([]);
  const [reveals, setReveals] = useState([]);
  const idRef = useRef(0);
  const lastSoundRef = useRef(0);
  const timersRef = useRef(new Set());

  useEffect(() => {
    const timers = timersRef.current;
    const schedule = (fn, ms) => {
      const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
      timers.add(t);
      return t;
    };

    const pushChip = (amount) => {
      if (!amount) return;
      const id = ++idRef.current;
      setChips((prev) => {
        const next = [...prev, { id, amount }];
        return next.length > MAX_CHIPS ? next.slice(next.length - MAX_CHIPS) : next;
      });
      // gentle throttled blip; optional chaining keeps it safe if absent
      const now = Date.now();
      if (now - lastSoundRef.current > SOUND_THROTTLE_MS) {
        lastSoundRef.current = now;
        try { sfx.sCoin?.(); } catch {}
      }
      schedule(() => setChips((prev) => prev.filter((c) => c.id !== id)), CHIP_LIFE_MS);
    };

    const pushReveal = (rarity, label) => {
      const spec = RARITY[rarity] || RARITY.common;
      const id = ++idRef.current;
      const text = label || spec.label || 'Reward';
      setReveals((prev) => [...prev, { id, text, color: spec.color, bg: spec.bg }]);
      schedule(() => setReveals((prev) => prev.filter((r) => r.id !== id)), REVEAL_LIFE_MS);
    };

    const unsub = onGameMoment((m) => {
      if (m && m.type === 'xp') pushChip(m.amount);
    });

    const onReveal = (e) => {
      const d = (e && e.detail) || {};
      pushReveal(d.rarity, d.label);
    };
    window.addEventListener('kindred:spark-reveal', onReveal);

    return () => {
      unsub?.();
      window.removeEventListener('kindred:spark-reveal', onReveal);
      for (const t of timers) clearTimeout(t);
      timers.clear();
    };
  }, []);

  if (chips.length === 0 && reveals.length === 0) return null;

  return (
    <div className="sr-host" aria-hidden="true">
      <style>{`
        .sr-host {
          position: fixed;
          top: calc(64px + env(safe-area-inset-top, 0px));
          left: 0;
          right: 0;
          z-index: 9998;
          pointer-events: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
        }
        .sr-chip {
          pointer-events: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 13px 6px 11px;
          border-radius: var(--r-md, 12px);
          background: var(--accent-50, #fff4ec);
          color: var(--accent-700, #b5461a);
          border: 1px solid var(--accent-300, #f4c3a3);
          font-family: var(--font-display, inherit);
          font-weight: 800;
          font-size: 15px;
          letter-spacing: 0.2px;
          line-height: 1;
          white-space: nowrap;
          box-shadow: 0 8px 22px -12px rgba(181, 70, 26, 0.55);
          transform: translateY(0);
          opacity: 0;
          animation: sr-float ${CHIP_LIFE_MS}ms cubic-bezier(0.22, 0.7, 0.3, 1) forwards;
        }
        .sr-spark {
          display: inline-block;
          color: var(--gold, #d69a2d);
          font-size: 13px;
          transform-origin: center;
          animation: sr-twinkle ${CHIP_LIFE_MS}ms ease-in-out forwards;
        }
        .sr-reveal-wrap {
          position: fixed;
          top: calc(96px + env(safe-area-inset-top, 0px));
          left: 0;
          right: 0;
          display: flex;
          justify-content: center;
          pointer-events: none;
        }
        .sr-reveal {
          pointer-events: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 999px;
          font-family: var(--font-display, inherit);
          font-weight: 800;
          font-size: 17px;
          letter-spacing: 0.3px;
          line-height: 1;
          white-space: nowrap;
          box-shadow: 0 16px 40px -18px rgba(0, 0, 0, 0.4);
          transform: scale(0.6);
          opacity: 0;
          animation: sr-burst ${REVEAL_LIFE_MS}ms cubic-bezier(0.18, 0.9, 0.32, 1) forwards;
        }
        .sr-reveal .sr-spark { font-size: 15px; }

        @keyframes sr-float {
          0%   { opacity: 0; transform: translateY(6px) scale(0.9); }
          16%  { opacity: 1; transform: translateY(0) scale(1); }
          70%  { opacity: 1; transform: translateY(-24px) scale(1); }
          100% { opacity: 0; transform: translateY(-46px) scale(0.96); }
        }
        @keyframes sr-twinkle {
          0%, 100% { opacity: 0.5; transform: scale(0.85) rotate(0deg); }
          40%      { opacity: 1;   transform: scale(1.25) rotate(18deg); }
        }
        @keyframes sr-burst {
          0%   { opacity: 0; transform: scale(0.6); }
          14%  { opacity: 1; transform: scale(1.08); }
          26%  { opacity: 1; transform: scale(1); }
          78%  { opacity: 1; transform: scale(1); }
          100% { opacity: 0; transform: scale(0.98); }
        }

        @media (prefers-reduced-motion: reduce) {
          .sr-chip {
            animation: sr-fade ${CHIP_LIFE_MS}ms ease forwards;
            transform: none;
          }
          .sr-reveal {
            animation: sr-fade ${REVEAL_LIFE_MS}ms ease forwards;
            transform: none;
          }
          .sr-spark { animation: none; opacity: 1; }
          @keyframes sr-fade {
            0%   { opacity: 0; }
            12%  { opacity: 1; }
            72%  { opacity: 1; }
            100% { opacity: 0; }
          }
        }
      `}</style>

      {chips.map((c, i) => (
        <div
          key={c.id}
          className="sr-chip"
          style={{
            transform: `translateX(${(i % 2 === 0 ? -1 : 1) * (i * 7)}px)`,
            animationDelay: `${i * 40}ms`,
          }}
        >
          <span className="sr-spark">{'\u2726'}</span>
          {'+' + c.amount + ' XP'}
        </div>
      ))}

      {reveals.length > 0 && (
        <div className="sr-reveal-wrap">
          {reveals.map((r) => (
            <div
              key={r.id}
              className="sr-reveal"
              style={{ color: r.color, background: r.bg, border: `1px solid ${r.color}` }}
            >
              <span className="sr-spark" style={{ color: r.color }}>{'\u2726'}</span>
              {r.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
