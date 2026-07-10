// People - the relationships they want to build or repair. Aria helps them
// show up: tracks how long it has been, drafts the message, remembers why
// each person matters.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Modal, Field, Input, useToast, SectionHeader, EmptyState, Badge, daysAgo } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { useStore, addPerson } from '../lib/store.js';

export default function People() {
  const people = useStore(s => s.people);
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', relation: '', intent: '' });

  const submit = () => {
    const r = addPerson(form);
    if (r.error) return toast(r.message, 'warn');
    toast(`${r.person.name} is in your people now.`);
    setAddOpen(false);
    setForm({ name: '', relation: '', intent: '' });
  };

  const needsTouch = (p) => !p.lastTouch || (Date.now() - new Date(p.lastTouch).getTime()) > 14 * 86400000;

  return (
    <div className="col gap-3">
      <SectionHeader
        eyebrow="Your people"
        title="The relationships worth the work"
        sub="Aria keeps track of how long it has been, so nobody quietly slips away."
        action={<Button onClick={() => setAddOpen(true)}><Icon name="plus" size={17} /> Add someone</Button>}
      />

      {people.length === 0 ? (
        <EmptyState icon="heart" title="No one here yet"
          body="Family, a friend you miss, the coworker relationship you want to fix. Add the people you want to show up for."
          action={<Button onClick={() => setAddOpen(true)}>Add your first person</Button>} />
      ) : (
        <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {people.map(p => (
            <Card key={p.id} as="div" className="card-pad card-hover" style={{ position: 'relative' }}>
              <Link to={`/people/${p.id}`} className="col gap-1" style={{ minWidth: 0 }}>
                <div className="row gap-2" style={{ alignItems: 'center' }}>
                  <span className="row center" style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--rose-bg)', color: 'var(--rose)', fontWeight: 750, fontSize: '1.1rem', flex: 'none' }}>
                    {p.name[0]}
                  </span>
                  <div className="col" style={{ minWidth: 0 }}>
                    <span className="fw-7 clip" style={{ fontSize: '1.08rem' }}>{p.name}</span>
                    <span className="muted t-sm clip">{p.relation || 'someone who matters'}</span>
                  </div>
                </div>
                {p.intent && <p className="t-sm" style={{ margin: '.4rem 0 0', color: 'var(--ink-2)' }}>{p.intent}</p>}
                <div className="row gap-1 wrap" style={{ marginTop: '.55rem' }}>
                  {needsTouch(p)
                    ? <Badge tone="warn"><Icon name="flame" size={12} /> {p.lastTouch ? `quiet for ${daysAgo(p.lastTouch)}` : 'no touch yet'}</Badge>
                    : <Badge tone="ok"><Icon name="check" size={12} /> touched {daysAgo(p.lastTouch)}</Badge>}
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Someone who matters"
        footer={<>
          <Button variant="ghost" onClick={() => setAddOpen(false)}>Not now</Button>
          <Button onClick={submit} disabled={!form.name.trim()}>Add them</Button>
        </>}>
        <div className="col gap-2">
          <Field label="Their name">
            <Input autoFocus placeholder="Danny" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </Field>
          <Field label="Who they are to you">
            <Input placeholder="Brother, old friend, my manager..." value={form.relation} onChange={e => setForm(f => ({ ...f, relation: e.target.value }))} />
          </Field>
          <Field label="What you want with them" hint="Aria uses this to help you show up.">
            <Input placeholder="Rebuild what we had. Call more. Clear the air." value={form.intent} onChange={e => setForm(f => ({ ...f, intent: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
