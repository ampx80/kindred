// Rewards - the spark shop. Where the sparks earned by living (closing days,
// keeping promises, claiming quests, collecting the daily reward) turn into
// real unlocks: streak freezes, themes, a warmer Aria voice, a founder badge.
// The balance breathes and counts, buying blooms confetti, and a gentle "how to
// earn" strip keeps the loop obvious so wanting more sparks feels good, not grabby.
// Every flourish is reduced-motion aware.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { useToast } from '../components/UI.jsx';
import { useGame, buyReward, ownsReward } from '../lib/game.js';
import { REWARDS } from '../lib/gameContent.js';
import { sSuccess, sTap } from '../lib/sound.js';
import { haptic } from '../lib/haptics.js';
import { celebrate, burstFrom } from '../lib/celebrate.js';
import { track } from '../lib/track.js';

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Warm tint per reward type, drawn from the design tokens so the whole shop
// moves with the palette. chip = icon background, ink = icon color.
const TINTS = {
  freeze: { chip: 'var(--sky-bg)', ink: 'var(--sky)' },
  theme: { chip: 'var(--accent-50)', ink: 'var(--accent-600)' },
  'aria-voice': { chip: 'var(--gold-bg)', ink: 'var(--gold)' },
  badge: { chip: 'var(--sage-bg)', ink: 'var(--sage)' },
};

