// Paths - their life organized into the domains THEY revealed, each with its
// goals, streaks, and a way to add more. Only their domains, never a generic
// checklist. Completing a goal for the day is meant to be the best little
// micro-moment in the app: one satisfying tap, a flame that grows, confetti
// from the button, a warm milestone burst when a streak crosses 3 / 7 / 30.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Modal, Field, Input, Select, useToast, SectionHeader } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { celebrate, burstFrom } from '../lib/celebrate.js';
import { StreakFlame, MilestoneBurst } from '../components/Delight.jsx';
import { sTap, sSuccess, sCelebrate } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { track } from '../lib/track.js';
import { useStore, domainMeta, goalsForDomain, markGoalDone, addGoal, addCustomDomain, isGoalDueToday, DOMAIN_META } from '../lib/store.js';

const NEW = '__new__';
const EMOJI_PICKS = ['♟️', '📺', '🎸', '🎮', '🍳', '🪴', '🎨', '🧩', '🏃', '📷', '🎯', '🧘', '💰', '🐶', '✈️', '📖'];
const MILESTONES = [3, 7, 14, 30, 60, 100];
const COLLAPSE_AFTER = 4;

const todayKey = () => new Date().toISOString().slice(0, 10);
const isDoneToday = (g) => !!(g.lastDoneAt && g.lastDoneAt.slice(0, 10) === todayKey());
const nextMilestone = (streak) => MILESTONES.find(m => m > streak) || null;

// A tiny physical acknowledgement for any low-stakes tap.
const tap = () => { haptic('light'); sTap(); };

