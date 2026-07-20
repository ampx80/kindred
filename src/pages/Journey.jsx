// Journey - the "look how far you have come" identity page. Not a dashboard: a
// mirror. It opens on who you are becoming (rank + level + a living XP ring),
// centers the Growth Garden that grows with you, then showcases live streaks,
// counts up your lifetime tallies, lays out the rank ladder so you can see what
// is next, and points to the places you keep earning. Every number counts up on
// mount, every flame flickers, and all of it goes calm under reduced motion.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { track } from '../lib/track.js';
import { useGame } from '../lib/game.js';
import { rankFor, RANKS } from '../lib/gameContent.js';
import GrowthGarden from '../components/GrowthGarden.jsx';
import * as store from '../lib/store.js';

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* A number that eases up from 0 on mount. Reduced motion shows the final value. */
function CountUp({ value = 0, duration = 1300 }) {
  const target = Number(value) || 0;
  const [n, setN] = useState(() => (prefersReduced() ? target : 0));
  const raf = useRef(0);
  useEffect(() => {
    if (prefersReduced()) { setN(target); return; }
    if (target === 0) { setN(0); return; }
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(target * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else setN(target);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(n).toLocaleString()}</span>;
}

/* A warm XP ring that fills from empty to pct on mount. */
function XpRing({ pct = 0, size = 176, stroke = 13 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [fill, setFill] = useState(() => (prefersReduced() ? pct : 0));
  useEffect(() => {
    if (prefersReduced()) { setFill(pct); return; }
    const id = requestAnimationFrame(() => setFill(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const offset = circ * (1 - Math.max(0, Math.min(1, fill)));
  return (
    <svg className="jny-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <defs>
        <linearGradient id="jnyRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e0794e" />
          <stop offset="55%" stopColor="#d95d78" />
          <stop offset="100%" stopColor="#dd9a2e" />
        </linearGradient>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--n-100)" strokeWidth={stroke} />
      <circle
        className="jny-ring__fill"
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke="url(#jnyRingGrad)" strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </svg>
  );
}

/* An SVG flame that flickers when lit, ember-cold when the streak is 0. */
function Flame({ lit = false, size = 46 }) {
  return (
    <span className={`jny-flame ${lit ? 'is-lit' : 'is-cold'}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 24 24" width={size} height={size}>
        <defs>
          <linearGradient id="jnyFlameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#c2543a" />
            <stop offset="55%" stopColor="#e0794e" />
            <stop offset="100%" stopColor="#f2c94c" />
          </linearGradient>
        </defs>
        <path className="jny-flame__outer"
          d="M12 2c1 3.2-1.6 4.4-1.6 7 0 1.2.7 2 .7 2s-1.9-.5-2.6-2.4C7 11.4 5 13 5 16a7 7 0 0 0 14 0c0-3.6-2.4-6.2-4-8-1.3-1.5-3-3.4-3-6z"
          fill="url(#jnyFlameGrad)" />
        <path className="jny-flame__inner"
          d="M12 12.2c.7 1.4-.5 2.3-.5 3.6 0 1 .8 1.8 1.7 1.8 1 0 1.8-.9 1.8-2.1 0-1.5-1.2-2.4-1.9-3.3-.5-.7-1-1.5-1.1-2.6-.6.9-1 1.7-.9 2.7z"
          fill="#fbe7c9" />
      </svg>
    </span>
  );
}

export default function Journey() {
  const g = useGame();
  const counts = g.counts || {};

  const ritual = store.ritualStreak?.() ?? 0;
  const checkin = store.checkinStreak?.() ?? 0;
  const reflection = store.reflectionStreak?.() ?? 0;

  useEffect(() => { track('journey_view'); }, []);

  // The rank ladder is grouped in threes; the next distinct rank starts at the
  // top of the next group. Compute the current group index and where the next
  // rank begins so we can whisper "what is next" in the hero.
  const curIdx = RANKS.indexOf(g.rank);
  const isMaxRank = curIdx >= RANKS.length - 1;
  const nextRank = isMaxRank ? null : RANKS[curIdx + 1];
  const nextRankLevel = (curIdx + 1) * 3 + 1;

  const pctWhole = Math.round((g.pct || 0) * 100);

  const tallies = [
    { key: 'day_closed', label: 'Days closed', sub: 'start to finish', icon: 'sun', value: counts.day_closed || 0 },
    { key: 'goal_done', label: 'Promises kept', sub: 'goals marked done', icon: 'check', value: counts.goal_done || 0 },
    { key: 'reflection_saved', label: 'Reflections', sub: 'evenings looked back', icon: 'moon', value: counts.reflection_saved || 0 },
    { key: 'journal_saved', label: 'Journal entries', sub: 'honest lines written', icon: 'book', value: counts.journal_saved || 0 },
    { key: 'person_touch', label: 'People tended', sub: 'relationships reached', icon: 'heart', value: counts.person_touch || 0 },
    { key: 'feature_generated', label: 'Engine sessions', sub: 'times you went deeper', icon: 'layers', value: counts.feature_generated || 0 },
  ];

  const streaks = [
    { key: 'ritual', label: 'Full days in a row', hint: 'check in plus reflect', value: ritual },
    { key: 'checkin', label: 'Mornings in a row', hint: 'daily check-in', value: checkin },
    { key: 'reflection', label: 'Reflections in a row', hint: 'evening look back', value: reflection },
  ];
  const noStreaks = ritual === 0 && checkin === 0 && reflection === 0;

  const quickLinks = [
    { to: '/quests', icon: 'target', title: 'Quests', sub: 'Today and this week' },
    { to: '/achievements', icon: 'trophy', title: 'Achievements', sub: 'Everything you have earned' },
    { to: '/rewards', icon: 'sparkles', title: 'Rewards', sub: `${g.sparks || 0} sparks to spend` },
  ];

  const css = `
    .jnyx { max-width: 1000px; margin: 0 auto; padding-bottom: 120px; }
    .jnyx .jny-rise { opacity: 0; animation: jnyRise .6s var(--ease) forwards; }
    @keyframes jnyRise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }

    /* ---- Hero ---- */
    .jnyx .jny-hero {
      position: relative; overflow: hidden; border-radius: var(--r-xl);
      border: 1px solid var(--accent-300);
      background:
        radial-gradient(130% 130% at 8% 0%, var(--accent-50), transparent 58%),
        radial-gradient(120% 120% at 100% 10%, var(--gold-bg), transparent 60%),
        linear-gradient(180deg, var(--paper), var(--paper));
      padding: 2.4rem 2.2rem;
      display: grid; grid-template-columns: 1fr auto; gap: 2rem; align-items: center;
    }
    .jnyx .jny-hero__glow {
      position: absolute; inset: -30% -10% auto auto; width: 360px; height: 360px; pointer-events: none;
      background: radial-gradient(circle, rgba(224,121,78,.18), transparent 68%);
      animation: jnyDrift 10s ease-in-out infinite alternate;
    }
    @keyframes jnyDrift { from { transform: translate(0,0); } to { transform: translate(-26px, 20px); } }
    .jnyx .jny-hero__lead { display: flex; align-items: center; gap: .7rem; margin-bottom: 1rem; }
    .jnyx .jny-hero__orb { width: 30px; height: 30px; }
    .jnyx .jny-becoming { font-family: var(--font-display); font-weight: 600; line-height: 1.08;
      font-size: clamp(2.1rem, 5vw, 3.1rem); letter-spacing: -.02em; margin: 0 0 1.1rem; color: var(--ink); }
    .jnyx .jny-rank {
      font-family: var(--font-display); font-weight: 700; line-height: 1;
      font-size: clamp(2.6rem, 6vw, 3.8rem); letter-spacing: -.02em;
      background: linear-gradient(115deg, #d95d78, #e0794e 55%, #dd9a2e);
      -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    }
    .jnyx .jny-lvlpill {
      display: inline-flex; align-items: center; gap: .4rem; margin-left: .1rem;
      padding: .3rem .8rem; border-radius: var(--r-pill);
      background: var(--accent-50); color: var(--accent-700); font-weight: 700; font-size: .95rem;
      border: 1px solid var(--accent-300);
    }
    .jnyx .jny-next { margin: 1rem 0 0; }

    /* ---- XP ring ---- */
    .jnyx .jny-ringwrap { position: relative; display: grid; place-items: center; flex: none; }
    .jnyx .jny-ring__fill { transition: stroke-dashoffset 1.3s var(--ease); }
    .jnyx .jny-ringcenter {
      position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center;
    }
    .jnyx .jny-ringpct { font-family: var(--font-display); font-weight: 700; font-size: 2rem; line-height: 1; color: var(--ink); font-variant-numeric: tabular-nums; }
    .jnyx .jny-ringlbl { font-size: .72rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--n-600); margin-top: .3rem; }

    /* ---- Section heads ---- */
    .jnyx .jny-eyebrow { font-size: .76rem; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--accent-600); }
    .jnyx .jny-h { font-family: var(--font-display); font-weight: 600; font-size: clamp(1.4rem, 2.6vw, 1.9rem); letter-spacing: -.015em; margin: .25rem 0 0; }

    /* ---- Garden panel ---- */
    .jnyx .jny-garden {
      position: relative; overflow: hidden; border-radius: var(--r-xl);
      border: 1px solid var(--sage); padding: 2rem;
      background:
        radial-gradient(120% 120% at 50% 0%, var(--sage-bg), transparent 62%),
        linear-gradient(180deg, var(--paper), var(--paper));
      text-align: center;
    }
    .jnyx .jny-garden__stage { min-height: 60px; display: grid; place-items: center; margin: .4rem 0 1rem; }
    .jnyx .jny-garden__cap { font-family: var(--font-display); font-size: 1.2rem; line-height: 1.5; color: var(--ink-2); margin: 0; font-style: italic; }

    /* ---- Streaks ---- */
    .jnyx .jny-flames { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .jnyx .jny-flamecard {
      display: flex; flex-direction: column; align-items: center; gap: .5rem; text-align: center;
      padding: 1.5rem 1rem; border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--paper);
    }
    .jnyx .jny-flamecard.is-lit { border-color: var(--accent-300); background: linear-gradient(180deg, var(--accent-50), var(--paper)); }
    .jnyx .jny-flame { position: relative; display: inline-grid; place-items: center; line-height: 0;
      filter: drop-shadow(0 4px 10px rgba(217,107,67,.28)); }
    .jnyx .jny-flame.is-cold { filter: grayscale(1) opacity(.4); }
    .jnyx .jny-flame__outer { transform-box: fill-box; transform-origin: 50% 90%; }
    .jnyx .jny-flame__inner { transform-box: fill-box; transform-origin: 50% 90%; }
    .jnyx .jny-flame.is-lit .jny-flame__outer { animation: jnyFlick 1.7s ease-in-out infinite; }
    .jnyx .jny-flame.is-lit .jny-flame__inner { animation: jnyFlick 1.1s ease-in-out infinite alternate; }
    @keyframes jnyFlick {
      0%,100% { transform: scaleY(1) scaleX(1) rotate(0); }
      30% { transform: scaleY(1.09) scaleX(.95) rotate(-2deg); }
      60% { transform: scaleY(.95) scaleX(1.04) rotate(2deg); }
    }
    .jnyx .jny-flamecount { font-family: var(--font-display); font-weight: 700; font-size: 2.4rem; line-height: 1; color: var(--ink); font-variant-numeric: tabular-nums; }
    .jnyx .jny-flamelabel { font-weight: 650; font-size: .95rem; }

    /* ---- Tallies ---- */
    .jnyx .jny-tallies { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .jnyx .jny-tally {
      display: flex; flex-direction: column; gap: .3rem; padding: 1.3rem 1.4rem;
      border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--paper);
      transition: transform .2s var(--ease), box-shadow .2s var(--ease), border-color .2s var(--ease);
    }
    .jnyx .jny-tally:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--accent-300); }
    .jnyx .jny-tally__ic { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center;
      background: var(--accent-50); color: var(--accent-700); margin-bottom: .3rem; }
    .jnyx .jny-tally__n { font-family: var(--font-display); font-weight: 700; font-size: 2.6rem; line-height: 1; letter-spacing: -.02em; color: var(--ink); }
    .jnyx .jny-tally__lbl { font-weight: 650; }
    .jnyx .jny-tally__sub { font-size: .82rem; }

    /* ---- Rank ladder ---- */
    .jnyx .jny-ladder { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: .7rem; }
    .jnyx .jny-rung {
      position: relative; display: flex; flex-direction: column; gap: .15rem;
      padding: .85rem 1rem; border-radius: var(--r-md); border: 1px solid var(--line); background: var(--paper);
    }
    .jnyx .jny-rung--done { background: var(--sage-bg); border-color: var(--sage); }
    .jnyx .jny-rung--now {
      background: linear-gradient(180deg, var(--accent-50), var(--paper));
      border-color: var(--accent); box-shadow: var(--accent-glow);
    }
    .jnyx .jny-rung--locked { border-style: dashed; opacity: .7; }
    .jnyx .jny-rung__name { font-family: var(--font-display); font-weight: 700; font-size: 1.1rem; letter-spacing: -.01em; }
    .jnyx .jny-rung--now .jny-rung__name { color: var(--accent-700); }
    .jnyx .jny-rung__lvl { font-size: .78rem; font-weight: 650; color: var(--n-600); }
    .jnyx .jny-rung__tag {
      align-self: flex-start; margin-top: .3rem; font-size: .68rem; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
      padding: .18rem .5rem; border-radius: var(--r-pill);
    }
    .jnyx .jny-rung--now .jny-rung__tag { background: var(--accent); color: #fff; }
    .jnyx .jny-rung--done .jny-rung__tag { background: var(--sage); color: #fff; }

    /* ---- Quick links ---- */
    .jnyx .jny-links { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; }
    .jnyx .jny-link {
      display: flex; align-items: center; gap: .9rem; padding: 1.2rem 1.3rem;
      border-radius: var(--r-lg); border: 1px solid var(--line); background: var(--paper); color: inherit;
      transition: transform .18s var(--ease), box-shadow .18s var(--ease), border-color .18s var(--ease);
    }
    .jnyx .jny-link:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--accent-300); }
    .jnyx .jny-link__ic { width: 44px; height: 44px; border-radius: 13px; display: grid; place-items: center;
      background: var(--accent-50); color: var(--accent-700); flex: none; }
    .jnyx .jny-link__t { font-weight: 700; }
    .jnyx .jny-link__s { font-size: .84rem; }
    .jnyx .jny-link__go { margin-left: auto; color: var(--n-400); flex: none; }

    @media (max-width: 760px) {
      .jnyx .jny-hero { grid-template-columns: 1fr; text-align: left; }
      .jnyx .jny-ringwrap { justify-self: center; }
      .jnyx .jny-flames, .jnyx .jny-tallies, .jnyx .jny-links { grid-template-columns: 1fr; }
    }

    @media (prefers-reduced-motion: reduce) {
      .jnyx .jny-rise { opacity: 1; animation: none; transform: none; }
      .jnyx .jny-hero__glow { animation: none; }
      .jnyx .jny-ring__fill { transition: none; }
      .jnyx .jny-flame.is-lit .jny-flame__outer,
      .jnyx .jny-flame.is-lit .jny-flame__inner { animation: none; }
      .jnyx .jny-tally:hover, .jnyx .jny-link:hover { transform: none; }
    }
  `;

  return (
    <div className="col gap-3 jnyx page-in">
      <style>{`${css}`}</style>

      {/* 1) Hero - who you are becoming */}
      <section className="jny-hero jny-rise">
        <div className="jny-hero__glow" aria-hidden />
        <div>
          <div className="jny-hero__lead">
            <span className="aria-orb jny-hero__orb" aria-hidden />
            <span className="jny-eyebrow">Your journey</span>
          </div>
          <h1 className="jny-becoming">You are becoming</h1>
          <div className="row wrap gap-2" style={{ alignItems: 'baseline' }}>
            <span className="jny-rank">{g.rank}</span>
            <span className="jny-lvlpill"><Icon name="sparkles" size={14} /> Level {g.level}</span>
          </div>
          <p className="jny-next muted">
            {isMaxRank
              ? `You have reached ${g.rank}, the top of the ladder. Now it is all depth.`
              : <>{g.toNext} XP to level {g.level + 1}. Next rank: <span className="fw-7" style={{ color: 'var(--accent-700)' }}>{nextRank}</span> at level {nextRankLevel}.</>}
          </p>
        </div>

        <div className="jny-ringwrap">
          <XpRing pct={g.pct || 0} />
          <div className="jny-ringcenter">
            <span className="jny-ringpct">{pctWhole}%</span>
            <span className="jny-ringlbl">to level {g.level + 1}</span>
          </div>
        </div>
      </section>

      {/* 2) The Growth Garden centerpiece */}
      <section className="jny-garden jny-rise" style={{ animationDelay: '.06s' }}>
        <span className="jny-eyebrow">Your garden</span>
        <div className="jny-garden__stage">
          <GrowthGarden />
        </div>
        <p className="jny-garden__cap">Your garden grows every time you show up.</p>
      </section>

      {/* 3) Streak showcase */}
      <section className="col gap-2 jny-rise" style={{ animationDelay: '.1s' }}>
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div>
            <span className="jny-eyebrow">Streaks alive right now</span>
            <h2 className="jny-h">Keep the fire lit</h2>
          </div>
          <span className="badge badge-accent"><Icon name="flame" size={13} /> don't break it</span>
        </div>
        <div className="jny-flames">
          {streaks.map(s => {
            const lit = s.value > 0;
            return (
              <div key={s.key} className={`jny-flamecard ${lit ? 'is-lit' : ''}`}>
                <Flame lit={lit} />
                <span className="jny-flamecount">{s.value}</span>
                <span className="jny-flamelabel">{s.label}</span>
                <span className="muted t-xs">{s.hint}</span>
              </div>
            );
          })}
        </div>
        {noStreaks && (
          <p className="muted t-sm" style={{ margin: 0 }}>
            No live streaks yet. Check in this morning and reflect tonight to light the first flame.
          </p>
        )}
      </section>

      {/* 4) Lifetime tallies */}
      <section className="col gap-2 jny-rise" style={{ animationDelay: '.14s' }}>
        <div>
          <span className="jny-eyebrow">Everything you have done</span>
          <h2 className="jny-h">The lifetime count</h2>
        </div>
        <div className="jny-tallies">
          {tallies.map(t => (
            <div key={t.key} className="jny-tally">
              <span className="jny-tally__ic"><Icon name={t.icon} size={20} /></span>
              <span className="jny-tally__n"><CountUp value={t.value} /></span>
              <span className="jny-tally__lbl">{t.label}</span>
              <span className="jny-tally__sub muted">{t.sub}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 5) The rank ladder */}
      <section className="col gap-2 jny-rise" style={{ animationDelay: '.18s' }}>
        <div>
          <span className="jny-eyebrow">The climb</span>
          <h2 className="jny-h">Where you are, and what is next</h2>
        </div>
        <div className="jny-ladder">
          {RANKS.map((name, i) => {
            const startLvl = i * 3 + 1;
            const endLvl = i === RANKS.length - 1 ? null : (i + 1) * 3;
            const cls = i < curIdx ? 'jny-rung--done' : i === curIdx ? 'jny-rung--now' : 'jny-rung--locked';
            return (
              <div key={name} className={`jny-rung ${cls}`}>
                <span className="jny-rung__name">{name}</span>
                <span className="jny-rung__lvl">
                  {endLvl ? `Levels ${startLvl}-${endLvl}` : `Level ${startLvl}+`}
                </span>
                {i === curIdx && <span className="jny-rung__tag">You are here</span>}
                {i < curIdx && <span className="jny-rung__tag">Reached</span>}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6) Quick links */}
      <section className="col gap-2 jny-rise" style={{ animationDelay: '.22s' }}>
        <div>
          <span className="jny-eyebrow">Keep earning</span>
          <h2 className="jny-h">Where the sparks come from</h2>
        </div>
        <div className="jny-links">
          {quickLinks.map(l => (
            <Link key={l.to} to={l.to} className="jny-link" onClick={() => track('journey_link', { to: l.to })}>
              <span className="jny-link__ic"><Icon name={l.icon} size={22} /></span>
              <span className="col" style={{ minWidth: 0 }}>
                <span className="jny-link__t">{l.title}</span>
                <span className="jny-link__s muted clip">{l.sub}</span>
              </span>
              <span className="jny-link__go"><Icon name="chevronRight" size={20} /></span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
