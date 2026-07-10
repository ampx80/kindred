// One path (domain) up close: its goals with streaks and history, pause and
// finish controls. Reads its id from the router param (useParams) ONLY.
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Card, Badge, Button, Ring, useToast, EmptyState, daysAgo } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { celebrate } from '../lib/celebrate.js';
import { useStore, domainMeta, goalsForDomain, markGoalDone, setGoalStatus, isGoalDueToday } from '../lib/store.js';

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

  const done = (g) => {
    const r = markGoalDone(g.id);
    if (r.error) return toast(r.message, 'warn');
    if (r.milestone) { celebrate({ count: 140 }); toast(`${r.milestone} in a row. Milestone.`); }
    else { celebrate({ count: 55, y: window.innerHeight * .5 }); toast('Counted.'); }
  };

  return (
    <div className="col gap-3">
      <button className="link row gap-1" style={{ background: 'none', border: 'none', alignSelf: 'flex-start' }} onClick={() => nav(-1)}>
        <Icon name="chevronLeft" size={16} /> Back
      </button>

      <Card className="card-pad row gap-2" style={{ alignItems: 'flex-start' }}>
        <span className="row center" style={{ width: 56, height: 56, borderRadius: 16, background: m.bg, fontSize: '1.7rem', flex: 'none' }}>{m.emoji}</span>
        <div className="col" style={{ gap: '.25rem', minWidth: 0 }}>
          <h1 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)' }}>{domain.name}</h1>
          {domain.why && <p className="muted">{domain.why}</p>}
        </div>
      </Card>

      {active.length === 0 && rest.length === 0 ? (
        <EmptyState icon="target" title="No goals on this path yet"
          body="Ask Aria for a first step, or add one from the Paths screen. Small enough to do this week."
          action={<Button as={Link} to="/paths">Back to paths</Button>} />
      ) : (
        <div className="col gap-2 stagger">
          {active.map(g => {
            const target = g.cadence === 'daily' ? 7 : 4;
            return (
              <Card key={g.id} className="card-pad row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Ring value={Math.min(1, g.streak / target)} size={62} label={g.streak} color={m.color} />
                <div className="col" style={{ gap: '.2rem', minWidth: 0, flex: 1 }}>
                  <span className="fw-7" style={{ fontSize: '1.06rem' }}>{g.title}</span>
                  {g.why && <span className="muted t-sm">{g.why}</span>}
                  <span className="row gap-1 wrap" style={{ alignItems: 'center' }}>
                    <span className="muted t-xs">{g.cadence} · best {g.best || g.streak} · last {daysAgo(g.lastDoneAt) || 'never'}</span>
                  </span>
                </div>
                <div className="row gap-1 wrap">
                  {isGoalDueToday(g) ? (
                    <Button size="sm" onClick={() => done(g)}><Icon name="check" size={15} /> Done today</Button>
                  ) : (
                    <Badge tone="ok"><Icon name="check" size={13} /> counted</Badge>
                  )}
                  <Button size="sm" variant="quiet" title="Pause this goal" onClick={() => { setGoalStatus(g.id, 'paused'); toast('Paused. It will wait for you.'); }}>Pause</Button>
                  <Button size="sm" variant="quiet" title="Mark finished for good" onClick={() => { setGoalStatus(g.id, 'done'); celebrate({ count: 120 }); toast('Finished. That one is yours forever.'); }}>Finish</Button>
                </div>
              </Card>
            );
          })}
          {rest.map(g => (
            <Card key={g.id} className="card-pad row gap-2" style={{ alignItems: 'center', opacity: .75 }}>
              <Badge tone={g.status === 'done' ? 'ok' : 'warn'}>{g.status === 'done' ? 'finished' : 'paused'}</Badge>
              <span className="fw-6 clip" style={{ flex: 1 }}>{g.title}</span>
              {g.status === 'paused' && <Button size="sm" variant="ghost" onClick={() => { setGoalStatus(g.id, 'active'); toast('Back on the board.'); }}>Resume</Button>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
