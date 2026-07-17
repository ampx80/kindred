// DayRing - the daily ritual made visual. Three concentric rings that fill as
// the person closes their day: Check in (morning), Moves (goals due today),
// Reflect (evening). A fully closed day is the streak that compounds. This is
// the addictive centerpiece: a clear, satisfying, low-pressure "finish the day"
// target, in Kindred's warm palette. Fully reduced-motion aware.
import { useEffect, useState } from 'react';
import { Icon } from './icons.jsx';

const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const RING_STYLE = [
  { color: 'var(--accent-600)', track: 'var(--accent-50)', icon: 'smile' },   // check in
  { color: 'var(--sage)', track: 'var(--sage-bg)', icon: 'check' },           // moves
  { color: 'var(--gold)', track: 'var(--gold-bg)', icon: 'moon' },            // reflect
];

function Arc({ radius, width, value, color, track, cx, cy, animate }) {
  const c = 2 * Math.PI * radius;
  const [shown, setShown] = useState(() => (animate ? 0 : value));
  useEffect(() => {
    if (!animate) { setShown(value); return; }
    const id = requestAnimationFrame(() => setShown(value));
    return () => cancelAnimationFrame(id);
  }, [value, animate]);
  const off = c * (1 - Math.max(0, Math.min(1, shown)));
  return (
    <>
      <circle cx={cx} cy={cy} r={radius} fill="none" stroke={track} strokeWidth={width} />
      <circle
        cx={cx} cy={cy} r={radius} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: animate ? 'stroke-dashoffset 1.1s cubic-bezier(.22,1,.36,1)' : 'none' }}
      />
    </>
  );
}

export default function DayRing({ progress, size = 180 }) {
  const rings = progress?.rings || [];
  const anim = !reduced();
  const cx = size / 2, cy = size / 2;
  const width = size * 0.072;
  const gap = width * 1.42;
  const radii = [
    size / 2 - width / 2 - 2,
    size / 2 - width / 2 - 2 - gap,
    size / 2 - width / 2 - 2 - gap * 2,
  ];
  const complete = progress?.complete;

  return (
    <div className="dayring" style={{ width: size, height: size }}>
      <svg width={size} height={size} className={complete ? 'dayring-svg is-complete' : 'dayring-svg'}>
        {rings.map((r, i) => (
          <Arc key={r.key} radius={radii[i]} width={width} value={r.value}
            color={RING_STYLE[i].color} track={RING_STYLE[i].track} cx={cx} cy={cy} animate={anim} />
        ))}
      </svg>
      <div className="dayring-center">
        {complete ? (
          <span className="dayring-done" aria-hidden><Icon name="check" size={size * 0.2} /></span>
        ) : (
          <>
            <span className="dayring-pct">{progress?.pct ?? 0}<span className="dayring-pct-u">%</span></span>
            <span className="dayring-label">of today</span>
          </>
        )}
      </div>
      <DayRingStyles />
    </div>
  );
}

// A compact legend row to pair with the ring (three labeled dots).
export function DayRingLegend({ progress, onReflect }) {
  const rings = progress?.rings || [];
  const labels = ['Check in', 'Move', 'Reflect'];
  return (
    <div className="dayring-legend">
      {rings.map((r, i) => (
        <div key={r.key} className={`drl-item${r.done ? ' is-done' : ''}`}>
          <span className="drl-dot" style={{ background: r.done ? RING_STYLE[i].color : 'transparent', borderColor: RING_STYLE[i].color }} aria-hidden>
            {r.done && <Icon name="check" size={11} />}
          </span>
          <div className="col" style={{ gap: 1, minWidth: 0 }}>
            <span className="drl-label">{labels[i]}</span>
            <span className="drl-sub">{r.done ? 'done' : r.sub || 'open'}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DayRingStyles() {
  return (
    <style>{`
      .dayring { position: relative; flex: none; display: grid; place-items: center; }
      .dayring > * { grid-area: 1 / 1; }
      .dayring-svg.is-complete { animation: drPop .7s cubic-bezier(.22,1,.36,1); }
      @keyframes drPop { 0% { transform: scale(1); } 40% { transform: scale(1.05); } 100% { transform: scale(1); } }
      .dayring-center { grid-area: 1 / 1; place-self: center; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
      .dayring-pct { font-family: var(--font-display); font-weight: 800; font-size: 2.5rem; line-height: 1; letter-spacing: -.03em; color: var(--ink); font-variant-numeric: tabular-nums; }
      .dayring-pct-u { font-size: 1.1rem; font-weight: 700; color: var(--n-500); }
      .dayring-label { font-size: .8rem; font-weight: 600; color: var(--n-500); margin-top: .25rem; text-transform: uppercase; letter-spacing: .08em; }
      .dayring-done { color: var(--sage); display: grid; place-items: center; animation: drCheck .6s cubic-bezier(.22,1,.36,1); }
      @keyframes drCheck { 0% { transform: scale(0) rotate(-20deg); opacity: 0; } 60% { transform: scale(1.25); } 100% { transform: scale(1); opacity: 1; } }

      .dayring-legend { display: flex; flex-direction: column; gap: .55rem; }
      .drl-item { display: flex; align-items: center; gap: .6rem; }
      .drl-dot { width: 22px; height: 22px; border-radius: 50%; border: 2px solid; display: grid; place-items: center; color: #fff; flex: none; transition: background .3s var(--ease); }
      .drl-label { font-weight: 700; font-size: .96rem; color: var(--ink); }
      .drl-item:not(.is-done) .drl-label { color: var(--n-600); }
      .drl-sub { font-size: .8rem; color: var(--n-500); }
      .drl-item.is-done .drl-sub { color: var(--sage); }

      @media (prefers-reduced-motion: reduce) {
        .dayring-svg.is-complete, .dayring-done { animation: none !important; }
      }
    `}</style>
  );
}
