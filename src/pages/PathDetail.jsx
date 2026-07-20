// One path (domain) up close: a personal training dashboard for each promise on
// it - big flame, a satisfying mark-done, a warm streak heatmap, momentum copy,
// pause and finish controls. Reads its id (the domain id) from useParams ONLY.
import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Badge, Button, useToast, EmptyState, daysAgo } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { celebrate, burstFrom } from '../lib/celebrate.js';
import { StreakFlame, MilestoneBurst } from '../components/Delight.jsx';
import { sTap, sSuccess, sCelebrate } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { track } from '../lib/track.js';
import { useStore, domainMeta, goalsForDomain, markGoalDone, setGoalStatus, isGoalDueToday } from '../lib/store.js';

const MILES = [3, 7, 14, 30, 60, 100];
const isoDay = (d) => new Date(d).toISOString().slice(0, 10);

// Honest approximation of a completion log. The store keeps only lastDoneAt +
// streak (not a full history), so we reconstruct the current run: the `streak`
// most-recent periods ending at lastDoneAt were kept. Warm, not fabricated.
function deriveDoneDays(g) {
  const set = new Set();
  if (!g.lastDoneAt || !g.streak) return set;
  const step = g.cadence === 'weekly' ? 7 : 1;
  const last = new Date(g.lastDoneAt);
  for (let i = 0; i < g.streak; i++) {
    const d = new Date(last);
    d.setDate(d.getDate() - i * step);
    set.add(isoDay(d));
  }
  return set;
}

// A GitHub-style grid: 10 columns (weeks) x 7 rows (Sun..Sat), ending this week.
function buildGrid(weeks = 10) {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay()); // back to Sunday
  const grid = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const col = [];
    for (let dow = 0; dow < 7; dow++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() - w * 7 + dow);
      col.push(d);
    }
    grid.push(col);
  }
  return grid;
}

function momentumLine(g) {
  const next = MILES.find(m => m > g.streak);
  if (!g.streak) return 'One rep today lights the flame.';
  const best = g.best || 0;
  if (g.streak >= best && g.streak > 1) {
    if (next) return `Best ever. ${next - g.streak} more to ${next} in a row.`;
    return 'Best ever, and still climbing. Remarkable.';
  }
  if (next) {
    const d = next - g.streak;
    return d === 1 ? `One more keeps it going - that is ${next} in a row.` : `${d} more to ${next} in a row.`;
  }
  return 'Past every milestone. Legendary consistency.';
}

