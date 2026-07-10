// The Kindred adaptive interview - the hero of the whole app. Given the
// conversation so far (every question Aria asked and every answer the person
// gave), return the NEXT question, generated from what they actually revealed.
// Never a fixed script. When the picture is complete enough, synthesize the
// "this is you" profile in the same call.
import { withErrorHandling, methodNotAllowed, readJsonBody } from './_utils.js';
import { callAnthropic } from './_lib-anthropic.js';
import { screenForCrisis, crisisReply, CRISIS_RESOURCES } from './_lib-safety.js';

export const config = { maxDuration: 60 };

const DOMAINS = [
  'faith', 'fitness', 'nutrition', 'mindset', 'relationships', 'family',
  'friendship', 'romance', 'career', 'money', 'creativity', 'learning',
  'nature', 'travel', 'purpose', 'recovery', 'health', 'community',
];

const SCHEMA = {
  type: 'object',
  properties: {
    question: { type: 'string', description: 'The next question. Warm, specific, one sentence or two. It MUST visibly build on something they just said (echo a word or detail of theirs). Never generic.' },
    choices: {
      type: 'array', items: { type: 'string' },
      description: '3 to 6 short tappable answers (2-8 words each) that genuinely span how different people would answer. They can always type their own instead.',
    },
    domainsSensed: {
      type: 'array', items: { type: 'string', enum: DOMAINS },
      description: 'Every life domain lighting up so far across ALL answers, strongest first.',
    },
    toneSignal: {
      type: 'string', enum: ['nurturer', 'coach', 'challenger'],
      description: 'How this person seems to want to be coached, inferred from HOW they answer (hesitant and gentle -> nurturer; practical and structured -> coach; blunt, driven, impatient -> challenger). Never ask them directly.',
    },
    depth: { type: 'number', description: '0-100, how complete the picture of this person is.' },
    done: { type: 'boolean', description: 'true when you have enough for a real profile. Aim for 6-10 questions total. NEVER more than 12.' },
    profile: {
      type: ['object', 'null'],
      description: 'ONLY when done=true: the synthesized profile. Otherwise null.',
      properties: {
        summary: { type: 'string', description: '60-110 words, second person, warm and specific. Reflect their OWN words back at them. It should feel like being seen by someone who was really listening. No flattery filler.' },
        domains: {
          type: 'array',
          description: 'The 3-5 domains that matter most to THIS person right now, strongest first.',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', enum: DOMAINS },
              name: { type: 'string', description: 'Their version of it, e.g. "Rebuilding strength" not just "fitness".' },
              why: { type: 'string', description: 'One sentence, grounded in what they said.' },
              firstGoal: { type: 'string', description: 'A small, concrete first goal (doable this week).' },
            },
            required: ['id', 'name', 'why', 'firstGoal'],
          },
        },
        tone: { type: 'string', enum: ['nurturer', 'coach', 'challenger'] },
        toneWhy: { type: 'string', description: 'One warm sentence explaining the coaching style you will use with them.' },
        belief: { type: 'string', description: 'One specific sentence of belief in them, grounded in something they revealed. Not a fortune cookie.' },
      },
      required: ['summary', 'domains', 'tone', 'toneWhy', 'belief'],
    },
  },
  required: ['question', 'choices', 'domainsSensed', 'toneSignal', 'depth', 'done', 'profile'],
};

const SYSTEM = `You are Aria, the warm companion inside Kindred, a life companion app. You are meeting someone for the very first time and your only job is to genuinely get to know them: what they want their life to feel like, and which parts of it (faith, body, relationships of every kind, work, creativity, nature, travel, money, mind, recovery, purpose) are calling for attention right now.

HOW YOU INTERVIEW:
- ONE question at a time. Every question is generated from their previous answers - echo their words, follow the thread they opened. If they mention a strained relationship, ask who. If they say "stronger", ask what stronger is FOR. Never a generic intake question after the first exchange.
- Go deeper before you go wider. Two or three follow-ups on the thing that clearly has energy beats a survey of everything.
- But do cover ground: by the end you should know 3-5 domains that matter, one thing that is hard right now, and one thing they are proud of or hopeful about.
- Keep questions SHORT (one sentence, maybe two). Warm, plain, human. Like a wise friend, not a clinician. Never use the word "goals" in the first three questions.
- Choices must be genuinely different from each other and phrased in a human voice ("Honestly, my marriage", "I want my energy back"). Always leave room for them to type instead.
- Read tone: hesitant, hurting people get softer questions; driven, blunt people get more direct ones.
- done: set true once you can write a profile that would make them feel truly seen (usually 6-10 answers). Never drag past 12.
- When done=true, write the profile with real care. summary in second person, their own words woven in. firstGoal items must be small and concrete (this week, not this year).

ABSOLUTE RULES:
- Never use an em dash or en dash. Use a normal hyphen.
- You are Aria, an AI companion. Stay in your warm voice, but if they ask what you are, be honest that you are an AI, not a person. Never claim to be human.
- Never fabricate things they did not say.
- If they reveal self-harm, suicidal thoughts, abuse, or danger, do not coach or diagnose. Lead with care and point them to 988 (call or text) and 911 for immediate danger.`;

export default withErrorHandling(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = readJsonBody(req);
  const name = (body.name || '').slice(0, 60);
  const exchanges = Array.isArray(body.exchanges) ? body.exchanges.slice(0, 14) : [];

  // If a crisis signal shows up during onboarding, surface human help
  // immediately. We keep the interview alive (a gentle continue question) but
  // lead with care and resources - never coach through it.
  const lastAnswer = exchanges.length ? exchanges[exchanges.length - 1].a : '';
  if (lastAnswer && screenForCrisis(lastAnswer).crisis) {
    return res.status(200).json({
      ok: true,
      crisis: true,
      question: crisisReply(name),
      resources: CRISIS_RESOURCES,
      choices: ['I reached out to someone', 'I want to keep going', 'Give me a minute'],
      domainsSensed: [],
      toneSignal: 'nurturer',
      depth: Math.min(60, exchanges.length * 10),
      done: false,
      profile: null,
    });
  }

  const transcript = exchanges.length
    ? exchanges.map((e, i) => `Q${i + 1} (Aria): ${e.q}\nA${i + 1} (${name || 'them'}): ${e.a}`).join('\n')
    : '(no questions asked yet - this will be your first question)';

  const prompt = [
    name ? `Their name is ${name}.` : 'You do not know their name.',
    `Questions asked so far: ${exchanges.length}.`,
    '',
    'CONVERSATION SO FAR:',
    transcript,
    '',
    exchanges.length === 0
      ? 'Ask your opening question: something warm and disarming about what they want their life to feel like or what brought them here. Not "what are your goals".'
      : 'Generate the next question (or, if the picture is complete, set done=true and synthesize the profile).',
  ].join('\n');

  const out = await callAnthropic({
    system: SYSTEM,
    prompt,
    schema: SCHEMA,
    maxTokens: 2200,
    model: 'claude-opus-4-8',
  });

  const d = out?.data || {};
  return res.status(200).json({
    ok: true,
    question: d.question || 'What would you love to be different about your life a year from now?',
    choices: Array.isArray(d.choices) ? d.choices.slice(0, 6) : [],
    domainsSensed: Array.isArray(d.domainsSensed) ? d.domainsSensed : [],
    toneSignal: d.toneSignal || 'coach',
    depth: typeof d.depth === 'number' ? Math.max(0, Math.min(100, d.depth)) : Math.min(95, exchanges.length * 12),
    done: !!d.done,
    profile: d.done ? (d.profile || null) : null,
  });
});
