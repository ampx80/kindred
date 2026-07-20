// NotifyWizard - a warm, multi-step opt-in for Aria's gentle daily nudges. It is
// mounted once in the app shell and renders nothing until opened. It opens two
// ways: automatically, once, a few seconds after a profiled user first lands (so
// the ask lands in a calm moment, never on a cold first paint), or on demand from
// Settings via the openNotifyWizard() helper. The whole tone is "a soft nudge, not
// a nag" - one or two reminders a day, off anytime. No em-dashes anywhere.
import { useEffect, useRef, useState } from 'react';
import { enablePush, pushSupported, notificationPermission } from '../lib/push.js';
import { useStore, getReminders, setReminders } from '../lib/store.js';
import { authHeader } from '../lib/account.js';
import { track } from '../lib/track.js';
import { sCelebrate } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { celebrate } from '../lib/celebrate.js';
import { Icon } from '../components/icons.jsx';

const SEEN_KEY = 'kindred_notify_seen';
const OPEN_EVENT = 'kindred:open-notify';

// Module-level opener so any surface (Settings, onboarding) can raise the wizard
// without importing the component instance. The mounted component listens.
export function openNotifyWizard() {
  try { window.dispatchEvent(new CustomEvent(OPEN_EVENT)); } catch {}
}

function fmtHour(h) {
  const period = h < 12 ? 'AM' : 'PM';
  let hr = h % 12;
  if (hr === 0) hr = 12;
  return `${hr}:00 ${period}`;
}

const MORNING_HOURS = [5, 6, 7, 8, 9, 10, 11];
const EVENING_HOURS = [17, 18, 19, 20, 21, 22, 23];

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// A friendly horizontal hour picker with an on/off toggle. null hour = off.
function TimeRow({ icon, label, hours, value, on, onToggle, onPick }) {
  return (
    <div className="nw-timerow">
      <div className="nw-timerow-head">
        <span className="nw-timerow-label"><Icon name={icon} size={18} /> {label}</span>
        <button
          type="button"
          className={`nw-switch${on ? ' on' : ''}`}
          onClick={onToggle}
          aria-pressed={on}
          aria-label={`Toggle ${label}`}
        ><span /></button>
      </div>
      <div className={`nw-hours${on ? '' : ' off'}`} role="group" aria-label={`${label} time`}>
        {hours.map(h => (
          <button
            type="button"
            key={h}
            className={`nw-chip${value === h && on ? ' sel' : ''}`}
            onClick={() => { if (!on) onToggle(); onPick(h); }}
          >{fmtHour(h)}</button>
        ))}
      </div>
    </div>
  );
}

