// GrowthGarden - a living visual that blooms with the user's real progress.
// It reads useGame() and grows a warm SVG tree: level 1 is a small sprout, and
// as levels rise and meaningful moments accumulate (day_closed, goal_done,
// reflection_saved) the same tree gains branches, leaves, blossoms, drifting
// petals and fireflies. The tree shape is deterministic (fixed seed) so the
// scene is identical for identical progress and simply fills in over weeks.
import { useId } from 'react';
import { useGame } from '../lib/game.js';

const MAXDEPTH = 5;
const WORLD_W = 420;
const WORLD_H = 430;
const BASE_X = 210;
const BASE_Y = 404;

const BLOSSOM_COLORS = ['var(--rose)', 'var(--gold)', 'var(--accent-300)'];

// Small deterministic PRNG so the whole scene is pure given the same seed.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build the maximal tree once. Every element carries a "bloom" threshold in
// 0..1 marking the growth level at which it reveals, so higher progress simply
// unveils more of the same stable structure.
function buildTree() {
  const rand = mulberry32(20240719);
  const branches = [];
  const leaves = [];

  function grow(x, y, angle, len, width, depth) {
    const x2 = x + Math.sin(angle) * len;
    const y2 = y - Math.cos(angle) * len;
    const bloom = Math.min(0.97, depth / (MAXDEPTH + 1.4) + rand() * 0.05);
    branches.push({ x1: x, y1: y, x2, y2, width, depth, bloom });

    if (depth >= 2) {
      const n = depth >= MAXDEPTH ? 3 : 1;
      for (let i = 0; i < n; i++) {
        const lx = x2 + (rand() - 0.5) * len * 0.5;
        const ly = y2 + (rand() - 0.5) * len * 0.5;
        const leafBloom = Math.min(1, 0.26 + (depth / MAXDEPTH) * 0.5 + rand() * 0.18);
        leaves.push({
          x: lx,
          y: ly,
          rot: angle + (rand() - 0.5) * 1.3,
          scale: Math.max(0.45, 0.75 + rand() * 0.6 - depth * 0.03),
          bloom: leafBloom,
          kind: rand(),
          blossomBloom: 0.46 + rand() * 0.72, // some exceed 1 and never blossom
          blossomColor: Math.floor(rand() * 3),
        });
      }
    }

    if (depth >= MAXDEPTH) return;
    const childCount = depth === 0 ? 2 : rand() < 0.24 ? 3 : 2;
    for (let i = 0; i < childCount; i++) {
      const dir = childCount === 2 ? (i === 0 ? -1 : 1) : i - 1;
      const spread = 0.34 + rand() * 0.22;
      const na = angle + dir * spread + (rand() - 0.5) * 0.12;
      grow(x2, y2, na, len * (0.72 + rand() * 0.06), width * 0.64, depth + 1);
    }
  }

  grow(BASE_X, BASE_Y, 0, 72, 15, 0);

  // Two seed leaves at the trunk tip so even a level-1 sprout reads as alive.
  const tip = branches[0];
  leaves.push({ x: tip.x2 - 7, y: tip.y2 - 1, rot: -0.95, scale: 0.82, bloom: 0, kind: 0.2, blossomBloom: 2, blossomColor: 0 });
  leaves.push({ x: tip.x2 + 7, y: tip.y2 - 1, rot: 0.95, scale: 0.82, bloom: 0, kind: 0.55, blossomBloom: 2, blossomColor: 0 });

  const fireflies = Array.from({ length: 8 }, () => ({
    x: 80 + rand() * 260,
    y: 90 + rand() * 210,
    r: 1.6 + rand() * 1.8,
    delay: rand() * 5,
    dur: 3.4 + rand() * 3,
  }));

  const petals = Array.from({ length: 7 }, () => ({
    x: 110 + rand() * 200,
    y: 120 + rand() * 150,
    rot: rand() * 360,
    color: Math.floor(rand() * 3),
    delay: rand() * 8,
    dur: 9 + rand() * 6,
    drift: (rand() - 0.5) * 30,
  }));

  return { branches, leaves, fireflies, petals };
}

const TREE = buildTree();

function easeOut(t) {
  const c = Math.max(0, Math.min(1, t));
  return c * (2 - c);
}

// A single blossom: five soft petals around a warm gold heart.
function Blossom({ x, y, scale, colorIndex, softId }) {
  const color = BLOSSOM_COLORS[colorIndex] || BLOSSOM_COLORS[0];
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <circle r="6.4" fill={color} opacity="0.22" filter={`url(#${softId})`} />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx="0"
          cy="-3.6"
          rx="2.5"
          ry="4.2"
          fill={color}
          transform={`rotate(${a})`}
          opacity="0.95"
        />
      ))}
      <circle r="1.9" fill="var(--gold)" />
      <circle r="0.8" fill="#fff6e0" opacity="0.9" />
    </g>
  );
}

