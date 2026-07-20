// Global share surface for Kindred. Driven purely by window events so any
// screen can fire `window.dispatchEvent(new CustomEvent('kindred:share',
// { detail: { title, subtitle, stat, emoji } }))` and get a branded,
// shareable card with native share / clipboard fallbacks. No cross-agent imports.
import { useEffect, useState, useCallback } from 'react';
import { useToast } from './UI.jsx';
import FxBackdrop from './FxBackdrop.jsx';

const REDUCED = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const KINDRED_URL = 'https://kindred-weld-five.vercel.app';

export default function ShareCard() {
  const toast = useToast();
  const [data, setData] = useState(null);

  const close = useCallback(() => setData(null), []);

  useEffect(() => {
    const onShare = (e) => {
      const d = (e && e.detail) || {};
      setData({
        title: d.title || 'A moment worth keeping',
        subtitle: d.subtitle || 'Made with Kindred and Aria',
        stat: d.stat != null ? String(d.stat) : '',
        emoji: d.emoji || '',
      });
    };
    window.addEventListener('kindred:share', onShare);
    return () => window.removeEventListener('kindred:share', onShare);
  }, []);

  useEffect(() => {
    if (!data) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [data, close]);

  const isNative = useCallback(() => {
    try {
      const c = typeof window !== 'undefined' ? window.Capacitor : null;
      return !!(c && (typeof c.isNativePlatform === 'function' ? c.isNativePlatform() : c.isNative));
    } catch (_) { return false; }
  }, []);

  const doShare = useCallback(async () => {
    if (!data) return;
    const text = `${data.title} - ${data.subtitle}`;
    const payload = { title: data.title, text, url: KINDRED_URL };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(payload);
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return;
      }
    }

    if (isNative()) {
      try {
        const m = await import('@capacitor/share');
        const Share = m && (m.Share || (m.default && m.default.Share));
        if (Share && typeof Share.share === 'function') {
          await Share.share({ title: data.title, text, url: KINDRED_URL, dialogTitle: 'Share with Kindred' });
          return;
        }
      } catch (_) { /* fall through to clipboard */ }
    }

    const shareString = `${text}\n${KINDRED_URL}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareString);
        toast('Copied to share', 'ok');
        return;
      }
    } catch (_) { /* fall through */ }
    toast('Sharing is not available here', 'warn');
  }, [data, isNative, toast]);

  if (!data) return null;

  const reduced = REDUCED();

  return (
    <div
      className="kshr-scrim"
      role="dialog"
      aria-modal="true"
      aria-label="Share this moment"
      onClick={close}
    >
      <style>{`
        .kshr-scrim {
          position: fixed; inset: 0; z-index: 200;
          display: flex; align-items: center; justify-content: center;
          padding: calc(1rem + env(safe-area-inset-top)) 1rem calc(1rem + env(safe-area-inset-bottom));
          background: rgba(46,36,30,.5); backdrop-filter: blur(4px);
          animation: kshrScrim .22s ease both;
        }
        .kshr-shell {
          width: 100%; max-width: 440px; max-height: 92dvh;
          display: flex; flex-direction: column; gap: 1.1rem;
          animation: kshrPop .34s cubic-bezier(.2,.8,.25,1) both;
        }
        .kshr-card {
          --fx-glow: 250,138,74;
          position: relative; overflow: hidden;
          border-radius: 24px; padding: 2.4rem 1.8rem 1.6rem;
          text-align: center; color: var(--ink);
          background:
            radial-gradient(120% 90% at 20% 0%, rgba(255,244,230,.72) 0%, transparent 55%),
            radial-gradient(130% 100% at 85% 8%, rgba(255,232,238,.55) 0%, transparent 52%),
            linear-gradient(160deg, rgba(255,246,236,.66) 0%, rgba(255,251,246,.5) 48%, rgba(255,236,214,.62) 118%);
          box-shadow:
            0 28px 70px -18px rgba(120,70,40,.55),
            0 0 0 1px rgba(255,255,255,.35) inset,
            0 0 40px -6px rgba(250,138,74,.28);
        }
        .kshr-card::before {
          content: ''; position: absolute; inset: 0; pointer-events: none; z-index: 1;
          background: radial-gradient(80% 60% at 50% -10%, rgba(255,255,255,.7), transparent 70%);
          opacity: .55;
        }
        .kshr-inner { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; }
        .kshr-orb-wrap { position: relative; margin-bottom: 1.25rem; }
        .kshr-orb-halo {
          position: absolute; left: 50%; top: 50%; width: 150px; height: 150px;
          transform: translate(-50%,-50%); border-radius: 50%; pointer-events: none; z-index: 0;
          background: radial-gradient(circle, rgba(250,138,74,.45), rgba(233,120,160,.22) 45%, transparent 70%);
          filter: blur(8px); animation: kshrHalo 4.2s ease-in-out infinite;
        }
        .kshr-emoji {
          position: absolute; inset: 0; display: grid; place-items: center;
          font-size: 2rem; z-index: 2; filter: drop-shadow(0 2px 6px rgba(70,40,25,.4));
        }
        .kshr-stat-stack {
          position: relative; display: inline-block;
          margin: .2rem 0 .1rem; overflow-wrap: anywhere; z-index: 0;
        }
        .kshr-stat {
          position: relative; z-index: 1; display: block;
          font-family: var(--font-display); font-weight: 700;
          font-size: clamp(3.6rem, 16vw, 5.4rem); line-height: .94;
          letter-spacing: -.03em;
          font-variant-numeric: tabular-nums;
        }
        .kshr-stat-bloom {
          position: absolute; inset: 0; z-index: 0; pointer-events: none;
          font-family: var(--font-display); font-weight: 700;
          font-size: clamp(3.6rem, 16vw, 5.4rem); line-height: .94;
          letter-spacing: -.03em; font-variant-numeric: tabular-nums;
          background: var(--fx-holo); background-size: 300% 100%;
          -webkit-background-clip: text; background-clip: text;
          color: transparent; -webkit-text-fill-color: transparent;
          filter: blur(15px) saturate(150%); opacity: .8;
          animation: fx-holo-shift 6s linear infinite;
        }
        .kshr-title {
          font-family: var(--font-display); font-weight: 600;
          font-size: 1.55rem; line-height: 1.14; letter-spacing: -.015em;
          color: var(--ink); margin: .5rem 0 0;
        }
        .kshr-sub {
          font-size: 1.02rem; line-height: 1.5; color: var(--ink-2);
          margin: .55rem auto 0; max-width: 30ch;
        }
        .kshr-rule {
          width: 60px; height: 3px; border-radius: 3px; margin: 1.5rem auto .95rem;
          box-shadow: 0 0 12px rgba(var(--fx-glow), .5);
        }
        .kshr-mark {
          display: inline-flex; align-items: center; gap: .5rem;
          font-family: var(--font-display); font-weight: 600; font-size: 1.05rem;
          letter-spacing: .02em; color: var(--accent-700);
        }
        .kshr-mark .dot {
          width: 9px; height: 9px; border-radius: 50%;
          background: radial-gradient(circle at 34% 28%, #f6c39a, #e0794e 60%, #c2543a);
          box-shadow: 0 0 10px 1px rgba(217,107,67,.55);
        }
        .kshr-actions { display: flex; gap: .7rem; }
        .kshr-actions .btn { flex: 1; justify-content: center; }
        .kshr-btn { position: relative; z-index: 1; border-radius: 14px; }
        @keyframes kshrScrim { from { opacity: 0; } to { opacity: 1; } }
        @keyframes kshrPop { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
        @keyframes kshrHalo {
          0%, 100% { opacity: .7; transform: translate(-50%,-50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%,-50%) scale(1.12); }
        }
        @media (prefers-reduced-motion: reduce) {
          .kshr-scrim, .kshr-shell, .kshr-orb-halo, .kshr-stat-bloom { animation: none !important; }
        }
      `}</style>

      <div className="kshr-shell" onClick={(e) => e.stopPropagation()}>
        <div className={`kshr-card fx-glass fx-ring fx-tilt${reduced ? '' : ' fx-shimmer'}`}>
          {/* Holographic collectible scene: drifting aurora + rising particle motes. */}
          <FxBackdrop density={38} glow="250,138,74" style={{ opacity: 0.5 }} />

          <div className="kshr-inner">
            <div className={`kshr-orb-wrap${reduced ? '' : ' fx-float'}`}>
              <span className="kshr-orb-halo" aria-hidden />
              <span className="aria-orb" style={{ width: 72, height: 72, display: 'block' }} aria-hidden />
              {data.emoji && <span className="kshr-emoji" aria-hidden>{data.emoji}</span>}
            </div>

            {data.stat && (
              <div className="kshr-stat-stack" aria-label={data.stat}>
                <span className="kshr-stat-bloom" aria-hidden>{data.stat}</span>
                <span className="kshr-stat fx-holo-text fx-neon-text" aria-hidden>{data.stat}</span>
              </div>
            )}
            <h2 className="kshr-title">{data.title}</h2>
            <p className="kshr-sub">{data.subtitle}</p>

            <div className="kshr-rule fx-holo-fill" aria-hidden />
            <span className="kshr-mark">
              <span className="dot" aria-hidden />
              Kindred
            </span>
          </div>
        </div>

        <div className="kshr-actions">
          <button type="button" className="btn btn-ghost fx-glass kshr-btn" onClick={close}>Close</button>
          <button type="button" className={`btn btn-primary fx-neon kshr-btn${reduced ? '' : ' fx-neon-breathe'}`} onClick={doShare}>Share</button>
        </div>
      </div>
    </div>
  );
}
