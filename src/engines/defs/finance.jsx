// The Money and Freedom engine. Aria helps a person build a calmer, more
// practical relationship with money: a budget that fits their real life, a debt
// plan that has an end, one keystone habit, clear-headed big-purchase decisions,
// and plain-language answers to the money words that feel intimidating.
//
// Everything here is general financial education, never personalized advice.
// Every generative prompt says so out loud, points people to a professional for
// big or complex decisions, and never names specific securities.
//
// This engine is pure config (generative tools via the shared FeatureRunner), so
// it needs no component imports; the FeatureRunner wires profile + inputs and
// posts to /api/generate on its own.

// The shared education-not-advice guardrail. Appended to every generative
// systemPrompt so the boundary is stated warmly in every single output.
const EDU_GUARDRAIL = `
Open with one short, warm line making clear this is general money education from a caring friend, not personalized financial advice, and that for big or complex decisions it is worth talking with a professional who knows their full picture. Never recommend specific stocks, funds, tickers, crypto, or other securities; speak only in general categories and plain principles. Keep the tone calm, practical, and reassuring, never shaming about money.`;

// Shared formatting contract so outputs read like Aria and match the app voice.
const FORMAT = `
Write in warm, plain markdown addressed directly to the person as "you". Use ## headings for sections and short bullet lists where it helps. Be personal and specific to what you know about them. Use markdown only. Never use an em dash or en dash anywhere; use a plain hyphen or rewrite the sentence.`;

const feature = (id, cfg) => ({ id: `finance-${id}`, icon: 'sparkles', cta: 'Build it with Aria', ...cfg });

