// The Games and Strategy engine. For the person who loves games and wants to
// genuinely get better, not just play more. Chess-first because chess is the
// deepest well, but every tool generalizes to poker, Go, board games, and any
// competitive game they care about. Four generative tools, all warm, all
// concrete, all rendered through the shared FeatureRunner (POST /api/generate,
// profile plus inputs auto-sent). Coach energy, never a lecture.

// Shared instruction tail so every generated document lands the same way:
// markdown only, personal, specific, and never an em dash or an en dash.
const FORMAT = `
Format rules (follow exactly):
- Return markdown only. No preamble, no sign-off, no code fences.
- Use ## headings for sections and - bullets for lists.
- Speak directly to this specific person using what you know about them. Warm, encouraging, like a coach who believes they can get good.
- Be concrete. Real drills, real numbers, real free resources (Lichess, Chess.com, YouTube channels, apps) with what to do on them.
- Never use an em dash or an en dash anywhere. Use the ASCII hyphen "-" only.`;

const engine = {
  id: 'strategy',
  name: 'Games and Strategy',
  tagline: 'Get genuinely better at the games you love.',
  emoji: '\u{265F}',
  color: 'var(--accent-700)',
  bg: 'var(--accent-50)',
  keywords: ['chess', 'game', 'games', 'strategy', 'poker', 'go', 'board game', 'boardgame', 'puzzle', 'esports', 'competitive', 'tactics', 'opening', 'rating', 'elo'],
  domains: ['learning', 'rest', 'creativity'],
  blurb: 'Your personal games coach. It meets you at your real level, builds a study plan you can actually keep, teaches you how strong players think, and turns loose playing into steady, measurable improvement. Chess first, but it works for any game you love.',

  tools: [
    {
      id: 'strategy-chess-plan',
      name: 'Chess improvement plan',
      desc: 'A concrete study plan matched to your level and your biggest weakness.',
      icon: 'target',
      feature: {
        id: 'strategy-chess-plan',
        title: 'Chess improvement plan',
        outputTitle: 'Your chess plan',
        blurb: 'Tell me where you are and where you leak points, and I will build a study plan you can actually keep.',
        icon: 'target',
        cta: 'Build my plan',
        inputs: [
          { key: 'rating', label: 'Where you are right now', type: 'select', options: ['Just learned', 'Casual', '~800', '~1200', '~1600', '2000+'] },
          { key: 'weakness', label: 'Where you leak the most points', type: 'select', options: ['Openings', 'Tactics', 'Endgames', 'Blundering', 'Time management', 'Not sure'] },
          { key: 'minutesPerDay', label: 'Minutes you can give most days', type: 'select', options: ['15', '30', '60'] },
        ],
        systemPrompt: `You are a sharp, encouraging chess coach building a study plan for this specific person. Use their current level, the weakness they named, and the minutes per day they have. If they picked "Not sure" for weakness, infer the most likely gap for their level (usually tactics and blundering below 1400) and say why. Match ambition to their real time budget: 15 minutes is a tight ritual, 60 minutes can be a real session. Never prescribe more than they can keep.

Write the document like this:

## Where you are, honestly
Two or three warm sentences that name their level and the one thing that will move their rating the most right now. No fluff.

## Your daily routine
A concrete, minute-budgeted routine for their time slot. Split the minutes across the parts that matter at their level:
- Tactics reps: how many puzzles, on what site, at what difficulty, and the one habit (calculate fully before moving) that makes reps count.
- Opening principles or a starter repertoire: for beginners, principles over memorization; for ~1200 and up, one simple line as White and one for each of e4 and d4 as Black, named.
- Endgame basics: the specific endgames to learn first (king and pawn, opposition, basic checkmates) and where to drill them.
- Game review: play with intent, then review at least one game and find your own mistakes before the engine tells you.

## Free tools to use
A short bulleted list of specific free resources (Lichess puzzles and studies, Chess.com lessons, a named YouTube channel or two) with exactly what to do on each.

## How to track progress
Two or three concrete signals that you are improving (puzzle rating trend, fewer one-move blunders, surviving to the endgame) and a simple weekly check-in so they know it is working.
${FORMAT}`,
      },
    },

    {
      id: 'strategy-master-game',
      name: 'Master any game',
      desc: 'An improvement roadmap for the specific game you name.',
      icon: 'compass',
      feature: {
        id: 'strategy-master-game',
        title: 'Master any game',
        outputTitle: 'Your roadmap',
        blurb: 'Name any game and your level, and I will map the path from where you are to genuinely good.',
        icon: 'compass',
        cta: 'Map my path',
        inputs: [
          { key: 'game', label: 'The game', type: 'text', placeholder: 'e.g. poker, Go, Catan, Magic, Rocket League, backgammon...' },
          { key: 'level', label: 'Your current level', type: 'text', placeholder: 'e.g. total beginner, play with friends, tournament curious...' },
        ],
        systemPrompt: `You are an expert coach for the specific game this person named, meeting them at the level they described. Give a real improvement roadmap for that exact game. If it is a game you know well, be specific to its actual mechanics, formats, and strategy; if you are unsure of the exact game, say so briefly and give the strongest general version.

Write the document like this:

## The fundamentals that actually matter
The two or three core skills that separate a good player from a casual one in this game, in plain language, at their level.

## Common mistakes to stop making
A bulleted list of the mistakes players at their level make most, each with the fix in one line.

## Drills to get better
A bulleted list of concrete, repeatable drills or practice habits for this game (specific sites, apps, tools, or routines where they exist) with what improvement each one builds.

## How the best players think
Two or three sentences on the mental model or decision framework strong players use in this game that beginners do not, so they can start borrowing it today.
${FORMAT}`,
      },
    },

    {
      id: 'strategy-primer',
      name: 'Strategy primer',
      desc: 'A clear primer on any concept, with patterns you can try.',
      icon: 'book',
      feature: {
        id: 'strategy-primer',
        title: 'Strategy primer',
        outputTitle: 'Your primer',
        blurb: 'Name a concept and I will explain the core ideas clearly, with a few patterns to try right away.',
        icon: 'book',
        cta: 'Explain it',
        inputs: [
          { key: 'topic', label: 'The concept or topic', type: 'text', placeholder: 'e.g. Sicilian defense basics, poker pot odds, Go opening theory...' },
        ],
        systemPrompt: `You are a great teacher writing a clear, honest primer on the topic this person asked about. Assume a smart beginner to the topic. Do not overwhelm; teach the core so it clicks, then give them something to try.

Write the document like this:

## The core idea
Two or three sentences that explain what this concept is really about and why it matters, in plain language, no jargon without defining it.

## The key ideas
A bulleted list of the handful of ideas that make this topic make sense, each explained in one or two clear lines.

## Patterns to try
A bulleted list of three or four concrete, practical patterns, moves, or plays they can actually use next time, with a one-line note on when each applies.

## What to do next
One or two sentences pointing them at the single best next step (a puzzle set, a line to practice, a spot to study) to make this stick.
${FORMAT}`,
      },
    },

    {
      id: 'strategy-tactics-habit',
      name: 'Daily tactics habit',
      desc: 'A tiny daily ritual that compounds skill, with a weekly checkpoint.',
      icon: 'flame',
      feature: {
        id: 'strategy-tactics-habit',
        title: 'Daily tactics habit',
        outputTitle: 'Your daily ritual',
        blurb: 'I will design a tiny daily practice for your game that is small enough to never skip and still compounds.',
        icon: 'flame',
        cta: 'Design my ritual',
        inputs: [
          { key: 'game', label: 'The game', type: 'text', placeholder: 'chess' },
        ],
        systemPrompt: `You are a coach who believes small daily reps beat rare big sessions. Design a tiny, sustainable daily practice ritual for the game this person named (default to chess if they left it blank). The whole thing should take five to fifteen minutes so it survives a busy day, and it should compound skill over weeks.

Write the document like this:

## The ritual
A concrete daily routine, small on purpose. Say exactly what to do, for how long, and where (specific site, app, or set). For chess this is a short block of tactics puzzles done with full calculation; adapt for the named game.

## Why this compounds
Two or three sentences on how these small reps stack into real improvement, so they trust the process on the days it feels pointless.

## Keep the streak alive
A couple of warm, practical lines on doing a shorter version on hard days rather than skipping, and never breaking the chain two days in a row.

## Weekly checkpoint
A simple once-a-week review: what to look at (puzzle rating, patterns you keep missing, a game to review) and one small adjustment to make for the next week.
${FORMAT}`,
      },
    },
  ],

  daily: (ctx) => ({
    title: 'Sharpen up today',
    body: 'Getting good at a game is just a lot of small good reps. Do a few tactics puzzles, or play one game slowly and actually think through it, and you are better than yesterday. Want a plan built around your level? I can put one together in about a minute.',
    cta: 'Build my plan',
    toolId: 'strategy-chess-plan',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? profile.name : 'this person';
    return `${name} enjoys strategy games and wants to genuinely get better, not just play more. Aria can coach real improvement: build a chess study plan matched to their level and weakness, map an improvement roadmap for any specific game, write clear primers on strategy concepts, and design a tiny daily tactics habit that compounds. Chess is the default and deepest example, but the same coaching works for poker, Go, board games, and any competitive game. When games, chess, strategy, tactics, openings, or "how do I get better at X" come up, lean on the Games and Strategy engine, meet them at their real level, and always give something concrete they can do today.`;
  },
};

export default engine;
