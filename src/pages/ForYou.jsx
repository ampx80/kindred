// For you - books, actions, and practices Aria picked for THIS person, from
// their profile and their moment. Never generic listicles. This is Aria's
// curated feed: premium cards, a warm personal header, and actions that feel
// good to tap (haptics + sound + confetti bloom from the button).
import { useEffect, useMemo, useState } from 'react';
import { Card, Button, useToast, SectionHeader, EmptyState, Badge } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { celebrate, burstFrom } from '../lib/celebrate.js';
import { MilestoneBurst } from '../components/Delight.jsx';
import { sTap, sPop, sSuccess } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { track } from '../lib/track.js';
import { useStore, markRecDone, domainMeta } from '../lib/store.js';

const KIND_META = {
  book: { label: 'Read', icon: 'book', tone: 'info', verb: 'A book for you' },
  action: { label: 'Do', icon: 'target', tone: 'accent', verb: 'One thing to try' },
  practice: { label: 'Practice', icon: 'leaf', tone: 'sage', verb: 'A practice to keep' },
};

// A warm, personal opener from Aria. Uses the first name when we have it, and
// leans on the time of day so it feels like she just sat down beside you.
function ariaGreeting(name) {
  const h = new Date().getHours();
  const part = h < 5 ? 'Late night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 22 ? 'Evening' : 'Late night';
  const who = name ? `${part}, ${name}.` : `${part}.`;
  return `${who} I set these aside with you in mind.`;
}

