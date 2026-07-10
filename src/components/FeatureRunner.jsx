// The generic runner for every "generate" feature. From a feature config it
// renders the input form, calls /api/generate with the user's inputs + life
// context, and shows the returned document with Save and Print. One component
// powers ~40 of the 50 tools; adding a feature is just adding a config.
import { useState } from 'react';
import { Card, Button, Field, Input, Select, Textarea, useToast } from './UI.jsx';
import { Icon } from './icons.jsx';
import CrisisCard from './CrisisCard.jsx';
import { mdToHtml } from '../lib/markdown.js';
import { buildProfileText, saveCreation } from '../lib/store.js';
import { celebrate } from '../lib/celebrate.js';

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

export default function FeatureRunner({ feature }) {
  const toast = useToast();
  const [vals, setVals] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);   // { title, markdown, crisis, resources }
  const set = (k, v) => setVals(s => ({ ...s, [k]: v }));

  const run = async () => {
    setBusy(true); setResult(null);
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
      if (!data.crisis) celebrate({ count: 60, y: window.innerHeight * 0.4 });
    } catch (e) {
      toast(e.message || 'Something went wrong.', 'risk');
    } finally { setBusy(false); }
  };

  const save = () => {
    const r = saveCreation({ featureId: feature.id, title: result.title || feature.title, markdown: result.markdown, inputs: vals });
    if (r.error) return toast(r.message, 'warn');
    toast('Saved to your creations.', 'ok');
  };
  const print = () => window.print();

  return (
    <div className="col gap-3">
      {!result && (
        <Card pad={22}>
          <div className="col gap-3">
            {(feature.inputs || []).length === 0 && (
              <p className="muted">Aria will build this from what she already knows about you. You can add anything specific below, or just tap {feature.cta || 'Generate'}.</p>
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
            <div className="row gap-2">
              <Button variant="primary" onClick={run} disabled={busy}>
                {busy ? <><span className="spin" /> Aria is working...</> : <><Icon name="sparkles" size={17} /> {feature.cta || 'Generate'}</>}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {result && (
        <>
          <div className="row gap-2 between wrap no-print">
            <Button variant="ghost" onClick={() => setResult(null)}><Icon name="refresh" size={16} /> Start over</Button>
            <div className="row gap-2">
              {!result.crisis && <Button variant="ghost" onClick={print}><Icon name="book" size={16} /> Print</Button>}
              {!result.crisis && <Button variant="primary" onClick={save}><Icon name="check" size={16} /> Save</Button>}
            </div>
          </div>
          <Card pad={26} className="printable">
            <div className="row gap-2" style={{ alignItems: 'center', marginBottom: '.6rem' }}>
              <span className="aria-orb" style={{ width: 30, height: 30 }} aria-hidden />
              <h2 className="serif" style={{ margin: 0 }}>{result.title || feature.title}</h2>
            </div>
            {result.crisis && <CrisisCard resources={result.resources} />}
            <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(result.markdown) }} />
          </Card>
        </>
      )}
    </div>
  );
}
