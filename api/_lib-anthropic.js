// Single server-side wrapper for the Anthropic Messages API. When a JSON
// schema is passed it forces a tool call and returns the validated object,
// so callers never parse free text. Direct fetch, no SDK dependency.
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

export async function callAnthropic({
  prompt,
  system,
  schema,
  maxTokens = 1500,
  model = 'claude-sonnet-4-6',
} = {}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY not configured');
    err.status = 503; err.code = 'ENV_MISSING';
    throw err;
  }
  if (!prompt) {
    const err = new Error('prompt required');
    err.status = 400;
    throw err;
  }
  const useTool = schema && typeof schema === 'object';
  const body = {
    model,
    max_tokens: maxTokens,
    system: system || 'You are a warm, precise companion. No disclaimers, no filler.',
    messages: [{ role: 'user', content: prompt }],
  };
  if (useTool) {
    body.tools = [{ name: 'emit_response', description: 'Emit the structured response.', input_schema: schema }];
    body.tool_choice = { type: 'tool', name: 'emit_response' };
  }
  const r = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text();
    const err = new Error(`Anthropic ${r.status}: ${t.slice(0, 300)}`);
    err.status = 502;
    throw err;
  }
  const j = await r.json();
  if (useTool) {
    const toolUse = (j.content || []).find((b) => b.type === 'tool_use');
    if (!toolUse) { const err = new Error('no tool_use returned'); err.status = 502; throw err; }
    return { data: toolUse.input };
  }
  const text = (j.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
  return { text };
}
