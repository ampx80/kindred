// People - the relationships they want to build or repair. Aria helps them
// show up: tracks how long it has been, drafts the message, remembers why
// each person matters. This page is built to make reaching out feel warm and
// rewarding, and to gently surface who has quietly gone quiet - never shaming.
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card, Button, Modal, Field, Input, Textarea, useToast, SectionHeader, EmptyState, Badge } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { useStore, addPerson, touchPerson, updatePerson } from '../lib/store.js';
import { burstFrom } from '../lib/celebrate.js';
import { MilestoneBurst } from '../components/Delight.jsx';
import { sTap, sChime, sSuccess } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { track } from '../lib/track.js';

// Warm little avatar palette - a person's initial gets a soft, consistent tint
// derived from their name so the same face always wears the same color.
const AVATAR_TINTS = [
  { bg: 'var(--rose-bg)', fg: 'var(--rose)' },
  { bg: 'var(--sage-bg)', fg: 'var(--sage)' },
  { bg: 'var(--gold-bg)', fg: 'var(--gold)' },
  { bg: 'var(--sky-bg)', fg: 'var(--sky)' },
  { bg: 'var(--accent-50)', fg: 'var(--accent-600)' },
];
const hashOf = (str) => { let h = 0; for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const tintFor = (str) => AVATAR_TINTS[hashOf(str) % AVATAR_TINTS.length];
const pick = (arr, key) => arr[hashOf(key) % arr.length];
const initialOf = (name) => (String(name || '').trim()[0] || '?').toUpperCase();

// Gentle, kind nudges for someone who has gone quiet. Never guilt, never a scold.
const NUDGES = [
  'A quick hello would land.',
  'No rush - they would just love to hear from you.',
  'Might be a good moment to check in.',
  'A short message goes a long way.',
  'Even a one-line text counts.',
];

// Warm confirmations after you reach out. All ASCII hyphens, never em-dashes.
const CONFIRMS = [
  (n) => `Lovely. ${n} felt that.`,
  (n) => `That is what showing up looks like. ${n} is glad you did.`,
  (n) => `Logged. Small moments with ${n} are the whole thing.`,
  (n) => `Nice. ${n} is on your heart, and now on the record.`,
  (n) => `Warmth sent. ${n} will remember it.`,
];

const DAY = 86400000;
const touchMs = (p) => (p.lastTouch ? new Date(p.lastTouch).getTime() : -Infinity);
const isOverdue = (p) => !p.lastTouch || (Date.now() - new Date(p.lastTouch).getTime()) > 14 * DAY;

// A warm, human "last reached out" phrase instead of a raw day count.
function lastReached(d) {
  if (!d) return 'not yet';
  const days = Math.floor((Date.now() - new Date(d).getTime()) / DAY);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'last week';
  if (days < 31) return `${Math.round(days / 7)} weeks ago`;
  if (days < 60) return 'about a month ago';
  return `${Math.round(days / 30)} months ago`;
}

export default function People() {
  const people = useStore(s => s.people);
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: '', relation: '', intent: '' });
  const [editing, setEditing] = useState(null);      // person being edited
  const [logFor, setLogFor] = useState(null);        // person we are logging a moment for
  const [logNote, setLogNote] = useState('');
  const [reconnect, setReconnect] = useState('');    // drives the MilestoneBurst

  useEffect(() => { track('people_view'); }, []);

  const tap = () => { haptic('light'); sTap(); };

  const submit = () => {
    const r = addPerson(form);
    if (r.error) return toast(r.message, 'warn');
    haptic('success'); sChime();
    toast(`${r.person.name} is in your people now.`);
    setAddOpen(false);
    setForm({ name: '', relation: '', intent: '' });
  };

  const openEdit = (p) => { tap(); setEditing({ id: p.id, name: p.name, relation: p.relation || '', intent: p.intent || '' }); };
  const saveEdit = () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast('They still need a name.', 'warn');
    const r = updatePerson(editing.id, { name: editing.name.trim(), relation: editing.relation, intent: editing.intent });
    if (r.error) return toast(r.message, 'warn');
    haptic('success'); sChime();
    toast(`${editing.name.trim()} updated.`);
    setEditing(null);
  };

  // The satisfying one-tap "I reached out" moment.
  const reachOut = (p, e) => {
    const btn = e.currentTarget;
    const wasOverdue = isOverdue(p);
    const r = touchPerson(p.id);
    if (r.error) return toast(r.message, 'warn');
    haptic('success'); sSuccess(); burstFrom(btn);
    track('person_touch');
    toast(pick(CONFIRMS, p.id + Date.now())(p.name));
    // Reconnecting with someone who had gone quiet earns an extra warm beat.
    if (wasOverdue && p.lastTouch) setReconnect(p.name);
  };

  const openLog = (p) => { tap(); setLogFor(p); setLogNote(''); };
  const saveLog = () => {
    if (!logFor) return;
    const wasOverdue = isOverdue(logFor);
    const r = touchPerson(logFor.id, logNote.trim());
    if (r.error) return toast(r.message, 'warn');
    haptic('success'); sSuccess();
    track('person_touch');
    toast(pick(CONFIRMS, logFor.id + logNote)(logFor.name));
    if (wasOverdue && logFor.lastTouch) setReconnect(logFor.name);
    setLogFor(null);
    setLogNote('');
  };

  // Who to reach out to: the person quiet the longest (a null lastTouch wins).
  const sorted = [...people].sort((a, b) => touchMs(a) - touchMs(b));
  const suggestion = sorted[0];
  const suggestionOverdue = suggestion && isOverdue(suggestion);

  return (
    <div className="col gap-3">
      <MilestoneBurst show={reconnect} label="welcomed back in" sublabel="One message. That is how it mends." onDone={() => setReconnect('')} />

      <SectionHeader
        eyebrow="Your people"
        title="The relationships worth the work"
        sub="Aria keeps track of how long it has been, so nobody quietly slips away."
        action={<Button className="ppl-add" onClick={() => { tap(); setAddOpen(true); }}><Icon name="plus" size={17} /> Add someone</Button>}
      />

      {people.length > 0 && suggestion && (
        <Card className="ppl-suggest card-pad fade-up">
          <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="ppl-suggest-orb row center" aria-hidden>
              <Icon name="heart" size={20} />
            </span>
            <div className="col" style={{ gap: '.15rem', minWidth: 0, flex: '1 1 220px' }}>
              <span className="t-xs fw-7" style={{ letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--accent-700)' }}>
                A gentle nudge
              </span>
              {suggestionOverdue ? (
                <span style={{ fontSize: '1.02rem', color: 'var(--ink)' }}>
                  <b className="fw-7">{suggestion.name}</b> has been quiet the longest. {suggestion.lastTouch ? `Last reached out ${lastReached(suggestion.lastTouch)}.` : 'You have not reached out yet.'} No pressure, just a warm moment waiting.
                </span>
              ) : (
                <span style={{ fontSize: '1.02rem', color: 'var(--ink)' }}>
                  You are wonderfully caught up with your people. If anyone is on your mind, <b className="fw-7">{suggestion.name}</b> is a lovely place to start.
                </span>
              )}
            </div>
            <Button variant="warm" size="sm" className="ppl-reach" onClick={(e) => reachOut(suggestion, e)}>
              <Icon name="send" size={15} /> Reach out
            </Button>
          </div>
        </Card>
      )}

      {people.length === 0 ? (
        <EmptyState icon="heart" title="The people who matter, in one warm place"
          body="Family, a friend you miss, the coworker relationship you want to mend. Add the people you want to show up for, and Aria will help you never let them drift."
          action={<Button onClick={() => { tap(); setAddOpen(true); }}><Icon name="plus" size={16} /> Add your first person</Button>} />
      ) : (
        <div className="grid stagger" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {people.map(p => {
            const tint = tintFor(p.name);
            const over = isOverdue(p);
            return (
              <Card key={p.id} as="div" className="ppl-card card-pad">
                <Link to={`/people/${p.id}`} onClick={tap} className="col gap-1" style={{ minWidth: 0, color: 'inherit', textDecoration: 'none' }}>
                  <div className="row gap-2" style={{ alignItems: 'center' }}>
                    <span className="ppl-avatar row center" style={{ background: tint.bg, color: tint.fg }}>
                      {initialOf(p.name)}
                    </span>
                    <div className="col" style={{ minWidth: 0 }}>
                      <span className="fw-7 clip" style={{ fontSize: '1.08rem' }}>{p.name}</span>
                      <span className="muted t-sm clip">{p.relation || 'someone who matters'}</span>
                    </div>
                  </div>
                  {p.intent && <p className="t-sm" style={{ margin: '.5rem 0 0', color: 'var(--ink-2)' }}>{p.intent}</p>}
                  <div className="row gap-1 wrap" style={{ marginTop: '.55rem', alignItems: 'center' }}>
                    {p.lastTouch
                      ? <Badge tone={over ? 'warn' : 'ok'}>{!over && <Icon name="check" size={12} />} reached out {lastReached(p.lastTouch)}</Badge>
                      : <Badge tone="warn">not reached out yet</Badge>}
                  </div>
                  {over && <p className="ppl-nudge">{pick(NUDGES, p.id)}</p>}
                </Link>

                <div className="row gap-1 wrap ppl-actions">
                  <Button variant="warm" size="sm" className="ppl-reach" onClick={(e) => reachOut(p, e)}>
                    <Icon name="send" size={15} /> Reached out
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openLog(p)}>
                    <Icon name="quote" size={15} /> Log a moment
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`} style={{ padding: '.5rem .6rem' }}>
                    <Icon name="pencil" size={15} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add someone */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Someone who matters"
        footer={<>
          <Button variant="ghost" onClick={() => setAddOpen(false)}>Not now</Button>
          <Button onClick={submit} disabled={!form.name.trim()}>Add them</Button>
        </>}>
        <div className="col gap-2">
          <p className="muted t-sm" style={{ margin: '0 0 .2rem' }}>Who is worth keeping close? Add them here and Aria helps you show up.</p>
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

      {/* Edit someone */}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing ? `Update ${editing.name || 'this person'}` : 'Update'}
        footer={<>
          <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
          <Button onClick={saveEdit} disabled={!editing || !editing.name.trim()}>Save changes</Button>
        </>}>
        {editing && (
          <div className="col gap-2">
            <Field label="Their name">
              <Input autoFocus value={editing.name} onChange={e => setEditing(v => ({ ...v, name: e.target.value }))} />
            </Field>
            <Field label="Who they are to you">
              <Input value={editing.relation} onChange={e => setEditing(v => ({ ...v, relation: e.target.value }))} />
            </Field>
            <Field label="What you want with them">
              <Input value={editing.intent} onChange={e => setEditing(v => ({ ...v, intent: e.target.value }))} />
            </Field>
          </div>
        )}
      </Modal>

      {/* Log a moment */}
      <Modal open={!!logFor} onClose={() => setLogFor(null)} title={logFor ? `A moment with ${logFor.name}` : 'A moment'} width={520}
        footer={<>
          <Button variant="ghost" onClick={() => setLogFor(null)}>Not now</Button>
          <Button onClick={saveLog}>{logNote.trim() ? 'Save this moment' : 'Just mark it'}</Button>
        </>}>
        {logFor && (
          <div className="col gap-2">
            <p className="muted t-sm" style={{ margin: 0 }}>What happened? A call, a text, a coffee. Even a few words help Aria remember the thread of it.</p>
            <Field label="The moment" hint="Optional. Marking it still counts as reaching out.">
              <Textarea autoFocus rows={4} placeholder="Called to check in. He sounded lighter than last time." value={logNote} onChange={e => setLogNote(e.target.value)} />
            </Field>
          </div>
        )}
      </Modal>

      <style>{`
        .ppl-suggest {
          border: 1px solid var(--accent-300);
          background: linear-gradient(135deg, var(--accent-50), var(--rose-bg));
        }
        .ppl-suggest-orb {
          width: 42px; height: 42px; border-radius: var(--r-pill); flex: none;
          background: var(--paper); color: var(--accent-600);
          box-shadow: var(--shadow-sm);
          animation: pplPulse 3.4s ease-in-out infinite;
        }
        .ppl-card {
          position: relative;
          transition: transform .18s var(--ease), box-shadow .18s var(--ease), border-color .18s var(--ease);
        }
        .ppl-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--shadow);
          border-color: var(--accent-300);
        }
        .ppl-avatar {
          width: 46px; height: 46px; border-radius: var(--r-pill); flex: none;
          font-family: var(--font-display); font-weight: 700; font-size: 1.2rem;
          line-height: 1;
        }
        .ppl-nudge {
          margin: .55rem 0 0;
          font-size: .9rem;
          color: var(--accent-700);
          background: var(--accent-50);
          border-radius: var(--r-md);
          padding: .45rem .7rem;
        }
        .ppl-actions {
          margin-top: .75rem;
          padding-top: .75rem;
          border-top: 1px solid var(--line);
          align-items: center;
        }
        .ppl-reach { position: relative; overflow: hidden; }
        .ppl-reach::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(circle at center, rgba(255,255,255,.55), transparent 60%);
          opacity: 0; transform: scale(.4);
          pointer-events: none;
        }
        .ppl-reach:active::before { animation: pplBloom .5s var(--ease); }
        @keyframes pplPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
        @keyframes pplBloom {
          0% { opacity: .8; transform: scale(.4); }
          100% { opacity: 0; transform: scale(1.6); }
        }
        @media (prefers-reduced-motion: reduce) {
          .ppl-card { transition: none; }
          .ppl-card:hover { transform: none; }
          .ppl-suggest-orb { animation: none; }
          .ppl-reach:active::before { animation: none; }
        }
      `}</style>
    </div>
  );
}
