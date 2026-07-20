// Learning and Mastery engine. Aria's module for anyone learning a language or
// any skill: it builds real roadmaps, spaced-repetition recall sets, layered
// explanations, single-session practice drills, and runs a focused study timer.
// Auto-registered by ../index.js (no wiring needed). Generative tools are plain
// config objects handed to the shared FeatureRunner; the timer is a bespoke,
// self-contained content component. Scoped styles only, reduced-motion aware,
// ASCII hyphen only (no em or en dashes anywhere).
import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../components/icons.jsx';
import { Card, Button, Field, Input, Select } from '../../components/UI.jsx';
import { sSuccess } from '../../lib/sound.js';

// Shared voice + output contract every generative tool in this engine inherits.
// FeatureRunner already sends the person's profile and their filled inputs, so
// each systemPrompt just needs to define the shape and hold the quality bar.
const HOUSE_STYLE = `You are Aria, a warm, sharp learning coach who knows this person from their profile.
Write directly to them as "you". Use markdown only: ## headings, short paragraphs, and - bullets.
Be specific and genuinely useful, never generic filler. Ground advice in evidence-based learning
(active recall, spaced repetition, interleaving, deliberate practice) without lecturing about the theory.
Never use em dashes or en dashes. Use a plain ASCII hyphen only. Keep it tight enough to actually act on today.`;

// The study / pomodoro timer. Pick a subject and lengths, then run a reliable
// focus + break cycle with a big countdown and a soft chime on every switch.
// Everything lives in this component: one interval, cleared on unmount.
function FocusSession() {
  const LENGTHS = [25, 45, 50];
  const BREAKS = [5, 10];

  const [subject, setSubject] = useState('');
  const [focusMin, setFocusMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [mode, setMode] = useState('focus'); // 'focus' | 'break'
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [rounds, setRounds] = useState(0); // completed focus blocks
  const [started, setStarted] = useState(false);

  const tickRef = useRef(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    try {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      reduceMotion.current = mq.matches;
      const on = () => { reduceMotion.current = mq.matches; };
      mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
      return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on); };
    } catch { /* matchMedia not available */ }
  }, []);

  // When lengths change while idle, keep the display in sync with the picker.
  useEffect(() => {
    if (!started) setSecondsLeft((mode === 'focus' ? focusMin : breakMin) * 60);
  }, [focusMin, breakMin, mode, started]);

  const clearTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };

  // The one source of truth for the countdown. Restarts the interval whenever
  // we begin running, and always clears on unmount or pause.
  useEffect(() => {
    if (!running) { clearTick(); return; }
    clearTick();
    tickRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev > 1) return prev - 1;
        // Reached zero: flip Focus <-> Break, chime, load the next duration.
        try { sSuccess(); } catch { /* audio off */ }
        setMode(m => {
          const next = m === 'focus' ? 'break' : 'focus';
          if (m === 'focus') setRounds(r => r + 1);
          setSecondsLeft((next === 'focus' ? focusMin : breakMin) * 60);
          return next;
        });
        return 0;
      });
    }, 1000);
    return clearTick;
  }, [running, focusMin, breakMin]);

  // Clear any lingering interval when the component leaves the screen.
  useEffect(() => () => clearTick(), []);

  const start = () => { setStarted(true); setRunning(true); };
  const pause = () => setRunning(false);
  const reset = () => {
    setRunning(false); clearTick();
    setMode('focus'); setRounds(0); setStarted(false);
    setSecondsLeft(focusMin * 60);
  };

  const total = (mode === 'focus' ? focusMin : breakMin) * 60;
  const elapsed = Math.max(0, total - secondsLeft);
  const pct = total > 0 ? Math.min(1, elapsed / total) : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const ss = String(secondsLeft % 60).padStart(2, '0');

  // SVG ring geometry.
  const R = 86, C = 2 * Math.PI * R;
  const dash = C * (1 - pct);
  const isFocus = mode === 'focus';
  const ringColor = isFocus ? 'var(--accent-600)' : 'var(--sage)';

  return (
    <div className="ls-timer">
      <style>{TIMER_CSS}</style>

      <Card pad={22}>
        <div className="col gap-3">
          <Field label="What are you focusing on?">
            <Input
              placeholder="e.g. Spanish verbs, calculus, guitar chords"
              value={subject}
              onChange={e => setSubject(e.target.value)}
            />
          </Field>
          <div className="row gap-2 wrap">
            <Field label="Focus length">
              <Select value={focusMin} onChange={e => setFocusMin(Number(e.target.value))} disabled={started}>
                {LENGTHS.map(m => <option key={m} value={m}>{m} min</option>)}
              </Select>
            </Field>
            <Field label="Break">
              <Select value={breakMin} onChange={e => setBreakMin(Number(e.target.value))} disabled={started}>
                {BREAKS.map(m => <option key={m} value={m}>{m} min</option>)}
              </Select>
            </Field>
          </div>
        </div>
      </Card>

      <Card pad={26} className="ls-dial-card" style={{ '--ls-ring': ringColor }}>
        <span className={`ls-mode ${isFocus ? 'is-focus' : 'is-break'}`}>
          <Icon name={isFocus ? 'flame' : 'leaf'} size={14} /> {isFocus ? 'Focus' : 'Break'}
        </span>

        <div className={`ls-dial ${running && !reduceMotion.current ? 'is-live' : ''}`} role="timer" aria-live="polite"
          aria-label={`${isFocus ? 'Focus' : 'Break'} time remaining ${mm} minutes ${ss} seconds`}>
          <svg viewBox="0 0 200 200" width="200" height="200" aria-hidden>
            <circle cx="100" cy="100" r={R} fill="none" stroke="var(--line)" strokeWidth="12" />
            <circle cx="100" cy="100" r={R} fill="none" stroke="var(--ls-ring)" strokeWidth="12"
              strokeLinecap="round" strokeDasharray={C} strokeDashoffset={dash}
              transform="rotate(-90 100 100)" style={{ transition: 'stroke-dashoffset 1s linear' }} />
          </svg>
          <div className="ls-count">
            <span className="ls-clock">{mm}:{ss}</span>
            <span className="ls-sub">{subject ? subject : (isFocus ? 'Deep work' : 'Rest your mind')}</span>
          </div>
        </div>

        <div className="row gap-2 center wrap">
          {!running
            ? <Button variant="primary" onClick={start}><Icon name="flame" size={16} /> {started ? 'Resume' : 'Start'}</Button>
            : <Button variant="warm" onClick={pause}><Icon name="moon" size={16} /> Pause</Button>}
          <Button variant="ghost" onClick={reset}><Icon name="refresh" size={16} /> Reset</Button>
        </div>

        <p className="ls-rounds muted t-sm">
          {rounds > 0
            ? `${rounds} focus ${rounds === 1 ? 'block' : 'blocks'} done today. One more rep counts.`
            : 'One honest block beats a perfect plan you never start.'}
        </p>
      </Card>
    </div>
  );
}

