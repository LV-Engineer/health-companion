---
name: openrouter-forced-tool-call
description: Build a server-side chat route that calls OpenRouter once, forces the model to answer through a single typed tool, retries on 429/5xx, falls back to other models, and returns typed JSON. Use when an app needs structured LLM output through a swappable model without an agent loop.
---

# OpenRouter: one call, forced tool, typed result

Goal: the browser never sees the API key, the model id is a single swappable config value, and the answer arrives as
validated JSON in `tool_calls[0].function.arguments` instead of free text you have to parse.

Snippets: `snippets/openrouter.ts`, `chatTool.ts`, `chat-route.ts` (copy to `api/_lib/` and `api/`).
Requires the cookie-based server client from skill `supabase-rls-ssr` (`api/_lib/supabase.ts`) if the route is authenticated.

## 1. Account, key, model

1. openrouter.ai: create an account, then **Keys > Create key** with a **credit limit** (for example 1) and, if you like, an expiry.
2. Pick a model whose page lists `tools` under **Supported parameters**. For free models add the `:free` suffix.
3. Environment (server only, no `VITE_` prefix):

```text
OPENROUTER_API_KEY=<key>
OPENROUTER_MODEL=<provider/model-id[:free]>
OPENROUTER_FALLBACK_MODELS=<id1>,<id2>      # optional
```

## 2. The pattern

- **Define one tool** whose `parameters` are the shape you want back (`snippets/chatTool.ts`). Here: `reply` (Markdown string) and `cited_sources` (integers).
- **Force it** with `tool_choice: { type: 'function', function: { name: 'answer' } }`. One request, one turn, no loop.
- **Read the result** from `choices[0].message.tool_calls[0].function.arguments` and `JSON.parse` it.
- **Keep the model swappable:** `model: process.env.OPENROUTER_MODEL`. OpenRouter normalises tool calling across Claude, GPT and Gemini, so the code never changes.
- **Retries:** `fetchWithRetry` (`snippets/openrouter.ts`) retries 429/500/502/503/504/529 with exponential backoff, honours `Retry-After`, and caps the delay so the function does not outlive its time limit.
- **Keep the status:** when retries run out it throws `OpenRouterError` carrying the HTTP status, so the route can answer
  `429 "model is busy, try again"` instead of a generic 502.
- **Fallback models:** send `model` (primary) plus `models: [fallbacks]`. On rate limits or downtime OpenRouter tries the next one; the response field `model` says which one answered.
  Keep fallbacks free as well: a paid fallback bills at its own price.

## 3. The route (`snippets/chat-route.ts`)

1. Only POST; identify the caller with the cookie client (`getUser()`); validate the body (roles, lengths, last message from the user).
2. Retrieve context (see skill `knowledge-base-rag`) and put it in the system prompt as numbered `[Source n]` blocks.
3. One `fetchWithRetry` call with the tool and `tool_choice`.
4. Parse the arguments; if the model ignored the tool and answered in plain text, fall back to `message.content`.
5. Map `cited_sources` to document names and append them to the reply.
6. **Wrap the whole handler in try/catch and always return JSON.** A thrown error (for example a missing env var) otherwise crashes the dev server.
7. Call it from the UI with `fetch('/api/chat', { method: 'POST', credentials: 'same-origin', ... })` so the session cookie travels along.

## 4. Verify

- In the UI, ask a question that needs a table: the reply renders Markdown with a table, and the loading state shows meanwhile.
- DevTools > Network > the `/api/chat` response is `{ reply, usedContext, sources }`.
- The server log shows `chat model used: <id>`.
- Break it on purpose: unset `OPENROUTER_MODEL` locally and confirm the response is a JSON error, not a crashed server.

## Gotchas

- **Answer cut after the first line** (for example only `| Aspect | Details |`) with no server error: some free models/providers truncate multi-line tool arguments.
  Diagnose by reading the `/api/chat` response body in DevTools. Switch to another tools-capable model, or make the tool return `reply_lines: string[]` and join them with `"\n"` on the server.
- **`tool_calls` is missing:** the model does not honour forced `tool_choice`. Check *Supported parameters* before choosing it, and keep the plain-text fallback.
- **429 "temporarily rate-limited upstream":** free models share an upstream limit across all users. Use fallback models, answer 429 with a friendly message, or add credit.
- **Frontend sees `502` instead of 429:** the retry helper threw a plain error and lost the status. Throw an error that carries it.
- **`OPENROUTER_MODEL is not set` even though it is in the Vercel project:** under `vercel dev` Secret/Sensitive variables may not reach functions after `vercel env pull`. Keep local values in a gitignored `.env`; store the model id as a plain (Config) variable, it is not a secret.
- **Empty values in `.env` override real ones.** Do not copy `.env.example` blindly; delete the lines you do not fill.
- **Never log or echo the key,** and never send it to the client. Give it a credit limit so a leak is cheap.
