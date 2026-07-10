// Kindred component library. Every screen composes these primitives so the
// whole app moves together when a token changes.
import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from './icons.jsx';

/* ---------- Buttons ---------- */
export function Button({ variant = 'primary', size, as: As = 'button', className = '', children, ...rest }) {
  const cls = ['btn', `btn-${variant}`, size ? `btn-${size}` : '', className].filter(Boolean).join(' ');
  return <As className={cls} {...rest}>{children}</As>;
}

/* ---------- Cards ---------- */
export function Card({ pad = true, hover = false, className = '', style, children, ...rest }) {
  const cls = ['card', pad ? 'card-pad' : '', hover ? 'card-hover' : '', className].filter(Boolean).join(' ');
  return <div className={cls} style={style} {...rest}>{children}</div>;
}

/* ---------- Section header ---------- */
export function SectionHeader({ eyebrow, title, sub, action }) {
  return (
    <div className="section-head">
      <div className="col" style={{ gap: '.3rem', minWidth: 0 }}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2 style={{ margin: 0 }}>{title}</h2>
        {sub && <span className="muted" style={{ fontSize: '1rem' }}>{sub}</span>}
      </div>
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */
export function Badge({ tone, className = '', children, ...rest }) {
  const cls = ['badge', tone ? `badge-${tone}` : '', className].filter(Boolean).join(' ');
  return <span className={cls} {...rest}>{children}</span>;
}

/* ---------- Stat tile ---------- */
export function Stat({ value, label, sub, icon, tint = 'var(--accent)' }) {
  return (
    <Card className="card-hover">
      <div className="row between" style={{ alignItems: 'flex-start', gap: '.8rem' }}>
        <div className="col" style={{ gap: '.45rem', minWidth: 0 }}>
          <span className="stat-label">{label}</span>
          <span className="stat-value">{value}</span>
          {sub && <span className="muted t-sm">{sub}</span>}
        </div>
        {icon && (
          <span className="row center" style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--accent-50)', color: tint, flex: 'none' }}>
            <Icon name={icon} size={22} />
          </span>
        )}
      </div>
    </Card>
  );
}

/* ---------- Fields ---------- */
export function Field({ label, hint, children }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <span className="muted t-xs">{hint}</span>}
    </div>
  );
}
export function Input(props) { return <input className="input" {...props} />; }
export function Select({ children, ...props }) { return <select className="select" {...props}>{children}</select>; }
export function Textarea(props) { return <textarea className="textarea" rows={props.rows || 3} {...props} />; }

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, footer, width = 620, children }) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', h);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = ''; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(46,36,30,.42)', backdropFilter: 'blur(3px)' }} onClick={onClose}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: width, maxHeight: '88dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={e => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="row between" style={{ padding: '1.15rem 1.4rem .9rem', borderBottom: '1px solid var(--line)', flex: 'none' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button className="btn btn-quiet" onClick={onClose} aria-label="Close" style={{ padding: '.4rem' }}><Icon name="x" size={20} /></button>
        </div>
        <div style={{ padding: '1.2rem 1.4rem', overflowY: 'auto' }}>{children}</div>
        {footer && <div className="row gap-1" style={{ padding: '1rem 1.4rem', borderTop: '1px solid var(--line)', justifyContent: 'flex-end', flex: 'none' }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon = 'sparkles', title, body, action }) {
  return (
    <Card style={{ textAlign: 'center', padding: '2.6rem 1.5rem' }}>
      <span className="row center floaty" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--accent-50)', color: 'var(--accent-600)', margin: '0 auto 1rem' }}>
        <Icon name={icon} size={26} />
      </span>
      <h3 style={{ marginBottom: '.45rem' }}>{title}</h3>
      {body && <p className="muted" style={{ maxWidth: 420, margin: '0 auto 1.2rem' }}>{body}</p>}
      {action}
    </Card>
  );
}

/* ---------- Ring (streak / progress) ---------- */
export function Ring({ value = 0, size = 64, color = 'var(--accent)', label }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.max(0, Math.min(1, value)));
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--n-50)" strokeWidth="7" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .7s var(--ease)' }} />
      </svg>
      {label != null && (
        <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 750, fontSize: size * .28, fontVariantNumeric: 'tabular-nums' }}>{label}</span>
      )}
    </div>
  );
}

/* ---------- Toasts ---------- */
const ToastCtx = createContext(() => {});
export function ToastHost({ children }) {
  const [toasts, setToasts] = useState([]);
  const toast = useCallback((message, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(t => [...t, { id, message, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3600);
  }, []);
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      <div style={{ position: 'fixed', bottom: 'calc(1.2rem + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)', zIndex: 130, display: 'flex', flexDirection: 'column', gap: '.5rem', width: 'min(94vw, 460px)', pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} className="card fade-up" style={{ padding: '.8rem 1.05rem', display: 'flex', alignItems: 'center', gap: '.6rem', boxShadow: 'var(--shadow-md)', pointerEvents: 'auto' }}>
            <span className="dot" style={{ background: t.tone === 'risk' ? 'var(--risk)' : t.tone === 'warn' ? 'var(--warn)' : 'var(--ok)' }} />
            <span style={{ fontSize: '.98rem', fontWeight: 550 }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() { return useContext(ToastCtx); }

/* ---------- Typer: Aria's voice-first typing effect ---------- */
export function Typer({ text, speed = 26, onDone, className = '', style }) {
  const [shown, setShown] = useState('');
  const doneRef = useRef(false);
  useEffect(() => {
    doneRef.current = false;
    setShown('');
    if (!text) return;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) { setShown(text); onDone?.(); doneRef.current = true; return; }
    // Time-based, not tick-based: background-tab timer throttling only slows
    // the ticks, never the reveal rate.
    const start = performance.now();
    const id = setInterval(() => {
      const i = Math.min(text.length, Math.ceil((performance.now() - start) / speed));
      setShown(text.slice(0, i));
      if (i >= text.length) { clearInterval(id); doneRef.current = true; onDone?.(); }
    }, speed);
    return () => clearInterval(id);
  }, [text]); // eslint-disable-line
  const typing = shown.length < (text || '').length;
  return <span className={`${className}${typing ? ' type-caret' : ''}`} style={style}>{shown}</span>;
}

/* ---------- Date helpers ---------- */
export const shortDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export const longDate = (d) => new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
export const daysAgo = (d) => {
  if (!d) return null;
  const n = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  return n <= 0 ? 'today' : n === 1 ? 'yesterday' : `${n} days ago`;
};
