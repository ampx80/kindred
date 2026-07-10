// The crisis resources card. Rendered inline in the Aria dock whenever a
// message carries a crisis flag, and reachable any time from the dock's
// "real help" affordance. Warm, calm, unmissable - real tap-to-call links.
import { CRISIS_RESOURCES } from '../lib/safety.js';
import { Icon } from './icons.jsx';

export default function CrisisCard({ resources = CRISIS_RESOURCES, compact = false }) {
  return (
    <div className="crisis-card">
      {!compact && resources.intro && <p className="crisis-card__intro">{resources.intro}</p>}
      <div className="crisis-card__lines">
        {resources.lines.map((l) => {
          const external = l.action.startsWith('http');
          return (
            <a key={l.label} href={l.action} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} className="crisis-line">
              <span className="crisis-line__ic"><Icon name="heart" size={16} /></span>
              <span className="col" style={{ minWidth: 0, gap: '.1rem' }}>
                <span className="crisis-line__label">{l.label}</span>
                <span className="crisis-line__detail">{l.detail}</span>
              </span>
            </a>
          );
        })}
      </div>
      {!compact && resources.outro && <p className="crisis-card__outro">{resources.outro}</p>}
      <style>{`
        .crisis-card { border: 1.5px solid var(--rose); background: var(--rose-bg); border-radius: 14px; padding: 12px 13px; margin-top: 9px; }
        .crisis-card__intro { font-size: 14px; line-height: 1.5; color: var(--ink); margin: 0 0 10px; }
        .crisis-card__lines { display: flex; flex-direction: column; gap: 7px; }
        .crisis-line { display: flex; gap: 9px; align-items: center; padding: 9px 10px; background: var(--paper); border: 1px solid var(--line); border-radius: 10px; transition: border-color .14s, transform .14s; }
        .crisis-line:hover { border-color: var(--rose); transform: translateX(2px); }
        .crisis-line__ic { width: 30px; height: 30px; border-radius: 8px; background: var(--rose-bg); color: var(--rose); display: grid; place-items: center; flex: none; }
        .crisis-line__label { font-size: 14px; font-weight: 700; color: var(--ink); }
        .crisis-line__detail { font-size: 12.5px; color: var(--n-600); }
        .crisis-card__outro { font-size: 13.5px; line-height: 1.5; color: var(--ink-2); margin: 10px 0 0; }
      `}</style>
    </div>
  );
}
