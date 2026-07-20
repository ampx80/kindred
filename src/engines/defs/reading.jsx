// The Reading engine. For the person whose life gets better with the right book
// in hand: it always knows what they should read next and why, it finds real
// books, it builds themed lists and honest reading plans, and it helps them read
// deeper. Five tools, one bespoke live search component, all warm and personal.
import { useState, useEffect } from 'react';
import { Icon } from '../../components/icons.jsx';
import { Card, Button, Field, Input, useToast } from '../../components/UI.jsx';
import { saveCreation, getProfile } from '../../lib/store.js';
import { celebrate } from '../../lib/celebrate.js';
import { haptic } from '../../lib/haptics.js';
import { sSuccess, sTap } from '../../lib/sound.js';

// Shared instruction tail so every generated reading document lands the same
// way: markdown only, warm, personal, and never an em dash or en dash.
const FORMAT = `
Format rules (follow exactly):
- Return markdown only. No preamble, no sign-off, no code fences.
- Use ## headings for sections and - bullets for lists.
- Speak directly to this specific person using what you know about them. Warm, encouraging, never generic.
- Real, well-known books and real authors only. Never invent a title or an author.
- Use ASCII hyphen "-" only. Never use an em dash or an en dash anywhere.`;

/* -------------------------------------------------------------------------
   Book lookup: a live, self-contained search over the Open Library API.
   Search box, cover cards, loading / empty / error states, optional save to a
   reading shelf. CORS-friendly and safe offline (it just shows an error card).
------------------------------------------------------------------------- */
const LOOKUP_CSS = `
.rdg-wrap{display:flex;flex-direction:column;gap:1.1rem}
.rdg-form{display:flex;gap:.6rem;align-items:flex-end;flex-wrap:wrap}
.rdg-form .field{flex:1;min-width:200px;margin:0}
.rdg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.9rem}
.rdg-book{display:flex;flex-direction:column;gap:.6rem;padding:.9rem;border-radius:var(--r-md);
  background:var(--paper);border:1px solid var(--line);transition:transform .15s,box-shadow .15s,border-color .15s}
.rdg-book:hover{transform:translateY(-2px);box-shadow:0 10px 26px rgba(60,40,30,.1);border-color:var(--accent-300)}
.rdg-cover{width:100%;aspect-ratio:2/3;border-radius:10px;object-fit:cover;background:var(--gold-bg);display:block}
.rdg-cover-ph{width:100%;aspect-ratio:2/3;border-radius:10px;background:var(--gold-bg);color:var(--gold);
  display:grid;place-items:center;text-align:center;padding:.6rem}
.rdg-meta{display:flex;flex-direction:column;gap:.15rem;min-width:0}
.rdg-title{font-weight:700;line-height:1.25;font-size:.98rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rdg-skel{width:100%;aspect-ratio:2/3;border-radius:10px;
  background:linear-gradient(90deg,var(--n-100) 0%,var(--gold-bg) 50%,var(--n-100) 100%);
  background-size:220% 100%;animation:rdgShine 1.25s linear infinite}
@keyframes rdgShine{to{background-position:-220% 0}}
@media (prefers-reduced-motion: reduce){.rdg-skel{animation:none}}
`;

