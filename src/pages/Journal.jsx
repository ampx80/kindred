// Journal - everything they say, time-stamped, so the record compounds.
// Aria reads it. Voice-to-text entry built in.
// A calm, focused place to write: rotating prompt, auto-growing composer,
// live word count, a warm save with a little celebration, gentle streak
// encouragement, and entry cards that feel good to read and re-open.
import { useState, useRef, useEffect, useMemo } from 'react';
import { Card, Button, useToast, EmptyState } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { useStore, addJournal } from '../lib/store.js';
import { burstFrom } from '../lib/celebrate.js';
import { MilestoneBurst, StreakFlame } from '../components/Delight.jsx';
import { sTap, sChime, sSuccess } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { track } from '../lib/track.js';

// Soft, open-ended invitations. Never a test, never a chore - just a doorway in.
const PROMPTS = [
  'What is one thing that felt true today?',
  'Who or what are you grateful for?',
  'What is weighing on you right now?',
  'What is one small win from today?',
  'What do you want to remember about today?',
  'What are you looking forward to?',
  'What did you notice about yourself lately?',
  'If today had a title, what would it be?',
  'What would make tomorrow a little lighter?',
  'What is something you can let go of tonight?',
];

const MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365];

// Warm, human relative time. Falls back to a short date past a week.
function relTime(at) {
  const then = new Date(at).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day} days ago`;
  return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// How many consecutive days ending today (or yesterday) have an entry.
function computeStreak(dayset) {
  const d = new Date();
  if (!dayset.has(d.toDateString())) {
    d.setDate(d.getDate() - 1);
    if (!dayset.has(d.toDateString())) return 0;
  }
  let n = 0;
  while (dayset.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

function sourceMeta(source) {
  if (!source || source === 'user') return null;
  if (source === 'reflection') return { label: 'Gratitude', tone: 'sage' };
  if (source === 'aria') return { label: 'via Aria', tone: 'accent' };
  return { label: 'via Aria', tone: 'accent' };
}

export default function Journal() {
  const journal = useStore(s => s.journal);
  const toast = useToast();
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [promptIdx, setPromptIdx] = useState(() => Math.floor(Math.random() * PROMPTS.length));
  const [focused, setFocused] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [milestone, setMilestone] = useState(0);
  const recogRef = useRef(null);
  const taRef = useRef(null);
  const saveRef = useRef(null);
  const savedTimer = useRef(null);

  useEffect(() => { track('journal_view'); }, []);

  // Rotate the prompt gently while idle. Pause once they start writing so we
  // never yank the words out from under them.
  useEffect(() => {
    if (focused || text.trim()) return;
    const id = setInterval(() => setPromptIdx(i => (i + 1) % PROMPTS.length), 8000);
    return () => clearInterval(id);
  }, [focused, text]);

  // Auto-grow the composer as they type (or speak).
  const autoGrow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 460) + 'px';
  };
  useEffect(() => { autoGrow(); }, [text]);
  useEffect(() => () => clearTimeout(savedTimer.current), []);

  const words = useMemo(() => {
    const t = text.trim();
    return t ? t.split(/\s+/).length : 0;
  }, [text]);

  const dayset = useMemo(() => new Set(journal.map(e => new Date(e.at).toDateString())), [journal]);
  const streak = useMemo(() => computeStreak(dayset), [dayset]);
  const daysTotal = dayset.size;

  const tap = () => { haptic('light'); sTap(); };

  const shufflePrompt = () => {
    tap();
    setPromptIdx(i => (i + 1 + Math.floor(Math.random() * (PROMPTS.length - 1))) % PROMPTS.length);
  };

  const speechOK = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
  const toggleMic = () => {
    tap();
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

  const save = (e) => {
    if (!text.trim()) return;
    const hadToday = dayset.has(new Date().toDateString());
    const r = addJournal(text);
    if (r.error) { haptic('warn'); return toast(r.message, 'warn'); }

    track('journal_saved', { words });
    haptic('success');
    sSuccess();
    const origin = e?.currentTarget || saveRef.current;
    if (origin) burstFrom(origin, { count: 64, spread: 0.85 });

    // Growing the streak into a milestone earns a bigger, warmer moment.
    if (!hadToday) {
      const next = streak + 1;
      if (MILESTONES.includes(next)) { setMilestone(next); sChime(); }
    }

    setText('');
    if (taRef.current) taRef.current.style.height = 'auto';
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 2800);
    toast('Kept. Aria will remember it.');
  };

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); save(); }
  };

  const toggleExpand = (id) => { tap(); setExpanded(cur => (cur === id ? null : id)); };
  const focusComposer = () => { tap(); taRef.current?.focus(); };

  const entries = [...journal].reverse();
  const groups = [];
  for (const en of entries) {
    const day = new Date(en.at).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    const g = groups.find(x => x.day === day);
    if (g) g.items.push(en); else groups.push({ day, items: [en] });
  }

  const streakLabel = streak > 0
    ? `${streak} day${streak === 1 ? '' : 's'} in a row`
    : (daysTotal > 0 ? `${daysTotal} day${daysTotal === 1 ? '' : 's'} written` : 'Your first line starts it');

  return (
    <div className="col gap-3 jr-page">
      <style>{JR_CSS}</style>
      <MilestoneBurst show={milestone} label="days in a row" sublabel="Look at you keeping this." onDone={() => setMilestone(0)} />

      <div className="row between" style={{ alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="col" style={{ gap: '.25rem' }}>
          <span className="eyebrow">Journal</span>
          <h1 className="serif">Say it here. It counts here.</h1>
        </div>
        <div className="jr-streak" title={streakLabel} aria-label={streakLabel}>
          <StreakFlame count={streak} size={26} showCount={false} />
          <div className="col" style={{ gap: 0, lineHeight: 1.15 }}>
            <b className="fw-7 tnum" style={{ fontSize: '1.02rem' }}>{streak > 0 ? streak : daysTotal}</b>
            <span className="muted t-xs">{streak > 0 ? 'day streak' : (daysTotal ? 'days written' : 'begin today')}</span>
          </div>
        </div>
      </div>

      <Card className={`card-pad jr-composer ${focused ? 'is-focused' : ''}`}>
        <button type="button" className="jr-prompt" onClick={shufflePrompt} aria-label="Show a different writing prompt">
          <Icon name="sparkles" size={15} />
          <span key={promptIdx} className="jr-prompt-text serif">{PROMPTS[promptIdx]}</span>
          <Icon name="pencil" size={13} className="jr-prompt-shuffle" />
        </button>

        <textarea
          ref={taRef}
          className="textarea jr-textarea serif"
          rows={3}
          value={text}
          onChange={e => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder={listening ? 'Listening... just talk.' : 'Type it or speak it. One honest line is enough.'}
        />

        <div className="jr-toolbar">
          <span className={`jr-count t-xs ${words ? 'is-on' : ''}`} aria-live="polite">
            {words === 0 ? 'A blank page, all yours' : `${words} word${words === 1 ? '' : 's'}`}
          </span>
          <div className="row gap-1" style={{ marginLeft: 'auto' }}>
            {speechOK && (
              <Button variant="ghost" size="sm" onClick={toggleMic} className={`jr-mic ${listening ? 'is-live' : ''}`}>
                <Icon name="mic" size={15} /> {listening ? 'Stop' : 'Speak'}
              </Button>
            )}
            <button ref={saveRef} type="button" className="btn btn-warm jr-save" onClick={save} disabled={!text.trim()}>
              <Icon name="check" size={16} /> Keep it
            </button>
          </div>
        </div>

        <div className={`jr-saved ${saved ? 'is-on' : ''}`} aria-hidden={!saved}>
          <Icon name="heart" size={13} /> Kept. Aria will remember it.
        </div>
      </Card>

      {groups.length === 0 ? (
        <EmptyState icon="book" title="Even one line counts"
          body="No pressure and no perfect words needed. A single honest sentence about today is a real entry."
          action={<Button variant="warm" onClick={focusComposer}><Icon name="pencil" size={15} /> Write your first line</Button>} />
      ) : (
        groups.map(g => (
          <div key={g.day} className="col gap-1">
            <div className="row gap-1" style={{ alignItems: 'center' }}>
              <span className="t-sm fw-7 muted" style={{ letterSpacing: '.04em', textTransform: 'uppercase' }}>{g.day}</span>
              <span className="jr-daycount t-xs muted">{g.items.length} {g.items.length === 1 ? 'entry' : 'entries'}</span>
            </div>
            <div className="col gap-1">
              {g.items.map((en, i) => {
                const src = sourceMeta(en.source);
                const isOpen = expanded === en.id;
                const long = (en.text || '').length > 220;
                return (
                  <Card
                    key={en.id}
                    className={`card-pad jr-entry ${isOpen ? 'is-open' : ''}`}
                    style={{ padding: '1.05rem 1.25rem', '--d': `${Math.min(i, 8) * 60}ms` }}
                    onClick={() => long && toggleExpand(en.id)}
                    role={long ? 'button' : undefined}
                    tabIndex={long ? 0 : undefined}
                    onKeyDown={long ? (ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggleExpand(en.id); } }) : undefined}
                  >
                    <p className={`serif jr-text ${!isOpen && long ? 'is-clamped' : ''}`}>{en.text}</p>
                    <div className="jr-entry-foot">
                      <span className="muted t-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: '.35rem' }}>
                        <Icon name="calendar" size={12} />
                        {relTime(en.at)}
                        <span style={{ opacity: .5 }}>&middot;</span>
                        {new Date(en.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                      </span>
                      <span className="row gap-1" style={{ marginLeft: 'auto', alignItems: 'center' }}>
                        {src && <span className={`badge badge-${src.tone} t-xs`}>{src.label}</span>}
                        {long && <span className="jr-more t-xs">{isOpen ? 'Show less' : 'Read more'}</span>}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

const JR_CSS = `
.jr-streak {
  display: inline-flex; align-items: center; gap: .55rem;
  padding: .4rem .8rem .4rem .55rem; border-radius: var(--r-pill);
  background: var(--gold-bg); border: 1px solid var(--line);
}
.jr-composer {
  position: relative; overflow: hidden;
  transition: box-shadow .35s var(--ease), border-color .35s var(--ease), transform .35s var(--ease);
}
.jr-composer.is-focused {
  border-color: var(--accent-300);
  box-shadow: 0 0 0 4px var(--accent-50), var(--shadow-sm, 0 6px 22px rgba(0,0,0,.06));
}
.jr-prompt {
  display: flex; align-items: center; gap: .55rem; width: 100%;
  background: var(--accent-50); color: var(--accent-700);
  border: 1px solid transparent; border-radius: var(--r-md);
  padding: .62rem .8rem; margin-bottom: .7rem; text-align: left; cursor: pointer;
  transition: background .25s var(--ease), border-color .25s var(--ease);
}
.jr-prompt:hover { border-color: var(--accent-300); }
.jr-prompt-text { flex: 1; min-width: 0; font-size: 1.02rem; }
.jr-prompt-shuffle { opacity: .55; flex: none; }
.jr-textarea {
  width: 100%; resize: none; overflow-y: auto; min-height: 96px;
  font-size: 1.1rem; line-height: 1.65; border: none; background: transparent;
  padding: .1rem .1rem; box-shadow: none;
}
.jr-textarea:focus { outline: none; box-shadow: none; }
.jr-toolbar {
  display: flex; align-items: center; gap: .6rem; flex-wrap: wrap;
  margin-top: .7rem; padding-top: .7rem; border-top: 1px solid var(--line);
}
.jr-count { color: var(--n-400); transition: color .25s var(--ease); }
.jr-count.is-on { color: var(--accent-600); font-weight: 600; }
.jr-mic.is-live {
  background: var(--rose-bg) !important; color: var(--rose) !important;
  border-color: var(--rose) !important;
}
.jr-save:disabled { opacity: .5; cursor: default; }
.jr-saved {
  display: inline-flex; align-items: center; gap: .4rem;
  color: var(--sage); font-size: .82rem; font-weight: 600;
  max-height: 0; opacity: 0; margin-top: 0;
  transition: max-height .4s var(--ease), opacity .4s var(--ease), margin-top .4s var(--ease);
}
.jr-saved.is-on { max-height: 40px; opacity: 1; margin-top: .7rem; }
.jr-daycount::before { content: '\\00B7'; margin: 0 .4rem; }
.jr-entry {
  animation: jrBreatheIn .55s var(--ease) both;
  animation-delay: var(--d, 0ms);
  transition: box-shadow .28s var(--ease), transform .28s var(--ease), border-color .28s var(--ease);
}
.jr-entry[role="button"] { cursor: pointer; }
.jr-entry[role="button"]:hover {
  border-color: var(--accent-300);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm, 0 6px 22px rgba(0,0,0,.06));
}
.jr-text {
  font-size: 1.09rem; line-height: 1.68; margin: 0; white-space: pre-wrap; color: var(--ink);
}
.jr-text.is-clamped {
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
}
.jr-entry-foot {
  display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; margin-top: .7rem;
}
.jr-more { color: var(--accent-600); font-weight: 700; }
@keyframes jrBreatheIn {
  0% { opacity: 0; transform: translateY(10px) scale(.985); }
  60% { opacity: 1; }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes jrPromptIn {
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
}
.jr-prompt-text { animation: jrPromptIn .4s var(--ease) both; }
@media (prefers-reduced-motion: reduce) {
  .jr-entry, .jr-prompt-text { animation: none !important; }
  .jr-composer, .jr-entry, .jr-saved, .jr-count { transition: none !important; }
}
`;