export default function GrowthGarden({ size }) {
  const snap = useGame();
  const level = Math.max(1, snap?.level || 1);
  const counts = snap?.counts || {};
  const meaningful =
    (counts.day_closed || 0) + (counts.goal_done || 0) + (counts.reflection_saved || 0);

  // Smooth, saturating growth: always room for a little more, never quite 1.
  const raw = Math.max(0, level - 1 + meaningful / 8);
  const progress = 1 - Math.exp(-raw / 6);

  // The whole crown scales up around its base as the tree matures.
  const treeScale = 0.44 + 0.56 * progress;
  const scaleTransform = `translate(${BASE_X} ${BASE_Y}) scale(${treeScale}) translate(${-BASE_X} ${-BASE_Y})`;

  const rawUid = useId();
  const uid = rawUid.replace(/[^a-zA-Z0-9]/g, '');
  const P = `kgg${uid}`;
  const soft = `${P}-soft`;

  const glowStrength = 0.12 + progress * 0.5;
  const glowR = 90 + progress * 80;

  const visibleFireflies = progress > 0.5 ? Math.min(8, Math.round((progress - 0.5) * 18)) : 0;
  const visiblePetals = progress > 0.55 ? Math.min(7, Math.round((progress - 0.5) * 12)) : 0;

  let blossomCount = 0;
  for (const l of TREE.leaves) if (progress >= l.blossomBloom) blossomCount++;

  const leafGrad = (kind) =>
    kind < 0.4 ? `${P}-leafA` : kind < 0.75 ? `${P}-leafB` : `${P}-leafC`;

  return (
    <div
      className={`${P}-root`}
      style={{ width: '100%', maxWidth: size ? `${size}px` : '100%', margin: '0 auto' }}
    >
      <svg
        className={`${P}-svg`}
        viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}
        style={{ width: '100%', height: 'auto', display: 'block' }}
        role="img"
        aria-label={`Your growth garden at level ${level}`}
      >
        <defs>
          <linearGradient id={`${P}-bark`} gradientUnits="userSpaceOnUse" x1="0" y1="70" x2="0" y2="404">
            <stop offset="0" stopColor="#8a6242" />
            <stop offset="0.55" stopColor="#6f4c30" />
            <stop offset="1" stopColor="#4c3320" />
          </linearGradient>
          <linearGradient id={`${P}-leafA`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#8fb877" />
            <stop offset="1" stopColor="var(--sage)" />
          </linearGradient>
          <linearGradient id={`${P}-leafB`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#a7c47f" />
            <stop offset="1" stopColor="#6d9a5c" />
          </linearGradient>
          <linearGradient id={`${P}-leafC`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--gold)" stopOpacity="0.85" />
            <stop offset="1" stopColor="#6f9a63" />
          </linearGradient>
          <radialGradient id={`${P}-glow`} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="var(--gold)" stopOpacity="0.9" />
            <stop offset="0.45" stopColor="var(--accent-300)" stopOpacity="0.35" />
            <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${P}-warm`} cx="0.5" cy="0.16" r="0.9">
            <stop offset="0" stopColor="var(--gold-bg)" stopOpacity="0.7" />
            <stop offset="1" stopColor="var(--paper)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${P}-ground`} cx="0.5" cy="0.35" r="0.8">
            <stop offset="0" stopColor="var(--sage-bg)" />
            <stop offset="1" stopColor="#dbe6d1" />
          </radialGradient>
          <filter id={soft} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.4" />
          </filter>
        </defs>

        {/* soft morning warmth behind the whole scene */}
        <rect x="0" y="0" width={WORLD_W} height={WORLD_H} fill={`url(#${P}-warm)`} />

        {/* ground shadow + mound */}
        <ellipse cx={BASE_X} cy="416" rx={104 * (0.7 + progress * 0.35)} ry="15" fill="#4c3320" opacity="0.10" />
        <ellipse cx={BASE_X} cy="410" rx="138" ry="26" fill={`url(#${P}-ground)`} />

        <g transform={scaleTransform}>
          {/* breathing bloom of light behind the crown */}
          <g className={`${P}-glow`}>
            <circle
              cx={BASE_X}
              cy="210"
              r={glowR}
              fill={`url(#${P}-glow)`}
              opacity={glowStrength}
            />
          </g>

          {/* trunk, branches, foliage - gently swaying crown */}
          <g className={`${P}-canopy`}>
            {TREE.branches.map((b, i) => {
              if (progress < b.bloom) return null;
              const t = easeOut((progress - b.bloom) / 0.12);
              return (
                <line
                  key={`b${i}`}
                  x1={b.x1}
                  y1={b.y1}
                  x2={b.x2}
                  y2={b.y2}
                  stroke={`url(#${P}-bark)`}
                  strokeWidth={Math.max(0.6, b.width * (0.35 + 0.65 * t))}
                  strokeLinecap="round"
                  opacity={0.55 + 0.45 * t}
                />
              );
            })}

            {TREE.leaves.map((l, i) => {
              if (progress < l.bloom) return null;
              const isBlossom = progress >= l.blossomBloom;
              if (isBlossom) {
                const t = easeOut((progress - l.blossomBloom) / 0.14);
                return (
                  <Blossom
                    key={`f${i}`}
                    x={l.x}
                    y={l.y}
                    scale={l.scale * (0.5 + 0.5 * t)}
                    colorIndex={l.blossomColor}
                    softId={soft}
                  />
                );
              }
              const t = easeOut((progress - l.bloom) / 0.14);
              const s = l.scale * (0.35 + 0.65 * t);
              return (
                <g key={`l${i}`} transform={`translate(${l.x} ${l.y}) rotate(${(l.rot * 180) / Math.PI}) scale(${s})`}>
                  <path
                    d="M0,0 C -5.4,-6 -5.4,-16.5 0,-23 C 5.4,-16.5 5.4,-6 0,0 Z"
                    fill={`url(#${leafGrad(l.kind)})`}
                    opacity={0.72 + 0.28 * t}
                  />
                  <path d="M0,-1 L0,-19" stroke="#5c8050" strokeWidth="0.5" opacity="0.5" />
                </g>
              );
            })}

            {/* drifting petals (pure motion; rest gracefully when animation is off) */}
            {TREE.petals.slice(0, visiblePetals).map((p, i) => (
              <g
                key={`p${i}`}
                className={`${P}-petal`}
                style={{
                  '--px': `${p.x}px`,
                  '--py': `${p.y}px`,
                  '--drift': `${p.drift}px`,
                  animationDelay: `${p.delay}s`,
                  animationDuration: `${p.dur}s`,
                }}
              >
                <ellipse
                  cx={p.x}
                  cy={p.y}
                  rx="3"
                  ry="1.7"
                  fill={BLOSSOM_COLORS[p.color]}
                  transform={`rotate(${p.rot} ${p.x} ${p.y})`}
                  opacity="0.85"
                />
              </g>
            ))}
          </g>

          {/* fireflies twinkling in the upper air */}
          {TREE.fireflies.slice(0, visibleFireflies).map((f, i) => (
            <circle
              key={`ff${i}`}
              className={`${P}-firefly`}
              cx={f.x}
              cy={f.y}
              r={f.r}
              fill="var(--gold)"
              filter={`url(#${soft})`}
              style={{ animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s` }}
            />
          ))}
        </g>
      </svg>

      <div className={`${P}-cap`}>
        <span className={`${P}-cap-lvl`}>Your garden at Level {level}</span>
        <span className={`${P}-cap-sub`}>
          {blossomCount > 0
            ? `${blossomCount} ${blossomCount === 1 ? 'blossom' : 'blossoms'} from ${meaningful} tended ${meaningful === 1 ? 'moment' : 'moments'}`
            : meaningful > 0
              ? `growing from ${meaningful} tended ${meaningful === 1 ? 'moment' : 'moments'}`
              : 'a fresh sprout - tend it and watch it bloom'}
        </span>
      </div>

      <style>{`
        .${P}-root {
          text-align: center;
        }
        .${P}-svg {
          filter: drop-shadow(0 6px 18px rgba(76, 51, 32, 0.08));
        }
        .${P}-glow {
          transform-box: fill-box;
          transform-origin: 50% 50%;
          animation: ${P}-breathe 7s ease-in-out infinite;
        }
        .${P}-canopy {
          transform-box: fill-box;
          transform-origin: 50% 100%;
          animation: ${P}-sway 8.5s ease-in-out infinite;
        }
        .${P}-firefly {
          animation: ${P}-twinkle 4s ease-in-out infinite;
        }
        .${P}-petal {
          transform-box: fill-box;
          animation-name: ${P}-fall;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        .${P}-cap {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          margin-top: 0.6rem;
        }
        .${P}-cap-lvl {
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 1.15rem;
          color: var(--ink);
          letter-spacing: -0.01em;
        }
        .${P}-cap-sub {
          font-size: 0.92rem;
          color: var(--n-600);
        }
        @keyframes ${P}-sway {
          0%, 100% { transform: rotate(-0.9deg); }
          50% { transform: rotate(0.9deg); }
        }
        @keyframes ${P}-breathe {
          0%, 100% { opacity: 0.72; transform: scale(0.97); }
          50% { opacity: 1; transform: scale(1.05); }
        }
        @keyframes ${P}-twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 1; }
        }
        @keyframes ${P}-fall {
          0% { transform: translate(0, -8px); opacity: 0; }
          12% { opacity: 0.85; }
          88% { opacity: 0.85; }
          100% { transform: translate(var(--drift, 0px), 46px); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .${P}-glow,
          .${P}-canopy,
          .${P}-firefly,
          .${P}-petal {
            animation: none;
          }
          .${P}-glow { opacity: 1; }
          .${P}-firefly { opacity: 0.85; }
          .${P}-petal { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}
