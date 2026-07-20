// Kindred's ambient "momentum" hairline. A single 3px line pinned to the very
// top edge of the viewport that quietly reflects recent consistency: it warms
// and glows as you keep the fire going, and slowly cools when you go idle.
// Non-interactive, native-safe, and designed to feel alive without distracting.
import { useEffect, useRef, useState } from 'react';
import { onGameMoment } from '../lib/game.js';

const STORE_KEY = 'kindred_momentum';
const DECAY_PER_HOUR = 8;     // points lost per idle hour
const GAIN_PER_XP = 6;        // points gained per activity moment
const CAP = 100;
const TICK_MS = 60 * 1000;    // recompute cooling once a minute

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.value !== 'number') return null;
    return { value: parsed.value, at: Number(parsed.at) || Date.now() };
  } catch {
    return null;
  }
}

function writeStore(value, at) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ value, at }));
  } catch {}
}

// Apply time-based decay from a stored snapshot to "now".
function decayed(snapshot, now = Date.now()) {
  if (!snapshot) return 0;
  const hours = Math.max(0, (now - snapshot.at) / 3600000);
  return Math.max(0, Math.min(CAP, snapshot.value - hours * DECAY_PER_HOUR));
}

// Warm the fill color from calm sage (low) through accent (mid) to gold (high).
function fillColor(pct) {
  if (pct < 45) return 'var(--sage)';
  if (pct < 78) return 'var(--accent-600)';
  return 'var(--gold)';
}

export default function MomentumMeter() {
  const [momentum, setMomentum] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const snap = readStore();
    const v = decayed(snap);
    if (snap) writeStore(v, Date.now());
    return v;
  });
  // Track whether there has ever been a stored profile so we know the
  // difference between "cold user" (render nothing) and "cooled to zero".
  const hasProfile = useRef(typeof window !== 'undefined' && !!readStore());

  useEffect(() => {
    // Bump momentum on each activity moment.
    const off = onGameMoment((m) => {
      if (!m || m.type !== 'xp') return;
      hasProfile.current = true;
      setMomentum((prev) => {
        const snap = readStore();
        const base = snap ? decayed(snap) : prev;
        const next = Math.max(0, Math.min(CAP, base + GAIN_PER_XP));
        writeStore(next, Date.now());
        return next;
      });
    });

    // Cool down on a slow interval so idle time is visible.
    const id = setInterval(() => {
      const snap = readStore();
      if (!snap) return;
      const v = decayed(snap);
      writeStore(v, Date.now());
      setMomentum(v);
    }, TICK_MS);

    // Recompute once when the tab returns to the foreground.
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      const snap = readStore();
      if (!snap) return;
      const v = decayed(snap);
      writeStore(v, Date.now());
      setMomentum(v);
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      off();
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  // Nothing to say: no fire and no history to reflect.
  if (momentum <= 0 && !hasProfile.current) return null;

  const pct = Math.max(0, Math.min(100, momentum));
  const color = fillColor(pct);
  // Glow intensifies with momentum.
  const glow = 0.18 + (pct / 100) * 0.55;
  const glowSpread = 4 + (pct / 100) * 12;

  return (
    <div className="kmm-root" aria-hidden="true">
      <div className="kmm-track">
        <div
          className="kmm-fill"
          style={{
            width: `${pct}%`,
            background: color,
            boxShadow: `0 0 ${glowSpread}px ${glow.toFixed(3)}px ${color}`,
            opacity: 0.55 + (pct / 100) * 0.45,
          }}
        >
          <span className="kmm-tip" style={{ background: color }} />
        </div>
      </div>

      <style>{`
        .kmm-root {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          z-index: 2147483000;
          pointer-events: none;
          transform: translateY(env(safe-area-inset-top, 0px));
        }
        .kmm-track {
          position: absolute;
          inset: 0;
          overflow: hidden;
        }
        .kmm-fill {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          border-radius: 0 2px 2px 0;
          transition: width 900ms cubic-bezier(0.22, 1, 0.36, 1),
                      background 1200ms ease,
                      opacity 1200ms ease,
                      box-shadow 1200ms ease;
          animation: kmm-breathe 6.5s ease-in-out infinite;
        }
        .kmm-tip {
          position: absolute;
          top: 50%;
          right: -1px;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          transform: translateY(-50%);
          filter: blur(0.5px);
          opacity: 0.9;
        }
        @keyframes kmm-breathe {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.14); }
        }
        @media (prefers-reduced-motion: reduce) {
          .kmm-fill {
            animation: none;
            transition: width 400ms ease, background 400ms ease;
          }
        }
      `}</style>
    </div>
  );
}
