// Achievements - the collection gallery. A wall of tiles you want to fill:
// unlocked ones glow in their rarity color and remember the day you earned
// them, locked ones sit muted with a hint of how to reach them. A progress
// ring and a rarity breakdown sit up top, filter chips narrow the wall, and
// hitting 100 percent throws confetti once. Tapping an earned tile offers it
// up to the share sheet. Fully reduced-motion aware.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { useToast } from '../components/UI.jsx';
import { sTap } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { celebrate } from '../lib/celebrate.js';
import { track } from '../lib/track.js';
import { useGame } from '../lib/game.js';
import { ACHIEVEMENTS, RARITY } from '../lib/gameContent.js';
import FxBackdrop from '../components/FxBackdrop.jsx';

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

// Maps each rarity to a warm-holo glow triplet from the global FX palette. Fed
// into --fx-glow per tile so the neon glow matches the rarity color without
// touching the RARITY color logic that drives borders + labels.
const RARITY_GLOW = {
  common: 'var(--fx-teal)',
  rare: 'var(--fx-cyan)',
  epic: 'var(--fx-amber)',
  legendary: 'var(--fx-gold)',
};

const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const opts = d.getFullYear() === now.getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' };
  return d.toLocaleDateString('en-US', opts);
};

// A small inline lock glyph - the icon set ships no lock, so the overlay
// draws its own. Stroke style matches the rest of the app.
function LockGlyph({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

// The header progress ring: earned count over total, drawn as a warm arc.
function ProgressRing({ done, total, pct }) {
  const size = 116;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, pct)));
  const full = done >= total && total > 0;
  return (
    <div className="ach-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={full ? 'var(--gold)' : 'var(--accent-600)'} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .9s var(--ease)' }} />
      </svg>
      <div className="ach-ring-label col center">
        <span className="ach-ring-num tnum">{done}</span>
        <span className="t-xs muted fw-6">of {total}</span>
      </div>
    </div>
  );
}

