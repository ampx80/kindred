// The adaptive interview - the moment Kindred lives or dies on. One warm
// question per screen, every question generated from the previous answers
// (via /api/interview; a real local branching engine takes over seamlessly
// if the API is unreachable). Ends in the confetti "this is you" reveal.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { Typer } from '../components/UI.jsx';
import { celebrate } from '../lib/celebrate.js';
import { completeProfile, domainMeta, TONES } from '../lib/store.js';
import { localNextQuestion } from '../lib/interview-local.js';
import { screenForCrisis, crisisReply, CRISIS_RESOURCES } from '../lib/safety.js';
import CrisisCard from '../components/CrisisCard.jsx';

const GREET = "Hi, I'm Aria. I'm an AI companion, not a person - but I'm a good listener, and I'm really looking forward to getting to know you. No forms, no homework, just a few questions, and we'll find what actually matters to you.";

async function fetchNext({ name, exchanges }) {
  try {
    const r = await fetch('/api/interview', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, exchanges }),
    });
    const data = await r.json();
    if (!r.ok || !data.ok) throw new Error(data.error || 'interview api unavailable');
    return data;
  } catch (e) {
    console.warn('[kindred] interview api unavailable, using local guide:', e.message);
    return localNextQuestion({ name, exchanges });
  }
}

