// Runs a single tool by id. Generators use the shared FeatureRunner; trackers
// render a live view computed from the user's real data. Also handles saved
// creations at /tools/saved/:id.
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Card, Button, Ring, useToast } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import FeatureRunner from '../components/FeatureRunner.jsx';
import BalanceOrbit from '../components/BalanceOrbit.jsx';
import { mdToHtml } from '../lib/markdown.js';
import { getFeature } from '../lib/features.js';
import {
  useStore, getCreation, deleteCreation, lifeBalance, domainMeta,
  getPeople, peopleNeedingTouch, moodTrend, getGoals, getWins, getCheckins,
} from '../lib/store.js';

// Warm per-area tint, matched to the gallery so a tool looks the same on its
// own page as on its card.
const CAT_TINT = {
  'Health and Fitness':      { c: 'var(--sage)', bg: 'var(--sage-bg)' },
  'Relationships':           { c: 'var(--rose)', bg: 'var(--rose-bg)' },
  'Mental and Spiritual':    { c: 'var(--sky)',  bg: 'var(--sky-bg)' },
  'Productivity and Growth': { c: 'var(--gold)', bg: 'var(--gold-bg)' },
  'Practical Daily Life':    { c: 'var(--accent-700)', bg: 'var(--accent-50)' },
  'Advanced and Unique':     { c: 'var(--rose)', bg: 'var(--rose-bg)' },
  'Output and Tools':        { c: 'var(--sage)', bg: 'var(--sage-bg)' },
};
const tint = (cat) => CAT_TINT[cat] || { c: 'var(--accent-700)', bg: 'var(--accent-50)' };

function Back() {
  return <Link to="/tools" className="row gap-1 muted ui" style={{ fontSize: '.92rem', marginBottom: '1rem', textDecoration: 'none' }}><Icon name="compass" size={15} /> All tools</Link>;
}

function scoreColor(s) { return s >= 70 ? 'var(--sage)' : s >= 40 ? 'var(--gold)' : 'var(--rose)'; }

// Warm, useful fallback for trackers that grow with use: instead of a dead end,
// point people at the exact places that feed the view.
function GrowingTracker({ feature }) {
  const feeds = [
    { icon: 'smile', label: 'Check in on Today', to: '/today', why: 'mood and daily rhythm' },
    { icon: 'target', label: 'Set a goal in Paths', to: '/paths', why: 'momentum to measure' },
    { icon: 'users', label: 'Add your people', to: '/people', why: 'relationships to track' },
  ];
  return (
    <Card pad={24}>
      <div className="row gap-2" style={{ alignItems: 'center', marginBottom: '.4rem' }}>
        <span className="row center floaty" style={{ width: 48, height: 48, borderRadius: 14, background: tint(feature.category).bg, color: tint(feature.category).c, flex: 'none' }}>
          <Icon name={feature.icon || 'sparkles'} size={24} />
        </span>
        <h2 style={{ margin: 0 }}>{feature.title}</h2>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{feature.blurb}</p>
      <p>This one gets richer the more you use Kindred. Here is what feeds it:</p>
      <div className="col gap-1" style={{ marginTop: '.4rem' }}>
        {feeds.map(f => (
          <Link key={f.to} to={f.to} className="k-dom-card" style={{ textDecoration: 'none' }}>
            <span className="row center" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--accent-50)', color: 'var(--accent-700)', flex: 'none' }}><Icon name={f.icon} size={19} /></span>
            <div className="col" style={{ minWidth: 0, gap: '.1rem' }}>
              <span className="fw-6">{f.label}</span>
              <span className="muted t-xs">Gives it {f.why}</span>
            </div>
            <span style={{ marginLeft: 'auto', color: 'var(--accent-600)' }}><Icon name="arrowRight" size={17} /></span>
          </Link>
        ))}
      </div>
    </Card>
  );
}

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

  // Honest, useful fallback for trackers that grow with use.
  return <GrowingTracker feature={feature} />;
}

