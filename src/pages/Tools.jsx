// The Tools hub - all 50 life-companion tools, browsable and searchable,
// grouped by life area. Generators open the FeatureRunner; trackers open their
// live view. Saved creations surface here too so nothing you make gets lost.
import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Card, SectionHeader, Badge } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { useStore } from '../lib/store.js';
import { FEATURES, FEATURE_CATEGORIES } from '../lib/features.js';

// Per-area identity: an emoji, a warm tint from the palette, and a one-line
// "what this area is for" so the gallery reads like a shelf, not a list.
const CAT_META = {
  'Health and Fitness':      { emoji: '💪', c: 'var(--sage)',       bg: 'var(--sage-bg)',   tag: 'Move, eat, rest, recover' },
  'Relationships':           { emoji: '🤝', c: 'var(--rose)',       bg: 'var(--rose-bg)',   tag: 'The people who matter most' },
  'Mental and Spiritual':    { emoji: '🕊️', c: 'var(--sky)',        bg: 'var(--sky-bg)',    tag: 'Mind, heart, and spirit' },
  'Productivity and Growth': { emoji: '🧭', c: 'var(--gold)',       bg: 'var(--gold-bg)',   tag: 'Goals, habits, and learning' },
  'Practical Daily Life':    { emoji: '🏡', c: 'var(--accent-700)', bg: 'var(--accent-50)', tag: 'The everyday, handled' },
  'Advanced and Unique':     { emoji: '✨', c: 'var(--rose)',       bg: 'var(--rose-bg)',   tag: 'Deeper, rarer kinds of help' },
  'Output and Tools':        { emoji: '🖨️', c: 'var(--sage)',       bg: 'var(--sage-bg)',   tag: 'Printable keepsakes and views' },
};
const DEFAULT_META = { emoji: '✨', c: 'var(--accent-700)', bg: 'var(--accent-50)', tag: '' };
const meta = (cat) => CAT_META[cat] || DEFAULT_META;

const GALLERY_CSS = `
.kg-toolbar{position:sticky;top:0;z-index:5;padding:.5rem 0 .6rem;margin-top:-.3rem;
  background:var(--page);border-bottom:1px solid transparent}
.kg-search{position:relative;flex:1;min-width:200px}
.kg-search input{width:100%;padding-left:2.6rem;padding-right:2.4rem}
.kg-search .kg-mag{position:absolute;left:.95rem;top:50%;transform:translateY(-50%);color:var(--ink-2);pointer-events:none}
.kg-search .kg-clear{position:absolute;right:.5rem;top:50%;transform:translateY(-50%);
  border:none;background:var(--n-50);color:var(--ink-2);width:26px;height:26px;border-radius:50%;
  display:grid;place-items:center;cursor:pointer;transition:background .13s,color .13s}
.kg-search .kg-clear:hover{background:var(--accent-50);color:var(--accent-700)}
.kg-catrow{display:flex;gap:.5rem;overflow-x:auto;padding:.15rem .1rem .4rem;scrollbar-width:none}
.kg-catrow::-webkit-scrollbar{height:0;display:none}
.kg-pill{flex:none;display:inline-flex;align-items:center;gap:.4rem;white-space:nowrap;
  font-size:.9rem;font-weight:650;padding:.44rem .82rem;border-radius:999px;cursor:pointer;
  border:1.5px solid var(--line);background:var(--paper);color:var(--ink-2);transition:all .14s var(--ease)}
.kg-pill:hover{border-color:var(--accent-300);color:var(--ink);transform:translateY(-1px)}
.kg-pill.on{background:var(--accent-600);border-color:var(--accent-600);color:#fff}
.kg-pill .kg-count{font-size:.78rem;opacity:.7;font-variant-numeric:tabular-nums}
.kg-pill.on .kg-count{opacity:.85}
.kg-tool{position:relative}
.kg-tool-arrow{color:var(--accent-600);opacity:0;transform:translateX(-5px);transition:opacity .16s var(--ease),transform .16s var(--ease)}
.tool-card:hover .kg-tool-arrow{opacity:1;transform:none}
.kg-chip{display:inline-flex;align-items:center;gap:.3rem;font-size:.78rem;font-weight:650;
  padding:.26rem .58rem;border-radius:999px}
.kg-cathead{display:flex;align-items:center;gap:.7rem;margin:0 0 .9rem}
.kg-cat-ic{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;font-size:1.3rem;flex:none}
.kg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(255px,1fr));gap:1rem}
.kg-grid .tool-card{animation:kgUp .42s var(--ease) both}
@keyframes kgUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.kg-grid .tool-card{animation:none}}
`;

