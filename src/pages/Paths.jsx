// Paths - their life organized into the domains THEY revealed, each with its
// goals, streaks, and a way to add more. Only their domains, never a generic
// checklist.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Badge, Button, Modal, Field, Input, Select, useToast, SectionHeader } from '../components/UI.jsx';
import { Icon } from '../components/icons.jsx';
import { celebrate } from '../lib/celebrate.js';
import { useStore, domainMeta, goalsForDomain, markGoalDone, addGoal, isGoalDueToday, DOMAIN_META } from '../lib/store.js';

export default function Paths() {
  const profile = useStore(s => s.profile);
  useStore(s => s.goals);
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ title: '', domainId: '', why: '', cadence: 'daily' });

  const domains = profile?.domains || [];

  const done = (g) => {
    const r = markGoalDone(g.id);
    if (r.error) return toast(r.message, 'warn');
    if (r.milestone) { celebrate({ count: 140 }); toast(`${r.milestone} in a row on "${g.title}". Milestone.`); }
    else { celebrate({ count: 55, y: window.innerHeight * .5 }); toast('Counted.'); }
  };

  const submit = () => {
    const r = addGoal(form);
    if (r.error) return toast(r.message, 'warn');
    celebrate({ count: 70 });
    toast(`New goal on the board: ${r.goal.title}`);
    setAddOpen(false);
    setForm({ title: '', domainId: '', why: '', cadence: 'daily' });
  };

  return (
    <div className="col gap-3">
      <SectionHeader
        eyebrow="Your paths"
        title="The life you said you wanted"
        sub="These came from your own words. Add to them, walk them daily."
        action={<Button onClick={() => { setForm(f => ({ ...f, domainId: domains[0]?.id || 'purpose' })); setAddOpen(true); }}><Icon name="plus" size={17} /> New goal</Button>}
      />

      <div className="col gap-3 stagger">
        {domains.map((d) => {
          const m = domainMeta(d.id);
          const goals = goalsForDomain(d.id).filter(g => g.status === 'active');
          return (
            <Card key={d.id} className="card-pad">
              <Link to={`/paths/${d.id}`} className="row gap-2" style={{ alignItems: 'flex-start', marginBottom: goals.length ? '1rem' : 0 }}>
                <span className="row center" style={{ width: 46, height: 46, borderRadius: 14, background: m.bg, fontSize: '1.35rem', flex: 'none' }}>{m.emoji}</span>
                <div className="col" style={{ gap: '.15rem', minWidth: 0, flex: 1 }}>
                  <span className="fw-7" style={{ fontSize: '1.14rem' }}>{d.name}</span>
                  <span className="muted t-sm">{d.why}</span>
                </div>
                <Icon name="chevronRight" size={20} style={{ color: 'var(--n-400)', flexShrink: 0, marginTop: 12 }} />
              </Link>
              {goals.length > 0 && (
                <div className="col gap-1">
                  {goals.map(g => (
                    <div key={g.id} className="row gap-2 panel" style={{ padding: '.75rem .95rem' }}>
                      <div className="col" style={{ gap: '.1rem', minWidth: 0, flex: 1 }}>
                        <span className="fw-6 clip">{g.title}</span>
                        <span className="row gap-1 wrap" style={{ alignItems: 'center' }}>
                          {g.streak > 0 && <span className="badge badge-accent"><Icon name="flame" size={13} /> {g.streak} in a row</span>}
                          <span className="muted t-xs">{g.cadence}</span>
                        </span>
                      </div>
                      {isGoalDueToday(g) ? (
                        <Button size="sm" onClick={() => done(g)}><Icon name="check" size={15} /> Done</Button>
                      ) : (
                        <Badge tone="ok"><Icon name="check" size={13} /> counted</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="A new goal"
        footer={<>
          <Button variant="ghost" onClick={() => setAddOpen(false)}>Not now</Button>
          <Button onClick={submit} disabled={!form.title.trim() || !form.domainId}>Add it</Button>
        </>}>
        <div className="col gap-2">
          <Field label="The goal" hint="Small enough to do this week. Small keeps promises.">
            <Input autoFocus placeholder="Walk 20 minutes before work" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field label="Which path is it part of?">
            <Select value={form.domainId} onChange={e => setForm(f => ({ ...f, domainId: e.target.value }))}>
              {domains.map(d => <option key={d.id} value={d.id}>{domainMeta(d.id).emoji} {d.name}</option>)}
              {Object.keys(DOMAIN_META).filter(k => !domains.some(d => d.id === k)).map(k => (
                <option key={k} value={k}>{DOMAIN_META[k].emoji} {k}</option>
              ))}
            </Select>
          </Field>
          <Field label="How often?">
            <Select value={form.cadence} onChange={e => setForm(f => ({ ...f, cadence: e.target.value }))}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </Select>
          </Field>
          <Field label="Why it matters (optional)">
            <Input placeholder="So I feel like myself again" value={form.why} onChange={e => setForm(f => ({ ...f, why: e.target.value }))} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
