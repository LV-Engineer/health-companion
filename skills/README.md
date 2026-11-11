# Reproduction skills

Runnable playbooks an AI agent (Claude, Codex, any other) can follow to rebuild this app's setup on a new project:
a Vite + React + TypeScript SPA, Supabase (Auth, Postgres with RLS, Storage), a chat backend on Vercel Functions that
calls OpenRouter with a forced tool call, document-grounded answers, and a Git-based Vercel deploy.

They are written to be model-agnostic and self-contained: exact commands, copy-paste code under each skill's `snippets/`,
and the reasoning behind every non-obvious choice. Placeholders look like `<project-ref>`; never paste real secrets into
a skill, a snippet or the repository.

## Order

| # | Skill | Use it when |
|---|---|---|
| 1 | [remix-lovable-starter](remix-lovable-starter/SKILL.md) | The task starts from a Lovable project link: remix, connect GitHub, clone, strip starter secrets |
| 2 | [supabase-rls-ssr](supabase-rls-ssr/SKILL.md) | Standing up the database: migrations, RLS on every table, Storage bucket, `@supabase/ssr` clients, env vars |
| 3 | [openrouter-forced-tool-call](openrouter-forced-tool-call/SKILL.md) | Building the chat route: one OpenRouter call, forced tool, retries, fallback models |
| 4 | [knowledge-base-rag](knowledge-base-rag/SKILL.md) | Uploading documents and grounding answers on them (full-text retrieval, no embeddings) |
| 5 | [vercel-deploy](vercel-deploy/SKILL.md) | Local `vercel dev`, `vercel.json`, Routing Middleware, Git deploy, post-deploy checks |

Each skill ends with a **Gotchas** section: the failures that actually happened, with symptom, cause and fix.

## Conventions the skills assume

- TypeScript everywhere (no Python), npm as the only package manager.
- One branch per logical step, Conventional Commits, pull request with a merge commit, annotated tags at milestones.
- Server-only values (`OPENROUTER_API_KEY`, and any Supabase secret key you might add) never carry a `VITE_` prefix and never reach the browser.
- Tests use synthetic data only; test credentials are never committed.
