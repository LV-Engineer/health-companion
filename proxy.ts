import { next } from '@vercel/functions';
import {
  createServerClient,
  parseCookieHeader,
  serializeCookieHeader,
  type CookieOptions,
} from '@supabase/ssr';

// Vercel Routing Middleware (runs before the SPA is served; see "proxy" in vercel.json).
// It reads the Supabase session cookies, validates them with Supabase Auth, writes back any
// refreshed cookies, and sends signed-out visitors of the app pages to /auth.
type CookieToSet = { name: string; value: string; options: CookieOptions };

export default async function proxy(request: Request): Promise<Response> {
  const cookiesToSet: CookieToSet[] = [];

  const supabase = createServerClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () =>
          parseCookieHeader(request.headers.get('cookie') ?? '').map(({ name, value }) => ({
            name,
            value: value ?? '',
          })),
        setAll: (cookies) => {
          cookiesToSet.push(...cookies);
        },
      },
    },
  );

  // getUser() asks Supabase Auth to validate the token (and refreshes an expired one).
  // getSession() would only trust whatever is in the cookie.
  const { data } = await supabase.auth.getUser();

  const headers = new Headers();
  for (const { name, value, options } of cookiesToSet) {
    headers.append('Set-Cookie', serializeCookieHeader(name, value, options));
  }

  if (!data.user) {
    headers.set('Location', '/auth');
    return new Response(null, { status: 302, headers });
  }

  return next({ headers });
}
