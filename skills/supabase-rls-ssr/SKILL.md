---
name: supabase-rls-ssr
description: Stand up a Supabase backend for a Vite or SSR app: migrations, Row Level Security on every table scoped to auth.uid(), a private per-user Storage bucket, @supabase/ssr browser and server clients, protected routes, env vars. Use when a project needs per-user data and email/password auth.
---

# Supabase: schema, RLS, Storage and SSR auth

Goal: every table is isolated per user by RLS, the browser only ever holds the publishable key, and server code sees the
signed-in user through cookies.

Snippets (copy as-is, adjust names): `snippets/init.sql`, `browser-client.ts`, `server-client.ts`, `RequireAuth.tsx`.

## 1. Create the project and configure Auth

1. Supabase dashboard, **New project**: name, generated database password (store it in a password manager), nearest region.
2. **Authentication > Sign In / Providers > Email:** enabled. For development turn **Confirm email OFF**
   (see Gotchas: the built-in mailer is rate limited).
3. **Authentication > URL Configuration:** Site URL = your production URL; Redirect URLs = `<prod-url>/**`,
   `http://localhost:3000/**` (add other local ports you use).
4. **Project Settings > Data API (security):** keep *Enable Data API* ON, turn *Automatically expose new tables* OFF,
   turn *Enable automatic RLS* ON. Access is then granted explicitly in migrations.
5. Key names changed: **publishable key** = old `anon`, **secret key** = old `service_role`.

## 2. Environment variables

```text
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>      # public, protected by RLS
```

The secret key (old `service_role`) is **not needed** for this setup: RLS plus the user's cookie client cover every read and write.
If you ever add an admin task, keep the secret key server-only, never prefix it with `VITE_`, and never use it in a route that acts for a user. Commit `.env.example` (names only), never `.env`.

## 3. Migrations (never click tables together in the dashboard)

Put SQL in `supabase/migrations/<timestamp>_init.sql`. `snippets/init.sql` is a working example:

- tables for profiles, settings, chat sessions/messages, documents and text chunks, each with `user_id uuid references auth.users(id) on delete cascade`;
- **RLS on every table + one `for all` policy:** `using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)`.
  Wrapping `auth.uid()` in `(select ...)` lets Postgres evaluate it once per statement instead of once per row;
- explicit `grant select, insert, update, delete ... to authenticated` (needed because new tables are not exposed by default);
- `handle_new_user` trigger (`security definer`, `set search_path = ''`) that creates a profile row on sign-up;
- a private Storage bucket and a policy that requires the first path segment to be the user id:
  `(storage.foldername(name))[1] = (select auth.uid())::text`.

Apply and generate types:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push --remote
npx supabase gen types typescript --remote | Out-File -Encoding utf8 src/integrations/supabase/types.ts   # PowerShell
# bash: npx supabase gen types typescript --remote > src/integrations/supabase/types.ts
```

Create test users **after** the migration (the trigger only fires for new users), or backfill:

```sql
insert into public.profiles (user_id, email, display_name)
select id, email, split_part(email, '@', 1) from auth.users on conflict (user_id) do nothing;
```

## 4. Clients and routes

```bash
npm install @supabase/ssr
```

- **Browser:** `snippets/browser-client.ts` uses `createBrowserClient`. The session lives in cookies, so server code can read it.
- **Server (Vercel Function):** `snippets/server-client.ts` builds a per-request client with `createServerClient` and
  `parseCookieHeader`, and identifies the caller with `auth.getUser()`. **Never trust `getSession()` on the server**: it
  only reads the cookie, `getUser()` asks Supabase Auth to validate it.
- **Route guard:** `snippets/RequireAuth.tsx` is a layout route; wrap every private route once instead of redirecting per page.
- **Password reset:** the SSR client uses the PKCE flow, so the email link carries `?code=...`. Show the new-password form
  after the `PASSWORD_RECOVERY` event from `supabase.auth.onAuthStateChange`; do not look for `#type=recovery`.
- Keep display names editable and **show them** (user menu); an editable field shown nowhere is a half-finished feature.

## 5. Verify RLS isolation

1. Sign up two users (`you+t1@gmail.com`, `you+t2@gmail.com`).
2. User 1 creates data (a chat, an uploaded document). Sign in as user 2: none of it is visible in the UI.
3. Dashboard > Table Editor: every table shows *RLS enabled*; Storage bucket is private.
4. Dashboard > Advisors > Security: no warnings about tables without RLS.

## Gotchas

- **`supabase db push` fails with `ECONNREFUSED 127.0.0.1:54322`:** CLI 3.x targets the local Docker stack by default. Add `--remote`. `--linked` is deprecated.
- **Types come out almost empty:** you generated them before pushing the migration. Push first, then generate. Do it from PowerShell with `| Out-File -Encoding utf8` (plain `>` writes UTF-16 in Windows PowerShell 5.1).
- **`permission denied for table ...`:** the table was not exposed. Add explicit `grant`s in the migration.
- **Sign-up returns 429 / `over_email_send_rate_limit`:** *Confirm email* is on and the built-in mailer allows only a few messages per hour. Turn it off for development or create users in the dashboard with *Auto Confirm User*.
- **Sign-up returns `email_address_invalid`:** placeholder domains such as `example.com` are rejected. Use a real mailbox with a plus alias.
- **Every auth call returns 404 / "Unexpected end of JSON input":** `VITE_SUPABASE_URL` is empty, so requests hit your dev server. Vite reads `.env` only at start: restart the dev server after editing it.
- **Test user has no profile row:** it was created before the trigger existed. Backfill with the SQL above.
- **Lovable's generated `client.ts`** brokers the session through the editor with `postMessage`. Replace it completely.
- **Server code sees no user:** you used the in-memory/`localStorage` client in the browser. Use the cookie-based `createBrowserClient`.