export default function Paths() {
  const profile = useStore(s => s.profile);
  useStore(s => s.goals);
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: '', domainId: '', why: '', cadence: 'daily', newName: '', newEmoji: '✨' });
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [justDone, setJustDone] = useState(null);        // goal id that just got its pop
  const [burst, setBurst] = useState(null);              // { n, sub } for the milestone burst

  const domains = profile?.domains || [];
  const totalActive = domains.reduce((a, d) => a + goalsForDomain(d.id).filter(g => g.status === 'active').length, 0);

  const openAdd = (domainId) => {
    tap();
    setForm(f => ({ ...f, domainId: domainId || domains[0]?.id || 'purpose' }));
    setAddOpen(true);
  };

  const toggleCollapse = (id) => {
    tap();
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // The star of the page: complete a goal for today.
  const done = (g, e) => {
    const el = e && e.currentTarget;
    const r = markGoalDone(g.id);
    if (r.error) { haptic('warn'); return toast(r.message, 'warn'); }

    track('goal_done_tap', { domainId: g.domainId });

    const streak = r.goal?.streak || 1;
    const tiedBest = r.goal && streak > 1 && streak === r.goal.best;
    const big = !!r.milestone || tiedBest;

    // The pop on the card + the confetti kiss from the exact button tapped.
    setJustDone(g.id);
    setTimeout(() => setJustDone(cur => (cur === g.id ? null : cur)), 700);
    if (el) burstFrom(el, big ? { count: 120, spread: 1.1 } : { count: 60, spread: 0.85 });

    if (big) {
      haptic('celebrate'); sCelebrate();
      setBurst({ n: r.milestone || streak, sub: `on "${g.title}"` });
      toast(r.milestone
        ? `${r.milestone} in a row on "${g.title}". Milestone kept.`
        : `New personal best - ${streak} in a row on "${g.title}".`);
    } else {
      haptic('success'); sSuccess();
      const nm = nextMilestone(streak);
      toast(nm ? `Counted. ${nm - streak} more to ${nm}.` : 'Counted. Nice one.');
    }
  };

  const creatingNew = form.domainId === NEW;

  const submit = () => {
    let domainId = form.domainId;
    if (creatingNew) {
      if (!form.newName.trim()) return toast('Name the new area first.', 'warn');
      const dr = addCustomDomain({ name: form.newName, emoji: form.newEmoji || '✨', why: form.why });
      if (dr.error) return toast(dr.message, 'warn');
      domainId = dr.domain.id;
    }
    const r = addGoal({ title: form.title, domainId, why: form.why, cadence: form.cadence });
    if (r.error) { haptic('warn'); return toast(r.message, 'warn'); }
    haptic('success'); sSuccess();
    celebrate({ count: 80 });
    toast(`New goal on the board: ${r.goal.title}`);
    setAddOpen(false);
    setForm({ title: '', domainId: '', why: '', cadence: 'daily', newName: '', newEmoji: '✨' });
  };

  return (
    <div className="col gap-3 pth">
      <SectionHeader
        eyebrow="Your paths"
        title="The life you said you wanted"
        sub="These came from your own words. Add to them, walk them daily."
        action={<Button onClick={() => openAdd()}><Icon name="plus" size={17} /> New goal</Button>}
      />

      {totalActive === 0 && (
        <Card className="pth-empty card-pad">
          <span className="pth-empty__orb row center floaty" aria-hidden>
            <Icon name="sparkles" size={28} />
          </span>
          <h3 style={{ margin: '0 0 .4rem' }}>Every goal counts here</h3>
          <p className="muted" style={{ maxWidth: 460, margin: '0 auto .6rem' }}>
            Not just the serious ones. The gym and 20 quiet minutes of prayer belong here
            next to chess, a guitar chord a day, or finally calling your family back.
            Small and yours beats big and borrowed.
          </p>
          <div className="row wrap center gap-1" style={{ margin: '0 auto 1.1rem', maxWidth: 460 }}>
            {['🏃 Move a little', '🕊️ A quiet moment', '♟️ One game of chess', '📞 Call family'].map(x => (
              <span key={x} className="pth-chip">{x}</span>
            ))}
          </div>
          <Button onClick={() => openAdd()}><Icon name="plus" size={17} /> Add your first goal</Button>
        </Card>
      )}

      <div className="col gap-3 pth-stagger">
        {domains.map((d) => {
          const m = domainMeta(d.id);
          const goals = goalsForDomain(d.id).filter(g => g.status === 'active');
          const keptToday = goals.filter(isDoneToday).length;
          const isLong = goals.length > COLLAPSE_AFTER;
          const isCollapsed = isLong && collapsed.has(d.id);
          const shown = isCollapsed ? [] : goals;
          return (
            <Card key={d.id} className="card-pad pth-domain" style={{ '--dom-color': m.color }}>
              <div className="pth-domain__head">
                <Link to={`/paths/${d.id}`} className="pth-domain__link" onClick={tap}>
                  <span className="pth-domain__emoji row center" style={{ background: m.bg }}>{m.emoji}</span>
                  <span className="col" style={{ gap: '.15rem', minWidth: 0, flex: 1 }}>
                    <span className="fw-7" style={{ fontSize: '1.14rem' }}>{d.name}</span>
                    {d.why
                      ? <span className="muted t-sm clip">{d.why}</span>
                      : <span className="muted t-sm">Tap to open this path</span>}
                  </span>
                  <Icon name="chevronRight" size={20} className="pth-domain__go" />
                </Link>
                <div className="row gap-1" style={{ alignItems: 'center', flex: 'none' }}>
                  {goals.length > 0 && (
                    <span className="pth-count" title={`${goals.length} active`}>
                      {keptToday > 0 && <b>{keptToday}/{goals.length} kept</b>}
                      {keptToday === 0 && <span>{goals.length} {goals.length === 1 ? 'goal' : 'goals'}</span>}
                    </span>
                  )}
                  {isLong && (
                    <button type="button" className="pth-collapse row center" onClick={() => toggleCollapse(d.id)}
                      aria-expanded={!isCollapsed} aria-label={isCollapsed ? 'Show goals' : 'Hide goals'}>
                      <Icon name="chevronRight" size={16} style={{ transform: isCollapsed ? 'none' : 'rotate(90deg)', transition: 'transform .2s var(--ease)' }} />
                    </button>
                  )}
                </div>
              </div>

              {goals.length === 0 && (
                <button type="button" className="pth-addhere" onClick={() => openAdd(d.id)}>
                  <Icon name="plus" size={15} /> Add a goal to {d.name}
                </button>
              )}

              {shown.length > 0 && (
                <div className="col gap-1" style={{ marginTop: '1rem' }}>
                  {shown.map((g, i) => {
                    const doneToday = isDoneToday(g);
                    const due = isGoalDueToday(g);
                    const nm = nextMilestone(g.streak);
                    const prevM = [...MILESTONES].reverse().find(x => x <= g.streak) || 0;
                    const span = nm ? nm - prevM : 1;
                    const pct = nm ? Math.max(6, Math.round(((g.streak - prevM) / span) * 100)) : 100;
                    const popping = justDone === g.id;
                    return (
                      <div key={g.id}
                        className={`pth-goal${doneToday ? ' is-done' : ''}${popping ? ' is-pop' : ''}`}
                        style={{ '--i': i }}>
                        <StreakFlame count={g.streak} size={30} showCount={false} className="pth-goal__flame" />
                        <div className="col" style={{ gap: '.3rem', minWidth: 0, flex: 1 }}>
                          <span className="fw-6 clip">{g.title}</span>
                          <div className="pth-goal__meta">
                            {g.streak > 0
                              ? <span className="pth-streak"><Icon name="flame" size={12} /> {g.streak} in a row</span>
                              : <span className="muted t-xs">Start the streak today</span>}
                            <span className="muted t-xs pth-cadence">{g.cadence}</span>
                          </div>
                          {g.streak > 0 && (
                            <div className="pth-prog" title={nm ? `${g.streak} of ${nm}` : 'Legendary streak'}>
                              <div className="pth-prog__track"><span className="pth-prog__fill" style={{ width: pct + '%' }} /></div>
                              <span className="pth-prog__lbl muted t-xs">
                                {nm ? `${nm - g.streak} to ${nm}` : 'legendary'}
                              </span>
                            </div>
                          )}
                        </div>
                        {due ? (
                          <button type="button" className="pth-done" onClick={(e) => done(g, e)} aria-label={`Mark "${g.title}" done for today`}>
                            <span className="pth-done__ring row center"><Icon name="check" size={17} /></span>
                            <span className="pth-done__txt">Done</span>
                          </button>
                        ) : (
                          <span className={`pth-kept row center${doneToday ? ' is-today' : ''}`} title={doneToday ? 'Kept today' : 'Counted for this period'}>
                            <Icon name="check" size={16} />
                            <span>{doneToday ? 'Done today' : 'Counted'}</span>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {isCollapsed && (
                <button type="button" className="pth-addhere" style={{ marginTop: '.9rem' }} onClick={() => toggleCollapse(d.id)}>
                  Show {goals.length} goals
                </button>
              )}
              {!isCollapsed && goals.length > 0 && (
                <button type="button" className="pth-addhere pth-addhere--soft" onClick={() => openAdd(d.id)}>
                  <Icon name="plus" size={14} /> Add another to {d.name}
                </button>
              )}
            </Card>
          );
        })}
      </div>

      <MilestoneBurst show={burst?.n} label="in a row" sublabel={burst?.sub} onDone={() => setBurst(null)} />

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="A new goal"
        footer={<>
          <Button variant="ghost" onClick={() => { tap(); setAddOpen(false); }}>Not now</Button>
          <Button onClick={submit} disabled={!form.title.trim() || !form.domainId || (creatingNew && !form.newName.trim())}>Add it</Button>
        </>}>
        <div className="col gap-2 pth-form">
          <p className="pth-form__lead muted">
            Name one small, true thing. Kept promises compound - the size matters less than the streak.
          </p>
          <Field label="The goal" hint="Small enough to do this week. Small keeps promises.">
            <Input autoFocus placeholder="Walk 20 minutes before work" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="Which path is it part of?" hint="Do not see it? Make a new area for anything - chess, more TV, the gym, a language.">
            <Select value={form.domainId} onChange={e => setForm(f => ({ ...f, domainId: e.target.value }))}>
              {domains.map(d => <option key={d.id} value={d.id}>{domainMeta(d.id).emoji} {d.name}</option>)}
              {Object.keys(DOMAIN_META).filter(k => !domains.some(d => d.id === k)).map(k => (
                <option key={k} value={k}>{DOMAIN_META[k].emoji} {k}</option>
              ))}
              <option value={NEW}>+ Create a new area of life</option>
            </Select>
          </Field>
          {creatingNew && (
            <div className="panel col gap-2 pth-newdomain" style={{ padding: '.9rem 1rem' }}>
              <Field label="Name your new area" hint="Anything that matters to you. Aria will build it out with you.">
                <Input placeholder="Chess, Watching more TV, Guitar, The gym" value={form.newName} onChange={e => setForm(f => ({ ...f, newName: e.target.value }))} />
              </Field>
              <Field label="Pick an emoji for it">
                <div className="row wrap gap-1">
                  {EMOJI_PICKS.map(em => (
                    <button key={em} type="button" onClick={() => { tap(); setForm(f => ({ ...f, newEmoji: em })); }}
                      className="pth-emoji row center" aria-pressed={form.newEmoji === em}
                      data-on={form.newEmoji === em}>{em}</button>
                  ))}
                </div>
              </Field>
            </div>
          )}
          <Field label="How often?">
            <Select value={form.cadence} onChange={e => setForm(f => ({ ...f, cadence: e.target.value }))}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </Select>
          </Field>
          <Field label="Why it matters (optional)">
            <Input placeholder="So I feel like myself again" value={form.why} onChange={e => setForm(f => ({ ...f, why: e.target.value }))} />
          </Field>
        </div>
      </Modal>

      <style>{`
        .pth-stagger > * { animation: pthUp .5s var(--ease) both; }
        .pth-stagger > *:nth-child(1){animation-delay:.02s}
        .pth-stagger > *:nth-child(2){animation-delay:.07s}
        .pth-stagger > *:nth-child(3){animation-delay:.12s}
        .pth-stagger > *:nth-child(4){animation-delay:.17s}
        .pth-stagger > *:nth-child(5){animation-delay:.22s}
        .pth-stagger > *:nth-child(n+6){animation-delay:.27s}
        @keyframes pthUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

        /* Empty state */
        .pth-empty { text-align: center; padding: 2.4rem 1.5rem; }
        .pth-empty__orb { width: 60px; height: 60px; border-radius: 20px; margin: 0 auto 1rem;
          background: var(--accent-50); color: var(--accent-600); }
        .pth-chip { border: 1px solid var(--line); background: var(--paper); border-radius: var(--r-pill);
          padding: .34rem .7rem; font-size: .85rem; font-weight: 600; color: var(--n-600); }

        /* Domain group */
        .pth-domain { position: relative; overflow: hidden; }
        .pth-domain::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
          background: var(--dom-color); opacity: .55; }
        .pth-domain__head { display: flex; align-items: flex-start; gap: .6rem; }
        .pth-domain__link { display: flex; align-items: flex-start; gap: .75rem; flex: 1; min-width: 0;
          text-decoration: none; color: inherit; border-radius: var(--r-md); }
        .pth-domain__emoji { width: 46px; height: 46px; border-radius: 14px; font-size: 1.35rem; flex: none;
          transition: transform .2s var(--ease); }
        .pth-domain__link:hover .pth-domain__emoji { transform: scale(1.06) rotate(-3deg); }
        .pth-domain__go { color: var(--n-400); flex-shrink: 0; margin-top: 12px; transition: transform .2s var(--ease); }
        .pth-domain__link:hover .pth-domain__go { transform: translateX(3px); color: var(--dom-color); }
        .pth-count { font-size: .8rem; color: var(--n-600); background: var(--n-100); border-radius: var(--r-pill);
          padding: .28rem .62rem; white-space: nowrap; }
        .pth-count b { color: var(--dom-color); font-weight: 700; }
        .pth-collapse { width: 32px; height: 32px; border-radius: 10px; border: 1px solid var(--line);
          background: var(--paper); color: var(--n-600); cursor: pointer; }
        .pth-collapse:hover { border-color: var(--dom-color); color: var(--dom-color); }

        /* Goal row */
        .pth-goal { display: flex; align-items: center; gap: .7rem; padding: .7rem .8rem; border-radius: var(--r-md);
          background: var(--paper); border: 1px solid var(--line);
          transition: border-color .2s var(--ease), background .3s var(--ease), transform .12s var(--ease), box-shadow .2s var(--ease);
          animation: pthUp .45s var(--ease) both; animation-delay: calc(var(--i) * .05s); }
        .pth-goal:hover { border-color: var(--n-400); box-shadow: var(--shadow-sm); }
        .pth-goal.is-done { background: var(--sage-bg); border-color: transparent; }
        .pth-goal.is-pop { animation: pthPop .55s var(--ease); }
        @keyframes pthPop {
          0% { transform: scale(1); }
          30% { transform: scale(1.025); box-shadow: 0 0 0 3px var(--accent-50); }
          100% { transform: scale(1); }
        }
        .pth-goal__flame { flex: none; }
        .pth-goal__meta { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
        .pth-streak { display: inline-flex; align-items: center; gap: .25rem; font-size: .74rem; font-weight: 700;
          color: var(--accent-600); background: var(--accent-50); border-radius: var(--r-pill); padding: .12rem .5rem; }
        .pth-cadence { text-transform: capitalize; }

        /* Progress toward next milestone */
        .pth-prog { display: flex; align-items: center; gap: .5rem; }
        .pth-prog__track { flex: 1; max-width: 190px; height: 6px; border-radius: 99px; background: var(--n-100); overflow: hidden; }
        .pth-prog__fill { display: block; height: 100%; border-radius: 99px;
          background: linear-gradient(90deg, var(--gold), var(--accent)); transition: width .6s var(--ease); }
        .pth-prog__lbl { white-space: nowrap; }

        /* The satisfying done control */
        .pth-done { display: inline-flex; align-items: center; gap: .5rem; flex: none; cursor: pointer;
          border: none; padding: .4rem .5rem .4rem .4rem; border-radius: var(--r-pill);
          background: transparent; color: var(--accent-700); font-weight: 700; font-size: .92rem;
          -webkit-tap-highlight-color: transparent; transition: background .18s var(--ease); }
        .pth-done:hover { background: var(--accent-50); }
        .pth-done__ring { width: 38px; height: 38px; border-radius: 50%; flex: none;
          border: 2px solid var(--accent-300); color: var(--accent-600); background: var(--paper);
          transition: transform .16s var(--ease), background .16s var(--ease), color .16s var(--ease), border-color .16s var(--ease); }
        .pth-done:hover .pth-done__ring { transform: scale(1.08); }
        .pth-done:active .pth-done__ring { transform: scale(.9); background: var(--accent); border-color: var(--accent); color: #fff; }
        .pth-done__txt { padding-right: .25rem; }

        .pth-kept { gap: .4rem; flex: none; font-size: .82rem; font-weight: 700; color: var(--n-600);
          background: var(--n-100); border-radius: var(--r-pill); padding: .38rem .7rem; }
        .pth-kept.is-today { color: var(--sage); background: color-mix(in srgb, var(--sage) 16%, var(--paper)); }

        /* Add-a-goal affordances */
        .pth-addhere { margin-top: 1rem; display: inline-flex; align-items: center; gap: .4rem; align-self: flex-start;
          border: 1.5px dashed var(--line); background: transparent; color: var(--n-600); cursor: pointer;
          border-radius: var(--r-pill); padding: .5rem .9rem; font-weight: 600; font-size: .9rem;
          transition: border-color .18s var(--ease), color .18s var(--ease), background .18s var(--ease); }
        .pth-addhere:hover { border-color: var(--dom-color); color: var(--dom-color); background: var(--paper); }
        .pth-addhere--soft { margin-top: .7rem; border-style: dashed; font-size: .84rem; padding: .4rem .8rem; opacity: .82; }
        .pth-addhere--soft:hover { opacity: 1; }

        /* Modal polish */
        .pth-form__lead { font-size: .95rem; margin: 0 0 .2rem; }
        .pth-newdomain { animation: pthUp .3s var(--ease) both; }
        .pth-emoji { width: 40px; height: 40px; border-radius: 12px; font-size: 1.25rem; cursor: pointer;
          border: 1.5px solid var(--line); background: var(--paper);
          transition: transform .14s var(--ease), border-color .14s var(--ease), background .14s var(--ease); }
        .pth-emoji:hover { transform: translateY(-2px); }
        .pth-emoji[data-on="true"] { border: 2px solid var(--accent); background: var(--accent-50); transform: scale(1.05); }

        @media (prefers-reduced-motion: reduce) {
          .pth-stagger > *, .pth-goal, .pth-newdomain { animation: none !important; }
          .pth-goal.is-pop { animation: none !important; }
          .pth-domain__link:hover .pth-domain__emoji,
          .pth-domain__link:hover .pth-domain__go,
          .pth-done:hover .pth-done__ring,
          .pth-emoji:hover { transform: none !important; }
          .pth-prog__fill { transition: none !important; }
        }
      `}</style>
    </div>
  );
}
