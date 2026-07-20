// Growth - the trophy room. Where a life visibly compounds: animated tallies,
// a milestones wall that celebrates the moment you cross a threshold, streaks
// with living flame, a warm "you are becoming" line synthesized from real data,
// and a wins timeline that feels good to scroll. Also where they can nudge
// Aria's coaching tone. Every flourish is reduced-motion aware.
import { useEffect, useRef, useState } from 'react';
import { Card, Stat, useToast, Badge, SectionHeader, shortDate } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import {
  useStore, domainMeta, setTone, TONES, moodTrend,
  ritualStreak, checkinStreak, reflectionStreak,
} from '../lib/store.js';
import { StreakFlame, MilestoneBurst } from '../components/Delight.jsx';
import { burstFrom } from '../lib/celebrate.js';
import { sTap, sChime, sCelebrate } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { track } from '../lib/track.js';

const SEEN_KEY = 'kindred_growth_badges_v1';

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* A number that counts up from 0 on mount. Under reduced motion it simply shows
   the final value. Eases out so the last digits land softly. */
function CountUp({ value = 0, duration = 1100, decimals = 0 }) {
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
  const shown = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString();
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{shown}</span>;
}

export default function Growth() {
  const profile = useStore(s => s.profile);
  const goals = useStore(s => s.goals);
  const wins = useStore(s => s.wins);
  const checkins = useStore(s => s.checkins);
  const reflections = useStore(s => s.reflections) || [];
  const toast = useToast();

  const [celebrateBadge, setCelebrateBadge] = useState(null);

  const active = goals.filter(g => g.status === 'active');
  const bestStreak = Math.max(0, ...goals.map(g => g.best || g.streak || 0));
  const daysIn = profile ? Math.max(1, Math.ceil((Date.now() - new Date(profile.createdAt).getTime()) / 86400000)) : 0;
  const mt = moodTrend(14);
  const timeline = [...wins].reverse();

  const rStreak = ritualStreak();
  const cStreak = checkinStreak();
  const refStreak = reflectionStreak();

  // Days truly closed (a morning check-in AND an evening reflection on the same
  // date) - the number the ritual is built on, counted honestly.
  const ciDates = new Set(checkins.map(c => c.date));
  const closedDays = reflections.filter(r => ciDates.has(r.date)).length;

  // The steadiest ground: the domain carrying the most streak momentum.
  const domainScore = {};
  for (const g of goals) domainScore[g.domainId] = (domainScore[g.domainId] || 0) + (g.best || 0) + (g.streak || 0);
  let topDomainId = null, topVal = 0;
  for (const [id, v] of Object.entries(domainScore)) { if (v > topVal) { topVal = v; topDomainId = id; } }
  const topDomainName = topDomainId
    ? (((profile?.domains) || []).find(d => d.id === topDomainId)?.name || topDomainId)
    : null;

  /* ---------- Milestones wall ---------- */
  const faithSet = !!(profile?.faith && profile.faith.opted);
  const badges = [
    { id: 'first-win', icon: '\u{1F31F}', title: 'First win', cur: wins.length, need: 1 },
    { id: 'first-checkin', icon: '\u{1F305}', title: 'First check-in', cur: checkins.length, need: 1 },
    { id: 'first-reflection', icon: '\u{1F4DD}', title: 'First reflection', cur: reflections.length, need: 1 },
    { id: 'first-streak', icon: '\u2705', title: 'First promise kept', cur: bestStreak, need: 1 },
    { id: 'faith-set', icon: '\u{1F54A}\uFE0F', title: 'Faith set', cur: faithSet ? 1 : 0, need: 1 },
    { id: 'ritual-first', icon: '\u{1F4AB}', title: 'First full day', cur: closedDays, need: 1 },
    { id: 'three-row', icon: '\u{1F525}', title: '3 in a row', cur: bestStreak, need: 3 },
    { id: 'week-in', icon: '\u{1F4C5}', title: 'One week in', cur: daysIn, need: 7 },
    { id: 'week-checkins', icon: '\u2600\uFE0F', title: '7 mornings', cur: checkins.length, need: 7 },
    { id: 'seven-reflections', icon: '\u{1F4D6}', title: '7 reflections', cur: reflections.length, need: 7 },
    { id: 'week-streak', icon: '\u{1F525}', title: '7 day streak', cur: bestStreak, need: 7 },
    { id: 'ritual-seven', icon: '\u2728', title: '7 full days', cur: closedDays, need: 7 },
    { id: 'ten-wins', icon: '\u{1F3C6}', title: '10 wins', cur: wins.length, need: 10 },
    { id: 'month-in', icon: '\u{1F5D3}\uFE0F', title: '30 days walking', cur: daysIn, need: 30 },
    { id: 'month-streak', icon: '\u{1F451}', title: '30 day streak', cur: bestStreak, need: 30 },
    { id: 'wins-25', icon: '\u{1F48E}', title: '25 wins', cur: wins.length, need: 25 },
  ].map(b => ({ ...b, earned: b.cur >= b.need }));

  const earnedCount = badges.filter(b => b.earned).length;
  const earnedIds = badges.filter(b => b.earned).map(b => b.id);
  const earnedKey = earnedIds.join(',');

  // Track a single Growth view on mount.
  useEffect(() => { track('growth_view'); }, []);

  // Celebrate any newly earned milestone once. First ever visit seeds the seen
  // set silently (so we never confetti-bomb a returning user for old wins);
  // after that, crossing a new threshold pops MilestoneBurst + sound + haptic.
  useEffect(() => {
    let seen = null;
    try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || 'null'); } catch { seen = null; }
    if (!Array.isArray(seen)) {
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(earnedIds)); } catch {}
      return;
    }
    const fresh = earnedIds.filter(id => !seen.includes(id));
    if (fresh.length) {
      const b = badges.find(x => x.id === fresh[fresh.length - 1]);
      if (b) {
        setCelebrateBadge(b);
        sCelebrate();
        haptic('celebrate');
        track('milestone_celebrated', { id: b.id });
      }
      try { localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(new Set([...seen, ...earnedIds])))); } catch {}
    }
  }, [earnedKey]); // eslint-disable-line

  const nudge = (t) => {
    sTap(); haptic('light');
    const r = setTone(t);
    if (r.error) return toast(r.message, 'warn');
    toast(`Heard. I will be ${TONES[t].line}.`);
  };

  const tapWin = (e) => { burstFrom(e, { count: 34, spread: 0.7 }); sChime(); haptic('light'); };

  // The "you are becoming" line, synthesized from their real numbers. Calm,
  // specific, never cheesy. Built from whatever is actually true for them.
  const becoming = (() => {
    const name = profile?.name;
    const parts = [];
    if (wins.length >= 1) parts.push(`${wins.length} ${wins.length === 1 ? 'win kept' : 'wins kept'}`);
    if (bestStreak >= 2) parts.push(`a best run of ${bestStreak} days`);
    if (closedDays >= 1) parts.push(`${closedDays} ${closedDays === 1 ? 'day' : 'days'} closed all the way`);
    const lead = name ? `${name}, ` : '';
    if (!parts.length) {
      return `${lead}this room fills as you live. The first win, the first kept promise, the first closed day - they all land right here, and you are closer to them than it feels.`;
    }
    const list = parts.length === 1 ? parts[0]
      : parts.slice(0, -1).join(', ') + ', and ' + parts[parts.length - 1];
    const ground = topDomainName ? ` Your steadiest ground is ${topDomainName}.` : '';
    return `${lead}look at the shape of it: ${list}.${ground} None of it was loud. It was you, showing up again and again. That is who you are becoming.`;
  })();

  const css = `
    .growthx .gx-rise { opacity: 0; animation: gxRise .6s var(--ease, cubic-bezier(.2,.7,.3,1)) forwards; }
    @keyframes gxRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

    .growthx .gx-hero {
      position: relative; overflow: hidden;
      background:
        radial-gradient(120% 140% at 12% 0%, var(--accent-50) 0%, transparent 60%),
        linear-gradient(180deg, var(--paper), var(--paper));
      border-color: var(--accent-300);
    }
    .growthx .gx-hero__glow {
      position: absolute; inset: -40% -20% auto auto; width: 320px; height: 320px;
      background: radial-gradient(circle, rgba(224,121,78,.16), transparent 68%);
      pointer-events: none; animation: gxDrift 9s ease-in-out infinite alternate;
    }
    @keyframes gxDrift { from { transform: translate(0,0); } to { transform: translate(-24px, 18px); } }

    .growthx .gx-progress {
      height: 8px; border-radius: var(--r-pill, 999px); background: var(--n-100);
      overflow: hidden; margin-top: .2rem;
    }
    .growthx .gx-progress > i {
      display: block; height: 100%; border-radius: inherit;
      background: linear-gradient(90deg, var(--accent-300), var(--accent-600));
      width: 0; animation: gxFill 1.1s var(--ease, ease-out) forwards;
    }
    @keyframes gxFill { to { width: var(--w, 0%); } }

    .growthx .gx-flames { display: grid; grid-template-columns: repeat(3, 1fr); gap: .7rem; }
    .growthx .gx-flame {
      display: flex; flex-direction: column; align-items: center; gap: .35rem;
      padding: 1rem .5rem; border-radius: var(--r-md, 14px);
      background: var(--n-50, var(--accent-50)); border: 1px solid var(--line);
      text-align: center;
    }
    .growthx .gx-flame--on { background: var(--accent-50); border-color: var(--accent-300); }
    .growthx .gx-flame__n { font-size: 1.55rem; font-weight: 750; line-height: 1; font-variant-numeric: tabular-nums; }

    .growthx .gx-badges {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: .7rem;
    }
    .growthx .gx-badge {
      position: relative; display: flex; flex-direction: column; align-items: center; gap: .35rem;
      padding: .95rem .5rem .8rem; border-radius: var(--r-md, 14px); text-align: center;
      border: 1px solid var(--line); background: var(--paper); min-height: 116px;
      justify-content: center;
    }
    .growthx .gx-badge--on {
      background: linear-gradient(180deg, var(--accent-50), var(--paper));
      border-color: var(--accent-300);
      box-shadow: 0 2px 10px rgba(224,121,78,.10);
    }
    .growthx .gx-badge--off { border-style: dashed; opacity: .7; }
    .growthx .gx-badge__ico { font-size: 1.7rem; line-height: 1; filter: none; }
    .growthx .gx-badge--off .gx-badge__ico { filter: grayscale(1); opacity: .5; }
    .growthx .gx-badge__title { font-size: .78rem; font-weight: 650; line-height: 1.15; }
    .growthx .gx-badge__hint { font-size: .68rem; }
    .growthx .gx-badge--on .gx-badge__check {
      position: absolute; top: 6px; right: 6px; width: 18px; height: 18px; border-radius: 50%;
      background: var(--accent-600); color: #fff; display: grid; place-items: center;
    }
    .growthx .gx-badge--pop { animation: gxPop .5s var(--ease, cubic-bezier(.2,.8,.3,1.2)) both; }
    @keyframes gxPop { 0% { transform: scale(.9); } 60% { transform: scale(1.05); } 100% { transform: scale(1); } }

    .growthx .gx-win {
      display: flex; align-items: flex-start; gap: .75rem; width: 100%; text-align: left;
      background: none; border: none; border-left: 3px solid var(--line);
      padding: .7rem .3rem .7rem .8rem; cursor: pointer; border-radius: 0 10px 10px 0;
      transition: background .18s var(--ease, ease), transform .12s var(--ease, ease);
    }
    .growthx .gx-win:hover { background: var(--accent-50); }
    .growthx .gx-win:active { transform: scale(.99); }
    .growthx .gx-win + .gx-win { border-top: 1px solid var(--line); }

    @media (prefers-reduced-motion: reduce) {
      .growthx .gx-rise { opacity: 1; animation: none; transform: none; }
      .growthx .gx-hero__glow { animation: none; }
      .growthx .gx-progress > i { animation: none; width: var(--w, 0%); }
      .growthx .gx-badge--pop { animation: none; }
    }
  `;

  return (
    <div className="col gap-3 growthx">
      <style>{css}</style>

      <SectionHeader eyebrow="Growth" title="Look how far, honestly"
        sub="Every rep, win, and word you gave this life is kept here." />

      {/* You are becoming */}
      <Card className="card-pad gx-hero gx-rise">
        <div className="gx-hero__glow" aria-hidden />
        <div className="row gap-2" style={{ alignItems: 'center', marginBottom: '.5rem' }}>
          <span className="row center" style={{ width: 40, height: 40, borderRadius: 13, background: 'var(--accent-50)', color: 'var(--accent-600)', flex: 'none' }}>
            <Icon name="sparkles" size={22} />
          </span>
          <span className="eyebrow">You are becoming</span>
        </div>
        <p className="serif" style={{ fontSize: '1.18rem', lineHeight: 1.55, margin: 0 }}>{becoming}</p>
      </Card>

      {/* Animated tallies */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))' }}>
        <div className="gx-rise" style={{ animationDelay: '.04s' }}><Stat label="Wins on the board" value={<CountUp value={wins.length} />} icon="trophy" /></div>
        <div className="gx-rise" style={{ animationDelay: '.08s' }}><Stat label="Best streak" value={<CountUp value={bestStreak} />} sub="reps in a row" icon="flame" /></div>
        <div className="gx-rise" style={{ animationDelay: '.12s' }}><Stat label="Days walking with Aria" value={<CountUp value={daysIn} />} icon="calendar" /></div>
        <div className="gx-rise" style={{ animationDelay: '.16s' }}><Stat label="Days closed all the way" value={<CountUp value={closedDays} />} sub="check in plus reflect" icon="check" /></div>
        <div className="gx-rise" style={{ animationDelay: '.20s' }}><Stat label="Reflections written" value={<CountUp value={reflections.length} />} icon="quote" /></div>
        <div className="gx-rise" style={{ animationDelay: '.24s' }}><Stat label="Mornings checked in" value={<CountUp value={checkins.length} />} icon="sun" /></div>
        <div className="gx-rise" style={{ animationDelay: '.28s' }}><Stat label="Milestones earned" value={<CountUp value={earnedCount} />} sub={`of ${badges.length}`} icon="target" /></div>
        <div className="gx-rise" style={{ animationDelay: '.32s' }}><Stat label="Mood, last 14 days" value={mt ? mt.avg : '-'} sub={mt ? `${mt.count} check-ins` : 'no check-ins yet'} icon="smile" /></div>
      </div>

      {/* Streak showcase */}
      <Card className="card-pad gx-rise" style={{ animationDelay: '.1s' }}>
        <div className="row between" style={{ alignItems: 'center', marginBottom: '.9rem' }}>
          <h3 style={{ margin: 0 }}>Streaks alive right now</h3>
          <Badge tone="accent"><Icon name="flame" size={13} /> keep them lit</Badge>
        </div>
        <div className="gx-flames">
          <div className={`gx-flame ${rStreak > 0 ? 'gx-flame--on' : ''}`}>
            <StreakFlame count={rStreak} size={40} showCount={false} />
            <span className="gx-flame__n">{rStreak}</span>
            <span className="muted t-xs fw-6">Full days in a row</span>
          </div>
          <div className={`gx-flame ${cStreak > 0 ? 'gx-flame--on' : ''}`}>
            <StreakFlame count={cStreak} size={40} showCount={false} />
            <span className="gx-flame__n">{cStreak}</span>
            <span className="muted t-xs fw-6">Mornings in a row</span>
          </div>
          <div className={`gx-flame ${refStreak > 0 ? 'gx-flame--on' : ''}`}>
            <StreakFlame count={refStreak} size={40} showCount={false} />
            <span className="gx-flame__n">{refStreak}</span>
            <span className="muted t-xs fw-6">Reflections in a row</span>
          </div>
        </div>
        {rStreak === 0 && cStreak === 0 && refStreak === 0 && (
          <p className="muted t-sm" style={{ marginTop: '.9rem', marginBottom: 0 }}>No live streaks yet. Check in this morning and reflect tonight to light the first one.</p>
        )}
      </Card>

      {/* Milestones wall */}
      <Card className="card-pad gx-rise" style={{ animationDelay: '.14s' }}>
        <div className="row between" style={{ alignItems: 'baseline', marginBottom: '.9rem' }}>
          <h3 style={{ margin: 0 }}>Milestones</h3>
          <span className="muted t-sm fw-6">{earnedCount} of {badges.length} earned</span>
        </div>
        <div className="gx-badges">
          {badges.map(b => {
            const pct = Math.min(100, Math.round((b.cur / b.need) * 100));
            const isCel = celebrateBadge && celebrateBadge.id === b.id;
            return (
              <div key={b.id}
                className={`gx-badge ${b.earned ? 'gx-badge--on' : 'gx-badge--off'} ${isCel ? 'gx-badge--pop' : ''}`}
                title={b.earned ? `${b.title} - earned` : `${b.title} - ${b.cur}/${b.need}`}>
                {b.earned && <span className="gx-badge__check"><Icon name="check" size={12} /></span>}
                <span className="gx-badge__ico" aria-hidden>{b.icon}</span>
                <span className="gx-badge__title">{b.title}</span>
                {b.earned
                  ? <span className="gx-badge__hint muted">Earned</span>
                  : <span className="gx-badge__hint muted">{b.cur}/{b.need}</span>}
                {!b.earned && (
                  <div className="gx-progress" style={{ width: '80%' }} aria-hidden>
                    <i style={{ '--w': `${pct}%` }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <Card className="card-pad gx-rise" style={{ animationDelay: '.16s' }}>
          <h3 style={{ marginBottom: '.9rem' }}>The book of wins</h3>
          {timeline.length === 0 ? (
            <p className="muted">Wins land here as you live them. The first one is one done goal away.</p>
          ) : (
            <div className="col" style={{ gap: 0 }}>
              {timeline.map((w, i) => {
                const m = domainMeta(w.domainId);
                return (
                  <button key={w.id} type="button" onClick={tapWin}
                    className="gx-win gx-rise"
                    style={{ borderLeftColor: m.color, animationDelay: `${Math.min(i * 0.05, 0.5)}s` }}>
                    <span className="row center" style={{ width: 36, height: 36, borderRadius: 11, background: m.bg, fontSize: '1.05rem', flex: 'none' }}>{m.emoji}</span>
                    <span className="col" style={{ gap: '.1rem', minWidth: 0, flex: 1 }}>
                      <span className="fw-6">{w.title}</span>
                      {w.detail && <span className="muted t-sm">{w.detail}</span>}
                    </span>
                    <span className="muted t-xs" style={{ flexShrink: 0, paddingTop: '.15rem' }}>{shortDate(w.at)}</span>
                  </button>
                );
              })}
            </div>
          )}
          {timeline.length > 0 && (
            <p className="muted t-xs" style={{ marginTop: '.8rem', marginBottom: 0 }}>Tap any win to feel it again.</p>
          )}
        </Card>

        <div className="col gap-2">
          <Card className="card-pad gx-rise" style={{ animationDelay: '.2s' }}>
            <h3 style={{ marginBottom: '.5rem' }}>Live goal streaks</h3>
            {active.filter(g => g.streak > 0).length === 0 ? (
              <p className="muted t-sm">No live streaks right now. One done goal starts one.</p>
            ) : (
              <div className="col gap-1">
                {active.filter(g => g.streak > 0).sort((a, b) => b.streak - a.streak).map(g => (
                  <div key={g.id} className="row gap-2 panel" style={{ padding: '.6rem .8rem', alignItems: 'center' }}>
                    <StreakFlame count={g.streak} size={26} showCount={false} />
                    <span className="clip t-sm fw-6" style={{ flex: 1, minWidth: 0 }}>{g.title}</span>
                    <Badge tone="accent">{g.streak}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="card-pad gx-rise" style={{ animationDelay: '.24s', background: 'var(--accent-50)', borderColor: 'var(--accent-300)' }}>
            <h3 style={{ marginBottom: '.35rem' }}>How Aria walks with you</h3>
            <p className="t-sm" style={{ marginBottom: '.8rem' }}>{profile?.toneWhy}</p>
            <div className="row gap-1 wrap">
              {Object.entries(TONES).map(([k, v]) => (
                <button key={k} onClick={() => nudge(k)}
                  className="badge" style={{
                    cursor: 'pointer', border: profile?.tone === k ? '2px solid var(--accent)' : '1.5px solid var(--line-strong)',
                    background: profile?.tone === k ? 'var(--paper)' : 'transparent', padding: '.45rem .8rem', fontSize: '.9rem',
                  }}>
                  {v.name}
                </button>
              ))}
            </div>
            {profile?.belief && (
              <p className="serif" style={{ fontStyle: 'italic', marginTop: '.9rem', fontSize: '1.05rem' }}>"{profile.belief}"</p>
            )}
          </Card>
        </div>
      </div>

      <MilestoneBurst
        show={celebrateBadge ? celebrateBadge.icon : null}
        label={celebrateBadge ? celebrateBadge.title : ''}
        sublabel={celebrateBadge ? 'Milestone earned' : ''}
        onDone={() => setCelebrateBadge(null)}
      />
    </div>
  );
}
