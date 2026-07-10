// For you - books, actions, and practices Aria picked for THIS person, from
// their profile and their moment. Never generic listicles.
import { Card, Button, useToast, SectionHeader, EmptyState, Badge } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { celebrate } from '../lib/celebrate.js';
import { useStore, markRecDone, domainMeta } from '../lib/store.js';

const KIND_META = {
  book: { label: 'Read', icon: 'book', tone: 'info' },
  action: { label: 'Do', icon: 'target', tone: 'accent' },
  practice: { label: 'Practice', icon: 'leaf', tone: 'sage' },
};

export default function ForYou() {
  const recs = useStore(s => s.recs);
  const toast = useToast();

  const open = recs.filter(r => !r.done);
  const doneList = recs.filter(r => r.done);

  const finish = (r) => {
    const res = markRecDone(r.id);
    if (res.error) return toast(res.message, 'warn');
    celebrate({ count: 70 });
    toast('Done. It all adds up.');
  };

  const askAria = () => {
    window.dispatchEvent(new CustomEvent('kindred:aria', {
      detail: { prompt: 'Give me one new recommendation for where I am right now - a book, an action, or a practice. You know me.' },
    }));
  };

  return (
    <div className="col gap-3">
      <SectionHeader
        eyebrow="For you"
        title="Picked for you, not for everyone"
        sub="Aria chooses from what she knows about you. Ask her for more anytime."
        action={<Button onClick={askAria}><Icon name="sparkles" size={16} /> Ask for one</Button>}
      />

      {open.length === 0 ? (
        <EmptyState icon="sparkles" title="Nothing waiting"
          body="Ask Aria what to read, try, or practice next. She knows where you are."
          action={<Button onClick={askAria}>Ask Aria now</Button>} />
      ) : (
        <div className="col gap-2 stagger">
          {open.map(r => {
            const k = KIND_META[r.kind] || KIND_META.action;
            const m = domainMeta(r.domainId);
            return (
              <Card key={r.id} className="card-pad row gap-2" style={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <span className="row center" style={{ width: 44, height: 44, borderRadius: 13, background: m.bg, flex: 'none' }}>
                  <Icon name={k.icon} size={20} style={{ color: m.color }} />
                </span>
                <div className="col" style={{ gap: '.25rem', minWidth: 0, flex: 1 }}>
                  <div className="row gap-1 wrap" style={{ alignItems: 'center' }}>
                    <Badge tone={k.tone}>{k.label}</Badge>
                    {r.domainId && <span className="muted t-xs">{r.domainId}</span>}
                  </div>
                  <span className="fw-7" style={{ fontSize: '1.08rem' }}>{r.title}</span>
                  {r.why && <span className="muted t-sm">{r.why}</span>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => finish(r)}><Icon name="check" size={15} /> Did it</Button>
              </Card>
            );
          })}
        </div>
      )}

      {doneList.length > 0 && (
        <div className="col gap-1">
          <span className="t-sm fw-7 muted" style={{ letterSpacing: '.04em', textTransform: 'uppercase' }}>Done</span>
          {doneList.map(r => (
            <div key={r.id} className="row gap-2 panel" style={{ padding: '.7rem 1rem', opacity: .7 }}>
              <Icon name="check" size={16} style={{ color: 'var(--ok)', flexShrink: 0 }} />
              <span className="clip">{r.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
