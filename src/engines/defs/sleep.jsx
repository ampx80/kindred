// Sleep and Rest - a Life Engine for the person who wants to fall asleep easier
// and wake up actually rested. One bespoke content tool (a calming wind-down:
// a tappable step checklist plus a 10-minute settle timer with a slowly dimming
// orb that respects reduced-motion) and four generative tools rendered by the
// shared FeatureRunner. Warm and non-clinical: serious or chronic sleep trouble
// is always pointed back toward a doctor.
import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../components/icons.jsx';
import { Card, Button, Field, Input, Select, Textarea, useToast } from '../../components/UI.jsx';
import { mdToHtml } from '../../lib/markdown.js';
import { buildProfileText, saveCreation, getProfile } from '../../lib/store.js';

// Shared voice rules stitched into every generative systemPrompt so the whole
// engine sounds like one calm guide who already knows this person. The
// non-clinical guardrail lives here so every tool honors it.
const VOICE = `Write as Aria, a warm, calm sleep guide who already knows this person from their profile. Speak to them directly as "you". No preamble, no restating the request, no sign-off. Output markdown only: use ## headings for each section, and bullet or numbered lists for anything with steps. Be specific and gentle, never clinical or alarming. Keep advice to everyday sleep hygiene, not medical treatment. If they describe something that sounds serious or chronic (loud snoring with gasping, long-running insomnia, pain, or heavy daytime exhaustion), add one short, kind line encouraging them to talk with a doctor. Never diagnose, never prescribe medication or supplements as a fix. Never use em-dashes or en-dashes; use a plain hyphen "-" only.`;

// The wind-down steps. Each is a small, doable action for the last stretch
// before sleep. Order runs from the room to the body to the mind.
const WIND_STEPS = [
  { id: 'lights', icon: 'moon', label: 'Dim the lights', note: 'Soft and low, let your body read that it is night.' },
  { id: 'screens', icon: 'x', label: 'Screens away', note: 'Phone face down and across the room if you can.' },
  { id: 'tea', icon: 'leaf', label: 'Something warm', note: 'Caffeine-free tea or just warm water.' },
  { id: 'stretch', icon: 'refresh', label: 'A gentle stretch', note: 'Loosen the neck, shoulders, and back for a minute.' },
  { id: 'gratitude', icon: 'heart', label: 'One good thing', note: 'Name a single moment from today you are glad about.' },
  { id: 'breathe', icon: 'sparkles', label: 'Slow breaths', note: 'In for four, out for six, a few easy rounds.' },
];

// Ten minutes, in seconds, for the settle timer.
const SETTLE_SECONDS = 600;

