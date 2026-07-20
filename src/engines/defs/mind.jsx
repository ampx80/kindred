// Mind and Calm engine. Aria's toolkit for steadying an anxious mind: a
// self-contained breathing pacer plus generative reframes, guided meditation,
// grounding, and an evening wind-down. Auto-discovered by ../index.js.
import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../components/icons.jsx';
import { Card, Button, Field, Input, Select, Textarea, useToast } from '../../components/UI.jsx';
import { mdToHtml } from '../../lib/markdown.js';
import { buildProfileText, saveCreation, getProfile } from '../../lib/store.js';
import { haptic } from '../../lib/haptics.js';

/* ---------- Breathing pacer (bespoke content tool) ---------- */

// Each pattern is a loop of phases: [label, seconds, openness]. Openness 1 means
// the orb should be at its fullest (after inhale, held full); 0 means settled
// small (after exhale, held small). Holds simply keep the prior openness, so the
// orb naturally rests full during a top hold and small during a bottom hold.
const PATTERNS = {
  box: {
    key: 'box',
    name: 'Box',
    desc: 'Even and grounding. 4 in, 4 hold, 4 out, 4 hold.',
    phases: [['Inhale', 4, 1], ['Hold', 4, 1], ['Exhale', 4, 0], ['Hold', 4, 0]],
  },
  '478': {
    key: '478',
    name: '4-7-8',
    desc: 'Deep calm for a racing mind. 4 in, 7 hold, 8 out.',
    phases: [['Inhale', 4, 1], ['Hold', 7, 1], ['Exhale', 8, 0]],
  },
  calm: {
    key: 'calm',
    name: 'Calm',
    desc: 'A longer out-breath to settle. 4 in, 6 out.',
    phases: [['Inhale', 4, 1], ['Exhale', 6, 0]],
  },
};

const BREATH_CSS = `
.mc-breath{display:flex;flex-direction:column;align-items:center;gap:1.4rem;text-align:center}
.mc-patterns{display:flex;flex-wrap:wrap;gap:.55rem;justify-content:center;width:100%}
.mc-pat{display:flex;flex-direction:column;align-items:flex-start;gap:.15rem;text-align:left;
  padding:.6rem .85rem;border-radius:var(--r-md);border:1px solid var(--line);background:var(--paper);
  color:var(--ink);cursor:pointer;min-width:150px;flex:1 1 150px;max-width:230px;
  transition:border-color .15s,transform .15s,box-shadow .15s}
.mc-pat:hover{border-color:var(--sage);transform:translateY(-1px)}
.mc-pat.on{border-color:var(--sage);background:var(--sage-bg);box-shadow:0 6px 18px rgba(60,80,60,.12)}
.mc-pat b{font-weight:700;font-size:.98rem}
.mc-pat span{font-size:.78rem;color:var(--n-500);line-height:1.35}
.mc-stage{position:relative;width:min(280px,72vw);height:min(280px,72vw);display:grid;place-items:center}
.mc-halo{position:absolute;inset:0;border-radius:50%;
  background:radial-gradient(circle at 50% 45%,var(--sage-bg) 0%,transparent 70%);opacity:.9}
.mc-orb{position:relative;width:64%;height:64%;border-radius:50%;
  background:radial-gradient(circle at 38% 32%,var(--paper) 0%,var(--sage-bg) 42%,var(--sage) 120%);
  box-shadow:0 12px 40px rgba(60,90,60,.22),inset 0 2px 10px rgba(255,255,255,.55);
  display:grid;place-items:center;will-change:transform;
  transition:transform var(--mc-dur,4s) ease-in-out}
.mc-ring{position:absolute;inset:0;border-radius:50%;border:2px solid var(--sage);opacity:.35}
.mc-phase{display:flex;flex-direction:column;align-items:center;gap:.1rem;pointer-events:none}
.mc-phase-label{font-family:var(--font-display,inherit);font-weight:700;font-size:1.55rem;color:var(--ink);letter-spacing:-.01em}
.mc-count{font-size:2.4rem;font-weight:750;color:var(--sage);font-variant-numeric:tabular-nums;line-height:1}
.mc-meta{min-height:1.2em;color:var(--n-500);font-size:.9rem}
.mc-reduced .mc-orb{transition:none}
@media (prefers-reduced-motion: reduce){.mc-orb{transition:none}}
`;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    mq.addEventListener ? mq.addEventListener('change', on) : mq.addListener(on);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', on) : mq.removeListener(on); };
  }, []);
  return reduced;
}

