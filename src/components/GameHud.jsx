// The Game HUD: a slim, always-present ribbon at the top of every in-app screen.
// Quiet at rest, alive on change. It shows three things people come back for -
// their rank and level (an XP ring that fills toward the next level), their
// ritual streak (a flame that flickers while it is lit), and their spark balance
// (a count that ticks up when it grows). Level-ups sweep a warm glow across the
// whole bar. Everything respects prefers-reduced-motion and the native safe area.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './icons.jsx';
import { useGame, onGameMoment } from '../lib/game.js';
import * as store from '../lib/store.js';
import * as sfx from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';

const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Smoothly counts a displayed number from its previous value to the next one.
// Snaps instantly when reduced-motion is on. Tabular so the row never jitters.
function useCountUp(value, ms = 620) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);
  useEffect(() => {
    const to = value;
    const from = fromRef.current;
    if (from === to) return;
    if (reduced()) { fromRef.current = to; setShown(to); return; }
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (t) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(from + (to - from) * eased);
      setShown(v);
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, ms]);
  return shown;
}

export default function GameHud() {
  const profile = store.useStore((s) => s.profile);
  const g = useGame();

  // The ritual streak is the "don't break it" number. Guard-imported so a
  // missing export never throws.
  const streak = (store.ritualStreak && store.ritualStreak()) || 0;

  const sparksShown = useCountUp(g ? g.sparks : 0);

  // One-shot flourishes. Boolean flashes that auto-clear so the CSS animation
  // can replay on the next gain without ever remounting (which would break the
  // ring's smooth fill transition).
  const [xpFlash, setXpFlash] = useState(false);
  const [sparkPop, setSparkPop] = useState(false);
  const [sweep, setSweep] = useState(0);          // bump to replay the glow sweep
  const [floaters, setFloaters] = useState([]);   // little "+N" XP risers

  const prevXp = useRef(g ? g.xp : 0);
  const prevSparks = useRef(g ? g.sparks : 0);
  const floatId = useRef(0);
  const xpTimer = useRef(0);
  const sparkTimer = useRef(0);

  const flashXp = () => {
    setXpFlash(false);
    clearTimeout(xpTimer.current);
    requestAnimationFrame(() => {
      setXpFlash(true);
      xpTimer.current = setTimeout(() => setXpFlash(false), 720);
    });
  };
  const popSpark = () => {
    setSparkPop(false);
    clearTimeout(sparkTimer.current);
    requestAnimationFrame(() => {
      setSparkPop(true);
      sparkTimer.current = setTimeout(() => setSparkPop(false), 620);
    });
  };
  useEffect(() => () => { clearTimeout(xpTimer.current); clearTimeout(sparkTimer.current); }, []);

  // Watch raw snapshot fields so every gain lights the bar, no matter which
  // path produced it (a tracked action, a claimed quest, the daily reward).
  useEffect(() => {
    if (!g) return;
    const delta = g.xp - prevXp.current;
    if (delta > 0) {
      flashXp();
      if (!reduced()) {
        const id = ++floatId.current;
        setFloaters((f) => [...f, { id, amount: delta }]);
        setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1100);
      }
    }
    prevXp.current = g.xp;
  }, [g && g.xp]); // eslint-disable-line

  useEffect(() => {
    if (!g) return;
    if (g.sparks > prevSparks.current) popSpark();
    prevSparks.current = g.sparks;
  }, [g && g.sparks]); // eslint-disable-line

  // Moments: the level-up is the headline celebration - sweep the bar, chime,
  // and give a celebratory haptic.
  useEffect(() => {
    const off = onGameMoment((m) => {
      if (m.type === 'levelup') {
        setSweep((n) => n + 1);
        flashXp();
        try { (sfx.sLevelUp || sfx.sCelebrate)?.(); } catch {}
        haptic('celebrate');
      } else if (m.type === 'xp') {
        flashXp();
      }
    });
    return off;
  }, []);

  if (!profile || !g) return null;

  const pct = Math.max(0, Math.min(1, g.pct || 0));
  const RING = 34;
  const STROKE = 3.5;
  const r = (RING - STROKE) / 2;
  const circ = 2 * Math.PI * r;
  const off = circ * (1 - pct);
  const lit = streak > 0;
  const tap = () => { try { sfx.sTap?.(); } catch {} haptic('light'); };

  return (
    <div className="kdhud-wrap" role="banner" aria-label="Your progress">
      <div className="kdhud-inner">
        {/* 1) Rank + level + XP ring, taps through to the Journey */}
        <Link
          to="/journey"
          className={`kdhud-cluster kdhud-lvl${xpFlash ? ' is-pulse' : ''}`}
          onClick={tap}
          aria-label={`${g.rank}, level ${g.level}. ${Math.round(pct * 100)} percent to next level. Open your journey.`}
        >
          <span className="kdhud-ring" aria-hidden>
            <svg width={RING} height={RING} viewBox={`0 0 ${RING} ${RING}`}>
              <circle cx={RING / 2} cy={RING / 2} r={r} fill="none" stroke="var(--n-100)" strokeWidth={STROKE} />
              <circle
                className="kdhud-ring-fill"
                cx={RING / 2} cy={RING / 2} r={r} fill="none"
                stroke="var(--accent)" strokeWidth={STROKE} strokeLinecap="round"
                strokeDasharray={circ} strokeDashoffset={off}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            </svg>
            <span className="kdhud-ring-lvl">{g.level}</span>
          </span>
          <span className="kdhud-lvl-text">
            <span className="kdhud-rank">{g.rank}</span>
            <span className="kdhud-bar-track" aria-hidden>
              <span className="kdhud-bar-fill" style={{ width: `${pct * 100}%` }} />
            </span>
          </span>
          {floaters.map((f) => (
            <span key={f.id} className="kdhud-float" aria-hidden>+{f.amount}</span>
          ))}
        </Link>

        <span className="kdhud-spring" />

        {/* 2) The ritual streak flame */}
        <Link
          to="/journey"
          className={`kdhud-chip kdhud-streak${lit ? ' is-lit' : ''}`}
          onClick={tap}
          aria-label={`Ritual streak: ${streak} ${streak === 1 ? 'day' : 'days'}. Open your journey.`}
        >
          <span className="kdhud-flame" aria-hidden>
            <Icon name="flame" size={18} />
          </span>
          <span className="kdhud-num">{streak}</span>
        </Link>

        {/* 3) Spark balance */}
        <Link
          to="/rewards"
          className={`kdhud-chip kdhud-sparks${sparkPop ? ' is-pop' : ''}`}
          onClick={tap}
          aria-label={`${g.sparks} sparks. Open the spark shop.`}
        >
          <span className="kdhud-sparkle" aria-hidden>
            <Icon name="sparkles" size={17} />
          </span>
          <span className="kdhud-num">{sparksShown}</span>
        </Link>
      </div>

      {/* Level-up glow sweep, keyed so it replays on every level */}
      {sweep > 0 && !reduced() && <span key={sweep} className="kdhud-sweep" aria-hidden />}

      <style>{`
        .kdhud-wrap {
          position: sticky; top: 0; z-index: 30; width: 100%;
          background: color-mix(in srgb, var(--paper) 82%, transparent);
          backdrop-filter: blur(16px) saturate(1.25);
          -webkit-backdrop-filter: blur(16px) saturate(1.25);
          border-bottom: 1px solid var(--line);
          overflow: hidden;
        }
        .is-native .kdhud-wrap { padding-top: env(safe-area-inset-top, 0px); }
        .kdhud-inner {
          height: 50px; display: flex; align-items: center; gap: .7rem;
          width: 100%; max-width: var(--maxw); margin: 0 auto;
          padding: 0 1.75rem; position: relative;
        }
        .kdhud-spring { flex: 1 1 auto; }

        /* Level cluster */
        .kdhud-cluster { display: flex; align-items: center; gap: .55rem; position: relative;
          padding: .2rem .3rem; border-radius: var(--r-pill); text-decoration: none;
          transition: transform .16s var(--ease); }
        .kdhud-cluster:hover { transform: translateY(-1px); }
        .kdhud-cluster:active { transform: scale(.97); }
        .kdhud-ring { position: relative; width: 34px; height: 34px; flex: none; display: grid; place-items: center; }
        .kdhud-ring svg { display: block; }
        .kdhud-ring-fill { transition: stroke-dashoffset .8s var(--ease); }
        .kdhud-ring-lvl { position: absolute; inset: 0; display: grid; place-items: center;
          font-size: .74rem; font-weight: 800; color: var(--accent-700);
          font-variant-numeric: tabular-nums; line-height: 1; }
        .kdhud-lvl-text { display: flex; flex-direction: column; gap: .22rem; min-width: 0; }
        .kdhud-rank { font-size: .82rem; font-weight: 750; color: var(--ink); letter-spacing: -.005em;
          line-height: 1; white-space: nowrap; }
        .kdhud-bar-track { width: 84px; height: 4px; border-radius: 999px; background: var(--n-100); overflow: hidden; }
        .kdhud-bar-fill { display: block; height: 100%; border-radius: 999px;
          background: linear-gradient(90deg, var(--accent), var(--gold));
          transition: width .8s var(--ease); }

        /* XP gain flash */
        .kdhud-lvl.is-pulse .kdhud-ring-fill { animation: kdhudRingFlash .7s var(--ease); }
        .kdhud-lvl.is-pulse .kdhud-bar-fill { animation: kdhudBarFlash .7s var(--ease); }
        @keyframes kdhudRingFlash {
          0% { stroke: var(--gold); filter: drop-shadow(0 0 5px rgba(221,154,46,.85)); }
          100% { stroke: var(--accent); filter: none; }
        }
        @keyframes kdhudBarFlash { 0% { filter: brightness(1.5); } 100% { filter: none; } }

        /* Floating +XP */
        .kdhud-float { position: absolute; left: 22px; top: -2px; font-size: .78rem; font-weight: 800;
          color: var(--gold); font-variant-numeric: tabular-nums; pointer-events: none;
          text-shadow: 0 1px 6px rgba(221,154,46,.4); animation: kdhudFloat 1.1s var(--ease) forwards; }
        @keyframes kdhudFloat { 0% { opacity: 0; transform: translateY(4px) scale(.8); }
          25% { opacity: 1; transform: translateY(-4px) scale(1); }
          100% { opacity: 0; transform: translateY(-20px) scale(1); } }

        /* Chips (flame + sparks) */
        .kdhud-chip { display: inline-flex; align-items: center; gap: .35rem; padding: .32rem .62rem;
          border-radius: var(--r-pill); border: 1px solid var(--line); background: var(--paper);
          text-decoration: none; color: var(--n-600); transition: transform .16s var(--ease), border-color .16s, background .16s; }
        .kdhud-chip:hover { transform: translateY(-1px); border-color: var(--accent-300); }
        .kdhud-chip:active { transform: scale(.95); }
        .kdhud-num { font-size: .95rem; font-weight: 800; color: var(--ink); font-variant-numeric: tabular-nums; line-height: 1; }

        /* Flame */
        .kdhud-flame { display: grid; place-items: center; color: var(--n-400); transition: color .2s; }
        .kdhud-streak.is-lit { background: var(--accent-50); border-color: var(--accent-300); }
        .kdhud-streak.is-lit .kdhud-flame { color: var(--accent); animation: kdhudFlicker 2.4s ease-in-out infinite; transform-origin: 50% 90%; }
        .kdhud-streak.is-lit .kdhud-flame svg { fill: color-mix(in srgb, var(--gold) 55%, transparent); }
        @keyframes kdhudFlicker {
          0%, 100% { transform: scale(1) rotate(-1deg); filter: drop-shadow(0 0 3px rgba(217,107,67,.5)); }
          30% { transform: scale(1.06) rotate(1.5deg); filter: drop-shadow(0 0 6px rgba(221,154,46,.7)); }
          55% { transform: scale(.97) rotate(-1.5deg); filter: drop-shadow(0 0 4px rgba(217,107,67,.55)); }
          80% { transform: scale(1.03) rotate(1deg); filter: drop-shadow(0 0 7px rgba(221,154,46,.65)); }
        }

        /* Sparks */
        .kdhud-sparkle { display: grid; place-items: center; color: var(--gold); }
        .kdhud-sparks .kdhud-num { color: var(--accent-700); }
        .kdhud-sparks.is-pop .kdhud-sparkle { animation: kdhudSparkPop .6s var(--ease); }
        .kdhud-sparks.is-pop .kdhud-num { animation: kdhudNumPop .6s var(--ease); }
        @keyframes kdhudSparkPop { 0% { transform: scale(1) rotate(0); }
          40% { transform: scale(1.35) rotate(18deg); filter: drop-shadow(0 0 8px rgba(221,154,46,.9)); }
          100% { transform: scale(1) rotate(0); } }
        @keyframes kdhudNumPop { 0% { transform: scale(1); } 45% { transform: scale(1.22); color: var(--gold); } 100% { transform: scale(1); } }

        /* Level-up sweep across the whole bar */
        .kdhud-sweep { position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(105deg, transparent 20%,
            color-mix(in srgb, var(--gold) 42%, transparent) 48%,
            color-mix(in srgb, var(--accent-300) 40%, transparent) 56%, transparent 82%);
          transform: translateX(-120%); animation: kdhudSweep 1.15s var(--ease) forwards; }
        @keyframes kdhudSweep { 0% { transform: translateX(-120%); opacity: 0; }
          20% { opacity: 1; } 100% { transform: translateX(120%); opacity: 0; } }

        @media (max-width: 860px) {
          .kdhud-inner { padding: 0 1rem; height: 48px; }
          .kdhud-bar-track { width: 64px; }
          .kdhud-rank { font-size: .78rem; }
        }
        @media (max-width: 380px) {
          .kdhud-rank { display: none; }
          .kdhud-bar-track { width: 52px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .kdhud-ring-fill, .kdhud-bar-fill { transition: none !important; }
          .kdhud-cluster, .kdhud-chip { transition: none !important; }
          .kdhud-lvl.is-pulse .kdhud-ring-fill,
          .kdhud-lvl.is-pulse .kdhud-bar-fill,
          .kdhud-streak.is-lit .kdhud-flame,
          .kdhud-sparks.is-pop .kdhud-sparkle,
          .kdhud-sparks.is-pop .kdhud-num,
          .kdhud-float, .kdhud-sweep { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
