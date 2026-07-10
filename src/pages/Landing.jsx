// The front door. A warm, living welcome: a drifting aurora, a breathing Aria
// orb, an oversized serif headline that arrives word by word, a hand-drawn
// "how it works" flow, and a constellation of the life Kindred holds together.
// Meeting Aria IS the pitch - everything here is warmth, not a feature grid.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { loadDemo } from '../lib/store.js';

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
        <span key={i} className="w" style={{ animationDelay: `${0.15 + i * 0.075}s` }}>
          {w}{i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  );
}

const STEPS = [
  { icon: 'sparkles', t: 'Meet Aria', d: 'One warm conversation. No forms, no homework. She simply listens.' },
  { icon: 'compass', t: 'Map your life', d: 'Faith, body, people, work, the book you keep meaning to write. All held in one place.' },
  { icon: 'sun', t: 'Daily guidance', d: 'Every morning, the next small, kept promise. Nothing overwhelming, ever.' },
  { icon: 'trophy', t: 'Watch it grow', d: 'Streaks, wins, and patterns Aria remembers so your life compounds over time.' },
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

export default function Landing() {
  const nav = useNavigate();
  const root = useReveal();

  return (
    <div className="k-landing" ref={root}>
      {/* ---------------- HERO ---------------- */}
      <header className="k-hero">
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
            Kindred learns who you are in one warm conversation, then walks with you:
            your faith, your body, your people, your work, the book you keep not writing.
            Every day, it remembers. Every day, it helps.
          </p>

          <div className="k-cta-row reveal reveal-d1">
            <span className="k-pulse">
              <button className="btn btn-warm btn-lg" onClick={() => nav('/welcome')}>
                Say hi to Aria <Icon name="arrowRight" size={19} />
              </button>
            </span>
            <button className="link" style={{ background: 'none', border: 'none', fontSize: '.98rem' }}
              onClick={() => { loadDemo(); nav('/today'); }}>
              or peek at a demo life first
            </button>
          </div>

          <div className="k-scroll-cue" aria-hidden>
            <span>See how</span>
            <Icon name="chevronRight" size={22} className="ch" style={{ transform: 'rotate(90deg)' }} />
          </div>
        </div>
      </header>

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
              <button className="btn btn-warm btn-lg" onClick={() => nav('/welcome')}>
                Meet Aria <Icon name="arrowRight" size={19} />
              </button>
            </span>
            <p className="muted t-xs" style={{ marginTop: '1.3rem', maxWidth: 420, marginInline: 'auto' }}>
              Everything you share stays in your space. No forms, no homework, just a few honest questions.
            </p>
          </div>
        </div>
      </section>

      <footer className="k-foot">Kindred, your life, with company.</footer>
    </div>
  );
}
