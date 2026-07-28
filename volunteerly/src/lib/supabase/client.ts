import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Use inside client components ("use client").
 *
 * This is only reached when NEXT_PUBLIC_USE_MOCK_DATA=false — see
 * src/lib/data-service.ts, which is the single seam the rest of the app
 * calls through. Swapping from mock data to production Supabase means
 * implementing the same function signatures in data-service.ts using
 * queries like:
 *
 *   const supabase = createClient();
 *   const { data, error } = await supabase
 *     .from("volunteer_opportunities")
 *     .select("*, organizations(name, logo_url)")
 *     .eq("status", "open");
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
