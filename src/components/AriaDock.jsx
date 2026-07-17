// AriaDock - the always-there companion, docked on every screen. Ask her
// anything ("why do I feel off today?", "what should I read?", "help me text
// Danny") and she answers from the live life store, points to the right
// screen, or proposes actions run with one tap. Aria proposes; the person
// confirms; the store writers do the work. The thread persists so the
// relationship compounds.
import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './icons.jsx';
import CrisisCard from './CrisisCard.jsx';
import { screenForCrisis, crisisReply, CRISIS_RESOURCES } from '../lib/safety.js';
import { celebrate } from '../lib/celebrate.js';
import { speak, speechAvailable, stopSpeaking } from '../lib/voice.js';
import {
  getProfile, getGoals, getCheckins, getJournal, getPeople, getWins, getRecs,
  getMessages, saveMessages, getTodayCheckin, getSettings, saveSettings,
  addGoal, addWin, addPerson, addJournal, addRec, addCheckin,
  markGoalDone, addReflection, getFaith, getTodayReflection, ritualStreak,
} from '../lib/store.js';

const GREETING = {
  role: 'assistant',
  content: "I'm here. I remember everything you've told me - your goals, your people, your good and rough days. Ask me anything, or tell me what happened today.",
};
const STARTERS = [
  'Why do I feel off today?',
  'What should I read next?',
  'Help me reconnect with someone',
  'What matters most today?',
];

const CAPS = [
  { group: 'Understand yourself', icon: 'compass', tint: 'var(--sky)', items: [
    'Why do I feel off today?',
    'What patterns do you see in my week?',
    'What am I avoiding right now?',
  ] },
  { group: 'Move on your goals', icon: 'target', tint: 'var(--accent-600)', items: [
    'What matters most today?',
    'Set a new goal for my mornings',
    'I did my walk today, log it',
  ] },
  { group: 'Your people', icon: 'heart', tint: 'var(--rose)', items: [
    'Help me reconnect with an old friend',
    'Draft a text to someone I miss',
    'Add someone important to my people',
  ] },
  { group: 'Grow', icon: 'sparkles', tint: 'var(--gold)', items: [
    'What should I read next?',
    'Give me a practice for a quieter mind',
    'What win should I be proud of this week?',
  ] },
];

const actionIcon = (k) => ({
  set_goal: 'target', mark_goal_done: 'check', log_win: 'trophy', add_person: 'users', add_journal: 'book',
  add_rec: 'sparkles', draft_message: 'send', check_in: 'smile', reflect: 'moon', navigate: 'chevronRight',
}[k] || 'chevronRight');

/* Complete live snapshot of their life for grounding. Aria is blind to
   whatever is not here. */
function buildSnapshot(path) {
  const p = getProfile();
  return {
    profile: p ? { name: p.name, summary: p.summary, tone: p.tone, toneWhy: p.toneWhy, belief: p.belief, domains: p.domains, faith: p.faith || null } : null,
    goals: getGoals().map(g => ({ title: g.title, domainId: g.domainId, cadence: g.cadence, streak: g.streak, lastDoneAt: g.lastDoneAt, status: g.status })),
    checkins: [...getCheckins()].sort((a, b) => a.date < b.date ? 1 : -1).slice(0, 10),
    journal: [...getJournal()].reverse().slice(0, 8).map(j => ({ at: j.at, text: j.text })),
    people: getPeople().map(pe => ({ name: pe.name, relation: pe.relation, intent: pe.intent, lastTouch: pe.lastTouch })),
    wins: [...getWins()].reverse().slice(0, 10).map(w => ({ at: w.at, title: w.title })),
    recs: getRecs().filter(r => !r.done).map(r => ({ kind: r.kind, title: r.title })),
    today: { date: new Date().toISOString().slice(0, 10), mood: getTodayCheckin()?.mood ?? null, reflected: getTodayReflection()?.rating ?? null },
    ritualStreak: ritualStreak(),
    path,
  };
}

