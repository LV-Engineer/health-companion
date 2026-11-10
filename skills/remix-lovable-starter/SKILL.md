---
name: remix-lovable-starter
description: Remix a Lovable project into your own workspace, connect it to GitHub, clone it, and strip the starter's committed secrets and Lovable-only backend. Use at the start of any task that begins from a Lovable project link.
---

# Remix a Lovable starter and take it local

Goal: end with the starter's code in **your** GitHub repository, cloned locally, with no committed secrets and no
dependency on Lovable's hosted backend. After this skill, Lovable is no longer part of the workflow.

## Prerequisites

- A Lovable account and a GitHub account. The project link in the brief is usually private.
- Credentials listed in a brief as "TEST ACCOUNT" are normally for the *app you build*, not for logging into Lovable.

## Steps

1. **Get access.** Open the project link while signed in to your own Lovable account. If it says "You don't have access",
   ask the owner for access using the **email of your Lovable account** (or an invite / remix-enabled link).
2. **Switch to your own workspace** (workspace dropdown, top left) and open the project link again. In someone else's
   workspace the *Remix* item is missing.
3. **Remix:** click the project name in the top bar, then **Remix this project**. Wait until the copy opens in your workspace.
4. **Do not use Lovable's AI chat afterwards.** It edits code and even creates test users on its own; from here on you
   work locally so Lovable and GitHub never diverge.
5. **Connect GitHub:** `More > Settings > Git` (wording varies), choose your GitHub account, **Create repository**.
   Pick a name; make it public or add the reviewers as collaborators.
6. **Clone and inspect**

   ```bash
   git clone https://github.com/<user>/<repo>.git
   cd <repo>
   ls -a
   cat package.json
   ```

   Identify: framework (Vite vs Next.js), backend (look for `supabase/functions`, a Lovable AI gateway URL such as
   `ai.gateway.lovable.dev`), hosted-project ids in `supabase/config.toml` and `.env`.
7. **Remove committed secrets/config** (branch `chore/security-env`):

   ```bash
   git switch -c chore/security-env
   git rm --cached .env
   printf '\n# env\n.env\n.env.*\n!.env.example\n' >> .gitignore   # PowerShell: Add-Content .gitignore "`n.env`n.env.*`n!.env.example"
   ```

   Create `.env.example` with the variable names only (no values) and commit both. The old `.env` stays in git history;
   check that it held only publishable values. Rotate anything that was a real secret.
8. **One package manager.** If both `bun.lockb` and `package-lock.json` exist, delete the one you do not use
   (`git rm bun.lockb`); a stray lockfile can make the host install with the wrong tool.
9. **Plan the replacement of the Lovable backend:** new Supabase project (skill `supabase-rls-ssr`), server routes on
   your host (skills `openrouter-forced-tool-call`, `knowledge-base-rag`), deploy (skill `vercel-deploy`).
10. **Remove dead code** once the new backend works: grep imports to find components nobody renders, mock data, pages
    that query tables your schema no longer has, "impersonate / switch user" menus, and the old Edge Functions.

## Verify

- `git ls-files | grep -i env` lists only `.env.example`.
- The repository is on your GitHub account and `git remote -v` points at it.
- You can run the app locally (`npm install`, then the dev script).

## Gotchas

- **"You don't have access" after login:** the owner has not granted your account; request access, do not create a new project.
- **No *Remix* item:** you are inside another workspace, or the owner disabled remixing. Switch workspace, or ask for Editor
  access / remixing enabled.
- **GitHub says "account mismatch" or "lost access":** the Lovable GitHub App was installed under an old username (for example
  after renaming the account). Uninstall the app on GitHub, use *Add account* in Lovable to install it again, then create the repository.
- **A GitHub username rename breaks the Lovable link:** the remix keeps pointing at the old owner. Create a fresh connection instead of "Reconnect".
- **`.env` is tracked in the starter.** It usually holds the hosted backend's URL and publishable key. Untrack it before anything else.
- **Leftover code is not harmless:** a broken `/admin` route or a menu that lists other users' profiles contradicts "no stub routes" and per-user isolation. Delete it.