const TIMER_CSS = `
.ls-timer{display:flex;flex-direction:column;gap:1rem}
.ls-dial-card{text-align:center}
.ls-mode{display:inline-flex;align-items:center;gap:.35rem;font-size:.82rem;font-weight:700;
  padding:.28rem .7rem;border-radius:var(--r-pill);margin-bottom:1rem}
.ls-mode.is-focus{color:var(--accent-700);background:var(--accent-50)}
.ls-mode.is-break{color:var(--sage);background:var(--sage-bg)}
.ls-dial{position:relative;width:200px;height:200px;margin:0 auto .4rem}
.ls-dial.is-live{animation:lsBreathe 4s ease-in-out infinite}
.ls-count{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.2rem}
.ls-clock{font-family:var(--font-display,inherit);font-weight:700;font-size:2.9rem;line-height:1;color:var(--ink);
  font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.ls-sub{font-size:.82rem;color:var(--n-500);max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ls-rounds{margin:1rem 0 0}
@keyframes lsBreathe{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}
@media (prefers-reduced-motion: reduce){.ls-dial.is-live{animation:none}}
`;

const engine = {
  id: 'learning',
  name: 'Learning and Mastery',
  tagline: 'Learn anything faster, and actually remember it.',
  emoji: '\u{1F393}',
  color: 'var(--sky)',
  bg: 'var(--sky-bg)',
  blurb: 'Aria turns any subject or skill into a real plan: a milestone roadmap, recall sets that beat forgetting, clear explanations, targeted drills, and a focus timer to put in the reps.',
  keywords: ['learn', 'learning', 'study', 'language', 'spanish', 'french', 'german', 'japanese', 'skill', 'course', 'practice', 'master', 'memorize', 'exam', 'school', 'student', 'knowledge', 'curious'],
  domains: ['learning', 'work'],

  tools: [
    {
      id: 'roadmap',
      name: 'Learning roadmap',
      desc: 'A milestone plan from where you are to real fluency or skill.',
      icon: 'compass',
      feature: {
        id: 'learning-roadmap',
        title: 'Learning roadmap',
        outputTitle: 'Your learning roadmap',
        blurb: 'Tell Aria what you want to learn and how much time you have. She maps the milestones, the best resources, and a weekly rhythm.',
        icon: 'compass',
        cta: 'Build my roadmap',
        inputs: [
          { key: 'subject', label: 'What do you want to learn?', type: 'text', placeholder: 'e.g. Spanish, guitar, machine learning' },
          { key: 'level', label: 'Where are you now?', type: 'select', options: ['Total beginner', 'Some basics', 'Intermediate', 'Advanced'] },
          { key: 'weeklyHours', label: 'Hours you can give each week', type: 'select', options: ['2', '4', '7', '10+'] },
        ],
        systemPrompt: `${HOUSE_STYLE}

Build a milestone roadmap to learn the subject the person named, calibrated to their current level and weekly hours.
Include, using ## headings:
- A short honest read on how long real progress will take at their pace.
- The milestones as ordered phases. For each phase give a name, a concrete "you can now..." outcome, and the 2 or 3 things to focus on.
- The best resources, split into a Free list and a Paid list, named specifically (courses, apps, books, channels) and matched to their level. Say what each is best for.
- A weekly rhythm that fits their available hours: what to do on which days so the plan survives a busy week.
- How to test yourself so you know a phase is truly done before moving on (self-checks, projects, or a way to prove the outcome).
End with one small first step they can take in the next 20 minutes.`,
      },
    },
    {
      id: 'recall',
      name: 'Spaced repetition set',
      desc: 'Recall prompts plus a review schedule that beats forgetting.',
      icon: 'refresh',
      feature: {
        id: 'learning-recall',
        title: 'Spaced repetition set',
        outputTitle: 'Your recall set',
        blurb: 'Paste in a topic and Aria writes a full set of recall prompts, ordered by difficulty, with a simple review schedule.',
        icon: 'refresh',
        cta: 'Make my recall set',
        inputs: [
          { key: 'topic', label: 'What topic should the set cover?', type: 'textarea', placeholder: 'e.g. Spanish present tense, the French Revolution, React hooks, guitar CAGED shapes' },
        ],
        systemPrompt: `${HOUSE_STYLE}

Generate a high-quality spaced-repetition recall set for the topic the person gave.
Produce 15 to 25 prompts, ordered from foundational to advanced.
Format each prompt as exactly two lines: the question on one line, then the answer on the next line. Separate prompts with a blank line.
Write questions that force active recall of one specific idea each (no vague "explain everything" prompts, no giveaway hints).
Answers must be correct, complete, and concise.
Use a ## heading for the prompts section.
Then add a ## Review schedule section explaining the spaced plan in plain terms: review on day 1, day 3, day 7, and day 16, re-testing only the prompts you missed each time, and what to do when one keeps slipping.`,
      },
    },
    {
      id: 'explain',
      name: 'Explain it to me',
      desc: 'Any concept at three levels, with an analogy and a gotcha.',
      icon: 'sparkles',
      feature: {
        id: 'learning-explain',
        title: 'Explain it to me',
        outputTitle: 'Explained for you',
        blurb: 'Name a concept you are stuck on. Aria explains it three ways, from brand new to expert, with an analogy that sticks.',
        icon: 'sparkles',
        cta: 'Explain it',
        inputs: [
          { key: 'concept', label: 'What concept should Aria explain?', type: 'text', placeholder: 'e.g. the subjunctive, backpropagation, compound interest' },
        ],
        systemPrompt: `${HOUSE_STYLE}

Explain the concept the person named at three levels, each under its own ## heading:
- ## Like I am new: plain, friendly, zero jargon, the core idea only.
- ## Intermediate: the mechanism, the key terms defined as they appear, and how the pieces fit.
- ## Expert: the nuance, edge cases, and how it connects to the bigger picture someone advanced would care about.
Then add:
- ## An analogy that sticks: one vivid, everyday analogy that makes the idea click.
- ## One common misconception: the mistake most people make about this, and the correction.
Keep each level genuinely distinct so the person can feel the concept deepen as they read.`,
      },
    },
    {
      id: 'drills',
      name: 'Practice drills',
      desc: 'Concrete drills for one focused session, plus a stretch.',
      icon: 'target',
      feature: {
        id: 'learning-drills',
        title: 'Practice drills',
        outputTitle: 'Your practice drills',
        blurb: 'Pick a skill or language and how long you have. Aria writes drills you can start right now, ending with a stretch challenge.',
        icon: 'target',
        cta: 'Give me drills',
        inputs: [
          { key: 'skillOrLanguage', label: 'What skill or language?', type: 'text', placeholder: 'e.g. Spanish speaking, sight-reading, public speaking' },
          { key: 'minutes', label: 'How long is this session?', type: 'select', options: ['10', '20', '30'] },
        ],
        systemPrompt: `${HOUSE_STYLE}

Design a set of concrete practice drills for a single focused session of the length the person chose, aimed at the skill or language they named.
Use ## headings and make it a session they can run without any further setup:
- ## Warm up: one short drill to get going.
- ## Core drills: 2 to 4 drills that build the target skill. For each, give clear step-by-step instructions, what "good" looks like, and roughly how many minutes to spend so the whole set fits the time available.
- ## Stretch challenge: one harder drill that pushes just past their comfort zone.
Favor active production and deliberate practice over passive review. Be concrete: real prompts, real reps, real examples, not "practice more".`,
      },
    },
    {
      id: 'focus',
      name: 'Focus session',
      desc: 'A study timer that runs your focus and break cycle.',
      icon: 'flame',
      Component: FocusSession,
    },
  ],

  daily: () => ({
    title: 'One small rep today',
    body: 'Mastery is built in small, honest reps. Pick the one thing you are learning and give it a single focused push today. If you do not have a plan yet, let Aria map the whole path first.',
    cta: 'Build my roadmap',
    toolId: 'roadmap',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? profile.name : 'this person';
    return `${name} is actively learning something (a language or a skill). In this Learning and Mastery engine, Aria can build a milestone roadmap, generate spaced-repetition recall sets, explain hard concepts at multiple levels, design single-session practice drills, and run a focus timer. Nudge toward small consistent reps, active recall, and testing yourself over passive review.`;
  },
};

export default engine;
