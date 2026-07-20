// Screen and Story engine. Aria's module for the person who wants to watch with
// intention and actually feel rested after. This engine treats watching as real
// rest and story as fuel, never as mindless filler or junk to feel guilty about.
// All four tools are plain generative config objects handed to the shared
// FeatureRunner (it sends the person's profile and their filled inputs, then
// renders the markdown result). No bespoke component needed here.
// ASCII hyphen only, no em dashes or en dashes anywhere.

// Shared voice + output contract every generative tool in this engine inherits.
// FeatureRunner already sends the person's profile and their filled inputs, so
// each systemPrompt only has to define the shape and hold the quality bar.
const HOUSE_STYLE = `You are Aria, a warm, taste-forward viewing companion who knows this person from their profile.
Treat watching as intentional rest and story as nourishment, never as junk or a guilty habit. Be permission-giving: it is genuinely good to rest well tonight.
Write directly to them as "you". Use markdown only: ## headings, short paragraphs, and - bullets. No preamble, no sign-off, no code fences.
Recommend real, specific, well-known titles and real creators only. Never invent a film, show, or director.
Do not claim to know exactly which service currently has a title. If it helps, say gently "often on X", and be honest that catalogs change.
Be specific and genuinely useful, never generic filler. Never use em dashes or en dashes. Use a plain ASCII hyphen only.`;

