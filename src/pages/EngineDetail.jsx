// One engine, up close. Renders the engine's home (its own Home component if it
// provides one, otherwise a warm default of a daily note plus a tool grid), and
// renders an individual tool at /engines/:id/:toolId (a FeatureRunner generator
// or a bespoke content component).
import { useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { useToast } from '../components/UI.jsx';
import FeatureRunner from '../components/FeatureRunner.jsx';
import { useStore, activateEngine, deactivateEngine } from '../lib/store.js';
import { getEngine, getTool } from '../engines/index.js';
import { track } from '../lib/track.js';
import { haptic } from '../lib/haptics.js';
import { sTap } from '../lib/sound.js';

const CSS = `
.ed-wrap{max-width:900px;margin:0 auto;padding:.5rem 0 3rem}
.ed-back{display:inline-flex;align-items:center;gap:.35rem;color:var(--n-500);text-decoration:none;font-weight:650;font-size:.9rem;margin-bottom:1rem}
.ed-back:hover{color:var(--accent-700)}
.ed-hero{display:flex;gap:1rem;align-items:flex-start;padding:1.2rem;border-radius:var(--r-md);background:var(--paper);border:1px solid var(--line);position:relative;overflow:hidden;margin-bottom:1.4rem}
.ed-hero__glow{position:absolute;inset:0;opacity:.6;background:radial-gradient(120% 100% at 100% 0%,var(--eng-c,var(--accent-50)) 0%,transparent 55%);pointer-events:none}
.ed-emoji{font-size:2rem;width:58px;height:58px;display:grid;place-items:center;border-radius:16px;background:var(--eng-bg,var(--accent-50));flex:none;position:relative}
.ed-tools{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.9rem}
.ed-tool{display:flex;gap:.7rem;align-items:flex-start;padding:1rem;border-radius:var(--r-md);background:var(--paper);border:1px solid var(--line);text-decoration:none;color:inherit;transition:transform .15s,box-shadow .15s,border-color .15s}
.ed-tool:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(60,40,30,.1);border-color:var(--accent-300)}
.ed-tool__ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--accent-50);color:var(--accent-700);flex:none}
.ed-daily{padding:1.1rem 1.2rem;border-radius:var(--r-md);background:var(--accent-50);border:1px solid var(--accent-300);margin-bottom:1.4rem}
@media (max-width:560px){.ed-tools{grid-template-columns:1fr}}
`;

function DefaultHome({ engine, nav }) {
  const daily = (() => { try { return engine.daily ? engine.daily({}) : null; } catch { return null; } })();
  return (
    <>
      {daily && (
        <div className="ed-daily">
          <div className="row gap-2" style={{ alignItems: 'center', marginBottom: '.3rem' }}>
            <span className="aria-orb" style={{ width: 26, height: 26 }} aria-hidden />
            <b>{daily.title}</b>
          </div>
          <p style={{ margin: 0, color: 'var(--n-700)', lineHeight: 1.5 }}>{daily.body}</p>
          {daily.cta && daily.toolId && (
            <button className="btn btn-primary btn-sm" style={{ marginTop: '.7rem' }}
              onClick={() => nav(`/engines/${engine.id}/${daily.toolId}`)}>{daily.cta}</button>
          )}
        </div>
      )}
      <div className="ed-tools">
        {(engine.tools || []).map(t => (
          <Link key={t.id} className="ed-tool" to={`/engines/${engine.id}/${t.id}`} onClick={() => { haptic('light'); sTap(); }}>
            <span className="ed-tool__ic"><Icon name={t.icon || 'sparkles'} size={19} /></span>
            <span className="col" style={{ gap: '.15rem', minWidth: 0 }}>
              <span className="fw-7">{t.name}</span>
              <span className="muted t-sm">{t.desc}</span>
            </span>
          </Link>
        ))}
      </div>
      {(engine.tools || []).length === 0 && (
        <p className="muted">This engine is warming up. More tools are on the way.</p>
      )}
    </>
  );
}

export default function EngineDetail() {
  const { id, toolId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const engine = getEngine(id);
  const activeMeta = useStore(s => (s.profile && s.profile.engines) || []);
  const active = activeMeta.some(e => e.id === id);

  useEffect(() => { if (engine) track('engine_view', { id: engine.id, tool: toolId || '' }); }, [id, toolId]); // eslint-disable-line

  if (!engine) {
    return (
      <div className="ed-wrap">
        <style>{CSS}</style>
        <Link className="ed-back" to="/engines"><Icon name="chevronLeft" size={16} /> All engines</Link>
        <div className="col center" style={{ minHeight: '40vh', gap: '.8rem', textAlign: 'center' }}>
          <span className="aria-orb" style={{ width: 46, height: 46 }} aria-hidden />
          <h2 className="serif" style={{ margin: 0 }}>That engine is not here.</h2>
          <Link className="btn btn-primary" to="/engines">Back to your engines</Link>
        </div>
      </div>
    );
  }

  const tool = toolId ? getTool(engine.id, toolId) : null;
  const Home = engine.Home;

  const toggle = () => {
    if (active) { deactivateEngine(engine.id); toast(`${engine.name} turned off.`, 'ok'); }
    else { activateEngine(engine); haptic('medium'); toast(`${engine.name} is on.`, 'ok'); }
  };

  return (
    <div className="ed-wrap">
      <style>{CSS}</style>
      <Link className="ed-back" to={toolId ? `/engines/${engine.id}` : '/engines'} onClick={() => { haptic('light'); }}>
        <Icon name="chevronLeft" size={16} /> {toolId ? engine.name : 'All engines'}
      </Link>

      {!toolId && (
        <div className="ed-hero" style={{ '--eng-c': engine.color, '--eng-bg': engine.bg }}>
          <span className="ed-hero__glow" aria-hidden />
          <span className="ed-emoji" aria-hidden>{engine.emoji}</span>
          <div className="col" style={{ gap: '.3rem', flex: 1, minWidth: 0, position: 'relative' }}>
            <h1 className="serif" style={{ margin: 0, fontSize: '1.7rem', letterSpacing: '-.02em' }}>{engine.name}</h1>
            <p className="muted" style={{ margin: 0 }}>{engine.tagline || engine.blurb}</p>
          </div>
          <button className={`btn btn-sm ${active ? 'btn-ghost' : 'btn-primary'}`} onClick={toggle}>
            {active ? <><Icon name="check" size={15} /> On</> : 'Turn on'}
          </button>
        </div>
      )}

      {tool ? (
        tool.feature ? <FeatureRunner feature={tool.feature} />
        : tool.Component ? <tool.Component engine={engine} />
        : <p className="muted">This tool is not ready yet.</p>
      ) : (
        Home ? <Home engine={engine} /> : <DefaultHome engine={engine} nav={nav} />
      )}
    </div>
  );
}
