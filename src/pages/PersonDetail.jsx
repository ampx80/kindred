// One person up close: why they matter, how long it has been, the running
// notes, and Aria one tap away to draft the message. Reads its id from the
// router param (useParams) ONLY.
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Input, Field, useToast, Badge, daysAgo } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { celebrate } from '../lib/celebrate.js';
import { useStore, getPerson, touchPerson, updatePerson } from '../lib/store.js';

export default function PersonDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  useStore(s => s.people);
  const toast = useToast();
  const person = getPerson(id);
  const [note, setNote] = useState('');
  const [editIntent, setEditIntent] = useState(false);
  const [intent, setIntent] = useState(person?.intent || '');

  if (!person) {
    return (
      <div className="col gap-2">
        <p className="muted">That person is not here anymore.</p>
        <Button variant="ghost" onClick={() => nav('/people')}>Back to People</Button>
      </div>
    );
  }

  const touched = () => {
    const r = touchPerson(id, note);
    if (r.error) return toast(r.message, 'warn');
    celebrate({ count: 70 });
    setNote('');
    toast(`Counted. ${person.name} heard from you.`);
  };

  const askAria = () => {
    window.dispatchEvent(new CustomEvent('kindred:aria', {
      detail: { prompt: `Help me write a short message to ${person.name} (${person.relation || 'someone who matters to me'}). What I want with them: ${person.intent || 'to stay close'}. It has been ${person.lastTouch ? daysAgo(person.lastTouch) : 'a long time'} since we last talked.` },
    }));
  };

  const noteLines = (person.notes || '').split('\n').filter(Boolean).reverse();

  return (
    <div className="col gap-3">
      <button className="link row gap-1" style={{ background: 'none', border: 'none', alignSelf: 'flex-start' }} onClick={() => nav(-1)}>
        <Icon name="chevronLeft" size={16} /> Back
      </button>

      <Card className="card-pad">
        <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="row center" style={{ width: 60, height: 60, borderRadius: 999, background: 'var(--rose-bg)', color: 'var(--rose)', fontWeight: 750, fontSize: '1.5rem', flex: 'none' }}>
            {person.name[0]}
          </span>
          <div className="col" style={{ gap: '.15rem', minWidth: 0, flex: 1 }}>
            <h1 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)' }}>{person.name}</h1>
            <span className="muted">{person.relation || 'someone who matters'}</span>
          </div>
          {(!person.lastTouch || (Date.now() - new Date(person.lastTouch).getTime()) > 14 * 86400000)
            ? <Badge tone="warn">quiet for {person.lastTouch ? daysAgo(person.lastTouch) : 'a while'}</Badge>
            : <Badge tone="ok">touched {daysAgo(person.lastTouch)}</Badge>}
        </div>

        <div style={{ marginTop: '1.1rem' }}>
          {editIntent ? (
            <form className="row gap-1" onSubmit={(e) => { e.preventDefault(); updatePerson(id, { intent }); setEditIntent(false); toast('Updated.'); }}>
              <Input value={intent} onChange={e => setIntent(e.target.value)} autoFocus />
              <Button type="submit" size="sm"><Icon name="check" size={15} /></Button>
            </form>
          ) : (
            <p className="serif" style={{ fontSize: '1.12rem', fontStyle: 'italic', cursor: 'pointer' }} onClick={() => setEditIntent(true)} title="Tap to edit">
              "{person.intent || 'What do you want with them? Tap to say.'}"
            </p>
          )}
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card className="card-pad">
          <h3 style={{ marginBottom: '.4rem' }}>Reached out?</h3>
          <p className="muted t-sm" style={{ marginBottom: '.8rem' }}>Log it so the quiet-counter resets. A note keeps the thread.</p>
          <Field label="">
            <Input placeholder="Called about the lake house. It was good." value={note} onChange={e => setNote(e.target.value)} />
          </Field>
          <div className="row gap-1" style={{ marginTop: '.8rem' }}>
            <Button onClick={touched}><Icon name="check" size={16} /> I reached out</Button>
            <Button variant="ghost" onClick={askAria}><Icon name="send" size={15} /> Aria, draft it</Button>
          </div>
        </Card>

        <Card className="card-pad">
          <h3 style={{ marginBottom: '.6rem' }}>The thread</h3>
          {noteLines.length === 0 ? (
            <p className="muted t-sm">No notes yet. Every touch you log with a note lands here.</p>
          ) : (
            <div className="col gap-1">
              {noteLines.map((l, i) => (
                <div key={i} className="panel" style={{ padding: '.6rem .85rem', fontSize: '.95rem' }}>{l}</div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