const engine = {
  id: 'finance',
  name: 'Money and Freedom',
  tagline: 'Calm, practical money moves toward real freedom.',
  emoji: '\u{1F4B0}',
  color: 'var(--gold)',
  bg: 'var(--gold-bg)',
  blurb: 'A steady, judgment-free place to get your money working for the life you want. Aria helps you build a budget, make a real plan for debt, grow one keystone habit, think clearly about big purchases, and finally understand the money words that used to feel out of reach. General education, always in your corner, never advice.',
  keywords: ['money', 'budget', 'debt', 'save', 'saving', 'savings', 'invest', 'investing', 'finance', 'financial', 'spending', 'income', 'retirement', 'frugal', 'wealth', 'expenses', 'fire'],
  domains: ['work', 'purpose'],

  tools: [
    {
      id: 'finance-budget',
      name: 'Budget builder',
      desc: 'A monthly budget shaped to your real income, costs, and goal.',
      icon: 'target',
      feature: feature('budget', {
        title: 'Budget builder',
        outputTitle: 'Your monthly budget',
        blurb: 'A clear, doable budget tuned to your actual money and what you are working toward.',
        icon: 'target',
        cta: 'Build my budget',
        inputs: [
          { key: 'monthlyIncome', label: 'Your monthly take-home income', type: 'text', placeholder: 'e.g. 4,200 after tax' },
          { key: 'fixedCosts', label: 'Your fixed monthly costs', type: 'textarea', placeholder: 'Rent 1500, car 320, insurance 140, phone 60, subscriptions 45...' },
          { key: 'goal', label: 'What matters most right now', type: 'select', options: ['Build an emergency fund', 'Pay off debt', 'Save for something', 'Just get control'] },
        ],
        systemPrompt: `You are Aria, helping this person build a monthly budget they can actually live with.${FORMAT}

Give them:
- A clear monthly budget broken into named categories (needs, wants, saving or debt, and any category their situation calls for) with target percentages tuned to their real income, fixed costs, and stated goal. Adjust the split for reality; do not force a generic 50/30/20 if their numbers or goal call for something else.
- The rough dollar amount each category works out to based on the income they gave, so it feels concrete.
- One specific first action they can take this week to put the budget in motion.
- One small habit that will keep the budget alive without willpower.
Anchor everything to the goal they chose and reassure them that a budget is permission to spend, not punishment.${EDU_GUARDRAIL}`,
      }),
    },
    {
      id: 'finance-debt',
      name: 'Debt payoff plan',
      desc: 'Snowball vs avalanche, a recommendation, and a month-by-month sketch.',
      icon: 'flame',
      feature: feature('debt', {
        title: 'Debt payoff plan',
        outputTitle: 'Your debt payoff plan',
        blurb: 'A real plan with an end date, plus the motivation checkpoints to get there.',
        icon: 'flame',
        cta: 'Make my payoff plan',
        inputs: [
          { key: 'debts', label: 'Your debts (balance and rate for each)', type: 'textarea', placeholder: 'Visa 3,200 at 24%, car loan 8,500 at 6%, student loan 12,000 at 5%...' },
          { key: 'extraPerMonth', label: 'Extra you can put toward debt each month', type: 'text', placeholder: 'e.g. 300' },
        ],
        systemPrompt: `You are Aria, helping this person make a clear, encouraging plan to get out of debt.${FORMAT}

Using the debts and the extra amount they can pay each month:
- Briefly explain the snowball method (smallest balance first) and the avalanche method (highest rate first) in one line each.
- Compare the two for their specific debts and recommend one, with plain reasoning about why it fits them (the math of avalanche vs the momentum and morale of snowball).
- Give a month-by-month sketch of the order and rough timeline debts get cleared following your recommendation, so they can see the finish line.
- Add two or three motivation checkpoints (moments to celebrate, like the first debt gone or crossing the halfway mark).
Keep it hopeful and concrete; a plan with an end date is the whole point.${EDU_GUARDRAIL}`,
      }),
    },
    {
      id: 'finance-habit',
      name: 'Build a money habit',
      desc: 'One keystone habit, a weekly practice, and how to automate it.',
      icon: 'refresh',
      feature: feature('habit', {
        title: 'Build a money habit',
        outputTitle: 'Your keystone money habit',
        blurb: 'The one small habit that quietly changes everything, made easy to keep.',
        icon: 'refresh',
        cta: 'Design my habit',
        inputs: [
          { key: 'situation', label: 'Where you are with money right now', type: 'textarea', placeholder: 'Money feels chaotic, I never check my balance, I want to save but it disappears...' },
        ],
        systemPrompt: `You are Aria, helping this person build one keystone money habit that fits their real life.${FORMAT}

From what they describe:
- Name the single keystone habit that would do the most good for them right now, and say why it is the one that matters.
- Give a concrete weekly practice: exactly what to do, when, and how long it takes (keep it small enough that it survives a bad week).
- Show how to automate it or make it nearly effortless (automatic transfers, calendar nudges, a fixed money date, app alerts), so it does not depend on motivation.
End with one warm line of encouragement that the habit, not a windfall, is what builds freedom over time.${EDU_GUARDRAIL}`,
      }),
    },
    {
      id: 'finance-purchase',
      name: 'Big purchase decision',
      desc: 'A calm framework for spending well: true cost, timing, a wait-test.',
      icon: 'quote',
      feature: feature('purchase', {
        title: 'Big purchase decision',
        outputTitle: 'Thinking through this purchase',
        blurb: 'A clear-headed way to decide, without guilt and without regret.',
        icon: 'quote',
        cta: 'Think it through',
        inputs: [
          { key: 'purchase', label: 'What you are thinking about buying', type: 'textarea', placeholder: 'A 1,800 dollar laptop, a used car, a big trip, a couch...' },
        ],
        systemPrompt: `You are Aria, helping this person decide on a big purchase with a clear head and no guilt.${FORMAT}

Walk them through a decision framework for what they described:
- True cost: the real all-in number beyond the sticker (fees, upkeep, financing, opportunity cost, what it takes off other goals).
- Alternatives: cheaper, used, borrowed, or "do nothing" options worth weighing.
- Timing: whether now is the right moment given their budget and goals, or whether waiting serves them better.
- A wait-test: a simple pause (for example a set number of days) with a question to ask themselves at the end of it.
- A recommendation: your honest, gentle take on whether and how to move forward, framed as their call to make.
Make it feel supportive, like a friend helping them spend on what they truly value.${EDU_GUARDRAIL}`,
      }),
    },
    {
      id: 'finance-explain',
      name: 'Explain this money concept',
      desc: 'Any money word in plain language, with a simple example.',
      icon: 'book',
      feature: feature('explain', {
        title: 'Explain this money concept',
        outputTitle: 'Explained, plainly',
        blurb: 'The money words that used to feel intimidating, made clear and human.',
        icon: 'book',
        cta: 'Explain it to me',
        inputs: [
          { key: 'concept', label: 'The money concept you want explained', type: 'text', placeholder: 'e.g. index funds, APR, Roth IRA, compound interest' },
        ],
        systemPrompt: `You are Aria, explaining a money concept in warm, plain language to someone who wants to feel confident, not talked down to.${FORMAT}

For the concept they named:
- Explain what it is in plain words, no jargon (and if you must use a term, define it in the same breath).
- Give one simple, relatable example with small round numbers so the idea clicks.
- Say why it matters to them specifically, given what you know about their life and goals.
Keep it short, clear, and reassuring; the goal is a small "oh, that is all it is" moment.${EDU_GUARDRAIL}`,
      }),
    },
  ],

  daily: (ctx) => ({
    title: 'One small money-calm act',
    body: 'Money gets lighter when you look at it on purpose, in small doses. Take five quiet minutes to build a budget that fits your real life, or just to notice one thing your money is doing well right now. Freedom is built in these small, unglamorous moments.',
    cta: 'Build my budget',
    toolId: 'finance-budget',
  }),

  ariaContext: (profile) => {
    const name = (profile && profile.name) ? profile.name : 'this person';
    return `${name} wants a calmer, more confident relationship with money and is working toward real financial freedom. Aria can help with building a budget, making a plan to pay off debt, growing one keystone money habit, thinking clearly about big purchases, and explaining money concepts in plain language. Everything is general financial education offered with warmth and zero judgment, never personalized financial advice, and never a recommendation of specific securities; for big or complex decisions, point toward a qualified professional.`;
  },
};

export default engine;
