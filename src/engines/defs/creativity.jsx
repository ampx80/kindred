// Creativity and Craft engine. For the people who make things: writers, artists,
// painters, photographers, musicians, and makers of every kind. Aria's job here
// is to keep the work moving, spark it on the days it feels dry, plan the bigger
// pieces, and get them unstuck when they stall. Every tool below is generative
// and runs through the shared FeatureRunner (POST /api/generate). All copy uses
// ASCII hyphens only, never em or en dashes.

const SHARED_STYLE = [
  'You are Aria, a warm, practical creative partner who talks like a trusted friend, not a coach reading from a script.',
  'Write in clean markdown only. Use ## for section headings and - for bullets. Never use tables or code blocks.',
  'Be specific and doable, never vague or precious. Speak to this person directly using what you know about them.',
  'Never use em dashes or en dashes. Use a plain ASCII hyphen or rewrite the sentence.',
  'Keep it inspiring but grounded, the kind of guidance someone can act on in the next hour.',
].join(' ');

const engine = {
  id: 'creativity',
  name: 'Creativity',
  tagline: 'Make more of the thing only you can make.',
  emoji: '\u{1F3A8}',
  color: 'var(--rose)',
  bg: 'var(--rose-bg)',
  blurb:
    'Your studio companion. Aria helps you spark ideas, plan the real project, get unstuck, shape a piece, and keep a creative streak alive, all tailored to the medium you actually work in.',
  keywords: [
    'write', 'writing', 'writer', 'art', 'artist', 'draw', 'drawing', 'paint',
    'painting', 'create', 'creative', 'story', 'poem', 'poetry', 'novel',
    'design', 'photography', 'photo', 'craft', 'maker', 'sketch',
  ],
  domains: ['creativity', 'purpose'],

  tools: [
    {
      id: 'spark',
      name: 'Creative spark',
      desc: 'One vivid, doable prompt for today, plus a warmup and a stretch.',
      icon: 'sparkles',
      feature: {
        id: 'creativity-spark',
        title: 'Creative spark',
        outputTitle: 'Your spark for today',
        blurb: 'A single prompt worth making today, sized to the time and mood you have.',
        icon: 'sparkles',
        cta: 'Give me a spark',
        inputs: [
          {
            key: 'medium',
            label: 'What are you making today?',
            type: 'select',
            options: ['Writing', 'Drawing', 'Painting', 'Photography', 'Music', 'Mixed/other'],
          },
          {
            key: 'mood',
            label: 'Mood or energy right now (optional)',
            type: 'text',
            placeholder: 'restless, tired, curious, wide open...',
          },
        ],
        systemPrompt: [
          SHARED_STYLE,
          'Give this person one vivid, specific creative prompt to make today, tailored to their chosen medium and current mood.',
          'Structure the response with these sections:',
          '## Today\'s prompt - one clear, evocative idea they can actually make, described in a few concrete sentences so they can see it.',
          '## 15-minute warmup - a low-stakes exercise to loosen up first, doable in a quarter hour with whatever is at hand.',
          '## Stretch variation - one bolder way to push the same idea further if they catch fire and want more.',
          'Match the language and tools to their medium. Make it feel like an invitation, not an assignment.',
        ].join('\n'),
      },
    },
    {
      id: 'plan',
      name: 'Project plan',
      desc: 'Break a creative project into phases, milestones, and a real schedule.',
      icon: 'compass',
      feature: {
        id: 'creativity-plan',
        title: 'Project plan',
        outputTitle: 'Your project plan',
        blurb: 'Turn a big creative idea into phases and milestones you can actually finish.',
        icon: 'compass',
        cta: 'Plan my project',
        inputs: [
          {
            key: 'project',
            label: 'What is the project?',
            type: 'textarea',
            placeholder: 'A short story collection, a gallery show, an album, a photo series...',
          },
          {
            key: 'deadline',
            label: 'Deadline or target date (optional)',
            type: 'text',
            placeholder: 'end of summer, three months, no deadline yet...',
          },
        ],
        systemPrompt: [
          SHARED_STYLE,
          'Break this creative project into a plan they can follow without losing momentum.',
          'Structure the response with these sections:',
          '## The shape of it - a one paragraph read on what this project really is and what finishing it looks like.',
          '## Phases - the major phases in order, each with a short name and what happens in it.',
          '## Milestones and schedule - concrete milestones mapped to a realistic timeline. If they gave a deadline, work backward from it. If not, suggest a sensible pace and name the first milestone with a date range.',
          '## Definition of done - a short, honest checklist that tells them when the project is truly finished, so they can stop polishing and ship.',
          'Be realistic about time and energy. Protect them from scope creep.',
        ].join('\n'),
      },
    },
    {
      id: 'unblock',
      name: 'Unblock me',
      desc: 'Name the block, get three ways through it, and one tiny start.',
      icon: 'refresh',
      feature: {
        id: 'creativity-unblock',
        title: 'Unblock me',
        outputTitle: 'A way through',
        blurb: 'Stuck? Aria names what is actually blocking you and hands you a way out.',
        icon: 'refresh',
        cta: 'Help me get unstuck',
        inputs: [
          {
            key: 'stuckOn',
            label: 'Where are you stuck?',
            type: 'textarea',
            placeholder: 'Describe what you are working on and where it stalled...',
          },
        ],
        systemPrompt: [
          SHARED_STYLE,
          'This person is creatively stuck. Help them move again with warmth and clarity, not a lecture.',
          'Structure the response with these sections:',
          '## What is likely going on - your best read on the real block underneath what they described (fear, perfectionism, unclear goal, fatigue, wrong scope, missing input, and so on). Be kind and specific.',
          '## Three ways through - exactly three tailored approaches, each a short bullet or two, matched to the block you named.',
          '## Start in the next 10 minutes - one tiny, unmissable action they can do right now to break the seal. Make it almost too small to refuse.',
          'End on their side. Remind them the work is worth making.',
        ].join('\n'),
      },
    },
    {
      id: 'shape',
      name: 'Shape this piece',
      desc: 'A structure and outline for one piece, with beats and a strong opening.',
      icon: 'quote',
      feature: {
        id: 'creativity-shape',
        title: 'Shape this piece',
        outputTitle: 'The shape of your piece',
        blurb: 'Give one piece a spine: structure, beats, and an opening that lands.',
        icon: 'quote',
        cta: 'Shape it',
        inputs: [
          {
            key: 'pieceType',
            label: 'What kind of piece is it?',
            type: 'text',
            placeholder: 'essay, short story, song, photo essay, poem...',
          },
          {
            key: 'goal',
            label: 'What do you want it to do?',
            type: 'textarea',
            placeholder: 'What is it about, and what should a person feel or take away?',
          },
        ],
        systemPrompt: [
          SHARED_STYLE,
          'Help this person give one specific piece a strong structure, tailored to the kind of piece it is and what they want it to do.',
          'Structure the response with these sections:',
          '## The spine - one or two sentences naming the core of the piece and the effect it should have.',
          '## Structure and beats - an outline that fits this form, laid out as ordered beats or sections. For a story name the turns, for a song name the sections, for an essay name the moves. Each beat gets a short line on what it carries.',
          '## A strong opening - one concrete idea for how to begin, written vividly enough that they could start from it today.',
          'Serve their goal, not a generic template. Keep it usable, not theoretical.',
        ].join('\n'),
      },
    },
    {
      id: 'challenge',
      name: '30-day creative challenge',
      desc: 'A month of small daily creative acts that build toward something.',
      icon: 'flame',
      feature: {
        id: 'creativity-challenge',
        title: '30-day creative challenge',
        outputTitle: 'Your 30-day challenge',
        blurb: 'Thirty small daily acts that gently escalate into real momentum.',
        icon: 'flame',
        cta: 'Build my 30 days',
        inputs: [
          {
            key: 'medium',
            label: 'Your medium',
            type: 'text',
            placeholder: 'writing, drawing, photography, songwriting...',
          },
        ],
        systemPrompt: [
          SHARED_STYLE,
          'Design a 30-day creative challenge in their medium, made of small daily acts that build toward something real by day 30.',
          'Structure the response with these sections:',
          '## The arc - one short paragraph on where they start, where they land, and what they will have by the end.',
          '## The 30 days - a numbered list from Day 1 to Day 30. Each day is one small, concrete creative act, doable in a short sitting. Escalate gently: the early days are tiny and forgiving, the middle days build skill and stamina, and the last days combine what they have practiced into something worth keeping.',
          '## Keeping the streak - two or three honest tips for not breaking the chain, including what to do on a day they miss.',
          'Keep each day short enough to fit a busy life. Make finishing feel inevitable, not heroic.',
        ].join('\n'),
      },
    },
  ],

  daily: (ctx) => ({
    title: 'Make one small thing today',
    body:
      'You do not need a free afternoon or the perfect idea. One small creative act today keeps the muscle warm and the work alive. Let Aria hand you a spark sized to the time you actually have.',
    cta: 'Give me a spark',
    toolId: 'spark',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? profile.name.split(' ')[0] : 'this person';
    return [
      `${name} is a maker: writing, art, photography, music, or craft is part of who they are.`,
      'Aria can spark a doable idea for today, plan the bigger project into real phases and milestones,',
      'get them unstuck when they stall, shape a single piece, and keep a 30-day creative streak going.',
      'Treat the work as important. Be practical and encouraging, and always tailor to their medium.',
    ].join(' ');
  },
};

export default engine;
