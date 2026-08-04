import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client, for use inside client components.
 *
 * Reads go through this client and are filtered by row-level security, so a
 * signed-in user only ever receives rows the policies in
 * /supabase/schema.sql allow them to see.
 *
 * Writes that a user could benefit from lying about — joining an event,
 * checking in, verifying hours, membership status — deliberately have no
 * client-side path at all. Those go to the route handlers under
 * src/app/api, which validate first and then write with the service role.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY. See README.md for setup.",
    );
  }

  return createBrowserClient(url, anonKey);
}
