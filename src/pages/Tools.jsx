// The Tools hub - all 50 life-companion tools, grouped by area. Generators open
// the FeatureRunner; trackers open their live view. Saved creations surface here
// too so nothing you make gets lost.
import { Link } from 'react-router-dom';
import { Card, SectionHeader, Badge } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { useStore } from '../lib/store.js';
import { FEATURES, FEATURE_CATEGORIES } from '../lib/features.js';

const CAT_EMOJI = {
  'Health and Fitness': '💪', 'Relationships': '🤝', 'Mental and Spiritual': '🕊️',
  'Productivity and Growth': '🧭', 'Practical Daily Life': '🏡', 'Advanced and Unique': '✨', 'Output and Tools': '🖨️',
};

export default function Tools() {
  const creations = useStore(s => s.creations) || [];
  return (
    <div className="stack-lg">
      <SectionHeader eyebrow="Your tools" title="50 ways Aria can help, made for you"
        sub="Every tool is shaped around what Aria already knows about your life. Make it, save it, print it." />

      {creations.length > 0 && (
        <Card pad={20}>
          <div className="row between" style={{ marginBottom: '.7rem' }}>
            <h3 style={{ margin: 0 }}>Your creations</h3><Badge tone="accent">{creations.length}</Badge>
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))', gap: '.7rem' }}>
            {creations.slice(0, 6).map(c => (
              <Link key={c.id} to={`/tools/saved/${c.id}`} className="panel" style={{ padding: '.8rem .9rem', textDecoration: 'none' }}>
                <span className="fw-6 clip" style={{ display: 'block' }}>{c.title}</span>
                <span className="muted t-xs">{new Date(c.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {FEATURE_CATEGORIES.map(cat => {
        const items = FEATURES.filter(f => f.category === cat);
        if (!items.length) return null;
        return (
          <div key={cat}>
            <div className="row gap-2" style={{ alignItems: 'center', margin: '0 0 .9rem' }}>
              <span style={{ fontSize: '1.4rem' }}>{CAT_EMOJI[cat] || '✨'}</span>
              <h2 style={{ margin: 0 }}>{cat}</h2>
              <span className="muted t-sm">{items.length}</span>
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(255px,1fr))', gap: '1rem' }}>
              {items.map(f => (
                <Link key={f.id} to={`/tools/${f.id}`} className="tool-card">
                  <span className="tool-ic"><Icon name={f.icon || 'sparkles'} size={20} /></span>
                  <span className="fw-7" style={{ fontSize: '1.06rem', lineHeight: 1.25 }}>{f.title}</span>
                  <span className="muted t-sm" style={{ lineHeight: 1.4 }}>{f.blurb}</span>
                  {f.type === 'tracker' && <span className="chip" style={{ background: 'var(--sky-bg)', color: 'var(--sky)', alignSelf: 'flex-start', marginTop: '.3rem' }}>live tracker</span>}
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
