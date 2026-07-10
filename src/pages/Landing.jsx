// The front door. One warm moment, one button. No feature grid, no pricing,
// no noise - meeting Aria IS the pitch.
import { useNavigate } from 'react-router-dom';
import { Icon } from '../components/icons.jsx';
import { loadDemo } from '../lib/store.js';

export default function Landing() {
  const nav = useNavigate();
  return (
    <div className="wiz" style={{ textAlign: 'center' }}>
      <div className="ambient" aria-hidden><span className="b1" /><span className="b2" /><span className="b3" /></div>
      <div className="wiz-inner stagger" style={{ alignItems: 'center', gap: '1.3rem' }}>
        <span className="aria-orb" style={{ width: 92, height: 92 }} aria-hidden />
        <h1 className="serif" style={{ maxWidth: 560 }}>A companion for the life only you can live.</h1>
        <p className="muted" style={{ fontSize: '1.15rem', maxWidth: 520, lineHeight: 1.6 }}>
          Kindred learns who you are in one warm conversation, then walks with you -
          your faith, your body, your people, your work, the book you keep not writing.
          Every day, it remembers. Every day, it helps.
        </p>
        <button className="btn btn-warm btn-lg" onClick={() => nav('/welcome')} style={{ marginTop: '.4rem' }}>
          Say hi to Aria <Icon name="arrowRight" size={19} />
        </button>
        <button className="link" style={{ background: 'none', border: 'none', fontSize: '.98rem' }}
          onClick={() => { loadDemo(); nav('/today'); }}>
          or peek at a demo life first
        </button>
        <p className="muted t-xs" style={{ marginTop: '1.5rem', maxWidth: 440 }}>
          Everything you share stays in your space. No forms, no homework - just a few honest questions.
        </p>
      </div>
    </div>
  );
}
