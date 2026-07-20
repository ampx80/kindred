// Fitness and Training engine. For the person whose body is part of the life
// they are building: lifters, runners, swimmers, cyclists, and anyone trying to
// move more. Aria programs real training scaled to their gear, days, and body,
// and always respects injuries. Four generative tools plus a self-contained
// interval timer, all warm, all personal.
import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../components/icons.jsx';
import { Card, Button, Field, Input, Select, Textarea, useToast } from '../../components/UI.jsx';
import { mdToHtml } from '../../lib/markdown.js';
import { buildProfileText, saveCreation, getProfile } from '../../lib/store.js';
import { celebrate } from '../../lib/celebrate.js';
import { haptic } from '../../lib/haptics.js';
import { sSuccess, sTap } from '../../lib/sound.js';

// Shared voice rules stitched into every generative systemPrompt so the whole
// engine sounds like one coach who already knows this person.
const VOICE = `Write as Aria, a warm, grounded strength coach who already knows this person from their profile. Speak to them directly as "you". No preamble, no restating the request, no sign-off. Output markdown only: use ## headings for each section, and bullet or numbered lists for anything with steps, sets, or reps. Be specific and confident with real numbers, never vague. Scale everything to the equipment and any injuries they name, and if something is unsafe for a stated injury, swap it and say why in one short line. Never use em-dashes or en-dashes; use a plain hyphen "-" only.`;

// A soft, self-contained interval timer. Rounds, work seconds, and rest
// seconds; Start, Pause, Reset; a big phase-colored countdown. setInterval is
// held in a ref and cleared on unmount, and the phase-change cue is optional
// and gated behind sound settings. No essential motion, so it is calm for
// reduced-motion users.
const TIMER_CSS = `
.ft-timer{display:flex;flex-direction:column;gap:1.1rem}
.ft-dial{position:relative;width:min(280px,80vw);aspect-ratio:1;margin:0 auto;border-radius:50%;
  display:grid;place-items:center;text-align:center;
  border:6px solid var(--ft-ring,var(--line));background:var(--ft-bg,var(--n-100));
  transition:background .25s ease,border-color .25s ease}
.ft-phase{font-weight:750;letter-spacing:.02em;text-transform:uppercase;font-size:.9rem;color:var(--ft-ink,var(--n-600))}
.ft-count{font-family:var(--font-display,inherit);font-weight:800;line-height:1;
  font-size:clamp(3.4rem,15vw,5.2rem);color:var(--ink)}
.ft-round{font-weight:650;color:var(--n-600);font-size:.95rem}
.ft-fields{display:grid;grid-template-columns:repeat(3,1fr);gap:.7rem}
.ft-pulse{animation:ftPulse 1s ease-in-out infinite}
@media (max-width:420px){.ft-fields{grid-template-columns:1fr}}
@keyframes ftPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
@media (prefers-reduced-motion: reduce){.ft-pulse{animation:none}}
`;

