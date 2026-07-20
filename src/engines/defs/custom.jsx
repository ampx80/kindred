// The Anything engine - Aria's universal catch-all. Whatever a person wants to
// grow in that no other engine already covers (beekeeping, woodworking, being a
// better dad, learning Rust, gardening, public speaking, standup comedy, chess,
// anything at all), this module builds a bespoke starter toolkit on demand. It
// guarantees that every single pursuit or occupation has a home. Auto-registered
// by ../index.js. The "Build my engine" tool is a self-contained content
// component; the rest are generative configs handed to the shared FeatureRunner
// (POST /api/generate). Scoped styles only, ASCII hyphen only, no em or en dashes.
import { useState, useEffect } from 'react';
import { Icon } from '../../components/icons.jsx';
import { Card, Button, Field, Input, Textarea, useToast } from '../../components/UI.jsx';
import { mdToHtml } from '../../lib/markdown.js';
import { buildProfileText, saveCreation } from '../../lib/store.js';
import { celebrate } from '../../lib/celebrate.js';

// Shared voice + output contract every generative tool here inherits. FeatureRunner
// already sends the person's profile and their filled inputs, so each systemPrompt
// only needs to set the shape and hold the quality bar.
const HOUSE_STYLE = [
  'You are Aria, a warm, sharp life partner who knows this person from their profile and is genuinely excited for whatever they want to pursue.',
  'Write directly to them as "you". Use markdown only: ## for section headings, short paragraphs, and - for bullets.',
  'Be specific and genuinely useful for the exact pursuit they named, never generic filler. If it is an unusual or niche pursuit, take it just as seriously as a common one.',
  'Point them to real, concrete things to look up (named tools, communities, terms, resources) rather than vague advice.',
  'Never use em dashes or en dashes. Use a plain ASCII hyphen only, or rewrite the sentence.',
  'Keep it tight enough to actually act on this week.',
].join(' ');

// Rotating warm lines for the "Aria is building" state, so the wait feels like
// someone is thinking about you rather than a spinner stalling.
const BUILD_MSGS = [
  'Learning everything about this pursuit...',
  'Finding where a beginner should really start...',
  'Shaping a plan around your actual life...',
  'Picking the things worth looking up first...',
  'Adding the warm finish, almost there...',
];

const CUSTOM_CSS = `
.ce-hero{display:flex;flex-direction:column;gap:.5rem;text-align:center;padding:.4rem 0 .2rem}
.ce-hero .ce-orb{width:56px;height:56px;margin:0 auto}
.ce-hero h3{margin:0;font-size:1.4rem;line-height:1.2}
.ce-chips{display:flex;flex-wrap:wrap;gap:.4rem;justify-content:center;margin-top:.2rem}
.ce-chip{display:inline-flex;align-items:center;gap:.3rem;font-size:.78rem;font-weight:650;
  padding:.28rem .6rem;border-radius:var(--r-pill);background:var(--accent-50);color:var(--accent-700)}
.ce-seed{display:inline-flex;align-items:center;gap:.3rem;font-size:.8rem;font-weight:600;
  padding:.34rem .66rem;border-radius:var(--r-pill);border:1px solid var(--line);background:var(--paper);
  color:var(--n-600);cursor:pointer;transition:border-color .15s ease,color .15s ease}
.ce-seed:hover{border-color:var(--accent-300);color:var(--accent-700)}
.ce-gen{display:flex;flex-direction:column;align-items:center;text-align:center;gap:1rem;padding:2.6rem 1.4rem 2.2rem}
.ce-gen .ce-orb{width:68px;height:68px}
.ce-gen-msg{min-height:1.5em;font-weight:600;font-size:1.05rem;color:var(--ink)}
.ce-gen-lines{width:min(460px,100%);display:flex;flex-direction:column;gap:.7rem;margin-top:.4rem}
.ce-gen-lines i{display:block;height:12px;border-radius:6px;
  background:linear-gradient(90deg,var(--n-100) 0%,var(--accent-50) 50%,var(--n-100) 100%);
  background-size:220% 100%;animation:ceShine 1.25s linear infinite}
.ce-gen-lines i:nth-child(2){width:92%}.ce-gen-lines i:nth-child(3){width:78%}
.ce-gen-lines i:nth-child(4){width:88%}.ce-gen-lines i:nth-child(5){width:64%}
@keyframes ceShine{to{background-position:-220% 0}}
.ce-result-top{display:flex;align-items:center;gap:.7rem;margin-bottom:.7rem}
.ce-result-top .ce-orb{width:32px;height:32px;flex:0 0 auto}
.ce-ribbon{display:inline-flex;align-items:center;gap:.4rem;font-size:.82rem;font-weight:700;
  color:var(--sage);background:var(--sage-bg);padding:.3rem .7rem;border-radius:var(--r-pill)}
@media (prefers-reduced-motion: reduce){.ce-gen-lines i{animation:none}}
`;

