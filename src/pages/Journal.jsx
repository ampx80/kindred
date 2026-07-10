// Journal - everything they say, time-stamped, so the record compounds.
// Aria reads it. Voice-to-text entry built in.
import { useState, useRef, useEffect } from 'react';
import { Card, Button, Textarea, useToast, EmptyState } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { useStore, addJournal } from '../lib/store.js';

export default function Journal() {
  const journal = useStore(s => s.journal);
  const toast = useToast();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);

  const speechOK = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const toggleMic = () => {
    if (!speechOK) return;
    if (listening) { try { recogRef.current?.stop(); } catch {} return; }
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = true;
      const base = text ? text.trim() + ' ' : '';
      rec.onresult = (e) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setText(base + t); };
      rec.onend = () => { setListening(false); recogRef.current = null; };
      rec.onerror = () => { setListening(false); recogRef.current = null; };
      recogRef.current = rec; setListening(true); rec.start();
    } catch { setListening(false); }
  };
  useEffect(() => () => { try { recogRef.current?.stop(); } catch {} }, []);

  const save = () => {
    const r = addJournal(text);
    if (r.error) return toast(r.message, 'warn');
    setText('');
    toast('Saved. Aria will remember it.');
  };

  const entries = [...journal].reverse();
  const groups = [];
  for (const e of entries) {
    const day = new Date(e.at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const g = groups.find(x => x.day === day);
    if (g) g.items.push(e); else groups.push({ day, items: [e] });
  }

  return (
    <div className="col gap-3">
      <div className="col" style={{ gap: '.25rem' }}>
        <span className="eyebrow">Journal</span>
        <h1 className="serif">Say it here. It counts here.</h1>
      </div>

      <Card className="card-pad">
        <Textarea rows={3} placeholder={listening ? 'Listening... just talk.' : 'What happened? What are you carrying? Type it or speak it.'}
          value={text} onChange={e => setText(e.target.value)} style={{ fontSize: '1.05rem', fontFamily: 'var(--font-display)' }} />
        <div className="row gap-1" style={{ marginTop: '.8rem', justifyContent: 'flex-end' }}>
          {speechOK && (
            <Button variant="ghost" onClick={toggleMic} style={listening ? { background: 'var(--risk)', color: '#fff', borderColor: 'var(--risk)' } : undefined}>
              <Icon name="mic" size={16} /> {listening ? 'Stop' : 'Speak it'}
            </Button>
          )}
          <Button onClick={save} disabled={!text.trim()}><Icon name="pencil" size={16} /> Keep it</Button>
        </div>
      </Card>

      {groups.length === 0 ? (
        <EmptyState icon="book" title="Nothing written yet"
          body="The first entry is the hardest. One honest sentence about today is plenty." />
      ) : (
        groups.map(g => (
          <div key={g.day} className="col gap-1">
            <span className="t-sm fw-7 muted" style={{ letterSpacing: '.04em', textTransform: 'uppercase' }}>{g.day}</span>
            <div className="col gap-1 stagger">
              {g.items.map(e => (
                <Card key={e.id} className="card-pad" style={{ padding: '1.05rem 1.25rem' }}>
                  <p className="serif" style={{ fontSize: '1.08rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{e.text}</p>
                  <span className="muted t-xs" style={{ display: 'block', marginTop: '.5rem' }}>
                    {new Date(e.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}{e.source !== 'user' ? ' · via Aria' : ''}
                  </span>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
