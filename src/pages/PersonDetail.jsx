// One person up close: why they matter, how long it has been, the running
// notes, and Aria one tap away to draft the message. Reads its id from the
// router param (useParams) ONLY.
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Button, Input, Field, useToast, Badge, daysAgo, shortDate } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { burstFrom } from '../lib/celebrate.js';
import { MilestoneBurst } from '../components/Delight.jsx';
import { sTap, sChime, sSuccess } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { track } from '../lib/track.js';
import { useStore, getPerson, touchPerson, updatePerson } from '../lib/store.js';

// A warm, stable color for the person's avatar, chosen from the palette by
// their name so the same person always wears the same hue.
const AVATARS = [
  { c: 'var(--rose)', bg: 'var(--rose-bg)' },
  { c: 'var(--gold)', bg: 'var(--gold-bg)' },
  { c: 'var(--sage)', bg: 'var(--sage-bg)' },
  { c: 'var(--sky)', bg: 'var(--sky-bg)' },
  { c: 'var(--accent-600)', bg: 'var(--accent-50)' },
];
const avatarFor = (name = '') =>
  AVATARS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATARS.length];

export default function PersonDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  useStore(s => s.people);
  const toast = useToast();
  const person = getPerson(id);
  const [note, setNote] = useState('');
  const [editIntent, setEditIntent] = useState(false);
  const [intent, setIntent] = useState(person?.intent || '');
  const [justTouched, setJustTouched] = useState(false);
  const [burst, setBurst] = useState(0);
  const confirmTimer = useRef(null);

  useEffect(() => {
    track('person_detail_view');
    return () => { if (confirmTimer.current) clearTimeout(confirmTimer.current); };
  }, []); // eslint-disable-line

  if (!person) {
    return (
      <div className="col gap-2">
        <p className="muted">That person is not here anymore.</p>
        <Button variant="ghost" onClick={() => nav('/people')}>Back to People</Button>
      </div>
    );
  }

  const tap = () => { haptic('light'); sTap(); };

  const days = person.lastTouch
    ? Math.floor((Date.now() - new Date(person.lastTouch).getTime()) / 86400000)
    : null;
  const isQuiet = days == null || days > 14;

  const av = avatarFor(person.name);

  // The running thread, parsed from the date-stamped notes the store keeps.
  const timeline = (person.notes || '')
    .split('\n')
    .filter(Boolean)
    .map((line, i) => {
      const m = line.match(/^(\d{4}-\d{2}-\d{2}):\s*(.*)$/);
      return m ? { date: m[1], text: m[2], key: i } : { date: null, text: line, key: i };
    })
    .reverse();

  const touched = (e) => {
    const r = touchPerson(id, note.trim());
    if (r.error) return toast(r.message, 'warn');
    haptic('success');
    sSuccess();
    burstFrom(e, { count: 80 });
    track('person_touch');
    // A moment worth marking: celebrate the little milestones of staying close.
    const total = (r.person?.notes || '').split('\n').filter(Boolean).length;
    if ([3, 7, 14, 30, 60].includes(total)) setBurst(total);
    setNote('');
    setJustTouched(true);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setJustTouched(false), 4200);
    toast(`Lovely. ${person.name} heard from you.`);
  };

  const saveIntent = (e) => {
    e.preventDefault();
    updatePerson(id, { intent: intent.trim() });
    setEditIntent(false);
    haptic('light');
    sChime();
    toast('Saved. Good to keep that in view.');
  };

  const askAria = () => {
    tap();
    window.dispatchEvent(new CustomEvent('kindred:aria', {
      detail: { prompt: `Help me write a short message to ${person.name} (${person.relation || 'someone who matters to me'}). What I want with them: ${person.intent || 'to stay close'}. It has been ${person.lastTouch ? daysAgo(person.lastTouch) : 'a long time'} since we last talked.` },
    }));
  };

  return (
    <div className="col gap-3 pd">
      <style>{`
        .pd-hero {
          position: relative;
          overflow: hidden;
          background:
            radial-gradient(120% 140% at 0% 0%, var(--accent-50) 0%, transparent 55%),
            var(--paper);
        }
        .pd-avatar {
          width: 78px; height: 78px; border-radius: 999px;
          display: grid; place-items: center; flex: none;
          font-family: var(--font-display, inherit);
          font-weight: 750; font-size: 2rem; line-height: 1;
          box-shadow: 0 0 0 6px color-mix(in srgb, var(--paper) 70%, transparent);
        }
        .pd-avatar__ring {
          position: absolute; inset: -5px; border-radius: 999px;
          border: 2px solid currentColor; opacity: .28;
        }
        .pd-intent {
          position: relative;
          border-left: 3px solid var(--accent-300);
          padding: .55rem .2rem .55rem .9rem;
          border-radius: 2px;
          transition: background .2s var(--ease, ease);
          cursor: pointer;
        }
        .pd-intent:hover { background: color-mix(in srgb, var(--accent-50) 55%, transparent); }
        .pd-intent__hint { opacity: 0; transition: opacity .2s ease; }
        .pd-intent:hover .pd-intent__hint { opacity: 1; }
        .pd-nudge {
          border: 1px solid var(--accent-300);
          background: linear-gradient(180deg, var(--accent-50), var(--paper));
        }
        .pd-moment { text-align: left; }
        .pd-confirm {
          display: flex; align-items: center; gap: .5rem;
          color: var(--accent-700);
          font-weight: 600;
        }
        .pd-tl { position: relative; }
        .pd-tl-item {
          position: relative;
          padding: .05rem 0 0 1.25rem;
        }
        .pd-tl-item::before {
          content: ''; position: absolute; left: 4px; top: 8px; bottom: -14px;
          width: 2px; background: var(--line);
        }
        .pd-tl-item:last-child::before { display: none; }
        .pd-tl-dot {
          position: absolute; left: 0; top: 5px;
          width: 10px; height: 10px; border-radius: 999px;
          background: var(--accent); box-shadow: 0 0 0 3px var(--accent-50);
        }
        .pd-rise { animation: pdRise .5s var(--ease, cubic-bezier(.2,.7,.3,1)) both; }
        @keyframes pdRise {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .pd-glow { animation: pdGlow 1.4s ease both; }
        @keyframes pdGlow {
          0% { background: var(--accent-50); }
          100% { background: transparent; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pd-rise, .pd-glow { animation: none !important; }
        }
      `}</style>

      <MilestoneBurst show={burst} label="moments together" sublabel={`with ${person.name}`} onDone={() => setBurst(0)} />

      <button className="link row gap-1" style={{ background: 'none', border: 'none', alignSelf: 'flex-start' }} onClick={() => { tap(); nav(-1); }}>
        <Icon name="chevronLeft" size={16} /> Back
      </button>

      <Card className="card-pad pd-hero pd-rise">
        <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="pd-avatar" style={{ background: av.bg, color: av.c, position: 'relative' }}>
            <span className="pd-avatar__ring" aria-hidden />
            {(person.name[0] || '?').toUpperCase()}
          </span>
          <div className="col" style={{ gap: '.15rem', minWidth: 0, flex: 1 }}>
            <h1 className="serif" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', lineHeight: 1.1 }}>{person.name}</h1>
            <span className="muted">{person.relation || 'someone who matters'}</span>
          </div>
          {isQuiet
            ? <Badge tone="warn">quiet for {person.lastTouch ? daysAgo(person.lastTouch) : 'a while'}</Badge>
            : <Badge tone="ok">reached out {daysAgo(person.lastTouch)}</Badge>}
        </div>

        <div style={{ marginTop: '1.1rem' }}>
          <span className="eyebrow" style={{ display: 'block', marginBottom: '.35rem' }}>Why they matter</span>
          {editIntent ? (
            <form className="row gap-1" onSubmit={saveIntent}>
              <Input value={intent} onChange={e => setIntent(e.target.value)} placeholder="What you want with them" autoFocus />
              <Button type="submit" size="sm"><Icon name="check" size={15} /></Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => { tap(); setEditIntent(false); setIntent(person.intent || ''); }}><Icon name="x" size={15} /></Button>
            </form>
          ) : (
            <div className="pd-intent row between gap-2" onClick={() => { tap(); setEditIntent(true); }} title="Tap to edit" style={{ alignItems: 'center' }}>
              <p className="serif" style={{ fontSize: '1.12rem', fontStyle: 'italic', minWidth: 0 }}>
                {person.intent ? `"${person.intent}"` : 'What do you want with them? Tap to say.'}
              </p>
              <span className="pd-intent__hint muted t-xs row gap-1" style={{ flex: 'none' }}><Icon name="pencil" size={13} /> edit</span>
            </div>
          )}
        </div>
      </Card>

      {isQuiet && (
        <Card className="card-pad pd-nudge pd-rise" style={{ animationDelay: '.06s' }}>
          <div className="row gap-2" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="row center" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--paper)', color: 'var(--accent-600)', flex: 'none' }}>
              <Icon name="heart" size={20} />
            </span>
            <div className="col" style={{ gap: '.15rem', minWidth: 0, flex: 1 }}>
              <span className="fw-6">A short message would mean a lot.</span>
              <span className="muted t-sm">
                No guilt here. {person.lastTouch ? `It has just been ${daysAgo(person.lastTouch)}.` : `You have not logged a moment yet.`} Even a quick hello counts.
              </span>
            </div>
            <Button variant="warm" size="sm" onClick={askAria} style={{ flex: 'none' }}>
              <Icon name="send" size={15} /> Aria, help me
            </Button>
          </div>
        </Card>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card className="card-pad pd-rise" style={{ animationDelay: '.12s' }}>
          <h3 style={{ marginBottom: '.4rem' }}>A moment together</h3>
          <p className="muted t-sm" style={{ marginBottom: '.8rem' }}>Log a call, a text, a visit. Add a line so the thread remembers it.</p>
          <Field label="">
            <Input placeholder="Called about the lake house. It was good." value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') touched(e); }} />
          </Field>
          {justTouched ? (
            <div className="pd-confirm pd-glow" style={{ marginTop: '.85rem', borderRadius: 'var(--r-md)', padding: '.7rem .85rem' }} role="status">
              <Icon name="heart" size={18} /> Marked. That closeness counts.
            </div>
          ) : (
            <div className="row gap-1" style={{ marginTop: '.8rem', flexWrap: 'wrap' }}>
              <Button onClick={touched}><Icon name="check" size={16} /> I reached out</Button>
              <Button variant="ghost" onClick={askAria}><Icon name="send" size={15} /> Aria, draft it</Button>
            </div>
          )}
        </Card>

        <Card className="card-pad pd-rise" style={{ animationDelay: '.18s' }}>
          <h3 style={{ marginBottom: '.6rem' }}>The thread</h3>
          {timeline.length === 0 ? (
            <div className="col gap-1" style={{ padding: '.4rem 0' }}>
              <p className="muted t-sm">Nothing here yet. Every moment you log with a line lands here, newest first, so the story of you two builds over time.</p>
            </div>
          ) : (
            <div className="pd-tl col gap-2">
              {timeline.map((t, i) => (
                <div key={t.key} className="pd-tl-item pd-rise" style={{ animationDelay: `${0.2 + i * 0.05}s` }}>
                  <span className="pd-tl-dot" aria-hidden />
                  {t.date && <div className="t-xs muted fw-6" style={{ marginBottom: '.1rem' }}>{shortDate(t.date)} - {daysAgo(t.date)}</div>}
                  <div style={{ fontSize: '.97rem' }}>{t.text}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
