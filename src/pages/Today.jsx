// Today - the heart of the app and the daily ritual. Aria's grounded message,
// then the Day Ring: three rings to close each day (check in, move, reflect).
// Morning beat = mood check-in; evening beat = an honest look back. Closing all
// three grows the ritual streak - the number that compounds - and sometimes
// earns a surprise spark. Faith folks get a warm, optional daily reflection.
// Fully reduced-motion aware; every original feature preserved.
import { useState, useMemo, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Badge, useToast, longDate, Typer, Input } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { celebrate, burstFrom } from '../lib/celebrate.js';
import { StreakFlame, MoodRing, MilestoneBurst } from '../components/Delight.jsx';
import { sTap, sSuccess, sCelebrate } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { track } from '../lib/track.js';
import DayRing, { DayRingLegend } from '../components/DayRing.jsx';
import {
  useStore, getTodayCheckin, todaysMoves, addCheckin, markGoalDone, throwback, getRecs,
  peopleNeedingTouch, moodTrend, domainMeta, dayProgress, ritualStreak, getTodayReflection,
  addReflection, faithReflection, maybeSpark,
} from '../lib/store.js';
import { dailyMessage } from '../lib/daily.js';
import { speak, speechAvailable } from '../lib/voice.js';

const MOODS = [
  { v: 1, e: '🌧️', label: 'Heavy' },
  { v: 2, e: '☁️', label: 'Low' },
  { v: 3, e: '⛅', label: 'Okay' },
  { v: 4, e: '🌤️', label: 'Good' },
  { v: 5, e: '☀️', label: 'Great' },
];
const DAY_RATINGS = [
  { v: 1, e: '😔', label: 'Rough' },
  { v: 2, e: '😕', label: 'Meh' },
  { v: 3, e: '🙂', label: 'Fine' },
  { v: 4, e: '😄', label: 'Good' },
  { v: 5, e: '🌟', label: 'Great' },
];

