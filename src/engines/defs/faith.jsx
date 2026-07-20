// Faith and Scripture - a Life Engine for walking the day with Scripture,
// prayer, and quiet strength. Default reference content is the Bible (public
// domain World English Bible via bible-api.com), but every generative tool
// honors the person's own tradition if their profile names one, and never
// assumes or preaches. One bespoke content tool (the Scripture reader) plus
// four generative tools rendered by the shared FeatureRunner.
import { useState, useEffect, useRef } from 'react';
import { Icon } from '../../components/icons.jsx';
import { Card, Button, Field, Input, useToast } from '../../components/UI.jsx';
import { haptic } from '../../lib/haptics.js';
import { sSuccess, sTap } from '../../lib/sound.js';

// A curated pool of ~30 steady, well-loved passages. The "verse of the day"
// is chosen deterministically from the calendar date so it is the same for a
// person all day and rotates on its own each morning.
const VOTD_REFS = [
  'John 3:16', 'Psalm 23', 'Philippians 4:6-7', 'Isaiah 41:10', 'Romans 8:28',
  'Proverbs 3:5-6', 'Jeremiah 29:11', 'Matthew 11:28-30', 'Psalm 46:1-3',
  'Joshua 1:9', 'Lamentations 3:22-23', 'Psalm 121', '2 Corinthians 12:9',
  'Galatians 5:22-23', 'Psalm 91:1-2', 'Matthew 6:33-34', 'Romans 12:2',
  'Hebrews 11:1', 'Psalm 139:13-14', '1 Corinthians 13:4-7', 'Micah 6:8',
  'Ephesians 2:8-9', 'Psalm 34:17-18', 'John 14:27', 'Colossians 3:12-14',
  'Psalm 27:1', 'Isaiah 40:31', 'Zephaniah 3:17', 'James 1:5', 'Psalm 103:1-5',
];

// The quick-access chips under the search box.
const QUICK_REFS = ['Psalm 23', 'John 1', 'Romans 8', 'Proverbs 3', 'Matthew 5'];

// A day index that is stable across a single calendar day and advances by one
// each day, so the verse of the day is deterministic (no async, no randomness).
function dayIndex() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000) + now.getFullYear() * 366;
}

const READER_CSS = `
.faith-reader{display:flex;flex-direction:column;gap:1.1rem}
.faith-search{display:flex;gap:.55rem;align-items:stretch}
.faith-search .input{flex:1;min-width:0}
.faith-chips{display:flex;flex-wrap:wrap;gap:.45rem}
.faith-chip{display:inline-flex;align-items:center;gap:.3rem;font-size:.85rem;font-weight:650;
  padding:.36rem .72rem;border-radius:var(--r-pill);background:var(--sky-bg);color:var(--sky);
  border:1px solid transparent;cursor:pointer;transition:transform .12s,border-color .12s}
.faith-chip:hover{transform:translateY(-1px);border-color:var(--sky)}
.faith-votd{display:inline-flex;align-items:center;gap:.4rem;font-size:.78rem;font-weight:700;
  letter-spacing:.02em;text-transform:uppercase;color:var(--gold);background:var(--gold-bg);
  padding:.3rem .68rem;border-radius:var(--r-pill);width:fit-content}
.faith-verse-ref{margin:0;font-family:var(--font-display),serif;font-size:1.5rem;letter-spacing:-.01em}
.faith-verse-body{white-space:pre-wrap;font-size:1.12rem;line-height:1.72;color:var(--ink);
  margin:.7rem 0 0;font-family:var(--font-display),serif}
.faith-verse-note{margin:1rem 0 0;font-size:.82rem;color:var(--n-500)}
.faith-skel{height:14px;border-radius:7px;background:var(--n-100);animation:faithPulse 1.3s ease-in-out infinite}
.faith-skel.w70{width:70%}.faith-skel.w90{width:90%}.faith-skel.w80{width:80%}
@keyframes faithPulse{0%,100%{opacity:.5}50%{opacity:1}}
@media (prefers-reduced-motion: reduce){.faith-skel{animation:none}.faith-chip:hover{transform:none}}
`;

