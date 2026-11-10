import { requireUser } from './_lib/supabase';
import {
  OPENROUTER_API_URL,
  OpenRouterError,
  fetchWithRetry,
  getFallbackModels,
  getModel,
} from './_lib/openrouter';
import { chatTool } from './_lib/chatTool';

export const runtime = 'nodejs';

const SYSTEM_PROMPT =
  'You are a health assistant for a demo with synthetic data, not a medical product. ' +
  'Answer in Markdown. Prefer the provided sources; if they do not contain the answer, say so.';

const MAX_MESSAGES = 40;
const MAX_CONTENT_LENGTH = 8000;
const MAX_QUESTION_LENGTH = 1000;
const MATCH_COUNT = 6;

type Msg = { role: 'user' | 'assistant'; content: string };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function parseMessages(body: unknown): Msg[] | null {
  const list = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(list) || list.length === 0 || list.length > MAX_MESSAGES) return null;
  const valid = list.every(
    (m) =>
      (m?.role === 'user' || m?.role === 'assistant') &&
      typeof m.content === 'string' &&
      m.content.length <= MAX_CONTENT_LENGTH,
  );
  return valid && list[list.length - 1].role === 'user' ? (list as Msg[]) : null;
}

export default {
  async fetch(request: Request): Promise<Response> {
    // Never let a config or runtime error crash the function: always answer with JSON.
    try {
      return await handle(request);
    } catch (error) {
      console.error('chat route failed', error);
      return json({ error: 'Chat is not available right now.' }, 500);
    }
  },
};

async function handle(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const auth = await requireUser(request);
    if (!auth) return json({ error: 'Unauthorized' }, 401);

    const messages = parseMessages(await request.json().catch(() => null));
    if (!messages) return json({ error: 'Invalid messages' }, 400);

    // Retrieval runs as the signed-in user, so RLS applies and no service-role key is needed here.
    const question = messages[messages.length - 1].content.slice(0, MAX_QUESTION_LENGTH);
    const { data: chunks, error: searchError } = await auth.supabase.rpc('search_rag_chunks', {
      q: question,
      match_count: MATCH_COUNT,
    });
    if (searchError) console.error('search_rag_chunks failed', searchError);
    const found = chunks ?? [];
    const context = found.map((c, i) => `[Source ${i + 1}]\n${c.content}`).join('\n\n---\n\n');

    const primaryModel = getModel();
    const fallbackModels = getFallbackModels();
    let failureStatus = 0;
    const res = await fetchWithRetry(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: primaryModel,
        ...(fallbackModels.length > 0 && { models: fallbackModels }),
        messages: [
          {
            role: 'system',
            content: context ? `${SYSTEM_PROMPT}\n\nSources:\n${context}` : SYSTEM_PROMPT,
          },
          ...messages,
        ],
        tools: [chatTool],
        tool_choice: { type: 'function', function: { name: 'answer' } },
      }),
    }).catch((error) => {
      console.error(error);
      failureStatus = error instanceof OpenRouterError ? error.status : 0;
      return null;
    });

    if (!res || !res.ok) {
      // Free models share rate limits upstream: tell the user it is temporary instead of "broken".
      const busy = (res?.status ?? failureStatus) === 429;
      return json(
        { error: busy ? 'The AI model is busy right now. Please try again in a moment.' : 'AI service unavailable.' },
        busy ? 429 : 502,
      );
    }

    const data = await res.json();
    console.log('chat model used:', data.model);
    const message = data.choices?.[0]?.message;
    let result: { reply?: string; cited_sources?: number[] } = {};
    try {
      result = JSON.parse(message?.tool_calls?.[0]?.function?.arguments ?? '{}');
    } catch {
      // Malformed arguments: fall back to plain message content below.
    }

    // Some models ignore tool_choice and answer as plain text; keep the app working.
    let reply = result.reply || message?.content || '';
    if (!reply) return json({ error: 'The model returned an empty answer.' }, 502);

    const cited = (result.cited_sources ?? []).filter((n) => Number.isInteger(n) && found[n - 1]);
    const fileIds = [...new Set(cited.map((n) => found[n - 1].file_id))];
    let names: string[] = [];
    if (fileIds.length > 0) {
      const { data: files } = await auth.supabase.from('rag_files').select('file_name').in('id', fileIds);
      names = (files ?? []).map((f) => f.file_name);
    }
    if (names.length > 0) reply += `\n\n**Sources:** ${names.join(', ')}`;

    return json({ reply, usedContext: found.length > 0, sources: names });
}
