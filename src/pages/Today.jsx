// Today - the heart of the app. Aria's daily message grounded in their real
// data, the 1-3 moves that matter, a mood check-in, and their own words back.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Badge, useToast, longDate } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { celebrate } from '../lib/celebrate.js';
import { useStore, getTodayCheckin, todaysMoves, addCheckin, markGoalDone, throwback, getRecs } from '../lib/store.js';
import { dailyMessage } from '../lib/daily.js';

const MOODS = [
  { v: 1, e: '🌧️', label: 'Heavy' },
  { v: 2, e: '☁️', label: 'Low' },
  { v: 3, e: '⛅', label: 'Okay' },
  { v: 4, e: '🌤️', label: 'Good' },
  { v: 5, e: '☀️', label: 'Great' },
];

export default function Today() {
  const profile = useStore(s => s.profile);
  useStore(s => s.checkins); useStore(s => s.goals); useStore(s => s.people); useStore(s => s.recs);
  const toast = useToast();
  const nav = useNavigate();
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);

  const today = getTodayCheckin();
  const moves = todaysMoves();
  const msg = dailyMessage();
  const tb = throwback();
  const openRecs = getRecs().filter(r => !r.done);

  const checkIn = (v) => {
    const r = addCheckin({ mood: v, note });
    if (r.error) return toast(r.message, 'warn');
    if (v >= 4) celebrate({ count: 50, y: window.innerHeight * .45 });
    toast(v <= 2 ? 'Noted. Gentle day, small steps.' : 'Logged. Good to know where you are.');
    setNoteOpen(v <= 3 && !note);
  };

  const doMove = (m) => {
    if (m.kind === 'goal') {
      const r = markGoalDone(m.id);
      if (r.error) return toast(r.message, 'warn');
      if (r.milestone) { celebrate({ count: 140 }); toast(`${r.milestone} in a row. That is a milestone.`); }
      else { celebrate({ count: 60, y: window.innerHeight * .5 }); toast('Counted. Momentum is yours.'); }
    } else {
      nav(m.to);
    }
  };

  const hour = new Date().getHours();
  const daypart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';

  return (
    <div className="col gap-3">
      <div className="col" style={{ gap: '.25rem' }}>
        <span className="eyebrow">{longDate(new Date())}</span>
        <h1 className="serif">Good {daypart}, {profile.name}.</h1>
      </div>

      {msg && (
        <Card className="card-pad" style={{ borderColor: 'var(--accent-300)', background: 'linear-gradient(135deg, var(--paper), var(--accent-50))' }}>
          <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
            <span className="aria-orb" style={{ width: 40, height: 40, marginTop: 2 }} aria-hidden />
            <div className="col" style={{ gap: '.3rem', minWidth: 0 }}>
              <span className="t-xs fw-7 muted" style={{ letterSpacing: '.07em', textTransform: 'uppercase' }}>From Aria</span>
              <p className="serif" style={{ fontSize: '1.14rem', lineHeight: 1.6, margin: 0 }}>{msg}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
        <Card className="card-pad">
          <div className="row between" style={{ marginBottom: '.9rem' }}>
            <h3 style={{ margin: 0 }}>Today's moves</h3>
            <Badge tone="accent">{moves.length ? `${moves.length} that matter` : 'clear'}</Badge>
          </div>
          {moves.length === 0 ? (
            <p className="muted">Nothing pressing. Rest is a move too - or open <Link className="link" to="/paths">your paths</Link> and get ahead.</p>
          ) : (
            <div className="col gap-1 stagger">
              {moves.map((m) => (
                <div key={m.kind + m.id} className="row gap-2 panel" style={{ padding: '.85rem 1rem', alignItems: 'center' }}>
                  <div className="col" style={{ gap: '.1rem', minWidth: 0, flex: 1 }}>
                    <span className="fw-6 clip">{m.label}</span>
                    <span className="muted t-sm clip">{m.sub}</span>
                  </div>
                  {m.kind === 'goal' ? (
                    <button className="btn btn-primary btn-sm" onClick={() => doMove(m)}><Icon name="check" size={15} /> Done</button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" onClick={() => doMove(m)}>Go <Icon name="chevronRight" size={15} /></button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="card-pad">
          <h3 style={{ marginBottom: '.35rem' }}>How is today sitting?</h3>
          <p className="muted t-sm" style={{ marginBottom: '.9rem' }}>{today ? 'You can change it anytime today.' : 'One tap. Aria reads the weather.'}</p>
          <div className="row gap-1" style={{ justifyContent: 'space-between' }}>
            {MOODS.map(m => (
              <button key={m.v} onClick={() => checkIn(m.v)}
                className="col center"
                style={{
                  gap: '.25rem', flex: 1, padding: '.6rem .2rem', cursor: 'pointer', borderRadius: 'var(--r-md)',
                  border: today?.mood === m.v ? '2px solid var(--accent)' : '1.5px solid var(--line)',
                  background: today?.mood === m.v ? 'var(--accent-50)' : 'var(--paper)',
                  transition: 'all .15s var(--ease)',
                }}>
                <span style={{ fontSize: '1.5rem' }}>{m.e}</span>
                <span className="t-xs fw-6 muted">{m.label}</span>
              </button>
            ))}
          </div>
          {(noteOpen || today?.note) && (
            <form className="row gap-1" style={{ marginTop: '.8rem' }} onSubmit={(e) => { e.preventDefault(); if (today) { addCheckin({ mood: today.mood, note }); setNote(''); setNoteOpen(false); } }}>
              <input className="input" placeholder={today?.note || 'Want to say why? (optional)'} value={note} onChange={e => setNote(e.target.value)} />
              <button className="btn btn-ghost" type="submit" disabled={!note.trim()} aria-label="Save note"><Icon name="check" size={16} /></button>
            </form>
          )}
        </Card>
      </div>

      <div className="grid" style={{ gridTemplateColumns: openRecs.length ? '1fr 1fr' : '1fr' }}>
        {tb && (
          <Card className="card-pad" style={{ background: 'var(--gold-bg)' }}>
            <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
              <Icon name="quote" size={22} style={{ color: 'var(--gold)', flexShrink: 0, marginTop: 4 }} />
              <div className="col" style={{ gap: '.3rem' }}>
                <p className="serif" style={{ fontSize: '1.12rem', fontStyle: 'italic', margin: 0 }}>"{tb.text}"</p>
                <span className="muted t-sm">You, {new Date(tb.at).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}. Do not forget who wrote that.</span>
              </div>
            </div>
          </Card>
        )}
        {openRecs.length > 0 && (
          <Card className="card-pad card-hover" onClick={() => nav('/foryou')} style={{ cursor: 'pointer' }}>
            <div className="row between">
              <div className="col" style={{ gap: '.25rem' }}>
                <span className="t-xs fw-7 muted" style={{ letterSpacing: '.07em', textTransform: 'uppercase' }}>For you</span>
                <span className="fw-6">{openRecs[0].title}</span>
                <span className="muted t-sm clip">{openRecs.length > 1 ? `and ${openRecs.length - 1} more from Aria` : 'from Aria, tuned to you'}</span>
              </div>
              <Icon name="chevronRight" size={20} style={{ color: 'var(--n-400)', flexShrink: 0 }} />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
