import { createServerClient, parseCookieHeader } from '@supabase/ssr';
import type { Database } from '../../src/integrations/supabase/types';

// Per-request Supabase client for Vercel Functions. It reads the session cookies
// the browser client set, so queries run as the signed-in user and RLS applies.
// Read-only: a function never needs to refresh the cookie, the browser does that.
export function createUserClient(request: Request) {
  const cookieHeader = request.headers.get('cookie') ?? '';
  return createServerClient<Database>(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () =>
          parseCookieHeader(cookieHeader).map(({ name, value }) => ({ name, value: value ?? '' })),
        setAll: () => {},
      },
    },
  );
}

export async function requireUser(request: Request) {
  const supabase = createUserClient(request);
  // getUser() validates the token with Supabase Auth; never trust getSession() on the server.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}
