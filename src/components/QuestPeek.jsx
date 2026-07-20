// QuestPeek - a floating, collapsible daily-quest tracker. Collapsed it is a
// compact pill with a tiny progress ring ("{done}/{total} quests" today) that
// gently pulses the moment a quest becomes claimable. Tap to expand a small
// panel listing today's daily quests with progress bars and rewards; a finished
// quest offers a glowing Claim button, a claimed one shows a check. Lives at
// bottom-left on desktop (clear of the 260px rail and the bottom-right AriaDock)
// and just above the tab bar on mobile. Remembers its open state.
import { useState, useEffect, useRef, useId } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from './icons.jsx';
import { useToast } from './UI.jsx';
import { useGame, claimQuest, onGameMoment } from '../lib/game.js';
import { DAILY_QUEST_POOL } from '../lib/gameContent.js';
import { getProfile } from '../lib/store.js';
import { sTap, sPop, sSuccess } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { celebrate, burstFrom } from '../lib/celebrate.js';

const OPEN_KEY = 'kindred_questpeek_open';

function QpkRing({ value = 0, size = 30, stroke = 4, color = 'var(--accent-600)', holo = true }) {
  const uid = useId().replace(/[:]/g, '');
  const gid = `qpkHolo-${uid}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, value)));
  const paint = holo ? `url(#${gid})` : color;
  return (
    <svg className="qpk-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      {holo && (
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(var(--fx-amber))" />
            <stop offset="30%" stopColor="rgb(var(--fx-gold))" />
            <stop offset="55%" stopColor="rgb(var(--fx-magenta))" />
            <stop offset="78%" stopColor="rgb(var(--fx-violet))" />
            <stop offset="100%" stopColor="rgb(var(--fx-cyan))" />
          </linearGradient>
        </defs>
      )}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle className="qpk-ring__prog" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={paint} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

export default function QuestPeek() {
  const snap = useGame();
  const toast = useToast();
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
  });
  const [pulse, setPulse] = useState(false);
  const pulseTimer = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch {}
  }, [open]);

  // A quest just became claimable - draw the eye back with a soft pulse.
  useEffect(() => {
    const off = onGameMoment((m) => {
      if (m.type !== 'quest') return;
      setPulse(true);
      sPop();
      haptic('light');
      clearTimeout(pulseTimer.current);
      pulseTimer.current = setTimeout(() => setPulse(false), 2600);
    });
    return () => { off(); clearTimeout(pulseTimer.current); };
  }, []);

  const profile = getProfile();
  const daily = snap?.quests?.daily || [];
  const rows = daily
    .map((item) => {
      const def = DAILY_QUEST_POOL.find((q) => q.id === item.id);
      return def ? { ...item, def } : null;
    })
    .filter(Boolean);

  if (!profile || rows.length === 0) return null;

  const total = rows.length;
  const done = rows.filter((r) => r.done).length;
  const claimable = rows.filter((r) => r.done && !r.claimed).length;
  const allDone = done === total;
  const ringColor = allDone ? 'var(--gold)' : 'var(--accent-600)';

  const toggle = () => { sTap(); haptic('light'); setOpen((o) => !o); };

  const onClaim = (e, id) => {
    const r = claimQuest(id);
    if (!r || !r.ok) return;
    if (e && e.currentTarget) burstFrom(e.currentTarget); else celebrate();
    haptic('success');
    sSuccess();
    toast('Quest complete', 'ok');
    setPulse(false);
  };

  return (
    <div className="qpk">
      {open ? (
        <div className="qpk-panel fx-glass-deep" role="dialog" aria-label="Today's quests">
          <span className="qpk-aurora fx-aurora" aria-hidden />
          <button className="qpk-panel__head" onClick={toggle} aria-label="Collapse quests">
            <QpkRing value={total ? done / total : 0} size={34} stroke={4} color={ringColor} />
            <span className="qpk-panel__meta">
              <span className="qpk-panel__title fw-7">Today's quests</span>
              <span className="qpk-panel__sub muted t-xs">{done} of {total} complete</span>
            </span>
            <span className="qpk-panel__x"><Icon name="x" size={16} /></span>
          </button>

          <div className="qpk-list">
            {rows.map((row) => {
              const { def } = row;
              const pct = Math.max(0, Math.min(1, def.target ? row.progress / def.target : 0)) * 100;
              return (
                <div key={row.id} className={`qpk-row${row.claimed ? ' is-claimed' : ''}${row.done && !row.claimed ? ' is-ready' : ''}`}>
                  <span className="qpk-row__ic"><Icon name={def.icon} size={16} /></span>
                  <div className="qpk-row__body">
                    <div className="qpk-row__top">
                      <span className="qpk-row__title clip fw-6">{def.title}</span>
                      <span className="qpk-row__reward t-xs">
                        +{def.xp} XP <span className="qpk-row__spk"><Icon name="sparkles" size={11} />{def.sparks}</span>
                      </span>
                    </div>
                    <div className="qpk-bar" role="progressbar" aria-valuemin={0} aria-valuemax={def.target} aria-valuenow={Math.min(def.target, row.progress)}>
                      <span className="qpk-bar__fill fx-holo-fill" style={{ width: `${row.done ? 100 : pct}%` }} />
                    </div>
                  </div>
                  <div className="qpk-row__end">
                    {row.claimed ? (
                      <span className="qpk-check" aria-label="Claimed"><Icon name="check" size={15} /></span>
                    ) : row.done ? (
                      <button className="qpk-claim fx-glass" onClick={(e) => onClaim(e, row.id)}><span className="qpk-claim__lbl">Claim</span></button>
                    ) : (
                      <span className="qpk-prog t-xs muted">{Math.min(def.target, row.progress)}/{def.target}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <Link to="/quests" className="qpk-seeall" onClick={() => sTap()}>
            See all quests <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      ) : (
        <button className={`qpk-pill fx-glass${pulse ? ' is-pulse' : ''}${allDone ? ' is-done' : ''}${claimable > 0 ? ' fx-ring is-hot' : ''}`} onClick={toggle} aria-label={`${done} of ${total} quests done today, open tracker`}>
          <span className="qpk-pill__ring">
            <QpkRing value={total ? done / total : 0} size={28} stroke={3.5} color={ringColor} />
            {claimable > 0 && <span className="qpk-pill__dot" aria-hidden />}
          </span>
          <span className="qpk-pill__text">
            <span className="fw-7">{done}/{total}</span>
            <span className="qpk-pill__label t-xs">{allDone ? 'all done' : 'quests'}</span>
          </span>
        </button>
      )}

      <style>{`
        .qpk { position: fixed; left: 280px; bottom: 20px; z-index: 55; }

        /* ---- collapsed pill: a glowing holographic objectives token ---- */
        .qpk-pill { position: relative; display: inline-flex; align-items: center; gap: .55rem; padding: .4rem .85rem .4rem .48rem;
          border-radius: 999px; cursor: pointer; font-family: inherit; color: var(--ink);
          box-shadow: 0 14px 34px -16px rgba(70,50,35,.55), 0 0 0 1px rgba(var(--fx-glow), .06),
            0 0 18px -4px rgba(var(--fx-glow), .28);
          transition: transform .18s cubic-bezier(.22,1,.36,1), box-shadow .3s, border-color .18s;
          animation: qpkTokenGlow 4.2s var(--fx-ease, cubic-bezier(.22,1,.36,.68)) infinite; }
        .qpk-pill:hover { transform: translateY(-2px);
          box-shadow: 0 20px 44px -16px rgba(70,50,35,.6), 0 0 0 1px rgba(var(--fx-glow), .12),
            0 0 26px -2px rgba(var(--fx-glow), .42); }
        .qpk-pill:active { transform: translateY(0) scale(.97); }
        .qpk-pill.is-done { --fx-glow: var(--fx-goldrgb, 245,190,110); }
        .qpk-pill.is-hot { --fx-glow: 250,138,74; animation: qpkTokenHot 1.7s ease-in-out infinite; }

        .qpk-pill__ring { position: relative; display: grid; place-items: center; flex: none; }
        .qpk-pill__ring .qpk-ring { filter: drop-shadow(0 0 5px rgba(var(--fx-glow), .5)); }
        .qpk-pill__dot { position: absolute; top: -1px; right: -1px; width: 9px; height: 9px; border-radius: 50%;
          background: rgb(var(--fx-amber)); border: 2px solid rgba(var(--fx-glass), .9);
          box-shadow: 0 0 0 0 rgba(var(--fx-amber), .6), 0 0 8px rgba(var(--fx-amber), .8); animation: qpkDot 1.8s ease-out infinite; }
        .qpk-pill__text { display: flex; flex-direction: column; line-height: 1.05; }
        .qpk-pill__text .fw-7 { font-size: .95rem; font-variant-numeric: tabular-nums; color: var(--ink); }
        .qpk-pill__label { color: var(--n-500, var(--n-600)); letter-spacing: .06em; text-transform: uppercase; font-size: .62rem; }
        .qpk-pill.is-pulse { animation: qpkPulse 1.4s ease-in-out; }
        @keyframes qpkTokenGlow {
          0%,100% { box-shadow: 0 14px 34px -16px rgba(70,50,35,.55), 0 0 0 1px rgba(var(--fx-glow), .06), 0 0 16px -6px rgba(var(--fx-glow), .24); }
          50% { box-shadow: 0 16px 38px -16px rgba(70,50,35,.55), 0 0 0 1px rgba(var(--fx-glow), .12), 0 0 28px -2px rgba(var(--fx-glow), .46); } }
        @keyframes qpkTokenHot {
          0%,100% { box-shadow: 0 14px 34px -16px rgba(70,50,35,.55), 0 0 0 1px rgba(var(--fx-glow), .3), 0 0 22px -2px rgba(var(--fx-glow), .5); }
          50% { box-shadow: 0 16px 40px -16px rgba(70,50,35,.55), 0 0 0 2px rgba(var(--fx-glow), .5), 0 0 40px 2px rgba(var(--fx-glow), .78); } }
        @keyframes qpkPulse { 0%,100% { transform: scale(1); } 40% { transform: scale(1.05); } }
        @keyframes qpkDot { 0% { box-shadow: 0 0 0 0 rgba(var(--fx-amber), .6), 0 0 8px rgba(var(--fx-amber), .8); }
          70%,100% { box-shadow: 0 0 0 7px rgba(var(--fx-amber), 0), 0 0 8px rgba(var(--fx-amber), .8); } }

        /* ---- expanded panel: a frosted holo console ---- */
        .qpk-panel { position: relative; width: min(320px, calc(100vw - 24px));
          border-radius: var(--r-md, 16px); overflow: hidden; transform-origin: bottom left; isolation: isolate;
          box-shadow: 0 30px 70px -24px rgba(20,12,8,.55), 0 0 0 1px rgba(var(--fx-glow), .06),
            0 0 40px -12px rgba(var(--fx-glow), .28); animation: qpkIn .28s cubic-bezier(.22,1,.36,1); }
        .qpk-aurora { z-index: 0; opacity: .42; }
        .qpk-panel > *:not(.qpk-aurora) { position: relative; z-index: 1; }
        @keyframes qpkIn { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }

        .qpk-panel__head { display: flex; align-items: center; gap: .65rem; width: 100%; padding: .7rem .8rem;
          background: transparent; border: none; border-bottom: 1px solid rgba(var(--fx-line), calc(var(--fx-hairline) + .2));
          cursor: pointer; font-family: inherit; text-align: left; }
        .qpk-panel__head:hover { background: rgba(var(--fx-glow), .06); }
        .qpk-panel__head .qpk-ring { filter: drop-shadow(0 0 5px rgba(var(--fx-glow), .45)); }
        .qpk-panel__meta { display: flex; flex-direction: column; gap: .1rem; flex: 1; min-width: 0; }
        .qpk-panel__title { font-size: .95rem; color: var(--ink); }
        .qpk-panel__x { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; color: var(--n-600); flex: none; }
        .qpk-panel__head:hover .qpk-panel__x { background: rgba(var(--fx-line), .5); color: var(--ink); }

        .qpk-list { display: flex; flex-direction: column; padding: .35rem; max-height: 46dvh; overflow-y: auto; }
        .qpk-row { display: flex; align-items: center; gap: .6rem; padding: .55rem .5rem; border-radius: 12px;
          transition: background .15s, box-shadow .2s; }
        .qpk-row + .qpk-row { margin-top: .1rem; }
        .qpk-row:hover { background: rgba(var(--fx-line), .4); }
        .qpk-row.is-ready { background: rgba(var(--fx-amber), .1); box-shadow: inset 0 0 0 1px rgba(var(--fx-amber), .22); }
        .qpk-row.is-claimed { opacity: .58; }
        .qpk-row__ic { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px;
          background: rgba(var(--fx-glow), .12); color: var(--accent-600); flex: none; }
        .qpk-row.is-ready .qpk-row__ic { background: rgba(var(--fx-amber), .2); color: rgb(var(--fx-amber));
          box-shadow: 0 0 10px -2px rgba(var(--fx-amber), .5); }
        .qpk-row__body { flex: 1; min-width: 0; }
        .qpk-row__top { display: flex; align-items: baseline; gap: .5rem; }
        .qpk-row__title { flex: 1; min-width: 0; font-size: .88rem; color: var(--ink); }
        .qpk-row__reward { color: var(--n-600); white-space: nowrap; font-variant-numeric: tabular-nums; }
        .qpk-row__spk { display: inline-flex; align-items: center; gap: 1px; color: rgb(var(--fx-gold)); }
        .qpk-bar { margin-top: .35rem; height: 6px; border-radius: 999px; background: rgba(var(--fx-ink, 40,28,22), .12);
          overflow: hidden; box-shadow: inset 0 1px 2px rgba(20,12,8,.18); }
        .qpk-bar__fill { display: block; height: 100%; border-radius: 999px; transition: width .6s cubic-bezier(.22,1,.36,1);
          box-shadow: 0 0 10px -1px rgba(var(--fx-glow), .5); }
        .qpk-row__end { flex: none; display: grid; place-items: center; min-width: 52px; }
        .qpk-prog { font-variant-numeric: tabular-nums; }
        .qpk-check { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%;
          background: rgba(var(--fx-teal), .2); color: rgb(var(--fx-teal)); box-shadow: 0 0 12px -3px rgba(var(--fx-teal), .6); }

        /* ---- claim: a glassy neon button that flashes on tap ---- */
        .qpk-claim { position: relative; overflow: hidden; font-family: inherit; font-size: .82rem; font-weight: 700;
          color: var(--ink); cursor: pointer; padding: .4rem .85rem; border-radius: 999px;
          border: 1px solid rgba(var(--fx-amber), .5) !important;
          box-shadow: 0 0 0 1px rgba(var(--fx-amber), .3), 0 0 14px -2px rgba(var(--fx-amber), .55),
            0 6px 16px -8px rgba(20,12,8,.5) !important;
          animation: qpkClaimGlow 1.8s ease-in-out infinite; transition: transform .14s, box-shadow .18s, filter .15s; }
        .qpk-claim__lbl { position: relative; z-index: 2; background: var(--fx-holo); background-size: 300% 100%;
          -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent;
          animation: qpkClaimText 5s linear infinite; }
        .qpk-claim::after { content: ""; position: absolute; inset: 0; z-index: 1;
          background: linear-gradient(115deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%);
          transform: translateX(-120%); animation: qpkClaimSweep 2.6s var(--fx-ease, ease) infinite; pointer-events: none; }
        .qpk-claim:hover { transform: translateY(-1px); filter: brightness(1.05);
          box-shadow: 0 0 0 1px rgba(var(--fx-amber), .5), 0 0 22px 0 rgba(var(--fx-amber), .7), 0 10px 22px -8px rgba(20,12,8,.55) !important; }
        .qpk-claim:active { transform: translateY(0) scale(.94); }
        @keyframes qpkClaimGlow { 0%,100% { box-shadow: 0 0 0 1px rgba(var(--fx-amber), .3), 0 0 12px -2px rgba(var(--fx-amber), .5), 0 6px 16px -8px rgba(20,12,8,.5); }
          50% { box-shadow: 0 0 0 1px rgba(var(--fx-amber), .5), 0 0 26px 0 rgba(var(--fx-amber), .8), 0 6px 16px -8px rgba(20,12,8,.5); } }
        @keyframes qpkClaimText { to { background-position: 300% 0; } }
        @keyframes qpkClaimSweep { 0% { transform: translateX(-120%); } 55%,100% { transform: translateX(120%); } }

        .qpk-seeall { display: flex; align-items: center; justify-content: center; gap: .35rem; padding: .7rem;
          border-top: 1px solid rgba(var(--fx-line), calc(var(--fx-hairline) + .2)); font-size: .85rem; font-weight: 700;
          color: var(--accent-700); text-decoration: none; transition: background .15s, gap .15s; }
        .qpk-seeall:hover { background: rgba(var(--fx-glow), .08); gap: .55rem; }
        .qpk-seeall svg { transition: transform .18s; }
        .qpk-seeall:hover svg { transform: translateX(2px); }

        /* ---- mobile: centered-ish, just above the tab bar (clear of AriaDock) ---- */
        @media (max-width: 760px) {
          .qpk { left: 50%; right: auto; transform: translateX(-50%); bottom: calc(86px + env(safe-area-inset-bottom)); }
          .qpk-panel { transform-origin: bottom center; }
        }

        @media (prefers-reduced-motion: reduce) {
          .qpk-pill, .qpk-panel, .qpk-pill__dot, .qpk-claim, .qpk-claim__lbl, .qpk-bar__fill { animation: none !important; transition: none !important; }
          .qpk-pill.is-pulse, .qpk-pill.is-hot { animation: none !important; }
          .qpk-claim::after { display: none; }
        }
      `}</style>
    </div>
  );
}
