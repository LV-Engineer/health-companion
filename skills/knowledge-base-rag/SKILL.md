---
name: knowledge-base-rag
description: Let users upload documents and ground LLM answers on them using Postgres full-text search under RLS, with no embedding model. Covers the upload flow, chunking, retrieval function, prompt wiring and a grounding demo. Use when answers must cite the user's own files.
---

# Knowledge base with full-text retrieval

Goal: users upload `.pdf .docx .txt .md .csv .json` (up to 20 MB), the raw file sits in a private Storage bucket, parsed text
sits in Postgres, and the chat route answers from the user's own documents. Everything runs as the signed-in user, so RLS
does the isolation and no service-role key is needed.

Snippets: `snippets/chunk.ts`, `ingest-route.ts`, `sample-document.md`. The SQL (tables `rag_files`, `rag_chunks`, the
`search_rag_chunks` function, the bucket policy) is in skill `supabase-rls-ssr` (`snippets/init.sql`).

## Flow

1. **Browser:** the user picks files. Reject anything over 20 MB. Extract text client-side (`pdfjs-dist` for PDF, `mammoth` for DOCX, `File.text()` for the rest). Fail fast if no text comes out.
2. **Cap the text** at 500,000 characters and tell the user (toast): Vercel Functions limit the request body (about 4.5 MB).
3. **Storage:** upload the raw file to the private bucket at `<user-id>/<timestamp>-<sanitised-name>`. The first path segment must be the user id, because the storage policy checks it.
4. **Row:** insert into `rag_files` (name, mime, size, storage path, `status = 'pending'`).
5. **Index:** `POST /api/ingest` with `{ file_id, text }` (`snippets/ingest-route.ts`). The route verifies ownership (RLS only returns the caller's row), splits the text with `chunkText` (1200 characters, 150 overlap, at most 200 chunks), deletes old chunks, inserts the new ones and sets `status = 'ready'` and `chunk_count` (or `'error'` with a message).
6. **List / delete:** list `rag_files` for the user; deleting removes the Storage object and the row (chunks cascade). Ask for confirmation in a dialog, not `window.confirm`.
7. **Ask:** the chat route calls `search_rag_chunks(q, match_count)` with the user's cookie client and puts the hits into the system prompt as `[Source n]` blocks (skill `openrouter-forced-tool-call`).

## Retrieval function (design notes)

- `language sql stable security invoker`: RLS applies to the caller, so a user can never retrieve another user's chunks. Do **not** accept a `user_id` parameter from the client.
- The text-search config is `simple` (no stemming or stop words) so it works for any language. Words are joined with **OR**: `websearch_to_tsquery` requires *all* words, so a natural-language question would match nothing.
- Rank with `ts_rank` and return the top 6 chunks. For many documents consider the `english` config (stop words) or pgvector.

## Verify grounding (the demonstration)

1. Upload `snippets/sample-document.md`: a synthetic document with made-up facts (a daily step goal of 7,431, hydration table, bedtime 22:45).
2. In a new chat ask: *How many steps per day does Aurora Clinic recommend?*
3. Expected: the answer contains **7,431**, ends with `Sources: aurora-wellness-guide.md`, and the `/api/chat` response has `usedContext: true`.
4. Delete the file in the UI and ask again: the fact and the source are gone.
5. Sign in as another user: your file is not listed and the question gets no context.

## Gotchas

- **Upload fails with a Storage policy error:** the object path does not start with the user id, or the bucket name in code differs from the migration's bucket.
- **Large PDFs break indexing:** the extracted text exceeds the function body limit. Truncate on the client and say so.
- **Retrieval finds nothing for a long question:** an AND query. Use the OR-joined `to_tsquery` in `search_rag_chunks`.
- **The model cites sources that were not retrieved:** only trust `cited_sources` indexes that exist in the retrieved list (the route filters them).
- **Old Edge Functions and embedding gateways keep being called:** if the starter embedded text through a vendor gateway, remove that code path when you switch to full-text, or users get silent failures.
- **Do not index private data in a demo.** Use synthetic documents only.
