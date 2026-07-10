// BalanceOrbit - the Life Balance centerpiece. A living radar: each life
// domain is a spoke, the filled warm shape is how you are actually showing up,
// and Aria breathes at the center. Replaces the old flat bars with something
// that feels alive and reads at a glance. Pure inline SVG, no libraries.
import { domainMeta } from '../lib/store.js';

const scoreColor = (s) => (s >= 70 ? 'var(--sage)' : s >= 40 ? 'var(--gold)' : 'var(--rose)');

export default function BalanceOrbit({ perDomain = [], overall = 0, size = 320 }) {
  const c = size / 2;
  const maxR = size * 0.37;
  const N = perDomain.length;

  // Angle for domain i (top-first, clockwise).
  const ang = (i) => (-90 + i * (360 / Math.max(1, N))) * (Math.PI / 180);
  const at = (i, r) => ({ x: c + r * Math.cos(ang(i)), y: c + r * Math.sin(ang(i)) });

  const nodes = perDomain.map((d, i) => {
    const r = maxR * (Math.max(4, d.score) / 100);
    return { ...d, i, ...at(i, r), outer: at(i, maxR), label: at(i, maxR + 24) };
  });

  const shape = nodes.map(n => `${n.x.toFixed(1)},${n.y.toFixed(1)}`).join(' ');
  const rings = [0.33, 0.66, 1];

  return (
    <svg className="k-orbit-svg" viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={`Life balance ${overall} out of 100 across ${N} areas`}>
      <defs>
        <radialGradient id="korbCore" cx="34%" cy="28%">
          <stop offset="0%" stopColor="#f6c39a" /><stop offset="48%" stopColor="#e0794e" />
          <stop offset="82%" stopColor="#c2543a" /><stop offset="100%" stopColor="#a84631" />
        </radialGradient>
        <radialGradient id="korbFill" cx="50%" cy="50%">
          <stop offset="0%" stopColor="rgba(224,121,78,.42)" />
          <stop offset="100%" stopColor="rgba(217,93,120,.20)" />
        </radialGradient>
      </defs>

      {/* concentric guide rings */}
      {rings.map((t, i) => (
        <circle key={i} cx={c} cy={c} r={maxR * t} fill="none" strokeWidth="1"
          style={{ stroke: 'var(--line)' }} strokeDasharray={i < rings.length - 1 ? '2 6' : ''} />
      ))}

      {/* spokes to each domain */}
      {nodes.map(n => (
        <line key={`sp${n.i}`} x1={c} y1={c} x2={n.outer.x} y2={n.outer.y}
          strokeWidth="1.5" style={{ stroke: 'var(--line-strong)' }} strokeDasharray="2 5" />
      ))}

      {/* the filled balance shape */}
      {N >= 3 && (
        <polygon className="k-radar-shape" points={shape} fill="url(#korbFill)"
          strokeWidth="2.5" strokeLinejoin="round" style={{ stroke: 'var(--accent)' }} />
      )}

      {/* orbiting spark for a touch of life */}
      <g className="k-radar-spark" style={{ transformOrigin: `${c}px ${c}px` }}>
        <circle cx={c} cy={c - maxR - 6} r="4" fill="var(--gold)" />
      </g>

      {/* central Aria orb */}
      <g className="k-radar-core">
        <circle cx={c} cy={c} r="30" fill="url(#korbCore)" />
        <text x={c} y={c + 6} textAnchor="middle" fill="#fff" fontSize="18" fontWeight="700"
          fontFamily="Fraunces, Georgia, serif">{overall}</text>
      </g>

      {/* domain nodes + emoji */}
      {nodes.map(n => (
        <g key={`nd${n.i}`} className="k-radar-node" style={{ animationDelay: `${0.3 + n.i * 0.08}s` }}>
          <circle cx={n.x} cy={n.y} r="6" style={{ fill: scoreColor(n.score) }} stroke="#fff" strokeWidth="2" />
          <text x={n.label.x} y={n.label.y + 5} textAnchor="middle" fontSize="18">{domainMeta(n.id).emoji}</text>
        </g>
      ))}
    </svg>
  );
}