export default function NotifyWizard() {
  const profile = useStore(s => s.profile);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);   // 1 value, 2 permission, 'ios', 'denied', 3 times, 4 done
  const [busy, setBusy] = useState(false);

  const initial = getReminders();
  const [morning, setMorning] = useState(Number.isInteger(initial.morning) ? initial.morning : 8);
  const [evening, setEvening] = useState(Number.isInteger(initial.evening) ? initial.evening : 21);
  const [morningOn, setMorningOn] = useState(true);
  const [eveningOn, setEveningOn] = useState(true);

  const autoTried = useRef(false);
  const reduced = reducedMotion();

  // Open on demand (Settings, onboarding) via the module-level event.
  useEffect(() => {
    const onOpen = () => {
      setStep(1);
      setBusy(false);
      setOpen(true);
      track('notify_wizard_open');
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  // Auto-open once, a few seconds in, only for a profiled user who has not been
  // asked, whose browser can do push, and who has not already chosen.
  useEffect(() => {
    if (autoTried.current || !profile) return;
    const t = setTimeout(() => {
      if (autoTried.current) return;
      try {
        if (
          profile &&
          !localStorage.getItem(SEEN_KEY) &&
          notificationPermission() === 'default' &&
          pushSupported()
        ) {
          autoTried.current = true;
          openNotifyWizard();
        }
      } catch {}
    }, 4000);
    return () => clearTimeout(t);
  }, [profile]);

  const markSeen = () => { try { localStorage.setItem(SEEN_KEY, '1'); } catch {} };

  const dismiss = () => {
    markSeen();
    setOpen(false);
  };

  const requestPermission = async () => {
    setBusy(true);
    try {
      if (!pushSupported()) { setStep('ios'); return; }
      const r = await enablePush();
      if (r.ok) {
        track('notify_enabled');
        setStep(3);
        return;
      }
      if (r.reason === 'not-supported') { setStep('ios'); return; }
      if (r.reason === 'denied') { setStep('denied'); return; }
      setStep('denied');
    } finally {
      setBusy(false);
    }
  };

  const finishTimes = async () => {
    setBusy(true);
    const tz = (() => {
      try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
    })();
    const m = morningOn ? morning : null;
    const e = eveningOn ? evening : null;
    const prefs = { enabled: true, morning: m, evening: e, tz };

    setReminders({ enabled: true, morning: m, evening: e, tz });
    track('reminders_set', { morning: m, evening: e });

    // The endpoint + keys were already stored in step 2 by enablePush(); here we
    // just merge the schedule prefs onto that same row (matched by endpoint).
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) {
        const raw = sub.toJSON();
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeader() },
          body: JSON.stringify({ endpoint: raw.endpoint, keys: raw.keys, prefs }),
        });
      }
    } catch {}

    setBusy(false);
    setStep(4);
    markSeen();
    if (!reduced) { try { celebrate(); } catch {} }
    try { sCelebrate(); } catch {}
    try { haptic('celebrate'); } catch {}
  };

  const sendTest = async () => {
    const body = 'This is what a nudge feels like. See you tomorrow.';
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.showNotification) {
        await reg.showNotification('Aria', { body, tag: 'kindred-test', icon: '/brand/mark.svg' });
        return;
      }
      if (notificationPermission() === 'granted' && typeof Notification !== 'undefined') {
        new Notification('Aria', { body });
      }
    } catch {}
  };

  if (!open) return null;

  return (
    <div className="nw-scrim" role="dialog" aria-modal="true" aria-label="Set up gentle reminders" onClick={dismiss}>
      <div className={`nw-card${reduced ? ' nw-still' : ''}`} onClick={e => e.stopPropagation()}>
        <button type="button" className="nw-close" onClick={dismiss} aria-label="Close">
          <Icon name="x" size={18} />
        </button>

        {step === 1 && (
          <div className="nw-body nw-center">
            <div className="nw-orbwrap">
              <div className="aria-orb nw-orb" style={{ width: 92, height: 92 }} />
              <span className="nw-orbicon"><Icon name="heart" size={26} /></span>
            </div>
            <h2 className="nw-title">Want a gentle nudge from Aria?</h2>
            <p className="nw-copy">
              One or two soft reminders a day, in your own words and rhythm. A warm hello in the
              morning, a quiet look back at night. Never a nag, and you can turn it off anytime.
            </p>
            <div className="nw-actions">
              <button type="button" className="nw-btn nw-primary" onClick={() => setStep(2)}>
                Yes, set it up <Icon name="arrowRight" size={17} />
              </button>
              <button type="button" className="nw-btn nw-quiet" onClick={dismiss}>Not now</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="nw-body nw-center">
            <div className="nw-orbwrap">
              <div className="aria-orb nw-orb" style={{ width: 84, height: 84 }} />
              <span className="nw-orbicon"><Icon name="sparkles" size={24} /></span>
            </div>
            <h2 className="nw-title">One quick permission</h2>
            <p className="nw-copy">
              Your browser will ask if Aria can send notifications. Say yes and we will pick your
              times next. Nothing is sent without your schedule.
            </p>
            <div className="nw-actions">
              <button type="button" className="nw-btn nw-primary" onClick={requestPermission} disabled={busy}>
                {busy ? 'One sec...' : 'Turn on notifications'}
              </button>
              <button type="button" className="nw-btn nw-quiet" onClick={dismiss}>Not now</button>
            </div>
          </div>
        )}

        {step === 'ios' && (
          <div className="nw-body nw-center">
            <div className="nw-orbwrap">
              <div className="aria-orb nw-orb" style={{ width: 84, height: 84 }} />
              <span className="nw-orbicon"><Icon name="heart" size={24} /></span>
            </div>
            <h2 className="nw-title">Add Kindred to your Home Screen first</h2>
            <p className="nw-copy">
              On iPhone, add Kindred to your Home Screen first (Share -&gt; Add to Home Screen), then
              open it from there and turn this on. It only takes a moment, and then Aria can reach you.
            </p>
            <div className="nw-actions">
              <button type="button" className="nw-btn nw-primary" onClick={dismiss}>Done</button>
            </div>
          </div>
        )}

        {step === 'denied' && (
          <div className="nw-body nw-center">
            <div className="nw-orbwrap">
              <div className="aria-orb nw-orb" style={{ width: 84, height: 84 }} />
              <span className="nw-orbicon"><Icon name="moon" size={24} /></span>
            </div>
            <h2 className="nw-title">Notifications are blocked</h2>
            <p className="nw-copy">
              Notifications are blocked in your browser settings. To turn them on, open your browser
              site settings for Kindred, allow notifications, then come back and try again. No rush,
              this is here whenever you want it.
            </p>
            <div className="nw-actions">
              <button type="button" className="nw-btn nw-primary" onClick={dismiss}>Okay</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="nw-body">
            <h2 className="nw-title nw-title-left">When should Aria check in?</h2>
            <p className="nw-copy nw-copy-left">
              Pick what fits your day. Toggle either one off if you only want one nudge. You can
              change these anytime in Settings.
            </p>
            <TimeRow
              icon="sun"
              label="Morning check-in"
              hours={MORNING_HOURS}
              value={morning}
              on={morningOn}
              onToggle={() => setMorningOn(v => !v)}
              onPick={setMorning}
            />
            <TimeRow
              icon="moon"
              label="Evening reflection"
              hours={EVENING_HOURS}
              value={evening}
              on={eveningOn}
              onToggle={() => setEveningOn(v => !v)}
              onPick={setEvening}
            />
            <div className="nw-actions nw-actions-left">
              <button
                type="button"
                className="nw-btn nw-primary"
                onClick={finishTimes}
                disabled={busy || (!morningOn && !eveningOn)}
              >
                {busy ? 'Saving...' : 'Set my reminders'} <Icon name="check" size={17} />
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="nw-body nw-center">
            <div className="nw-orbwrap">
              <div className="aria-orb nw-orb" style={{ width: 92, height: 92 }} />
              <span className="nw-orbicon"><Icon name="check" size={28} /></span>
            </div>
            <h2 className="nw-title">You are set</h2>
            <p className="nw-copy">
              Aria will reach out gently
              {morningOn ? ` in the morning at ${fmtHour(morning)}` : ''}
              {morningOn && eveningOn ? ' and' : ''}
              {eveningOn ? ` in the evening at ${fmtHour(evening)}` : ''}.
              Want to feel one now?
            </p>
            <div className="nw-actions">
              <button type="button" className="nw-btn nw-primary" onClick={sendTest}>
                <Icon name="sparkles" size={17} /> Send me a test
              </button>
              <button type="button" className="nw-btn nw-quiet" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .nw-scrim {
          position: fixed; inset: 0; z-index: 1200;
          display: flex; align-items: center; justify-content: center;
          padding: 1.1rem;
          background: rgba(28, 18, 12, .46);
          backdrop-filter: blur(3px);
          animation: nwFade .22s ease both;
        }
        .nw-card {
          position: relative;
          width: 100%; max-width: 440px;
          max-height: calc(100dvh - 2rem);
          overflow-y: auto;
          background: var(--paper, #fff);
          color: var(--ink);
          border: 1px solid var(--line);
          border-radius: var(--r-md, 20px);
          box-shadow: 0 30px 80px -20px rgba(40, 22, 12, .5);
          padding: 1.9rem 1.5rem 1.6rem;
          transform-origin: center bottom;
          animation: nwPop .34s cubic-bezier(.16, 1.16, .3, 1) both;
        }
        .nw-still, .nw-scrim.nw-still { animation: nwFade .18s ease both; }
        .nw-still { transform: none; }
        .nw-close {
          position: absolute; top: .7rem; right: .7rem;
          width: 34px; height: 34px; display: grid; place-items: center;
          border: none; border-radius: 999px; cursor: pointer;
          background: var(--n-100); color: var(--n-600);
          transition: background .15s ease, color .15s ease;
        }
        .nw-close:hover { background: var(--n-200, var(--n-100)); color: var(--ink); }
        .nw-body { display: flex; flex-direction: column; gap: .85rem; }
        .nw-center { align-items: center; text-align: center; }
        .nw-orbwrap { position: relative; display: grid; place-items: center; margin: .3rem 0 .2rem; }
        .nw-orbicon {
          position: absolute; inset: 0; display: grid; place-items: center;
          color: #fff; filter: drop-shadow(0 2px 6px rgba(120, 50, 20, .4));
        }
        .nw-title {
          font-family: var(--font-display, inherit);
          font-size: 1.5rem; line-height: 1.18; font-weight: 700;
          letter-spacing: -.02em; margin: .1rem 0 0;
        }
        .nw-title-left { text-align: left; }
        .nw-copy { color: var(--n-600); font-size: 1.02rem; line-height: 1.55; margin: 0; }
        .nw-copy-left { text-align: left; }
        .nw-actions { display: flex; flex-direction: column; gap: .55rem; width: 100%; margin-top: .5rem; }
        .nw-actions-left { margin-top: .9rem; }
        .nw-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: .4rem;
          padding: .82rem 1.2rem; border-radius: var(--r-pill, 999px);
          font-size: 1.02rem; font-weight: 650; cursor: pointer;
          border: 1px solid transparent; transition: transform .12s ease, box-shadow .18s ease, background .15s ease;
        }
        .nw-btn:active { transform: translateY(1px); }
        .nw-btn:disabled { opacity: .55; cursor: default; transform: none; }
        .nw-primary {
          background: var(--accent, #e0794e); color: #fff;
          box-shadow: 0 10px 24px -10px rgba(217, 107, 67, .8);
        }
        .nw-primary:hover:not(:disabled) { background: var(--accent-600, #d0693e); }
        .nw-quiet { background: transparent; color: var(--n-600); border-color: var(--line); }
        .nw-quiet:hover { background: var(--n-100); color: var(--ink); }

        .nw-timerow {
          border: 1px solid var(--line); border-radius: var(--r-md, 16px);
          padding: .85rem .9rem; background: var(--accent-50, #fbf3ee);
        }
        .nw-timerow + .nw-timerow { margin-top: .7rem; }
        .nw-timerow-head { display: flex; align-items: center; justify-content: space-between; gap: .6rem; }
        .nw-timerow-label { display: inline-flex; align-items: center; gap: .45rem; font-weight: 650; font-size: 1.02rem; }
        .nw-hours {
          display: flex; gap: .4rem; margin-top: .7rem;
          overflow-x: auto; padding-bottom: .25rem;
          scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
        }
        .nw-hours.off { opacity: .4; }
        .nw-hours::-webkit-scrollbar { height: 5px; }
        .nw-hours::-webkit-scrollbar-thumb { background: var(--accent-300, #efc0a6); border-radius: 999px; }
        .nw-chip {
          flex: none; scroll-snap-align: center;
          padding: .5rem .8rem; border-radius: var(--r-pill, 999px);
          border: 1px solid var(--line); background: var(--paper, #fff);
          color: var(--n-700, var(--ink)); font-size: .95rem; font-weight: 600; cursor: pointer; white-space: nowrap;
          transition: background .12s ease, color .12s ease, border-color .12s ease;
        }
        .nw-chip:hover { border-color: var(--accent-300, #efc0a6); }
        .nw-chip.sel { background: var(--accent, #e0794e); color: #fff; border-color: var(--accent, #e0794e); }

        .nw-switch {
          width: 46px; height: 27px; flex: none; border-radius: 999px; cursor: pointer;
          border: none; background: var(--n-200, #dcd3c9); position: relative; transition: background .18s ease;
        }
        .nw-switch > span {
          position: absolute; top: 3px; left: 3px; width: 21px; height: 21px; border-radius: 50%;
          background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, .25); transition: transform .18s ease;
        }
        .nw-switch.on { background: var(--accent, #e0794e); }
        .nw-switch.on > span { transform: translateX(19px); }

        @keyframes nwFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes nwPop { from { opacity: 0; transform: translateY(14px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .nw-scrim, .nw-card { animation: nwFade .16s ease both !important; }
          .nw-card { transform: none !important; }
        }
      `}</style>
    </div>
  );
}
