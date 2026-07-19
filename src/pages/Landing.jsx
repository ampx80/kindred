// The front door. A warm, living welcome: a drifting aurora, a breathing Aria
// orb, an oversized serif headline that arrives word by word, a self-playing
// Aria interview (the magic, shown not told), honest trust moments, a glimpse
// of a life in motion, a hand-drawn "how it works" flow, and a constellation of
// the life Kindred holds together. Meeting Aria IS the pitch - everything here
// is warmth, not a feature grid.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { loadDemo } from '../lib/store.js';
import { celebrate } from '../lib/celebrate.js';

const REDUCED = () => typeof window !== 'undefined' && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Reveal-on-scroll: adds .is-in to any .reveal / .k-flow inside the page. */
function useReveal() {
  const root = useRef(null);
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const targets = el.querySelectorAll('.reveal, .k-flow');
    if (REDUCED() || !('IntersectionObserver' in window)) {
      targets.forEach(t => t.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(t => io.observe(t));
    return () => io.disconnect();
  }, []);
  return root;
}

/* Honest count-up: animates once when it scrolls into view. */
function CountUp({ to, suffix = '', dur = 1200 }) {
  const ref = useRef(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (REDUCED() || !('IntersectionObserver' in window)) { setN(to); return; }
    let raf;
    const run = () => {
      const start = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setN(Math.round(eased * to));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) { run(); io.disconnect(); }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, dur]);
  return <span ref={ref} className="tnum">{n}{suffix}</span>;
}