// A few starter ideas that make the promise concrete: tap one to fill the field.
const SEEDS = ['Beekeeping', 'Woodworking', 'Being a better dad', 'Learning Rust', 'Public speaking', 'Standup comedy'];

// "Build my engine" - the magical, immediate front door. One prominent input,
// an optional note, and a Build button that hands back a complete starter kit
// for ANY pursuit. Fully self-contained: its own generate call, loading state,
// result render, save, and start over.
function BuildMyEngine() {
  const toast = useToast();
  const [topic, setTopic] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);   // { title, markdown }
  const [saved, setSaved] = useState(false);
  const [msgI, setMsgI] = useState(0);

  useEffect(() => {
    if (!busy) return;
    setMsgI(0);
    const id = setInterval(() => setMsgI(n => (n + 1) % BUILD_MSGS.length), 1900);
    return () => clearInterval(id);
  }, [busy]);

  const build = async () => {
    const t = topic.trim();
    if (!t) { toast('Tell Aria what you want to go deeper on.', 'warn'); return; }
    if (busy) return;
    setBusy(true); setResult(null); setSaved(false);

    const title = 'Your ' + t + ' starter kit';
    const systemPrompt = [
      HOUSE_STYLE,
      'Build a complete starter toolkit for the pursuit the person named, no matter how common or niche it is. Treat it as a real craft worth doing well.',
      'Use ## headings for each section, in this order:',
      '## Where to begin - an honest, encouraging read on what this pursuit really is and the very first move to make.',
      '## Your first 4 weeks - a beginner plan broken into Week 1, Week 2, Week 3, and Week 4, each with a clear focus and one or two concrete actions.',
      '## A simple daily practice - one small thing they can do most days that compounds over time.',
      '## What to learn, and what to look up - the key concepts and skills to build, with a specific list of named things to search for or read (real terms, tools, people, or resources).',
      '## Common beginner mistakes - the traps most people fall into starting out, and how to avoid each.',
      '## Gear and setup - the tools, materials, space, or setup they actually need to start, with a clear note if little or nothing is required. Never invent gear that is not real for this pursuit.',
      '## 3 next actions this week - exactly three concrete, doable actions to take in the next seven days.',
      'Make it feel like Aria just built a whole custom module just for them, on the spot.',
    ].join('\n');

    const inputsText = [
      'What they want to go deeper on: ' + t,
      note.trim() ? 'Their level and time note: ' + note.trim() : '',
    ].filter(Boolean).join('\n');

    try {
      const r = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, systemPrompt, inputsText, profileText: buildProfileText() }),
      });
      const data = await r.json();
      if (!r.ok || !data.ok) throw new Error(data.error || 'Aria could not build that right now.');
      if (!data.markdown) throw new Error('Aria came back empty. Try that once more.');
      setResult({ title: data.title || title, markdown: data.markdown });
      celebrate({ count: 80, y: window.innerHeight * 0.4 });
    } catch (e) {
      toast(e.message || 'Something went wrong building your engine.', 'risk');
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!result) return;
    const r = saveCreation({ featureId: 'custom-engine', title: result.title, markdown: result.markdown, inputs: { topic: topic.trim() } });
    if (r.error) { toast(r.message, 'warn'); return; }
    setSaved(true);
    celebrate({ count: 36, y: window.innerHeight * 0.3 });
    toast('Saved to your creations.', 'ok');
  };

  const startOver = () => { setResult(null); setSaved(false); };

  const words = (result?.markdown || '').split(/\s+/).filter(Boolean).length;
  const readMin = Math.max(1, Math.round(words / 200));

  return (
    <div className="col gap-3">
      <style>{CUSTOM_CSS}</style>

      {busy && (
        <Card pad={0}>
          <div className="ce-gen" role="status" aria-live="polite">
            <span className="aria-orb is-thinking ce-orb" aria-hidden />
            <div className="col" style={{ gap: '.25rem' }}>
              <span className="eyebrow">Aria is building your engine</span>
              <span className="ce-gen-msg">{BUILD_MSGS[msgI]}</span>
            </div>
            <div className="ce-gen-lines" aria-hidden><i /><i /><i /><i /><i /></div>
          </div>
        </Card>
      )}

      {!busy && !result && (
        <Card pad={24}>
          <div className="col gap-3">
            <div className="ce-hero">
              <span className="aria-orb ce-orb" aria-hidden />
              <h3 className="serif">Name it. Aria builds the engine.</h3>
              <p className="muted" style={{ margin: 0 }}>
                Beekeeping, woodworking, being a better dad, learning Rust, public speaking, standup comedy. Whatever you want to grow in, Aria will build a complete starter toolkit for it right now.
              </p>
            </div>

            <Field label="What do you want to go deeper on?">
              <Input
                placeholder="e.g. beekeeping, woodworking, learning Rust, being a better dad"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); build(); } }}
                autoFocus
              />
            </Field>

            <div className="ce-chips">
              {SEEDS.map(s => (
                <button key={s} type="button" className="ce-seed" onClick={() => setTopic(s)}>
                  <Icon name="sparkles" size={12} /> {s}
                </button>
              ))}
            </div>

            <Field label="Your level and how much time you have (optional)">
              <Textarea
                rows={2}
                placeholder="e.g. total beginner, about 3 hours a week"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
            </Field>

            <div className="ce-chips" style={{ justifyContent: 'flex-start' }}>
              <span className="ce-chip"><Icon name="sparkles" size={13} /> Any pursuit, built on demand</span>
              <span className="ce-chip"><Icon name="heart" size={13} /> Personal to you</span>
              <span className="ce-chip"><Icon name="check" size={13} /> Save and keep it</span>
            </div>

            <div className="row gap-2" style={{ alignItems: 'center' }}>
              <Button variant="primary" onClick={build} disabled={busy}>
                <Icon name="sparkles" size={17} /> Build my engine
              </Button>
              <span className="muted t-xs">Press Enter to build</span>
            </div>
          </div>
        </Card>
      )}

      {result && (
        <>
          <div className="row gap-2 between wrap">
            <Button variant="ghost" onClick={startOver}><Icon name="refresh" size={16} /> Start over</Button>
            <div className="row gap-2 wrap">
              {saved
                ? <Button variant="ghost" disabled style={{ color: 'var(--sage)' }}><Icon name="check" size={16} /> Saved</Button>
                : <Button variant="primary" onClick={save}><Icon name="check" size={16} /> Save</Button>}
            </div>
          </div>
          <Card pad={26} className="fade-up">
            <div className="ce-result-top">
              <span className="aria-orb ce-orb" aria-hidden />
              <h2 className="serif" style={{ margin: 0, flex: 1, minWidth: 0 }}>{result.title}</h2>
            </div>
            <div className="row gap-1" style={{ alignItems: 'center', marginBottom: '.9rem' }}>
              <span className="ce-ribbon"><Icon name="sparkles" size={13} /> Built just for you</span>
              <span className="muted t-xs">{readMin} min read</span>
            </div>
            <div className="prose" dangerouslySetInnerHTML={{ __html: mdToHtml(result.markdown) }} />
          </Card>
        </>
      )}
    </div>
  );
}

