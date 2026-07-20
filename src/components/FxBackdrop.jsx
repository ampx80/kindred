// A reusable futuristic backdrop for the engagement layer: a drifting aurora
// mesh plus a lightweight canvas particle field (glowing motes that slowly rise
// and connect with faint lines near each other). Self-contained, GPU-light, and
// fully reduced-motion aware (static aurora only, no canvas loop). Drop it as the
// first child of any positioned container: <div style={{position:'relative'}}>
// <FxBackdrop/> ... </div>. Absolutely positioned, pointer-events:none.
import { useEffect, useRef } from 'react';

export default function FxBackdrop({ density = 42, glow = '250,138,74', grid = false, className = '', style }) {
  const ref = useRef(null);

  useEffect(() => {
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = 0, w = 0, h = 0, dpr = Math.min(2, window.devicePixelRatio || 1);
    const parts = [];

    const resize = () => {
      const r = canvas.parentElement.getBoundingClientRect();
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const seed = () => {
      parts.length = 0;
      const n = Math.max(10, Math.round((w * h) / 16000 * (density / 42)));
      for (let i = 0; i < n; i++) {
        parts.push({
          x: Math.random() * w, y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.18, vy: -0.12 - Math.random() * 0.28,
          r: 0.6 + Math.random() * 1.8, a: 0.2 + Math.random() * 0.5,
        });
      }
    };
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -6) { p.y = h + 6; p.x = Math.random() * w; }
        if (p.x < -6) p.x = w + 6; else if (p.x > w + 6) p.x = -6;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${glow},${p.a})`;
        ctx.shadowColor = `rgba(${glow},${p.a})`;
        ctx.shadowBlur = 8;
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      // faint links between nearby motes
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i], b = parts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 8000) {
            ctx.strokeStyle = `rgba(${glow},${0.10 * (1 - d2 / 8000)})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    resize(); seed(); tick();
    const ro = new ResizeObserver(() => { resize(); seed(); });
    try { ro.observe(canvas.parentElement); } catch {}
    return () => { cancelAnimationFrame(raf); try { ro.disconnect(); } catch {} };
  }, [density, glow]);

  return (
    <div
      aria-hidden
      className={`fx-backdrop ${className}`}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 'inherit', ...style }}
    >
      <span className="fx-aurora" style={{ '--fx-glow': glow }} />
      {grid && <span className="fx-grid" style={{ '--fx-glow': glow }} />}
      <canvas ref={ref} style={{ position: 'absolute', inset: 0 }} />
    </div>
  );
}
