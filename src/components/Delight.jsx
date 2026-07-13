// Kindred Delight kit - small, warm, reusable interactive widgets that make the
// app feel alive. Every piece is reduced-motion aware (the CSS delight layer in
// index.css disables the animation, the component still renders its resting
// state). Prefixed exports so nothing collides with UI.jsx primitives.
//
//   <StreakFlame count={6} />            a living flame that grows with a streak
//   <MoodRing value={4} onChange={fn} /> a tappable 5-step mood dial
//   <MilestoneBurst show={7} label="in a row" onDone={fn} />  a celebratory pop
//
// No new deps. Confetti comes from lib/celebrate.js.
import { useEffect, useRef, useState } from 'react';
import { celebrate } from '../lib/celebrate.js';

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ============================================================
   StreakFlame - a warm flame that flickers, and grows brighter
   and taller the longer the streak runs. Zero streak shows a
   gentle ember (an invitation, never a scold).
   ============================================================ */
export function StreakFlame({ count = 0, size = 34, showCount = true, className = '', style, title }) {
  // Intensity 0..1 saturates around a 30 day streak so early days already feel
  // rewarding but long streaks still visibly stand taller.
  const heat = Math.max(0, Math.min(1, count / 30));
  const lit = count > 0;
  const tier = count >= 30 ? 'blaze' : count >= 7 ? 'strong' : count >= 3 ? 'lit' : lit ? 'spark' : 'ember';
  const label = title || (lit ? `${count} in a row` : 'Start a streak today');
  return (
    <span
      className={`kd-flame kd-flame--${tier} ${className}`}
      style={{ '--flame-size': `${size}px`, '--flame-heat': heat, ...style }}
      role="img"
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 32" width={size} height={size * 1.18} aria-hidden>
        <defs>
          <radialGradient id="kdFlameOuter" cx="50%" cy="70%" r="65%">
            <stop offset="0%" stopColor="#f2c94c" />
            <stop offset="45%" stopColor="#e0794e" />
            <stop offset="100%" stopColor="#c2543a" />
          </radialGradient>
          <radialGradient id="kdFlameInner" cx="50%" cy="72%" r="55%">
            <stop offset="0%" stopColor="#fff6e2" />
            <stop offset="60%" stopColor="#f2c94c" />
            <stop offset="100%" stopColor="#e0794e" />
          </radialGradient>
        </defs>
        {/* outer flame body */}
        <path className="kd-flame__outer" fill={lit ? 'url(#kdFlameOuter)' : 'var(--n-200)'}
          d="M12 1c1.6 3.6-1.4 5.4-1.4 8.2 0 1.6 1.1 2.7 2.4 2.7 1.6 0 2.3-1.2 2.1-2.6 2.9 1.8 4.9 4.9 4.9 8.4 0 5-3.9 9-9 9s-9-4-9-9c0-3 1.4-5.6 3.6-7.3-.2 1.5.4 2.9 1.7 3.3C6.6 12 6 9.7 7.2 7.4 8.4 5.1 11.2 4 12 1z" />
        {/* inner core */}
        <path className="kd-flame__inner" fill={lit ? 'url(#kdFlameInner)' : 'var(--n-100)'}
          d="M12 12.5c1 2 2.7 2.6 2.7 4.9 0 1.8-1.3 3.3-3 3.3-2 0-3.1-1.4-3.1-3 0-1.7 1.1-2.4 1.7-3.6.5 1 .9 1.4 1.7 1.6-.5-1.1-.6-2.2 0-3.2z" />
      </svg>
      {showCount && lit && <b className="kd-flame__n tnum">{count}</b>}
    </span>
  );
}

/* ============================================================
   MoodRing - a tappable 5-step dial. Warm rose-to-gold-to-sage
   ramp. Springs when you pick. Uncontrolled or controlled.
   onChange(mood 1..5) fires on tap. Fully keyboard reachable.
   ============================================================ */
