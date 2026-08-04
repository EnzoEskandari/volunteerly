import { z } from "zod";
import { createServiceRoleClient, getSessionUser } from "@/lib/supabase/server";
import { apiError, apiOk, serverError, unauthenticated, forbidden } from "@/lib/api";

const Body = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(5).max(5000),
  opportunityId: z.string().uuid().optional(),
});

/**
 * An organization posting an announcement to its registered volunteers
 * (spec §4, §5.8).
 *
 * Fanning the announcement out to individual notification rows happens
 * here because notifications are server-write-only — otherwise any account
 * could push a notification to any user, which is a phishing vector.
 * Recipients are the students actually registered for the org's events,
 * so this can't be used to message the whole platform.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  if (user.role !== "organization") return forbidden("Only organizations can post announcements.");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid", "Please add a title and a message.");
  const { title, body, opportunityId } = parsed.data;

  try {
    const db = createServiceRoleClient();

    if (opportunityId) {
      const { data: owned } = await db
        .from("volunteer_opportunities")
        .select("id")
        .eq("id", opportunityId)
        .eq("org_id", user.id)
        .maybeSingle();
      if (!owned) return forbidden("You can only post announcements about your own events.");
    }

    const { data: announcement, error } = await db
      .from("announcements")
      .insert({ org_id: user.id, title, body, opportunity_id: opportunityId ?? null })
      .select("id")
      .single();

    if (error) return serverError("announcement: insert", error);

    // Recipients: everyone currently registered for the named event, or
    // across all of this org's events when no event is specified.
    let query = db
      .from("volunteer_registrations")
      .select("student_id, volunteer_opportunities!inner(org_id)")
      .eq("volunteer_opportunities.org_id", user.id)
      .neq("status", "cancelled");

    if (opportunityId) query = query.eq("opportunity_id", opportunityId);

    const { data: registrations } = await query;

    const recipients = Array.from(new Set((registrations ?? []).map((r: any) => r.student_id)));

    if (recipients.length > 0) {
      const { data: org } = await db.from("organizations").select("name").eq("id", user.id).single();
      await db.from("notifications").insert(
        recipients.map((studentId) => ({
          user_id: studentId,
          audience: "student" as const,
          type: "announcement",
          title: `${org?.name ?? "An organization"}: ${title}`,
          body,
          link: opportunityId ? `/opportunities/${opportunityId}` : "/dashboard/student",
        })),
      );
    }

    return apiOk({ id: announcement.id, notified: recipients.length });
  } catch (err) {
    return serverError("announcement", err);
  }
}
