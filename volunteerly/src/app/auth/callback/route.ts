import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Supabase redirects here after a successful Google sign-in. Google sign-in
// in this app is only offered on the student-facing login page, so a
// first-time Google user is always provisioned as a student — organizations
// always go through the explicit registration form (EIN, category, etc.
// can't be inferred from a Google account).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) return NextResponse.redirect(`${origin}/login`);

  const supabase = createClient();
  const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !sessionData.session) return NextResponse.redirect(`${origin}/login`);

  const user = sessionData.session.user;
  const { data: existingProfile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();

  if (!existingProfile) {
    const fullName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "Student") as string;
    await supabase.from("profiles").insert({ id: user.id, email: user.email, role: "student" });
    await supabase.from("students").insert({
      id: user.id,
      full_name: fullName,
      interests: [],
      skills: [],
      languages: [],
      available_days: [],
      available_times: [],
      travel_distance_miles: 10,
      virtual_preference: "both",
      transportation: false,
      onboarding_complete: false,
      total_verified_hours: 0,
      volunteer_streak_weeks: 0,
      membership_active: false,
    });
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  const { data: student } = await supabase.from("students").select("onboarding_complete").eq("id", user.id).maybeSingle();
  return NextResponse.redirect(`${origin}${student && !student.onboarding_complete ? "/onboarding" : "/"}`);
}
