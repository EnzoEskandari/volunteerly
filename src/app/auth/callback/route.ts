import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Supabase redirects here after a Google sign-in, or after a student clicks
 * an email-confirmation link. Either way the profile row already exists by
 * the time we get here — the handle_new_user() trigger in schema.sql
 * creates it the moment auth.users gains a row, so this route only ever
 * reads state and decides where to send the browser next.
 *
 * Google sign-in is only offered on the student-facing login page, so a
 * first-time Google user is always provisioned as a student by that same
 * trigger — organizations always go through the explicit registration form
 * (EIN, category, etc. can't be inferred from a Google account).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) return NextResponse.redirect(`${origin}/login`);

  const supabase = createClient();
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !sessionData.session) return NextResponse.redirect(`${origin}/login`);

  const user = sessionData.session.user;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();

  if (profile?.role === "organization") {
    return NextResponse.redirect(`${origin}${next ?? "/dashboard/nonprofit"}`);
  }

  const { data: student } = await supabase
    .from("students")
    .select("onboarding_complete")
    .eq("id", user.id)
    .maybeSingle();

  if (student && !student.onboarding_complete) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}${next ?? "/dashboard/student"}`);
}
