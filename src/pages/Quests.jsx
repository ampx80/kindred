// Quests - the quest board. Aria hands you a small set of daily and weekly
// intentions drawn from real actions in the app. Every quest shows honest
// progress toward its target, and completing one lights the card up with a
// prominent "Claim reward" that pays out XP and sparks with a real celebration.
// Two horizons: Today (rolls at local midnight) and This week (rolls Monday).
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { useToast } from '../components/UI.jsx';
import { useGame, claimQuest } from '../lib/game.js';
import { DAILY_QUEST_POOL, WEEKLY_QUEST_POOL } from '../lib/gameContent.js';
import { sSuccess, sTap } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { celebrate, burstFrom } from '../lib/celebrate.js';
import { track } from '../lib/track.js';

const DEFS = {};
for (const q of [...DAILY_QUEST_POOL, ...WEEKLY_QUEST_POOL]) DEFS[q.id] = q;

// How long until each horizon rolls over, phrased warmly and short.
function dailyResetLabel(now) {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const h = Math.max(1, Math.round((next.getTime() - now.getTime()) / 3600000));
  return `resets in ${h}h`;
}
function weeklyResetLabel(now) {
  const day = now.getDay(); // 0 = Sun ... 1 = Mon
  const daysToMon = (8 - day) % 7 || 7; // days until the next Monday
  if (daysToMon <= 1) {
    const next = new Date(now);
    next.setHours(24, 0, 0, 0);
    const h = Math.max(1, Math.round((next.getTime() - now.getTime()) / 3600000));
    return `resets Monday, in ${h}h`;
  }
  return `resets Monday, in ${daysToMon} days`;
}

function QuestCard({ item, def, onClaim }) {
  const target = Math.max(1, def.target || 1);
  const progress = Math.min(target, item.progress || 0);
  const pct = Math.round((progress / target) * 100);
  const claimable = item.done && !item.claimed;
  const claimed = item.done && item.claimed;
  const state = claimed ? 'claimed' : claimable ? 'ready' : 'active';

  return (
    <div className={`qstx-card qstx-card--${state}`}>
      <div className="qstx-card__top">
        <span className="qstx-chip" aria-hidden>
          <Icon name={def.icon || 'sparkles'} size={20} />
        </span>
        <div className="qstx-card__body">
          <div className="qstx-card__head">
            <h3 className="qstx-card__title clip">{def.title}</h3>
            {claimed && (
              <span className="qstx-done" title="Claimed">
                <Icon name="check" size={14} /> Claimed
              </span>
            )}
          </div>
          <p className="qstx-card__desc">{def.desc}</p>

          <div className="qstx-bar" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={target}>
            <i style={{ width: `${pct}%` }} />
          </div>
          <div className="qstx-meta">
            <span className="qstx-count">{progress}<span className="muted">/{target}</span></span>
            <div className="qstx-rewards">
              <span className="qstx-reward qstx-reward--xp">+{def.xp} XP</span>
              <span className="qstx-reward qstx-reward--spark">+{def.sparks} sparks</span>
            </div>
          </div>
        </div>
      </div>

      {claimable && (
        <button type="button" className="btn btn-primary qstx-claim" onClick={(e) => onClaim(e, item.id)}>
          <Icon name="sparkles" size={17} /> Claim reward
        </button>
      )}
      {state === 'active' && (
        <div className="qstx-hint muted t-xs">
          <Icon name="target" size={13} /> {target - progress} more to go
        </div>
      )}
    </div>
  );
}

