import { requireUser } from './_lib/supabase.js';
import { chunkText } from './_lib/chunk.js';

export const runtime = 'nodejs';

// Keep in sync with the client limit; Vercel Functions also cap the request body (about 4.5 MB).
const MAX_TEXT_CHARS = 500_000;
const MAX_CHUNKS = 200;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default {
  async fetch(request: Request): Promise<Response> {
    // Never let an unexpected error crash the function: always answer with JSON.
    try {
      return await handle(request);
    } catch (error) {
      console.error('ingest route failed', error);
      return json({ error: 'Indexing failed.' }, 500);
    }
  },
};

async function handle(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const auth = await requireUser(request);
  if (!auth) return json({ error: 'Unauthorized' }, 401);

  const body = (await request.json().catch(() => null)) as { file_id?: unknown; text?: unknown } | null;
  if (typeof body?.file_id !== 'string' || typeof body.text !== 'string') {
    return json({ error: 'file_id and text are required' }, 400);
  }
  if (body.text.length > MAX_TEXT_CHARS) return json({ error: 'Text is too large' }, 413);

  const { supabase, user } = auth;
  const fileId = body.file_id;

  // RLS only returns the row if it belongs to the caller, so this doubles as the ownership check.
  const { data: file } = await supabase.from('rag_files').select('id').eq('id', fileId).maybeSingle();
  if (!file) return json({ error: 'File not found' }, 404);

  const fail = async (message: string, status: number) => {
    await supabase.from('rag_files').update({ status: 'error', error_message: message }).eq('id', fileId);
    return json({ error: message }, status);
  };

  const chunks = chunkText(body.text).slice(0, MAX_CHUNKS);
  if (chunks.length === 0) return fail('No text could be extracted from this file', 400);

  // Re-ingesting replaces earlier chunks.
  await supabase.from('rag_chunks').delete().eq('file_id', fileId);

  const rows = chunks.map((content, index) => ({
    user_id: user.id,
    file_id: fileId,
    chunk_index: index,
    content,
  }));
  const { error: insertError } = await supabase.from('rag_chunks').insert(rows);
  if (insertError) {
    console.error('rag_chunks insert failed', insertError);
    return fail('Could not store the document chunks', 500);
  }

  await supabase
    .from('rag_files')
    .update({ status: 'ready', chunk_count: rows.length, error_message: null })
    .eq('id', fileId);

  return json({ ok: true, chunks: rows.length });
}
