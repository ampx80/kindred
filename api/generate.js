// The feature engine's one AI endpoint. Every "generator" feature (workout plan,
// prayer, meal plan, conversation script, ritual, affirmations, decision
// framework, and ~35 more) runs through here: the client sends the feature's
// generation instruction plus the user's inputs and life context, and Claude
// returns a warm, personalized markdown document the client renders, saves, and
// prints. The safety layer is always appended, and inputs are crisis-screened.
import { withErrorHandling, methodNotAllowed, readJsonBody } from './_utils.js';
import { callAnthropic } from './_lib-anthropic.js';
import { SAFETY_SYSTEM, screenForCrisis, crisisReply, CRISIS_RESOURCES } from './_lib-safety.js';

export const config = { maxDuration: 60 };

export default withErrorHandling(async (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST']);
  const b = readJsonBody(req);
  const title = String(b.title || 'Your result').slice(0, 120);
  const systemPrompt = String(b.systemPrompt || '').slice(0, 5000);
  const inputsText = String(b.inputsText || '').slice(0, 3500);
  const profileText = String(b.profileText || '').slice(0, 4500);
  if (!systemPrompt) return res.status(400).json({ error: 'systemPrompt required' });

  // Crisis screen the user's own words before generating anything.
  if (screenForCrisis(inputsText).crisis) {
    return res.status(200).json({ ok: true, crisis: true, title, resources: CRISIS_RESOURCES,
      markdown: crisisReply('') + '\n\n**988** (call or text) is there any time. Text **HOME to 741741** for a counselor. **911** for immediate danger.' });
  }

  const system = [
    systemPrompt,
    '',
    SAFETY_SYSTEM,
    '',
    'OUTPUT: Return clean markdown only - use ## and ### headings, - bullet lists, 1. numbered lists, and **bold**. Warm, specific, and personal to this individual. No preamble, no sign-off, no meta commentary. Never use an em dash or en dash, plain hyphen only.',
  ].join('\n');

  const out = await callAnthropic({
    system,
    prompt: `WHO THIS IS FOR (their life context):\n${profileText || '(they have not shared much yet - use warm general guidance)'}\n\nWHAT THEY ASKED FOR:\n${inputsText || '(no specifics given - use your best judgment and their context)'}\n\nCreate it now, personalized to them.`,
    maxTokens: 2200,
    model: 'claude-sonnet-4-6',
  });

  return res.status(200).json({ ok: true, title, markdown: (out && out.text || '').trim() });
});
