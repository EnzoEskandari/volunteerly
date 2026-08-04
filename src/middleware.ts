import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Server-side route protection.
 *
 * This runs before any /dashboard route renders, so an unauthenticated or
 * wrong-role request never reaches the page. It is a usability layer, not
 * the security boundary — row-level security and the API route handlers
 * are what actually protect the data. Someone bypassing the UI entirely
 * still cannot read or write anything they shouldn't.
 *
 * The role is read from the profiles table rather than from JWT metadata,
 * which a user can influence at sign-up.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without credentials there's no session to check; the app itself will
  // surface a clear configuration error rather than silently allowing access.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      get: (name: string) => request.cookies.get(name)?.value,
      set: (name: string, value: string, options: CookieOptions) => {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value, ...options });
      },
      remove: (name: string, options: CookieOptions) => {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({ request: { headers: request.headers } });
        response.cookies.set({ name, value: "", ...options });
      },
    },
  });

  // getUser() revalidates the token rather than trusting the cookie, and
  // refreshes it onto `response` as a side effect.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isDashboard = path.startsWith("/dashboard");
  const isCheckin = path.startsWith("/checkin");

  if (!user && (isDashboard || isCheckin)) {
    const redirect = new URL("/login", request.url);
    redirect.searchParams.set("next", path);
    return NextResponse.redirect(redirect);
  }

  if (user && isDashboard) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role;
    const home =
      role === "organization"
        ? "/dashboard/nonprofit"
        : role === "admin"
          ? "/dashboard/admin"
          : "/dashboard/student";

    const allowed =
      (path.startsWith("/dashboard/student") && role === "student") ||
      (path.startsWith("/dashboard/nonprofit") && role === "organization") ||
      (path.startsWith("/dashboard/admin") && role === "admin");

    if (!allowed) return NextResponse.redirect(new URL(home, request.url));
  }

  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/checkin/:path*"],
};
