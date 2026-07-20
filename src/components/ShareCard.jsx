// Global share surface for Kindred. Driven purely by window events so any
// screen can fire `window.dispatchEvent(new CustomEvent('kindred:share',
// { detail: { title, subtitle, stat, emoji } }))` and get a branded,
// shareable card with native share / clipboard fallbacks. No cross-agent imports.
import { useEffect, useState, useCallback } from 'react';
import { useToast } from './UI.jsx';

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
          position: relative; overflow: hidden;
          border-radius: 24px; padding: 2.4rem 1.8rem 1.6rem;
          text-align: center; color: var(--ink);
          border: 1px solid var(--line);
          background:
            radial-gradient(120% 90% at 20% 0%, var(--gold-bg) 0%, transparent 55%),
            radial-gradient(130% 100% at 85% 8%, var(--rose-bg) 0%, transparent 52%),
            linear-gradient(160deg, var(--accent-50) 0%, var(--paper) 48%, var(--gold-bg) 118%);
          box-shadow: 0 24px 60px -18px rgba(120,70,40,.5);
        }
        .kshr-card::before {
          content: ''; position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(80% 60% at 50% -10%, rgba(255,255,255,.7), transparent 70%);
          opacity: .6;
        }
        .kshr-inner { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; }
        .kshr-orb-wrap { position: relative; margin-bottom: 1.25rem; }
        .kshr-emoji {
          position: absolute; inset: 0; display: grid; place-items: center;
          font-size: 2rem; z-index: 2; filter: drop-shadow(0 2px 4px rgba(70,40,25,.35));
        }
        .kshr-stat {
          font-family: var(--font-display); font-weight: 700;
          font-size: clamp(3.4rem, 15vw, 5rem); line-height: .96;
          letter-spacing: -.03em; color: var(--accent-700);
          font-variant-numeric: tabular-nums; margin: .2rem 0 .1rem;
          overflow-wrap: anywhere;
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
          width: 46px; height: 3px; border-radius: 3px; margin: 1.5rem auto .95rem;
          background: linear-gradient(90deg, var(--accent), var(--gold));
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
        @keyframes kshrScrim { from { opacity: 0; } to { opacity: 1; } }
        @keyframes kshrPop { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .kshr-scrim, .kshr-shell { animation: none !important; }
        }
      `}</style>

      <div className="kshr-shell" onClick={(e) => e.stopPropagation()}>
        <div className="kshr-card">
          <div className="kshr-inner">
            <div className="kshr-orb-wrap">
              <span className="aria-orb" style={{ width: 72, height: 72, display: 'block' }} aria-hidden />
              {data.emoji && <span className="kshr-emoji" aria-hidden>{data.emoji}</span>}
            </div>

            {data.stat && <div className="kshr-stat">{data.stat}</div>}
            <h2 className="kshr-title">{data.title}</h2>
            <p className="kshr-sub">{data.subtitle}</p>

            <div className="kshr-rule" aria-hidden />
            <span className="kshr-mark">
              <span className="dot" aria-hidden />
              Kindred
            </span>
          </div>
        </div>

        <div className="kshr-actions">
          <button type="button" className="btn btn-ghost" onClick={close}>Close</button>
          <button type="button" className="btn btn-primary" onClick={doShare}>Share</button>
        </div>
      </div>
    </div>
  );
}
