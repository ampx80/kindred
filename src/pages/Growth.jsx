// Growth - the trophy case. Streaks, milestones, their own words, how far
// they have come. Also where they can nudge Aria's coaching tone.
import { Card, Stat, useToast, Badge, SectionHeader, shortDate } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { useStore, domainMeta, setTone, TONES, moodTrend } from '../lib/store.js';

export default function Growth() {
  const profile = useStore(s => s.profile);
  const goals = useStore(s => s.goals);
  const wins = useStore(s => s.wins);
  const checkins = useStore(s => s.checkins);
  const toast = useToast();

  const active = goals.filter(g => g.status === 'active');
  const bestStreak = Math.max(0, ...goals.map(g => g.best || g.streak || 0));
  const daysIn = profile ? Math.max(1, Math.ceil((Date.now() - new Date(profile.createdAt).getTime()) / 86400000)) : 0;
  const mt = moodTrend(14);
  const timeline = [...wins].reverse();

  const nudge = (t) => {
    const r = setTone(t);
    if (r.error) return toast(r.message, 'warn');
    toast(`Heard. I will be ${TONES[t].line}.`);
  };

  return (
    <div className="col gap-3">
      <SectionHeader eyebrow="Growth" title="Look how far, honestly"
        sub="Every rep, win, and word you gave this life is kept here." />

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <Stat label="Days walking with Aria" value={daysIn} icon="calendar" />
        <Stat label="Wins on the board" value={wins.length} icon="trophy" />
        <Stat label="Best streak" value={bestStreak} sub="reps in a row" icon="flame" />
        <Stat label="Mood, last 14 days" value={mt ? mt.avg : '-'} sub={mt ? `${mt.count} check-ins` : 'no check-ins yet'} icon="smile" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <Card className="card-pad">
          <h3 style={{ marginBottom: '.9rem' }}>The book of wins</h3>
          {timeline.length === 0 ? (
            <p className="muted">Wins land here as you live them. The first one is one done goal away.</p>
          ) : (
            <div className="col" style={{ gap: 0 }}>
              {timeline.map((w, i) => {
                const m = domainMeta(w.domainId);
                return (
                  <div key={w.id} className="row gap-2" style={{ alignItems: 'flex-start', padding: '.7rem 0', borderBottom: i < timeline.length - 1 ? '1px solid var(--line)' : 'none' }}>
                    <span className="row center" style={{ width: 36, height: 36, borderRadius: 11, background: m.bg, fontSize: '1.05rem', flex: 'none' }}>{m.emoji}</span>
                    <div className="col" style={{ gap: '.1rem', minWidth: 0, flex: 1 }}>
                      <span className="fw-6">{w.title}</span>
                      {w.detail && <span className="muted t-sm">{w.detail}</span>}
                    </div>
                    <span className="muted t-xs" style={{ flexShrink: 0 }}>{shortDate(w.at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="col gap-2">
          <Card className="card-pad">
            <h3 style={{ marginBottom: '.5rem' }}>Live streaks</h3>
            {active.filter(g => g.streak > 0).length === 0 ? (
              <p className="muted t-sm">No live streaks right now. One done goal starts one.</p>
            ) : (
              <div className="col gap-1">
                {active.filter(g => g.streak > 0).sort((a, b) => b.streak - a.streak).map(g => (
                  <div key={g.id} className="row gap-2 panel" style={{ padding: '.65rem .9rem' }}>
                    <Badge tone="accent"><Icon name="flame" size={13} /> {g.streak}</Badge>
                    <span className="clip t-sm fw-6" style={{ flex: 1 }}>{g.title}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="card-pad" style={{ background: 'var(--accent-50)', borderColor: 'var(--accent-300)' }}>
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
    </div>
  );
}
