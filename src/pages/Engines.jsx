// The Life Engines hub. Aria equips the person for their actual life: this is
// where they see the engines she has turned on, the ones she suggests next, and
// the full library to explore. A person runs several at once and can double or
// triple dip freely.
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { useToast } from '../components/UI.jsx';
import { useStore, activateEngine, deactivateEngine } from '../lib/store.js';
import { ALL_ENGINES, matchEngines, suggestedEngines } from '../engines/index.js';
import { track } from '../lib/track.js';
import { haptic } from '../lib/haptics.js';
import { sPop } from '../lib/sound.js';

const HUB_CSS = `
.eng-wrap{max-width:1040px;margin:0 auto;padding:.5rem 0 3rem}
.eng-head{display:flex;gap:1rem;align-items:center;margin:.4rem 0 1.6rem}
.eng-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:1rem}
.eng-card{position:relative;display:flex;flex-direction:column;gap:.6rem;padding:1.1rem 1.1rem 1rem;border-radius:var(--r-md);
  background:var(--paper);border:1px solid var(--line);text-decoration:none;color:inherit;transition:transform .16s,box-shadow .16s,border-color .16s;overflow:hidden}
.eng-card:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(60,40,30,.12);border-color:var(--accent-300)}
.eng-card__glow{position:absolute;inset:0;opacity:.5;background:radial-gradient(120% 90% at 100% 0%,var(--eng-c,var(--accent-50)) 0%,transparent 55%);pointer-events:none}
.eng-emoji{font-size:1.7rem;width:46px;height:46px;display:grid;place-items:center;border-radius:14px;background:var(--eng-bg,var(--accent-50));position:relative}
.eng-name{font-weight:750;font-size:1.08rem;letter-spacing:-.01em}
.eng-tag{color:var(--n-600);font-size:.9rem;line-height:1.45;position:relative}
.eng-meta{display:flex;align-items:center;gap:.5rem;margin-top:auto;position:relative}
.eng-count{font-size:.78rem;color:var(--n-500);font-weight:650}
.eng-on{display:inline-flex;align-items:center;gap:.3rem;font-size:.74rem;font-weight:750;color:var(--sage);background:var(--sage-bg);padding:.2rem .55rem;border-radius:999px}
.eng-btn{position:relative;font:inherit;cursor:pointer;border-radius:999px;padding:.4rem .8rem;font-size:.82rem;font-weight:700;border:1px solid var(--line);background:var(--bg-0,#fff);color:var(--ink);transition:all .15s}
.eng-btn:hover{border-color:var(--accent-300);color:var(--accent-700)}
.eng-btn.on{background:var(--accent-600);border-color:var(--accent-600);color:#fff}
.eng-section-h{display:flex;align-items:baseline;gap:.6rem;margin:2rem 0 .9rem}
.eng-section-h h2{margin:0;font-family:var(--font-display);font-size:1.4rem}
.eng-section-h span{color:var(--n-500);font-size:.9rem}
@media (max-width:560px){.eng-grid{grid-template-columns:1fr 1fr;gap:.7rem}.eng-card{padding:.9rem}.eng-name{font-size:.98rem}.eng-tag{display:none}}
`;

function EngineCard({ engine, active, onToggle }) {
  return (
    <div className="eng-card" style={{ '--eng-c': engine.color, '--eng-bg': engine.bg }}>
      <span className="eng-card__glow" aria-hidden />
      <Link to={`/engines/${engine.id}`} className="col gap-1" style={{ textDecoration: 'none', color: 'inherit', gap: '.55rem' }}>
        <span className="eng-emoji" aria-hidden>{engine.emoji}</span>
        <span className="eng-name">{engine.name}</span>
        <span className="eng-tag">{engine.tagline || engine.blurb}</span>
      </Link>
      <div className="eng-meta">
        <span className="eng-count">{(engine.tools || []).length} tool{(engine.tools || []).length === 1 ? '' : 's'}</span>
        <span style={{ flex: 1 }} />
        {active
          ? <span className="eng-on"><Icon name="check" size={12} /> On</span>
          : <button className="eng-btn" onClick={() => onToggle(engine)}>Turn on</button>}
      </div>
    </div>
  );
}

export default function Engines() {
  const toast = useToast();
  const profile = useStore(s => s.profile);
  const goals = useStore(s => s.goals);
  const activeMeta = useStore(s => (s.profile && s.profile.engines) || []);
  const activeIds = activeMeta.map(e => e.id);

  const active = useMemo(() => ALL_ENGINES.filter(e => activeIds.includes(e.id)), [activeIds]);
  const suggested = useMemo(
    () => suggestedEngines(profile, goals).filter(e => !activeIds.includes(e.id)).slice(0, 6),
    [profile, goals, activeIds]
  );
  const rest = useMemo(() => {
    const shown = new Set([...activeIds, ...suggested.map(e => e.id)]);
    const ranked = matchEngines(profile, goals).map(x => x.engine);
    return ranked.filter(e => !shown.has(e.id));
  }, [profile, goals, activeIds, suggested]);

  const turnOn = (engine) => {
    activateEngine(engine);
    haptic('medium'); sPop();
    track('engine_activate', { id: engine.id });
    toast(`${engine.name} is on. It will show up where it helps.`, 'ok');
  };
  const turnOff = (engine) => { deactivateEngine(engine.id); toast(`${engine.name} turned off.`, 'ok'); };

  return (
    <div className="eng-wrap">
      <style>{HUB_CSS}</style>

      <div className="eng-head">
        <span className="aria-orb" style={{ width: 52, height: 52 }} aria-hidden />
        <div className="col" style={{ gap: '.2rem' }}>
          <h1 className="serif" style={{ margin: 0, fontSize: '1.9rem', letterSpacing: '-.02em' }}>Your life, equipped</h1>
          <p className="muted" style={{ margin: 0, maxWidth: 560 }}>
            Engines are the deep tools Aria brings to whatever you actually care about. Run as many as you like. She will pull from them through your day.
          </p>
        </div>
      </div>

      {active.length > 0 && (
        <>
          <div className="eng-section-h"><h2>Running for you</h2><span>{active.length} on</span></div>
          <div className="eng-grid">
            {active.map(e => <EngineCard key={e.id} engine={e} active onToggle={turnOff} />)}
          </div>
        </>
      )}

      {suggested.length > 0 && (
        <>
          <div className="eng-section-h"><h2>Aria suggests for you</h2><span>tuned to who you are</span></div>
          <div className="eng-grid">
            {suggested.map(e => <EngineCard key={e.id} engine={e} active={false} onToggle={turnOn} />)}
          </div>
        </>
      )}

      <div className="eng-section-h"><h2>Explore everything</h2><span>{ALL_ENGINES.length} engines</span></div>
      <div className="eng-grid">
        {rest.map(e => <EngineCard key={e.id} engine={e} active={activeIds.includes(e.id)} onToggle={activeIds.includes(e.id) ? turnOff : turnOn} />)}
      </div>

      {ALL_ENGINES.length === 0 && (
        <p className="muted" style={{ marginTop: '2rem' }}>Engines are being installed. Check back in a moment.</p>
      )}
    </div>
  );
}