export default function ForYou() {
  const recs = useStore(s => s.recs);
  const profile = useStore(s => s.profile);
  const toast = useToast();

  const name = profile && profile.name ? String(profile.name).split(' ')[0] : '';

  // Dismiss is a gentle, local-only "not now" - it never mutates the store, so
  // Aria can resurface the pick later and no data flow changes. Complete uses
  // the real writer (markRecDone) so it persists like before.
  const [dismissed, setDismissed] = useState(() => new Set());
  const [accepted, setAccepted] = useState(() => new Set());
  const [caughtUpN, setCaughtUpN] = useState(0);

  useEffect(() => { track('foryou_view'); }, []);

  const open = useMemo(() => recs.filter(r => !r.done && !dismissed.has(r.id)), [recs, dismissed]);
  const doneList = useMemo(() => recs.filter(r => r.done), [recs]);

  // If an action just cleared the last open pick, celebrate the caught-up moment.
  const maybeCaughtUp = (remaining) => {
    if (remaining <= 0) setCaughtUpN(doneList.length + 1);
  };

  const accept = (r, e) => {
    if (accepted.has(r.id)) return;
    setAccepted(prev => new Set(prev).add(r.id));
    haptic('success'); sSuccess(); burstFrom(e, { count: 46, spread: 0.85 });
    track('rec_accept', { kind: r.kind });
    toast('On it. I am rooting for you.');
  };

  const finish = (r, e) => {
    const res = markRecDone(r.id);
    if (res.error) return toast(res.message, 'warn');
    haptic('success'); sSuccess(); burstFrom(e, { count: 70, spread: 0.95 });
    celebrate({ count: 40, spread: 0.7 });
    track('rec_done', { kind: r.kind });
    toast('Done. It all adds up.');
    maybeCaughtUp(open.filter(x => x.id !== r.id).length);
  };

  const dismiss = (r) => {
    haptic('light'); sTap();
    setDismissed(prev => new Set(prev).add(r.id));
    track('rec_dismiss', { kind: r.kind });
    toast('Set aside. I will find you a better fit.', 'warn');
    maybeCaughtUp(open.filter(x => x.id !== r.id).length);
  };

  const askAria = () => {
    sPop(); haptic('light');
    window.dispatchEvent(new CustomEvent('kindred:aria', {
      detail: { prompt: 'Give me one new recommendation for where I am right now - a book, an action, or a practice. You know me.' },
    }));
  };

  return (
    <div className="col gap-3 page-in fy">
      <style>{FY_CSS}</style>

      <MilestoneBurst
        show={caughtUpN}
        label="all caught up"
        sublabel="Aria will bring more when the moment is right"
        onDone={() => setCaughtUpN(0)}
      />

      {/* Aria's warm, living header */}
      <Card className="fy-hero card-pad">
        <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
          <span className="aria-orb fy-hero__orb" aria-hidden style={{ width: 48, height: 48 }} />
          <div className="col" style={{ gap: '.35rem', minWidth: 0, flex: 1 }}>
            <span className="eyebrow">For you, from Aria</span>
            <span className="serif fy-hero__line">{ariaGreeting(name)}</span>
            <span className="muted t-sm">
              {open.length > 0
                ? `${open.length} pick${open.length === 1 ? '' : 's'} chosen from what I know about you. No filler.`
                : 'You are all caught up. Ask me whenever you want something new.'}
            </span>
          </div>
        </div>
        <div className="row gap-1 fy-hero__cta">
          <Button variant="warm" onClick={askAria}>
            <Icon name="sparkles" size={16} /> Ask for one more
          </Button>
        </div>
      </Card>

      <SectionHeader
        eyebrow="Curated"
        title="Picked for you, not for everyone"
        sub="Aria chooses from what she knows about you. Tap what fits, set aside what does not."
      />

      {open.length === 0 ? (
        <EmptyState icon="sparkles" title="You are caught up"
          body="Aria will bring more when the moment is right. Ask her now if you want something to read, try, or practice next."
          action={<Button variant="warm" onClick={askAria}><Icon name="sparkles" size={16} /> Ask Aria now</Button>} />
      ) : (
        <div className="col gap-2 fy-list">
          {open.map((r, i) => {
            const k = KIND_META[r.kind] || KIND_META.action;
            const m = domainMeta(r.domainId);
            const isOn = accepted.has(r.id);
            return (
              <Card
                key={r.id}
                className={`fy-card card-pad ${isOn ? 'is-on' : ''}`}
                style={{ '--dc': m.color, '--i': i }}
              >
                <span className="fy-card__accent" aria-hidden />
                <div className="fy-card__body">
                  <div className="row gap-2" style={{ alignItems: 'flex-start' }}>
                    <span className="fy-card__icon" style={{ background: m.bg }}>
                      <Icon name={k.icon} size={20} style={{ color: m.color }} />
                    </span>
                    <div className="col" style={{ gap: '.3rem', minWidth: 0, flex: 1 }}>
                      <div className="row gap-1 wrap" style={{ alignItems: 'center' }}>
                        <Badge tone={k.tone}>{k.label}</Badge>
                        {r.domainId && (
                          <span className="fy-card__domain" style={{ color: m.color }}>
                            {m.emoji} {r.domainId}
                          </span>
                        )}
                      </div>
                      <span className="fw-7 fy-card__title">{r.title}</span>
                    </div>
                    <button
                      type="button"
                      className="fy-dismiss"
                      aria-label="Set this aside"
                      title="Not now"
                      onClick={() => dismiss(r)}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>

                  {r.why && (
                    <div className="fy-why">
                      <span className="fy-why__tag">
                        <Icon name="sparkles" size={13} /> Why Aria picked this for you
                      </span>
                      <span className="fy-why__text">{r.why}</span>
                    </div>
                  )}

                  <div className="row gap-1 wrap fy-card__actions">
                    <Button
                      size="sm"
                      variant={isOn ? 'ghost' : 'warm'}
                      onClick={(e) => accept(r, e)}
                      disabled={isOn}
                    >
                      {isOn ? <><Icon name="check" size={15} /> On it</> : <><Icon name="heart" size={15} /> I am on it</>}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={(e) => finish(r, e)}>
                      <Icon name="check" size={15} /> Did it
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {doneList.length > 0 && (
        <div className="col gap-1 fy-done">
          <span className="t-sm fw-7 muted fy-done__head">
            <Icon name="trophy" size={14} /> Done ({doneList.length})
          </span>
          {doneList.map(r => {
            const m = domainMeta(r.domainId);
            return (
              <div key={r.id} className="row gap-2 panel fy-done__row" style={{ '--dc': m.color }}>
                <Icon name="check" size={16} style={{ color: 'var(--ok)', flexShrink: 0 }} />
                <span className="clip">{r.title}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Scoped page styles. Reduced-motion aware (entrance + orb pulse disabled).
const FY_CSS = `
.fy-hero { background: linear-gradient(135deg, var(--accent-50), var(--paper) 70%); border-color: var(--accent-300); }
.fy-hero__orb { animation-duration: 5.4s; }
.fy-hero__line { font-size: 1.28rem; font-weight: 600; line-height: 1.25; color: var(--ink); }
.fy-hero__cta { margin-top: 1rem; }

.fy-card { position: relative; overflow: hidden; padding-left: 1.35rem;
  transition: transform .2s var(--ease), box-shadow .2s var(--ease), border-color .2s var(--ease);
  animation: fyIn .5s var(--ease) both; animation-delay: calc(var(--i, 0) * .07s); }
.fy-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-md), 0 16px 38px -24px var(--dc); border-color: var(--dc); }
.fy-card:active { transform: translateY(0); }
.fy-card.is-on { border-color: var(--dc); box-shadow: 0 0 0 1px var(--dc), var(--shadow-sm); }
.fy-card__accent { position: absolute; left: 0; top: 0; bottom: 0; width: 5px;
  background: var(--dc); opacity: .9; }
.fy-card__body { display: flex; flex-direction: column; gap: .7rem; }
.fy-card__icon { display: inline-flex; align-items: center; justify-content: center;
  width: 46px; height: 46px; border-radius: 14px; flex: none;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dc) 30%, transparent); }
.fy-card__title { font-size: 1.1rem; line-height: 1.3; }
.fy-card__domain { font-size: .8rem; font-weight: 650; text-transform: capitalize; opacity: .95; }

.fy-why { border-left: 2px solid color-mix(in srgb, var(--dc) 55%, transparent);
  padding: .1rem 0 .1rem .7rem; margin-left: .2rem; display: flex; flex-direction: column; gap: .2rem; }
.fy-why__tag { display: inline-flex; align-items: center; gap: .35rem;
  font-size: .72rem; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: var(--dc); }
.fy-why__text { font-size: .95rem; line-height: 1.5; color: var(--n-700); }

.fy-card__actions { margin-top: .1rem; }

.fy-dismiss { flex: none; display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; border-radius: 999px; border: 1px solid transparent;
  background: transparent; color: var(--n-400); cursor: pointer;
  transition: background .15s var(--ease), color .15s var(--ease), transform .12s var(--ease); }
.fy-dismiss:hover { background: var(--n-50); color: var(--ink-2); }
.fy-dismiss:active { transform: scale(.9); }

.fy-done__head { display: inline-flex; align-items: center; gap: .4rem;
  letter-spacing: .04em; text-transform: uppercase; }
.fy-done__row { padding: .7rem 1rem; opacity: .72; border-left: 3px solid var(--dc);
  transition: opacity .18s var(--ease); }
.fy-done__row:hover { opacity: 1; }

@keyframes fyIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .fy-card { animation: none !important; }
  .fy-card:hover { transform: none; }
  .fy-hero__orb { animation: none !important; }
}
`;