export default function ToolPage() {
  const { id, sub } = useParams();
  const nav = useNavigate();
  const toast = useToast();

  // Saved creation view (route /tools/saved/:sub).
  if (sub) {
    const c = getCreation(sub);
    if (!c) {
      return (
        <div>
          <Back />
          <Card style={{ textAlign: 'center', padding: '2.6rem 1.5rem' }}>
            <span className="row center floaty" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--accent-50)', color: 'var(--accent-600)', margin: '0 auto 1rem' }}>
              <Icon name="book" size={26} />
            </span>
            <h3 style={{ marginBottom: '.45rem' }}>That creation is gone</h3>
            <p className="muted" style={{ maxWidth: 380, margin: '0 auto 1.2rem' }}>It may have been deleted. You can always make a fresh one.</p>
            <Link className="btn btn-primary" to="/tools">Back to tools</Link>
          </Card>
        </div>
      );
    }
    const copy = async () => {
      try { await navigator.clipboard.writeText(c.markdown || ''); toast('Copied to clipboard.', 'ok'); }
      catch { toast('Could not copy here. Try Print instead.', 'warn'); }
    };
    return (
      <div>
        <div className="row between wrap no-print" style={{ marginBottom: '1rem' }}>
          <Back />
          <div className="row gap-2 wrap">
            <Button variant="ghost" onClick={copy}><Icon name="quote" size={16} /> Copy</Button>
            <Button variant="ghost" onClick={() => window.print()}><Icon name="book" size={16} /> Print</Button>
            <Button variant="ghost" onClick={() => { deleteCreation(c.id); toast('Deleted.', 'ok'); nav('/tools'); }} style={{ color: 'var(--rose)' }}><Icon name="x" size={16} /> Delete</Button>
          </div>
        </div>
        <Card pad={26} className="printable">
          <div className="row gap-2" style={{ alignItems: 'center', marginBottom: '.5rem' }}>
            <span className="aria-orb" style={{ width: 30, height: 30 }} aria-hidden />
            <h2 className="serif" style={{ margin: 0 }}>{c.title}</h2>
          </div>
          <span className="muted t-xs no-print" style={{ display: 'block', marginBottom: '.6rem' }}>Saved {new Date(c.at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(c.markdown) }} />
        </Card>
      </div>
    );
  }

  const feature = getFeature(id);
  if (!feature) {
    return (
      <div>
        <Back />
        <Card style={{ textAlign: 'center', padding: '2.6rem 1.5rem' }}>
          <span className="row center floaty" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--accent-50)', color: 'var(--accent-600)', margin: '0 auto 1rem' }}>
            <Icon name="compass" size={26} />
          </span>
          <h3 style={{ marginBottom: '.45rem' }}>That tool does not exist</h3>
          <p className="muted" style={{ maxWidth: 380, margin: '0 auto 1.2rem' }}>It may have moved. Browse the full set instead.</p>
          <Link className="btn btn-primary" to="/tools">See all 50 tools</Link>
        </Card>
      </div>
    );
  }

  const t = tint(feature.category);
  return (
    <div>
      <Back />
      <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
        <span className="row center" style={{ width: 52, height: 52, borderRadius: 15, background: t.bg, color: t.c, flex: 'none', marginTop: '.15rem' }}>
          <Icon name={feature.icon || 'sparkles'} size={26} />
        </span>
        <div className="col" style={{ gap: '.3rem', minWidth: 0 }}>
          <span className="eyebrow">{feature.category}</span>
          <h2 style={{ margin: 0 }}>{feature.title}</h2>
          <span className="muted" style={{ fontSize: '1rem' }}>{feature.blurb}</span>
        </div>
      </div>
      <div style={{ marginTop: '1.2rem' }}>
        {feature.type === 'tracker' ? <Tracker feature={feature} /> : <FeatureRunner feature={feature} />}
      </div>
    </div>
  );
}