// The Scripture reader: search any reference, tap a quick chip, or land on a
// verse of the day chosen deterministically by date. Reads the public domain
// World English Bible from bible-api.com (CORS friendly, no key). Never crashes
// if the network is down - it falls back to a warm, honest offline message.
function ScriptureReader({ engine }) {
  const toast = useToast();
  const [ref, setRef] = useState('');
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | error
  const [errMsg, setErrMsg] = useState('');
  const [fromVotd, setFromVotd] = useState(false);
  const didInit = useRef(false);

  const votd = VOTD_REFS[dayIndex() % VOTD_REFS.length];

  const load = async (reference, opts = {}) => {
    const clean = String(reference || '').trim();
    if (!clean) { toast('Type a passage like John 3:16 or Psalm 23.', 'warn'); return; }
    setStatus('loading'); setErrMsg(''); setFromVotd(!!opts.votd);
    haptic('light'); sTap();
    try {
      const r = await fetch(`https://bible-api.com/${encodeURIComponent(clean)}?translation=web`);
      if (!r.ok) throw new Error('not-found');
      const json = await r.json();
      if (!json || !json.text) throw new Error('empty');
      setData(json);
      setStatus('idle');
      if (!opts.votd) { sSuccess(); haptic('success'); }
    } catch (e) {
      setData(null);
      setStatus('error');
      setErrMsg('That passage did not come back. Check the spelling (try "John 3:16" or "Psalm 23"), or you may be offline right now. Your saved verses and the rest of Kindred still work.');
    }
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    load(votd, { votd: true });
  }, []); // eslint-disable-line

  const submit = (e) => { if (e) e.preventDefault(); load(ref); };

  return (
    <div className="faith-reader">
      <style>{READER_CSS}</style>

      <Card pad={22}>
        <form className="col gap-2" onSubmit={submit} style={{ gap: '.8rem' }}>
          <Field label="Look up a passage">
            <div className="faith-search">
              <Input
                value={ref}
                onChange={e => setRef(e.target.value)}
                placeholder='e.g. "John 3:16" or "Psalm 23"'
                aria-label="Scripture reference"
              />
              <Button variant="primary" type="submit" disabled={status === 'loading'}>
                <Icon name="arrowRight" size={17} /> Go
              </Button>
            </div>
          </Field>
          <div className="faith-chips" role="group" aria-label="Quick passages">
            {QUICK_REFS.map(q => (
              <button key={q} type="button" className="faith-chip"
                onClick={() => { setRef(q); load(q); }}>
                <Icon name="book" size={13} /> {q}
              </button>
            ))}
          </div>
        </form>
      </Card>

      <Card pad={26}>
        {status === 'loading' && (
          <div className="col" style={{ gap: '.9rem' }} role="status" aria-live="polite">
            <span className="muted t-sm">Opening the passage...</span>
            <div className="faith-skel w70" />
            <div className="faith-skel w90" />
            <div className="faith-skel w80" />
            <div className="faith-skel w90" />
          </div>
        )}

        {status === 'error' && (
          <div className="col" style={{ gap: '.9rem', textAlign: 'center', padding: '1rem .5rem' }}>
            <span className="row center" style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--sky-bg)', color: 'var(--sky)', margin: '0 auto' }}>
              <Icon name="leaf" size={26} />
            </span>
            <p className="muted" style={{ margin: 0, maxWidth: 420, marginInline: 'auto' }}>{errMsg}</p>
            <div className="row center gap-2" style={{ flexWrap: 'wrap' }}>
              <Button variant="ghost" onClick={() => load(ref || votd)}><Icon name="refresh" size={16} /> Try again</Button>
              <Button variant="warm" onClick={() => { setRef(votd); load(votd, { votd: true }); }}><Icon name="sun" size={16} /> Verse of the day</Button>
            </div>
          </div>
        )}

        {status === 'idle' && data && (
          <div className="col" style={{ gap: '.2rem' }}>
            {fromVotd && (
              <span className="faith-votd"><Icon name="sun" size={13} /> Verse of the day</span>
            )}
            <h2 className="faith-verse-ref" style={{ marginTop: fromVotd ? '.7rem' : 0 }}>{data.reference}</h2>
            <p className="faith-verse-body">{(data.text || '').trim()}</p>
            <p className="faith-verse-note">{data.translation_name || 'World English Bible'} - public domain</p>
          </div>
        )}

        {status === 'idle' && !data && (
          <p className="muted" style={{ margin: 0 }}>Type a passage above, or tap one of the quick verses to begin.</p>
        )}
      </Card>
    </div>
  );
}

