// celebrate() - a confetti burst for delight moments (the profile reveal, a
// first goal, a streak milestone, a real win). Zero dependencies: a throwaway
// full-screen canvas, particles under gravity, self-removing when they settle.
// Respects prefers-reduced-motion. Kindred's warm palette.
//
// celebrate()                      -> burst from upper-center
// celebrate({ x, y })              -> burst from a point (e.g. a tap)
// celebrate({ count, spread })     -> tune the volume

const COLORS = ['#e0794e', '#d95d78', '#dd9a2e', '#f2c94c', '#ffffff', '#6f9a63'];

export function celebrate({ x, y, count = 120, spread = 1 } = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const cx = x == null ? window.innerWidth / 2 : x;
  const cy = y == null ? window.innerHeight / 3 : y;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (4 + Math.random() * 8) * spread;
    parts.push({
      x: cx, y: cy,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 5,
      g: 0.16 + Math.random() * 0.12,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 6,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.5,
      color: COLORS[(Math.random() * COLORS.length) | 0],
    });
  }

  let raf;
  const start = performance.now();
  const LIFE = 2600;
  const tick = (t) => {
    const el = t - start;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const life = Math.max(0, 1 - el / LIFE);
    let alive = false;
    for (const p of parts) {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.99; p.rot += p.vr;
      if (life > 0 && p.y < canvas.height + 40) {
        alive = true;
        ctx.save();
        ctx.globalAlpha = life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
    }
    if (alive) { raf = requestAnimationFrame(tick); }
    else { cancelAnimationFrame(raf); canvas.remove(); }
  };
  raf = requestAnimationFrame(tick);
}