/* Word-by-word arrival for the hero headline. */
function Headline({ children }) {
  const words = String(children).split(' ');
  return (
    <span className="k-reveal-words">
      {words.map((w, i) => (
        <span key={i} className="wq">
          <span className="w" style={{ animationDelay: `${0.15 + i * 0.075}s` }}>{w}</span>
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

/* ============================================================
   ARIA DEMO - a self-playing slice of the real adaptive interview.
   She asks, you answer, she follows the thread and maps your life
   in front of you. Scripted from the real interview engine + the
   seeded demo life, so it is honest, not a mock. Tap any answer to
   drive it yourself; it auto-plays if you just watch.
   ============================================================ */
const DEMO_DOMAINS = [
  { key: 'body', emoji: '💪', label: 'Body' },
  { key: 'family', emoji: '🏡', label: 'Family' },
  { key: 'purpose', emoji: '⭐', label: 'Purpose' },
  { key: 'creativity', emoji: '✍️', label: 'The book' },
];
const DEMO_STEPS = [
  {
    aria: 'If the next year of your life went exactly how you hope, what would be different?',
    choices: [
      { label: 'My body, and honestly my brother', sensed: ['body', 'family'] },
      { label: 'The work I keep not doing', sensed: ['purpose'] },
      { label: 'A little of everything', sensed: ['body', 'family', 'purpose'] },
    ],
    pick: 0,
  },
  {
    aria: 'You mentioned your brother. If that got easy again, what would it look like?',
    choices: [
      { label: 'One honest conversation', sensed: ['family'] },
      { label: 'Time together, no agenda', sensed: ['family'] },
      { label: 'Forgiveness, both ways', sensed: ['family'] },
    ],
    pick: 0,
  },
  {
    aria: 'And when you picture feeling strong again, what is it really for?',
    choices: [
      { label: 'Just feeling like me again', sensed: ['body', 'purpose'] },
      { label: 'Energy for my people', sensed: ['body', 'family'] },
      { label: 'Proving I can keep a promise', sensed: ['purpose'] },
    ],
    pick: 0,
  },
];
const DEMO_DEPTHS = [38, 70, 92];
const DEMO_FINALE = 'Here is what I heard. You do not need a new life. You need yours back, one kept promise at a time. And I will remember every one.';

function AriaDemo() {
  const reduced = REDUCED();
  const [runId, setRunId] = useState(0);
  const [msgs, setMsgs] = useState([]);
  const [live, setLive] = useState('');        // aria bubble currently typing
  const [phase, setPhase] = useState('typing'); // typing | choosing | done
  const [active, setActive] = useState([]);     // current step choices
  const [picked, setPicked] = useState(-1);
  const [depth, setDepth] = useState(0);
  const [sensed, setSensed] = useState(() => new Set());
  const threadRef = useRef(null);
  const resolverRef = useRef(null);             // resolves the current waitPick

  // keep the thread pinned to the newest line
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs, live, active, phase]);

  useEffect(() => {
    let alive = true;
    const timers = [];
    const sleep = (ms) => new Promise((r) => { const t = setTimeout(r, ms); timers.push(t); });

    // reset for this run
    setMsgs([]); setLive(''); setPhase('typing'); setActive([]);
    setPicked(-1); setDepth(0); setSensed(new Set());

    async function typeAria(text) {
      setPhase('typing'); setActive([]); setPicked(-1); setLive('');
      if (reduced) { setLive(text); return; }
      for (let i = 1; i <= text.length; i++) {
        if (!alive) return;
        setLive(text.slice(0, i));
        const ch = text[i - 1];
        await sleep(/[.,?!]/.test(ch) ? 190 : 20 + Math.random() * 26);
      }
    }

    function waitPick(step, idx) {
      return new Promise((resolve) => {
        if (reduced) { resolve(step.pick); return; }
        resolverRef.current = (choiceIdx) => { resolverRef.current = null; resolve(choiceIdx); };
        // auto-play: a beat to read, a visible "press", then commit
        const t1 = setTimeout(() => { if (alive && resolverRef.current) setPicked(step.pick); }, 1500 + idx * 120);
        const t2 = setTimeout(() => { if (alive && resolverRef.current) resolverRef.current(step.pick); }, 2000 + idx * 120);
        timers.push(t1, t2);
      });
    }

    async function run() {
      for (let s = 0; s < DEMO_STEPS.length; s++) {
        const step = DEMO_STEPS[s];
        await typeAria(step.aria);
        if (!alive) return;
        setPhase('choosing'); setActive(step.choices); setPicked(-1);
        const chosen = await waitPick(step, s);
        if (!alive) return;
        setPicked(chosen);
        if (!reduced) await sleep(260);
        const choice = step.choices[chosen] || step.choices[step.pick];
        setMsgs((m) => [...m, { from: 'aria', text: step.aria }, { from: 'user', text: choice.label }]);
        setLive(''); setActive([]);
        setSensed((prev) => { const nx = new Set(prev); choice.sensed.forEach((x) => nx.add(x)); return nx; });
        setDepth(DEMO_DEPTHS[s]);
        await sleep(reduced ? 0 : 560);
      }
      await typeAria(DEMO_FINALE);
      if (!alive) return;
      setMsgs((m) => [...m, { from: 'aria', text: DEMO_FINALE }]);
      setLive(''); setDepth(100); setPhase('done');
    }
    run();
    return () => { alive = false; resolverRef.current = null; timers.forEach(clearTimeout); };
  }, [runId, reduced]);

  const choose = (i) => {
    if (phase !== 'choosing') return;
    setPicked(i);
    const r = resolverRef.current;
    if (r) r(i);
  };

  const thinking = phase === 'typing';

  return (
    <div className="kl-demo reveal">
      <div className="kl-demo-head">
        <span className={`aria-orb kl-demo-orb${thinking ? ' is-thinking' : ''}`} aria-hidden />
        <div className="kl-demo-head-txt">
          <span className="kl-demo-name">Aria</span>
          <span className="kl-demo-status">
            {phase === 'done' ? 'your life, mapped' : thinking ? 'listening, and thinking' : 'your turn'}
          </span>
        </div>
        <div className="kl-demo-depth" aria-hidden>
          <span className="kl-demo-depth-lbl">depth</span>
          <span className="warmbar kl-demo-bar"><i style={{ width: `${depth}%` }} /></span>
        </div>
      </div>

      <div className="kl-thread" ref={threadRef} aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`kl-bubble ${m.from}`}>{m.text}</div>
        ))}
        {live && (
          <div className="kl-bubble aria">
            <span className={thinking ? 'type-caret' : undefined}>{live}</span>
          </div>
        )}
      </div>

      {phase === 'choosing' && active.length > 0 && (
        <div className="kl-choices">
          {active.map((c, i) => (
            <button
              key={i}
              className={`kl-choice${picked === i ? ' picked' : ''}`}
              style={{ animationDelay: `${i * 0.07}s` }}
              onClick={() => choose(i)}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <div className="kl-domrow" aria-hidden>
        {DEMO_DOMAINS.map((d) => (
          <span key={d.key} className={`kl-dom${sensed.has(d.key) ? ' lit' : ''}`}>
            <span className="kl-dom-e">{d.emoji}</span>{d.label}
          </span>
        ))}
      </div>

      {phase === 'done' && (
        <div className="kl-mapped">
          <p className="kl-mapped-note">
            That took three answers. Imagine what she holds after a real one.
          </p>
          <button className="kl-replay" onClick={() => setRunId((n) => n + 1)}>
            <Icon name="refresh" size={16} /> watch again
          </button>
        </div>
      )}
    </div>
  );
}

/* Rotating glimpse of a real life in motion (the seeded demo life, Jordan). */
const GLIMPSES = [
  { t: 'Almost skipped the walk. Went anyway. That felt like the whole point.', d: 'day 6', dom: 'Body' },
  { t: 'The chapter about the lake house basically wrote itself this morning. I forgot how good this feels.', d: 'day 3', dom: 'The book' },
  { t: 'Saw a picture of Danny at the reunion. I was not there. Next year I will be.', d: 'yesterday', dom: 'Family' },
];
function Glimpse() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (REDUCED()) return;
    const id = setInterval(() => setI((n) => (n + 1) % GLIMPSES.length), 5200);
    return () => clearInterval(id);
  }, []);
  const g = GLIMPSES[i];
  return (
    <div className="kl-glimpse reveal">
      <Icon name="quote" size={30} className="kl-glimpse-q" />
      <p key={i} className="kl-glimpse-t">{g.t}</p>
      <div className="kl-glimpse-meta">
        <span className="badge badge-accent">{g.dom}</span>
        <span className="muted t-sm">from a life in motion, {g.d}</span>
      </div>
      <div className="kl-glimpse-dots" aria-hidden>
        {GLIMPSES.map((_, k) => <span key={k} className={k === i ? 'on' : ''} />)}
      </div>
    </div>
  );
}

// The Kindred Guides library - 1,100+ free guides, our SEO/GEO backlink engine.
const GUIDES_URL = 'https://kindred-guides.vercel.app';
const GUIDE_CLUSTERS = [
  { slug: 'mindset', emoji: '🧠', label: 'Mind and mental fitness' },
  { slug: 'sleep', emoji: '🌙', label: 'Sleep and rest' },
  { slug: 'movement', emoji: '💪', label: 'Movement and strength' },
  { slug: 'nutrition', emoji: '🥗', label: 'Nutrition and energy' },
  { slug: 'relationships', emoji: '🤝', label: 'Relationships' },
  { slug: 'habits', emoji: '🌱', label: 'Habits and routines' },
  { slug: 'purpose', emoji: '⭐', label: 'Purpose and faith' },
  { slug: 'hard-days', emoji: '🌅', label: 'Hard days' },
  { slug: 'compare', emoji: '⚖️', label: 'App comparisons' },
];

const STEPS = [
  { icon: 'sparkles', t: 'Meet Aria', d: 'One warm conversation. No forms, no homework. She simply listens.' },
  { icon: 'compass', t: 'Map any life', d: 'Faith, the gym, your people, the book, even watching more TV to actually rest. Nothing is too small or too weird.' },
  { icon: 'sun', t: 'Close your day', d: 'Check in, do the one move that matters, reflect at night. Three small beats, a streak that compounds.' },
  { icon: 'trophy', t: 'Watch it grow', d: 'Streaks, wins, and patterns Aria remembers so your life compounds over time.' },
];

// The breadth of it: whatever you actually care about gets a home and a streak.
const ANY_GOALS = [
  '🏋️ Weightlifting', '🕊️ Deeper faith', '📞 Call mom weekly', '♟️ Learn chess',
  '📺 More rest, guilt-free', '🏃 Move every day', '🎸 Pick up guitar', '📖 Read the book',
  '🧘 Ten quiet minutes', '💧 Actually drink water', '🌱 Sobriety, day by day', '✍️ Write again',
  '🤝 Mend a friendship', '🪴 Keep a garden alive', '🗣️ Learn a language', '😴 A real bedtime',
];

const TRUST = [
  { icon: 'leaf', t: 'Private by design', d: 'Everything you share stays in your space. No ads, no selling you.' },
  { icon: 'sun', t: 'Faith, your way', d: 'Christian, Muslim, Jewish, seeking, or none. Aria honors it gently, never assumes, never preaches.' },
  { icon: 'sparkles', t: 'She remembers', d: 'Every promise, every win, every name. Your life compounds.' },
  { icon: 'refresh', t: 'Yours to keep or clear', d: 'Export it or delete all of it in one tap, anytime.' },
];

// A curated constellation of the life Kindred can hold together.
const DOMAINS = [
  { emoji: '🕊️', label: 'Faith', color: 'var(--sky)', bg: 'var(--sky-bg)' },
  { emoji: '💪', label: 'Body', color: 'var(--accent-600)', bg: 'var(--accent-50)' },
  { emoji: '🤝', label: 'People', color: 'var(--rose)', bg: 'var(--rose-bg)' },
  { emoji: '🧭', label: 'Work', color: 'var(--gold)', bg: 'var(--gold-bg)' },
  { emoji: '✍️', label: 'Creativity', color: 'var(--gold)', bg: 'var(--gold-bg)' },
  { emoji: '⭐', label: 'Purpose', color: 'var(--gold)', bg: 'var(--gold-bg)' },
  { emoji: '🌲', label: 'Rest', color: 'var(--sage)', bg: 'var(--sage-bg)' },
];

function Constellation() {
  const cx = 280, cy = 280, R = 188;
  const nodes = DOMAINS.map((d, i) => {
    const a = (-90 + i * (360 / DOMAINS.length)) * (Math.PI / 180);
    return { ...d, x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  return (
    <div className="k-constellation">
      <svg viewBox="0 0 560 560" role="img" aria-label="The life domains Kindred holds together, orbiting Aria">
        <defs>
          <radialGradient id="korb" cx="34%" cy="28%">
            <stop offset="0%" stopColor="#f6c39a" />
            <stop offset="48%" stopColor="#e0794e" />
            <stop offset="82%" stopColor="#c2543a" />
            <stop offset="100%" stopColor="#a84631" />
          </radialGradient>
        </defs>
        {/* rotating decorative orbit rings */}
        <circle className="k-const-orbit slow" cx={cx} cy={cy} r="120" fill="none" strokeWidth="1.5" strokeDasharray="2 8" style={{ stroke: 'var(--line-strong)' }} />
        <circle className="k-const-orbit slow rev" cx={cx} cy={cy} r={R} fill="none" strokeWidth="1.5" strokeDasharray="2 10" style={{ stroke: 'var(--line)' }} />
        {/* spokes */}
        {nodes.map((n, i) => (
          <line key={`s${i}`} className="k-const-spoke" x1={cx} y1={cy} x2={n.x} y2={n.y}
            strokeWidth="2" style={{ stroke: n.color, animationDelay: `${i * 0.3}s` }} />
        ))}
        {/* central Aria orb */}
        <g className="k-const-core">
          <circle cx={cx} cy={cy} r="58" fill="url(#korb)" />
          <circle cx={cx} cy={cy} r="58" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" />
          <text x={cx} y={cy + 6} textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700" fontFamily="Fraunces, Georgia, serif">Aria</text>
        </g>
        {/* domain nodes */}
        {nodes.map((n, i) => (
          <g key={`n${i}`} className="k-const-node" style={{ animationDelay: `${i * 0.45}s` }}>
            <circle cx={n.x} cy={n.y} r="36" strokeWidth="2" style={{ fill: 'var(--paper)', stroke: n.color }} />
            <text x={n.x} y={n.y + 3} textAnchor="middle" fontSize="26">{n.emoji}</text>
            <text x={n.x} y={n.y + 56} textAnchor="middle" fontSize="15" fontWeight="650" fontFamily="Inter, sans-serif" style={{ fill: 'var(--n-700)' }}>{n.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// A static three-ring graphic in the same language as the in-app Day Ring, so
// the marketing shows the exact ritual people will live in.
function RitualRings() {
  const size = 200, cx = size / 2, cy = size / 2, width = 15, gap = 21;
  const radii = [cx - width / 2 - 2, cx - width / 2 - 2 - gap, cx - width / 2 - 2 - gap * 2];
  const vals = [1, 1, 0.66];
  const cols = ['var(--accent-600)', 'var(--sage)', 'var(--gold)'];
  const tracks = ['var(--accent-50)', 'var(--sage-bg)', 'var(--gold-bg)'];
  return (
    <div className="kl-rings">
      <svg width={size} height={size}>
        {radii.map((r, i) => {
          const c = 2 * Math.PI * r;
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={tracks[i]} strokeWidth={width} />
              <circle cx={cx} cy={cy} r={r} fill="none" stroke={cols[i]} strokeWidth={width} strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c * (1 - vals[i])} transform={`rotate(-90 ${cx} ${cy})`} />
            </g>
          );
        })}
      </svg>
      <div className="kl-rings-center">
        <span className="kl-rings-pct">88<span>%</span></span>
        <span className="kl-rings-lbl">of today</span>
      </div>
    </div>
  );
}

const RITUAL_BEATS = [
  { emoji: '🌅', t: 'Check in', d: 'One tap in the morning. Aria reads the weather of your day.' },
  { emoji: '✅', t: 'Move', d: 'The one small promise that matters today. Done in a rep, not an hour.' },
  { emoji: '🌙', t: 'Reflect', d: 'A quick, honest look back at night. That is what makes it stick.' },
];

function RitualShowcase() {
  return (
    <div className="kl-ritual reveal">
      <div className="kl-ritual-visual">
        <RitualRings />
        <span className="kl-ritual-streak"><Icon name="flame" size={16} /> 23 day streak</span>
      </div>
      <div className="kl-ritual-beats">
        {RITUAL_BEATS.map((b, i) => (
          <div key={b.t} className="kl-beat" style={{ transitionDelay: `${i * 0.08}s` }}>
            <span className="kl-beat-e">{b.emoji}</span>
            <div>
              <div className="kl-beat-t serif">{b.t}</div>
              <p className="kl-beat-d">{b.d}</p>
            </div>
          </div>
        ))}
        <p className="kl-ritual-note">Close all three and your streak grows. Miss one? Aria keeps it for you. Warm, never punishing.</p>
      </div>
    </div>
  );
}

function AnyGoalBand() {
  const row = [...ANY_GOALS, ...ANY_GOALS];
  return (
    <div className="kl-marquee reveal" aria-hidden={false}>
      <div className="kl-marquee-track">
        {row.map((g, i) => <span key={i} className="kl-goal-chip">{g}</span>)}
      </div>
    </div>
  );
}

export default function Landing() {
  const nav = useNavigate();
  const root = useReveal();
  const heroRef = useRef(null);
  const [sticky, setSticky] = useState(false);

  // Sticky CTA fades in once the hero (and its buttons) have scrolled away.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      ([e]) => setSticky(!e.isIntersecting),
      { rootMargin: '-40% 0px 0px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Meeting Aria should feel like a small celebration.
  const meetAria = (e) => {
    try {
      const r = e && e.currentTarget && e.currentTarget.getBoundingClientRect();
      if (r) celebrate({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 80, spread: 1 });
    } catch {}
    nav('/welcome');
  };

  return (
    <div className="k-landing" ref={root}>
      <LandingStyles />

      {/* ---------------- HERO ---------------- */}
      <header className="k-hero" ref={heroRef}>
        <div className="k-aura" aria-hidden><b className="a1" /><b className="a2" /><b className="a3" /><b className="a4" /></div>

        <div className="k-hero__inner">
          <div className="k-orb" aria-hidden>
            <span className="halo" /><span className="halo h2" /><span className="halo h3" />
            <span className="orbit"><span className="spark" /></span>
            <span className="orbit o2"><span className="spark" /></span>
            <span className="aria-orb core" />
          </div>

          <span className="k-eyebrow"><span className="dot" style={{ background: 'var(--sage)' }} /> Your life, with company</span>

          <h1 className="k-hero__title">
            <Headline>A companion for the life</Headline>{' '}
            <span className="em"><Headline>only you can live.</Headline></span>
          </h1>

          <p className="k-hero__lead reveal">
            Kindred learns who you are in one warm conversation, then shows up every
            single day. Weightlifting or your faith, calling your brother or finally
            learning chess - it dissects what YOU actually want and turns it into one
            small kept promise a day. And it remembers every one.
          </p>

          <div className="k-cta-row reveal reveal-d1">
            <span className="k-pulse">
              <button className="btn btn-warm btn-lg" onClick={meetAria}>
                Say hi to Aria <Icon name="arrowRight" size={19} />
              </button>
            </span>
            <button className="link" style={{ background: 'none', border: 'none', fontSize: '.98rem' }}
              onClick={() => { loadDemo(); nav('/today'); }}>
              or peek at a demo life first
            </button>
          </div>

          <div className="k-scroll-cue" aria-hidden>
            <span>Meet her</span>
            <Icon name="chevronRight" size={22} className="ch" style={{ transform: 'rotate(90deg)' }} />
          </div>
        </div>
      </header>

      {/* ---------------- ARIA DEMO (the magic, shown) ---------------- */}
      <section className="k-section kl-demo-sec">
        <div className="k-wrap">
          <div className="k-section__head reveal">
            <span className="k-section__eyebrow">See the magic</span>
            <h2 className="k-section__title">Watch a life get mapped in three answers</h2>
            <p className="k-section__sub">This is the real interview. Aria follows what you actually say, senses what matters, and hands your life back to you. Tap an answer, or just watch.</p>
          </div>
          <AriaDemo />
          <div className="kl-demo-cta reveal">
            <span className="k-pulse">
              <button className="btn btn-warm btn-lg" onClick={meetAria}>
                Now do it for real <Icon name="arrowRight" size={19} />
              </button>
            </span>
          </div>
        </div>
      </section>

      {/* ---------------- THE DAILY RITUAL ---------------- */}
      <section className="k-section" style={{ paddingTop: '2.6rem' }}>
        <div className="k-wrap">
          <div className="k-section__head reveal">
            <span className="k-section__eyebrow">The reason you come back</span>
            <h2 className="k-section__title">A daily ritual you will not want to break</h2>
            <p className="k-section__sub">Three small beats close your day. A streak that compounds, a check-in that Aria reads, and the occasional surprise. Gentle enough to keep, satisfying enough to crave.</p>
          </div>
          <RitualShowcase />
        </div>
      </section>

      {/* ---------------- ANY GOAL ---------------- */}
      <section className="k-section" style={{ paddingTop: '1rem' }}>
        <div className="k-wrap">
          <div className="k-section__head reveal">
            <span className="k-section__eyebrow">Whatever you actually want</span>
            <h2 className="k-section__title">Weightlifting or watching more TV. Scripture or chess.</h2>
            <p className="k-section__sub">Most apps decide what you should track. Kindred asks. Any goal you name gets its own home, its own streak, and Aria in your corner - no matter how big, small, or wonderfully specific.</p>
          </div>
        </div>
        <AnyGoalBand />
      </section>

      {/* ---------------- HOW IT WORKS ---------------- */}
      <section className="k-section">
        <div className="k-wrap">
          <div className="k-section__head reveal">
            <span className="k-section__eyebrow">How Kindred works</span>
            <h2 className="k-section__title">Four gentle steps, then a lifetime of small kept promises</h2>
            <p className="k-section__sub">No dashboard to learn. You talk, Kindred listens, and the days start carrying you forward.</p>
          </div>

          <div className="k-flow">
            <svg className="k-flow__line" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden>
              <defs>
                <linearGradient id="kflowg" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#e0794e" />
                  <stop offset="50%" stopColor="#d95d78" />
                  <stop offset="100%" stopColor="#dd9a2e" />
                </linearGradient>
              </defs>
              <path className="track" d="M0 2 H100" fill="none" />
              <path className="flow" d="M0 2 H100" fill="none" />
            </svg>
            {STEPS.map((s, i) => (
              <div key={s.t} className="k-step reveal" style={{ transitionDelay: `${i * 0.09}s` }}>
                <span className="k-step__badge">{i + 1}</span>
                <span className="k-step__ic"><Icon name={s.icon} size={26} /></span>
                <div className="k-step__t serif">{s.t}</div>
                <p className="k-step__d">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- CONSTELLATION ---------------- */}
      <section className="k-section" style={{ paddingTop: '2rem' }}>
        <div className="k-wrap">
          <div className="k-section__head reveal">
            <span className="k-section__eyebrow">Your whole life, in one place</span>
            <h2 className="k-section__title">Everything that matters to you, orbiting one warm center</h2>
            <p className="k-section__sub">Most apps hold one slice of you. Kindred holds the whole picture, and Aria keeps it all connected.</p>
          </div>
          <div className="reveal reveal-d1"><Constellation /></div>
        </div>
      </section>

      {/* ---------------- TRUST ---------------- */}
      <section className="k-section" style={{ paddingTop: '1rem' }}>
        <div className="k-wrap">
          <div className="k-section__head reveal">
            <span className="k-section__eyebrow">Why people let her in</span>
            <h2 className="k-section__title">The kind of company you can actually trust</h2>
          </div>
          <div className="kl-trust">
            {TRUST.map((t, i) => (
              <div key={t.t} className="kl-trust-card reveal" style={{ transitionDelay: `${i * 0.07}s` }}>
                <span className="kl-trust-ic"><Icon name={t.icon} size={22} /></span>
                <div className="kl-trust-t serif">{t.t}</div>
                <p className="kl-trust-d">{t.d}</p>
              </div>
            ))}
          </div>
          <div className="kl-glimpse-wrap">
            <Glimpse />
          </div>
        </div>
      </section>

      {/* ---------------- HONEST STATS ---------------- */}
      <section className="k-section" style={{ paddingTop: '1rem' }}>
        <div className="k-wrap">
          <div className="k-stats reveal">
            <div className="k-stat">
              <span className="k-stat__num"><CountUp to={1} /></span>
              <span className="k-stat__label">honest conversation to begin</span>
            </div>
            <div className="k-stat">
              <span className="k-stat__num"><CountUp to={100} suffix="%" /></span>
              <span className="k-stat__label">yours, private, and remembered</span>
            </div>
            <div className="k-stat">
              <span className="k-stat__num"><CountUp to={0} /></span>
              <span className="k-stat__label">forms, logins-as-homework, or noise</span>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- CLOSER ---------------- */}
      <section className="k-section" style={{ paddingTop: '1rem' }}>
        <div className="k-wrap">
          <div className="k-closer reveal">
            <div className="k-orb" style={{ margin: '0 auto 1.2rem', width: 96, height: 96 }} aria-hidden>
              <span className="halo" /><span className="halo h2" />
              <span className="aria-orb core" style={{ width: 78, height: 78 }} />
            </div>
            <h2 className="k-section__title" style={{ maxWidth: 520, margin: '0 auto .7rem' }}>You do not need a new life. You need yours back.</h2>
            <p className="k-section__sub" style={{ maxWidth: 480, margin: '0 auto 1.6rem' }}>
              One kept promise at a time, with someone who remembers every one. Say hi whenever you are ready.
            </p>
            <span className="k-pulse" style={{ display: 'inline-block' }}>
              <button className="btn btn-warm btn-lg" onClick={meetAria}>
                Meet Aria <Icon name="arrowRight" size={19} />
              </button>
            </span>
            <p className="muted t-xs" style={{ marginTop: '1.3rem', maxWidth: 420, marginInline: 'auto' }}>
              Everything you share stays in your space. No forms, no homework, just a few honest questions.
            </p>
          </div>
        </div>
      </section>

      {/* ---------------- FOOTER + GUIDE BACKLINKS ---------------- */}
      <footer className="k-foot">
        <div className="k-wrap k-foot__grid">
          <div className="k-foot__brand">
            <div className="row gap-2" style={{ alignItems: 'center' }}>
              <span className="aria-orb" style={{ width: 34, height: 34 }} aria-hidden />
              <strong style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', color: 'var(--ink)' }}>Kindred</strong>
            </div>
            <p className="k-foot__tag">Your life, with company. One kept promise a day, with someone who remembers every one.</p>
            <span className="k-pulse" style={{ display: 'inline-block' }}>
              <button className="btn btn-warm" onClick={meetAria}>Meet Aria <Icon name="arrowRight" size={16} /></button>
            </span>
          </div>

          <nav className="k-foot__col k-foot__guides" aria-label="Kindred Guides">
            <h4 className="k-foot__h">Free guides</h4>
            <a className="k-foot__link k-foot__link--lead" href={`${GUIDES_URL}/pages/`}>All 1,100+ guides <Icon name="arrowRight" size={13} /></a>
            <div className="k-foot__links">
              {GUIDE_CLUSTERS.map(c => (
                <a key={c.slug} className="k-foot__link" href={`${GUIDES_URL}/pages/${c.slug}/`}>{c.emoji} {c.label}</a>
              ))}
            </div>
          </nav>

          <nav className="k-foot__col" aria-label="Kindred">
            <h4 className="k-foot__h">Kindred</h4>
            <button className="k-foot__link" onClick={meetAria}>Start free</button>
            <button className="k-foot__link" onClick={meetAria}>Meet Aria</button>
            <a className="k-foot__link" href={`${GUIDES_URL}/about/`}>About the guides</a>
            <a className="k-foot__link" href={GUIDES_URL}>Guides home</a>
          </nav>
        </div>
        <div className="k-wrap k-foot__base">
          <span>Kindred, your life, with company.</span>
          <span className="k-foot__fine">Guides are general wellness information, reviewed against reputable sources. Not medical advice.</span>
        </div>
      </footer>

      {/* ---------------- STICKY CTA ---------------- */}
      <div className={`kl-sticky${sticky ? ' show' : ''}`} aria-hidden={!sticky}>
        <button className="btn btn-warm" onClick={meetAria} tabIndex={sticky ? 0 : -1}>
          Say hi to Aria <Icon name="arrowRight" size={17} />
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   Scoped styles for the new landing moments. Kept here (not in
   index.css) so this file owns its own surface. Warm palette,
   reduced-motion aware, mobile-first. Prefixed kl- to avoid
   any collision with the shared design system.
   ============================================================ */
function LandingStyles() {
  return (
    <style>{`
.kl-demo-sec { padding-top: 3.4rem; }

/* --- Daily ritual showcase --- */
.kl-ritual { display: grid; grid-template-columns: auto 1fr; gap: 2.4rem; align-items: center; max-width: 860px; margin: 0 auto;
  background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-xl); box-shadow: var(--shadow-lg); padding: 2rem 2.2rem; }
.kl-ritual-visual { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.kl-rings { position: relative; width: 200px; height: 200px; display: grid; place-items: center; }
.kl-rings > * { grid-area: 1 / 1; }
.kl-rings-center { display: flex; flex-direction: column; align-items: center; }
.kl-rings-pct { font-family: var(--font-display); font-weight: 800; font-size: 2.7rem; line-height: 1; letter-spacing: -.03em; color: var(--ink); }
.kl-rings-pct span { font-size: 1.2rem; color: var(--n-500); }
.kl-rings-lbl { font-size: .8rem; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: var(--n-500); margin-top: .3rem; }
.kl-ritual-streak { display: inline-flex; align-items: center; gap: .35rem; font-weight: 800; font-size: .95rem; color: var(--accent-700);
  background: var(--accent-50); border: 1px solid var(--accent-300); border-radius: 999px; padding: .4rem .85rem; }
.kl-ritual-streak svg { color: var(--accent-600); }
.kl-ritual-beats { display: flex; flex-direction: column; gap: 1rem; }
.kl-beat { display: flex; gap: .9rem; align-items: flex-start; }
.kl-beat-e { font-size: 1.7rem; line-height: 1; flex: none; width: 44px; height: 44px; display: grid; place-items: center; background: var(--n-25); border-radius: 13px; }
.kl-beat-t { font-size: 1.15rem; font-weight: 600; }
.kl-beat-d { font-size: .96rem; line-height: 1.5; color: var(--n-700); margin-top: .1rem; }
.kl-ritual-note { font-size: .95rem; color: var(--n-600); font-style: italic; border-top: 1px dashed var(--line-strong); padding-top: .9rem; margin-top: .2rem; }
@media (max-width: 680px) { .kl-ritual { grid-template-columns: 1fr; gap: 1.6rem; padding: 1.6rem; text-align: left; } .kl-ritual-visual { margin: 0 auto; } }

/* --- Any goal marquee --- */
.kl-marquee { margin-top: 1.6rem; overflow: hidden; -webkit-mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent);
  mask-image: linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent); }
.kl-marquee-track { display: inline-flex; gap: .7rem; padding: .3rem 0; white-space: nowrap; animation: klMarquee 42s linear infinite; }
.kl-marquee:hover .kl-marquee-track { animation-play-state: paused; }
@keyframes klMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.kl-goal-chip { flex: none; font-size: 1.02rem; font-weight: 600; color: var(--ink); background: var(--paper); border: 1px solid var(--line-strong);
  border-radius: 999px; padding: .7rem 1.15rem; box-shadow: var(--shadow-sm); }

/* --- Aria demo card --- */
.kl-demo {
  max-width: 560px; margin: 0 auto; background: var(--paper);
  border: 1px solid var(--line); border-radius: var(--r-xl);
  box-shadow: var(--shadow-lg); padding: 1.2rem 1.2rem 1.3rem;
  position: relative; overflow: hidden;
}
.kl-demo::before {
  content: ''; position: absolute; inset: 0 0 auto 0; height: 4px;
  background: linear-gradient(90deg, #e0794e, #d95d78 55%, #dd9a2e);
}
.kl-demo-head { display: flex; align-items: center; gap: .7rem; padding-bottom: .9rem; border-bottom: 1px solid var(--line); }
.kl-demo-orb { width: 40px; height: 40px; }
.kl-demo-head-txt { display: flex; flex-direction: column; line-height: 1.15; }
.kl-demo-name { font-family: var(--font-display); font-weight: 600; font-size: 1.12rem; color: var(--ink); }
.kl-demo-status { font-size: .82rem; color: var(--n-600); }
.kl-demo-depth { margin-left: auto; display: flex; flex-direction: column; align-items: flex-end; gap: .3rem; width: 100px; }
.kl-demo-depth-lbl { font-size: .68rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--n-400); }
.kl-demo-bar { width: 100%; }

.kl-thread {
  display: flex; flex-direction: column; gap: .55rem;
  padding: 1rem .2rem; min-height: 210px; max-height: 300px; overflow-y: auto; scroll-behavior: smooth;
}
.kl-bubble {
  max-width: 82%; padding: .7rem .95rem; border-radius: 18px; font-size: 1.02rem; line-height: 1.5;
  animation: klBubble .42s var(--ease) both; word-break: break-word;
}
.kl-bubble.aria { align-self: flex-start; background: var(--n-25); color: var(--ink); border: 1px solid var(--line); border-bottom-left-radius: 6px; }
.kl-bubble.user { align-self: flex-end; background: linear-gradient(120deg, #e0794e, #d95d78); color: #fff; border-bottom-right-radius: 6px; box-shadow: var(--accent-glow); }
@keyframes klBubble { from { opacity: 0; transform: translateY(10px) scale(.98); } to { opacity: 1; transform: none; } }

.kl-choices { display: flex; flex-direction: column; gap: .5rem; padding-top: .35rem; }
.kl-choice {
  text-align: left; width: 100%; background: var(--paper); border: 1.5px solid var(--line);
  border-radius: var(--r-md); padding: .74rem 1rem; font-size: 1rem; font-weight: 550; color: var(--ink);
  cursor: pointer; transition: border-color .16s, background .16s, transform .16s var(--ease), box-shadow .16s;
  animation: klBubble .4s var(--ease) both;
}
.kl-choice:hover { border-color: var(--accent-300); background: var(--accent-50); transform: translateY(-1px); box-shadow: var(--shadow-sm); }
.kl-choice.picked { border-color: transparent; background: linear-gradient(120deg, #e0794e, #d95d78); color: #fff; transform: translateY(0) scale(.99); box-shadow: var(--accent-glow); }

.kl-domrow { display: flex; flex-wrap: wrap; gap: .45rem; padding-top: 1rem; margin-top: .9rem; border-top: 1px dashed var(--line-strong); }
.kl-dom {
  display: inline-flex; align-items: center; gap: .35rem; font-size: .86rem; font-weight: 650;
  padding: .3rem .7rem; border-radius: 999px; background: var(--n-25); color: var(--n-400);
  border: 1px solid var(--line); opacity: .6; filter: grayscale(.7);
  transition: all .4s var(--ease);
}
.kl-dom-e { font-size: 1rem; }
.kl-dom.lit { opacity: 1; filter: none; color: var(--accent-700); background: var(--accent-50); border-color: var(--accent-300); box-shadow: var(--shadow-sm); transform: translateY(-1px); }

.kl-mapped { text-align: center; padding-top: 1rem; animation: klBubble .5s var(--ease) both; }
.kl-mapped-note { font-family: var(--font-display); font-size: 1.1rem; color: var(--ink); margin-bottom: .7rem; }
.kl-replay {
  display: inline-flex; align-items: center; gap: .4rem; background: none; border: none;
  color: var(--accent-600); font-weight: 650; font-size: .95rem; cursor: pointer; padding: .3rem .5rem; border-radius: 999px;
}
.kl-replay:hover { text-decoration: underline; }
.kl-demo-cta { text-align: center; margin-top: 1.9rem; }

/* --- Trust band --- */
.kl-trust { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }
.kl-trust-card { background: var(--paper); border: 1px solid var(--line); border-radius: var(--r-lg); padding: 1.3rem 1.15rem; box-shadow: var(--shadow-sm); transition: transform .2s var(--ease), box-shadow .2s var(--ease), border-color .2s var(--ease); }
.kl-trust-card:hover { transform: translateY(-4px); box-shadow: var(--shadow-md); border-color: var(--accent-300); }
.kl-trust-ic { width: 46px; height: 46px; border-radius: 14px; display: grid; place-items: center; background: var(--accent-50); color: var(--accent-700); margin-bottom: .7rem; }
.kl-trust-card:nth-child(2) .kl-trust-ic { background: var(--rose-bg); color: var(--rose); }
.kl-trust-card:nth-child(3) .kl-trust-ic { background: var(--gold-bg); color: var(--gold); }
.kl-trust-card:nth-child(4) .kl-trust-ic { background: var(--sage-bg); color: var(--sage); }
.kl-trust-t { font-size: 1.1rem; font-weight: 600; margin-bottom: .25rem; }
.kl-trust-d { font-size: .95rem; line-height: 1.5; color: var(--n-700); }
@media (max-width: 760px) { .kl-trust { grid-template-columns: 1fr 1fr; } }
@media (max-width: 460px) { .kl-trust { grid-template-columns: 1fr; } }

/* --- Glimpse quote --- */
.kl-glimpse-wrap { margin-top: 1.8rem; }
.kl-glimpse {
  position: relative; max-width: 620px; margin: 0 auto; text-align: center;
  background: linear-gradient(135deg, var(--accent-50), var(--rose-bg) 60%, var(--gold-bg));
  border: 1px solid var(--line); border-radius: var(--r-xl); padding: 2.2rem 1.8rem 1.7rem;
}
[data-theme="dark"] .kl-glimpse { background: linear-gradient(135deg, #2b1a14, #2a1620 60%, #2a2110); }
.kl-glimpse-q { color: var(--accent-300); opacity: .8; margin-bottom: .4rem; }
.kl-glimpse-t { font-family: var(--font-display); font-size: clamp(1.2rem, 2.5vw, 1.55rem); line-height: 1.4; color: var(--ink); margin: 0 auto; max-width: 32ch; animation: klFade .6s var(--ease) both; }
@keyframes klFade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.kl-glimpse-meta { display: flex; align-items: center; justify-content: center; gap: .6rem; margin-top: 1rem; flex-wrap: wrap; }
.kl-glimpse-dots { display: flex; justify-content: center; gap: .4rem; margin-top: 1rem; }
.kl-glimpse-dots span { width: 7px; height: 7px; border-radius: 999px; background: var(--n-200); transition: background .3s, transform .3s; }
.kl-glimpse-dots span.on { background: var(--accent); transform: scale(1.25); }

/* --- Sticky CTA --- */
.kl-sticky {
  position: fixed; left: 50%; bottom: calc(1.1rem + env(safe-area-inset-bottom)); transform: translate(-50%, 140%);
  z-index: 60; opacity: 0; pointer-events: none; transition: transform .4s var(--ease), opacity .3s var(--ease);
}
.kl-sticky.show { transform: translate(-50%, 0); opacity: 1; pointer-events: auto; }
.kl-sticky .btn { box-shadow: var(--accent-glow), var(--shadow-lg); padding: .82rem 1.4rem; }

@media (prefers-reduced-motion: reduce) {
  .kl-bubble, .kl-choice, .kl-mapped, .kl-glimpse-t, .kl-marquee-track { animation: none !important; }
  .kl-thread { scroll-behavior: auto; }
  .kl-dom { transition: none; }
  .kl-sticky { transition: opacity .2s linear; }
  .kl-marquee-track { flex-wrap: wrap; white-space: normal; justify-content: center; }
}
    `}</style>
  );
}
