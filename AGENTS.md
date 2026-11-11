# Agent notes

Instructions for AI agents (Codex, Claude, others) working in this repository. Humans: see `README.md`.

## Stack and layout
- TypeScript only (no Python). Vite + React 18 + Tailwind + shadcn/ui SPA in `src/`.
- Server code is Vercel Functions in `api/` (`chat.ts`, `ingest.ts`, shared helpers in `api/_lib/`) and Routing Middleware in `proxy.ts`.
- Database, RLS and Storage are defined only by SQL migrations in `supabase/migrations/`. Never create tables by hand in the dashboard.
- Step-by-step playbooks with copy-paste snippets live in `skills/` (index: `skills/README.md`). Read the relevant `SKILL.md` before changing auth, the chat route, retrieval or deployment.

## Commands (run inside this folder)
- Install: `npm install`
- Dev server **with** `/api`: `npx vercel dev` (plain `npm run dev` does not serve `/api`; needs `vercel link` and `vercel env pull .env.local` first).
- Checks: `npx tsc -p tsconfig.app.json --noEmit` and `npm run build`.
- Database: `npx supabase db push --remote` (the CLI targets a local Docker stack without `--remote`), then regenerate types with `npx supabase gen types typescript --remote`.

## Rules that must not break
- **Secrets stay server-side.** `OPENROUTER_API_KEY` and any service-role key never get a `VITE_` prefix and never reach the browser. Never commit `.env`, keys or test credentials.
- **RLS on every table**, scoped to `auth.uid()`. Server routes use the cookie-based user client (`api/_lib/supabase.ts`); do not add the service-role key to routes that act for a user.
- **Identify callers with `auth.getUser()`**, never `getSession()`, on the server.
- **All model calls go through OpenRouter** from a server route, with one forced tool call and no agent loop. The model id comes from `OPENROUTER_MODEL`; optional `OPENROUTER_FALLBACK_MODELS` lists fallbacks.
- **Wrap serverless handlers in try/catch and return JSON.** A throw must not crash the process.
- **Use synthetic data only** (see `samples/`); this is not a medical product.

## Git workflow
- One short branch per logical change: `<type>/<short-name>` (for example `feat/knowledge-base-rag`).
- Conventional Commits in English, imperative, first line under ~70 characters.
- Pull request into `main`, merged with a merge commit (no squash, no force push). Annotated tags at milestones (`v0.1-schema` ... `v1.0`).
- Before committing: `git status`, `git diff`, `git add <files>` (no blind `git add .`).

## Chat history
- Conversations are persisted in the database: `public.chat_sessions` (one row per conversation) and `public.chat_messages` (one row per message), both scoped to the signed-in user by query and RLS. The active conversation comes from the URL (`/chat/:sessionId`), never from component state alone. Why: reloading the page must restore the exact conversation, and opening one thread must never show another thread's messages.
- Anything that asks "does this user already have conversations?" must wait until the loaded list is confirmed to belong to the current user (`useChatHistory`'s `loadedFor`), not merely until a fetch has finished. Why: an empty result fetched before the user resolved made every visit to the chat page create a blank conversation.
- "New chat" reuses an untouched empty conversation instead of inserting another blank row.

## UI gotchas
- `AppShell`'s `<main>` is `overflow-hidden`; content pages (Profile, Knowledge Base) need their own `flex-1 min-h-0 overflow-y-auto` wrapper to scroll.
- Radix `ScrollArea` wraps content in a `display: table` div; keep the `[&>[data-radix-scroll-area-viewport]>div]:!block` override on the chat sidebar so `truncate` works.
