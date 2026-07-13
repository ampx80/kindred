// Today - the heart of the app. Aria's daily message grounded in their real
// data, the 1-3 moves that matter, a mood check-in, and their own words back.
// A make-it-better pass: earned-momentum strip, tactile mood tiles, satisfying
// move completions, a typed morning greeting from Aria. Fully reduced-motion
// aware. Every original feature, handler, and button preserved.
import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Badge, useToast, longDate, Typer } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { celebrate } from '../lib/celebrate.js';
import { useStore, getTodayCheckin, todaysMoves, addCheckin, markGoalDone, throwback, getRecs, peopleNeedingTouch, moodTrend, domainMeta } from '../lib/store.js';
import { dailyMessage } from '../lib/daily.js';
import { speak, speechAvailable } from '../lib/voice.js';

const MOODS = [
  { v: 1, e: '🌧️', label: 'Heavy' },
  { v: 2, e: '☁️', label: 'Low' },
  { v: 3, e: '⛅', label: 'Okay' },
  { v: 4, e: '🌤️', label: 'Good' },
  { v: 5, e: '☀️', label: 'Great' },
];

const iso = (d) => d.toISOString().slice(0, 10);
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Consecutive days with a check-in, counting up from today (or yesterday, so the
// streak does not read as broken before someone checks in this morning).
function checkinStreak(checkins) {
  const days = new Set(checkins.map(c => c.date));
  const d = new Date();
  if (!days.has(iso(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(iso(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

// A number that eases up to its value once on mount. Earned momentum should feel
// like it is being counted out to you. Instant under reduced motion.
function CountUp({ to = 0, dur = 700, className, style }) {
  const [n, setN] = useState(() => (reduced() ? to : 0));
  useEffect(() => {
    if (reduced()) { setN(to); return; }
    let raf; const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]); // eslint-disable-line
  return <span className={className} style={style}>{n}</span>;
}

export default function Today() {
  const profile = useStore(s => s.profile);
  const goals = useStore(s => s.goals);
  const checkins = useStore(s => s.checkins);
  useStore(s => s.people); useStore(s => s.recs);
  const toast = useToast();
  const nav = useNavigate();
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [completing, setCompleting] = useState({}); // goal id -> true while its finish animation plays

  const today = getTodayCheckin();
  const moves = todaysMoves();
  const msg = dailyMessage();
  const tb = throwback();
  const openRecs = getRecs().filter(r => !r.done);
  // Anti-dependency: gently push toward a real person, not more time with Aria.
  // Not every day (rotates), and it leans on someone who actually matters to them.
  const reachPerson = peopleNeedingTouch()[0];
  const showReconnect = reachPerson && (new Date().getDate() % 2 === 0 || (today && today.mood <= 2));

  const todayISO = iso(new Date());
  const goalById = useMemo(() => Object.fromEntries((goals || []).map(g => [g.id, g])), [goals]);

  // Earned-momentum snapshot, all honest and drawn from real data.
  const momentum = useMemo(() => {
    const active = (goals || []).filter(g => g.status === 'active');
    const bestLive = active.reduce((b, g) => ((g.streak || 0) > (b?.streak || 0) ? g : b), null);
    const doneToday = active.filter(g => g.lastDoneAt && g.lastDoneAt.slice(0, 10) === todayISO).length;
    const goalMovesLeft = moves.filter(m => m.kind === 'goal').length;
    const planned = doneToday + goalMovesLeft;
    const mt = moodTrend(7);
    const ciStreak = checkinStreak(checkins || []);
    return { active, bestLive, doneToday, goalMovesLeft, planned, mt, ciStreak };
  }, [goals, checkins, moves, todayISO]);

  const showMomentum = profile && (momentum.active.length > 0 || (checkins || []).length > 0);
  const allClear = momentum.doneToday > 0 && momentum.goalMovesLeft === 0;

  // Type Aria's message in the first time she is seen for the day this session,
  // then hold it steady on later visits so it never nags.
  const [typeMsg] = useState(() => {
    try {
      const seen = sessionStorage.getItem('kd_today_typed');
      if (seen === todayISO) return false;
      sessionStorage.setItem('kd_today_typed', todayISO);
      return true;
    } catch { return true; }
  });
  const [thinking, setThinking] = useState(typeMsg);

  const checkIn = (v) => {
    const r = addCheckin({ mood: v, note });
    if (r.error) return toast(r.message, 'warn');
    if (v >= 4) celebrate({ count: 50, y: window.innerHeight * .45 });
    toast(v <= 2 ? 'Noted. Gentle day, small steps.' : 'Logged. Good to know where you are.');
    setNoteOpen(v <= 3 && !note);
  };

  // Goal moves complete with a satisfying beat: the row fills green and settles,
  // confetti bursts from the button, then the store update retires it. Non-goal
  // moves navigate as before.
  const doGoal = (m, ev) => {
    if (completing[m.id]) return;
    const rect = ev?.currentTarget?.getBoundingClientRect?.();
    const origin = rect ? { x: rect.left + rect.width / 2, y: rect.top } : { y: window.innerHeight * .5 };
    setCompleting(c => ({ ...c, [m.id]: true }));
    const run = () => {
      const r = markGoalDone(m.id);
      setCompleting(c => { const n = { ...c }; delete n[m.id]; return n; });
      if (r.error) return toast(r.message, 'warn');
      if (r.milestone) { celebrate({ count: 170, ...origin }); toast(`${r.milestone} in a row. That is a milestone.`); }
      else if (r.graceApplied) { celebrate({ count: 80, ...origin }); toast('You missed a day and I kept your streak. Everyone misses one. Back at it.'); }
      else { celebrate({ count: 80, ...origin }); toast('Counted. Momentum is yours.'); }
    };
    if (reduced()) run(); else setTimeout(run, 520);
  };

  const doMove = (m, ev) => {
    if (m.kind === 'goal') return doGoal(m, ev);
    nav(m.to);
  };

  const hour = new Date().getHours();
  const daypart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  const progressPct = momentum.planned ? Math.round((momentum.doneToday / momentum.planned) * 100) : 0;

  return (
    <div className="col gap-3">
      <TodayStyles />

      <div className="col" style={{ gap: '.25rem' }}>
        <span className="eyebrow">{longDate(new Date())}</span>
        <h1 className="serif">Good {daypart}, {profile?.name || 'there'}.</h1>
      </div>

      {msg && (
        <Card className="card-pad" style={{ borderColor: 'var(--accent-300)', background: 'linear-gradient(135deg, var(--paper), var(--accent-50))' }}>
          <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
            <span className={`aria-orb${thinking ? ' is-thinking' : ''}`} style={{ width: 40, height: 40, marginTop: 2 }} aria-hidden />
            <div className="col" style={{ gap: '.3rem', minWidth: 0 }}>
              <div className="row between gap-2">
                <span className="t-xs fw-7 muted" style={{ letterSpacing: '.07em', textTransform: 'uppercase' }}>From Aria</span>
                {speechAvailable() && (
                  <button className="btn btn-ghost btn-sm" onClick={() => speak(msg)} aria-label="Hear this from Aria" title="Hear it"><Icon name="volume" size={15} /></button>
                )}
              </div>
              <p className="serif" style={{ fontSize: '1.14rem', lineHeight: 1.6, margin: 0 }}>
                {typeMsg
                  ? <Typer text={msg} speed={16} onDone={() => setThinking(false)} />
                  : msg}
              </p>
            </div>
          </div>
        </Card>
      )}

      {showMomentum && (
        <div className="td-tiles stagger">
          <div className="td-tile" title="Your strongest live streak">
            <span className="td-tile-ic" style={{ background: 'var(--accent-50)', color: 'var(--accent-600)' }}>
              <Icon name="flame" size={22} className={momentum.bestLive?.streak ? 'td-flame' : ''} />
            </span>
            <div className="col" style={{ gap: '.05rem', minWidth: 0 }}>
              <span className="td-num" style={{ color: 'var(--accent-700)' }}>
                <CountUp to={momentum.bestLive?.streak || 0} /><span className="td-unit">{(momentum.bestLive?.streak || 0) === 1 ? ' day' : ' days'}</span>
              </span>
              <span className="muted t-sm clip">{momentum.bestLive?.streak ? `on ${momentum.bestLive.title}` : 'your first streak is one rep away'}</span>
            </div>
          </div>

          <div className="td-tile" title="Moves completed today">
            <span className="td-tile-ic" style={{ background: 'var(--sage-bg)', color: 'var(--sage)' }}>
              <Icon name={allClear ? 'trophy' : 'check'} size={22} />
            </span>
            <div className="col" style={{ gap: '.05rem', minWidth: 0 }}>
              <span className="td-num" style={{ color: 'var(--sage)' }}>
                <CountUp to={momentum.doneToday} /><span className="td-unit">{momentum.planned ? ` of ${momentum.planned}` : ''}</span>
              </span>
              <span className="muted t-sm clip">{allClear ? 'all clear, nice work' : momentum.goalMovesLeft ? `${momentum.goalMovesLeft} still to go` : 'moves done today'}</span>
            </div>
          </div>

          <div className="td-tile" title="How your week is feeling">
            <span className="td-tile-ic" style={{ background: 'var(--gold-bg)', color: 'var(--gold)' }}>
              <Icon name="smile" size={22} />
            </span>
            <div className="col" style={{ gap: '.05rem', minWidth: 0 }}>
              <span className="td-num" style={{ color: 'var(--gold)' }}>
                {momentum.mt ? <>{momentum.mt.avg}<span className="td-unit"> of 5</span></> : <span style={{ fontSize: '1.2rem' }}>Say hi</span>}
              </span>
              <span className="muted t-sm clip">
                {momentum.mt
                  ? `mood over ${momentum.mt.count} check-in${momentum.mt.count === 1 ? '' : 's'}`
                  : 'tap a mood below to start'}
                {momentum.ciStreak > 1 ? ` - ${momentum.ciStreak} day run` : ''}
              </span>
            </div>
          </div>
        </div>
      )}

      {showReconnect && (
        <Card className="card-pad" style={{ borderColor: 'var(--rose)', background: 'var(--rose-bg)' }}>
          <div className="row gap-2 between wrap" style={{ alignItems: 'center' }}>
            <div className="row gap-2" style={{ alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
              <Icon name="heart" size={20} style={{ color: 'var(--rose)', flexShrink: 0, marginTop: 3 }} />
              <div className="col" style={{ gap: '.2rem', minWidth: 0 }}>
                <span className="fw-6">I am glad you are here, and I am not a substitute for the people who love you.</span>
                <span className="muted t-sm clip">{reachPerson.name} has not heard from you in a while. That is worth more than another minute with me.</span>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => nav(`/people/${reachPerson.id}`)}>Reach {reachPerson.name.split(' ')[0]}</button>
          </div>
        </Card>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <Card className="card-pad">
          <div className="row between" style={{ marginBottom: '.9rem' }}>
            <h3 style={{ margin: 0 }}>Today's moves</h3>
            <Badge tone="accent">{moves.length ? `${moves.length} that matter` : 'clear'}</Badge>
          </div>

          {momentum.planned > 0 && (
            <div className="col" style={{ gap: '.4rem', marginBottom: '1rem' }}>
              <div className="warmbar" aria-hidden><i style={{ width: `${progressPct}%` }} /></div>
              <span className="t-xs fw-6 muted">
                {allClear ? 'Every move done. That is a full morning.' : `${momentum.doneToday} of ${momentum.planned} done today`}
              </span>
            </div>
          )}

          {moves.length === 0 ? (
            allClear ? (
              <div className="row gap-2" style={{ alignItems: 'center', padding: '.4rem 0' }}>
                <span className="row center floaty" style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--gold-bg)', color: 'var(--gold)', flex: 'none' }}><Icon name="trophy" size={24} /></span>
                <div className="col" style={{ gap: '.15rem' }}>
                  <span className="fw-6">You cleared it. All {momentum.doneToday} done.</span>
                  <span className="muted t-sm">Rest, or open <Link className="link" to="/paths">your paths</Link> and get ahead.</span>
                </div>
              </div>
            ) : (
              <p className="muted">Nothing pressing. Rest is a move too - or open <Link className="link" to="/paths">your paths</Link> and get ahead.</p>
            )
          ) : (
            <div className="col gap-1 stagger">
              {moves.map((m) => {
                const g = m.kind === 'goal' ? goalById[m.id] : null;
                const dm = g ? domainMeta(g.domainId) : null;
                const isDone = !!completing[m.id];
                return (
                  <div key={m.kind + m.id} className={`row gap-2 panel td-move${isDone ? ' done' : ''}`} style={{ padding: '.85rem 1rem', alignItems: 'center' }}>
                    {dm && (
                      <span className="row center" style={{ width: 34, height: 34, borderRadius: 10, background: isDone ? 'var(--ok-bg)' : dm.bg, fontSize: '1.05rem', flex: 'none' }} aria-hidden>
                        {isDone ? <Icon name="check" size={18} className="td-check-pop" style={{ color: 'var(--ok)' }} /> : dm.emoji}
                      </span>
                    )}
                    <div className="col" style={{ gap: '.1rem', minWidth: 0, flex: 1 }}>
                      <span className="fw-6 clip" style={{ textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? .7 : 1 }}>{m.label}</span>
                      <span className="muted t-sm clip">{isDone ? 'Logged. Momentum is yours.' : m.sub}</span>
                    </div>
                    {g && (g.streak || 0) > 0 && !isDone && (
                      <span className="badge badge-accent td-streak" title={`${g.streak} in a row`}><Icon name="flame" size={13} /> {g.streak}</span>
                    )}
                    {m.kind === 'goal' ? (
                      <button className="btn btn-primary btn-sm" onClick={(e) => doMove(m, e)} disabled={isDone} aria-label={`Mark ${m.label} done`}>
                        <Icon name="check" size={15} /> {isDone ? 'Nice' : 'Done'}
                      </button>
                    ) : (
                      <button className="btn btn-ghost btn-sm" onClick={(e) => doMove(m, e)}>Go <Icon name="chevronRight" size={15} /></button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="card-pad">
          <h3 style={{ marginBottom: '.35rem' }}>How is today sitting?</h3>
          <p className="muted t-sm" style={{ marginBottom: '.9rem' }}>{today ? 'You can change it anytime today.' : 'One tap. Aria reads the weather.'}</p>
          <div className="row gap-1" style={{ justifyContent: 'space-between' }}>
            {MOODS.map(m => {
              const sel = today?.mood === m.v;
              return (
                <button key={m.v} onClick={() => checkIn(m.v)} aria-pressed={sel} aria-label={m.label}
                  className={`col center td-mood${sel ? ' sel' : ''}`}
                  style={{
                    gap: '.25rem', flex: 1, padding: '.6rem .2rem', cursor: 'pointer', borderRadius: 'var(--r-md)',
                    border: sel ? '2px solid var(--accent)' : '1.5px solid var(--line)',
                    background: sel ? 'var(--accent-50)' : 'var(--paper)',
                  }}>
                  <span className="td-emo" style={{ fontSize: '1.5rem', lineHeight: 1 }}>{m.e}</span>
                  <span className="t-xs fw-6 muted">{m.label}</span>
                </button>
              );
            })}
          </div>
          {today && (
            <p className="t-sm fw-6 fade-up" style={{ marginTop: '.7rem', color: 'var(--accent-700)' }}>
              Today reads {MOODS.find(x => x.v === today.mood)?.label.toLowerCase()}. Aria has it.
            </p>
          )}
          {(noteOpen || today?.note) && (
            <form className="row gap-1" style={{ marginTop: '.8rem' }} onSubmit={(e) => { e.preventDefault(); if (today) { addCheckin({ mood: today.mood, note }); setNote(''); setNoteOpen(false); } }}>
              <input className="input" placeholder={today?.note || 'Want to say why? (optional)'} value={note} onChange={e => setNote(e.target.value)} />
              <button className="btn btn-ghost" type="submit" disabled={!note.trim()} aria-label="Save note"><Icon name="check" size={16} /></button>
            </form>
          )}
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: openRecs.length ? '1fr 1fr' : '1fr' }}>
        {tb && (
          <Card className="card-pad card-hover" style={{ background: 'var(--gold-bg)' }}>
            <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
              <Icon name="quote" size={22} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 4 }} />
              <div className="col" style={{ gap: '.3rem' }}>
                <p className="serif" style={{ fontSize: '1.12rem', fontStyle: 'italic', margin: 0 }}>"{tb.text}"</p>
                <span className="muted t-sm">You, {new Date(tb.at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. Do not forget who wrote that.</span>
              </div>
            </div>
          </Card>
        )}
        {openRecs.length > 0 && (
          <Card className="card-pad card-hover" onClick={() => nav('/foryou')} style={{ cursor: 'pointer' }}>
            <div className="row between">
              <div className="col" style={{ gap: '.25rem' }}>
                <span className="t-xs fw-7 muted" style={{ letterSpacing: '.07em', textTransform: 'uppercase' }}>For you</span>
                <span className="fw-6">{openRecs[0].title}</span>
                <span className="muted t-sm clip">{openRecs.length > 1 ? `and ${openRecs.length - 1} more from Aria` : 'from Aria, tuned to you'}</span>
              </div>
              <Icon name="chevronRight" size={20} style={{ color: 'var(--n-400)', flexShrink: 0 }} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// Scoped micro-interaction styles. Lives with the page (does not touch the shared
// design system) and stays out of index.css. All motion is disabled under
// prefers-reduced-motion.
function TodayStyles() {
  return (
    <style>{`
      .td-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: .7rem; }
      @media (max-width: 560px) { .td-tiles { grid-template-columns: 1fr; } }
      .td-tile { display: flex; align-items: center; gap: .8rem; padding: .85rem 1rem; background: var(--paper);
        border: 1px solid var(--line); border-radius: var(--r-md); box-shadow: var(--shadow-sm);
        transition: transform .2s var(--ease), box-shadow .2s var(--ease), border-color .2s var(--ease); }
      .td-tile:hover { transform: translateY(-3px); box-shadow: var(--shadow-md); border-color: var(--accent-300); }
      .td-tile-ic { width: 42px; height: 42px; border-radius: 13px; display: grid; place-items: center; flex: none; }
      .td-num { font-family: var(--font-display); font-weight: 700; font-size: 1.75rem; line-height: 1;
        letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
      .td-unit { font-size: .95rem; font-weight: 600; color: var(--n-600); letter-spacing: 0; }
      .td-flame { animation: tdFlicker 2.4s ease-in-out infinite; transform-origin: center bottom; }
      @keyframes tdFlicker { 0%,100% { transform: scale(1) rotate(-2deg); } 50% { transform: scale(1.1) rotate(2deg); } }

      .td-mood { transition: transform .16s var(--ease), border-color .16s var(--ease), background .16s var(--ease), box-shadow .16s var(--ease); }
      .td-mood:hover { transform: translateY(-3px); box-shadow: var(--shadow-sm); border-color: var(--accent-300) !important; }
      .td-mood:active { transform: translateY(0) scale(.94); }
      .td-mood.sel { box-shadow: 0 10px 22px -10px rgba(217,107,67,.55); }
      .td-mood .td-emo { display: inline-block; transition: transform .16s var(--ease); }
      .td-mood.sel .td-emo { animation: tdEmoPop .45s var(--ease); }
      .td-mood:hover .td-emo { transform: scale(1.14) rotate(-4deg); }
      @keyframes tdEmoPop { 0% { transform: scale(.55); } 55% { transform: scale(1.3); } 100% { transform: scale(1); } }

      .td-move { transition: transform .16s var(--ease), box-shadow .16s var(--ease), border-color .16s var(--ease), background .4s var(--ease); }
      .td-move:hover { transform: translateX(3px); border-color: var(--accent-300); box-shadow: var(--shadow-sm); }
      .td-move.done { background: var(--ok-bg); border-color: var(--ok); animation: tdCollapse .55s var(--ease) forwards; }
      @keyframes tdCollapse { 0% { opacity: 1; } 72% { opacity: 1; transform: none; } 100% { opacity: .35; transform: scale(.985); } }
      .td-check-pop { animation: tdCheckPop .4s var(--ease); }
      @keyframes tdCheckPop { 0% { transform: scale(0) rotate(-25deg); } 60% { transform: scale(1.35); } 100% { transform: scale(1); } }
      .td-streak { animation: tdFlicker 2.8s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce) {
        .td-tile, .td-tile:hover, .td-mood, .td-mood:hover, .td-mood:active { transition: none !important; transform: none !important; }
        .td-flame, .td-mood.sel .td-emo, .td-mood:hover .td-emo, .td-move, .td-move.done, .td-check-pop, .td-streak { animation: none !important; transition: none !important; transform: none !important; }
      }
    `}</style>
  );
}