export default function Achievements() {
  const snap = useGame();
  const toast = useToast();
  const unlocked = snap.achievements || {};
  const [filter, setFilter] = useState('all');
  const celebratedRef = useRef(false);

  useEffect(() => { track('achievements_view'); }, []);

  const stats = useMemo(() => {
    const total = ACHIEVEMENTS.length;
    let done = 0;
    const byRarity = {};
    for (const k of RARITY_ORDER) byRarity[k] = { total: 0, done: 0 };
    for (const a of ACHIEVEMENTS) {
      const r = byRarity[a.rarity] || (byRarity[a.rarity] = { total: 0, done: 0 });
      r.total += 1;
      if (unlocked[a.id]) { r.done += 1; done += 1; }
    }
    return { total, done, byRarity, pct: total ? done / total : 0 };
  }, [unlocked]);

  const complete = stats.total > 0 && stats.done >= stats.total;

  // The 100 percent moment: confetti, but only once per mounted session so a
  // re-render never re-fires it. celebrate() self-guards for reduced motion.
  useEffect(() => {
    if (!complete || celebratedRef.current) return;
    celebratedRef.current = true;
    let already = false;
    try { already = sessionStorage.getItem('kd_ach_100') === '1'; } catch {}
    if (already) return;
    try { sessionStorage.setItem('kd_ach_100', '1'); } catch {}
    haptic('celebrate');
    celebrate({ count: 160 });
  }, [complete]);

  const chips = useMemo(() => ([
    { key: 'all', label: 'All', count: stats.done, total: stats.total, color: 'var(--accent-600)' },
    ...RARITY_ORDER.map(k => ({
      key: k,
      label: RARITY[k].label,
      count: stats.byRarity[k].done,
      total: stats.byRarity[k].total,
      color: RARITY[k].color,
    })),
  ]), [stats]);

  const visible = useMemo(() => {
    const list = filter === 'all' ? ACHIEVEMENTS : ACHIEVEMENTS.filter(a => a.rarity === filter);
    // Earned first, then by rarity weight, so the wall reads like a trophy case.
    const weight = { legendary: 0, epic: 1, rare: 2, common: 3 };
    return [...list].sort((a, b) => {
      const ua = unlocked[a.id] ? 0 : 1;
      const ub = unlocked[b.id] ? 0 : 1;
      if (ua !== ub) return ua - ub;
      return (weight[a.rarity] ?? 9) - (weight[b.rarity] ?? 9);
    });
  }, [filter, unlocked]);

  const share = (a) => {
    haptic('light');
    sTap();
    const meta = RARITY[a.rarity] || RARITY.common;
    window.dispatchEvent(new CustomEvent('kindred:share', {
      detail: { title: 'I unlocked ' + a.name, subtitle: a.desc, stat: meta.label },
    }));
    toast('Ready to share ' + a.name);
    track('achievement_share', { id: a.id, rarity: a.rarity });
  };

  return (
    <div className="ach-page">
      <AchStyles />

      <header className="ach-head fx-glass">
        <FxBackdrop glow="245,190,110" density={30} style={{ opacity: 0.55 }} />
        <div className="row gap-2" style={{ alignItems: 'center', minWidth: 0 }}>
          <span className="aria-orb ach-orb fx-float" aria-hidden />
          <div className="col" style={{ gap: '.2rem', minWidth: 0 }}>
            <span className="eyebrow">Your collection</span>
            <h1 className="serif fx-holo-text ach-title" style={{ margin: 0, lineHeight: 1.1 }}>Achievements</h1>
            <span className="muted t-sm clip">
              {complete
                ? 'Every last one. The whole wall is yours.'
                : stats.done === 0
                  ? 'Keep your promises and the wall starts to fill.'
                  : `${stats.total - stats.done} still waiting to be earned.`}
            </span>
          </div>
        </div>
        <div className="ach-head-ring">
          <ProgressRing done={stats.done} total={stats.total} pct={stats.pct} />
          <div className="ach-breakdown">
            {RARITY_ORDER.map(k => {
              const meta = RARITY[k];
              const r = stats.byRarity[k];
              return (
                <span key={k} className="ach-brk" title={`${meta.label}: ${r.done} of ${r.total} unlocked`}>
                  <span className="ach-brk-dot" style={{ background: meta.color }} aria-hidden />
                  <span className="ach-brk-label fw-6">{meta.label}</span>
                  <span className="ach-brk-count tnum" style={{ color: meta.color }}>{r.done}/{r.total}</span>
                </span>
              );
            })}
          </div>
        </div>
      </header>

      {complete && (
        <div className="ach-banner" role="status">
          <span className="ach-banner-ic" aria-hidden><Icon name="trophy" size={26} /></span>
          <div className="col" style={{ gap: '.15rem', minWidth: 0 }}>
            <span className="fw-7" style={{ fontSize: '1.08rem' }}>Collection complete.</span>
            <span className="t-sm" style={{ opacity: .9 }}>
              All {stats.total} achievements unlocked. That is a rare kind of showing up. Aria is proud of you.
            </span>
          </div>
        </div>
      )}

      <div className="ach-chips" role="tablist" aria-label="Filter achievements">
        {chips.map(ch => {
          const active = filter === ch.key;
          return (
            <button key={ch.key} role="tab" aria-selected={active}
              className={`ach-chip${active ? ' is-active' : ''}`}
              style={active ? { borderColor: ch.color, color: ch.color, background: 'var(--paper)' } : undefined}
              onClick={() => { haptic('light'); sTap(); setFilter(ch.key); }}>
              {ch.key !== 'all' && <span className="ach-chip-dot" style={{ background: ch.color }} aria-hidden />}
              {ch.label}
              <span className="ach-chip-count tnum">{ch.count}/{ch.total}</span>
            </button>
          );
        })}
      </div>

      <div className="ach-grid">
        {visible.map((a, i) => {
          const meta = RARITY[a.rarity] || RARITY.common;
          const at = unlocked[a.id];
          const isUnlocked = !!at;
          const legendary = a.rarity === 'legendary';
          const delay = { animationDelay: `${Math.min(i, 14) * 0.04}s` };
          if (!isUnlocked) {
            return (
              <div key={a.id} className="ach-tile is-locked fx-glass fx-rise-in" style={delay} aria-label={`${a.name}, locked`}>
                <span className="ach-lock" aria-hidden><LockGlyph size={14} /></span>
                <span className="ach-ic ach-ic-locked" aria-hidden><Icon name={a.icon} size={24} /></span>
                <div className="col" style={{ gap: '.25rem', minWidth: 0 }}>
                  <span className="fw-7 clip">{a.name}</span>
                  <span className="muted t-sm ach-desc">{a.desc}</span>
                </div>
                <span className="ach-rarity ach-rarity-locked">{meta.label}</span>
              </div>
            );
          }
          return (
            <button key={a.id}
              className={`ach-tile is-unlocked fx-glass fx-tilt fx-rise-in${legendary ? ' is-legendary fx-ring' : ''}`}
              style={{ '--tint': meta.color, '--tint-bg': meta.bg, '--fx-glow': RARITY_GLOW[a.rarity] || 'var(--fx-amber)', ...delay }}
              onClick={() => share(a)}
              aria-label={`${a.name}, unlocked ${fmtDate(at)}. Tap to share.`}>
              {legendary && <span className="ach-scan" aria-hidden />}
              <span className="ach-sweep" aria-hidden />
              <span className="ach-ic" aria-hidden><Icon name={a.icon} size={24} /></span>
              <div className="col" style={{ gap: '.25rem', minWidth: 0 }}>
                <span className="fw-7 clip">{a.name}</span>
                <span className="muted t-sm ach-desc">{a.desc}</span>
              </div>
              <div className="row between gap-2" style={{ alignItems: 'center', marginTop: 'auto' }}>
                <span className="ach-rarity">{meta.label}</span>
                <span className="ach-date t-xs">
                  <Icon name="calendar" size={12} /> {fmtDate(at)}
                </span>
              </div>
              <span className="ach-share-hint t-xs" aria-hidden>
                <Icon name="send" size={12} /> Share
              </span>
            </button>
          );
        })}
      </div>

      {visible.length === 0 && (
        <div className="ach-empty col center">
          <span className="ach-ic ach-ic-locked" aria-hidden><Icon name="sparkles" size={26} /></span>
          <span className="fw-6" style={{ marginTop: '.6rem' }}>Nothing here yet.</span>
          <span className="muted t-sm">No {filter} achievements match. Try another filter.</span>
        </div>
      )}

      <p className="ach-foot muted t-sm center">
        Achievements unlock on their own as you show up. Keep closing your days on <Link className="link" to="/today">Today</Link>.
      </p>
    </div>
  );
}