function coverUrl(book) {
  return book && book.cover_i ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg` : null;
}

function BookLookup({ engine }) {
  const toast = useToast();
  const profile = (() => { try { return getProfile(); } catch { return null; } })();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [books, setBooks] = useState([]);
  const [saved, setSaved] = useState({});

  const search = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const query = q.trim();
    if (!query) return;
    haptic('light'); sTap();
    setStatus('loading'); setBooks([]);
    try {
      const r = await fetch(`https://openlibrary.org/search.json?limit=12&q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error('bad response');
      const data = await r.json();
      const docs = Array.isArray(data.docs) ? data.docs : [];
      setBooks(docs);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  };

  const shelve = (book) => {
    const title = book.title || 'Untitled';
    const author = (book.author_name && book.author_name[0]) || 'Unknown author';
    const key = book.key || `${title}-${author}`;
    const res = saveCreation({ featureId: 'reading-shelf', title, markdown: `# ${title}\nby ${author}` });
    if (res && res.error) { toast(res.message || 'Could not save that one.', 'warn'); return; }
    setSaved(s => ({ ...s, [key]: true }));
    haptic('success'); sSuccess();
    celebrate({ count: 40, y: window.innerHeight * 0.35 });
    toast(`"${title}" saved to your shelf.`, 'ok');
  };

  return (
    <div className="rdg-wrap">
      <style>{LOOKUP_CSS}</style>

      <Card pad={20}>
        <div className="col gap-2">
          <div className="col" style={{ gap: '.2rem' }}>
            <span className="eyebrow">Book lookup</span>
            <p className="muted" style={{ margin: 0 }}>
              Search millions of real books by title, author, or subject{profile && profile.name ? `, ${profile.name}` : ''}. Save any of them to your shelf.
            </p>
          </div>
          <form className="rdg-form" onSubmit={search}>
            <Field label="Search books">
              <Input
                placeholder="e.g. Steinbeck, stoicism, atomic habits..."
                value={q}
                onChange={e => setQ(e.target.value)}
                aria-label="Search books"
              />
            </Field>
            <Button variant="primary" type="submit" disabled={status === 'loading' || !q.trim()}>
              <Icon name="book" size={16} /> Search
            </Button>
          </form>
        </div>
      </Card>

      {status === 'loading' && (
        <div className="rdg-grid" role="status" aria-live="polite" aria-label="Searching books">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rdg-book"><div className="rdg-skel" aria-hidden /></div>
          ))}
        </div>
      )}

      {status === 'error' && (
        <Card style={{ textAlign: 'center', padding: '2.2rem 1.4rem' }}>
          <span className="row center floaty" style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--rose-bg)', color: 'var(--rose)', margin: '0 auto .9rem' }}>
            <Icon name="x" size={24} />
          </span>
          <h3 style={{ marginBottom: '.4rem' }}>Could not reach the library</h3>
          <p className="muted" style={{ maxWidth: 380, margin: '0 auto 1.1rem' }}>
            The book search needs a connection. Check that you are online and try again.
          </p>
          <Button variant="warm" onClick={() => search()}><Icon name="refresh" size={16} /> Try again</Button>
        </Card>
      )}

      {status === 'done' && books.length === 0 && (
        <Card style={{ textAlign: 'center', padding: '2.2rem 1.4rem' }}>
          <span className="row center floaty" style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--gold-bg)', color: 'var(--gold)', margin: '0 auto .9rem' }}>
            <Icon name="book" size={24} />
          </span>
          <h3 style={{ marginBottom: '.4rem' }}>No books matched that</h3>
          <p className="muted" style={{ maxWidth: 380, margin: '0 auto' }}>
            Try a different spelling, an author's name, or a broader subject like "grief" or "space".
          </p>
        </Card>
      )}

      {status === 'done' && books.length > 0 && (
        <div className="rdg-grid">
          {books.map((b, i) => {
            const url = coverUrl(b);
            const author = (b.author_name && b.author_name[0]) || 'Unknown author';
            const key = b.key || `${b.title}-${i}`;
            const isSaved = !!saved[key];
            return (
              <div key={key} className="rdg-book">
                {url ? (
                  <img className="rdg-cover" src={url} alt={`Cover of ${b.title || 'this book'}`} loading="lazy"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                ) : (
                  <div className="rdg-cover-ph" aria-hidden>
                    <span className="t-xs fw-6" style={{ lineHeight: 1.3 }}>{b.title || 'No cover'}</span>
                  </div>
                )}
                <div className="rdg-meta">
                  <span className="rdg-title" title={b.title}>{b.title || 'Untitled'}</span>
                  <span className="muted t-sm clip" title={author}>{author}</span>
                  {b.first_publish_year && <span className="muted t-xs">{b.first_publish_year}</span>}
                </div>
                <Button size="sm" variant={isSaved ? 'ghost' : 'warm'} disabled={isSaved}
                  onClick={() => shelve(b)} style={isSaved ? { color: 'var(--sage)' } : undefined}>
                  {isSaved ? <><Icon name="check" size={15} /> On your shelf</> : <><Icon name="heart" size={15} /> Save to shelf</>}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {status === 'idle' && (
        <Card style={{ textAlign: 'center', padding: '2.4rem 1.4rem' }}>
          <span className="row center floaty" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--gold-bg)', color: 'var(--gold)', margin: '0 auto 1rem' }}>
            <Icon name="sparkles" size={26} />
          </span>
          <h3 style={{ marginBottom: '.45rem' }}>Find your next book</h3>
          <p className="muted" style={{ maxWidth: 400, margin: '0 auto' }}>
            Search a title, an author you love, or a subject that is pulling at you. Real books, real covers, saved with one tap.
          </p>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */

const engine = {
  id: 'reading',
  name: 'Reading',
  tagline: 'Always know exactly what to read next, and why.',
  emoji: '\u{1F4DA}',
  color: 'var(--gold)',
  bg: 'var(--gold-bg)',
  keywords: ['read', 'reading', 'book', 'books', 'novel', 'literature', 'author', 'library', 'fiction', 'nonfiction', 'memoir', 'reader'],
  domains: ['learning', 'purpose'],
  blurb: 'Your personal reading concierge. It learns your taste, points you at the exact right next book, finds real titles in seconds, builds themed lists and honest reading plans, and helps you read deeper.',

  tools: [
    {
      id: 'reading-next',
      name: 'What to read next',
      desc: 'A ranked shortlist picked for your taste, with the one to start tonight.',
      icon: 'sparkles',
      feature: {
        id: 'reading-next',
        title: 'What to read next',
        outputTitle: 'Your next reads',
        blurb: 'Tell me what you have loved and how you want to feel, and I will hand you a shortlist made for you.',
        icon: 'sparkles',
        cta: 'Find my next reads',
        inputs: [
          { key: 'liked', label: 'Books or authors you have loved', type: 'textarea', placeholder: 'e.g. East of Eden, anything by Le Guin, Educated...' },
          { key: 'mood', label: 'What do you want from a book right now', type: 'select', options: ['Escape', 'Learn something', 'Be moved', 'Think harder', 'Laugh', 'Comfort'] },
          { key: 'genre', label: 'Genres you are open to (pick any)', type: 'chips', options: ['Literary fiction', 'Sci-fi', 'Fantasy', 'Mystery', 'Nonfiction', 'Memoir', 'History', 'Philosophy', 'Business', 'Poetry', 'Romance'] },
        ],
        systemPrompt: `You are a warm, sharp reading concierge who has clearly listened to this person. Recommend a ranked shortlist of about 6 real books tailored to what they loved, the mood they want, and the genres they are open to.

Write the document like this:

## Your shortlist
A numbered list, best fit first. For each book give, on its own lines:
- The title in bold and the author.
- "Why you specifically:" one honest line that connects the book to what they told me (a book or author they loved, their mood, their life).
- "What to expect:" one line on the feel, pace, and payoff.

## Start here tonight
Name the single best first pick from the list and say, in two or three sentences, why it is the right one to open first.

## The order I would read them
A short suggested reading order across the shortlist with a one-line reason for the sequence.
${FORMAT}`,
      },
    },

    {
      id: 'reading-lookup',
      name: 'Book lookup',
      desc: 'Search millions of real books, see covers, save any to your shelf.',
      icon: 'book',
      Component: BookLookup,
    },

    {
      id: 'reading-list',
      name: 'Build a reading list',
      desc: 'A curated, ordered list around any theme you care about.',
      icon: 'compass',
      feature: {
        id: 'reading-list',
        title: 'Build a reading list',
        outputTitle: 'Your reading list',
        blurb: 'Name a theme and I will build you a curated, ordered list of real books that actually earn their place.',
        icon: 'compass',
        cta: 'Build my list',
        inputs: [
          { key: 'theme', label: 'The theme or question', type: 'text', placeholder: 'e.g. stoicism, startups, grief, the American West...' },
          { key: 'length', label: 'How many books', type: 'select', options: ['5', '8', '12'] },
        ],
        systemPrompt: `You are a well-read curator building a themed reading list for this specific person around the theme they gave. Use the number of books they asked for (default to 8 if unclear). Real, well-chosen books only.

Write the document like this:

## <the theme>, in <N> books
A one or two sentence intro that frames the arc of the list for them.

## The list
A numbered list in the exact order you want them read. For each:
- The title in bold and the author.
- "Why it belongs:" one line on what this book adds that the others do not.

## How to read it
Two or three sentences on the best order and pace to move through the list, and where to slow down.
${FORMAT}`,
      },
    },

    {
      id: 'reading-plan',
      name: 'Reading plan',
      desc: 'A realistic schedule with checkpoints that fits your real life.',
      icon: 'target',
      feature: {
        id: 'reading-plan',
        title: 'Reading plan',
        outputTitle: 'Your reading plan',
        blurb: 'Tell me your goal and I will build a schedule you can actually keep, with checkpoints.',
        icon: 'target',
        cta: 'Build my plan',
        inputs: [
          { key: 'goal', label: 'Your reading goal', type: 'select', options: ['Finish one book', 'Read N books this month', 'Build a daily habit'] },
          { key: 'detail', label: 'The details', type: 'text', placeholder: 'e.g. the book title, how many books, minutes a day you have...' },
        ],
        systemPrompt: `You are a patient reading coach building a realistic, encouraging plan for this specific person based on their goal and details. Assume a normal busy life and design something they can actually keep, not an aggressive fantasy.

Write the document like this:

## The plan
State the goal plainly, then give a concrete schedule: pages per day or chapters per week, and roughly how long each session takes. Use real numbers.

## Checkpoints
A bulleted timeline of milestones (for example "by end of week 1", "halfway", "final stretch") so they can feel progress and know if they are on track.

## When you fall behind
Two or three warm, practical lines on how to recover without guilt if a day or week slips. Make it clear the habit survives a missed day.
${FORMAT}`,
      },
    },

    {
      id: 'reading-deeper',
      name: 'Go deeper',
      desc: 'Discussion questions, themes to notice, and things to look up.',
      icon: 'quote',
      feature: {
        id: 'reading-deeper',
        title: 'Go deeper',
        outputTitle: 'Read this one deeper',
        blurb: 'Name a book and I will give you the questions, themes, and threads that make it hit harder.',
        icon: 'quote',
        cta: 'Go deeper',
        inputs: [
          { key: 'book', label: 'The book (title and author if you have it)', type: 'text', placeholder: 'e.g. The Brothers Karamazov by Dostoevsky' },
        ],
        systemPrompt: `You are a brilliant, generous reading companion helping this person read one specific book more deeply. Use the book they named. If you genuinely do not know the book, say so briefly and give the same guidance in a general form.

Write the document like this:

## Questions to sit with
A numbered list of thoughtful discussion questions that open the book up, written to make them think, not to test them.

## Themes to notice
A bulleted list of the central themes and motifs, each with a one-line note on what to watch for as they read.

## Things to look up while you read
A bulleted list of specific people, places, ideas, or context worth a quick search to make the reading richer.
${FORMAT}`,
      },
    },
  ],

  daily: (ctx) => ({
    title: 'A few pages tonight',
    body: 'Reading is one of the quietest, most reliable ways to feel like yourself. Give yourself even ten pages tonight. Not sure what to open? I can hand you the exact right next book in about a minute.',
    cta: 'What to read next',
    toolId: 'reading-next',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? profile.name : 'this person';
    return `${name} is a reader. Aria can recommend books tuned to their taste and mood, find real titles, build themed reading lists, design realistic reading plans with checkpoints, and help them read deeper. When books, learning, or "what should I read" come up, lean on the Reading engine and its tools, and always say why a given book fits them specifically.`;
  },
};

export default engine;