export default function AriaDock() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState(() => {
    const saved = getMessages();
    return saved && saved.length ? saved : [GREETING];
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(() => !!getSettings()?.voiceOn);
  const [sending, setSending] = useState(false);   // brief tactile pulse on the send button
  const loc = useLocation();
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const recogRef = useRef(null);
  const sendRef = useRef(null);                  // always points at the latest send(), so external opens never fire a stale closure
  const lastDiscloseRef = useRef(Date.now());   // NY GBL Art 47: re-disclose non-human status every 3h of continuous engagement

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [msgs, busy, open]);
  useEffect(() => { if (open && inputRef.current && window.innerWidth > 860) inputRef.current.focus(); }, [open]);
  useEffect(() => { saveMessages(msgs); }, [msgs]);
  // Whenever the dock closes, hush any spoken reply in progress.
  useEffect(() => { if (!open) stopSpeaking(); }, [open]);

  // Open from anywhere (e.g. a Today banner): window.dispatchEvent(new CustomEvent('kindred:aria', { detail: { prompt } }))
  useEffect(() => {
    const onOpen = (e) => { setOpen(true); const p = e.detail?.prompt; if (p) setTimeout(() => sendRef.current?.(p), 160); };
    window.addEventListener('kindred:aria', onOpen);
    return () => window.removeEventListener('kindred:aria', onOpen);
  }, []); // sendRef stays fresh below, so the handler never runs a stale send

  const toggleVoice = () => {
    setVoiceOn(v => {
      const next = !v;
      saveSettings({ voiceOn: next });
      if (!next) stopSpeaking();
      return next;
    });
  };

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

  const go = (to) => { if (to) { navigate(to); setOpen(false); } };
  const push = (content, extra) => setMsgs(m => [...m, { role: 'assistant', content, ...(extra || {}) }]);

  const send = useCallback(async (text) => {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    setSending(true); setTimeout(() => setSending(false), 320);   // tactile launch pulse

    // Periodic non-human disclosure for long continuous sessions (NY law).
    const preface = [];
    if (Date.now() - lastDiscloseRef.current > 3 * 60 * 60 * 1000) {
      lastDiscloseRef.current = Date.now();
      preface.push({ role: 'assistant', content: 'Quick reminder, since we have been talking a while: I am Aria, an AI companion, not a person. I am glad to be here with you.' });
    }
    const next = [...msgs, ...preface, { role: 'user', content: q }];
    setMsgs(next); setInput('');

    // Client-side crisis failsafe: screen the message locally BEFORE the
    // network call. If it fires, show care + resources immediately and never
    // send it into a coaching turn - this works even if the API is down.
    if (screenForCrisis(q).crisis) {
      const nm = getProfile()?.name || '';
      setMsgs(m => [...m, { role: 'assistant', content: crisisReply(nm), crisis: true, resources: CRISIS_RESOURCES,
        suggestions: ['I reached out to someone', 'Stay with me a minute'] }]);
      return;
    }

    setBusy(true);
    try {
      const r = await fetch('/api/companion', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.filter(m => m.role !== 'system').slice(-16).map(m => ({ role: m.role, content: m.content })),
          snapshot: buildSnapshot(loc.pathname),
          context: { path: loc.pathname },
        }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || 'Aria is unreachable');
      setMsgs(m => [...m, { role: 'assistant', content: data.reply, nav: data.nav, actions: data.actions || [], suggestions: data.suggestions || [], crisis: !!data.crisis, resources: data.crisis ? (data.resources || CRISIS_RESOURCES) : null }]);
      if (data.reply && speechAvailable() && getSettings()?.voiceOn) speak(data.reply);
    } catch (e) {
      // Honest degradation: no fabricated coaching. Offer the concrete things
      // that still work offline.
      console.warn('[kindred] companion unreachable:', e.message);
      setMsgs(m => [...m, {
        role: 'assistant',
        content: 'I cannot reach my full mind right now, so I will not pretend to. Everything you log still counts, and I will catch up the moment I am back. Meanwhile:',
        actions: [
          { kind: 'navigate', label: 'See today\'s moves', to: '/today' },
          { kind: 'navigate', label: 'Write in your journal', to: '/journal' },
        ],
      }]);
    } finally { setBusy(false); }
  }, [input, busy, msgs, loc.pathname]);
  useEffect(() => { sendRef.current = send; }, [send]);   // keep the external-open handler pointed at the live send

  const runAction = (a) => {
    try {
      if (a.kind === 'navigate' && a.to) return go(a.to);
      if (a.kind === 'set_goal' && a.goal?.title) {
        const r = addGoal(a.goal);
        if (r.error) return push(r.message);
        celebrate({ count: 60, x: window.innerWidth - 90, y: window.innerHeight - 120 });
        return push(`Goal set: "${r.goal.title}". Small reps, kept promises.`, { nav: { label: 'See your paths', to: '/paths' } });
      }
      if (a.kind === 'log_win' && a.win?.title) {
        const r = addWin(a.win);
        if (r.error) return push(r.message);
        celebrate({ count: 100 });
        return push(`Logged the win: "${r.win.title}". That goes in the book.`, { nav: { label: 'Your growth', to: '/growth' } });
      }
      if (a.kind === 'add_person' && a.person?.name) {
        const r = addPerson(a.person);
        if (r.error) return push(r.message);
        return push(`${r.person.name} is in your people now. I will keep an eye on how long it has been.`, { nav: { label: 'Open People', to: '/people' } });
      }
      if (a.kind === 'add_journal' && a.journal?.text) {
        const r = addJournal(a.journal.text);
        if (r.error) return push(r.message);
        return push('Saved to your journal, in your words.');
      }
      if (a.kind === 'add_rec' && a.rec?.title) {
        const r = addRec(a.rec);
        if (r.error) return push(r.message);
        return push(`Added to For you: "${r.rec.title}".`, { nav: { label: 'Open For you', to: '/foryou' } });
      }
      if (a.kind === 'mark_goal_done' && a.goalTitle) {
        const g = getGoals().find(x => x.status === 'active' && x.title.toLowerCase() === a.goalTitle.toLowerCase())
          || getGoals().find(x => x.status === 'active' && x.title.toLowerCase().includes(a.goalTitle.toLowerCase()));
        if (!g) return push(`I could not find "${a.goalTitle}" in your goals. Want me to set it up?`);
        const r = markGoalDone(g.id);
        if (r.error) return push(r.message);
        celebrate({ count: r.milestone ? 150 : 80, x: window.innerWidth - 90, y: window.innerHeight - 120 });
        return push(r.milestone ? `${r.milestone} in a row on "${g.title}". That is a milestone.` : `Logged "${g.title}". Streak is ${r.goal.streak} now.`, { nav: { label: 'See your paths', to: '/paths' } });
      }
      if (a.kind === 'check_in') {
        return go('/today');
      }
      if (a.kind === 'reflect') {
        const r = addReflection({ rating: a.reflection?.rating || 3, gratitude: a.reflection?.gratitude || '' });
        if (r.error) return push(r.message);
        celebrate({ count: 90, x: window.innerWidth - 90, y: window.innerHeight - 120 });
        return push('Day closed with you. That is how it compounds.', { nav: { label: 'Back to Today', to: '/today' } });
      }
      if (a.kind === 'draft_message' && a.message) {
        return push('Here is a draft. Make it yours before you send it:', { draft: a.message });
      }
    } catch (e) {
      push(`Could not do that: ${e.message}`);
    }
  };

  const copyDraft = (d) => { try { navigator.clipboard.writeText(d.body); push('Copied. Now actually send it.'); } catch {} };

  return (
    <>
      <button className={`aria-fab${open ? ' is-open' : ''}`} onClick={() => setOpen(o => !o)} aria-label={open ? 'Close Aria' : 'Talk to Aria'}>
        {open ? <Icon name="x" size={22} /> : (
          <>
            <span className="aria-fab__pulse" aria-hidden />
            <span className="aria-orb aria-fab__orb" style={{ width: 34, height: 34 }} aria-hidden />
          </>
        )}
      </button>

      {open && (
        <div className="aria-panel" role="dialog" aria-label="Aria companion">
          <div className="aria-head">
            <span className="aria-orb" style={{ width: 34, height: 34 }} aria-hidden />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="aria-head__name">Aria <span className="aria-head__tag">AI companion</span></div>
              <div className="aria-head__sub">An AI, not a person. Here for support.</div>
            </div>
            {speechAvailable() && (
              <button className={`aria-x aria-voice${voiceOn ? ' is-on' : ''}`} onClick={toggleVoice} aria-pressed={voiceOn} aria-label={voiceOn ? 'Turn off spoken replies' : 'Turn on spoken replies'} title={voiceOn ? 'Aria reads replies aloud' : 'Aria replies in text'}>
                <Icon name={voiceOn ? 'volume' : 'volumeOff'} size={18} />
              </button>
            )}
            <button className="aria-x" onClick={() => setHelpOpen(o => !o)} aria-label="Get real help" title="Get real help now"><Icon name="heart" size={18} /></button>
            <button className={`aria-x${menuOpen ? ' is-active' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label="What Aria can do" title="What can Aria do?"><Icon name="sparkles" size={18} /></button>
            <button className="aria-x" onClick={() => setOpen(false)} aria-label="Close"><Icon name="x" size={18} /></button>
          </div>

          {helpOpen && (
            <div className="aria-menu">
              <div className="aria-menu__head">
                <span>Get real help now</span>
                <button className="aria-x" onClick={() => setHelpOpen(false)} aria-label="Back"><Icon name="x" size={16} /></button>
              </div>
              <div className="aria-menu__scroll">
                <p className="muted t-sm" style={{ padding: '0 4px 10px' }}>
                  Aria is an AI companion, not a therapist or a crisis service. If you are struggling or in danger, reach a real person trained to help:
                </p>
                <CrisisCard compact />
              </div>
            </div>
          )}

          {menuOpen && (
            <div className="aria-menu">
              <div className="aria-menu__head">
                <span>What Aria can do</span>
                <button className="aria-x" onClick={() => setMenuOpen(false)} aria-label="Back"><Icon name="x" size={16} /></button>
              </div>
              <div className="aria-menu__scroll">
                {CAPS.map((cap) => (
                  <div key={cap.group} className="aria-cap">
                    <div className="aria-cap__head">
                      <span className="aria-cap__ic" style={{ color: cap.tint }}><Icon name={cap.icon} size={15} /></span>
                      {cap.group}
                    </div>
                    {cap.items.map((it) => (
                      <button key={it} className="aria-cap__item" onClick={() => { setMenuOpen(false); send(it); }}>
                        {it}<Icon name="chevronRight" size={14} className="aria-cap__go" />
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="aria-scroll" ref={scrollRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`aria-msg aria-msg--${m.role}`}>
                {m.role === 'assistant' && <span className="aria-orb" style={{ width: 22, height: 22, marginTop: 3, boxShadow: 'none' }} aria-hidden />}
                <div className="aria-bubble">
                  <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                  {m.crisis && <CrisisCard resources={m.resources || CRISIS_RESOURCES} />}
                  {m.draft && (
                    <div className="aria-draft">
                      {m.draft.to && <div className="aria-draft__to">To: {m.draft.to}</div>}
                      <div className="aria-draft__body">{m.draft.body}</div>
                      <button className="aria-navbtn" onClick={() => copyDraft(m.draft)}><Icon name="send" size={14} /> Copy message</button>
                    </div>
                  )}
                  {m.nav && (
                    <button className="aria-navbtn" onClick={() => go(m.nav.to)}>{m.nav.label} <Icon name="chevronRight" size={14} /></button>
                  )}
                  {Array.isArray(m.actions) && m.actions.length > 0 && (
                    <div className="aria-actions">
                      {m.actions.map((a, j) => (
                        <button key={j} className="aria-action" onClick={() => runAction(a)}>
                          <Icon name={actionIcon(a.kind)} size={14} /> {a.label}
                        </button>
                      ))}
                    </div>
                  )}
                  {Array.isArray(m.suggestions) && m.suggestions.length > 0 && (
                    <div className="aria-suggest">
                      {m.suggestions.map((s, j) => <button key={j} className="aria-chip" onClick={() => send(s)}>{s}</button>)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {msgs.length === 1 && (
              <div className="aria-suggest" style={{ paddingLeft: 30 }}>
                {STARTERS.map((s, j) => <button key={j} className="aria-chip" onClick={() => send(s)}>{s}</button>)}
              </div>
            )}
            {busy && (
              <div className="aria-msg aria-msg--assistant">
                <span className="aria-orb is-thinking" style={{ width: 22, height: 22, boxShadow: 'none' }} aria-hidden />
                <div className="aria-bubble aria-thinking"><span /><span /><span /></div>
              </div>
            )}
          </div>

          <form className="aria-input" onSubmit={(e) => { e.preventDefault(); send(); }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} placeholder={listening ? 'Listening...' : 'Talk to Aria...'} />
            {speechOK && (
              <button type="button" className={`aria-mic${listening ? ' is-live' : ''}`} onClick={toggleMic} aria-label={listening ? 'Stop' : 'Speak to Aria'} title="Voice to text">
                <Icon name="mic" size={16} />
              </button>
            )}
            <button type="submit" className={`aria-send${input.trim() && !busy ? ' is-ready' : ''}${sending ? ' is-launch' : ''}`} disabled={busy || !input.trim()} aria-label="Send"><Icon name="send" size={16} /></button>
          </form>
        </div>
      )}

      <AriaStyles />
    </>
  );
}

function AriaStyles() {
  return (
    <style>{`
    .aria-fab { position: fixed; right: 20px; bottom: 20px; z-index: 60; width: 60px; height: 60px; border-radius: 50%; border: none; cursor: pointer;
      background: radial-gradient(circle at 32% 26%, #f0a97a, #dd6f45 65%, #c2543a); color: #fff; display: grid; place-items: center;
      box-shadow: 0 12px 32px -8px rgba(194,84,58,.6), 0 0 0 1px rgba(255,255,255,.1) inset; transition: transform .2s cubic-bezier(.22,1,.36,1), box-shadow .2s; animation: ariaFloat 5s ease-in-out infinite; }
    .aria-fab > * { grid-area: 1 / 1; }
    .aria-fab:hover { transform: translateY(-3px) scale(1.04); box-shadow: 0 18px 42px -8px rgba(217,107,67,.6), 0 0 0 1px rgba(255,255,255,.14) inset; }
    .aria-fab:active { transform: translateY(-1px) scale(.95); }
    .aria-fab.is-open { animation: none; background: #a44a2b; }
    /* the little living presence inside the button + a soft "I'm here" heartbeat */
    .aria-fab__orb { box-shadow: 0 4px 14px -4px rgba(160,60,40,.6) !important; }
    .aria-fab__orb::after { display: none; }
    .aria-fab__pulse { width: 34px; height: 34px; border-radius: 50%; place-self: center; box-shadow: 0 0 0 0 rgba(255,255,255,.5); animation: ariaFabPulse 3.4s ease-out infinite; pointer-events: none; }
    @keyframes ariaFabPulse { 0% { box-shadow: 0 0 0 0 rgba(255,236,224,.55); } 70%,100% { box-shadow: 0 0 0 16px rgba(255,236,224,0); } }
    @keyframes ariaFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
    @media (max-width: 860px) { .aria-fab { bottom: calc(76px + env(safe-area-inset-bottom)); right: 14px; width: 54px; height: 54px; } }

    .aria-panel { position: fixed; right: 20px; bottom: 92px; z-index: 65; width: min(410px, calc(100vw - 28px)); height: min(620px, calc(100dvh - 120px));
      background: var(--paper); border: 1px solid var(--line); border-radius: 22px; overflow: hidden; display: flex; flex-direction: column;
      box-shadow: 0 30px 70px -24px rgba(70,50,35,.5); transform-origin: bottom right; animation: ariaIn .26s cubic-bezier(.22,1,.36,1); }
    @media (max-width: 860px) { .aria-panel { bottom: calc(140px + env(safe-area-inset-bottom)); height: min(560px, calc(100dvh - 170px)); } }
    @keyframes ariaIn { from { opacity: 0; transform: translateY(14px) scale(.97); } to { opacity: 1; transform: none; } }

    .aria-head { display: flex; align-items: center; gap: 11px; padding: 14px 16px; color: #fff;
      background: linear-gradient(120deg, #b4532f, #dd6f45 60%, #d95d78); position: relative; }
    .aria-head::after { content:''; position:absolute; inset:0; background: radial-gradient(130px 60px at 85% 0%, rgba(255,255,255,.28), transparent 70%); pointer-events:none; }
    .aria-head__name { font-weight: 800; font-size: 16px; letter-spacing: -.01em; }
    .aria-head__tag { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; background: rgba(255,255,255,.92); color: #a44a2b; padding: 2px 6px; border-radius: 5px; margin-left: 6px; vertical-align: middle; }
    .aria-head__sub { font-size: 12px; color: #ffe4d6; margin-top: 1px; }
    .aria-x { border: none; background: transparent; color: #ffe9dd; cursor: pointer; padding: 4px; border-radius: 7px; display: grid; place-items: center; position: relative; z-index: 1; }
    .aria-x:hover, .aria-x.is-active { background: rgba(255,255,255,.2); color: #fff; }
    .aria-x:active { transform: scale(.9); }
    .aria-voice.is-on { background: rgba(255,255,255,.28); color: #fff; }
    .aria-voice.is-on::after { content: ''; position: absolute; right: 3px; top: 3px; width: 5px; height: 5px; border-radius: 50%; background: #ffe4d6; box-shadow: 0 0 0 0 rgba(255,228,214,.8); animation: ariaVoiceDot 1.8s ease-out infinite; }
    @keyframes ariaVoiceDot { 0% { box-shadow: 0 0 0 0 rgba(255,228,214,.7); } 70%,100% { box-shadow: 0 0 0 6px rgba(255,228,214,0); } }

    .aria-menu { position: absolute; top: 62px; left: 0; right: 0; bottom: 0; z-index: 5; background: var(--paper); display: flex; flex-direction: column; animation: ariaMenuIn .2s cubic-bezier(.22,1,.36,1); }
    @keyframes ariaMenuIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
    .aria-menu__head { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--line); font-weight: 800; font-size: 14px; color: var(--ink); }
    .aria-menu__head .aria-x { color: var(--n-600); } .aria-menu__head .aria-x:hover { background: var(--n-50); color: var(--ink); }
    .aria-menu__scroll { flex: 1; overflow-y: auto; padding: 12px 12px 18px; }
    .aria-cap { margin-bottom: 14px; }
    .aria-cap__head { display: flex; align-items: center; gap: 8px; font-size: 12.5px; font-weight: 800; text-transform: uppercase; letter-spacing: .04em; color: var(--n-600); padding: 0 4px 6px; }
    .aria-cap__ic { width: 26px; height: 26px; border-radius: 8px; background: var(--n-25); display: grid; place-items: center; }
    .aria-cap__item { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; text-align: left; font-family: inherit; font-size: 14px; font-weight: 500; color: var(--ink); background: var(--paper); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; margin-bottom: 6px; cursor: pointer; transition: border-color .14s, background .14s, transform .14s; }
    .aria-cap__item:hover { border-color: var(--accent-300); background: var(--accent-50); transform: translateX(2px); }
    .aria-cap__go { color: var(--n-400); flex-shrink: 0; }

    .aria-scroll { flex: 1; overflow-y: auto; padding: 16px; background: var(--page); display: flex; flex-direction: column; gap: 14px; scroll-behavior: smooth; }
    .aria-msg { display: flex; gap: 8px; align-items: flex-start; animation: ariaMsgIn .34s cubic-bezier(.22,1,.36,1) both; }
    .aria-msg--user { justify-content: flex-end; }
    .aria-msg--user.aria-msg { animation-name: ariaMsgInR; }
    @keyframes ariaMsgIn { from { opacity: 0; transform: translateY(9px) scale(.985); } to { opacity: 1; transform: none; } }
    @keyframes ariaMsgInR { from { opacity: 0; transform: translateY(9px) translateX(6px) scale(.985); } to { opacity: 1; transform: none; } }
    .aria-bubble { max-width: 85%; font-size: 14.5px; line-height: 1.5; color: var(--ink); background: var(--paper); border: 1px solid var(--line); padding: 10px 13px; border-radius: 15px; min-width: 0; box-shadow: 0 1px 2px rgba(70,50,35,.05); }
    .aria-msg--user .aria-bubble { background: linear-gradient(135deg, var(--accent), var(--accent-600)); color: #fff; border-color: var(--accent); border-bottom-right-radius: 5px; box-shadow: 0 6px 16px -8px rgba(217,107,67,.6); }
    .aria-msg--assistant .aria-bubble { border-bottom-left-radius: 5px; }
    .aria-msg--assistant .aria-orb { transition: transform .2s var(--ease); }

    .aria-draft { margin-top: 9px; border: 1px solid var(--line); border-radius: 10px; padding: 10px; background: var(--n-25); }
    .aria-draft__to { font-size: 12.5px; font-weight: 700; color: var(--n-700); margin-bottom: 4px; }
    .aria-draft__body { font-size: 13.5px; white-space: pre-wrap; color: var(--ink-2); margin: 4px 0 8px; }

    .aria-navbtn { display: inline-flex; align-items: center; gap: 6px; margin-top: 9px; padding: 7px 12px; font-size: 13.5px; font-weight: 700; font-family: inherit;
      background: var(--accent-50); color: var(--accent-700); border: 1px solid var(--accent-300); border-radius: 999px; cursor: pointer; transition: background .15s, color .15s, transform .12s, box-shadow .15s; }
    .aria-navbtn:hover { background: var(--accent-300); color: #fff; transform: translateY(-1px); box-shadow: 0 6px 14px -8px rgba(217,107,67,.7); }
    .aria-navbtn:active { transform: translateY(0) scale(.97); }
    .aria-navbtn svg { transition: transform .18s var(--ease); }
    .aria-navbtn:hover svg { transform: translateX(3px); }
    .aria-actions { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
    /* proposed-action buttons: land with a gentle stagger so a set of moves feels offered, not dumped */
    .aria-action { display: inline-flex; align-items: center; gap: 8px; padding: 10px 13px; font-size: 13.5px; font-weight: 700; font-family: inherit;
      background: linear-gradient(135deg, #3a302a, var(--ink)); color: var(--paper); border: none; border-radius: 999px; cursor: pointer; text-align: left; position: relative; overflow: hidden;
      transition: filter .15s, transform .15s, box-shadow .15s; animation: ariaActIn .3s cubic-bezier(.22,1,.36,1) both; box-shadow: 0 4px 12px -6px rgba(46,36,30,.5); }
    .aria-action:nth-child(2) { animation-delay: .05s; } .aria-action:nth-child(3) { animation-delay: .1s; } .aria-action:nth-child(4) { animation-delay: .15s; } .aria-action:nth-child(n+5) { animation-delay: .2s; }
    .aria-action svg { flex: none; color: var(--gold); }
    .aria-action:hover { filter: brightness(1.16); transform: translateY(-1px); box-shadow: 0 8px 20px -8px rgba(46,36,30,.6); }
    .aria-action:active { transform: translateY(0) scale(.98); }
    .aria-action::after { content: ''; position: absolute; inset: 0; background: radial-gradient(circle, rgba(255,255,255,.4), transparent 60%); opacity: 0; transform: scale(0); pointer-events: none; }
    .aria-action:active::after { animation: ariaRipple .5s ease-out; }
    @keyframes ariaActIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @keyframes ariaRipple { 0% { opacity: .5; transform: scale(0); } 100% { opacity: 0; transform: scale(2.2); } }
    .aria-suggest { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .aria-chip { font-size: 12.5px; font-weight: 600; font-family: inherit; padding: 6px 11px; border-radius: 999px; border: 1px solid var(--line-strong); background: var(--paper); color: var(--n-600); cursor: pointer; text-align: left; transition: border-color .14s, color .14s, background .14s, transform .12s, box-shadow .15s; }
    .aria-chip:hover { border-color: var(--accent); color: var(--accent-600); background: var(--accent-50); transform: translateY(-1px); box-shadow: 0 5px 12px -8px rgba(217,107,67,.6); }
    .aria-chip:active { transform: translateY(0) scale(.96); }

    .aria-thinking { display: inline-flex; gap: 4px; align-items: center; }
    .aria-thinking span { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); animation: ariaBlink 1.2s infinite; }
    .aria-thinking span:nth-child(2) { animation-delay: .2s; } .aria-thinking span:nth-child(3) { animation-delay: .4s; }
    @keyframes ariaBlink { 0%,60%,100% { opacity: .25; } 30% { opacity: 1; } }

    .aria-input { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--line); background: var(--paper); }
    .aria-input input { flex: 1; border: 1px solid var(--line-strong); border-radius: 999px; padding: 11px 15px; font-size: 14.5px; font-family: inherit; color: var(--ink); outline: none; background: var(--page); min-width: 0; }
    .aria-input input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(217,107,67,.16); }
    .aria-mic { border: 1px solid var(--line-strong); background: var(--paper); color: var(--n-600); cursor: pointer; width: 42px; border-radius: 999px; display: grid; place-items: center; flex-shrink: 0; transition: all .15s; }
    .aria-mic:hover { border-color: var(--accent); color: var(--accent); }
    .aria-mic.is-live { background: var(--risk); border-color: var(--risk); color: #fff; animation: ariaMicPulse 1.3s ease-in-out infinite; }
    @keyframes ariaMicPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(182,71,47,.5); } 50% { box-shadow: 0 0 0 6px rgba(182,71,47,0); } }
    .aria-input button[type=submit] { width: 42px; border: none; border-radius: 999px; background: var(--accent); color: #fff; cursor: pointer; display: grid; place-items: center; flex-shrink: 0; overflow: hidden; transition: background .18s, transform .12s, box-shadow .18s; }
    .aria-send svg { transition: transform .18s var(--ease); }
    .aria-send.is-ready { background: linear-gradient(135deg, var(--accent), var(--accent-600)); box-shadow: 0 6px 16px -6px rgba(217,107,67,.7); }
    .aria-send.is-ready:hover { transform: translateY(-1px); }
    .aria-send.is-ready:hover svg { transform: translate(2px,-2px) rotate(6deg); }
    .aria-send.is-ready:active { transform: scale(.9); }
    .aria-send.is-launch svg { animation: ariaLaunch .34s cubic-bezier(.22,1,.36,1); }
    @keyframes ariaLaunch { 40% { transform: translate(10px,-10px) rotate(14deg); opacity: .2; } 41% { transform: translate(-8px,8px) rotate(0); opacity: 0; } 100% { transform: none; opacity: 1; } }
    .aria-input button:disabled { opacity: .45; cursor: default; box-shadow: none; }

    @media (prefers-reduced-motion: reduce) {
      .aria-fab, .aria-panel, .aria-thinking span, .aria-fab__pulse, .aria-fab__orb, .aria-msg, .aria-action, .aria-voice.is-on::after, .aria-send.is-launch svg { animation: none !important; }
      .aria-msg, .aria-action { opacity: 1 !important; transform: none !important; }
      .aria-scroll { scroll-behavior: auto; }
    }
    `}</style>
  );
}
