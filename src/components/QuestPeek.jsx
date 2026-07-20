// QuestPeek - a floating, collapsible daily-quest tracker. Collapsed it is a
// compact pill with a tiny progress ring ("{done}/{total} quests" today) that
// gently pulses the moment a quest becomes claimable. Tap to expand a small
// panel listing today's daily quests with progress bars and rewards; a finished
// quest offers a glowing Claim button, a claimed one shows a check. Lives at
// bottom-left on desktop (clear of the 260px rail and the bottom-right AriaDock)
// and just above the tab bar on mobile. Remembers its open state.
import { useState, useEffect, useRef } from 'react';
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

function QpkRing({ value = 0, size = 30, stroke = 4, color = 'var(--accent-600)' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, value)));
  return (
    <svg className="qpk-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
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
        <div className="qpk-panel" role="dialog" aria-label="Today's quests">
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
                      <span className="qpk-bar__fill" style={{ width: `${row.done ? 100 : pct}%` }} />
                    </div>
                  </div>
                  <div className="qpk-row__end">
                    {row.claimed ? (
                      <span className="qpk-check" aria-label="Claimed"><Icon name="check" size={15} /></span>
                    ) : row.done ? (
                      <button className="qpk-claim" onClick={(e) => onClaim(e, row.id)}>Claim</button>
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
        <button className={`qpk-pill${pulse ? ' is-pulse' : ''}${allDone ? ' is-done' : ''}`} onClick={toggle} aria-label={`${done} of ${total} quests done today, open tracker`}>
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

        /* ---- collapsed pill ---- */
        .qpk-pill { display: inline-flex; align-items: center; gap: .55rem; padding: .4rem .8rem .4rem .45rem;
          background: var(--paper); border: 1px solid var(--line); border-radius: 999px; cursor: pointer;
          font-family: inherit; color: var(--ink); box-shadow: 0 12px 30px -14px rgba(70,50,35,.5), 0 1px 2px rgba(70,50,35,.05);
          transition: transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s, border-color .18s; }
        .qpk-pill:hover { transform: translateY(-2px); box-shadow: 0 18px 40px -14px rgba(70,50,35,.55); border-color: var(--accent-300); }
        .qpk-pill:active { transform: translateY(0) scale(.97); }
        .qpk-pill.is-done { border-color: var(--gold); background: var(--gold-bg); }
        .qpk-pill__ring { position: relative; display: grid; place-items: center; flex: none; }
        .qpk-pill__dot { position: absolute; top: -1px; right: -1px; width: 9px; height: 9px; border-radius: 50%;
          background: var(--gold); border: 2px solid var(--paper); box-shadow: 0 0 0 0 rgba(221,154,46,.6); animation: qpkDot 1.8s ease-out infinite; }
        .qpk-pill__text { display: flex; flex-direction: column; line-height: 1.05; }
        .qpk-pill__text .fw-7 { font-size: .95rem; font-variant-numeric: tabular-nums; color: var(--ink); }
        .qpk-pill__label { color: var(--n-500, var(--n-600)); letter-spacing: .02em; }
        .qpk-pill.is-pulse { animation: qpkPulse 1.4s ease-in-out; }
        @keyframes qpkPulse { 0%,100% { box-shadow: 0 12px 30px -14px rgba(70,50,35,.5), 0 0 0 0 rgba(221,154,46,0); }
          40% { box-shadow: 0 14px 34px -14px rgba(70,50,35,.5), 0 0 0 7px rgba(221,154,46,.18); } }
        @keyframes qpkDot { 0% { box-shadow: 0 0 0 0 rgba(221,154,46,.6); } 70%,100% { box-shadow: 0 0 0 7px rgba(221,154,46,0); } }

        /* ---- expanded panel ---- */
        .qpk-panel { width: min(320px, calc(100vw - 24px)); background: var(--paper); border: 1px solid var(--line);
          border-radius: var(--r-md, 16px); overflow: hidden; transform-origin: bottom left;
          box-shadow: 0 26px 60px -22px rgba(70,50,35,.5); animation: qpkIn .24s cubic-bezier(.22,1,.36,1); }
        @keyframes qpkIn { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }

        .qpk-panel__head { display: flex; align-items: center; gap: .65rem; width: 100%; padding: .7rem .8rem;
          background: transparent; border: none; border-bottom: 1px solid var(--line); cursor: pointer; font-family: inherit; text-align: left; }
        .qpk-panel__head:hover { background: var(--accent-50); }
        .qpk-panel__meta { display: flex; flex-direction: column; gap: .1rem; flex: 1; min-width: 0; }
        .qpk-panel__title { font-size: .95rem; color: var(--ink); }
        .qpk-panel__x { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 8px; color: var(--n-600); flex: none; }
        .qpk-panel__head:hover .qpk-panel__x { background: var(--paper); color: var(--ink); }

        .qpk-list { display: flex; flex-direction: column; padding: .35rem; max-height: 46dvh; overflow-y: auto; }
        .qpk-row { display: flex; align-items: center; gap: .6rem; padding: .55rem .5rem; border-radius: 12px; transition: background .15s; }
        .qpk-row + .qpk-row { margin-top: .1rem; }
        .qpk-row:hover { background: var(--n-50, var(--accent-50)); }
        .qpk-row.is-ready { background: var(--gold-bg); }
        .qpk-row.is-claimed { opacity: .62; }
        .qpk-row__ic { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 9px;
          background: var(--accent-50); color: var(--accent-600); flex: none; }
        .qpk-row.is-ready .qpk-row__ic { background: var(--gold-bg); color: var(--gold); }
        .qpk-row__body { flex: 1; min-width: 0; }
        .qpk-row__top { display: flex; align-items: baseline; gap: .5rem; }
        .qpk-row__title { flex: 1; min-width: 0; font-size: .88rem; color: var(--ink); }
        .qpk-row__reward { color: var(--n-600); white-space: nowrap; font-variant-numeric: tabular-nums; }
        .qpk-row__spk { display: inline-flex; align-items: center; gap: 1px; color: var(--gold); }
        .qpk-bar { margin-top: .35rem; height: 5px; border-radius: 999px; background: var(--line); overflow: hidden; }
        .qpk-bar__fill { display: block; height: 100%; border-radius: 999px;
          background: linear-gradient(90deg, var(--accent-300), var(--accent-600)); transition: width .6s cubic-bezier(.22,1,.36,1); }
        .qpk-row.is-ready .qpk-bar__fill, .qpk-row.is-claimed .qpk-bar__fill { background: linear-gradient(90deg, var(--gold), var(--accent-600)); }
        .qpk-row__end { flex: none; display: grid; place-items: center; min-width: 52px; }
        .qpk-prog { font-variant-numeric: tabular-nums; }
        .qpk-check { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 50%; background: var(--sage-bg); color: var(--sage); }

        .qpk-claim { font-family: inherit; font-size: .82rem; font-weight: 700; color: #fff; cursor: pointer;
          padding: .38rem .8rem; border-radius: 999px; border: none;
          background: linear-gradient(135deg, var(--gold), var(--accent-600));
          box-shadow: 0 6px 16px -6px rgba(221,154,46,.7); animation: qpkGlow 1.8s ease-in-out infinite;
          transition: transform .14s, box-shadow .18s, filter .15s; }
        .qpk-claim:hover { transform: translateY(-1px); filter: brightness(1.06); box-shadow: 0 10px 22px -6px rgba(221,154,46,.8); }
        .qpk-claim:active { transform: translateY(0) scale(.95); }
        @keyframes qpkGlow { 0%,100% { box-shadow: 0 6px 16px -6px rgba(221,154,46,.6); } 50% { box-shadow: 0 6px 22px -4px rgba(221,154,46,.95); } }

        .qpk-seeall { display: flex; align-items: center; justify-content: center; gap: .35rem; padding: .7rem;
          border-top: 1px solid var(--line); font-size: .85rem; font-weight: 700; color: var(--accent-700);
          text-decoration: none; transition: background .15s, gap .15s; }
        .qpk-seeall:hover { background: var(--accent-50); gap: .55rem; }
        .qpk-seeall svg { transition: transform .18s; }
        .qpk-seeall:hover svg { transform: translateX(2px); }

        /* ---- mobile: centered-ish, just above the tab bar (clear of AriaDock) ---- */
        @media (max-width: 760px) {
          .qpk { left: 50%; right: auto; transform: translateX(-50%); bottom: calc(86px + env(safe-area-inset-bottom)); }
          .qpk-panel { transform-origin: bottom center; }
        }

        @media (prefers-reduced-motion: reduce) {
          .qpk-pill, .qpk-panel, .qpk-pill__dot, .qpk-claim, .qpk-bar__fill { animation: none !important; transition: none !important; }
          .qpk-pill.is-pulse { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
