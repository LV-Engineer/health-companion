# Health Companion

An AI health-assistant chat with a personal document knowledge base: real auth, a server-side chat backend on OpenRouter
with a forced tool call, answers grounded on the user's uploaded documents, a Supabase data layer with Row Level Security,
and a Git-based Vercel deployment. All health content is synthetic; this is an engineering exercise, not a medical product.

- **Live:** https://health-companion-ashen.vercel.app (sign in with the test account provided with the task)
- **Skills:** [`skills/`](skills/README.md) contains runnable playbooks to reproduce this setup on a new project.

## Features

| Surface | What it does |
|---|---|
| Chat (`/chat`) | Ask a question, get a Markdown answer (tables included) with a loading state; messages persist |
| History | Sidebar of the user's conversations (title, date), "New chat", switch and persist per user |
| Knowledge base (`/knowledge-base`, also in Profile) | Upload `.pdf .docx .txt .md .csv .json` (up to 20 MB), list and delete; answers cite the files they used |
| Profile (`/settings`) | Account email, editable display name (shown in the user menu), change password, send a reset email |
| Auth | Sign up, sign in, sign out, forgot/reset password; private pages redirect to sign-in |

## Stack

TypeScript only. Vite + React 18 + Tailwind + shadcn/ui, Supabase (Auth, Postgres, Storage, `@supabase/ssr`),
Vercel Functions in `api/`, Vercel Routing Middleware (`proxy.ts`), OpenRouter for every model call.

## How it works

```text
Browser (Vite SPA)
  |  cookie session (@supabase/ssr)         \
  |-- Supabase: Auth, Postgres (RLS), Storage \  every read/write runs as the signed-in user
  |                                           /
  |-- /api/ingest : chunk extracted text  -> rag_chunks   (user's cookie client, RLS)
  `-- /api/chat   : retrieve chunks (full-text)
                    -> one OpenRouter call, tool_choice forces the `answer` tool
                    -> { reply, usedContext, sources }
proxy.ts (Routing Middleware): validates the session, refreshes cookies, redirects signed-out visitors to /auth
```

- **RLS on every table**, scoped to `auth.uid()`; the service-role key is not used anywhere in the app.
- **Forced tool calling:** one tool (`answer`), `tool_choice` pinned to it, result read from `tool_calls[0].function.arguments`; no agent loop.
- **Swappable model:** a single `OPENROUTER_MODEL` value, optional `OPENROUTER_FALLBACK_MODELS` for rate limits.
- **Retrieval:** Postgres full-text search (`search_rag_chunks`, `security invoker`), so no embedding model is needed.

## Run locally

Prerequisites: Node 20+, a Supabase project, an OpenRouter key, a Vercel account. On Windows turn on Developer Mode
(needed by the Vercel CLI).

```bash
npm install
cp .env.example .env            # PowerShell: Copy-Item .env.example .env
```

Fill in `.env` (see the table below), then apply the database schema and start the dev server **inside the project folder**:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --remote
npx vercel login
npx vercel link
npx vercel env pull .env.local
npx vercel dev                   # serves the SPA and /api on http://localhost:3000
```

`npm run dev` alone starts only Vite and does **not** serve `/api`. Add `http://localhost:3000/**` to the Supabase Auth redirect URLs.
Create a test user in Supabase (Authentication > Users > Add user, Auto Confirm) after the migration was applied.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | client + server | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client + server | Publishable (formerly anon) key; protected by RLS |
| `OPENROUTER_API_KEY` | server only | OpenRouter key; never reaches the browser |
| `OPENROUTER_MODEL` | server only | Primary model id, for example a `:free` model that supports tools |
| `OPENROUTER_FALLBACK_MODELS` | server only, optional | Comma-separated fallback model ids |

Secrets are configured in the Vercel project (Settings > Environment Variables) and in your local, gitignored `.env`; nothing secret is committed.

## Try the grounding

1. Sign in, open **Knowledge Base**, upload [`samples/aurora-wellness-guide.md`](samples/aurora-wellness-guide.md).
2. In a new chat ask: *How many steps per day does Aurora Clinic recommend?*
3. The answer contains **7,431** and ends with `Sources: aurora-wellness-guide.md`. Delete the file and ask again: the fact and the source are gone.

## Project layout

```text
api/                 Vercel Functions: chat.ts, ingest.ts, _lib/ (OpenRouter client, tool, chunking, Supabase server client)
proxy.ts             Routing Middleware (session check, redirect to /auth)
src/                 SPA: pages, components, hooks, Supabase client
supabase/migrations/ SQL schema, RLS policies, Storage bucket
samples/             Synthetic document for the grounding demo
skills/              Reproduction playbooks (SKILL.md + snippets)
vercel.json          SPA rewrite, function timeout, middleware registration
```

## Deploy

Push to `main` (through a pull request): Vercel deploys automatically through its Git integration; no CLI deploys.
Details and checks are in [`skills/vercel-deploy`](skills/vercel-deploy/SKILL.md).

## Notes

- Built from a Lovable starter. Lovable's hosted backend and Edge Functions were replaced; unused screens were removed.
- Free OpenRouter models share upstream rate limits: the API answers `429` with a friendly message and can fall back to other models.
- `npm audit` reports advisories in the starter's dependency tree; they were not addressed as part of this exercise.
