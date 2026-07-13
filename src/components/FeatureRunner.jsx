// The generic runner for every "generate" feature. From a feature config it
// renders the input form, calls /api/generate with the user's inputs + life
// context, and shows the returned document with Copy, Save and Print. One
// component powers ~40 of the 50 tools; adding a feature is just adding a config.
import { useState, useEffect } from 'react';
import { Card, Button, Field, Input, Select, Textarea, useToast } from './UI.jsx';
import { Icon } from './icons.jsx';
import CrisisCard from './CrisisCard.jsx';
import { mdToHtml } from '../lib/markdown.js';
import { buildProfileText, saveCreation } from '../lib/store.js';
import { celebrate } from '../lib/celebrate.js';

// Warm status lines that rotate while Aria is generating, so the wait feels
// like someone is thinking about you rather than a spinner stalling.
const GEN_MSGS = [
  'Reading what I already know about you...',
  'Shaping this around your real life...',
  'Choosing words that sound like yours...',
  'Making it something you can actually use...',
  'Adding the warm finish, almost there...',
];

// Scoped, additive styles for the runner (prefixed so nothing collides with
// the shared design system). No index.css changes.
const RUNNER_CSS = `
.kr-reassure{display:flex;flex-wrap:wrap;gap:.4rem;margin:-.2rem 0 .2rem}
.kr-reassure .k-chip{display:inline-flex;align-items:center;gap:.32rem;font-size:.8rem;font-weight:650;
  padding:.3rem .62rem;border-radius:999px;background:var(--accent-50);color:var(--accent-700)}
.kr-gen{display:flex;flex-direction:column;align-items:center;text-align:center;gap:1rem;padding:2.6rem 1.4rem 2.2rem}
.kr-gen-msg{min-height:1.5em;font-weight:600;font-size:1.05rem;color:var(--ink)}
.kr-gen-lines{width:min(460px,100%);display:flex;flex-direction:column;gap:.7rem;margin-top:.4rem}
.kr-gen-lines i{display:block;height:12px;border-radius:6px;
  background:linear-gradient(90deg,var(--n-50) 0%,var(--accent-50) 50%,var(--n-50) 100%);
  background-size:220% 100%;animation:krShine 1.25s linear infinite}
.kr-gen-lines i:nth-child(2){width:92%}.kr-gen-lines i:nth-child(3){width:78%}
.kr-gen-lines i:nth-child(4){width:88%}.kr-gen-lines i:nth-child(5){width:64%}
@keyframes krShine{to{background-position:-220% 0}}
.kr-result-top{display:flex;align-items:center;gap:.7rem;margin-bottom:.7rem}
.kr-ribbon{display:inline-flex;align-items:center;gap:.4rem;font-size:.82rem;font-weight:700;
  color:var(--sage);background:var(--sage-bg);padding:.3rem .7rem;border-radius:999px}
@media (prefers-reduced-motion: reduce){.kr-gen-lines i{animation:none}}
`;

function ChipField({ input, value = [], onChange }) {
  const toggle = (opt) => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  return (
    <div className="row wrap gap-1">
      {(input.options || []).map(opt => (
        <button key={opt} type="button" onClick={() => toggle(opt)}
          className={`chip-toggle${value.includes(opt) ? ' on' : ''}`}>{opt}</button>
      ))}
    </div>
  );
}

// The delightful "Aria is working" panel: a breathing orb, a rotating warm
// line, and a soft shimmer standing in for the document taking shape.
function Generating({ label }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI(n => (n + 1) % GEN_MSGS.length), 1900);
    return () => clearInterval(id);
  }, []);
  return (
    <Card pad={0}>
      <div className="kr-gen" role="status" aria-live="polite">
        <span className="aria-orb is-thinking" style={{ width: 68, height: 68 }} aria-hidden />
        <div className="col" style={{ gap: '.25rem' }}>
          <span className="eyebrow">{label || 'Aria is writing this for you'}</span>
          <span className="kr-gen-msg">{GEN_MSGS[i]}</span>
        </div>
        <div className="kr-gen-lines" aria-hidden><i /><i /><i /><i /><i /></div>
      </div>
    </Card>
  );
}