function clampInt(v, min, max, fallback) {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function IntervalTimer() {
  const toast = useToast();
  const [rounds, setRounds] = useState(8);
  const [work, setWork] = useState(30);
  const [rest, setRest] = useState(15);
  const [running, setRunning] = useState(false);
  // One state object so a phase change never fights a stale value.
  const [t, setT] = useState({ phase: 'idle', round: 1, left: 0 });
  const tickRef = useRef(null);
  const prevPhase = useRef('idle');

  // The heartbeat. Held in a ref, decrements once a second, and computes the
  // next phase itself so the whole transition is atomic.
  useEffect(() => {
    if (!running) return undefined;
    tickRef.current = setInterval(() => {
      setT(prev => {
        if (prev.phase === 'done' || prev.phase === 'idle') return prev;
        if (prev.left > 1) return { ...prev, left: prev.left - 1 };
        // The current phase just hit zero: decide what comes next.
        if (prev.phase === 'work') {
          if (rest > 0) return { phase: 'rest', round: prev.round, left: rest };
          if (prev.round >= rounds) return { phase: 'done', round: prev.round, left: 0 };
          return { phase: 'work', round: prev.round + 1, left: work };
        }
        // Resting: either start the next round or finish the whole set.
        if (prev.round >= rounds) return { phase: 'done', round: prev.round, left: 0 };
        return { phase: 'work', round: prev.round + 1, left: work };
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); tickRef.current = null; };
  }, [running, work, rest, rounds]);

  // Belt and suspenders: clear any live interval when the component unmounts.
  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  // Soft cue on every phase change, and stop cleanly when the set is done.
  useEffect(() => {
    if (t.phase !== prevPhase.current) {
      if (['work', 'rest', 'done'].includes(t.phase) && prevPhase.current !== 'idle') {
        sSuccess();
        haptic(t.phase === 'done' ? 'medium' : 'light');
      }
      if (t.phase === 'done') { setRunning(false); celebrate({ count: 40, y: window.innerHeight * 0.35 }); }
      prevPhase.current = t.phase;
    }
  }, [t.phase]); // eslint-disable-line

  const start = () => {
    sTap();
    if (t.phase === 'idle' || t.phase === 'done') {
      const r = clampInt(rounds, 1, 30, 8);
      const w = clampInt(work, 5, 600, 30);
      const rs = clampInt(rest, 0, 600, 15);
      setRounds(r); setWork(w); setRest(rs);
      prevPhase.current = 'start';
      setT({ phase: 'work', round: 1, left: w });
    }
    setRunning(true);
  };
  const pause = () => { sTap(); setRunning(false); };
  const reset = () => {
    sTap();
    setRunning(false);
    prevPhase.current = 'idle';
    setT({ phase: 'idle', round: 1, left: 0 });
  };

  const isWork = t.phase === 'work';
  const isRest = t.phase === 'rest';
  const isDone = t.phase === 'done';
  const dialStyle = isWork
    ? { '--ft-bg': 'var(--rose-bg)', '--ft-ring': 'var(--rose)', '--ft-ink': 'var(--rose)' }
    : isRest
      ? { '--ft-bg': 'var(--sage-bg)', '--ft-ring': 'var(--sage)', '--ft-ink': 'var(--sage)' }
      : isDone
        ? { '--ft-bg': 'var(--gold-bg)', '--ft-ring': 'var(--gold)', '--ft-ink': 'var(--gold)' }
        : { '--ft-bg': 'var(--n-100)', '--ft-ring': 'var(--line)', '--ft-ink': 'var(--n-600)' };
  const phaseLabel = isWork ? 'Work' : isRest ? 'Rest' : isDone ? 'Done' : 'Ready';
  const bigText = isDone ? 'Nice' : (t.phase === 'idle' ? String(work) : String(t.left));

  return (
    <Card pad={24}>
      <style>{TIMER_CSS}</style>
      <div className="ft-timer">
        <div className="col" style={{ gap: '.2rem' }}>
          <h2 style={{ margin: 0 }}>Interval timer</h2>
          <p className="muted" style={{ margin: 0 }}>Set your rounds, then hit start. Work turns rose, rest turns green, and Aria gives a soft cue at every switch.</p>
        </div>

        {(t.phase === 'idle') && (
          <div className="ft-fields">
            <Field label="Rounds">
              <Input type="number" inputMode="numeric" min={1} max={30} value={rounds}
                onChange={e => setRounds(e.target.value)} />
            </Field>
            <Field label="Work (seconds)">
              <Input type="number" inputMode="numeric" min={5} max={600} value={work}
                onChange={e => setWork(e.target.value)} />
            </Field>
            <Field label="Rest (seconds)">
              <Input type="number" inputMode="numeric" min={0} max={600} value={rest}
                onChange={e => setRest(e.target.value)} />
            </Field>
          </div>
        )}

        <div className="ft-dial" style={dialStyle} role="timer" aria-live="polite"
          aria-label={isDone ? 'Workout complete' : `${phaseLabel}, ${t.left} seconds, round ${t.round} of ${rounds}`}>
          <div className="col" style={{ gap: '.35rem' }}>
            <span className="ft-phase">{phaseLabel}</span>
            <span className={`ft-count${running && !isDone ? ' ft-pulse' : ''}`}>{bigText}</span>
            <span className="ft-round">{isDone ? `${rounds} rounds done` : `Round ${t.round} of ${rounds}`}</span>
          </div>
        </div>

        <div className="row gap-2 center wrap">
          {running
            ? <Button variant="warm" onClick={pause}><Icon name="moon" size={17} /> Pause</Button>
            : <Button variant="primary" onClick={start}><Icon name="flame" size={17} /> {t.phase === 'idle' || t.phase === 'done' ? 'Start' : 'Resume'}</Button>}
          <Button variant="ghost" onClick={reset}><Icon name="refresh" size={16} /> Reset</Button>
        </div>
      </div>
    </Card>
  );
}

const engine = {
  id: 'fitness',
  name: 'Fitness and Training',
  tagline: 'Real programmed training shaped to your body, gear, and goal.',
  emoji: '\u{1F4AA}',
  color: 'var(--accent-600)',
  bg: 'var(--accent-50)',
  keywords: ['workout', 'gym', 'lift', 'lifting', 'weightlifting', 'fitness', 'training', 'run', 'running', 'muscle', 'strength', 'exercise', 'cardio', 'mobility', 'athlete', 'fit', 'swim', 'cycle'],
  domains: ['body'],
  blurb: 'A coach in your pocket. Aria programs a full training week, maps out progressions, breaks down technique, and warms you up, all scaled to the equipment you have and careful with any injury you carry.',

  tools: [
    {
      id: 'weekly-plan',
      name: 'Weekly training plan',
      desc: 'A full week of sessions built around your goal, gear, and days.',
      icon: 'flame',
      feature: {
        id: 'fitness-weekly-plan',
        title: 'Weekly training plan',
        outputTitle: 'Your training week',
        blurb: 'A full week of programmed sessions, scaled to your equipment and safe for your body.',
        icon: 'flame',
        cta: 'Build my week',
        inputs: [
          { key: 'goal', label: 'Main goal', type: 'select', options: ['Build strength', 'Lose fat', 'Build muscle', 'Improve endurance', 'Move more', 'Mobility and flexibility'] },
          { key: 'equipment', label: 'What you have to train with', type: 'chips', options: ['Bodyweight only', 'Dumbbells', 'Kettlebell', 'Bands', 'Barbell', 'Pull-up bar', 'Full gym', 'Cardio machine', 'Yoga mat'] },
          { key: 'days', label: 'Days per week', type: 'select', options: ['2', '3', '4', '5', '6'] },
          { key: 'injuries', label: 'Injuries or limits (optional)', type: 'textarea', placeholder: 'e.g. cranky right knee, avoid overhead pressing, tight lower back' },
        ],
        systemPrompt: `${VOICE}

Build a full week of training for this person, matched to their goal, the exact days per week they chose, and only the equipment they listed. If they named any injury or limit, program around it and never through it.

## The week at a glance
- One short paragraph naming the goal and how this week serves it, plus a simple list of which day is which (for example, Day 1 lower body, Day 2 conditioning, and so on). Include only the number of training days they asked for; mark the remaining days as rest or easy movement.

## Day-by-day sessions
For every training day, use a "## Day N - [focus]" heading and inside it four labeled parts:
1. Warmup - 3 to 5 minutes of specific movements to prime that day's work.
2. Main work - the core lifts or intervals as a numbered list, each with concrete sets x reps and an RPE (for example, "3 x 5 at RPE 8"). Use only their equipment and scale loads to their level.
3. Finisher - one short, harder burst or accessory block with sets and reps.
4. Cooldown - 2 to 3 easy stretches or breathing, with times.

## Progression note
- One single line telling them exactly how to make next week harder (add reps, add load, or add a round).`,
      },
    },

    {
      id: 'progression',
      name: 'Progression plan',
      desc: 'A week-by-week path from where you are now to a real target.',
      icon: 'target',
      feature: {
        id: 'fitness-progression',
        title: 'Progression plan',
        outputTitle: 'Your progression plan',
        blurb: 'A numbers-driven, week-by-week build toward a specific lift, movement, or distance.',
        icon: 'target',
        cta: 'Map my progression',
        inputs: [
          { key: 'focus', label: 'What you are progressing', type: 'text', placeholder: 'e.g. back squat, pushups, a 5k run' },
          { key: 'currentLevel', label: 'Where you are now', type: 'text', placeholder: 'e.g. squat 135 lb x 5, or 8 pushups, or 5k in 34 min' },
          { key: 'weeks', label: 'How many weeks', type: 'select', options: ['4', '8', '12'] },
        ],
        systemPrompt: `${VOICE}

Build a week-by-week progression that takes this person from the level they described to a clear, realistic target for their chosen focus, across exactly the number of weeks they picked (default to 8 weeks if none is given). Ground everything in their stated starting numbers.

## Your target
- One or two lines naming the honest goal for the final week, based on their current level. Give a concrete number.

## Week-by-week build
- A numbered list, one entry per week ("Week 1", "Week 2", and so on for every week). For each week give the exact prescription with real numbers: sets x reps and load, or reps, or pace and distance. Progress the numbers sensibly week to week.

## Deload guidance
- Explain when to back off (a specific week, usually before the final push), by how much (for example, drop volume to about 60 percent), and how to know you need an unplanned deload (name 2 to 3 signals).

## If a week stalls
- 2 to 3 bullet fixes for when the numbers will not move.`,
      },
    },

    {
      id: 'technique',
      name: 'Technique and form',
      desc: 'A clean breakdown of any movement, with cues and fixes.',
      icon: 'book',
      feature: {
        id: 'fitness-technique',
        title: 'Technique and form',
        outputTitle: 'How to move well',
        blurb: 'Setup, cues, common mistakes, and the variations that make a movement easier or harder.',
        icon: 'book',
        cta: 'Break it down',
        inputs: [
          { key: 'movement', label: 'The movement', type: 'text', placeholder: 'e.g. deadlift, pull-up, kettlebell swing, running form' },
        ],
        systemPrompt: `${VOICE}

Break down the movement they named so they can perform it well and safely on their own.

## Setup
- A numbered list of how to get into position: stance, grip, brace, and anything to set before the first rep.

## Key cues
- 3 to 5 short, memorable cues to keep in mind during the movement.

## Common mistakes and fixes
- A bullet for each frequent error, written as "Mistake -> the fix" so the correction is obvious.

## How to know it is right
- 2 to 4 signals (feel, tempo, where they should feel it) that tell them they nailed it.

## Easier and harder
- One bullet for a simpler regression to build up to it, and one bullet for a harder progression once it feels easy.`,
      },
    },

    {
      id: 'mobility',
      name: 'Mobility and warmup',
      desc: 'A timed sequence to loosen up or prep for your session.',
      icon: 'leaf',
      feature: {
        id: 'fitness-mobility',
        title: 'Mobility and warmup',
        outputTitle: 'Your mobility flow',
        blurb: 'A timed, follow-along sequence with holds and reps for the area you choose.',
        icon: 'leaf',
        cta: 'Give me a flow',
        inputs: [
          { key: 'area', label: 'Focus area', type: 'select', options: ['Full body', 'Hips', 'Shoulders', 'Back', 'Knees', 'Pre-run', 'Desk relief'] },
          { key: 'minutes', label: 'How long', type: 'select', options: ['5', '10', '15'] },
        ],
        systemPrompt: `${VOICE}

Build a timed mobility and warmup sequence for the area they chose that fits inside the number of minutes they picked. The total of all the segment times must add up to that length.

## Your ${'flow'}
- One short line naming the focus area and what this flow will do for it.

## The sequence
- A numbered list of movements in order. For each one give the name and either a hold time (for example, "hold 30 seconds each side") or reps (for example, "8 slow reps"), so the times sum to the chosen length. Keep it flowing, easy to hard.

## Keep in mind
- 2 to 3 short cues on how to breathe and move through it, and one line on what to skip if anything pinches.`,
      },
    },

    {
      id: 'interval-timer',
      name: 'Interval timer',
      desc: 'A built-in rounds timer for intervals, HIIT, and circuits.',
      icon: 'refresh',
      Component: () => <IntervalTimer />,
    },
  ],

  daily: (ctx) => ({
    title: 'One move today',
    body: 'You do not have to train for an hour to stay in it. Do the one thing that counts: warm up, hit your main lift or your intervals, and call it a win. Let me build the week so every session already knows its job.',
    cta: 'Build my week',
    toolId: 'weekly-plan',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? profile.name.split(' ')[0] : 'this person';
    return `${name} trains their body and treats fitness as part of their real life. You can program full training weeks, map week-by-week progressions with concrete numbers, break down movement technique, and prescribe mobility work, all scaled to the equipment they actually have. Always ask about or account for injuries and never program through pain; swap movements and explain the safer choice in one line.`;
  },
};

export default engine;