// A shared line dropped into every generative systemPrompt so the model always
// honors the person's tradition and never assumes or preaches.
const INCLUSIVITY = [
  'The person\'s full profile is provided, which may name a faith tradition (for example Christian, Catholic, Muslim, Jewish, spiritual, seeking, or none).',
  'If a tradition is present, write inside it warmly and accurately: draw on its own scriptures, prayers, and language. If the tradition is the Bible or unspecified, use the Bible (a public-domain-friendly translation like the World English Bible is fine to reference).',
  'If the person is seeking, secular, or has no stated tradition, stay gentle and non-religious in tone: offer meaning, reflection, and steadiness without assuming belief.',
  'Never preach, never guilt, never assume they believe more or less than they have said. Meet them exactly where they are.',
].join(' ');

const engine = {
  id: 'faith',
  name: 'Faith and Scripture',
  tagline: 'Walk the day with Scripture, prayer, and quiet strength.',
  emoji: '\u{1F54A}',
  color: 'var(--sky)',
  bg: 'var(--sky-bg)',
  blurb: 'A daily home for Scripture, prayer, and reflection - grounded in the Bible by default, and shaped to your own tradition when you have one.',
  keywords: ['faith', 'god', 'bible', 'scripture', 'prayer', 'spiritual', 'christian', 'jesus', 'christ', 'church', 'worship', 'devotion', 'gospel', 'psalm', 'grace', 'holy'],
  domains: ['faith', 'purpose'],

  tools: [
    {
      id: 'reader',
      name: 'Scripture reader',
      desc: 'Read any passage, plus a fresh verse of the day.',
      icon: 'book',
      Component: ScriptureReader,
    },
    {
      id: 'devotional',
      name: 'Daily devotional',
      desc: 'A short, warm devotional shaped to your real life.',
      icon: 'sun',
      feature: {
        id: 'faith-devotional',
        title: 'Daily devotional',
        outputTitle: 'Your devotional for today',
        blurb: 'A passage, a reflection tied to your life, one small practice, and a one-line prayer.',
        icon: 'sun',
        cta: 'Write my devotional',
        inputs: [
          { key: 'theme', label: 'A theme on your heart today (optional)', type: 'text', placeholder: 'e.g. patience, a hard conversation, gratitude' },
        ],
        systemPrompt: [
          'Create a short, warm daily devotional written personally for this person, using what you know about their real life.',
          INCLUSIVITY,
          'Structure the output in markdown only, with no preamble and no closing sign-off. Use these sections:',
          '## The passage - suggest one specific passage (give the reference) and quote or paraphrase a line or two of it.',
          '## Reflection - two or three short paragraphs that tie the passage directly to something real in this person\'s life (their goals, relationships, mood, or season). Speak to them warmly and by name if their name is known.',
          '## One practice for today - a single small, concrete thing they can actually do today.',
          '## A prayer - one honest line, in their tradition, that they could pray as-is. If they are not religious, make this a single grounding intention instead of a prayer.',
          'Keep it gentle and real, never preachy. Use plain markdown headings and bullet lists where helpful. Do not use em-dashes or en-dashes anywhere; use a plain hyphen.',
        ].join('\n\n'),
      },
    },
    {
      id: 'prayer',
      name: 'A prayer for this',
      desc: 'A heartfelt, personal prayer for whatever you are carrying.',
      icon: 'heart',
      feature: {
        id: 'faith-prayer',
        title: 'A prayer for this',
        outputTitle: 'A prayer for you',
        blurb: 'Tell Aria what is on your heart and receive a personal prayer in your own tradition.',
        icon: 'heart',
        cta: 'Write this prayer',
        inputs: [
          { key: 'situation', label: 'What is on your heart? What is this prayer for?', type: 'textarea', placeholder: 'A situation, a person, a worry, a thanksgiving...' },
          { key: 'tone', label: 'The heart of it', type: 'select', options: ['Gratitude', 'Strength', 'Peace', 'Guidance', 'Grief', 'Hope'] },
        ],
        systemPrompt: [
          'Compose a heartfelt, personal prayer for the situation this person describes, in their own tradition.',
          INCLUSIVITY,
          'Let the chosen tone (gratitude, strength, peace, guidance, grief, or hope) shape the whole prayer.',
          'Write the prayer so it could be read aloud or prayed silently as-is: sincere, unhurried, in the second person to God (or to the divine as their tradition names it). Weave in the real specifics they shared and, gently, what you know of their life.',
          'If the person is not religious, write it instead as a short, grounding meditation or set of intentions addressed to themselves - the same warmth, without invoking God.',
          'Output markdown only, with no preamble and no explanation. A short title as an ## heading, then the prayer itself. Keep it to a length that fits on one calm screen. Do not use em-dashes or en-dashes anywhere; use a plain hyphen.',
        ].join('\n\n'),
      },
    },
    {
      id: 'plan',
      name: 'Reading plan',
      desc: 'A day-by-day Scripture reading plan built for you.',
      icon: 'compass',
      feature: {
        id: 'faith-plan',
        title: 'Reading plan',
        outputTitle: 'Your Scripture reading plan',
        blurb: 'Pick a focus and a length, and Aria builds a day-by-day plan with a reason for each day.',
        icon: 'compass',
        cta: 'Build my reading plan',
        inputs: [
          { key: 'focus', label: 'What do you want to read through?', type: 'select', options: ['The Gospels', 'Psalms and wisdom', 'The whole story', 'A theme I choose'] },
          { key: 'theme', label: 'If a theme, which one? (optional)', type: 'text', placeholder: 'e.g. courage, forgiveness, patience, new beginnings' },
          { key: 'days', label: 'How many days?', type: 'select', options: ['7', '14', '30'] },
        ],
        systemPrompt: [
          'Build a day-by-day Scripture reading plan for this person for the exact number of days they chose.',
          INCLUSIVITY,
          'Honor the focus they picked. If they chose a theme, center every day on that theme. If their tradition is not Bible-based, build the plan from that tradition\'s own core texts instead.',
          'Each day gets: the day number, a specific reading (give the reference and keep the daily portion realistic and not overwhelming), and one short line of "why this today" that connects the reading to the arc of the plan or to their life.',
          'Open with a one or two sentence intro naming the focus and how to use the plan, then a clear day-by-day list. Use markdown only: an ## intro heading, then a bold day label per day with the reading and the why beneath. No preamble beyond the intro, no sign-off. Do not use em-dashes or en-dashes anywhere; use a plain hyphen.',
        ].join('\n\n'),
      },
    },
    {
      id: 'feeling',
      name: 'Scripture for what I feel',
      desc: 'Passages that meet you where you are right now.',
      icon: 'leaf',
      feature: {
        id: 'faith-feeling',
        title: 'Scripture for what I feel',
        outputTitle: 'Scripture for how you feel',
        blurb: 'Name the feeling and Aria gathers passages that meet it, each with a gentle line of reflection.',
        icon: 'leaf',
        cta: 'Find these for me',
        inputs: [
          { key: 'feeling', label: 'What are you feeling right now?', type: 'text', placeholder: 'e.g. anxious, grateful, worn out, hopeful, lonely' },
        ],
        systemPrompt: [
          'Offer three to five passages that genuinely meet the feeling this person names.',
          INCLUSIVITY,
          'For each passage give: the reference as a small heading or bold label, a short direct quote or a faithful paraphrase of the key line, and one gentle sentence of reflection that speaks to their feeling and, where natural, to their real life.',
          'Lead with a single warm sentence acknowledging the feeling before the passages. If their tradition is not Bible-based, draw the passages from that tradition\'s own scriptures instead. If they are not religious, offer a few short, steadying reflections or wisdom lines rather than scripture.',
          'Output markdown only, no preamble beyond the one opening line and no sign-off. Do not use em-dashes or en-dashes anywhere; use a plain hyphen.',
        ].join('\n\n'),
      },
    },
  ],

  Home: undefined,

  daily: (ctx) => ({
    title: 'A verse is waiting for you',
    body: 'Take a quiet minute before the day fills up. Open today\'s verse in the reader, or let Aria write you a short devotional shaped around your life right now.',
    cta: 'Open the reader',
    toolId: 'reader',
  }),

  ariaContext: (profile) => 'This person values faith and spiritual life. You may gently offer Scripture, prayer, and devotion when it fits, always in their own tradition, never assuming or preaching, and never forcing it.',
};

export default engine;
