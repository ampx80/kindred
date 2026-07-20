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

const RARITY_ORDER = ['common', 'rare', 'epic', 'legendary'];

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

      <header className="ach-head">
        <div className="row gap-2" style={{ alignItems: 'center', minWidth: 0 }}>
          <span className="aria-orb ach-orb" aria-hidden />
          <div className="col" style={{ gap: '.2rem', minWidth: 0 }}>
            <span className="eyebrow">Your collection</span>
            <h1 className="serif" style={{ margin: 0, lineHeight: 1.1 }}>Achievements</h1>
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
        {visible.map(a => {
          const meta = RARITY[a.rarity] || RARITY.common;
          const at = unlocked[a.id];
          const isUnlocked = !!at;
          const legendary = a.rarity === 'legendary';
          if (!isUnlocked) {
            return (
              <div key={a.id} className="ach-tile is-locked" aria-label={`${a.name}, locked`}>
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
              className={`ach-tile is-unlocked${legendary ? ' is-legendary' : ''}`}
              style={{ '--tint': meta.color, '--tint-bg': meta.bg }}
              onClick={() => share(a)}
              aria-label={`${a.name}, unlocked ${fmtDate(at)}. Tap to share.`}>
              {legendary && <span className="ach-shine" aria-hidden />}
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

      /* Header */
      .ach-head { display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; }
      .ach-orb { width: 46px; height: 46px; flex: none; }
      .ach-head-ring { display: flex; align-items: center; gap: 1.1rem; flex-wrap: wrap; }

      .ach-ring { position: relative; flex: none; }
      .ach-ring-label { position: absolute; inset: 0; gap: 0; }
      .ach-ring-num { font-size: 2.1rem; font-weight: 800; line-height: 1; color: var(--ink); }

      .ach-breakdown { display: grid; grid-template-columns: 1fr 1fr; gap: .4rem .9rem; }
      .ach-brk { display: inline-flex; align-items: center; gap: .4rem; font-size: .84rem; white-space: nowrap; }
      .ach-brk-dot { width: 9px; height: 9px; border-radius: 50%; flex: none; }
      .ach-brk-label { color: var(--n-600); }
      .ach-brk-count { font-weight: 800; margin-left: .1rem; }

      /* 100% banner */
      .ach-banner { display: flex; align-items: center; gap: .9rem; padding: 1rem 1.2rem;
        border-radius: var(--r-md); border: 1px solid var(--gold);
        background: linear-gradient(135deg, var(--gold-bg), var(--paper));
        box-shadow: var(--shadow-sm); }
      .ach-banner-ic { width: 48px; height: 48px; border-radius: 14px; flex: none; display: grid; place-items: center;
        background: var(--gold-bg); color: var(--gold); animation: achFloat 3s ease-in-out infinite; }
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

      /* Unlocked - vivid, tinted by rarity */
      .ach-tile.is-unlocked { cursor: pointer; border-color: var(--tint);
        background: linear-gradient(150deg, var(--tint-bg), var(--paper) 78%);
        box-shadow: var(--shadow-sm);
        transition: transform .18s var(--ease), box-shadow .18s var(--ease); }
      .ach-tile.is-unlocked:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); }
      .ach-tile.is-unlocked:active { transform: translateY(-1px) scale(.99); }
      .ach-tile.is-unlocked:focus-visible { outline: 2px solid var(--tint); outline-offset: 2px; }

      .ach-ic { width: 46px; height: 46px; border-radius: 14px; flex: none; display: grid; place-items: center;
        background: var(--paper); color: var(--tint); box-shadow: inset 0 0 0 1.5px var(--tint); }
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

      /* Legendary shimmer */
      .ach-tile.is-legendary { border-width: 1.5px; }
      .ach-shine { position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
        background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.55) 48%, transparent 62%);
        background-size: 250% 100%; animation: achShine 4.5s ease-in-out infinite; }
      @keyframes achShine { 0% { background-position: 150% 0; } 55%,100% { background-position: -80% 0; } }

      /* Locked - muted, greyscale */
      .ach-tile.is-locked { filter: grayscale(1); opacity: .72; }
      .ach-tile.is-locked .fw-7 { color: var(--n-600); }
      .ach-lock { position: absolute; top: .85rem; right: .85rem; display: grid; place-items: center;
        width: 26px; height: 26px; border-radius: 50%; background: var(--n-50); color: var(--n-500); border: 1px solid var(--line); }

      .ach-empty { padding: 3rem 1.5rem; border: 1px dashed var(--line); border-radius: var(--r-md); text-align: center; }
      .ach-foot { padding-top: .3rem; }

      @media (max-width: 620px) {
        .ach-head { justify-content: flex-start; }
        .ach-head-ring { width: 100%; }
        .ach-grid { grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
      }

      @media (prefers-reduced-motion: reduce) {
        .ach-page > *, .ach-banner-ic, .ach-shine, .ach-chip, .ach-chip:hover, .ach-chip:active,
        .ach-tile.is-unlocked, .ach-tile.is-unlocked:hover, .ach-share-hint { animation: none !important; transition: none !important; transform: none !important; }
        .ach-shine { display: none; }
      }
    `}</style>
  );
}