function QuestSection({ eyebrow, title, note, list, onClaim, emptyBody }) {
  const items = Array.isArray(list) ? list.map((it) => ({ it, def: DEFS[it.id] })).filter((x) => x.def) : [];
  return (
    <section className="qstx-section">
      <div className="qstx-section__head">
        <div className="col" style={{ gap: '.25rem', minWidth: 0 }}>
          <span className="qstx-eyebrow">{eyebrow}</span>
          <h2 className="qstx-section__title">{title}</h2>
        </div>
        <span className="qstx-note">
          <Icon name="refresh" size={13} /> {note}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="qstx-empty">
          <span className="row center floaty qstx-empty__ico" aria-hidden>
            <Icon name="compass" size={24} />
          </span>
          <p className="qstx-empty__title fw-6">Aria is lining up your quests</p>
          <p className="muted t-sm" style={{ margin: 0 }}>{emptyBody}</p>
        </div>
      ) : (
        <div className="qstx-grid">
          {items.map(({ it, def }) => (
            <QuestCard key={it.id} item={it} def={def} onClaim={onClaim} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function Quests() {
  const snap = useGame();
  const toast = useToast();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => { track('quests_view'); }, []);

  // Keep the reset countdowns honest without any animation churn.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const daily = (snap.quests && snap.quests.daily) || [];
  const weekly = (snap.quests && snap.quests.weekly) || [];

  const dailyDone = daily.filter((q) => q.done).length;
  const dailyTotal = daily.length;
  const weeklyDone = weekly.filter((q) => q.done).length;
  const claimable = [...daily, ...weekly].filter((q) => q.done && !q.claimed).length;

  const subline = dailyTotal
    ? `You have done ${dailyDone} of ${dailyTotal} today`
    : 'Your first quests arrive as you use Kindred';

  const onClaim = (e, id) => {
    sTap();
    const r = claimQuest(id);
    if (!r || !r.ok) {
      toast('That reward is already claimed', 'warn');
      return;
    }
    burstFrom(e.currentTarget);
    celebrate();
    haptic('success');
    sSuccess();
    toast(`+${r.xp} XP, +${r.sparks} sparks`, 'ok');
  };

  const css = `
    .qstx { max-width: 900px; margin: 0 auto; padding: 1.4rem 1.15rem 120px; }

    .qstx-hero { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.6rem; }
    .qstx-hero__orb { width: 52px; height: 52px; }
    .qstx-hero__title { margin: 0; font-family: var(--font-display, inherit); font-size: clamp(1.9rem, 5vw, 2.5rem); line-height: 1.05; }
    .qstx-hero__sub { margin: .3rem 0 0; }
    .qstx-hero__reset { display: inline-flex; align-items: center; gap: .35rem; margin-top: .35rem; font-size: .82rem; }

    .qstx-callout {
      display: flex; align-items: center; gap: .7rem; margin-bottom: 1.6rem;
      padding: .85rem 1.05rem; border-radius: var(--r-md, 14px);
      background: linear-gradient(180deg, var(--gold-bg), var(--paper));
      border: 1px solid var(--gold);
    }
    .qstx-callout__ico { width: 38px; height: 38px; border-radius: 12px; background: var(--gold-bg); color: var(--gold); flex: none; }

    .qstx-section { margin-bottom: 2rem; }
    .qstx-section__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
    .qstx-eyebrow { font-size: .74rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--accent-600); }
    .qstx-section__title { margin: 0; font-family: var(--font-display, inherit); font-size: 1.5rem; line-height: 1.1; }
    .qstx-note { display: inline-flex; align-items: center; gap: .35rem; flex: none; font-size: .82rem; color: var(--n-500, var(--n-400)); white-space: nowrap; }

    .qstx-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }

    .qstx-card {
      position: relative; display: flex; flex-direction: column; gap: .9rem;
      padding: 1.15rem; border-radius: var(--r-md, 14px);
      background: var(--paper); border: 1px solid var(--line);
      transition: transform .18s var(--ease, ease), box-shadow .18s var(--ease, ease), border-color .18s var(--ease, ease);
    }
    .qstx-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--line-strong); }
    .qstx-card__top { display: flex; gap: .85rem; align-items: flex-start; }
    .qstx-card__body { min-width: 0; flex: 1; }
    .qstx-card__head { display: flex; align-items: center; gap: .5rem; }
    .qstx-card__title { margin: 0; font-size: 1.06rem; line-height: 1.25; flex: 1; min-width: 0; }
    .qstx-card__desc { margin: .3rem 0 .9rem; font-size: .9rem; line-height: 1.4; color: var(--n-500, var(--n-400)); }

    .qstx-chip {
      display: grid; place-items: center; width: 44px; height: 44px; flex: none;
      border-radius: 13px; background: var(--accent-50); color: var(--accent-600);
    }

    .qstx-bar { height: 8px; border-radius: var(--r-pill, 999px); background: var(--n-100); overflow: hidden; }
    .qstx-bar > i {
      display: block; height: 100%; border-radius: inherit;
      background: linear-gradient(90deg, var(--accent-300), var(--accent-600));
      transition: width .6s var(--ease, ease);
    }
    .qstx-meta { display: flex; align-items: center; justify-content: space-between; gap: .6rem; margin-top: .6rem; flex-wrap: wrap; }
    .qstx-count { font-weight: 700; font-variant-numeric: tabular-nums; font-size: .95rem; }
    .qstx-count .muted { font-weight: 550; }

    .qstx-rewards { display: flex; gap: .4rem; flex-wrap: wrap; }
    .qstx-reward {
      display: inline-flex; align-items: center; padding: .2rem .55rem;
      border-radius: var(--r-pill, 999px); font-size: .76rem; font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .qstx-reward--xp { background: var(--sky-bg); color: var(--sky); }
    .qstx-reward--spark { background: var(--gold-bg); color: var(--gold); }

    .qstx-hint { display: inline-flex; align-items: center; gap: .35rem; }

    .qstx-claim { width: 100%; justify-content: center; gap: .45rem; }

    /* Ready to claim: the card glows and lifts to pull the eye. */
    .qstx-card--ready {
      border-color: var(--accent-300);
      background: linear-gradient(180deg, var(--accent-50), var(--paper));
      box-shadow: 0 0 0 1px var(--accent-300), 0 12px 30px -14px rgba(217, 107, 67, .5);
      animation: qstxGlow 2.6s ease-in-out infinite;
    }
    @keyframes qstxGlow {
      0%, 100% { box-shadow: 0 0 0 1px var(--accent-300), 0 12px 30px -16px rgba(217, 107, 67, .45); }
      50% { box-shadow: 0 0 0 1px var(--accent-600), 0 16px 40px -14px rgba(217, 107, 67, .65); }
    }

    /* Claimed: calm, quiet, settled. */
    .qstx-card--claimed { opacity: .82; }
    .qstx-card--claimed .qstx-chip { background: var(--sage-bg); color: var(--sage); }
    .qstx-card--claimed .qstx-bar > i { background: var(--sage); }
    .qstx-done {
      display: inline-flex; align-items: center; gap: .25rem; flex: none;
      padding: .18rem .5rem; border-radius: var(--r-pill, 999px);
      background: var(--sage-bg); color: var(--sage); font-size: .74rem; font-weight: 700;
    }

    .qstx-empty {
      text-align: center; padding: 2.2rem 1.4rem; border-radius: var(--r-md, 14px);
      border: 1px dashed var(--line-strong); background: var(--paper);
    }
    .qstx-empty__ico { width: 52px; height: 52px; border-radius: 16px; background: var(--accent-50); color: var(--accent-600); margin: 0 auto .8rem; }
    .qstx-empty__title { margin: 0 0 .3rem; font-size: 1.05rem; }

    .qstx-footer { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-top: 2.2rem; }
    .qstx-flink {
      display: flex; align-items: center; gap: .85rem; text-decoration: none; color: inherit;
      padding: 1.05rem 1.15rem; border-radius: var(--r-md, 14px);
      background: var(--paper); border: 1px solid var(--line);
      transition: transform .18s var(--ease, ease), box-shadow .18s var(--ease, ease), border-color .18s var(--ease, ease);
    }
    .qstx-flink:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--accent-300); }
    .qstx-flink__ico { display: grid; place-items: center; width: 42px; height: 42px; border-radius: 13px; flex: none; }
    .qstx-flink__ico--spark { background: var(--gold-bg); color: var(--gold); }
    .qstx-flink__ico--ach { background: var(--sky-bg); color: var(--sky); }
    .qstx-flink__label { font-weight: 700; }
    .qstx-flink__sub { font-size: .84rem; color: var(--n-500, var(--n-400)); }
    .qstx-flink__arrow { margin-left: auto; color: var(--n-400); flex: none; }

    @media (prefers-reduced-motion: reduce) {
      .qstx-card, .qstx-flink { transition: none; }
      .qstx-card:hover, .qstx-flink:hover { transform: none; }
      .qstx-card--ready { animation: none; }
      .qstx-bar > i { transition: none; }
    }
  `;

  return (
    <div className="qstx">
      <style>{css}</style>

      <header className="qstx-hero">
        <span className="aria-orb qstx-hero__orb" aria-hidden />
        <div style={{ minWidth: 0 }}>
          <h1 className="qstx-hero__title">Quests</h1>
          <p className="qstx-hero__sub muted">{subline}</p>
        </div>
      </header>

      {claimable > 0 && (
        <div className="qstx-callout">
          <span className="row center qstx-callout__ico" aria-hidden>
            <Icon name="sparkles" size={20} />
          </span>
          <div style={{ minWidth: 0 }}>
            <span className="fw-7">
              {claimable === 1 ? '1 reward is ready to claim' : `${claimable} rewards are ready to claim`}
            </span>
            <div className="muted t-sm">Tap a glowing card below to collect your XP and sparks.</div>
          </div>
        </div>
      )}

      <QuestSection
        eyebrow="Today"
        title="Today"
        note={dailyResetLabel(now)}
        list={daily}
        onClaim={onClaim}
        emptyBody="Check in, keep a promise, or open an engine and today's quests will appear here."
      />

      <QuestSection
        eyebrow="This week"
        title="This week"
        note={weeklyResetLabel(now)}
        list={weekly}
        onClaim={onClaim}
        emptyBody="Bigger goals for the week ahead land here every Monday."
      />

      <div className="qstx-footer">
        <Link to="/rewards" className="qstx-flink" onClick={() => sTap()}>
          <span className="qstx-flink__ico qstx-flink__ico--spark" aria-hidden><Icon name="sparkles" size={20} /></span>
          <span className="col" style={{ gap: '.15rem', minWidth: 0 }}>
            <span className="qstx-flink__label">Spend your sparks</span>
            <span className="qstx-flink__sub clip">Unlock themes, voices, and streak freezes</span>
          </span>
          <span className="qstx-flink__arrow" aria-hidden><Icon name="chevronRight" size={18} /></span>
        </Link>

        <Link to="/achievements" className="qstx-flink" onClick={() => sTap()}>
          <span className="qstx-flink__ico qstx-flink__ico--ach" aria-hidden><Icon name="trophy" size={20} /></span>
          <span className="col" style={{ gap: '.15rem', minWidth: 0 }}>
            <span className="qstx-flink__label">See achievements</span>
            <span className="qstx-flink__sub clip">The badges you have earned so far</span>
          </span>
          <span className="qstx-flink__arrow" aria-hidden><Icon name="chevronRight" size={18} /></span>
        </Link>
      </div>
    </div>
  );
}