export default function Welcome() {
  const nav = useNavigate();
  const [stage, setStage] = useState('intro');       // intro -> name -> interview -> weaving -> reveal
  const [name, setName] = useState('');
  const [exchanges, setExchanges] = useState([]);    // [{ q, a }]
  const [current, setCurrent] = useState(null);      // { question, choices, depth }
  const [profile, setProfile] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState(false);         // question finished typing
  const [greetDone, setGreetDone] = useState(false);
  const [listening, setListening] = useState(false);
  const recogRef = useRef(null);
  const inputRef = useRef(null);

  const speechOK = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const toggleMic = () => {
    if (!speechOK) return;
    if (listening) { try { recogRef.current?.stop(); } catch {} return; }
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false;
      const base = input ? input.trim() + ' ' : '';
      rec.onresult = (e) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; setInput(base + t); };
      rec.onend = () => { setListening(false); recogRef.current = null; inputRef.current?.focus(); };
      rec.onerror = () => { setListening(false); recogRef.current = null; };
      recogRef.current = rec; setListening(true); rec.start();
    } catch { setListening(false); }
  };
  useEffect(() => () => { try { recogRef.current?.stop(); } catch {} }, []);

  const startInterview = async (nm) => {
    setStage('interview');
    setBusy(true);
    const next = await fetchNext({ name: nm, exchanges: [] });
    setCurrent(next); setTyped(false); setBusy(false);
  };

  const answer = async (a) => {
    const text = (a ?? input).trim();
    if (!text || busy || !current) return;
    const nextExchanges = [...exchanges, { q: current.question, a: text }];
    setExchanges(nextExchanges);
    setInput('');

    // Local crisis failsafe during onboarding: works even without the API.
    if (screenForCrisis(text).crisis) {
      setCurrent({ question: crisisReply(name), choices: ['I reached out to someone', 'I want to keep going', 'Give me a minute'], depth: current.depth, crisis: true });
      setTyped(false);
      return;
    }

    setBusy(true);
    const next = await fetchNext({ name, exchanges: nextExchanges });
    if (next.done && next.profile) {
      setStage('weaving');
      setTimeout(() => {
        setProfile(next.profile);
        setStage('reveal');
      }, 2400);
    } else {
      setCurrent(next); setTyped(false);
    }
    setBusy(false);
  };

  useEffect(() => {
    if (stage === 'reveal') {
      celebrate({ count: 160, spread: 1.15 });
      setTimeout(() => celebrate({ x: window.innerWidth * .25, y: window.innerHeight * .3, count: 70 }), 500);
      setTimeout(() => celebrate({ x: window.innerWidth * .75, y: window.innerHeight * .3, count: 70 }), 900);
    }
  }, [stage]);

  const begin = () => {
    const res = completeProfile({ ...profile, name, answers: exchanges });
    if (res.error) { console.error(res.message); return; }
    celebrate({ count: 90 });
    nav('/today');
  };

  const depth = current?.depth ?? 0;

  return (
    <div className="wiz">
      <div className="ambient" aria-hidden><span className="b1" /><span className="b2" /><span className="b3" /></div>

      {stage === 'intro' && (
        <div className="wiz-inner" style={{ alignItems: 'center', textAlign: 'center', gap: '1.4rem' }}>
          <span className="aria-orb" style={{ width: 84, height: 84 }} aria-hidden />
          <div className="wiz-q" style={{ minHeight: '4.5em' }}>
            <Typer text={GREET} speed={22} onDone={() => setGreetDone(true)} />
          </div>
          {greetDone && (
            <button className="btn btn-warm btn-lg fade-up" onClick={() => setStage('name')}>
              I'm ready <Icon name="arrowRight" size={18} />
            </button>
          )}
        </div>
      )}

      {stage === 'name' && (
        <div className="wiz-inner fade-up" style={{ alignItems: 'center', textAlign: 'center', gap: '1.4rem' }}>
          <span className="aria-orb" style={{ width: 60, height: 60 }} aria-hidden />
          <div className="wiz-q">First things first - what should I call you?</div>
          <form className="row gap-1" style={{ width: '100%', maxWidth: 420 }}
            onSubmit={(e) => { e.preventDefault(); if (name.trim()) startInterview(name.trim()); }}>
            <input className="input" autoFocus placeholder="Your first name" value={name}
              onChange={e => setName(e.target.value)} style={{ fontSize: '1.1rem', textAlign: 'center' }} />
            <button type="submit" className="btn btn-primary" disabled={!name.trim()} aria-label="Continue">
              <Icon name="arrowRight" size={18} />
            </button>
          </form>
        </div>
      )}

      {stage === 'interview' && (
        <div className="wiz-inner">
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <span className={`aria-orb${busy ? ' is-thinking' : ''}`} style={{ width: 44, height: 44 }} aria-hidden />
            <div className="col" style={{ flex: 1, gap: '.35rem' }}>
              <span className="t-xs muted" style={{ fontWeight: 650, letterSpacing: '.06em', textTransform: 'uppercase' }}>Aria is getting to know you</span>
              <div className="warmbar"><i style={{ width: `${Math.max(6, depth)}%` }} /></div>
            </div>
          </div>

          {busy && !current ? (
            <div className="wiz-q muted">One moment...</div>
          ) : busy ? (
            <div className="wiz-q muted fade-up" style={{ fontSize: '1.15rem' }}>Listening...</div>
          ) : current && (
            <>
              <div className="wiz-q" key={current.question}>
                <Typer text={current.question} speed={18} onDone={() => setTyped(true)} />
              </div>
              {current.crisis && <CrisisCard resources={current.resources || CRISIS_RESOURCES} />}
              <div className="col gap-1" style={{ opacity: typed ? 1 : 0, transition: 'opacity .4s var(--ease)', pointerEvents: typed ? 'auto' : 'none' }}>
                <div className="col gap-1 stagger" key={current.question + '-choices'}>
                  {(current.choices || []).map((c) => (
                    <button key={c} className="wiz-choice" disabled={busy} onClick={() => answer(c)}>{c}</button>
                  ))}
                </div>
                <form className="row gap-1" style={{ marginTop: '.5rem' }} onSubmit={(e) => { e.preventDefault(); answer(); }}>
                  <input ref={inputRef} className="input" value={input} onChange={e => setInput(e.target.value)}
                    placeholder={listening ? 'Listening...' : 'or say it your own way...'} />
                  {speechOK && (
                    <button type="button" className={`btn btn-ghost`} onClick={toggleMic} aria-label="Speak"
                      style={listening ? { background: 'var(--risk)', color: '#fff', borderColor: 'var(--risk)' } : { flex: 'none' }}>
                      <Icon name="mic" size={17} />
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={!input.trim() || busy} aria-label="Answer">
                    <Icon name="send" size={17} />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      )}

      {stage === 'weaving' && (
        <div className="wiz-inner fade-up" style={{ alignItems: 'center', textAlign: 'center', gap: '1.5rem' }}>
          <span className="aria-orb is-thinking" style={{ width: 84, height: 84 }} aria-hidden />
          <div className="wiz-q">Putting together what I heard about you, {name}...</div>
          <div className="warmbar" style={{ width: 220 }}><i style={{ width: '92%' }} /></div>
        </div>
      )}

      {stage === 'reveal' && profile && (
        <div className="wiz-inner fade-up" style={{ gap: '1.3rem', maxWidth: 720 }}>
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <span className="aria-orb" style={{ width: 52, height: 52 }} aria-hidden />
            <div className="col">
              <span className="eyebrow">This is you, {name}</span>
              <h2 className="serif" style={{ margin: 0 }}>I see you now.</h2>
            </div>
          </div>
          <p className="serif" style={{ fontSize: '1.22rem', lineHeight: 1.6 }}>{profile.summary}</p>
          <div className="col gap-1 stagger">
            {(profile.domains || []).map((d) => {
              const m = domainMeta(d.id);
              return (
                <div key={d.id} className="card card-pad row gap-2" style={{ alignItems: 'flex-start' }}>
                  <span className="row center" style={{ width: 42, height: 42, borderRadius: 13, background: m.bg, fontSize: '1.25rem', flex: 'none' }}>{m.emoji}</span>
                  <div className="col" style={{ gap: '.2rem', minWidth: 0 }}>
                    <span className="fw-7" style={{ fontSize: '1.08rem' }}>{d.name}</span>
                    <span className="muted t-sm">{d.why}</span>
                    <span className="t-sm" style={{ color: 'var(--accent-700)', fontWeight: 650 }}>First step: {d.firstGoal}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="card card-pad" style={{ background: 'var(--accent-50)', borderColor: 'var(--accent-300)' }}>
            <span className="t-xs fw-7" style={{ letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--accent-700)' }}>
              How I'll walk with you: {TONES[profile.tone]?.name || 'Coach'}
            </span>
            <p style={{ margin: '.35rem 0 .6rem' }}>{profile.toneWhy}</p>
            <p className="serif" style={{ fontSize: '1.1rem', fontStyle: 'italic' }}>"{profile.belief}"</p>
          </div>
          <button className="btn btn-warm btn-lg" onClick={begin} style={{ alignSelf: 'center' }}>
            Start living it <Icon name="arrowRight" size={19} />
          </button>
        </div>
      )}
    </div>
  );
}