const engine = {
  id: 'custom',
  name: 'Anything',
  tagline: 'Whatever you want to grow in, Aria will build the engine for it.',
  emoji: '\u2728',
  color: 'var(--accent-600)',
  bg: 'var(--accent-50)',
  blurb:
    'The universal engine for anything the other engines do not already cover. Beekeeping, woodworking, being a better dad, learning Rust, gardening, public speaking, standup comedy, chess, anything at all. Name it and Aria builds a complete starter toolkit on the spot: where to begin, a first plan, a daily practice, what to learn, and your next moves.',
  keywords: [],
  domains: [],

  // Always faintly suggested so this engine surfaces as a safety net, but the
  // constant is small enough that any real match outranks it.
  match: (profile) => 0.08,

  tools: [
    {
      id: 'build',
      name: 'Build my engine',
      desc: 'Name any pursuit and Aria builds a complete starter toolkit for it on the spot.',
      icon: 'sparkles',
      Component: BuildMyEngine,
    },
    {
      id: 'plan',
      name: 'Personal plan for anything',
      desc: 'A tailored plan with milestones and a weekly rhythm for whatever you are taking on.',
      icon: 'target',
      feature: {
        id: 'custom-plan',
        title: 'Personal plan for anything',
        outputTitle: 'Your personal plan',
        blurb: 'Name the pursuit, your level, and the time you have. Aria maps the milestones and a weekly rhythm that fits your life.',
        icon: 'target',
        cta: 'Build my plan',
        inputs: [
          { key: 'pursuit', label: 'What are you taking on?', type: 'text', placeholder: 'e.g. beekeeping, woodworking, learning Rust, running a 10k' },
          { key: 'level', label: 'Where are you now?', type: 'select', options: ['Total beginner', 'Some experience', 'Intermediate'] },
          { key: 'time', label: 'How much time can you give it?', type: 'text', placeholder: 'e.g. 3 hours a week, 20 minutes a day' },
        ],
        systemPrompt: `${HOUSE_STYLE}

Build a tailored plan for the pursuit the person named, calibrated to their level and the time they have.
Use ## headings and cover:
- ## The honest read - what real progress looks like at their pace, and the first thing to lock in.
- ## Milestones - ordered milestones from where they are now to genuinely competent. For each, give a short name and a concrete "you can now..." outcome that proves it.
- ## Your weekly rhythm - exactly what to do across a typical week so the plan survives a busy one, sized to the time they said they have.
- ## How to know it is working - simple signs and self-checks that tell them they are on track.
End with one small step they can take in the next 20 minutes.`,
      },
    },
    {
      id: 'deeper',
      name: 'Go deeper on a topic',
      desc: 'A learning dossier: the map of the topic, the best entry points, and exactly what to look up.',
      icon: 'book',
      feature: {
        id: 'custom-deeper',
        title: 'Go deeper on a topic',
        outputTitle: 'Your learning dossier',
        blurb: 'Name a topic you want to understand and Aria maps it out: the terrain, the best entry points, and a specific list of things to look up.',
        icon: 'book',
        cta: 'Build my dossier',
        inputs: [
          { key: 'topic', label: 'What topic do you want to go deeper on?', type: 'text', placeholder: 'e.g. bee biology, joinery, ownership in Rust, Stoicism' },
        ],
        systemPrompt: `${HOUSE_STYLE}

Write a learning dossier for the topic the person named. Make it a real map, not a summary.
Use ## headings and cover:
- ## The map of the topic - the major areas that make up this topic and how they fit together, so they can see the whole landscape.
- ## Best entry points - the smartest places to start given they are new to it, and why each is a good on-ramp.
- ## Things to look up - a specific, named list of terms, ideas, people, tools, books, or resources to search for, ordered from foundational to advanced. Be concrete enough that they could paste each into a search bar.
- ## Questions to explore - a handful of good questions that will pull them deeper and reward real thinking.
Keep it genuinely useful for this exact topic, never generic.`,
      },
    },
    {
      id: 'practice',
      name: 'Design a daily practice',
      desc: 'A tiny daily practice for any skill that compounds, with a weekly checkpoint.',
      icon: 'flame',
      feature: {
        id: 'custom-practice',
        title: 'Design a daily practice',
        outputTitle: 'Your daily practice',
        blurb: 'Pick a skill and how many minutes you can give it. Aria designs a tiny daily practice that compounds over time.',
        icon: 'flame',
        cta: 'Design my practice',
        inputs: [
          { key: 'skill', label: 'What skill do you want to build?', type: 'text', placeholder: 'e.g. carving, public speaking, chess tactics, sketching' },
          { key: 'minutes', label: 'Minutes a day', type: 'select', options: ['5', '10', '20'] },
        ],
        systemPrompt: `${HOUSE_STYLE}

Design a tiny daily practice for the skill the person named, sized to fit the exact number of minutes they chose.
Use ## headings and cover:
- ## The practice - the small routine to do most days, broken into clear steps that fit inside their minutes. Favor active reps over passive review.
- ## Why this compounds - a short, honest note on how these small daily reps add up to real skill over weeks and months.
- ## Weekly checkpoint - one simple thing to do once a week to see progress and adjust, so the practice keeps working.
- ## When you miss a day - a kind, non-punitive way to get back on track without guilt.
Keep it small enough that skipping feels harder than doing it.`,
      },
    },
  ],

  daily: (ctx) => ({
    title: 'Grow in anything',
    body: 'Tell Aria anything you want to grow in, and she will build the engine for it. Beekeeping, woodworking, being a better dad, learning Rust, public speaking, anything at all. Name it and a complete starter toolkit appears.',
    cta: 'Build my engine',
    toolId: 'build',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? String(profile.name).split(' ')[0] : 'this person';
    return `In the Anything engine, Aria can build a bespoke module for any pursuit or occupation ${name} names, even one no other engine covers (beekeeping, woodworking, being a better dad, learning Rust, gardening, public speaking, standup comedy, and so on). On demand she produces a complete starter toolkit: where to begin, a 4-week beginner plan, a simple daily practice, what to learn and specifically what to look up, common beginner mistakes, the gear or setup needed, and three next actions for the week. She can also build a tailored personal plan, a learning dossier, and a daily practice for any skill. Treat every interest as covered here, common or niche, and make it feel immediate.`;
  },
};

export default engine;
