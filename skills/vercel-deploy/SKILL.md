---
name: vercel-deploy
description: Run and deploy a Vite SPA with Vercel Functions under /api and Routing Middleware: link the project, set environment variables, use vercel dev locally, configure vercel.json, connect Git for push-to-deploy, and verify the live site. Use when shipping the app to Vercel.
---

# Vercel: local dev, config and Git deploy

Goal: `npm run build` output served as an SPA, `/api/*.ts` running as functions, a middleware guarding private pages, deploys
triggered by pushes to `main` (never by `vercel deploy` from the CLI), and secrets only in the Vercel project.

Snippets: `snippets/vercel.json`, `snippets/proxy.ts`.

## 1. Link the project and add variables (inside the project folder)

```bash
cd <project-folder>
npx vercel login
npx vercel link                  # answer "no" when asked to connect Git for now
npx vercel env add VITE_SUPABASE_URL
npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY
npx vercel env add OPENROUTER_API_KEY            # type: Secret
npx vercel env add OPENROUTER_MODEL              # type: Config (a model id is not a secret)
npx vercel env add OPENROUTER_FALLBACK_MODELS    # optional, Config
npx vercel env ls
```

Choose **Production, Preview and Development** for each. Values are only used by the *next* deployment.

## 2. Run locally

`npm run dev` (plain Vite) does **not** serve `/api`. Use the Vercel dev server:

```bash
npx vercel env pull .env.local
npx vercel dev
```

It listens on port 3000 (3001 if 3000 is busy, for example because of Docker Desktop). Add the ports you use to the Supabase redirect URLs.

## 3. `vercel.json` (`snippets/vercel.json`)

- `rewrites`: `{"source": "/((?!api/|src/|node_modules/|@).*)", "destination": "/index.html"}` makes deep links such as `/chat` work after a hard refresh.
  The negative lookahead keeps `/api` and the Vite dev-server URLs out of the rewrite. Static files in `dist` still win in production.
- `functions`: `{"api/*.ts": {"maxDuration": 60}}` so slow model calls are not cut at the default limit (Hobby cap is 60 s). Match `api/*.ts` only, not `api/_lib`.
- `proxy`: `{"entrypoint": "proxy.ts", "matcher": ["/chat/:path*", "/settings/:path*", "/knowledge-base/:path*"]}` registers the middleware below.

## 4. Routing Middleware (`snippets/proxy.ts`)

Vercel Routing Middleware works for non-Next frameworks. Install `npm install @vercel/functions` (provides `next()`).

- Build a Supabase server client from the request cookies (`createServerClient`, `parseCookieHeader`), call `auth.getUser()`, collect the cookies from `setAll` and append each as a `Set-Cookie` header with `serializeCookieHeader`.
- Signed out: `302` to `/auth`. Signed in: `next({ headers })` so refreshed cookies reach the browser.
- Match only the private pages. Never match `/auth`, `/reset-password`, `/api` or static files, or you create redirect loops and extra cost.
- The docs say it also runs under `vercel dev`, so test it locally first.

## 5. Connect Git and deploy

1. Push the repository to GitHub (one branch per step, merge commits into `main`).
2. Vercel dashboard > project > **Settings > Git > Connect Repository**, production branch `main`.
3. Every merge to `main` now deploys. Pull-request branches get Preview deployments.
4. Supabase > Authentication > URL Configuration: Site URL = the production URL, Redirect URLs include `<prod-url>/**`.

## 6. Verify the live site (use a private/incognito window)

- Signed out, open `<prod-url>/chat`: you land on `/auth`.
- Sign in with the test account: chat answers, markdown tables render, a refreshed page keeps the conversation.
- Upload the sample document, ask for one of its facts: the reply cites the file.
- Hard refresh on `/chat` and `/settings`: no 404.
- Password reset: the email link opens the production domain and the new-password form.
- `npx vercel env ls` shows each variable for every environment; no secret appears in the repository (`git grep -i "sk-"` should be empty).

## Gotchas

- **`EPERM: operation not permitted, symlink` on Windows:** the CLI's builder cache uses symlinks. Turn on Developer Mode (Settings > System > For developers) or run the shell as administrator.
- **`'vite' is not recognized`:** you ran `vercel dev` from a parent folder. It links a new project there and writes `.env.local` with pulled secrets. Always run it inside the project and delete the stray `.vercel` and `.env.local` above it.
- **Blank page under `vercel dev` (404 for `/src/main.tsx`, `/@vite/client`):** a catch-all rewrite swallowed Vite's dev URLs. Exclude them as in `vercel.json` above.
- **A function variable is "not set" locally:** the pulled `.env.local` is a snapshot, and Secret/Sensitive variables may not reach functions under `vercel dev`. Re-run `vercel env pull` after changing variables, restart, and keep local values in a gitignored `.env`.
- **A throwing function takes the dev server down:** wrap handlers in try/catch and return JSON.
- **Two lockfiles:** a leftover `bun.lockb` can make Vercel install with bun. Keep only `package-lock.json`.
- **Do not connect Git before the project builds.** Every push would trigger failing deployments (and without variables the build has nothing to read).
- **Free-tier limits:** Hobby functions cap at 60 s; the built-in Supabase mailer is rate limited; free OpenRouter models are rate limited. Plan fallbacks.
- **If an ESM import fails in production** (`ERR_MODULE_NOT_FOUND` with `"type": "module"`): add the `.js` extension to relative imports inside `api/`.
