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

// Short, human names for the life-areas Aria hears you mention. Used for the
// live "Aria is hearing" chips that light up as the interview goes - the
// visible proof that she is really listening and adapting to your words.
const SENSE_LABEL = {
  faith: 'Faith', fitness: 'Strength', nutrition: 'Nutrition', mindset: 'Mind',
  relationships: 'Relationships', family: 'Family', friendship: 'Friendship', romance: 'Love',
  career: 'Work', money: 'Money', creativity: 'Creating', learning: 'Learning',
  nature: 'Outside', travel: 'Travel', purpose: 'Purpose', recovery: 'Recovery',
  health: 'Health', community: 'Community',
};

// Warm reflective beats shown while Aria "thinks" about the answer you just
// gave, so the pause reads as listening, not loading.
const THINKING = [
  'Sitting with that for a second',
  'Mmm. I hear you',
  'Taking that in',
  'That lands. Let me follow it',
  'Thank you for saying that',
  'Okay. I think I see it',
];

const phaseLabel = (depth) =>
  depth < 25 ? 'warming up'
  : depth < 55 ? 'getting to know you'
  : depth < 82 ? 'going a little deeper'
  : 'almost there';

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
  const [finishErr, setFinishErr] = useState('');    // never let the reveal CTA silently dead-end
  const [current, setCurrent] = useState(null);      // { question, choices, depth }
  const [profile, setProfile] = useState(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState(false);         // question finished typing
  const [greetDone, setGreetDone] = useState(false);
  const [skipGreet, setSkipGreet] = useState(false); // let impatient people jump the intro
  const [sensed, setSensed] = useState([]);          // life-areas Aria has heard so far
  const [weaveIdx, setWeaveIdx] = useState(0);       // cycles the weaving reflections
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

  // Absorb whatever Aria heard on the latest turn (works for API + local).
  const absorbSensed = (next) => {
    if (next && Array.isArray(next.domainsSensed) && next.domainsSensed.length) setSensed(next.domainsSensed);
  };

  const startInterview = async (nm) => {
    setStage('interview');
    setBusy(true);
    const next = await fetchNext({ name: nm, exchanges: [] });
    absorbSensed(next);
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
    absorbSensed(next);
    if (next.done && next.profile) {
      setStage('weaving');
      setTimeout(() => {
        setProfile(next.profile);
        setStage('reveal');
      }, 2600);
    } else {
      setCurrent(next); setTyped(false);
    }
    setBusy(false);
  };

  // Cycle the reflective lines while Aria weaves the profile together.
  useEffect(() => {
    if (stage !== 'weaving') return;
    setWeaveIdx(0);
    const id = setInterval(() => setWeaveIdx(i => Math.min(i + 1, 3)), 720);
    return () => clearInterval(id);
  }, [stage]);

  useEffect(() => {
    if (stage === 'reveal') {
      celebrate({ count: 160, spread: 1.15 });
      setTimeout(() => celebrate({ x: window.innerWidth * .25, y: window.innerHeight * .3, count: 70 }), 500);
      setTimeout(() => celebrate({ x: window.innerWidth * .75, y: window.innerHeight * .3, count: 70 }), 900);
    }
  }, [stage]);

  const begin = () => {
    setFinishErr('');
    let res = completeProfile({ ...profile, name, answers: exchanges });
    if (res.error) {
      // Self-heal so the highest-stakes moment never dead-ends: guarantee a name
      // and at least one domain, then retry.
      const domains = (profile?.domains && profile.domains.length)
        ? profile.domains
        : [{ id: 'purpose', name: 'What matters to you', why: 'The thread you kept coming back to.' }];
      res = completeProfile({ ...profile, name: (name || '').trim() || 'friend', domains, answers: exchanges });
    }
    if (res.error) { setFinishErr(res.message || 'Something snagged on my end. Tap to try again.'); return; }
    celebrate({ count: 90 });
    nav('/today');
  };

  const skipIntro = () => { if (!greetDone) { setSkipGreet(true); setGreetDone(true); } };

  const depth = current?.depth ?? 0;
  const topSensed = sensed.slice(0, 4);
  const weaveLines = [
    `Putting together what I heard about you, ${name}`,
    'Finding the thread that ties it together',
    'Naming what actually matters to you',
    'Almost there',
  ];

  return (
    <div className="wiz">
      <div className="ambient" aria-hidden><span className="b1" /><span className="b2" /><span className="b3" /></div>

      {stage === 'intro' && (
        <div className="wiz-inner" style={{ alignItems: 'center', textAlign: 'center', gap: '1.3rem' }}>
          <div className="col center" style={{ gap: '.55rem' }}>
            <span className="aria-orb" style={{ width: 84, height: 84 }} aria-hidden />
            <span className="wz-name">Aria <span className="wz-name-sub">your companion</span></span>
          </div>
          <div className="wiz-q" style={{ minHeight: '4.5em', cursor: greetDone ? 'default' : 'pointer' }} onClick={skipIntro}>
            {skipGreet ? GREET : <Typer text={GREET} speed={22} onDone={() => setGreetDone(true)} />}
          </div>
          {greetDone ? (
            <button className="btn btn-warm btn-lg fade-up" onClick={() => setStage('name')}>
              I'm ready <Icon name="arrowRight" size={18} />
            </button>
          ) : (
            <button className="wz-skip" onClick={skipIntro} aria-label="Skip the intro">skip &rsaquo;</button>
          )}
        </div>
      )}

      {stage === 'name' && (
        <div className="wiz-inner fade-up" style={{ alignItems: 'center', textAlign: 'center', gap: '1.3rem' }}>
          <span className="aria-orb" style={{ width: 60, height: 60 }} aria-hidden />
          <div className="wiz-q" style={{ minHeight: 0 }}>First things first - what should I call you?</div>
          <form className="row gap-1" style={{ width: '100%', maxWidth: 420 }}
            onSubmit={(e) => { e.preventDefault(); if (name.trim()) startInterview(name.trim()); }}>
            <input className="input" autoFocus placeholder="Your first name" value={name}
              onChange={e => setName(e.target.value)} style={{ fontSize: '1.1rem', textAlign: 'center' }} />
            <button type="submit" className="btn btn-primary" disabled={!name.trim()} aria-label="Continue">
              <Icon name="arrowRight" size={18} />
            </button>
          </form>
          <span className="wz-hint">Just your first name is perfect. You can change it later.</span>
        </div>
      )}

      {stage === 'interview' && (
        <div className="wiz-inner">
          <div className="row gap-2" style={{ alignItems: 'center' }}>
            <span className={`aria-orb${busy ? ' is-thinking' : ''}`} style={{ width: 44, height: 44 }} aria-hidden />
            <div className="col" style={{ flex: 1, gap: '.35rem' }}>
              <span className="t-xs muted" style={{ fontWeight: 650, letterSpacing: '.06em', textTransform: 'uppercase' }}>Aria is {phaseLabel(depth)}</span>
              <div className="warmbar"><i style={{ width: `${Math.max(6, depth)}%` }} /></div>
            </div>
          </div>

          {topSensed.length > 0 && (
            <div className="wz-sensed" aria-live="polite">
              <span className="wz-sensed-lead">Aria is hearing</span>
              <div className="wz-sensed-chips">
                {topSensed.map((id) => {
                  const m = domainMeta(id);
                  return (
                    <span key={id} className="wz-chip" style={{ background: m.bg, color: m.color }}>
                      <span aria-hidden>{m.emoji}</span> {SENSE_LABEL[id] || id}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {busy && !current ? (
            <div className="wiz-q muted fade-up">Taking a breath...</div>
          ) : current && (
            <div className="wz-qenter" key={current.question}>
              <div className="wiz-q">
                <Typer text={current.question} speed={18} onDone={() => setTyped(true)} />
              </div>
              {current.crisis && <CrisisCard resources={current.resources || CRISIS_RESOURCES} />}

              {busy ? (
                <div className="wz-think fade-up" aria-live="polite">
                  <span>{THINKING[exchanges.length % THINKING.length]}</span>
                  <span className="wz-dots" aria-hidden><i /><i /><i /></span>
                </div>
              ) : (
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
              )}
            </div>
          )}
        </div>
      )}

      {stage === 'weaving' && (
        <div className="wiz-inner fade-up" style={{ alignItems: 'center', textAlign: 'center', gap: '1.5rem' }}>
          <span className="aria-orb is-thinking" style={{ width: 84, height: 84 }} aria-hidden />
          <div className="wiz-q" style={{ minHeight: '2.6em' }} key={weaveIdx}>
            <span className="wz-weave">{weaveLines[weaveIdx]}...</span>
          </div>
          {topSensed.length > 0 && (
            <div className="wz-sensed-chips" style={{ justifyContent: 'center' }}>
              {topSensed.map((id) => {
                const m = domainMeta(id);
                return (
                  <span key={id} className="wz-chip" style={{ background: m.bg, color: m.color }}>
                    <span aria-hidden>{m.emoji}</span> {SENSE_LABEL[id] || id}
                  </span>
                );
              })}
            </div>
          )}
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
                <div key={d.id} className="card card-pad card-hover row gap-2" style={{ alignItems: 'flex-start' }}>
                  <span className="row center wz-dom-emoji" style={{ width: 42, height: 42, borderRadius: 13, background: m.bg, fontSize: '1.25rem', flex: 'none' }}>{m.emoji}</span>
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
          {finishErr && (
            <p className="t-sm" style={{ color: 'var(--rose)', textAlign: 'center', marginTop: '.6rem' }}>{finishErr}</p>
          )}
        </div>
      )}

      {/* Scoped magic - prefixed wz- classes so nothing in the design system collides. */}
      <style>{`
        .wz-name { font-family: var(--font-display); font-weight: 600; font-size: 1.15rem; color: var(--ink); display: inline-flex; align-items: baseline; gap: .5rem; }
        .wz-name-sub { font-family: var(--font-body); font-size: .72rem; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--accent-600); }

        .wz-skip { background: transparent; border: none; color: var(--n-400); font-family: inherit; font-size: .92rem; font-weight: 600;
          letter-spacing: .04em; cursor: pointer; padding: .4rem .8rem; border-radius: var(--r-pill); transition: color .15s, background .15s; }
        .wz-skip:hover { color: var(--accent-600); background: var(--accent-50); }

        .wz-hint { font-size: .92rem; color: var(--n-600); max-width: 340px; }

        /* Question enters with a soft rise + clarity, so each new question feels handed to you. */
        @keyframes wzQEnter { from { opacity: 0; transform: translateY(12px); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }
        .wz-qenter { animation: wzQEnter .5s var(--ease) both; }

        /* "Aria is hearing" chips light up as themes are sensed. */
        .wz-sensed { display: flex; flex-wrap: wrap; align-items: center; gap: .45rem .6rem; }
        .wz-sensed-lead { font-size: .74rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--n-400); }
        .wz-sensed-chips { display: flex; flex-wrap: wrap; gap: .4rem; }
        .wz-chip { display: inline-flex; align-items: center; gap: .3rem; padding: .28rem .68rem; border-radius: var(--r-pill);
          font-size: .84rem; font-weight: 650; line-height: 1.2; white-space: nowrap; box-shadow: var(--shadow-sm);
          animation: wzChipPop .42s var(--ease) both; }
        @keyframes wzChipPop { from { opacity: 0; transform: scale(.7) translateY(4px); } to { opacity: 1; transform: none; } }

        /* Reflective "thinking" beat while the next question is generated. */
        .wz-think { display: inline-flex; align-items: center; gap: .5rem; margin-top: .4rem;
          font-family: var(--font-display); font-size: 1.15rem; color: var(--ink-2); font-style: italic; }
        .wz-dots { display: inline-flex; gap: 4px; }
        .wz-dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); display: inline-block; animation: wzDot 1.1s ease-in-out infinite; }
        .wz-dots i:nth-child(2) { animation-delay: .18s; }
        .wz-dots i:nth-child(3) { animation-delay: .36s; }
        @keyframes wzDot { 0%, 60%, 100% { opacity: .3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-4px); } }

        .wz-weave { font-family: var(--font-display); animation: wzQEnter .45s var(--ease) both; }
        .wz-dom-emoji { animation: wzChipPop .5s var(--ease) both; }

        @media (prefers-reduced-motion: reduce) {
          .wz-qenter, .wz-chip, .wz-weave, .wz-dom-emoji { animation: none !important; }
          .wz-dots i { animation: none !important; opacity: .6 !important; }
        }
      `}</style>
    </div>
  );
}
