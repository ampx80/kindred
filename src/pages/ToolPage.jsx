// Runs a single tool by id. Generators use the shared FeatureRunner; trackers
// render a live view computed from the user's real data. Also handles saved
// creations at /tools/saved/:id.
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, Button, SectionHeader, Ring, useToast } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import FeatureRunner from '../components/FeatureRunner.jsx';
import BalanceOrbit from '../components/BalanceOrbit.jsx';
import { mdToHtml } from '../lib/markdown.js';
import { getFeature } from '../lib/features.js';
import {
  useStore, getCreation, deleteCreation, lifeBalance, domainMeta,
  getPeople, peopleNeedingTouch, moodTrend, getGoals, getWins, getCheckins,
} from '../lib/store.js';

function Back() {
  return <Link to="/tools" className="row gap-1 muted ui" style={{ fontSize: '.92rem', marginBottom: '1rem', textDecoration: 'none' }}><Icon name="compass" size={15} /> All tools</Link>;
}

function scoreColor(s) { return s >= 70 ? 'var(--sage)' : s >= 40 ? 'var(--gold)' : 'var(--rose)'; }

function Tracker({ feature }) {
  useStore(s => s.goals); useStore(s => s.checkins); useStore(s => s.people); useStore(s => s.profile);
  const id = feature.id;

  if (/balance/.test(id)) {
    const lb = lifeBalance();
    return (
      <div className="col gap-3">
        <Card pad={24}>
          <div className="k-balance">
            <BalanceOrbit perDomain={lb.perDomain} overall={lb.overall} />
            <div className="col" style={{ gap: '.9rem', minWidth: 0 }}>
              <div className="col" style={{ gap: '.3rem' }}>
                <span className="eyebrow">Life balance</span>
                <h2 style={{ margin: 0 }}>Your life balance is {lb.overall >= 70 ? 'strong' : lb.overall >= 40 ? 'finding its footing' : 'asking for attention'}</h2>
                <p className="muted" style={{ margin: '.2rem 0 0' }}>A real number from how you are actually showing up across the areas you said matter, plus how you have been feeling. It moves as you do.</p>
              </div>
              <div className="col gap-1">
                {lb.perDomain.map(d => (
                  <div key={d.id} className="k-dom-card">
                    <Ring value={d.score / 100} size={46} color={scoreColor(d.score)} label={`${d.score}`} />
                    <div className="col" style={{ minWidth: 0, gap: '.1rem' }}>
                      <span className="fw-6 clip">{domainMeta(d.id).emoji} {d.name}</span>
                      <span className="muted t-xs">{d.score >= 70 ? 'thriving' : d.score >= 40 ? 'coming along' : 'wants a little attention'}</span>
                    </div>
                  </div>
                ))}
                {!lb.perDomain.length && <p className="muted" style={{ margin: 0 }}>Add a goal or two in your paths and this fills in fast.</p>}
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (/dashboard/.test(id)) {
    const goals = getGoals().filter(g => g.status === 'active');
    const wins = getWins(); const mt = moodTrend(7); const need = peopleNeedingTouch();
    return (
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(210px,1fr))', gap: '1rem' }}>
        {[['Active goals', goals.length, '/paths'], ['Wins logged', wins.length, '/growth'], ['People to reach', need.length, '/people'], ['Mood (7 day)', mt ? mt.avg + '/5' : '-', '/today']].map(([label, val, to]) => (
          <Link key={label} to={to} className="panel" style={{ padding: '1.1rem', textDecoration: 'none' }}>
            <div className="stat-value" style={{ fontSize: '2.2rem' }}>{val}</div>
            <div className="muted t-sm">{label}</div>
          </Link>
        ))}
      </div>
    );
  }

  if (/relationship|friend/.test(id)) {
    const people = getPeople().map(p => {
      const days = p.lastTouch ? Math.floor((Date.now() - new Date(p.lastTouch).getTime()) / 86400000) : 999;
      const score = days > 60 ? 25 : days > 30 ? 50 : days > 14 ? 70 : 90;
      return { ...p, days, score };
    }).sort((a, b) => a.score - b.score);
    return (
      <div className="col gap-2">
        {people.length === 0 && <Card pad={20}><p className="muted" style={{ margin: 0 }}>Add the people who matter in <Link className="link" to="/people">your people</Link> and this scores each relationship by how you are keeping in touch.</p></Card>}
        {people.map(p => (
          <Card key={p.id} pad={16}>
            <div className="row between gap-2" style={{ alignItems: 'center' }}>
              <div className="col" style={{ minWidth: 0 }}><span className="fw-6 clip">{p.name}</span><span className="muted t-sm">{p.lastTouch ? `${p.days} days since you connected` : 'no contact logged yet'}</span></div>
              <div className="row gap-2" style={{ alignItems: 'center' }}>
                <span className="fw-7" style={{ color: scoreColor(p.score) }}>{p.score}</span>
                <Link className="btn btn-ghost btn-sm" to={`/people/${p.id}`}>Open</Link>
              </div>
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (/emotional|pattern/.test(id)) {
    const checks = getCheckins().slice(-14);
    const mt = moodTrend(14);
    return (
      <Card pad={22}>
        <h2 style={{ marginTop: 0 }}>Your emotional weather</h2>
        {mt ? <p className="muted">Over your last {mt.count} check-ins, your mood has averaged {mt.avg} out of 5. Keep checking in on Today and Aria will start naming the patterns she sees, gently and early.</p>
          : <p className="muted">Check in on how you feel a few times on the <Link className="link" to="/today">Today screen</Link>, and your patterns will show up here.</p>}
        <div className="row gap-1 wrap" style={{ marginTop: '.8rem' }}>
          {checks.map(c => <span key={c.id} title={c.date} style={{ width: 26, height: 26, borderRadius: 6, background: ['', 'var(--rose)', 'var(--gold)', 'var(--sky)', 'var(--sage)', 'var(--sage)'][c.mood] || 'var(--line)', opacity: .8 }} />)}
        </div>
      </Card>
    );
  }

  // Honest fallback for trackers that grow with use.
  return (
    <Card pad={22}>
      <h2 style={{ marginTop: 0 }}>{feature.title}</h2>
      <p className="muted">{feature.blurb}</p>
      <p>This tracker grows as you use Kindred. The more you check in, set goals, and talk with Aria, the more it has to show you. Start on your <Link className="link" to="/today">Today screen</Link> or ask Aria directly.</p>
    </Card>
  );
}

export default function ToolPage() {
  const { id, sub } = useParams();
  const nav = useNavigate();
  const toast = useToast();

  // Saved creation view (route /tools/saved/:sub).
  if (sub) {
    const c = getCreation(sub);
    if (!c) return <div><Back /><Card pad={22}><p className="muted">That creation is gone.</p></Card></div>;
    return (
      <div>
        <div className="row between wrap no-print" style={{ marginBottom: '1rem' }}>
          <Back />
          <div className="row gap-2">
            <Button variant="ghost" onClick={() => window.print()}><Icon name="book" size={16} /> Print</Button>
            <Button variant="ghost" onClick={() => { deleteCreation(c.id); toast('Deleted.', 'ok'); nav('/tools'); }} style={{ color: 'var(--rose)' }}><Icon name="x" size={16} /> Delete</Button>
          </div>
        </div>
        <Card pad={26} className="printable">
          <h2 className="serif" style={{ marginTop: 0 }}>{c.title}</h2>
          <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(c.markdown) }} />
        </Card>
      </div>
    );
  }

  const feature = getFeature(id);
  if (!feature) return <div><Back /><Card pad={22}><p className="muted">That tool does not exist.</p></Card></div>;

  return (
    <div>
      <Back />
      <SectionHeader eyebrow={feature.category} title={feature.title} sub={feature.blurb} />
      <div style={{ marginTop: '1.2rem' }}>
        {feature.type === 'tracker' ? <Tracker feature={feature} /> : <FeatureRunner feature={feature} />}
      </div>
    </div>
  );
}
