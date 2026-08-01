/**
 * Single source of truth for "are we running on local mock data, or a real
 * Supabase backend?" Defaults to mock (true) so the app is always safe to
 * run with zero configuration — flipping NEXT_PUBLIC_USE_MOCK_DATA to
 * "false" in .env.local (and in Vercel's Environment Variables) switches
 * every read/write in src/lib/context/data-context.tsx and auth-context.tsx
 * over to real Postgres + Supabase Auth.
 */
export function isMockMode(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";
}
