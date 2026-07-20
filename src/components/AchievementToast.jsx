// A premium achievement-unlock toast. Listens to the game engine's moment bus,
// queues unlocks so they show one at a time, and slides in a warm congratulatory
// card: the achievement icon in a rarity-tinted circle, the rarity label, the
// name and desc, and a soft diagonal shine sweep. Epic + legendary get confetti.
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from './icons.jsx';
import { onGameMoment } from '../lib/game.js';
import { RARITY } from '../lib/gameContent.js';
import { sChime, sSuccess } from '../lib/sound.js';
import * as sfx from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { burstFrom } from '../lib/celebrate.js';

const DISMISS_MS = 4500;
const DISMISS_MS_LEGENDARY = 6500;
const EXIT_MS = 420;

export default function AchievementToast() {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [shown, setShown] = useState(false);   // drives the slide-in transition
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();

  const cardRef = useRef(null);
  const dismissTimer = useRef(null);
  const exitTimer = useRef(null);
  const enterTimer = useRef(null);

  // Subscribe to the engine. Every achievement moment lands in the queue.
  useEffect(() => {
    const unsub = onGameMoment((m) => {
      if (m && m.type === 'achievement' && m.achievement) {
        setQueue((q) => [...q, m.achievement]);
      }
    });
    return unsub;
  }, []);

  // Pull the next achievement off the queue whenever nothing is showing.
  useEffect(() => {
    if (current || leaving || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    setCurrent(next);
  }, [queue, current, leaving]);

  const clearTimers = () => {
    clearTimeout(dismissTimer.current);
    clearTimeout(exitTimer.current);
    clearTimeout(enterTimer.current);
  };

  const beginExit = useCallback(() => {
    clearTimeout(dismissTimer.current);
    setLeaving(true);
    setShown(false);
    exitTimer.current = setTimeout(() => {
      setCurrent(null);
      setLeaving(false);
    }, EXIT_MS);
  }, []);

  // Celebrate + arm auto-dismiss when a new achievement becomes current.
  useEffect(() => {
    if (!current) return;
    const rarity = RARITY[current.rarity] ? current.rarity : 'common';

    // Slide in on the next frame so the transition runs.
    enterTimer.current = setTimeout(() => setShown(true), 20);

    // Warm feedback.
    try { sChime(); } catch {}
    try { sSuccess(); } catch {}
    try { sfx.sUnlock?.(); } catch {}
    try { haptic('success'); } catch {}

    // Confetti for the big ones, once the card is on screen.
    if (rarity === 'epic' || rarity === 'legendary') {
      setTimeout(() => {
        try { if (cardRef.current) burstFrom(cardRef.current); } catch {}
      }, 240);
    }

    const life = rarity === 'legendary' ? DISMISS_MS_LEGENDARY : DISMISS_MS;
    dismissTimer.current = setTimeout(beginExit, life);

    return clearTimers;
  }, [current, beginExit]);

  useEffect(() => clearTimers, []);

  if (!current) return null;

  const rarityKey = RARITY[current.rarity] ? current.rarity : 'common';
  const r = RARITY[rarityKey];

  const onOpen = () => {
    try { haptic('light'); } catch {}
    beginExit();
    navigate('/achievements');
  };

  const onDismiss = (e) => {
    e.stopPropagation();
    beginExit();
  };

  return (
    <>
      <style>{`
        .achv-toast-wrap {
          position: fixed;
          left: 0; right: 0;
          bottom: calc(90px + env(safe-area-inset-bottom, 0px));
          z-index: 2147483000;
          display: flex;
          justify-content: center;
          padding: 0 14px;
          pointer-events: none;
        }
        @media (min-width: 768px) {
          .achv-toast-wrap {
            left: auto;
            right: calc(22px + env(safe-area-inset-right, 0px));
            bottom: calc(22px + env(safe-area-inset-bottom, 0px));
            justify-content: flex-end;
            padding: 0;
          }
        }
        .achv-toast {
          pointer-events: auto;
          position: relative;
          width: 100%;
          max-width: 420px;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 14px 15px;
          border-radius: var(--r-md, 16px);
          background: var(--paper, #fff);
          border: 1px solid var(--line, #eadfd3);
          box-shadow: 0 18px 44px -12px rgba(60, 40, 20, 0.30), 0 4px 12px -4px rgba(60, 40, 20, 0.16);
          cursor: pointer;
          overflow: hidden;
          text-align: left;
          transform: translateY(24px) scale(0.98);
          opacity: 0;
          transition: transform 440ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms ease;
          will-change: transform, opacity;
        }
        .achv-toast::before {
          content: '';
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 4px;
          background: var(--achv-color, var(--accent-600));
        }
        .achv-toast.in { transform: translateY(0) scale(1); opacity: 1; }
        .achv-toast.out { transform: translateY(14px) scale(0.985); opacity: 0; }

        .achv-shine {
          position: absolute;
          top: 0; bottom: 0;
          left: -60%;
          width: 45%;
          background: linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%);
          transform: skewX(-18deg);
          pointer-events: none;
        }
        .achv-toast.in .achv-shine { animation: achv-sweep 1500ms ease-in-out 260ms 1 both; }

        .achv-icon {
          flex: 0 0 auto;
          width: 50px; height: 50px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: var(--achv-color, var(--accent-600));
          background: var(--achv-bg, var(--accent-50));
          box-shadow: inset 0 0 0 1.5px var(--achv-color, var(--accent-600));
          position: relative;
        }
        .achv-toast.in .achv-icon { animation: achv-pop 620ms cubic-bezier(0.34, 1.56, 0.64, 1) 120ms both; }

        .achv-body { flex: 1 1 auto; min-width: 0; }
        .achv-rarity {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.09em;
          text-transform: uppercase;
          color: var(--achv-color, var(--accent-700));
          margin-bottom: 3px;
        }
        .achv-rarity::before {
          content: '';
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--achv-color, var(--accent-600));
          box-shadow: 0 0 6px var(--achv-color, var(--accent-600));
        }
        .achv-name {
          font-family: var(--font-display, inherit);
          font-weight: 700;
          font-size: 16px;
          line-height: 1.2;
          color: var(--ink, #2a2018);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .achv-desc {
          font-size: 12.5px;
          line-height: 1.35;
          color: var(--n-500, #857567);
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .achv-close {
          flex: 0 0 auto;
          width: 26px; height: 26px;
          border-radius: 50%;
          border: none;
          background: transparent;
          color: var(--n-400, #a99a8b);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer;
          transition: background 160ms ease, color 160ms ease;
          align-self: flex-start;
        }
        .achv-close:hover { background: var(--n-100, #f2ece4); color: var(--n-600, #6a5c4e); }

        @keyframes achv-sweep {
          0% { left: -60%; }
          100% { left: 130%; }
        }
        @keyframes achv-pop {
          0% { transform: scale(0.4) rotate(-14deg); opacity: 0; }
          60% { transform: scale(1.12) rotate(4deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .achv-toast {
            transition: opacity 200ms ease;
            transform: none;
          }
          .achv-toast.in { transform: none; }
          .achv-toast.out { transform: none; }
          .achv-toast.in .achv-shine { animation: none; }
          .achv-toast.in .achv-icon { animation: none; }
          .achv-shine { display: none; }
        }
      `}</style>

      <div className="achv-toast-wrap">
        <div
          ref={cardRef}
          className={`achv-toast${shown ? ' in' : ''}${leaving ? ' out' : ''}`}
          style={{ '--achv-color': r.color, '--achv-bg': r.bg }}
          onClick={onOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
          aria-label={`Achievement unlocked: ${current.name}. ${current.desc}. Open achievements.`}
        >
          <span className="achv-shine" aria-hidden />
          <div className="achv-icon">
            <Icon name={current.icon || 'trophy'} size={24} />
          </div>
          <div className="achv-body">
            <div className="achv-rarity">{r.label} unlocked</div>
            <div className="achv-name">{current.name}</div>
            <div className="achv-desc">{current.desc}</div>
          </div>
          <button className="achv-close" onClick={onDismiss} aria-label="Dismiss">
            <Icon name="x" size={15} />
          </button>
        </div>
      </div>
    </>
  );
}