function ToolCard({ f, i = 0 }) {
  const m = meta(f.category);
  const isTracker = f.type === 'tracker';
  return (
    <Link to={`/tools/${f.id}`} className="tool-card kg-tool" style={{ animationDelay: `${Math.min(i, 10) * 28}ms` }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <span className="tool-ic" style={{ background: m.bg, color: m.c, marginBottom: 0 }}><Icon name={f.icon || 'sparkles'} size={20} /></span>
        <span className="kg-tool-arrow" aria-hidden><Icon name="arrowRight" size={18} /></span>
      </div>
      <span className="fw-7" style={{ fontSize: '1.06rem', lineHeight: 1.25, marginTop: '.5rem' }}>{f.title}</span>
      <span className="muted t-sm" style={{ lineHeight: 1.4 }}>{f.blurb}</span>
      <div className="row gap-1" style={{ marginTop: '.55rem', alignItems: 'center' }}>
        {isTracker
          ? <span className="kg-chip" style={{ background: 'var(--sky-bg)', color: 'var(--sky)' }}><Icon name="target" size={12} /> Live tracker</span>
          : <span className="kg-chip" style={{ background: m.bg, color: m.c }}><Icon name="sparkles" size={12} /> {f.cta || 'Create'}</span>}
      </div>
    </Link>
  );
}

export default function Tools() {
  const creations = useStore(s => s.creations) || [];
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const searchRef = useRef(null);

  const query = q.trim().toLowerCase();
  const searching = query.length > 0;

  const matches = useMemo(() => {
    return FEATURES.filter(f => {
      if (cat !== 'all' && f.category !== cat) return false;
      if (!query) return true;
      return (`${f.title} ${f.blurb} ${f.category} ${f.cta || ''}`).toLowerCase().includes(query);
    });
  }, [query, cat]);

  const catCounts = useMemo(() => {
    const m = {};
    for (const f of FEATURES) m[f.category] = (m[f.category] || 0) + 1;
    return m;
  }, []);

  const filtered = cat === 'all' && !searching;

  return (
    <div className="stack-lg">
      <style>{GALLERY_CSS}</style>

      <SectionHeader eyebrow="Your tools" title="50 ways Aria can help, made for you"
        sub="Every tool is shaped around what Aria already knows about your life. Make it, save it, print it." />

      {/* Search + area filters */}
      <div className="kg-toolbar">
        <div className="row gap-2 wrap" style={{ alignItems: 'center', marginBottom: '.55rem' }}>
          <div className="kg-search">
            <span className="kg-mag" aria-hidden>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            </span>
            <input ref={searchRef} className="input" type="search" value={q} onChange={e => setQ(e.target.value)}
              placeholder="Search 50 tools by name or need..." aria-label="Search tools" />
            {q && <button className="kg-clear" aria-label="Clear search" onClick={() => { setQ(''); searchRef.current?.focus(); }}><Icon name="x" size={14} /></button>}
          </div>
        </div>
        <div className="kg-catrow" role="tablist" aria-label="Filter by life area">
          <button className={`kg-pill${cat === 'all' ? ' on' : ''}`} onClick={() => setCat('all')} role="tab" aria-selected={cat === 'all'}>
            All <span className="kg-count">{FEATURES.length}</span>
          </button>
          {FEATURE_CATEGORIES.map(c => (
            <button key={c} className={`kg-pill${cat === c ? ' on' : ''}`} onClick={() => setCat(c)} role="tab" aria-selected={cat === c}>
              <span aria-hidden>{meta(c).emoji}</span> {c} <span className="kg-count">{catCounts[c] || 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Your creations (hidden while actively searching, to keep focus) */}
      {creations.length > 0 && !searching && cat === 'all' && (
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

      {/* Grouped view when unfiltered; flat result grid when searching/filtered */}
      {filtered ? (
        FEATURE_CATEGORIES.map(c => {
          const items = FEATURES.filter(f => f.category === c);
          if (!items.length) return null;
          const m = meta(c);
          return (
            <div key={c}>
              <div className="kg-cathead">
                <span className="kg-cat-ic" style={{ background: m.bg }} aria-hidden>{m.emoji}</span>
                <div className="col" style={{ gap: '.1rem', minWidth: 0 }}>
                  <h2 style={{ margin: 0 }}>{c}</h2>
                  <span className="muted t-sm">{m.tag} - {items.length} tools</span>
                </div>
              </div>
              <div className="kg-grid">
                {items.map((f, i) => <ToolCard key={f.id} f={f} i={i} />)}
              </div>
            </div>
          );
        })
      ) : (
        <div>
          <p className="muted t-sm" style={{ margin: '0 0 .8rem' }}>
            {matches.length === 0 ? 'No tools match that yet' : `${matches.length} tool${matches.length === 1 ? '' : 's'}${searching ? ` matching "${q.trim()}"` : ''}`}
          </p>
          {matches.length === 0 ? (
            <Card style={{ textAlign: 'center', padding: '2.6rem 1.5rem' }}>
              <span className="row center floaty" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--accent-50)', color: 'var(--accent-600)', margin: '0 auto 1rem' }}>
                <Icon name="compass" size={26} />
              </span>
              <h3 style={{ marginBottom: '.45rem' }}>Nothing here yet</h3>
              <p className="muted" style={{ maxWidth: 420, margin: '0 auto 1.2rem' }}>Try a different word, or browse everything by tapping All above.</p>
              <button className="btn btn-primary" onClick={() => { setQ(''); setCat('all'); }}>Show all tools</button>
            </Card>
          ) : (
            <div className="kg-grid">
              {matches.map((f, i) => <ToolCard key={f.id} f={f} i={i} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
