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
import FxBackdrop from './FxBackdrop.jsx';

const DISMISS_MS = 4500;
const DISMISS_MS_LEGENDARY = 6500;
const EXIT_MS = 420;

// Rarity -> r,g,b glow triplet so the holo ring, neon glow, tinted edge and
// legendary particle field all recolor per rarity via --fx-glow. Kept warm and
// on-brand (sage / sky / amber / gold) rather than cold sci-fi hues.
const RARITY_GLOW = {
  common: '150,180,130',
  rare: '120,175,230',
  epic: '250,138,74',
  legendary: '245,190,110',
};

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
  const glow = RARITY_GLOW[rarityKey] || RARITY_GLOW.common;
  const isHi = rarityKey === 'epic' || rarityKey === 'legendary';
  const isLegendary = rarityKey === 'legendary';

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
        /* Glass card: translucent glass (via .fx-glass) with a rarity-tinted
           edge, layered warm depth shadow, and a holo glow bloom. */
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
          border: 1px solid rgba(var(--fx-glow), 0.30);
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.35) inset,
            0 18px 44px -12px rgba(60, 40, 20, 0.30),
            0 4px 12px -4px rgba(60, 40, 20, 0.16),
            0 0 26px -6px rgba(var(--fx-glow), 0.30);
          cursor: pointer;
          overflow: hidden;
          text-align: left;
          transform: translateY(24px) scale(0.98);
          opacity: 0;
          transition: transform 440ms cubic-bezier(0.16, 1, 0.3, 1), opacity 320ms ease;
          will-change: transform, opacity;
        }
        /* Rarity-tinted holo edge bar, glowing. */
        .achv-toast::before {
          content: '';
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 4px;
          z-index: 3;
          background: linear-gradient(180deg, rgb(var(--fx-glow)), rgba(var(--fx-glow), 0.35));
          box-shadow: 0 0 12px rgba(var(--fx-glow), 0.6);
        }
        .achv-toast.in { transform: translateY(0) scale(1); opacity: 1; }
        .achv-toast.out { transform: translateY(14px) scale(0.985); opacity: 0; }

        /* Higher rarities: stronger holographic bloom around the whole card. */
        .achv-toast.achv-hi {
          box-shadow:
            0 1px 0 rgba(255, 255, 255, 0.42) inset,
            0 20px 50px -12px rgba(60, 40, 20, 0.34),
            0 4px 12px -4px rgba(60, 40, 20, 0.16),
            0 0 40px -4px rgba(var(--fx-glow), 0.46);
        }

        /* Crisp diagonal entrance highlight (layers over the ambient .fx-shimmer
           sweep for a richer holographic pass). */
        .achv-shine {
          position: absolute;
          top: 0; bottom: 0;
          left: -60%;
          width: 45%;
          z-index: 1;
          background: linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%);
          transform: skewX(-18deg);
          pointer-events: none;
        }
        .achv-toast.in .achv-shine { animation: achv-sweep 1500ms ease-in-out 260ms 1 both; }

        /* Brief rarity-tinted scanline for epic/legendary. */
        .achv-scan {
          position: absolute;
          left: 0; right: 0; top: 0;
          height: 36%;
          z-index: 1;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(var(--fx-glow), 0.28), transparent);
          transform: translateY(-120%);
          opacity: 0;
        }
        .achv-toast.in .achv-scan {
          animation: achv-scanline 2600ms cubic-bezier(0.22, 1, 0.36, 0.68) 340ms 2 both;
        }

        .achv-icon {
          flex: 0 0 auto;
          width: 50px; height: 50px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: var(--achv-color, var(--accent-600));
          background: var(--achv-bg, var(--accent-50));
          box-shadow:
            inset 0 0 0 1.5px var(--achv-color, var(--accent-600)),
            0 0 14px rgba(var(--fx-glow), 0.45),
            0 0 34px rgba(var(--fx-glow), 0.26);
          position: relative;
          z-index: 2;
        }
        /* Recolor the rotating conic .fx-ring per rarity via --fx-glow, keeping
           a whisper of iridescence so the badge reads holographic, not flat. */
        .achv-icon.fx-ring::before {
          background: conic-gradient(
            from 0deg,
            rgb(var(--fx-glow)),
            rgb(var(--fx-magenta)),
            rgb(var(--fx-glow)),
            rgb(var(--fx-cyan)),
            rgb(var(--fx-gold)),
            rgb(var(--fx-glow))
          );
          opacity: 0.95;
        }
        .achv-toast.in .achv-icon { animation: achv-pop 620ms cubic-bezier(0.34, 1.56, 0.64, 1) 120ms both; }

        .achv-body { flex: 1 1 auto; min-width: 0; position: relative; z-index: 2; }
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
          background: rgb(var(--fx-glow));
          box-shadow: 0 0 6px rgba(var(--fx-glow), 0.9);
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
        .achv-toast.achv-hi .achv-name { font-size: 16.5px; }
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
          position: relative;
          z-index: 2;
        }
        .achv-close:hover { background: var(--n-100, #f2ece4); color: var(--n-600, #6a5c4e); }

        @keyframes achv-sweep {
          0% { left: -60%; }
          100% { left: 130%; }
        }
        @keyframes achv-scanline {
          0% { transform: translateY(-120%); opacity: 0; }
          12% { opacity: 1; }
          88% { opacity: 1; }
          100% { transform: translateY(320%); opacity: 0; }
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
          .achv-toast.in .achv-scan { animation: none; }
          .achv-shine { display: none; }
          .achv-scan { display: none; }
        }
      `}</style>

      <div className="achv-toast-wrap">
        <div
          ref={cardRef}
          className={`achv-toast fx-glass fx-shimmer${isHi ? ' achv-hi' : ''}${isLegendary ? ' achv-legendary' : ''}${shown ? ' in' : ''}${leaving ? ' out' : ''}`}
          style={{ '--achv-color': r.color, '--achv-bg': r.bg, '--fx-glow': glow }}
          onClick={onOpen}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(); } }}
          aria-label={`Achievement unlocked: ${current.name}. ${current.desc}. Open achievements.`}
        >
          {isLegendary && <FxBackdrop density={24} glow={glow} />}
          <span className="achv-shine" aria-hidden />
          {isHi && <span className="achv-scan" aria-hidden />}
          <div className="achv-icon fx-ring">
            <Icon name={current.icon || 'trophy'} size={24} />
          </div>
          <div className="achv-body">
            <div className="achv-rarity">{r.label} unlocked</div>
            <div className={`achv-name${isHi ? ' fx-holo-text' : ' fx-neon-text'}`}>{current.name}</div>
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