function Breathing() {
  const reduced = usePrefersReducedMotion();
  const [patternKey, setPatternKey] = useState('box');
  const [running, setRunning] = useState(false);
  const [phaseIdx, setPhaseIdx] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [cycles, setCycles] = useState(0);
  const rafRef = useRef(0);

  const pattern = PATTERNS[patternKey];
  const phases = pattern.phases;
  const phase = phases[phaseIdx] || phases[0];

  // The pacing loop. Re-runs when the pattern changes so switching mid-session
  // restarts cleanly. Cleans up its animation frame on unmount or stop.
  useEffect(() => {
    if (!running) return;
    let idx = 0;
    let start = performance.now();
    setPhaseIdx(0);
    setRemaining(phases[0][1]);
    haptic('light');

    const tick = (now) => {
      const elapsed = (now - start) / 1000;
      const dur = phases[idx][1];
      setRemaining(Math.max(1, Math.ceil(dur - elapsed)));
      if (elapsed >= dur) {
        idx = (idx + 1) % phases.length;
        if (idx === 0) setCycles(c => c + 1);
        if (phases[idx][0] === 'Inhale') haptic('light');
        start = now;
        setPhaseIdx(idx);
        setRemaining(phases[idx][1]);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, patternKey]); // eslint-disable-line

  const stop = () => {
    cancelAnimationFrame(rafRef.current);
    setRunning(false);
    setPhaseIdx(0);
    setRemaining(0);
  };
  const startStop = () => {
    haptic('medium');
    if (running) { stop(); return; }
    setCycles(0);
    setRunning(true);
  };
  const pick = (key) => {
    if (key === patternKey) return;
    haptic('light');
    setPatternKey(key);
    setPhaseIdx(0);
    setCycles(0);
    setRemaining(running ? PATTERNS[key].phases[0][1] : 0);
  };

  // Orb sizing. When idle it rests gently open; while running it swells on the
  // in-breath and settles on the out-breath, holding at each end. Reduced motion
  // pins the orb still and leans on the words and the countdown instead.
  const openness = running ? phase[2] : 0.5;
  const scale = 0.62 + openness * 0.38;
  const durSec = running ? phase[1] : 0.6;
  const orbStyle = reduced
    ? { transform: 'scale(0.85)' }
    : { transform: `scale(${scale})`, '--mc-dur': `${durSec}s` };

  const phaseLabel = running ? phase[0] : 'Ready';
  const cueText = running
    ? (phase[0] === 'Inhale' ? 'Breathe in slowly through your nose'
      : phase[0] === 'Exhale' ? 'Let it go, soft and unhurried'
      : 'Hold, easy and gentle')
    : 'Find a comfortable seat and soften your shoulders';

  return (
    <Card pad={24}>
      <style>{BREATH_CSS}</style>
      <div className={`mc-breath${reduced ? ' mc-reduced' : ''}`}>
        <div className="col" style={{ gap: '.3rem' }}>
          <span className="eyebrow">Breathing</span>
          <p className="muted" style={{ margin: 0, maxWidth: 440 }}>
            A quiet minute for your nervous system. Pick a pattern, press start, and let the orb set the pace.
          </p>
        </div>

        <div className="mc-patterns" role="group" aria-label="Breathing pattern">
          {Object.values(PATTERNS).map(p => (
            <button
              key={p.key}
              type="button"
              className={`mc-pat${p.key === patternKey ? ' on' : ''}`}
              aria-pressed={p.key === patternKey}
              onClick={() => pick(p.key)}
            >
              <b>{p.name}</b>
              <span>{p.desc}</span>
            </button>
          ))}
        </div>

        <div className="mc-stage" aria-hidden={reduced ? undefined : true}>
          <span className="mc-halo" />
          <span className="mc-ring" />
          <div className="mc-orb" style={orbStyle}>
            <div className="mc-phase">
              <span className="mc-phase-label">{phaseLabel}</span>
              {running && <span className="mc-count">{remaining}</span>}
            </div>
          </div>
        </div>

        <div className="mc-meta" role="status" aria-live="polite">
          {running
            ? `${phase[0]}${remaining ? ` for ${remaining}` : ''}. ${cueText}.`
            : cueText + '.'}
        </div>

        <div className="row gap-2 center wrap">
          <Button variant={running ? 'ghost' : 'primary'} onClick={startStop}>
            <Icon name={running ? 'x' : 'leaf'} size={17} /> {running ? 'Stop' : 'Start breathing'}
          </Button>
          {cycles > 0 && (
            <span className="muted t-sm">
              {cycles} full {cycles === 1 ? 'round' : 'rounds'} so far
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ---------- Engine definition ---------- */

const engine = {
  id: 'mind',
  name: 'Mind and Calm',
  tagline: 'Steady your mind, quiet the noise, come back to now.',
  emoji: '\u{1F9D8}',
  color: 'var(--sage)',
  bg: 'var(--sage-bg)',
  blurb: 'A calm corner for the days that feel loud. Breathe with a gentle pacer, reframe a heavy thought, drop into a short meditation, or ground yourself in the present moment.',
  keywords: [
    'calm', 'anxiety', 'anxious', 'stress', 'stressed', 'meditation', 'mindfulness',
    'breathe', 'breathing', 'peace', 'present', 'focus', 'overwhelm', 'mental', 'clarity', 'worry',
  ],
  domains: ['mind', 'rest', 'purpose'],
  tools: [
    {
      id: 'breathing',
      name: 'Breathing',
      desc: 'A gentle pacer for a calmer minute.',
      icon: 'leaf',
      Component: Breathing,
    },
    {
      id: 'reframe',
      name: 'Reframe this thought',
      desc: 'Turn a heavy thought into a kinder, truer one.',
      icon: 'refresh',
      feature: {
        id: 'mind-reframe',
        title: 'Reframe this thought',
        outputTitle: 'A kinder way to see this',
        blurb: 'Name the thought, spot the distortion, and find a truer perspective plus one small step.',
        icon: 'refresh',
        cta: 'Reframe it',
        inputs: [
          { key: 'thought', label: 'What is the thought weighing on you?', type: 'textarea', placeholder: 'Write it exactly as it sounds in your head.' },
        ],
        systemPrompt: 'You are Aria, a warm and steady companion helping this person soften a difficult thought using a CBT-style reframe. Never be clinical or dismissive. Structure the response in markdown with ## headings and short bullet lists. Sections: first, gently name the thought back to them in their own spirit so they feel heard. Second, name the likely thinking pattern at play (for example all-or-nothing thinking, catastrophizing, mind-reading, or discounting the positive) and explain it plainly and without jargon. Third, offer a kinder and truer perspective that holds space for the hard feeling while widening the view. Fourth, suggest one small, doable next step for today. Keep it warm, personal, and human. Speak to them directly as you. This is supportive reflection, not therapy or medical advice, and if the situation sounds serious the safety layer will handle it, so you stay gentle and encouraging. Use markdown only. Do not use em dashes or en dashes; use a plain hyphen only.',
      },
    },
    {
      id: 'meditation',
      name: 'Guided meditation',
      desc: 'A short script made for how you feel right now.',
      icon: 'sparkles',
      feature: {
        id: 'mind-meditation',
        title: 'Guided meditation',
        outputTitle: 'Your guided meditation',
        blurb: 'A calming, second-person script paced to the time you have.',
        icon: 'sparkles',
        cta: 'Guide me',
        inputs: [
          { key: 'focus', label: 'What do you need right now?', type: 'select', options: ['Calm', 'Sleep', 'Focus', 'Self-kindness', 'Letting go', 'Gratitude'] },
          { key: 'minutes', label: 'How long?', type: 'select', options: ['3', '5', '10'] },
        ],
        systemPrompt: 'You are Aria, guiding this person through a spoken meditation. Write the script in the second person (you), warm and unhurried, as if reading it aloud to someone you care about. Weave in pacing cues in square brackets such as [pause], [breathe in slowly], [let the breath out], and [rest here for a moment] so the reader knows when to slow down. Match the length to the requested minutes: a 3 minute script is brief and simple, a 5 minute script has a little more depth, and a 10 minute script moves through a fuller arc of settling, deepening, and returning. Shape the imagery and intention around the chosen focus. Open by helping them arrive and settle, guide the body and breath, hold the focus at the center, then bring them gently back to the room at the end. Use markdown with a short ## heading or two, but keep it mostly flowing prose so it reads well aloud. Keep it soothing and genuine, never generic. Do not use em dashes or en dashes; use a plain hyphen only.',
      },
    },
    {
      id: 'grounding',
      name: 'Grounding right now',
      desc: 'Come back to the present with your senses.',
      icon: 'target',
      feature: {
        id: 'mind-grounding',
        title: 'Grounding right now',
        outputTitle: 'Grounding, right now',
        blurb: 'A 5-4-3-2-1 senses walkthrough plus anchors made for your moment.',
        icon: 'target',
        cta: 'Ground me',
        inputs: [
          { key: 'whatsHappening', label: 'What is happening for you right now? (optional)', type: 'textarea', placeholder: 'A word or two is plenty. Or leave it blank.' },
        ],
        systemPrompt: 'You are Aria, gently walking this person back into the present moment. Lead them through the 5-4-3-2-1 grounding practice in markdown, with a warm one line intro, then a ## heading and a short bulleted walkthrough: five things you can see, four you can feel, three you can hear, two you can smell, and one you can taste. Keep each step concrete and easy to follow, and reassure them that there is no wrong way to do this. Then add a ## section with exactly two anchors tailored to what they told you is happening (or, if they said nothing, two gentle all-purpose anchors) that steady them further, each one specific and doable in this moment. Close with one calm, encouraging sentence. Warm, personal, and present tense throughout. Use markdown only. Do not use em dashes or en dashes; use a plain hyphen only.',
      },
    },
    {
      id: 'wind-down',
      name: 'Evening wind-down',
      desc: 'A short routine to set the day down.',
      icon: 'moon',
      feature: {
        id: 'mind-wind-down',
        title: 'Evening wind-down',
        outputTitle: 'Your evening wind-down',
        blurb: 'A short, calming routine to close the day and quiet the mind for rest.',
        icon: 'moon',
        cta: 'Wind down',
        inputs: [],
        systemPrompt: 'You are Aria, helping this person close their day and set their mind down for the night. Write a short, calming wind-down routine in markdown with a few ## headings and brief bullet lists. Move through a gentle arc: a moment to acknowledge the day just as it was, a small way to release what is unfinished (they can pick it back up tomorrow), one or two soothing body-and-breath cues, and a soft, kind closing thought to carry into sleep. Keep it brief and unhurried so it feels like an exhale, not a checklist. Warm, personal, and reassuring. Speak to them directly as you. Use markdown only. Do not use em dashes or en dashes; use a plain hyphen only.',
      },
    },
  ],
  daily: () => ({
    title: 'One mindful breath',
    body: 'Before the day pulls you along, take a single quiet minute to breathe. Just one round can loosen the knot in your chest and bring you back to now.',
    cta: 'Breathe for a minute',
    toolId: 'breathing',
  }),
  ariaContext: (profile) => {
    const p = profile || getProfile();
    const who = p && p.name ? p.name : 'this person';
    return `${who} values calm and mental steadiness. When they seem anxious, stressed, overwhelmed, or scattered, Aria can offer a guided breathing minute, a gentle CBT-style reframe of a heavy thought, a grounding walkthrough for the present moment, a short tailored meditation, or an evening wind-down. Meet them warmly and without judgment; this is supportive companionship, not therapy.`;
  },
};

export default engine;