const WINDDOWN_CSS = `
.sl-wind{display:flex;flex-direction:column;gap:1.1rem}
.sl-intro{display:flex;flex-direction:column;gap:.25rem}
.sl-progress{display:inline-flex;align-items:center;gap:.4rem;font-size:.78rem;font-weight:700;
  letter-spacing:.02em;text-transform:uppercase;color:var(--sky);background:var(--sky-bg);
  padding:.3rem .68rem;border-radius:var(--r-pill);width:fit-content}
.sl-steps{display:flex;flex-direction:column;gap:.6rem;list-style:none;margin:0;padding:0}
.sl-step{display:flex;align-items:center;gap:.8rem;width:100%;text-align:left;cursor:pointer;
  padding:.85rem .95rem;border-radius:var(--r-md);border:1px solid var(--line);
  background:var(--paper);color:var(--ink);transition:background .18s ease,border-color .18s ease,transform .12s ease}
.sl-step:hover{border-color:var(--sky);transform:translateY(-1px)}
.sl-step.done{background:var(--sky-bg);border-color:var(--sky)}
.sl-step-ico{display:grid;place-items:center;flex:0 0 auto;width:38px;height:38px;border-radius:12px;
  background:var(--n-100);color:var(--n-600);transition:background .18s ease,color .18s ease}
.sl-step.done .sl-step-ico{background:var(--sky);color:var(--paper)}
.sl-step-text{display:flex;flex-direction:column;gap:.1rem;min-width:0;flex:1}
.sl-step-label{font-weight:650;transition:color .18s ease}
.sl-step.done .sl-step-label{color:var(--sky)}
.sl-step-note{font-size:.82rem;color:var(--n-500)}
.sl-step-check{flex:0 0 auto;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;
  border:2px solid var(--line);color:transparent;transition:all .18s ease}
.sl-step.done .sl-step-check{border-color:var(--sky);background:var(--sky);color:var(--paper)}
.sl-timer{display:flex;flex-direction:column;gap:1rem;align-items:center;text-align:center}
.sl-orb{position:relative;width:min(220px,64vw);aspect-ratio:1;border-radius:50%;display:grid;place-items:center;
  background:radial-gradient(circle at 50% 40%, var(--sky) 0%, var(--sky-bg) 72%);
  box-shadow:0 0 60px -12px var(--sky);transition:opacity 1s linear,box-shadow 1s linear}
.sl-orb-count{font-family:var(--font-display,inherit);font-weight:800;line-height:1;
  font-size:clamp(2.6rem,11vw,3.6rem);color:var(--ink)}
.sl-orb-label{font-size:.8rem;font-weight:700;letter-spacing:.03em;text-transform:uppercase;color:var(--n-600);margin-top:.3rem}
.sl-done-note{color:var(--sky);font-weight:650}
@media (prefers-reduced-motion: reduce){
  .sl-step:hover{transform:none}
  .sl-orb{transition:none;opacity:1 !important}
}
`;

function pad2(n) {
  return String(n).padStart(2, '0');
}