export default function FeatureRunner({ feature }) {
  const toast = useToast();
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);   // { title, markdown, crisis, resources }
  const [saved, setSaved] = useState(false);
  const set = (k, v) => setVals(s => ({ ...s, [k]: v }));

  const run = async () => {
    if (busy) return;
    setBusy(true); setResult(null); setSaved(false);
    const inputsText = (feature.inputs || []).map(inp => {
      const v = vals[inp.key];
      const val = Array.isArray(v) ? v.join(', ') : (v || '');
      return val ? `${inp.label}: ${val}` : '';
    }).filter(Boolean).join('\n');
    try {
      const r = await fetch('/api/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: feature.outputTitle || feature.title, systemPrompt: feature.systemPrompt, inputsText, profileText: buildProfileText() }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || 'Aria could not make that right now.');
      setResult(data);
      if (!data.crisis) celebrate({ count: 70, y: window.innerHeight * 0.4 });
    } catch (e) {
      toast(e.message || 'Something went wrong.', 'risk');
    } finally { setBusy(false); }
  };

  // Cmd/Ctrl + Enter fires the generator while the form is up.
  useEffect(() => {
    if (result || busy) return;
    const h = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(); } };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }); // eslint-disable-line

  const save = () => {
    const r = saveCreation({ featureId: feature.id, title: result.title || feature.title, markdown: result.markdown, inputs: vals });
    if (r.error) return toast(r.message, 'warn');
    setSaved(true);
    celebrate({ count: 36, y: window.innerHeight * 0.3 });
    toast('Saved to your creations.', 'ok');
  };
  const print = () => window.print();
  const copy = async () => {
    try { await navigator.clipboard.writeText(result.markdown || ''); toast('Copied to clipboard.', 'ok'); }
    catch { toast('Could not copy here. Try Print instead.', 'warn'); }
  };

  const words = (result?.markdown || '').split(/\s+/).filter(Boolean).length;
  const readMin = Math.max(1, Math.round(words / 200));

  return (
    <div className="col gap-3">
      <style>{RUNNER_CSS}</style>

      {busy && <Generating label={`Aria is building "${feature.outputTitle || feature.title}"`} />}

      {!busy && !result && (
        <Card pad={22}>
          <div className="col gap-3">
            <div className="kr-reassure">
              <span className="k-chip"><Icon name="sparkles" size={13} /> Personal to you</span>
              <span className="k-chip"><Icon name="heart" size={13} /> Made from what Aria knows</span>
              <span className="k-chip"><Icon name="book" size={13} /> Save and print it</span>
            </div>
            {(feature.inputs || []).length === 0 && (
              <p className="muted" style={{ margin: 0 }}>Aria will build this from what she already knows about you. You can add anything specific below, or just tap {feature.cta || 'Generate'}.</p>
            )}
            {(feature.inputs || []).map(inp => (
              <Field key={inp.key} label={inp.label}>
                {inp.type === 'textarea' ? (
                  <Textarea rows={3} placeholder={inp.placeholder || ''} value={vals[inp.key] || ''} onChange={e => set(inp.key, e.target.value)} />
                ) : inp.type === 'select' ? (
                  <Select value={vals[inp.key] || ''} onChange={e => set(inp.key, e.target.value)}>
                    <option value="">Choose one...</option>
                    {(inp.options || []).map(o => <option key={o} value={o}>{o}</option>)}
                  </Select>
                ) : inp.type === 'chips' ? (
                  <ChipField input={inp} value={vals[inp.key] || []} onChange={v => set(inp.key, v)} />
                ) : (
                  <Input placeholder={inp.placeholder || ''} value={vals[inp.key] || ''} onChange={e => set(inp.key, e.target.value)} />
                )}
              </Field>
            ))}
            <div className="row gap-2" style={{ alignItems: 'center' }}>
              <Button variant="primary" onClick={run} disabled={busy}>
                <Icon name="sparkles" size={17} /> {feature.cta || 'Generate'}
              </Button>
              <span className="muted t-xs no-print">Tip: press Ctrl or Cmd + Enter</span>
            </div>
          </div>
        </Card>
      )}

      {result && (
        <>
          <div className="row gap-2 between wrap no-print">
            <Button variant="ghost" onClick={() => { setResult(null); setSaved(false); }}><Icon name="refresh" size={16} /> Start over</Button>
            <div className="row gap-2 wrap">
              {!result.crisis && <Button variant="ghost" onClick={copy}><Icon name="quote" size={16} /> Copy</Button>}
              {!result.crisis && <Button variant="ghost" onClick={print}><Icon name="book" size={16} /> Print</Button>}
              {!result.crisis && (
                saved
                  ? <Button variant="ghost" disabled style={{ color: 'var(--sage)' }}><Icon name="check" size={16} /> Saved</Button>
                  : <Button variant="primary" onClick={save}><Icon name="check" size={16} /> Save</Button>
              )}
            </div>
          </div>
          <Card pad={26} className="printable fade-up">
            <div className="kr-result-top">
              <span className="aria-orb" style={{ width: 32, height: 32 }} aria-hidden />
              <h2 className="serif" style={{ margin: 0, flex: 1, minWidth: 0 }}>{result.title || feature.title}</h2>
            </div>
            {!result.crisis && (
              <div className="row gap-1 no-print" style={{ alignItems: 'center', marginBottom: '.9rem' }}>
                <span className="kr-ribbon"><Icon name="sparkles" size={13} /> Made just for you</span>
                <span className="muted t-xs">{readMin} min read</span>
              </div>
            )}
            {result.crisis && <CrisisCard resources={result.resources} />}
            <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(result.markdown) }} />
          </Card>
        </>
      )}
    </div>
  );
}