export default function PathDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const profile = useStore(s => s.profile);
  useStore(s => s.goals);
  const toast = useToast();

  const domain = (profile?.domains || []).find(d => d.id === id) || { id, name: id, why: '' };
  const m = domainMeta(id);
  const goals = goalsForDomain(id);
  const active = goals.filter(g => g.status === 'active');
  const rest = goals.filter(g => g.status !== 'active');

  // One burst controller shared across goals; MilestoneBurst re-fires whenever
  // `show` changes to a fresh truthy value.
  const [burst, setBurst] = useState(null);

  useEffect(() => { track('goal_detail_view', { domainId: id }); }, [id]);

  const tap = () => { haptic('light'); sTap(); };

  const done = (g, ev) => {
    const prevBest = g.best || 0;
    const r = markGoalDone(g.id);
    if (r.error) { haptic('warn'); return toast(r.message, 'warn'); }
    const streak = r.goal.streak;
    const isNewBest = streak > prevBest && streak > 1;
    if (r.milestone || isNewBest) {
      haptic('celebrate'); sCelebrate();
      setBurst({ show: r.milestone || streak, label: r.milestone ? 'in a row' : 'new best', sub: g.title });
      toast(r.milestone ? `${r.milestone} in a row. Milestone kept.` : `New best - ${streak} in a row.`);
    } else {
      haptic('success'); sSuccess(); burstFrom(ev, { count: 62, spread: 0.95 });
      toast(r.graceApplied ? 'Counted. Grace held your streak.' : 'Counted. Nice rep.');
    }
  };

  const pause = (g) => { tap(); setGoalStatus(g.id, 'paused'); toast('Paused. It will wait for you.'); };
  const finish = (g) => { tap(); setGoalStatus(g.id, 'done'); haptic('celebrate'); celebrate({ count: 120 }); toast('Finished. That one is yours forever.'); };
  const resume = (g) => { tap(); setGoalStatus(g.id, 'active'); toast('Back on the board.'); };

  return (
    <div className="pd-wrap col gap-3">
      <PdStyle accent={m.color} />

      <button className="link row gap-1 pd-back" style={{ background: 'none', border: 'none', alignSelf: 'flex-start' }}
        onClick={() => { tap(); nav(-1); }}>
        <Icon name="chevronLeft" size={16} /> Back
      </button>

      <Card className="card-pad pd-hero pd-rise" style={{ '--pd-a': m.color, borderTop: `3px solid ${m.color}` }}>
        <div className="row gap-2" style={{ alignItems: 'center' }}>
          <span className="row center pd-hero-emoji" style={{ background: m.bg }}>{m.emoji}</span>
          <div className="col" style={{ gap: '.2rem', minWidth: 0 }}>
            <span className="t-xs fw-6 pd-eyebrow" style={{ color: m.color }}>Your path</span>
            <h1 className="serif" style={{ fontSize: 'clamp(1.55rem, 3vw, 2.15rem)', lineHeight: 1.1 }}>{domain.name}</h1>
          </div>
        </div>
        {domain.why && (
          <p className="pd-why" style={{ borderLeft: `3px solid ${m.color}` }}>
            <span className="muted t-xs fw-6" style={{ display: 'block', letterSpacing: '.04em', textTransform: 'uppercase' }}>Why this matters</span>
            {domain.why}
          </p>
        )}
      </Card>

      {active.length === 0 && rest.length === 0 ? (
        <EmptyState icon="target" title="No goals on this path yet"
          body="Ask Aria for a first step, or add one from the Paths screen. Small enough to do this week."
          action={<Button as={Link} to="/paths" onClick={tap}>Back to paths</Button>} />
      ) : (
        <div className="col gap-3">
          {active.map((g, i) => (
            <GoalDashboard key={g.id} g={g} m={m} lead={i === 0} delay={i}
              onDone={done} onPause={pause} onFinish={finish} />
          ))}

          {rest.length > 0 && (
            <div className="col gap-2">
              {active.length > 0 && <span className="muted t-xs fw-6" style={{ letterSpacing: '.04em', textTransform: 'uppercase', paddingLeft: '.15rem' }}>Resting and finished</span>}
              {rest.map(g => (
                <Card key={g.id} className="card-pad row gap-2 pd-rise" style={{ alignItems: 'center', opacity: .8 }}>
                  <Badge tone={g.status === 'done' ? 'ok' : 'warn'}>{g.status === 'done' ? 'finished' : 'paused'}</Badge>
                  <span className="fw-6 clip" style={{ flex: 1 }}>{g.title}</span>
                  {g.status === 'paused' && <Button size="sm" variant="ghost" onClick={() => resume(g)}>Resume</Button>}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <MilestoneBurst show={burst?.show || 0} label={burst?.label || 'in a row'} sublabel={burst?.sub} onDone={() => setBurst(null)} />
    </div>
  );
}

/* One goal, rendered as its own training dashboard. */
function GoalDashboard({ g, m, lead, delay = 0, onDone, onPause, onFinish }) {
  const doneDays = useMemo(() => deriveDoneDays(g), [g.lastDoneAt, g.streak, g.cadence]);
  const grid = useMemo(() => buildGrid(10), []);
  const todayIso = isoDay(new Date());
  const due = isGoalDueToday(g);
  const best = g.best || g.streak || 0;

  return (
    <Card className={`card-pad col gap-2 pd-goal pd-rise${lead ? ' pd-goal--lead' : ''}`}
      style={{ '--pd-a': m.color, animationDelay: `${0.06 + delay * 0.06}s` }}>

      {/* header: flame + title + why */}
      <div className="row gap-2" style={{ alignItems: 'center' }}>
        <div className="pd-flamewrap" style={{ background: m.bg }}>
          <StreakFlame count={g.streak} size={lead ? 46 : 38} showCount={false} />
          <b className="pd-flamewrap-n tnum" style={{ color: m.color }}>{g.streak}</b>
        </div>
        <div className="col" style={{ gap: '.15rem', minWidth: 0, flex: 1 }}>
          <span className="fw-7" style={{ fontSize: lead ? '1.22rem' : '1.06rem', lineHeight: 1.15 }}>{g.title}</span>
          {g.why && <span className="muted t-sm">{g.why}</span>}
        </div>
      </div>

      {/* stat strip */}
      <div className="pd-stats">
        <div className="pd-stat"><b className="tnum" style={{ color: m.color }}>{g.streak}</b><span className="muted t-xs">streak</span></div>
        <div className="pd-stat"><b className="tnum">{best}</b><span className="muted t-xs">best</span></div>
        <div className="pd-stat"><b>{daysAgo(g.lastDoneAt) || 'never'}</b><span className="muted t-xs">last</span></div>
        <div className="pd-stat"><b style={{ textTransform: 'capitalize' }}>{g.cadence}</b><span className="muted t-xs">cadence</span></div>
      </div>

      {/* momentum copy */}
      <div className="pd-momentum" style={{ background: m.bg, color: m.color }}>
        <Icon name={g.streak >= best && g.streak > 1 ? 'sparkles' : 'flame'} size={15} />
        <span className="fw-6">{momentumLine(g)}</span>
      </div>

      {/* streak heatmap */}
      <div className="col gap-1">
        <span className="muted t-xs fw-6" style={{ letterSpacing: '.03em', textTransform: 'uppercase' }}>Last 10 weeks</span>
        <div className="pd-heat" role="img" aria-label={`Recent activity: ${doneDays.size} completed`}>
          {grid.map((col, ci) => (
            <div key={ci} className="pd-heatcol">
              {col.map((d, ri) => {
                const iso = isoDay(d);
                const future = iso > todayIso;
                const isDone = doneDays.has(iso);
                const isToday = iso === todayIso;
                const cls = `pd-cell${isDone ? ' is-done' : ''}${isToday ? ' is-today' : ''}${future ? ' is-future' : ''}`;
                return <span key={ri} className={cls} title={future ? '' : iso} />;
              })}
            </div>
          ))}
        </div>
        <div className="row gap-1" style={{ alignItems: 'center', justifyContent: 'flex-end' }}>
          <span className="muted t-xs">quiet</span>
          <span className="pd-cell" />
          <span className="pd-cell is-done" style={{ opacity: .55 }} />
          <span className="pd-cell is-done" />
          <span className="muted t-xs">kept</span>
        </div>
      </div>

      {/* primary action */}
      {due ? (
        <button className="btn pd-done" style={{ background: m.color }} onClick={(e) => onDone(g, e)}>
          <Icon name="check" size={19} /> Mark done for today
        </button>
      ) : (
        <div className="pd-donestate" style={{ background: m.bg, color: m.color }}>
          <StreakFlame count={g.streak} size={26} showCount={false} />
          <div className="col" style={{ gap: '.05rem', textAlign: 'left' }}>
            <b>Done today. The streak is safe.</b>
            <span className="t-xs" style={{ opacity: .85 }}>Come back tomorrow to keep it alive.</span>
          </div>
        </div>
      )}

      {/* secondary controls */}
      <div className="row gap-1 wrap" style={{ justifyContent: 'center' }}>
        <Button size="sm" variant="quiet" title="Pause this goal" onClick={() => onPause(g)}>Pause</Button>
        <Button size="sm" variant="quiet" title="Mark finished for good" onClick={() => onFinish(g)}>Finish</Button>
      </div>
    </Card>
  );
}

/* Scoped delight styles. Reduced-motion aware. */
function PdStyle() {
  return (
    <style>{`
      .pd-wrap .pd-rise { animation: pdRise .5s var(--ease, cubic-bezier(.2,.7,.2,1)) both; }
      @keyframes pdRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

      .pd-back { transition: transform .15s ease, opacity .15s ease; }
      .pd-back:active { transform: translateX(-2px); }

      .pd-hero { position: relative; overflow: hidden; }
      .pd-hero-emoji { width: 58px; height: 58px; border-radius: 16px; font-size: 1.8rem; flex: none; }
      .pd-eyebrow { letter-spacing: .06em; text-transform: uppercase; }
      .pd-why { margin: .9rem 0 0; padding: .1rem 0 .1rem .8rem; color: var(--ink); line-height: 1.5; }

      .pd-goal { position: relative; }
      .pd-goal--lead { box-shadow: var(--shadow-md, 0 8px 24px rgba(46,36,30,.08)); }

      .pd-flamewrap { position: relative; width: 66px; height: 66px; border-radius: 18px; display: grid; place-items: center; flex: none; }
      .pd-goal--lead .pd-flamewrap { width: 76px; height: 76px; }
      .pd-flamewrap-n { position: absolute; bottom: 3px; right: 6px; font-size: .8rem; font-weight: 800; }

      .pd-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: .4rem; }
      .pd-stat { display: flex; flex-direction: column; align-items: center; gap: .1rem; padding: .5rem .2rem; background: var(--n-50, #f6f2ec); border-radius: var(--r-md, 12px); }
      .pd-stat b { font-size: 1.05rem; font-weight: 750; font-variant-numeric: tabular-nums; }

      .pd-momentum { display: flex; align-items: center; gap: .5rem; padding: .6rem .8rem; border-radius: var(--r-md, 12px); font-size: .92rem; }
      .pd-momentum svg { flex: none; }

      .pd-heat { display: flex; gap: 4px; overflow-x: auto; padding-bottom: 2px; }
      .pd-heatcol { display: flex; flex-direction: column; gap: 4px; }
      .pd-cell { width: 13px; height: 13px; border-radius: 3px; background: var(--n-100, #ece5db); flex: none; transition: transform .18s var(--ease, ease); }
      .pd-cell.is-done { background: var(--pd-a, var(--accent-600)); }
      .pd-cell.is-today { outline: 2px solid var(--pd-a, var(--accent-600)); outline-offset: 1px; }
      .pd-cell.is-future { visibility: hidden; }
      .pd-heat:hover .pd-cell.is-done { transform: none; }

      .pd-done { width: 100%; justify-content: center; gap: .55rem; color: #fff; font-size: 1.05rem; font-weight: 700; padding: .95rem 1rem; border: none; border-radius: var(--r-pill, 999px); box-shadow: 0 6px 18px rgba(224,121,78,.28); transition: transform .12s ease, box-shadow .2s ease, filter .2s ease; }
      .pd-done:hover { filter: brightness(1.04); }
      .pd-done:active { transform: scale(.97); }

      .pd-donestate { display: flex; align-items: center; gap: .7rem; padding: .85rem 1rem; border-radius: var(--r-md, 12px); font-weight: 600; justify-content: center; }

      @media (prefers-reduced-motion: reduce) {
        .pd-wrap .pd-rise { animation: none; }
        .pd-back, .pd-cell, .pd-done { transition: none; }
        .pd-back:active, .pd-done:active { transform: none; }
      }
    `}</style>
  );
}