// The calming wind-down. A tappable checklist of gentle steps with a soft,
// satisfying done state, and a 10-minute settle timer whose orb slowly dims as
// the minutes pass. Under prefers-reduced-motion the orb never dims (opacity is
// pinned to 1) and only the numbers change. The countdown interval lives in a
// ref and is cleared on unmount and whenever it is paused. Fully self-contained.
function WindDown() {
  const toast = useToast();
  const [done, setDone] = useState({});
  const [left, setLeft] = useState(SETTLE_SECONDS);
  const [running, setRunning] = useState(false);
  const tickRef = useRef(null);
  const reduceRef = useRef(false);

  // Read the reduced-motion preference once, so the orb dimming can be skipped.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    reduceRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // The countdown heartbeat. Held in a ref, decrements once a second, and stops
  // itself at zero. Cleared on pause and on unmount.
  useEffect(() => {
    if (!running) return undefined;
    tickRef.current = setInterval(() => {
      setLeft(prev => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };
  }, [running]);

  // Belt and suspenders: clear any live interval when the component unmounts.
  useEffect(() => () => { if (tickRef.current) clearInterval(tickRef.current); }, []);

  // Stop cleanly the moment the timer reaches zero.
  useEffect(() => {
    if (left === 0 && running) {
      setRunning(false);
      toast('Settle complete. Rest easy.', 'success');
    }
  }, [left, running]); // eslint-disable-line

  const toggleStep = (id) => {
    setDone(prev => {
      const next = { ...prev, [id]: !prev[id] };
      if (!prev[id]) {
        const count = Object.values(next).filter(Boolean).length;
        if (count === WIND_STEPS.length) toast('Every step done. You are ready for sleep.', 'success');
      }
      return next;
    });
  };

  const start = () => { setRunning(true); };
  const pause = () => { setRunning(false); };
  const reset = () => { setRunning(false); setLeft(SETTLE_SECONDS); };

  const doneCount = Object.values(done).filter(Boolean).length;
  const mins = Math.floor(left / 60);
  const secs = left % 60;
  const isSettled = left === 0;
  // The orb fades from full to a dim glow as the ten minutes pass. Pinned to
  // full for reduced-motion users so nothing moves for them.
  const progress = 1 - (left / SETTLE_SECONDS);
  const orbOpacity = reduceRef.current ? 1 : Math.max(0.28, 1 - progress * 0.62);

  return (
    <div className="sl-wind">
      <style>{WINDDOWN_CSS}</style>

      <Card pad={24}>
        <div className="sl-intro">
          <h2 style={{ margin: 0 }}>Wind-down</h2>
          <p className="muted" style={{ margin: '.35rem 0 0' }}>
            Move through these at your own pace. Tap each one as you go, then let the settle timer carry you the rest of the way down.
          </p>
        </div>

        <span className="sl-progress" style={{ marginTop: '1rem' }}>
          <Icon name="moon" size={13} /> {doneCount} of {WIND_STEPS.length} done
        </span>

        <ul className="sl-steps" style={{ marginTop: '1rem' }}>
          {WIND_STEPS.map(step => {
            const isDone = !!done[step.id];
            return (
              <li key={step.id}>
                <button
                  type="button"
                  className={`sl-step${isDone ? ' done' : ''}`}
                  onClick={() => toggleStep(step.id)}
                  aria-pressed={isDone}
                  aria-label={`${step.label}${isDone ? ', done' : ''}`}
                >
                  <span className="sl-step-ico"><Icon name={step.icon} size={18} /></span>
                  <span className="sl-step-text">
                    <span className="sl-step-label">{step.label}</span>
                    <span className="sl-step-note">{step.note}</span>
                  </span>
                  <span className="sl-step-check"><Icon name="check" size={14} /></span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card pad={26}>
        <div className="sl-timer">
          <div className="col" style={{ gap: '.2rem' }}>
            <h2 style={{ margin: 0 }}>Settle</h2>
            <p className="muted" style={{ margin: '.3rem 0 0' }}>
              Ten quiet minutes. Close your eyes, breathe slow, and let the light fade.
            </p>
          </div>

          <div
            className="sl-orb"
            style={{ opacity: orbOpacity }}
            role="timer"
            aria-live="polite"
            aria-label={isSettled ? 'Settle complete' : `${mins} minutes ${secs} seconds left`}
          >
            <div className="col center" style={{ gap: 0 }}>
              <span className="sl-orb-count">{isSettled ? 'Rest' : `${pad2(mins)}:${pad2(secs)}`}</span>
              <span className="sl-orb-label">{isSettled ? 'well' : running ? 'settling' : 'ready'}</span>
            </div>
          </div>

          {isSettled && (
            <p className="sl-done-note" style={{ margin: 0 }}>Ten minutes down. Let sleep take it from here.</p>
          )}

          <div className="row gap-2 center" style={{ flexWrap: 'wrap' }}>
            {running
              ? <Button variant="warm" onClick={pause}><Icon name="moon" size={17} /> Pause</Button>
              : <Button variant="primary" onClick={start} disabled={isSettled}><Icon name="sparkles" size={17} /> {left === SETTLE_SECONDS ? 'Begin settle' : 'Resume'}</Button>}
            <Button variant="ghost" onClick={reset}><Icon name="refresh" size={16} /> Reset</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

const engine = {
  id: 'sleep',
  name: 'Sleep and Rest',
  tagline: 'Fall asleep easier and wake up actually rested.',
  emoji: '\u{1F319}',
  color: 'var(--sky)',
  bg: 'var(--sky-bg)',
  keywords: ['sleep', 'rest', 'tired', 'insomnia', 'bedtime', 'nap', 'wind down', 'winddown', 'fatigue', 'recovery', 'exhausted', 'restless', 'melatonin'],
  domains: ['rest', 'body'],
  blurb: 'A calmer path to real rest. Aria helps you wind down at night, builds a sleep plan around your specific struggle, walks you through the 3am wakeups, and gently resets a schedule that has drifted. Everyday sleep hygiene, never medical advice - anything serious or long-running deserves a doctor.',

  tools: [
    {
      id: 'wind-down',
      name: 'Wind-down',
      desc: 'A calming bedtime checklist and a 10-minute settle timer.',
      icon: 'moon',
      Component: WindDown,
    },

    {
      id: 'sleep-plan',
      name: 'Sleep plan',
      desc: 'A personalized sleep-hygiene plan for your specific struggle.',
      icon: 'target',
      feature: {
        id: 'sleep-plan',
        title: 'Sleep plan',
        outputTitle: 'Your sleep plan',
        blurb: 'A gentle, personalized sleep-hygiene plan built around the exact thing you are struggling with.',
        icon: 'target',
        cta: 'Build my sleep plan',
        inputs: [
          { key: 'struggle', label: 'What is hardest for you right now?', type: 'select', options: ['Falling asleep', 'Waking at night', 'Waking too early', 'Never feeling rested', 'Irregular schedule'] },
          { key: 'details', label: 'Anything else about your nights? (optional)', type: 'textarea', placeholder: 'e.g. mind races at bedtime, noisy street, up with a newborn, big work stress' },
        ],
        systemPrompt: `${VOICE}

Build a personalized sleep-hygiene plan aimed squarely at the specific struggle this person chose, using the details they shared and what you know of their life. Keep it realistic and kind, not a rigid overhaul.

## What is likely going on
- Two or three short, non-clinical bullets on the everyday reasons this particular struggle tends to happen, tied to their situation. Reassure, do not alarm.

## Your plan
- A focused list of concrete sleep-hygiene changes that target their struggle directly (light, timing, wind-down, caffeine, the bedroom, the racing mind). Be specific and doable, not a generic list.

## Your first week
- A simple day-by-day or few-days-at-a-time starter so week one feels easy, not like a project. Pick the two or three changes that matter most and stage the rest.

## When to get help
- One short, kind line: if this has gone on for weeks, or comes with loud snoring and gasping, real pain, or heavy daytime exhaustion, it is worth a conversation with a doctor.`,
      },
    },

    {
      id: 'bedtime-routine',
      name: 'Bedtime routine',
      desc: 'A step-by-step calming routine sized to the time you have.',
      icon: 'leaf',
      feature: {
        id: 'sleep-bedtime-routine',
        title: 'Bedtime routine',
        outputTitle: 'Your bedtime routine',
        blurb: 'A calming, step-by-step wind-down routine that fits the exact window you have before sleep.',
        icon: 'leaf',
        cta: 'Give me a routine',
        inputs: [
          { key: 'bedtime', label: 'When do you want to be asleep?', type: 'text', placeholder: 'e.g. 10:30pm' },
          { key: 'timeAvailable', label: 'How long can you spend winding down?', type: 'select', options: ['15', '30', '60'] },
        ],
        systemPrompt: `${VOICE}

Build a step-by-step calming bedtime routine sized to fit inside the exact number of minutes they have before their target bedtime. Count backward from their bedtime so the routine ends right as they get into bed. The segment times must add up to the window they chose.

## Your wind-down, start to sleep
- A numbered list of steps in order, each with a clock time or a duration (for example, "9:45pm - dim the lights and put screens away, 5 minutes"). Move from the room, to the body, to the mind, ending with lights out at their bedtime. Keep every step gentle and screen-light.

## Make it stick
- Two or three short bullets on how to keep this routine easy to repeat, and the one step to protect on the nights you are short on time.`,
      },
    },

    {
      id: 'night-waking',
      name: 'Beat the 3am wakeups',
      desc: 'Why night waking happens and a calm way back to sleep.',
      icon: 'refresh',
      feature: {
        id: 'sleep-night-waking',
        title: 'Beat the 3am wakeups',
        outputTitle: 'Getting back to sleep',
        blurb: 'Why you wake in the middle of the night, and a calm protocol for drifting back off without spiraling.',
        icon: 'refresh',
        cta: 'Help me back to sleep',
        inputs: [
          { key: 'details', label: 'What happens when you wake up? (optional)', type: 'textarea', placeholder: 'e.g. wide awake at 3am, mind starts racing, watch the clock, cannot settle' },
        ],
        systemPrompt: `${VOICE}

Explain why middle-of-the-night waking happens and give this person a calm, practical protocol for getting back to sleep without spiraling. Use anything they shared about what their wakeups feel like. Be reassuring: brief night waking is normal.

## Why this happens
- Two or three short, non-clinical bullets on the ordinary reasons people wake at 3am (sleep cycles, stress, light, temperature, a full bladder, alcohol). Normalize it.

## The moment you wake up
- A short numbered protocol for right then: stay calm, keep the lights and the clock out of it, and a simple breathing or body cue to invite sleep back.

## If you are still awake after a while
- A gentle "get up and reset" step done in low light, plus what to do and what to avoid (no bright screens, no clock-watching), then how to return to bed.

## Quiet the racing mind
- Two or three specific techniques to stop the 3am thought spiral (a wind-down thought, a worry to park until morning, a slow count).

## When to get help
- One short, kind line: if this happens most nights for weeks, or you wake gasping, it is worth talking with a doctor.`,
      },
    },

    {
      id: 'reset-schedule',
      name: 'Reset your schedule',
      desc: 'A gradual plan to shift your sleep timing over a week or two.',
      icon: 'sun',
      feature: {
        id: 'sleep-reset-schedule',
        title: 'Reset your schedule',
        outputTitle: 'Your schedule reset',
        blurb: 'A gentle, gradual plan to shift your sleep and wake times to where you want them.',
        icon: 'sun',
        cta: 'Reset my schedule',
        inputs: [
          { key: 'currentPattern', label: 'Your current sleep pattern', type: 'textarea', placeholder: 'e.g. asleep around 2am, up at 10am, groggy all morning' },
          { key: 'targetBedtime', label: 'The bedtime you are aiming for', type: 'text', placeholder: 'e.g. 11pm, asleep by 11:30' },
        ],
        systemPrompt: `${VOICE}

Build a gradual plan to shift this person's sleep timing from the pattern they described toward the bedtime they want. Move in small steps (about 15 to 30 minutes every couple of nights), because shifting too fast never sticks. Ground the whole plan in the gap between where they are and where they want to be.

## Where you are and where you are headed
- One or two lines naming their current timing, their target, and roughly how many days the shift will take at a gentle pace.

## The shift, step by step
- A numbered, day-by-day (or every-few-days) list that walks their bedtime and wake time earlier or later in small moves until they reach the target. Give concrete times for each step.

## What locks it in
- Bullets on the anchors that make a new schedule hold: morning light, a consistent wake time even on weekends, caffeine and light timing, and a wind-down cue.

## If you slip
- Two or three forgiving bullets for getting back on track after a late night, without starting over.`,
      },
    },
  ],

  daily: (ctx) => ({
    title: 'Time to wind down',
    body: 'Let the day set. Dim the lights, put the screens to bed, and move through a few gentle steps with me, then let the settle timer carry you the rest of the way down. You do not have to force sleep. You just have to make room for it.',
    cta: 'Start wind-down',
    toolId: 'wind-down',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? profile.name.split(' ')[0] : 'this person';
    return `${name} wants better rest: to fall asleep more easily and wake up actually rested. You can guide a calming wind-down, build a personalized sleep-hygiene plan around their specific struggle, design a bedtime routine, help them through middle-of-the-night wakeups, and gradually reset a drifted schedule. Keep everything to everyday sleep hygiene and warmth, never medical advice. If they mention something serious or chronic (long-running insomnia, loud snoring with gasping, pain, or heavy daytime exhaustion), gently encourage them to see a doctor.`;
  },
};

export default engine;