const MOODS = [
  { v: 1, face: '\u{1F614}', word: 'Heavy', color: 'var(--sky)' },
  { v: 2, face: '\u{1F615}', word: 'Low', color: 'var(--info)' },
  { v: 3, face: '\u{1F642}', word: 'Okay', color: 'var(--gold)' },
  { v: 4, face: '\u{1F60A}', word: 'Good', color: 'var(--sage)' },
  { v: 5, face: '\u{1F604}', word: 'Bright', color: 'var(--accent-600)' },
];

export function MoodRing({ value, defaultValue = 0, onChange, size = 56, label = true, className = '', style }) {
  const controlled = value != null;
  const [inner, setInner] = useState(defaultValue);
  const picked = controlled ? value : inner;
  const [bumpV, setBumpV] = useState(0);

  const choose = (v, e) => {
    if (!controlled) setInner(v);
    setBumpV(v);
    onChange?.(v);
    // a tiny confetti kiss from the tapped face, scaled to how good it feels
    if (!prefersReduced() && v >= 4 && e) {
      const r = e.currentTarget.getBoundingClientRect();
      celebrate({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: v === 5 ? 46 : 28, spread: 0.8 });
    }
  };

  const current = MOODS.find(m => m.v === picked);
  return (
    <div className={`kd-moodring ${className}`} style={style} role="radiogroup" aria-label="How are you feeling">
      <div className="kd-moodring__row">
        {MOODS.map(m => {
          const on = picked === m.v;
          return (
            <button
              key={m.v}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={m.word}
              title={m.word}
              onClick={(e) => choose(m.v, e)}
              className={`kd-mood ${on ? 'is-on' : ''} ${bumpV === m.v ? 'is-bump' : ''}`}
              style={{ '--mood-c': m.color, width: size, height: size, fontSize: size * 0.5 }}
              onAnimationEnd={() => setBumpV(0)}
            >
              <span aria-hidden>{m.face}</span>
            </button>
          );
        })}
      </div>
      {label && (
        <div className="kd-moodring__label" aria-live="polite">
          {current
            ? <><b style={{ color: current.color }}>{current.word}</b><span className="muted"> - tap to change</span></>
            : <span className="muted">Tap how today feels</span>}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MilestoneBurst - drop this anywhere; when `show` becomes a
   truthy value (e.g. a streak number), it fires confetti once
   and pops a warm badge that settles and auto-dismisses.
   Pass the same value again only after resetting to falsy.
   ============================================================ */
export function MilestoneBurst({ show, label = 'in a row', sublabel, onDone, holdMs = 2400 }) {
  const [active, setActive] = useState(false);
  const firedFor = useRef(null);

  useEffect(() => {
    if (!show || firedFor.current === show) return;
    firedFor.current = show;
    setActive(true);
    if (!prefersReduced()) {
      celebrate({ count: 150, spread: 1.15 });
      setTimeout(() => celebrate({ y: window.innerHeight / 2.4, count: 80, spread: 0.9 }), 240);
    }
    const t = setTimeout(() => { setActive(false); onDone?.(); }, holdMs);
    return () => clearTimeout(t);
  }, [show]); // eslint-disable-line

  // Reset the guard when the caller clears `show`, so the next milestone fires.
  useEffect(() => { if (!show) firedFor.current = null; }, [show]);

  if (!active) return null;
  return (
    <div className="kd-burst" role="status" aria-live="assertive" onClick={() => { setActive(false); onDone?.(); }}>
      <div className="kd-burst__card">
        <div className="kd-burst__rays" aria-hidden>
          {Array.from({ length: 12 }).map((_, i) => <i key={i} style={{ '--i': i }} />)}
        </div>
        <div className="kd-burst__big serif tnum">{show}</div>
        <div className="kd-burst__label">{label}</div>
        {sublabel && <div className="kd-burst__sub muted">{sublabel}</div>}
      </div>
    </div>
  );
}

export default { StreakFlame, MoodRing, MilestoneBurst };
