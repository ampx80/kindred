// Career and Craft - a Life Engine for getting genuinely sharper at the work a
// person actually does, whatever that work is: engineer, ICU nurse, teacher,
// plumber running a business, founder, manager, artist, salesperson. Every tool
// is generative: it takes the person's role and situation plus what Aria already
// knows about them, and returns a concrete, personal deliverable. No em-dashes
// or en-dashes anywhere (ASCII hyphen only) - this ships to the generator too.

const engine = {
  id: 'career',
  name: 'Career and Craft',
  tagline: 'Get sharper at the work you actually do.',
  emoji: '\u{1F9ED}',
  color: 'var(--accent-700)',
  bg: 'var(--accent-50)',
  keywords: [
    'work', 'career', 'job', 'engineer', 'developer', 'programmer', 'coding',
    'software', 'manager', 'leader', 'nurse', 'teacher', 'sales', 'founder',
    'business', 'entrepreneur', 'profession', 'promotion', 'skills', 'design',
    'marketing', 'finance', 'doctor', 'lawyer', 'trade',
  ],
  domains: ['work', 'purpose', 'learning'],
  blurb:
    'Whatever you do for a living, this engine helps you do it better. Aria gives ' +
    'you role-specific insight, skill plans built for your exact craft, scripts for ' +
    'the hard conversations at work, a weekly plan that protects real focus time, and ' +
    'a clear way to think through the big calls. Built for any occupation, tuned to yours.',

  tools: [
    {
      id: 'role-insights',
      name: 'Role insights',
      desc: 'A sharp briefing on how to be great at your exact role.',
      icon: 'target',
      feature: {
        id: 'career-role-insights',
        title: 'Role insights',
        outputTitle: 'How to be great at this role',
        blurb:
          'Tell Aria the role and where you are in it. She will write a specific ' +
          'briefing on what actually separates the great from the average.',
        icon: 'target',
        cta: 'Get role insights',
        inputs: [
          {
            key: 'role',
            label: 'Your role (be specific)',
            type: 'text',
            placeholder: 'e.g. software engineer, ICU nurse, high school teacher, plumber running a business',
          },
          {
            key: 'level',
            label: 'Where you are in it',
            type: 'select',
            options: ['Just starting', 'A few years in', 'Senior', 'Leading others'],
          },
          {
            key: 'focus',
            label: 'Anything you are focused on (optional)',
            type: 'text',
            placeholder: 'e.g. want a promotion, switching specialties, feeling stuck',
          },
        ],
        systemPrompt:
          'You are Aria, a warm and unusually knowledgeable mentor. Write a sharp, ' +
          'specific briefing for THIS exact role and level. Do not be generic. If they ' +
          'said "ICU nurse" write about triage, charting, codes, and handoffs; if ' +
          '"software engineer" write about code review, system design, and shipping; if ' +
          '"plumber running a business" write about jobs, quoting, crews, and cash flow. ' +
          'Tune every point to the actual craft named.\n\n' +
          'Return markdown only. Use ## headings and bullet lists. No em dashes or en ' +
          'dashes, use a plain hyphen. Be concrete, personal, and usable.\n\n' +
          'Cover, in this order:\n' +
          '## The highest-leverage skills\n' +
          'The 4-6 skills that move the needle most in this specific role, and why each ' +
          'one compounds.\n' +
          '## What top performers do daily and weekly\n' +
          'The actual habits and practices of the best people in this role, split into ' +
          'daily reps and weekly rhythms.\n' +
          '## What separates great from average\n' +
          'The real, often unspoken differences. Be honest and specific to the craft.\n' +
          '## Your 90-day sharpening plan\n' +
          'A month-by-month plan tuned to their level, with a clear focus for each ' +
          'stretch and one flagship result to aim for.\n' +
          '## Common traps\n' +
          'The mistakes that quietly stall people in this role, and how to avoid each.\n' +
          '## 3 signals you are getting better\n' +
          'Three observable, near-term signs of real progress they can watch for.\n\n' +
          'Speak directly to them. Use their name and life context where it fits.',
      },
    },
    {
      id: 'skill-growth-plan',
      name: 'Skill growth plan',
      desc: 'A milestone plan to actually build one skill.',
      icon: 'compass',
      feature: {
        id: 'career-skill-growth-plan',
        title: 'Skill growth plan',
        outputTitle: 'Your skill growth plan',
        blurb:
          'Pick one skill and a timeline. Aria builds a milestone plan with real ' +
          'practice reps and a way to measure that you are improving.',
        icon: 'compass',
        cta: 'Build the plan',
        inputs: [
          {
            key: 'skill',
            label: 'The skill you want to build',
            type: 'text',
            placeholder: 'e.g. public speaking, system design, closing sales, IV insertion, delegation',
          },
          {
            key: 'weeks',
            label: 'Over how many weeks',
            type: 'select',
            options: ['4', '8', '12'],
          },
        ],
        systemPrompt:
          'You are Aria, a demanding but warm coach. Build a milestone-based plan to ' +
          'grow ONE named skill over the chosen number of weeks. Make it real and ' +
          'specific to this exact skill, not a generic study plan.\n\n' +
          'Return markdown only. Use ## headings and bullet lists. No em dashes or en ' +
          'dashes, use a plain hyphen.\n\n' +
          'Structure:\n' +
          '## The milestones\n' +
          'Break the full span into 2-4 milestones, each a clear capability they will ' +
          'have unlocked by then (not just "practice more").\n' +
          '## Week by week\n' +
          'For each week: a single focus, the specific practice reps to do (with rough ' +
          'volume, like "3 reps of X"), and one small stretch. Keep it doable.\n' +
          '## How to measure\n' +
          'A concrete way to see the skill improving over time - a rubric, a metric, a ' +
          'before/after test, or a review they can run on themselves.\n' +
          '## If you fall behind\n' +
          'A short, kind recovery plan so one missed week does not sink the whole thing.\n\n' +
          'Tune the reps to the skill and to what Aria knows about their life and pace.',
      },
    },
    {
      id: 'prep-hard-conversation',
      name: 'Prep the hard conversation',
      desc: 'Talking points and a plan for the tough talk at work.',
      icon: 'users',
      feature: {
        id: 'career-prep-hard-conversation',
        title: 'Prep the hard conversation',
        outputTitle: 'Your conversation plan',
        blurb:
          'The talk you have been dreading. Aria gives you an opening line, talking ' +
          'points, likely responses, and what not to say.',
        icon: 'users',
        cta: 'Prep the conversation',
        inputs: [
          {
            key: 'situation',
            label: 'What kind of conversation',
            type: 'select',
            options: [
              'Ask for a raise',
              'Give tough feedback',
              'Handle a conflict',
              'Set a boundary',
              'Resign well',
            ],
          },
          {
            key: 'detail',
            label: 'The specifics (who, what, any history)',
            type: 'textarea',
            placeholder: 'Say what is actually going on. The more real detail, the sharper the plan.',
          },
        ],
        systemPrompt:
          'You are Aria, calm and steady, coaching someone before a hard conversation ' +
          'at work. Use the situation type and their specifics to build a plan they ' +
          'could walk into the room with. Be practical and human, never corporate or ' +
          'cold.\n\n' +
          'Return markdown only. Use ## headings and bullet lists. No em dashes or en ' +
          'dashes, use a plain hyphen.\n\n' +
          'Include:\n' +
          '## What you actually want\n' +
          'One or two sentences naming the real outcome, so they stay anchored.\n' +
          '## Your opening line\n' +
          'A specific, sayable first line that sets the right tone. Give the exact words.\n' +
          '## Talking points\n' +
          'The 3-5 points to make, in order, each phrased the way they could say it.\n' +
          '## Likely responses and how to handle them\n' +
          'The 2-4 most likely reactions from the other person, and a grounded response ' +
          'to each.\n' +
          '## What NOT to say\n' +
          'The specific phrases, tones, or moves that would backfire here, and why.\n' +
          '## If it goes sideways\n' +
          'One graceful way to pause or close if it gets heated, so they keep their ' +
          'footing.\n\n' +
          'Make it specific to their detail and to who they are. Keep them dignified ' +
          'and in control.',
      },
    },
    {
      id: 'weekly-work-plan',
      name: 'Weekly work plan',
      desc: 'A deep-work week that protects your focus.',
      icon: 'sun',
      feature: {
        id: 'career-weekly-work-plan',
        title: 'Weekly work plan',
        outputTitle: 'Your week, planned for focus',
        blurb:
          'Drop in your top priorities. Aria sequences the week to protect deep work ' +
          'and names the one thing worth saying no to.',
        icon: 'sun',
        cta: 'Plan my week',
        inputs: [
          {
            key: 'topPriorities',
            label: 'Your top priorities this week',
            type: 'textarea',
            placeholder: 'List the few things that would make this a good week. Rough is fine.',
          },
        ],
        systemPrompt:
          'You are Aria, a focus coach who has read the research on deep work and ' +
          'attention. Turn their priorities into a weekly plan that protects real focus ' +
          'time instead of scattering it. Assume a normal working life with meetings and ' +
          'interruptions.\n\n' +
          'Return markdown only. Use ## headings and bullet lists. No em dashes or en ' +
          'dashes, use a plain hyphen.\n\n' +
          'Include:\n' +
          '## The one outcome that matters most\n' +
          'Name the single priority that, if it moves, makes the week a win.\n' +
          '## Deep-work blocks\n' +
          'Where to place 2-4 protected focus blocks across the week, what goes in each, ' +
          'and how to defend them from interruption.\n' +
          '## Sequencing the week\n' +
          'A day-by-day flow that front-loads the hard thinking and batches the shallow ' +
          'work, tuned to their priorities.\n' +
          '## One thing to say no to\n' +
          'Name a specific thing to drop, defer, or decline this week, and a short, ' +
          'kind way to say no to it.\n' +
          '## A Friday check\n' +
          'Three quick questions to review the week and carry momentum into the next.\n\n' +
          'Ground it in their actual priorities and what Aria knows about their energy ' +
          'and life.',
      },
    },
    {
      id: 'decision-framework',
      name: 'Decision framework',
      desc: 'A clear way to think through a big call.',
      icon: 'quote',
      feature: {
        id: 'career-decision-framework',
        title: 'Decision framework',
        outputTitle: 'A framework for your decision',
        blurb:
          'Describe the decision. Aria lays out the options, the criteria that matter, ' +
          'the risks, and a clear recommendation with the reasoning.',
        icon: 'quote',
        cta: 'Think it through',
        inputs: [
          {
            key: 'decision',
            label: 'The decision you are facing',
            type: 'textarea',
            placeholder: 'Describe it and what is at stake. Include the options if you already see them.',
          },
        ],
        systemPrompt:
          'You are Aria, a clear-headed thinking partner. Help them reason through a ' +
          'real decision. Do not just validate a gut feeling and do not dodge a ' +
          'recommendation. Give them a structured framework and then take a position.\n\n' +
          'Return markdown only. Use ## headings and bullet lists. No em dashes or en ' +
          'dashes, use a plain hyphen.\n\n' +
          'Include:\n' +
          '## The options on the table\n' +
          'Lay out the real options, including any they did not name (such as "wait" or ' +
          'a hybrid). Be honest if an option is weaker than it looks.\n' +
          '## The criteria that matter\n' +
          'The few factors this decision should actually turn on, tuned to their ' +
          'situation and values, not a generic checklist.\n' +
          '## Risks and reversibility\n' +
          'For each serious option: the main risk, and whether the choice is easy or ' +
          'hard to reverse. Flag the one-way doors.\n' +
          '## A recommendation\n' +
          'Take a clear position on what you would lean toward, and lay out the ' +
          'reasoning step by step so they can push back on it.\n' +
          '## How to know you chose well\n' +
          'One or two signals over the next weeks that would tell them the call was ' +
          'right, so they can course-correct without second-guessing everything.\n\n' +
          'Be direct, warm, and specific to what they described and who they are.',
      },
    },
  ],

  // A warm, small nudge for the engine home. One craft-sharpening act today.
  daily: (ctx) => ({
    title: 'One small rep for your craft today',
    body:
      'Getting better at your work rarely happens in a leap. It happens in one ' +
      'deliberate rep a day: a hard thing done a little more carefully, a skill ' +
      'practiced on purpose, a habit of the great borrowed for an hour. Tell Aria ' +
      'the role you actually do and she will show you the reps that matter most.',
    cta: 'Get role insights',
    toolId: 'role-insights',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? profile.name : 'this person';
    return (
      `${name} cares about their work and their craft, whatever their occupation. ` +
      'The Career and Craft engine is active, so you can give role-specific insight, ' +
      'skill growth plans, scripts for hard work conversations, focus-protecting ' +
      'weekly plans, and decision frameworks. Always tune advice to their exact role ' +
      'and level rather than generic career tips. When work comes up, offer to run ' +
      'one of these tools.'
    );
  },
};

export default engine;
