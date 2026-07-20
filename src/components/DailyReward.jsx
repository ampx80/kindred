// Kindred's daily reward. A warm, anticipation-building moment: a short beat
// after the page settles, Aria offers a glowing spark orb that invites a tap.
// Tapping claims the reward, bursts the orb, counts up the sparks and XP,
// celebrates the login-day streak, and (every 7th day) reveals a streak freeze.
// Shows at most once per day; canClaimDaily flips false the instant it is
// claimed, so a fresh mount will not offer it again.
import { useState, useEffect, useRef, useCallback } from 'react';
import { Icon } from './icons.jsx';
import { claimDailyReward, getGame, onGameMoment } from '../lib/game.js';
import { sChime, sSuccess, sCelebrate } from '../lib/sound.js';
import * as sfx from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { celebrate } from '../lib/celebrate.js';

const REDUCED = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false;

// Count a number up from 0 to target with an ease-out curve. Under reduced
// motion (or a zero target) it snaps straight to the value.
function useCountUp(target, run, dur = 1050) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!run) { setV(0); return; }
    if (REDUCED || !target) { setV(target || 0); return; }
    let raf;
    const start = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setV(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, dur]);
  return v;
}

export default function DailyReward() {
  // 'idle' -> nothing yet | 'closed' -> gift ready | 'revealed' -> claimed | 'gone'
  const [stage, setStage] = useState('idle');
  const [reward, setReward] = useState(null);
  const revealedRef = useRef(false);
  const dismissedRef = useRef(false);
  const orbRef = useRef(null);

  const sparks = useCountUp(reward?.sparks || 0, stage === 'revealed');
  const xp = useCountUp(reward?.xp || 0, stage === 'revealed');

  // Move straight into the reveal with a given result (from our own tap, or as
  // a backup when the daily was claimed somewhere else while we were mounted).
  const revealWith = useCallback((res) => {
    if (revealedRef.current || dismissedRef.current) return;
    if (!res) return;
    revealedRef.current = true;
    setReward({
      sparks: res.sparks || 0,
      xp: res.xp || 0,
      day: res.day || 1,
      freeze: !!res.freeze,
    });
    setStage('revealed');
  }, []);

  // On mount: if today's reward is unclaimed, wait a beat so we do not fight
  // the page load, then present the closed gift.
  useEffect(() => {
    if (!getGame().canClaimDaily) return;
    const t = setTimeout(() => {
      if (!revealedRef.current && !dismissedRef.current) setStage('closed');
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  // Backup sync: if the daily is claimed elsewhere, reveal from the moment bus.
  useEffect(() => {
    return onGameMoment((m) => {
      if (m && m.type === 'daily') revealWith(m);
    });
  }, [revealWith]);

  // Fire the full payoff once the reveal is mounted (so the orb exists to
  // burst confetti from).
  useEffect(() => {
    if (stage !== 'revealed') return;
    haptic('success');
    try {
      if (typeof sfx.sReward === 'function') sfx.sReward();
      else sChime();
    } catch { try { sChime(); } catch {} }
    try { sfx.sCoin?.(); } catch {}
    try { sCelebrate(); } catch {}
    let x, y;
    const el = orbRef.current;
    if (el && el.getBoundingClientRect) {
      const r = el.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    celebrate(x != null ? { x, y, count: 110, spread: 1.05 } : { count: 110 });
  }, [stage]);

  const open = useCallback(() => {
    if (revealedRef.current) return;
    haptic('medium');
    try { sSuccess(); } catch {}
    const res = claimDailyReward();
    if (res && res.ok) revealWith(res);
    else { dismissedRef.current = true; setStage('gone'); } // already claimed
  }, [revealWith]);

  const dismiss = useCallback(() => {
    dismissedRef.current = true;
    setStage('gone');
  }, []);

  if (stage !== 'closed' && stage !== 'revealed') return null;

  const revealing = stage === 'revealed';

  return (
    <div
      className="kdr-scrim"
      role="presentation"
      onClick={revealing ? dismiss : undefined}
    >
      <div
        className={`kdr-card ${revealing ? 'kdr-card--reveal' : 'kdr-card--closed'}`}
        role="dialog"
        aria-modal="true"
        aria-label={revealing ? 'Daily reward claimed' : 'Your daily spark is ready'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kdr-aria">
          <span className="aria-orb" aria-hidden style={{ width: 44, height: 44 }} />
          <span className="kdr-aria-txt">Aria</span>
        </div>

        {!revealing && (
          <>
            <button className="kdr-gift" onClick={open} aria-label="Open your daily spark">
              <span className="kdr-gift-orb">
                <Icon name="sparkles" size={40} fill="rgba(255,255,255,.22)" />
              </span>
              <span className="kdr-gift-shine" aria-hidden />
              <span className="kdr-gift-tap" aria-hidden>Tap</span>
            </button>
            <h3 className="kdr-title serif">Your daily spark is ready</h3>
            <p className="kdr-sub muted">A little gift for showing up today. Tap to open it.</p>
            <button className="btn btn-ghost btn-sm kdr-later" onClick={dismiss}>Not now</button>
          </>
        )}

        {revealing && reward && (
          <>
            <span className="kdr-day">
              <Icon name="flame" size={15} /> Day {reward.day} streak
            </span>
            <div className="kdr-burst-orb" ref={orbRef}>
              <span className="kdr-rays" aria-hidden>
                {Array.from({ length: 12 }).map((_, i) => (
                  <i key={i} style={{ '--i': i }} />
                ))}
              </span>
              <Icon name="sparkles" size={46} fill="rgba(255,255,255,.25)" />
            </div>
            <h3 className="kdr-title serif">Your spark, collected</h3>
            <p className="kdr-sub muted">Thanks for showing up. Here is today's reward.</p>

            <div className="kdr-rewards">
              <div className="kdr-reward">
                <span className="kdr-num">+{sparks}</span>
                <span className="kdr-num-label"><Icon name="sparkles" size={13} /> Sparks</span>
              </div>
              <span className="kdr-reward-div" aria-hidden />
              <div className="kdr-reward">
                <span className="kdr-num">+{xp}</span>
                <span className="kdr-num-label">XP</span>
              </div>
            </div>

            {reward.freeze && (
              <div className="kdr-freeze">
                <span className="kdr-freeze-ic"><Icon name="sparkles" size={18} /></span>
                <span className="kdr-freeze-txt">
                  <strong>Streak freeze earned</strong>
                  <span>Miss a day, keep your streak. One saved for you.</span>
                </span>
              </div>
            )}

            <button className="btn btn-primary kdr-collect" onClick={dismiss}>
              <Icon name="check" size={18} /> Collect
            </button>
          </>
        )}
      </div>

      <style>{`
        .kdr-scrim {
          position: fixed; inset: 0; z-index: 160;
          display: flex; align-items: center; justify-content: center;
          padding: calc(1rem + env(safe-area-inset-top, 0px)) 1rem calc(1rem + env(safe-area-inset-bottom, 0px));
          background: radial-gradient(circle at 50% 38%, rgba(46,36,30,.42), rgba(46,36,30,.6));
          backdrop-filter: blur(5px) saturate(1.05);
          animation: kdrFade .35s var(--ease) both;
        }
        @keyframes kdrFade { from { opacity: 0; } to { opacity: 1; } }

        .kdr-card {
          position: relative; width: 100%; max-width: 384px;
          background: var(--paper); border: 1px solid var(--line);
          border-radius: var(--r-xl); box-shadow: var(--shadow-lg);
          padding: 1.7rem 1.6rem 1.5rem; text-align: center;
          display: flex; flex-direction: column; align-items: center; gap: .5rem;
          animation: kdrPop .55s var(--spring) both;
        }
        @keyframes kdrPop { 0% { opacity: 0; transform: scale(.9) translateY(14px); } 100% { opacity: 1; transform: none; } }

        .kdr-aria { display: inline-flex; align-items: center; gap: .5rem; margin-bottom: .1rem; }
        .kdr-aria-txt { font-size: .74rem; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--n-600); }

        .kdr-title { margin: .35rem 0 0; font-size: 1.45rem; }
        .kdr-sub { font-size: .96rem; line-height: 1.5; max-width: 300px; }

        /* ---- closed gift ---- */
        .kdr-gift {
          position: relative; width: 116px; height: 116px; margin: .6rem 0 .4rem;
          border: none; background: none; padding: 0; cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: transform .2s var(--spring);
        }
        .kdr-gift:hover { transform: translateY(-3px) scale(1.04); }
        .kdr-gift:active { transform: scale(.95); }
        .kdr-gift-orb {
          position: absolute; inset: 0; border-radius: 50%; display: grid; place-items: center; color: #fff;
          background: radial-gradient(circle at 34% 28%, #fce2ab, #dd9a2e 44%, #e0794e 80%, #c2543a);
          box-shadow: 0 16px 44px -8px rgba(221,154,46,.6), 0 0 0 8px rgba(221,154,46,.12);
          animation: kdrPulse 2.5s ease-in-out infinite;
          overflow: hidden;
        }
        @keyframes kdrPulse {
          0%,100% { box-shadow: 0 16px 44px -8px rgba(221,154,46,.55), 0 0 0 6px rgba(221,154,46,.14); }
          50%     { box-shadow: 0 20px 54px -8px rgba(221,154,46,.72), 0 0 0 15px rgba(221,154,46,.05); }
        }
        .kdr-gift-shine {
          position: absolute; inset: 0; border-radius: 50%; overflow: hidden; pointer-events: none;
        }
        .kdr-gift-shine::before {
          content: ''; position: absolute; inset: -20%;
          background: linear-gradient(115deg, transparent 34%, rgba(255,255,255,.6) 50%, transparent 66%);
          transform: translateX(-120%);
          animation: kdrShine 3.4s var(--ease) infinite;
        }
        @keyframes kdrShine { 0% { transform: translateX(-120%); } 55%,100% { transform: translateX(120%); } }
        .kdr-gift-tap {
          position: absolute; left: 50%; bottom: -6px; transform: translateX(-50%);
          font-size: .66rem; font-weight: 800; letter-spacing: .12em; text-transform: uppercase;
          color: var(--accent-700); background: var(--paper);
          border: 1px solid var(--accent-300); border-radius: 999px; padding: .12rem .5rem;
          box-shadow: var(--shadow-sm);
        }

        .kdr-later { margin-top: .5rem; color: var(--n-600); }

        /* ---- reveal ---- */
        .kdr-day {
          display: inline-flex; align-items: center; gap: .35rem;
          padding: .3rem .8rem; border-radius: 999px;
          background: var(--accent-50); color: var(--accent-700);
          font-weight: 700; font-size: .82rem; letter-spacing: .01em;
        }
        .kdr-burst-orb {
          position: relative; width: 112px; height: 112px; border-radius: 50%;
          display: grid; place-items: center; color: #fff; margin: .5rem 0 .1rem;
          background: radial-gradient(circle at 34% 28%, #fce2ab, #dd9a2e 44%, #e0794e 80%, #c2543a);
          box-shadow: 0 18px 50px -8px rgba(221,154,46,.62), 0 0 0 8px rgba(221,154,46,.1);
          animation: kdrBurst .7s var(--spring) both;
        }
        @keyframes kdrBurst {
          0%   { opacity: 0; transform: scale(.35); }
          55%  { opacity: 1; transform: scale(1.14); }
          100% { transform: scale(1); }
        }
        .kdr-rays { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
        .kdr-rays i {
          position: absolute; top: 50%; left: 50%; width: 4px; height: 26px; border-radius: 4px;
          background: linear-gradient(var(--gold), transparent); transform-origin: 50% 0;
          transform: rotate(calc(var(--i) * 30deg)) translateY(-60px);
          animation: kdrRay .85s var(--spring) both; animation-delay: calc(var(--i) * .03s);
        }
        @keyframes kdrRay {
          0%   { opacity: 0; transform: rotate(calc(var(--i) * 30deg)) translateY(-22px) scaleY(.2); }
          100% { opacity: .82; transform: rotate(calc(var(--i) * 30deg)) translateY(-60px) scaleY(1); }
        }

        .kdr-rewards {
          display: flex; align-items: center; justify-content: center; gap: 1.3rem;
          margin: .55rem 0 .2rem;
        }
        .kdr-reward { display: flex; flex-direction: column; align-items: center; gap: .2rem; }
        .kdr-reward-div { width: 1px; height: 40px; background: var(--line); }
        .kdr-num {
          font-family: var(--font-display); font-weight: 700; font-size: 2.5rem; line-height: 1;
          color: var(--accent-700); font-variant-numeric: tabular-nums;
        }
        .kdr-num-label {
          display: inline-flex; align-items: center; gap: .3rem;
          font-size: .76rem; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--n-600);
        }

        .kdr-freeze {
          display: flex; align-items: center; gap: .7rem; text-align: left;
          margin-top: .55rem; width: 100%; padding: .8rem .95rem;
          border-radius: var(--r-md); background: var(--sky-bg);
          border: 1px solid color-mix(in srgb, var(--sky) 32%, transparent);
          animation: kdrFrost .5s var(--ease) both .35s;
        }
        @keyframes kdrFrost { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .kdr-freeze-ic {
          width: 38px; height: 38px; border-radius: 12px; flex: none;
          display: grid; place-items: center; color: var(--sky);
          background: color-mix(in srgb, var(--sky) 16%, var(--paper));
        }
        .kdr-freeze-txt { display: flex; flex-direction: column; gap: .1rem; line-height: 1.35; }
        .kdr-freeze-txt strong { color: var(--sky); font-size: .98rem; }
        .kdr-freeze-txt span { color: var(--n-700); font-size: .84rem; }

        .kdr-collect { margin-top: .9rem; width: 100%; gap: .45rem; }

        @media (max-width: 540px) {
          .kdr-scrim { align-items: flex-end; }
          .kdr-card { max-width: 520px; animation: kdrSheetUp .4s var(--spring) both; }
          @keyframes kdrSheetUp { from { opacity: 0; transform: translateY(100%); } to { opacity: 1; transform: none; } }
        }

        @media (prefers-reduced-motion: reduce) {
          .kdr-scrim, .kdr-card, .kdr-gift-orb, .kdr-gift-shine::before,
          .kdr-burst-orb, .kdr-rays i, .kdr-freeze { animation: none !important; }
          .kdr-gift, .kdr-gift:hover, .kdr-gift:active { transition: none !important; transform: none !important; }
          .kdr-card { opacity: 1; transform: none; }
          .kdr-rays i { opacity: .82; transform: rotate(calc(var(--i) * 30deg)) translateY(-60px); }
        }
      `}</style>
    </div>
  );
}