// A number that eases toward its target whenever the target changes, so buying
// something makes the balance visibly tick down and earning makes it climb.
// Under reduced motion it simply shows the value.
function AnimatedNumber({ value = 0 }) {
  const target = Number(value) || 0;
  const [n, setN] = useState(target);
  const raf = useRef(0);
  const from = useRef(target);
  useEffect(() => {
    if (prefersReduced()) { setN(target); return; }
    cancelAnimationFrame(raf.current);
    const start = performance.now();
    const dur = 640;
    const a = from.current;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      const cur = a + (target - a) * eased;
      setN(cur);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else { setN(target); from.current = target; }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(n).toLocaleString()}</span>;
}

const EARN_WAYS = [
  { icon: 'moon', label: 'Close your day', hint: '+5 sparks', to: '/today' },
  { icon: 'check', label: 'Keep a promise', hint: '+2 sparks', to: '/paths' },
  { icon: 'target', label: 'Claim a quest', hint: 'up to +15', to: '/quests' },
  { icon: 'sparkles', label: 'Daily reward', hint: 'every day', to: '/today' },
];

export default function Rewards() {
  const game = useGame();
  const toast = useToast();
  const [shake, setShake] = useState(false);

  useEffect(() => { track('rewards_view'); }, []);

  const sparks = game.sparks || 0;
  const freezes = game.freezes || 0;

  const bumpBalance = () => {
    setShake(true);
    setTimeout(() => setShake(false), 520);
  };

  const onBuy = (reward, e) => {
    sTap();
    const res = buyReward(reward.id);
    if (res.ok) {
      burstFrom(e);
      celebrate();
      haptic('success');
      sSuccess();
      toast(`Unlocked ${res.reward.name}`, 'ok');
      track('reward_bought', { id: reward.id, type: reward.type, cost: reward.cost });
      return;
    }
    if (res.reason === 'poor') {
      haptic('warn');
      bumpBalance();
      toast('Not quite enough sparks yet', 'ok');
    } else if (res.reason === 'owned') {
      toast('You already have this', 'ok');
    } else {
      toast('That reward is not available', 'ok');
    }
  };

  const css = `
    .rwx { max-width: 860px; margin: 0 auto; padding-bottom: 120px; }
    .rwx .rwx-rise { opacity: 0; animation: rwxRise .55s var(--ease, cubic-bezier(.2,.7,.3,1)) forwards; }
    @keyframes rwxRise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

    .rwx .rwx-hero {
      position: relative; overflow: hidden;
      border: 1px solid var(--accent-300); border-radius: var(--r-md, 16px);
      padding: 1.5rem 1.6rem;
      background:
        radial-gradient(130% 150% at 8% 0%, var(--accent-50) 0%, transparent 62%),
        var(--paper);
    }
    .rwx .rwx-hero__glow {
      position: absolute; inset: -50% -20% auto auto; width: 320px; height: 320px;
      background: radial-gradient(circle, rgba(224,121,78,.18), transparent 68%);
      pointer-events: none; animation: rwxDrift 9s ease-in-out infinite alternate;
    }
    @keyframes rwxDrift { from { transform: translate(0,0); } to { transform: translate(-26px, 18px); } }

    .rwx .rwx-hero__top { display: flex; align-items: center; gap: .85rem; position: relative; }
    .rwx .rwx-hero__eyebrow { font-size: .74rem; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--n-500); }
    .rwx .rwx-hero__title { margin: 0; font-family: var(--font-display, inherit); font-size: 1.55rem; letter-spacing: -.02em; }

    .rwx .rwx-balance {
      position: relative; display: flex; align-items: center; gap: .7rem;
      margin-top: 1.1rem;
    }
    .rwx .rwx-balance__spark {
      display: grid; place-items: center; width: 56px; height: 56px; flex: none;
      border-radius: 18px; background: var(--gold-bg); color: var(--gold);
      box-shadow: inset 0 0 0 1px rgba(221,154,46,.28);
    }
    .rwx .rwx-balance__spark svg { animation: rwxSpin 6s ease-in-out infinite; }
    @keyframes rwxSpin { 0%,100% { transform: rotate(-8deg) scale(1); } 50% { transform: rotate(8deg) scale(1.08); } }
    .rwx .rwx-balance__num {
      font-family: var(--font-display, inherit); font-weight: 700; line-height: .95;
      font-size: clamp(3rem, 9vw, 4.2rem); letter-spacing: -.03em; color: var(--ink);
    }
    .rwx .rwx-balance__unit { font-size: 1.05rem; font-weight: 650; color: var(--n-500); margin-left: .1rem; }
    .rwx .rwx-balance.is-shake { animation: rwxShake .5s cubic-bezier(.36,.07,.19,.97); }
    @keyframes rwxShake {
      10%,90% { transform: translateX(-2px); } 20%,80% { transform: translateX(4px); }
      30%,50%,70% { transform: translateX(-7px); } 40%,60% { transform: translateX(7px); }
    }
    .rwx .rwx-freezes {
      display: inline-flex; align-items: center; gap: .4rem; margin-top: .85rem;
      padding: .35rem .7rem; border-radius: 999px; width: fit-content;
      background: var(--sky-bg); color: var(--sky); font-size: .85rem; font-weight: 650;
    }

    .rwx .rwx-earn {
      display: grid; grid-template-columns: repeat(4, 1fr); gap: .6rem; margin-top: 1.5rem;
    }
    .rwx .rwx-earn__item {
      display: flex; flex-direction: column; gap: .4rem; text-decoration: none;
      padding: .8rem .75rem; border-radius: var(--r-md, 14px);
      border: 1px solid var(--line); background: var(--paper); color: var(--ink);
      transition: transform .15s var(--ease), border-color .15s var(--ease), box-shadow .15s var(--ease), background .15s var(--ease);
    }
    .rwx .rwx-earn__item:hover { transform: translateY(-2px); border-color: var(--accent-300); background: var(--accent-50); box-shadow: var(--shadow-sm); }
    .rwx .rwx-earn__item:active { transform: translateY(0) scale(.98); }
    .rwx .rwx-earn__ico { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: var(--accent-50); color: var(--accent-600); }
    .rwx .rwx-earn__label { font-size: .88rem; font-weight: 650; line-height: 1.2; }
    .rwx .rwx-earn__hint { font-size: .74rem; color: var(--n-500); font-weight: 600; }

    .rwx .rwx-sec-title { margin: 0 0 .2rem; font-family: var(--font-display, inherit); font-size: 1.2rem; letter-spacing: -.01em; }

    .rwx .rwx-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem;
    }
    .rwx .rwx-card {
      display: flex; flex-direction: column; gap: .7rem;
      padding: 1.2rem 1.15rem; border-radius: var(--r-md, 16px);
      border: 1px solid var(--line); background: var(--paper);
      transition: transform .16s var(--ease), border-color .16s var(--ease), box-shadow .16s var(--ease);
    }
    .rwx .rwx-card:hover { transform: translateY(-3px); border-color: var(--accent-300); box-shadow: var(--shadow-md); }
    .rwx .rwx-card.is-owned { background: linear-gradient(180deg, var(--sage-bg), var(--paper)); border-color: var(--sage); }
    .rwx .rwx-card__chip { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 15px; flex: none; }
    .rwx .rwx-card__name { font-weight: 700; font-size: 1.05rem; letter-spacing: -.01em; }
    .rwx .rwx-card__desc { font-size: .9rem; line-height: 1.45; color: var(--n-600); flex: 1; }
    .rwx .rwx-card__note { font-size: .72rem; color: var(--n-400); font-style: italic; }

    .rwx .rwx-card__foot { display: flex; align-items: center; justify-content: space-between; gap: .6rem; margin-top: .2rem; }
    .rwx .rwx-cost {
      display: inline-flex; align-items: center; gap: .35rem;
      padding: .4rem .7rem; border-radius: 999px; font-weight: 700; font-size: .92rem;
      background: var(--gold-bg); color: var(--gold); font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .rwx .rwx-owned-pill {
      display: inline-flex; align-items: center; gap: .35rem;
      color: var(--sage); font-weight: 700; font-size: .92rem;
    }

    @media (max-width: 620px) {
      .rwx .rwx-earn { grid-template-columns: repeat(2, 1fr); }
    }

    @media (prefers-reduced-motion: reduce) {
      .rwx .rwx-rise { opacity: 1; animation: none; transform: none; }
      .rwx .rwx-hero__glow, .rwx .rwx-balance__spark svg { animation: none; }
      .rwx .rwx-balance.is-shake { animation: none; }
      .rwx .rwx-card:hover, .rwx .rwx-earn__item:hover { transform: none; }
    }
  `;

  return (
    <div className="rwx col gap-3">
      <style>{css}</style>

      {/* Hero: Aria + balance */}
      <div className="rwx-hero rwx-rise">
        <div className="rwx-hero__glow" aria-hidden />
        <div className="rwx-hero__top">
          <span className="aria-orb" aria-hidden style={{ width: 44, height: 44 }} />
          <div className="col" style={{ gap: '.15rem', minWidth: 0 }}>
            <span className="rwx-hero__eyebrow">The spark shop</span>
            <h1 className="rwx-hero__title">Spend what you earned</h1>
          </div>
        </div>

        <div className={`rwx-balance${shake ? ' is-shake' : ''}`}>
          <span className="rwx-balance__spark" aria-hidden>
            <Icon name="sparkles" size={30} />
          </span>
          <div className="col" style={{ gap: '.1rem' }}>
            <span className="rwx-balance__num">
              <AnimatedNumber value={sparks} /><span className="rwx-balance__unit">sparks</span>
            </span>
            <span className="muted t-sm">Your balance, ready to spend</span>
          </div>
        </div>

        <div className="rwx-freezes">
          <Icon name="sparkles" size={14} />
          {freezes} streak {freezes === 1 ? 'freeze' : 'freezes'} banked
        </div>
      </div>

      {/* How to earn sparks */}
      <div className="rwx-rise" style={{ animationDelay: '.06s' }}>
        <p className="eyebrow" style={{ marginBottom: '.4rem' }}>How to earn sparks</p>
        <div className="rwx-earn">
          {EARN_WAYS.map((w) => (
            <Link key={w.label} to={w.to} className="rwx-earn__item"
              onClick={() => { sTap(); haptic('light'); }}>
              <span className="rwx-earn__ico"><Icon name={w.icon} size={17} /></span>
              <span className="rwx-earn__label">{w.label}</span>
              <span className="rwx-earn__hint">{w.hint}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* The shop */}
      <div className="col gap-2 rwx-rise" style={{ animationDelay: '.1s' }}>
        <div className="col" style={{ gap: '.15rem' }}>
          <h2 className="rwx-sec-title">Unlocks</h2>
          <span className="muted t-sm">Little upgrades that make the walk with Aria yours.</span>
        </div>

        <div className="rwx-grid">
          {REWARDS.map((r, i) => {
            const tint = TINTS[r.type] || TINTS.badge;
            const owned = !r.repeatable && ownsReward(r.id);
            const showComingSoon = r.type === 'theme' || r.type === 'aria-voice';
            return (
              <div key={r.id}
                className={`rwx-card rwx-rise${owned ? ' is-owned' : ''}`}
                style={{ animationDelay: `${Math.min(0.12 + i * 0.05, 0.4)}s` }}>
                <span className="rwx-card__chip" style={{ background: tint.chip, color: tint.ink }}>
                  <Icon name={r.icon} size={24} />
                </span>
                <div className="col" style={{ gap: '.3rem' }}>
                  <span className="rwx-card__name">{r.name}</span>
                  <span className="rwx-card__desc">{r.desc}</span>
                  {showComingSoon && <span className="rwx-card__note">Applying themes is coming soon</span>}
                </div>
                <div className="rwx-card__foot">
                  <span className="rwx-cost">
                    <Icon name="sparkles" size={14} /> {r.cost} sparks
                  </span>
                  {owned ? (
                    <button className="btn btn-ghost btn-sm" disabled aria-label={`${r.name} owned`}>
                      <span className="rwx-owned-pill"><Icon name="check" size={16} /> Owned</span>
                    </button>
                  ) : (
                    <button className="btn btn-primary btn-sm" onClick={(e) => onBuy(r, e)}>
                      Buy
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="muted t-xs" style={{ marginTop: '.4rem', marginBottom: 0 }}>
          Every spark here was earned by showing up. Keep closing your days and the good stuff keeps coming.
        </p>
      </div>
    </div>
  );
}
