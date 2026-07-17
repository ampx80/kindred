// Aria - the always-there companion inside Kindred. Given the conversation
// plus a live snapshot of the person's life (profile, goals, journal, people,
// wins, check-ins - sent from the client store), Aria answers as someone who
// truly knows them, points to the right screen, and proposes actions the
// client executes with one tap. Aria proposes; the person confirms; the store
// writers do the work. Aria never mutates data herself.
import { withErrorHandling, methodNotAllowed, readJsonBody } from './_utils.js';
import { callAnthropic } from './_lib-anthropic.js';
import { screenForCrisis, crisisPayload, SAFETY_SYSTEM } from './_lib-safety.js';

export const config = { maxDuration: 45 };

const SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string', description: 'Warm, real, concise answer (2-5 sentences). Their coaching tone. Plain language, no filler, no lecture.' },
    nav: {
      type: ['object', 'null'],
      description: 'A single page link if you reference a screen. null otherwise.',
      properties: { label: { type: 'string' }, to: { type: 'string' } },
    },
    actions: {
      type: 'array',
      description: '0 to 3 action buttons for them to run with one tap.',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['navigate', 'set_goal', 'mark_goal_done', 'log_win', 'add_person', 'add_journal', 'add_rec', 'draft_message', 'check_in', 'reflect'] },
          label: { type: 'string' },
          to: { type: 'string', description: 'for navigate' },
          goalTitle: { type: 'string', description: 'for mark_goal_done: the exact title of an existing goal from the snapshot to log a rep on today' },
          reflection: { type: 'object', properties: { rating: { type: 'number', description: '1-5 how the day went' }, gratitude: { type: 'string' } }, description: 'for reflect: close out the day' },
          goal: { type: 'object', properties: { title: { type: 'string' }, domainId: { type: 'string' }, why: { type: 'string' }, cadence: { type: 'string', enum: ['daily', 'weekly'] } } },
          win: { type: 'object', properties: { title: { type: 'string' }, detail: { type: 'string' }, domainId: { type: 'string' } } },
          person: { type: 'object', properties: { name: { type: 'string' }, relation: { type: 'string' }, intent: { type: 'string' } } },
          journal: { type: 'object', properties: { text: { type: 'string' } } },
          rec: { type: 'object', properties: { kind: { type: 'string', enum: ['book', 'action', 'practice'] }, title: { type: 'string' }, why: { type: 'string' }, domainId: { type: 'string' } } },
          message: { type: 'object', properties: { to: { type: 'string' }, body: { type: 'string' } }, description: 'for draft_message: a real, ready-to-send text in THEIR voice, grounded in the relationship' },
        },
        required: ['kind', 'label'],
      },
    },
    suggestions: { type: 'array', items: { type: 'string' }, description: '2 to 3 natural things they might say next.' },
    crisis: { type: 'boolean', description: 'true if the user expressed self-harm, suicidal thoughts, abuse, or being in danger. When true, keep reply to brief care only - no coaching.' },
  },
  required: ['reply', 'actions', 'suggestions'],
};

function snapshotToText(s) {
  if (!s) return 'No snapshot provided.';
  const L = [];
  const p = s.profile;
  if (p) {
    L.push(`WHO THEY ARE: ${p.name}. Coaching tone: ${p.tone} (${p.toneWhy || ''}).`);
    L.push(`Their profile summary: ${p.summary}`);
    if (p.belief) L.push(`The belief you hold for them: ${p.belief}`);
    if (Array.isArray(p.domains)) L.push('THEIR DOMAINS: ' + p.domains.map(d => `${d.name} (${d.id}) - ${d.why}`).join(' | '));
    if (p.faith && p.faith.opted && p.faith.tradition && !['secular', 'private'].includes(p.faith.tradition)) {
      L.push(`FAITH AND VALUES: ${p.faith.tradition}${p.faith.importance ? ` ("${p.faith.importance}")` : ''}. Honor this gently when it naturally fits; never preach, never assume, never force it in.`);
    }
  }
  if (Array.isArray(s.goals) && s.goals.length) {
    L.push(`GOALS (${s.goals.length}) [title | domain | cadence | streak | last done | status]:`);
    for (const g of s.goals) L.push(`- ${g.title} | ${g.domainId} | ${g.cadence} | streak ${g.streak} | ${g.lastDoneAt ? g.lastDoneAt.slice(0, 10) : 'never'} | ${g.status}`);
  }
  if (Array.isArray(s.checkins) && s.checkins.length) {
    L.push('RECENT MOOD CHECK-INS (1 low - 5 high): ' + s.checkins.map(c => `${c.date}: ${c.mood}${c.note ? ` ("${c.note}")` : ''}`).join('; '));
  }
  if (Array.isArray(s.journal) && s.journal.length) {
    L.push('RECENT JOURNAL:');
    for (const j of s.journal) L.push(`- ${j.at.slice(0, 10)}: ${j.text.slice(0, 220)}`);
  }
  if (Array.isArray(s.people) && s.people.length) {
    L.push(`PEOPLE (${s.people.length}) [name | relation | what they want with them | last touch]:`);
    for (const pe of s.people) L.push(`- ${pe.name} | ${pe.relation} | ${pe.intent || ''} | ${pe.lastTouch ? pe.lastTouch.slice(0, 10) : 'never'}`);
  }
  if (Array.isArray(s.wins) && s.wins.length) {
    L.push('WINS: ' + s.wins.map(w => `${w.at.slice(0, 10)}: ${w.title}`).join('; '));
  }
  if (Array.isArray(s.recs) && s.recs.length) {
    L.push('OPEN RECOMMENDATIONS: ' + s.recs.map(r => `${r.kind}: ${r.title}`).join('; '));
  }
  if (s.today) L.push(`TODAY: ${s.today.date}. Morning mood: ${s.today.mood ?? 'not logged yet'}. Evening reflection: ${s.today.reflected ? `done (rated ${s.today.reflected})` : 'not yet'}.`);
  if (typeof s.ritualStreak === 'number') L.push(`RITUAL STREAK: ${s.ritualStreak} day(s) fully closed (check in + moves + reflect). This is the streak that matters most - protect it.`);
  return L.join('\n');
}

