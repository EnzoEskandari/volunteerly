import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createRawClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Server Supabase client for Server Components, Route Handlers and Server
 * Actions. Reads/writes the auth cookie via next/headers, and is still
 * subject to row-level security — it acts *as the signed-in user*.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Called from a Server Component — safe to ignore, middleware
            // is refreshing the session on the same request.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // See note above.
          }
        },
      },
    },
  );
}

/**
 * Privileged client that bypasses row-level security. This is the only way
 * to write the tables users aren't trusted with — registrations, attendance,
 * verified hours, membership status — and it must never be imported from a
 * client component. Every caller is expected to have already authenticated
 * and authorized the request itself.
 */
export function createServiceRoleClient(): SupabaseClient {
  return createRawClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Resolves the caller from the request cookie and confirms their role from
 * the profiles table rather than trusting client-supplied metadata.
 * Returns null when nobody is signed in.
 */
export async function getSessionUser(): Promise<{ id: string; email: string; role: "student" | "organization" | "admin" } | null> {
  const supabase = createClient();

  // getUser() revalidates the JWT with Supabase — unlike getSession(),
  // which trusts whatever is in the cookie.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, email")
    .eq("id", user.id)
    .single();

  if (!profile) return null;
  return { id: user.id, email: profile.email ?? user.email ?? "", role: profile.role };
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. Volunteerly talks to a real shared database — ` +
        `copy .env.example to .env.local and fill in your Supabase project credentials. See README.md.`,
    );
  }
  return value;
}