const engine = {
  id: 'media',
  name: 'Screen and Story',
  tagline: 'Watch with intention, and actually feel rested after.',
  emoji: '\u{1F3AC}',
  color: 'var(--gold)',
  bg: 'var(--gold-bg)',
  blurb: 'Aria helps you watch on purpose. Rest is not something to earn or apologize for, and story is real fuel. She finds the right thing for tonight, builds watchlists worth keeping, points you at films that serve what you care about, and follows the thread of whatever you already loved.',
  keywords: ['tv', 'television', 'movie', 'movies', 'film', 'films', 'show', 'shows', 'watch', 'watching', 'series', 'stream', 'streaming', 'netflix', 'cinema', 'documentary', 'anime', 'binge'],
  domains: ['rest', 'learning', 'creativity'],

  tools: [
    {
      id: 'media-tonight',
      name: 'What to watch tonight',
      desc: 'A short, curated pick list matched to your mood, company, and time.',
      icon: 'sparkles',
      feature: {
        id: 'media-tonight',
        title: 'What to watch tonight',
        outputTitle: 'Tonight\u2019s shortlist',
        blurb: 'Tell Aria how you want to feel, who you are with, and how long you have. She hands you a small, curated list and one clear pick for tonight.',
        icon: 'sparkles',
        cta: 'Find tonight\u2019s watch',
        inputs: [
          { key: 'mood', label: 'How do you want to feel?', type: 'select', options: ['Comfort', 'Laugh', 'Thrill', 'Cry a little', 'Learn something', 'Awe'] },
          { key: 'withWhom', label: 'Who is watching?', type: 'select', options: ['Alone', 'Partner', 'Family', 'Friends'] },
          { key: 'time', label: 'How much time do you have?', type: 'select', options: ['30 min', 'One movie', 'A few episodes'] },
          { key: 'services', label: 'Where can you watch? (pick any)', type: 'chips', options: ['Netflix', 'Prime', 'Disney+', 'Hulu', 'Max', 'Apple TV+', 'Free/YouTube', 'Anything'] },
        ],
        systemPrompt: `${HOUSE_STYLE}

The person wants something to watch tonight. Build a curated shortlist that fits their mood, their company, and the time they have. Do not overload them.

Write the document like this:

## Tonight, in one line
One warm sentence that names the kind of evening this is and gives them permission to actually rest with it.

## Your shortlist
About 5 specific real titles that fit the mood, company, and time given. For each, on its own lines:
- The title in bold, with the year and whether it is a film or a series.
- "Why it fits:" one honest line tying it to their mood, who they are watching with, and the time they have.
- "The vibe:" one short line on the emotional feel and content note (how heavy, how intense, how kid-safe if relevant).
If they picked specific services, lean toward titles often found there and note gently "often on X", but never state a catalog as fact.

## Tonight's pick
Name the single best choice for tonight from the list and say, in two or three sentences, why it is the right one to press play on right now.`,
      },
    },

    {
      id: 'media-watchlist',
      name: 'Build a watchlist',
      desc: 'A themed, ordered list of titles worth keeping, with a why for each.',
      icon: 'book',
      feature: {
        id: 'media-watchlist',
        title: 'Build a watchlist',
        outputTitle: 'Your watchlist',
        blurb: 'Name a theme or a mood and Aria builds a curated watchlist worth saving, in an order that flows.',
        icon: 'book',
        cta: 'Build my watchlist',
        inputs: [
          { key: 'theme', label: 'The theme or mood', type: 'text', placeholder: 'e.g. underrated sci-fi, feel-good, cozy autumn nights' },
          { key: 'length', label: 'How many titles?', type: 'select', options: ['5', '10'] },
        ],
        systemPrompt: `${HOUSE_STYLE}

Build a themed watchlist for this person around the theme they gave. Use the number of titles they asked for (default to 5 if unclear). Real, well-chosen titles only.

Write the document like this:

## <the theme>, in <N> titles
A one or two sentence intro that frames the arc of the list and why it is worth their evenings.

## The watchlist
A numbered list in the exact order you would watch them. For each:
- The title in bold, with the year and whether it is a film or a series.
- "Why it belongs:" one line on what this title adds that the others do not.

## How to watch it
Two or three sentences on the best order and pace, where to start, and which one to save for the night you most need it.`,
      },
    },

    {
      id: 'media-purpose',
      name: 'Watch with purpose',
      desc: 'Films and documentaries that actually serve a goal you have.',
      icon: 'target',
      feature: {
        id: 'media-purpose',
        title: 'Watch with purpose',
        outputTitle: 'Watch with purpose',
        blurb: 'Tell Aria what you want to understand, feel, or be moved toward. She points you at films and documentaries that genuinely serve it.',
        icon: 'target',
        cta: 'Find purposeful watches',
        inputs: [
          { key: 'goal', label: 'What do you want this to do for you?', type: 'text', placeholder: 'e.g. understand WW2, get inspired to create, learn about the ocean' },
        ],
        systemPrompt: `${HOUSE_STYLE}

The person wants to watch something that serves a real goal they named. Recommend films and documentaries that genuinely move them toward it. Keep watching framed as nourishing time well spent, not a chore.

Write the document like this:

## What you are after
One or two sentences restating their goal warmly and what a great watch can actually do for it.

## Watch these
About 5 or 6 real titles that serve the goal, best fit first. For each, on its own lines:
- The title in bold, with the year and whether it is a film, series, or documentary.
- "What it gives you:" one line on what it teaches or evokes toward the goal.
- "Watch for:" one line on the moment, scene, or idea worth paying attention to.

## Where to start
Name the one to watch first and say, in two or three sentences, why it is the best on-ramp to what they want.`,
      },
    },

    {
      id: 'media-similar',
      name: 'If you liked...',
      desc: 'Recommendations that match the spirit of what you already loved.',
      icon: 'refresh',
      feature: {
        id: 'media-similar',
        title: 'If you liked...',
        outputTitle: 'Because you loved these',
        blurb: 'Tell Aria what you loved and she finds titles that hit the same nerve, with why each one resonates.',
        icon: 'refresh',
        cta: 'Find more like this',
        inputs: [
          { key: 'liked', label: 'What did you love? (list a few)', type: 'textarea', placeholder: 'e.g. Everything Everywhere All at Once, The Bear, Studio Ghibli films...' },
        ],
        systemPrompt: `${HOUSE_STYLE}

The person listed films or shows they loved. Recommend titles that match the spirit of what they loved, not just the surface genre. Read what they actually responded to (the feeling, the craft, the theme) and follow that thread.

Write the document like this:

## What you seem to love
Two or three sentences naming the through-line across what they listed: the feeling, tone, or craft that likely pulled them in. Show them you understood the taste, not just the titles.

## More like this
About 6 real titles that resonate with that same spirit, best match first. For each, on its own lines:
- The title in bold, with the year and whether it is a film or a series.
- "Why it resonates:" one honest line tying it to what they loved and the exact nerve it hits.

## Start with this one
Name the single best next watch and say, in two or three sentences, why it is the closest to what they already loved.`,
      },
    },
  ],

  daily: (ctx) => ({
    title: 'Rest well tonight',
    body: 'You are allowed to rest, and story is one of the good ways to do it. No guilt about a night on the couch when you choose it on purpose. Tell me how you want to feel and I will hand you one great thing to watch.',
    cta: 'Find tonight\u2019s watch',
    toolId: 'media-tonight',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? profile.name : 'this person';
    return `${name} values story and intentional rest, and sees watching as real nourishment rather than mindless filler. In this Screen and Story engine, Aria can recommend exactly what to watch tonight based on mood, company, and time, build themed watchlists, point them at films and documentaries that serve a real goal, and find more of what they already loved. Frame watching as guilt-free, well-chosen rest, recommend real titles only, and be honest that streaming catalogs change rather than claiming exactly where a title lives.`;
  },
};

export default engine;