const TONE_GUIDE = {
  nurturer: 'Gentle, patient, zero pressure. Validate first, then one small nudge. Never scold.',
  coach: 'Encouraging and structured. Name the win, name the next rep, keep it moving.',
  challenger: 'Direct, honest, a little tough. Call out the gap between what they said and what they did - with love, never contempt.',
};

const SYSTEM = (snapText, path, tone) => [
  'You are Aria, the companion inside Kindred, a life companion app. You know this person - their story, their goals, their people, their ups and downs - from the SNAPSHOT below. You are not a therapist and not a chatbot; you are the steady friend who remembers everything and tells the truth.',
  `THEIR COACHING TONE: ${tone || 'coach'}. ${TONE_GUIDE[tone] || TONE_GUIDE.coach}`,
  '',
  'PAGES (attach a navigate action whenever you name a screen):',
  '- Today: /today | Paths (domains + goals): /paths | a domain: /paths/<domainId>',
  '- Journal: /journal | People: /people | For you (recommendations): /foryou | Growth (wins + streaks): /growth',
  '',
  'HOW TO RESPOND:',
  '- GROUNDED: answer from the snapshot with their real goals, people, moods, and words. Reference specifics ("your streak on morning walks is 6 days", "you have not reached out to Sam since March"). Never invent records. If something is not in the snapshot, say so plainly.',
  '- WHY THEY FEEL OFF: when they say they are down or stuck, connect it to what you actually see (mood trend, a stalled goal, a person they miss) and give ONE concrete thing to do in the next hour, not a lecture.',
  '- BOOKS + PRACTICES: when recommending, tailor to their profile and current moment, and attach an add_rec action so it lands in their For you list. For books give the real title and author and one sentence on why it fits THEM.',
  '- RELATIONSHIPS: for reconnecting or hard conversations, offer a draft_message action with a real, sendable text in a voice that sounds like a person, not a card.',
  '- ACTIONS (propose, they confirm): set_goal (small, concrete, cadence daily or weekly, domainId from their domains), mark_goal_done (when they say they did a goal, e.g. "I did my walk" - pass the exact goalTitle from the snapshot so it logs the rep and streak), log_win, add_person, add_journal (their words, first person), add_rec, check_in, reflect (close out the day when it is evening or they are recapping - pass a 1-5 rating and a short gratitude), draft_message.',
  '- FAITH: if they have a faith or values in the snapshot, you may gently draw on it when it genuinely fits (a hard day, gratitude, a hard choice). Never preach, never quote scripture you are unsure of, never assume. If they have none, never bring it up.',
  '- CALL-OUTS: if they said they would do something and did not, and their tone is coach or challenger, name it honestly. If nurturer, name it softly and shrink the next step.',
  '- Keep reply tight (2-5 sentences). Offer 2-3 suggestions.',
  '',
  SAFETY_SYSTEM,
  '',
  'SNAPSHOT:',
  snapText,
  path ? `\nThey are currently on route: ${path}` : '',
].join('\n');

export default withErrorHandling(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const body = readJsonBody(req);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const snapshot = body.snapshot || null;
  const path = body.context?.path || '';
  if (!messages.length) return res.status(400).json({ error: 'messages required' });

  const name = snapshot?.profile?.name || '';

  // Deterministic crisis screen on the latest user message, BEFORE any model
  // call. This is the failsafe: a crisis must surface human help even if the
  // Anthropic API is unreachable or the model misses the signal.
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (lastUser && screenForCrisis(lastUser.content).crisis) {
    return res.status(200).json(crisisPayload(name));
  }

  const convo = messages.filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'Them' : 'Aria'}: ${m.content}`).join('\n');

  const out = await callAnthropic({
    system: SYSTEM(snapshotToText(snapshot), path, snapshot?.profile?.tone),
    prompt: `Conversation so far:\n${convo}\n\nRespond as Aria to their latest message.`,
    schema: SCHEMA,
    maxTokens: 1300,
    model: 'claude-sonnet-4-6',
  });
  const data = out?.data || {};
  // Model-side crisis flag: honor it even if the deterministic screen did not
  // fire (catches nuanced phrasing the regex misses).
  if (data.crisis) {
    return res.status(200).json({ ...crisisPayload(name), reply: data.reply || crisisPayload(name).reply });
  }
  return res.status(200).json({
    ok: true,
    crisis: false,
    reply: data.reply || 'I am here. Tell me what is on your mind.',
    nav: data.nav || null,
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 3) : [],
    suggestions: Array.isArray(data.suggestions) ? data.suggestions.slice(0, 3) : [],
  });
});
