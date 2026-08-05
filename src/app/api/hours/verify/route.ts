import { z } from "zod";
import { createServiceRoleClient, getSessionUser } from "@/lib/supabase/server";
import { apiError, apiOk, serverError, unauthenticated, forbidden } from "@/lib/api";
import { earnedAchievementKeys } from "@/lib/achievements";

const Body = z.object({
  studentId: z.string().uuid(),
  opportunityId: z.string().uuid(),
  hours: z.number().positive().max(24),
  activityDescription: z.string().trim().min(5).max(2000),
  supervisor: z.string().trim().min(2).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Hour verification (spec §5.6 and §8).
 *
 * This is the record the whole product exists to produce, so it is the
 * strictest endpoint here. What sets Volunteerly's verified hours apart
 * from a running total (the gap called out against Vome) is that every
 * entry names a real supervisor, carries a written activity description,
 * and is locked the moment it is written.
 *
 * Immutability is enforced in the database itself — verified_hours has no
 * update or delete policy and a trigger that raises on either — so this
 * route can only ever append.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  if (user.role !== "organization") {
    return forbidden("Only the hosting organization can verify service hours.");
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error?.issues[0];
    return apiError(
      "invalid",
      first?.message
        ? `Please check the form: ${first.path.join(".")} — ${first.message.toLowerCase()}.`
        : "Please fill in every field before verifying.",
    );
  }
  const { studentId, opportunityId, hours, activityDescription, supervisor, date } = parsed.data;

  try {
    const db = createServiceRoleClient();

    // The caller must own the event they're verifying against.
    const { data: opp, error: oppErr } = await db
      .from("volunteer_opportunities")
      .select("id, org_id, title, category")
      .eq("id", opportunityId)
      .maybeSingle();

    if (oppErr) return serverError("verify: fetch opportunity", oppErr);
    if (!opp) return apiError("not-found", "That opportunity no longer exists.", 404);
    if (opp.org_id !== user.id) {
      return forbidden("You can only verify hours for your own events.");
    }

    // …and the student must actually have attended it. Verifying hours for
    // someone who never checked in is exactly the fraud this record has to
    // be resistant to.
    const { data: reg, error: regErr } = await db
      .from("volunteer_registrations")
      .select("id, status")
      .eq("student_id", studentId)
      .eq("opportunity_id", opportunityId)
      .maybeSingle();

    if (regErr) return serverError("verify: fetch registration", regErr);
    if (!reg) {
      return apiError("forbidden", "That student isn't registered for this event.", 403);
    }
    if (reg.status !== "attended") {
      return apiError(
        "forbidden",
        "This student hasn't checked in to the event yet, so their hours can't be verified.",
        403,
      );
    }

    const { data: existing, error: existingErr } = await db
      .from("verified_hours")
      .select("id")
      .eq("student_id", studentId)
      .eq("opportunity_id", opportunityId)
      .maybeSingle();

    if (existingErr) return serverError("verify: check existing hours", existingErr);
    if (existing) {
      return apiError(
        "duplicate",
        "Hours have already been verified for this student at this event. Verified entries are permanent and can't be edited.",
        409,
      );
    }

    // One INSERT creates the record and its certificate together: the
    // number comes from a database DEFAULT on this same row, so a verified
    // entry without a certificate isn't a state that can exist. Nothing
    // here has to remember to issue one.
    //
    // That column is also UNIQUE. A collision is astronomically unlikely
    // (12 CSPRNG characters over a 32-symbol alphabet), but if one ever
    // occurred the right outcome is a fresh number — not a failed
    // verification the organization has to puzzle over. Hence the retry.
    const row = {
      student_id: studentId,
      opportunity_id: opportunityId,
      org_id: user.id,
      hours,
      activity_description: activityDescription,
      supervisor,
      date,
    };

    type InsertedRow = { id: string; verified_at: string; certificate_number: string };

    let inserted: InsertedRow | null = null;
    let insertErr: unknown = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await db
        .from("verified_hours")
        .insert(row)
        .select("id, verified_at, certificate_number")
        .single();

      if (!result.error) {
        inserted = result.data as InsertedRow;
        break;
      }

      insertErr = result.error;
      // 23505 = unique_violation. Anything else won't fix itself on retry.
      if ((result.error as { code?: string }).code !== "23505") break;
      console.warn("[volunteerly] certificate number collision — retrying");
    }

    if (!inserted) return serverError("verify: insert hours", insertErr);

    // students.total_verified_hours is recomputed by the sync_student_hours
    // trigger, so it can never drift from the underlying records.

    await awardAchievements(db, studentId);

    const { data: org } = await db.from("organizations").select("name").eq("id", user.id).single();

    await db.from("notifications").insert({
      user_id: studentId,
      audience: "student",
      type: "hour-verified",
      title: `${hours} hours verified by ${org?.name ?? "an organization"}`,
      body:
        `Your service at ${opp.title} is now part of your permanent record. ` +
        `Certificate ${inserted.certificate_number} has been issued.`,
      link: "/dashboard/student/transcript",
    });

    return apiOk({
      id: inserted.id,
      verifiedAt: inserted.verified_at,
      certificateNumber: inserted.certificate_number,
    });
  } catch (err) {
    return serverError("verify", err);
  }
}

/**
 * Recomputes which badges a student has earned and inserts any new ones.
 * Derived entirely from verified records, so a badge can never appear
 * without the hours behind it.
 */
async function awardAchievements(db: ReturnType<typeof createServiceRoleClient>, studentId: string) {
  const { data: rows } = await db
    .from("verified_hours")
    .select("hours, org_id, opportunity_id, volunteer_opportunities(category)")
    .eq("student_id", studentId);

  if (!rows?.length) return;

  const totalHours = rows.reduce((sum, r: any) => sum + Number(r.hours ?? 0), 0);
  const distinctOrgCount = new Set(rows.map((r: any) => r.org_id)).size;
  const hoursByCategory: Record<string, number> = {};
  for (const r of rows as any[]) {
    const category = r.volunteer_opportunities?.category;
    if (category) hoursByCategory[category] = (hoursByCategory[category] ?? 0) + Number(r.hours ?? 0);
  }

  const { data: student } = await db
    .from("students")
    .select("volunteer_streak_weeks")
    .eq("id", studentId)
    .single();

  const keys = earnedAchievementKeys({
    totalHours,
    distinctOrgCount,
    eventCount: rows.length,
    hoursByCategory,
    streakWeeks: student?.volunteer_streak_weeks ?? 0,
  });

  if (keys.length === 0) return;

  await db
    .from("student_achievements")
    .upsert(
      keys.map((key) => ({ student_id: studentId, achievement_key: key })),
      { onConflict: "student_id,achievement_key", ignoreDuplicates: true },
    );
}