const iso = (d) => d.toISOString().slice(0, 10);
const reduced = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  const reflections = useStore(s => s.reflections);
  useStore(s => s.people); useStore(s => s.recs);
  const toast = useToast();
  const nav = useNavigate();
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [completing, setCompleting] = useState({});
  const [spark, setSpark] = useState(null);
  const [dayCloseBurst, setDayCloseBurst] = useState(0);
  const closedRef = useRef(false);

  const today = getTodayCheckin();
  const reflection = getTodayReflection();
  const dp = dayProgress();
  const moves = todaysMoves();
  const msg = dailyMessage();
  const faith = faithReflection();
  const tb = throwback();
  const openRecs = getRecs().filter(r => !r.done);
  const reachPerson = peopleNeedingTouch()[0];
  const showReconnect = reachPerson && (new Date().getDate() % 2 === 0 || (today && today.mood <= 2));

  const todayISO = iso(new Date());
  const goalById = useMemo(() => Object.fromEntries((goals || []).map(g => [g.id, g])), [goals]);
  const rStreak = ritualStreak();

  const hour = new Date().getHours();
  const daypart = hour < 5 ? 'late' : hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : hour < 21 ? 'evening' : 'late';
  const greet = {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    late: 'Still awake',
  }[daypart];
  const greetSub = {
    morning: 'A fresh page. Let us open the day together.',
    afternoon: 'Midday. A good moment to check your footing.',
    evening: 'The day is winding down. Time to close it well.',
    late: 'You are up late. Be gentle with yourself tonight.',
  }[daypart];

  // Micro-copy under the ring: how many beats are left to close today.
  const beatsLeft = dp.rings.filter(r => !r.done).length;
  const momentumCopy = dp.complete
    ? 'Today is complete. Well done.'
    : beatsLeft >= 3 ? 'Three small beats to close today.'
    : beatsLeft === 2 ? 'Two small beats left.'
    : 'One more and today is yours.';

  const firstDueMove = moves.find(m => m.kind === 'goal' && !completing[m.id]) || null;

  // The evening beat surfaces once the day is underway: afternoon onward, or as
  // soon as they have checked in and cleared their moves. Never nags in the AM.
  const showReflect = !reflection && (hour >= 15 || (dp.checkedIn && dp.dueToday === 0 && dp.doneToday > 0));

  const momentum = useMemo(() => {
    const active = (goals || []).filter(g => g.status === 'active');
    const bestLive = active.reduce((b, g) => ((g.streak || 0) > (b?.streak || 0) ? g : b), null);
    const mt = moodTrend(7);
    return { active, bestLive, mt };
  }, [goals, checkins, reflections]);

  const [typeMsg] = useState(() => {
    try {
      const seen = sessionStorage.getItem('kd_today_typed');
      if (seen === todayISO) return false;
      sessionStorage.setItem('kd_today_typed', todayISO);
      return true;
    } catch { return true; }
  });
  const [thinking, setThinking] = useState(typeMsg);

  // A finished beat should feel physical: a soft success buzz, a warm chime, and
  // a confetti bloom from the thing you just tapped. Reduced-motion safe (each
  // helper self-guards). Store tracking still runs; this is additive.
  const beatDone = (beat, ev) => {
    haptic('success');
    sSuccess();
    if (ev) burstFrom(ev, { count: 60, spread: 0.85 });
    else celebrate({ count: 60, y: window.innerHeight * .42 });
    track('today_beat_done', { beat });
  };

  const checkIn = (v, ev) => {
    const wasClosed = dp.complete;
    const wasCheckedIn = dp.checkedIn;
    const r = addCheckin({ mood: v, note });
    if (r.error) return toast(r.message, 'warn');
    if (!wasCheckedIn) beatDone('checkin', ev);
    if (v >= 4) celebrate({ count: 50, y: window.innerHeight * .45 });
    toast(v <= 2 ? 'Noted. Gentle day, small steps.' : 'Logged. Good to know where you are.');
    setNoteOpen(v <= 3 && !note);
    afterBeat(wasClosed);
  };

  // If a beat just closed the whole day, celebrate it hard and maybe drop a
  // spark - but only once per day (guarded by a ref plus a per-date localStorage
  // key so a reload or a second closing beat never re-fires the euphoria).
  const afterBeat = (wasClosed) => {
    const now = dayProgress();
    if (!now.complete || wasClosed) return;
    const key = `kd_day_closed_${todayISO}`;
    let already = closedRef.current;
    try { if (!already) already = localStorage.getItem(key) === '1'; } catch {}
    if (already) return;
    closedRef.current = true;
    try { localStorage.setItem(key, '1'); } catch {}
    const streak = ritualStreak();
    const firstEver = (reflections || []).length <= 1 || streak <= 1;
    haptic('celebrate');
    sCelebrate();
    track('day_closed', { streak });
    setDayCloseBurst(streak || 1);   // drives the MilestoneBurst (fires confetti once)
    const s = maybeSpark(firstEver);
    if (s) setSpark(s);
  };

  const submitReflection = (rating, gratitude, ev) => {
    const wasClosed = dp.complete;
    const wasReflected = dp.reflected;
    const r = addReflection({ rating, gratitude });
    if (r.error) return toast(r.message, 'warn');
    if (!wasReflected) beatDone('reflect', ev);
    toast('Day closed. That is how it compounds.');
    afterBeat(wasClosed);
  };

  const doGoal = (m, ev) => {
    if (completing[m.id]) return;
    const rect = ev?.currentTarget?.getBoundingClientRect?.();
    const origin = rect ? { x: rect.left + rect.width / 2, y: rect.top } : { y: window.innerHeight * .5 };
    setCompleting(c => ({ ...c, [m.id]: true }));
    const wasClosed = dp.complete;
    const run = () => {
      const r = markGoalDone(m.id);
      setCompleting(c => { const n = { ...c }; delete n[m.id]; return n; });
      if (r.error) return toast(r.message, 'warn');
      haptic('success');
      sSuccess();
      track('today_beat_done', { beat: 'move' });
      if (r.milestone) { celebrate({ count: 170, ...origin }); toast(`${r.milestone} in a row. That is a milestone.`); }
      else if (r.graceApplied) { celebrate({ count: 80, ...origin }); toast('You missed a day and I kept your streak. Everyone misses one. Back at it.'); }
      else { celebrate({ count: 80, ...origin }); toast('Counted. Momentum is yours.'); }
      afterBeat(wasClosed);
    };
    if (reduced()) run(); else setTimeout(run, 520);
  };

  const doMove = (m, ev) => {
    if (m.kind === 'goal') return doGoal(m, ev);
    nav(m.to);
  };

  // Quick actions: fast, low-commitment taps with a light click of feedback.
  const openAria = () => {
    haptic('light'); sTap();
    track('today_quick_action', { action: 'aria' });
    window.dispatchEvent(new CustomEvent('kindred:aria', { detail: {} }));
  };
  const quickMood = (v) => {
    haptic('light'); sTap();
    checkIn(v);
  };
  const quickMarkMove = (ev) => {
    haptic('light'); sTap();
    if (firstDueMove) doGoal(firstDueMove, ev);
  };

  return (
    <div className="col gap-3 td-page">
      <TodayStyles />

      <div className="col td-head" style={{ gap: '.3rem' }}>
        <span className="eyebrow row gap-1" style={{ alignItems: 'center' }}>
          <span className="td-pulse" aria-hidden /> {longDate(new Date())}
        </span>
        <div className="row between gap-2 wrap" style={{ alignItems: 'center' }}>
          <h1 className="serif" style={{ margin: 0 }}>{greet}, {profile?.name || 'there'}.</h1>
          {rStreak > 0 && (
            <span className="td-head-streak" title={`${rStreak} day ritual streak`}>
              <StreakFlame count={rStreak} size={30} showCount={false} />
              <span className="col" style={{ gap: 0, lineHeight: 1 }}>
                <b className="tnum" style={{ fontSize: '1.05rem', color: 'var(--accent-700)' }}>{rStreak}</b>
                <span className="t-xs muted" style={{ letterSpacing: '.04em' }}>day{rStreak === 1 ? '' : 's'} closed</span>
              </span>
            </span>
          )}
        </div>
        <span className="muted t-sm">{greetSub}</span>
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
                {typeMsg ? <Typer text={msg} speed={16} onDone={() => setThinking(false)} /> : msg}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* THE DAILY RITUAL - the addictive centerpiece */}
      <Card className={`card-pad td-ritual${dp.complete ? ' is-complete' : ''}`}>
        <div className="td-ritual-grid">
          <div className="col center" style={{ gap: '.55rem', flex: 'none' }}>
            <div className={`td-ring-wrap${dp.complete ? ' is-complete' : ''}`}>
              <DayRing progress={dp} size={172} />
            </div>
            <span className={`td-momentum t-sm fw-6${dp.complete ? ' is-complete' : ''}`}>{momentumCopy}</span>
          </div>
          <div className="col" style={{ gap: '.9rem', minWidth: 0, flex: 1 }}>
            <div className="row between gap-2 wrap" style={{ alignItems: 'flex-start' }}>
              <div className="col" style={{ gap: '.15rem', minWidth: 0 }}>
                <h3 style={{ margin: 0 }}>{dp.complete ? 'Today is closed' : 'Close your day'}</h3>
                <span className="muted t-sm">
                  {dp.complete ? 'Check in, moves, reflection - all done. This is the whole thing.' : 'Three small beats. Finish them and the streak grows.'}
                </span>
              </div>
              {rStreak > 0 && (
                <span className="td-ritual-streak" title="Consecutive fully closed days">
                  <Icon name="flame" size={16} /> <CountUp to={rStreak} /> day{rStreak === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <DayRingLegend progress={dp} />
            {dp.complete && (
              <div className="td-closed-band row gap-2" style={{ alignItems: 'center' }}>
                <StreakFlame count={rStreak} size={34} showCount={false} />
                <span className="fw-6 t-sm">
                  {rStreak > 1 ? `That is ${rStreak} days closed in a row. Rest well - you earned it.` : 'First day closed. This is how it compounds.'}
                </span>
              </div>
            )}
          </div>
        </div>
      </Card>

      {(goals || []).length === 0 && (
        <Card className="card-pad td-invite card-hover" onClick={() => nav('/paths')} style={{ cursor: 'pointer' }}>
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <span className="td-invite-ic row center floaty" aria-hidden><Icon name="sparkles" size={24} /></span>
            <div className="col" style={{ gap: '.2rem', minWidth: 0, flex: 1 }}>
              <span className="fw-7" style={{ fontSize: '1.05rem' }}>Let us pick your first path.</span>
              <span className="muted t-sm clip">One small goal is all it takes to start the streak. I will keep you moving.</span>
            </div>
            <span className="btn btn-warm btn-sm" style={{ flex: 'none' }}>Choose a path <Icon name="chevronRight" size={15} /></span>
          </div>
        </Card>
      )}

      {/* QUICK ACTIONS - fast, low-commitment taps to keep the day moving */}
      <Card className="card-pad td-quick">
        <div className="row between gap-2 wrap" style={{ marginBottom: '.8rem', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Quick actions</h3>
          <span className="muted t-xs">{today ? `Feeling ${MOODS.find(x => x.v === today.mood)?.label.toLowerCase()}` : 'One tap to begin'}</span>
        </div>
        <div className="col gap-2">
          <div className="col" style={{ gap: '.35rem' }}>
            <span className="t-xs fw-7 muted" style={{ letterSpacing: '.07em', textTransform: 'uppercase' }}>{today ? 'Change your check-in' : 'Quick check-in'}</span>
            <MoodRing value={today?.mood || 0} onChange={quickMood} size={46} label={false} />
          </div>
          <div className="row gap-1 wrap">
            {firstDueMove && (
              <button className="td-chip" onClick={(e) => quickMarkMove(e)}>
                <Icon name="check" size={15} /> Mark a move
              </button>
            )}
            <button className="td-chip" onClick={openAria}>
              <span className="aria-orb" style={{ width: 18, height: 18 }} aria-hidden /> Talk to Aria
            </button>
            <button className="td-chip" onClick={() => { haptic('light'); sTap(); nav('/paths'); }}>
              <Icon name="target" size={15} /> Your paths
            </button>
          </div>
        </div>
      </Card>

      {spark && (
        <Card className="card-pad td-spark" onClick={() => setSpark(null)} style={{ cursor: 'pointer' }}>
          <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
            <span className="td-spark-ic" aria-hidden><Icon name="sparkles" size={22} /></span>
            <div className="col" style={{ gap: '.15rem', minWidth: 0 }}>
              <span className="t-xs fw-7" style={{ letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--gold)' }}>A little something from Aria</span>
              <p className="serif" style={{ fontSize: '1.1rem', margin: 0, lineHeight: 1.5 }}>{spark}</p>
            </div>
          </div>
        </Card>
      )}

      {faith && (
        <Card className="card-pad card-hover" style={{ background: 'var(--sky-bg)', borderColor: 'var(--sky)' }}
          onClick={() => window.dispatchEvent(new CustomEvent('kindred:aria', { detail: { prompt: `Sit with me on this for a moment: ${faith.text}` } }))}>
          <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
            <Icon name="sun" size={22} style={{ color: 'var(--sky)', flexShrink: 0, marginTop: 3 }} />
            <div className="col" style={{ gap: '.2rem', minWidth: 0 }}>
              <span className="t-xs fw-7 muted" style={{ letterSpacing: '.07em', textTransform: 'uppercase' }}>A quiet moment</span>
              <p className="serif" style={{ fontSize: '1.12rem', margin: 0, lineHeight: 1.55 }}>{faith.text}</p>
              <span className="muted t-sm">Tap to sit with it together.</span>
            </div>
          </div>
        </Card>
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

          {moves.length === 0 ? (
            dp.doneToday > 0 ? (
              <div className="row gap-2" style={{ alignItems: 'center', padding: '.4rem 0' }}>
                <span className="row center floaty" style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--gold-bg)', color: 'var(--gold)', flex: 'none' }}><Icon name="trophy" size={24} /></span>
                <div className="col" style={{ gap: '.15rem' }}>
                  <span className="fw-6">You cleared it. All {dp.doneToday} done.</span>
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

        {/* MORNING BEAT: mood check-in. Once reflected-ready, the evening beat takes over below. */}
        <Card className="card-pad">
          <h3 style={{ marginBottom: '.35rem' }}>How is today sitting?</h3>
          <p className="muted t-sm" style={{ marginBottom: '.9rem' }}>{today ? 'You can change it anytime today.' : 'One tap. Aria reads the weather.'}</p>
          <div className="row gap-1" style={{ justifyContent: 'space-between' }}>
            {MOODS.map(m => {
              const sel = today?.mood === m.v;
              return (
                <button key={m.v} onClick={(e) => checkIn(m.v, e)} aria-pressed={sel} aria-label={m.label}
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

      {/* EVENING BEAT: close the day with an honest look back. */}
      {showReflect && <ReflectionCard onSubmit={submitReflection} />}
      {reflection && (
        <Card className="card-pad" style={{ background: 'var(--gold-bg)', borderColor: 'var(--gold)' }}>
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <Icon name="moon" size={20} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            <div className="col" style={{ gap: '.1rem', minWidth: 0 }}>
              <span className="fw-6">Day closed. You rated it {DAY_RATINGS.find(x => x.v === reflection.rating)?.label.toLowerCase()}.</span>
              {reflection.gratitude && <span className="muted t-sm clip">Grateful for: {reflection.gratitude}</span>}
            </div>
          </div>
        </Card>
      )}

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

      <MilestoneBurst
        show={dayCloseBurst}
        label={dayCloseBurst === 1 ? 'day closed' : 'days in a row'}
        sublabel="Every beat, done. Rest well."
        onDone={() => setDayCloseBurst(0)}
      />
    </div>
  );
}

// The evening reflection: rate the day, name one thing you are grateful for.
// Kept light on purpose - two taps closes it and grows the ritual streak.
function ReflectionCard({ onSubmit }) {
  const [rating, setRating] = useState(0);
  const [gratitude, setGratitude] = useState('');
  return (
    <Card className="card-pad td-reflect">
      <div className="row gap-2" style={{ alignItems: 'center', marginBottom: '.6rem' }}>
        <span className="row center" style={{ width: 38, height: 38, borderRadius: 12, background: 'var(--gold-bg)', color: 'var(--gold)', flex: 'none' }}><Icon name="moon" size={20} /></span>
        <div className="col" style={{ gap: '.1rem', minWidth: 0 }}>
          <h3 style={{ margin: 0 }}>Close the day</h3>
          <span className="muted t-sm">How did today actually go? Aria remembers it with you.</span>
        </div>
      </div>
      <div className="row gap-1" style={{ justifyContent: 'space-between', marginBottom: '.8rem' }}>
        {DAY_RATINGS.map(m => {
          const sel = rating === m.v;
          return (
            <button key={m.v} onClick={() => setRating(m.v)} aria-pressed={sel} aria-label={m.label}
              className={`col center td-mood${sel ? ' sel' : ''}`}
              style={{
                gap: '.25rem', flex: 1, padding: '.6rem .2rem', cursor: 'pointer', borderRadius: 'var(--r-md)',
                border: sel ? '2px solid var(--gold)' : '1.5px solid var(--line)',
                background: sel ? 'var(--gold-bg)' : 'var(--paper)',
              }}>
              <span className="td-emo" style={{ fontSize: '1.5rem', lineHeight: 1 }}>{m.e}</span>
              <span className="t-xs fw-6 muted">{m.label}</span>
            </button>
          );
        })}
      </div>
      <form className="col gap-2" onSubmit={(e) => { e.preventDefault(); if (rating) onSubmit(rating, gratitude, e); }}>
        <Input placeholder="One thing you are grateful for today (optional)" value={gratitude} onChange={e => setGratitude(e.target.value)} />
        <button className="btn btn-primary" type="submit" disabled={!rating} style={{ alignSelf: 'flex-start' }}>
          <Icon name="check" size={16} /> Close the day
        </button>
      </form>
    </Card>
  );
}

function TodayStyles() {
  return (
    <style>{`
      /* Staggered entrance for the whole page (reduced-motion users get none). */
      @media (prefers-reduced-motion: no-preference) {
        .td-page > * { animation: tdEnter .55s cubic-bezier(.22,1,.36,1) both; }
        .td-page > *:nth-child(2) { animation-delay: .04s; }
        .td-page > *:nth-child(3) { animation-delay: .09s; }
        .td-page > *:nth-child(4) { animation-delay: .14s; }
        .td-page > *:nth-child(5) { animation-delay: .19s; }
        .td-page > *:nth-child(6) { animation-delay: .24s; }
        .td-page > *:nth-child(n+7) { animation-delay: .29s; }
      }
      @keyframes tdEnter { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

      /* Time-aware greeting header. */
      .td-head h1 { line-height: 1.1; }
      .td-pulse { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); display: inline-block; animation: tdPing 2.6s ease-out infinite; }
      @keyframes tdPing {
        0% { box-shadow: 0 0 0 0 rgba(217,107,67,.5); }
        70% { box-shadow: 0 0 0 8px rgba(217,107,67,0); }
        100% { box-shadow: 0 0 0 0 rgba(217,107,67,0); }
      }
      .td-head-streak { display: inline-flex; align-items: center; gap: .5rem; background: var(--accent-50); border: 1px solid var(--accent-300);
        border-radius: var(--r-pill); padding: .3rem .7rem .3rem .55rem; white-space: nowrap; }

      /* Living ring: a slow, calm breath while the day is still open. */
      .td-ring-wrap { transform-origin: center; animation: tdBreathe 6.5s ease-in-out infinite; }
      .td-ring-wrap.is-complete { animation: none; }
      @keyframes tdBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.022); } }
      .td-momentum { color: var(--accent-700); text-align: center; max-width: 15rem; }
      .td-momentum.is-complete { color: var(--sage); }
      .td-ritual.is-complete { background: linear-gradient(135deg, var(--paper), var(--gold-bg)); border-color: var(--gold); }
      .td-closed-band { padding: .7rem .9rem; border-radius: var(--r-md); background: var(--gold-bg); border: 1px solid var(--gold); animation: tdSparkIn .5s cubic-bezier(.22,1,.36,1); }

      /* First-time invitation. */
      .td-invite { border-color: var(--accent-300); background: linear-gradient(135deg, var(--paper), var(--accent-50)); }
      .td-invite-ic { width: 46px; height: 46px; border-radius: 14px; background: var(--accent-50); color: var(--accent-600); flex: none; }

      /* Quick actions. */
      .td-quick .kd-moodring__row { justify-content: space-between; }
      .td-chip { display: inline-flex; align-items: center; gap: .4rem; font-weight: 700; font-size: .9rem; color: var(--ink);
        background: var(--paper); border: 1.5px solid var(--line); border-radius: var(--r-pill); padding: .5rem .85rem; cursor: pointer;
        transition: transform .15s var(--ease), border-color .15s var(--ease), box-shadow .15s var(--ease), background .15s var(--ease); }
      .td-chip:hover { transform: translateY(-2px); border-color: var(--accent-300); box-shadow: var(--shadow-sm); background: var(--accent-50); }
      .td-chip:active { transform: translateY(0) scale(.96); }
      .td-chip .aria-orb { flex: none; }

      .td-ritual-grid { display: flex; align-items: center; gap: 1.6rem; }
      @media (max-width: 560px) { .td-ritual-grid { flex-direction: column; text-align: center; } .td-ritual-grid .dayring-legend { width: 100%; max-width: 260px; margin: 0 auto; } .td-ritual-grid .row.between { justify-content: center; } }
      .td-ritual-streak { display: inline-flex; align-items: center; gap: .3rem; font-weight: 800; font-size: .92rem; color: var(--accent-700);
        background: var(--accent-50); border: 1px solid var(--accent-300); border-radius: 999px; padding: .32rem .7rem; white-space: nowrap; font-variant-numeric: tabular-nums; }
      .td-ritual-streak svg { animation: tdFlicker 2.6s ease-in-out infinite; transform-origin: center bottom; }

      .td-spark { border-color: var(--gold); background: linear-gradient(135deg, var(--paper), var(--gold-bg)); animation: tdSparkIn .5s cubic-bezier(.22,1,.36,1); }
      @keyframes tdSparkIn { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }
      .td-spark-ic { width: 40px; height: 40px; border-radius: 13px; background: var(--gold-bg); color: var(--gold); display: grid; place-items: center; flex: none; animation: tdFlicker 2.4s ease-in-out infinite; }
      .td-reflect { animation: tdSparkIn .45s cubic-bezier(.22,1,.36,1); }

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
        .td-mood, .td-mood:hover, .td-mood:active, .td-flame, .td-mood.sel .td-emo, .td-mood:hover .td-emo,
        .td-move, .td-move.done, .td-check-pop, .td-streak, .td-spark, .td-spark-ic, .td-reflect, .td-ritual-streak svg,
        .td-page > *, .td-pulse, .td-ring-wrap, .td-closed-band, .td-chip, .td-chip:hover, .td-chip:active { animation: none !important; transition: none !important; transform: none !important; }
      }
    `}</style>
  );
}