function AchStyles() {
  return (
    <style>{`
      .ach-page { max-width: 980px; margin: 0 auto; padding-bottom: 120px; display: flex; flex-direction: column; gap: 1.5rem; }
      .ach-page .tnum { font-variant-numeric: tabular-nums; }

      @media (prefers-reduced-motion: no-preference) {
        .ach-page > * { animation: achEnter .5s cubic-bezier(.22,1,.36,1) both; }
        .ach-page > *:nth-child(3) { animation-delay: .05s; }
        .ach-page > *:nth-child(4) { animation-delay: .1s; }
        .ach-page > *:nth-child(n+5) { animation-delay: .15s; }
      }
      @keyframes achEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

      /* Header - warm glass slab with a light aurora behind the content */
      .ach-head { position: relative; overflow: hidden; isolation: isolate;
        display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap;
        padding: 1.4rem 1.6rem; border-radius: var(--r-md); }
      .ach-head > *:not(.fx-backdrop) { position: relative; z-index: 1; }
      .ach-orb { width: 46px; height: 46px; flex: none; }
      .ach-title { background-size: 220% 100%; letter-spacing: -.01em;
        filter: drop-shadow(0 1px 10px rgba(var(--fx-gold), .35)); }
      .ach-head-ring { display: flex; align-items: center; gap: 1.1rem; flex-wrap: wrap; }

      .ach-ring { position: relative; flex: none; }
      /* Soft holo halo bloom behind the progress ring */
      .ach-ring::after { content: ""; position: absolute; inset: -14px; border-radius: 50%; z-index: -1;
        background: radial-gradient(circle at 50% 50%, rgba(var(--fx-gold), .5), rgba(var(--fx-amber), .18) 55%, transparent 72%);
        filter: blur(6px); animation: achHalo 4.2s ease-in-out infinite; }
      @keyframes achHalo { 0%,100% { opacity: .55; transform: scale(.97); } 50% { opacity: 1; transform: scale(1.04); } }
      .ach-ring-label { position: absolute; inset: 0; gap: 0; }
      .ach-ring-num { font-size: 2.1rem; font-weight: 800; line-height: 1; color: var(--ink); }

      .ach-breakdown { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem .9rem; }
      .ach-brk { display: inline-flex; align-items: center; gap: .4rem; font-size: .84rem; white-space: nowrap; }
      .ach-brk-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
      .ach-brk-label { color: var(--n-600); }
      .ach-brk-count { font-weight: 800; margin-left: .1rem; }

      /* 100% banner - a gold holo slab with a light sweep */
      .ach-banner { position: relative; overflow: hidden; display: flex; align-items: center; gap: .9rem; padding: 1rem 1.2rem;
        border-radius: var(--r-md); border: 1px solid rgba(var(--fx-gold), .6);
        background: linear-gradient(135deg, rgba(var(--fx-gold), .28), var(--gold-bg) 45%, var(--paper));
        box-shadow: 0 1px 0 rgba(255,255,255,.5) inset, 0 12px 34px -16px rgba(20,12,8,.4), 0 0 26px rgba(var(--fx-gold), .3); }
      .ach-banner::after { content: ""; position: absolute; inset: 0; pointer-events: none;
        background: linear-gradient(115deg, transparent 34%, rgba(255,255,255,.5) 50%, transparent 66%);
        transform: translateX(-130%); animation: achSweep 4.4s var(--fx-ease) infinite; }
      .ach-banner > * { position: relative; z-index: 1; }
      .ach-banner-ic { width: 48px; height: 48px; border-radius: 14px; flex: none; display: grid; place-items: center;
        background: linear-gradient(150deg, rgba(255,255,255,.6), var(--gold-bg)); color: var(--gold);
        box-shadow: inset 0 0 0 1.5px rgba(var(--fx-gold), .5), 0 0 18px rgba(var(--fx-gold), .4);
        animation: achFloat 3s ease-in-out infinite; }
      @keyframes achFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-4px); } }

      /* Filter chips */
      .ach-chips { display: flex; flex-wrap: wrap; gap: .5rem; }
      .ach-chip { display: inline-flex; align-items: center; gap: .45rem; cursor: pointer;
        font-weight: 700; font-size: .9rem; color: var(--n-600);
        background: var(--paper); border: 1.5px solid var(--line); border-radius: var(--r-pill);
        padding: .48rem .9rem; transition: transform .15s var(--ease), border-color .15s var(--ease), box-shadow .15s var(--ease), color .15s var(--ease); }
      .ach-chip:hover { transform: translateY(-2px); border-color: var(--accent-300); box-shadow: var(--shadow-sm); }
      .ach-chip:active { transform: translateY(0) scale(.96); }
      .ach-chip.is-active { box-shadow: var(--shadow-sm); }
      .ach-chip-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; }
      .ach-chip-count { font-size: .78rem; opacity: .7; font-weight: 700; }

      /* Grid */
      .ach-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 1rem; }

      .ach-tile { position: relative; overflow: hidden; text-align: left;
        display: flex; flex-direction: column; gap: .7rem; min-height: 172px;
        padding: 1.15rem; border-radius: var(--r-md); border: 1px solid var(--line);
        background: var(--paper); }

      /* Unlocked - a glass holo-badge, tinted + neon-glowed by rarity */
      .ach-tile.is-unlocked { cursor: pointer; overflow: visible; border-color: var(--tint);
        transform-style: preserve-3d; will-change: transform;
        background:
          linear-gradient(150deg, rgba(var(--fx-glow), .16), var(--tint-bg) 52%, rgba(var(--fx-glass), calc(var(--fx-glass-a) - .1)) 100%);
        box-shadow:
          0 1px 0 rgba(255,255,255,.45) inset,
          0 12px 34px -16px rgba(20,12,8,.42),
          0 0 0 1px rgba(var(--fx-glow), .3),
          0 0 20px rgba(var(--fx-glow), .26);
        transition: transform .25s var(--fx-ease), box-shadow .25s var(--fx-ease); }
      .ach-tile.is-unlocked:hover {
        transform: perspective(820px) translateY(-4px) rotateX(3.5deg) rotateY(-3.5deg) translateZ(10px);
        box-shadow:
          0 1px 0 rgba(255,255,255,.55) inset,
          0 22px 46px -18px rgba(20,12,8,.5),
          0 0 0 1px rgba(var(--fx-glow), .5),
          0 0 34px rgba(var(--fx-glow), .45); }
      .ach-tile.is-unlocked:active { transform: perspective(820px) translateY(-1px) scale(.99); }
      .ach-tile.is-unlocked:focus-visible { outline: 2px solid var(--tint); outline-offset: 2px; }

      /* Light sweep across every unlocked badge */
      .ach-sweep { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; pointer-events: none; }
      .ach-sweep::after { content: ""; position: absolute; inset: 0;
        background: linear-gradient(115deg, transparent 34%, rgba(255,255,255,.5) 50%, transparent 66%);
        transform: translateX(-130%); animation: achSweep 4.4s var(--fx-ease) infinite; }
      @keyframes achSweep { 0% { transform: translateX(-130%); } 58%, 100% { transform: translateX(130%); } }

      .ach-ic { position: relative; width: 46px; height: 46px; border-radius: 14px; flex: none; display: grid; place-items: center;
        background: linear-gradient(150deg, rgba(255,255,255,.55), rgba(var(--fx-glow), .1));
        color: var(--tint);
        box-shadow: inset 0 0 0 1.5px var(--tint), inset 0 1px 0 rgba(255,255,255,.5), 0 0 16px rgba(var(--fx-glow), .3); }
      .ach-ic-locked { background: var(--n-50); color: var(--n-400); box-shadow: none; }
      .ach-desc { line-height: 1.4; }

      .ach-rarity { display: inline-flex; align-items: center; font-size: .72rem; font-weight: 800;
        text-transform: uppercase; letter-spacing: .06em; color: var(--tint);
        background: var(--paper); border: 1px solid var(--tint); border-radius: var(--r-pill); padding: .16rem .55rem; }
      .ach-rarity-locked { color: var(--n-400); border-color: var(--line); }
      .ach-date { display: inline-flex; align-items: center; gap: .3rem; color: var(--n-500); font-weight: 600; white-space: nowrap; }

      .ach-share-hint { position: absolute; top: .85rem; right: .85rem; display: inline-flex; align-items: center; gap: .25rem;
        color: var(--tint); font-weight: 700; opacity: 0; transform: translateY(-3px);
        transition: opacity .18s var(--ease), transform .18s var(--ease); }
      .ach-tile.is-unlocked:hover .ach-share-hint,
      .ach-tile.is-unlocked:focus-visible .ach-share-hint { opacity: 1; transform: none; }

      /* Legendary - rotating holo ring, stronger sheen, faint scanline */
      .ach-tile.is-legendary { border-width: 1.5px; border-color: transparent; }
      .ach-tile.is-legendary::after { content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit; pointer-events: none;
        background: var(--fx-holo); background-size: 300% 100%; opacity: .18; mix-blend-mode: screen;
        animation: achLegendSheen 6s linear infinite; }
      @keyframes achLegendSheen { to { background-position: 300% 0; } }
      .ach-tile.is-legendary { animation: fx-rise 560ms var(--fx-ease) both, achLegendBreath 3.8s var(--fx-ease) infinite; }
      @keyframes achLegendBreath {
        0%,100% { box-shadow: 0 1px 0 rgba(255,255,255,.45) inset, 0 12px 34px -16px rgba(20,12,8,.42), 0 0 0 1px rgba(var(--fx-glow), .32), 0 0 20px rgba(var(--fx-glow), .3); }
        50% { box-shadow: 0 1px 0 rgba(255,255,255,.55) inset, 0 14px 38px -16px rgba(20,12,8,.46), 0 0 0 1px rgba(var(--fx-glow), .55), 0 0 40px rgba(var(--fx-glow), .5); }
      }
      /* Faint scanline drifting down legendary badges */
      .ach-scan { position: absolute; inset: 0; z-index: -1; border-radius: inherit; overflow: hidden; pointer-events: none; }
      .ach-scan::after { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 34%;
        background: linear-gradient(180deg, rgba(var(--fx-glow), .28), transparent);
        animation: achScan 3.6s var(--fx-ease) infinite; }
      @keyframes achScan { 0% { transform: translateY(-120%); } 100% { transform: translateY(320%); } }

      /* Locked - dim frosted glass with a crystalline lock */
      .ach-tile.is-locked { overflow: hidden; opacity: .82; border-color: rgba(var(--fx-line), calc(var(--fx-hairline) + .2));
        background: linear-gradient(150deg, rgba(var(--fx-glass), calc(var(--fx-glass-a) + .1)), rgba(var(--fx-glass), calc(var(--fx-glass-a) - .05)));
        filter: saturate(.55); }
      .ach-tile.is-locked .ach-ic-locked { color: var(--n-400); }
      .ach-tile.is-locked .fw-7 { color: var(--n-600); }
      .ach-lock { position: absolute; top: .85rem; right: .85rem; z-index: 1; display: grid; place-items: center;
        width: 28px; height: 28px; border-radius: 9px; color: var(--n-500);
        background: linear-gradient(135deg, rgba(255,255,255,.7), rgba(var(--fx-violet), .14) 60%, rgba(var(--fx-cyan), .16));
        border: 1px solid rgba(var(--fx-line), calc(var(--fx-hairline) + .3));
        box-shadow: inset 0 1px 0 rgba(255,255,255,.6), inset 0 -6px 10px -6px rgba(var(--fx-violet), .4), 0 2px 6px -3px rgba(20,12,8,.4); }
      /* Crystalline facet glint across the lock */
      .ach-lock::after { content: ""; position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
        background: linear-gradient(130deg, transparent 42%, rgba(255,255,255,.7) 50%, transparent 58%); }

      .ach-empty { padding: 3rem 1.5rem; border: 1px dashed var(--line); border-radius: var(--r-md); text-align: center; }
      .ach-foot { padding-top: .3rem; }

      @media (max-width: 620px) {
        .ach-head { justify-content: flex-start; }
        .ach-head-ring { width: 100%; }
        .ach-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
      }

      @media (prefers-reduced-motion: reduce) {
        .ach-page > *, .ach-banner-ic, .ach-chip, .ach-chip:hover, .ach-chip:active,
        .ach-tile, .ach-tile.is-unlocked, .ach-tile.is-unlocked:hover,
        .ach-tile.is-legendary, .ach-tile.is-legendary::after, .ach-ring::after,
        .ach-share-hint { animation: none !important; transition: none !important; transform: none !important; }
        .ach-sweep, .ach-scan, .ach-banner::after { display: none !important; }
      }
    `}</style>
  );
}
