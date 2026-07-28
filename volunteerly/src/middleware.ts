import { NextResponse, type NextRequest } from "next/server";

/**
 * Production role-based route protection.
 *
 * This build ships with NEXT_PUBLIC_USE_MOCK_DATA=true, so auth lives in
 * localStorage and route protection happens client-side via
 * <RequireRole> (see src/components/auth/require-role.tsx) — middleware
 * can't read localStorage during SSR.
 *
 * Once Supabase Auth is wired up (NEXT_PUBLIC_USE_MOCK_DATA=false), this
 * middleware becomes the real guard: it runs on the edge before any
 * /dashboard/* route renders, reads the Supabase session cookie via
 * @supabase/ssr, and redirects unauthenticated or wrong-role requests
 * before they ever reach the page. Uncomment the implementation below
 * once real Supabase credentials are in place.
 */
export function middleware(request: NextRequest) {
  return NextResponse.next();

  // ── Production implementation ─────────────────────────────────────
  // import { createServerClient } from "@supabase/ssr";
  //
  // let response = NextResponse.next({ request });
  // const supabase = createServerClient(
  //   process.env.NEXT_PUBLIC_SUPABASE_URL!,
  //   process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  //   {
  //     cookies: {
  //       get: (name) => request.cookies.get(name)?.value,
  //       set: (name, value, options) => response.cookies.set({ name, value, ...options }),
  //       remove: (name, options) => response.cookies.set({ name, value: "", ...options }),
  //     },
  //   },
  // );
  //
  // const { data: { session } } = await supabase.auth.getSession();
  // const path = request.nextUrl.pathname;
  //
  // if (path.startsWith("/dashboard") && !session) {
  //   return NextResponse.redirect(new URL("/login", request.url));
  // }
  //
  // const role = session?.user?.user_metadata?.role;
  // if (path.startsWith("/dashboard/student") && role !== "student") {
  //   return NextResponse.redirect(new URL("/", request.url));
  // }
  // if (path.startsWith("/dashboard/nonprofit") && role !== "organization") {
  //   return NextResponse.redirect(new URL("/", request.url));
  // }
  // if (path.startsWith("/dashboard/admin") && role !== "admin") {
  //   return NextResponse.redirect(new URL("/", request.url));
  // }
  //
  // return response;
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
