import { z } from "zod";
import { createServiceRoleClient, getSessionUser } from "@/lib/supabase/server";
import { apiError, apiOk, serverError, unauthenticated, forbidden } from "@/lib/api";

const Body = z.object({ opportunityId: z.string().uuid() });

/**
 * The join flow (spec §5.4).
 *
 * Tapping Join registers a student immediately — there is no application
 * and no approval step from the organization. What there *is* is a set of
 * conditions that must hold, every one of which is checked here rather
 * than in the browser, because each is something a student benefits from
 * bypassing: an active membership (§6), remaining capacity, minimum age,
 * and any required certifications.
 *
 * Capacity is settled by a conditional UPDATE rather than a read-then-write,
 * so two students racing for the last seat cannot both win it.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  if (user.role !== "student") {
    return forbidden("Only student accounts can join volunteer opportunities.");
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid", "That opportunity reference wasn't valid.");
  const { opportunityId } = parsed.data;

  try {
    const db = createServiceRoleClient();

    const { data: student, error: studentErr } = await db
      .from("students")
      .select("id, age, skills, membership_status, full_name")
      .eq("id", user.id)
      .single();
    if (studentErr || !student) return apiError("not-found", "We couldn't find your student profile.", 404);

    // ── Membership gate (spec §6: browsing is free, joining is not) ──────
    const active = student.membership_status === "active" || student.membership_status === "waived";
    if (!active) {
      return apiError(
        "membership-required",
        "Joining an opportunity requires an active Volunteerly membership.",
        402,
      );
    }

    const { data: opp, error: oppErr } = await db
      .from("volunteer_opportunities")
      .select(
        "id, org_id, title, status, max_volunteers, current_volunteers, min_age, required_certifications, date",
      )
      .eq("id", opportunityId)
      .single();
    if (oppErr || !opp) return apiError("not-found", "That opportunity no longer exists.", 404);

    if (opp.status === "cancelled") return apiError("not-eligible", "This event has been cancelled.");
    if (opp.status === "completed") return apiError("not-eligible", "This event has already taken place.");

    // ── Eligibility, with a specific reason on every rejection ───────────
    if (opp.min_age && (student.age ?? 0) < opp.min_age) {
      return apiError("not-eligible", `Volunteers for this event must be at least ${opp.min_age} years old.`);
    }

    const required: string[] = opp.required_certifications ?? [];
    if (required.length > 0) {
      const held: string[] = student.skills ?? [];
      const missing = required.filter(
        (c) => !held.some((s) => s.toLowerCase().includes(c.toLowerCase())),
      );
      if (missing.length > 0) {
        return apiError("not-eligible", `This event requires: ${missing.join(", ")}.`);
      }
    }

    const { data: existing } = await db
      .from("volunteer_registrations")
      .select("id, status")
      .eq("student_id", user.id)
      .eq("opportunity_id", opportunityId)
      .maybeSingle();

    if (existing && existing.status !== "cancelled") {
      return apiError("already-registered", "You're already registered for this event.");
    }

    // ── Claim a seat atomically ─────────────────────────────────────────
    // Only succeeds while current_volunteers is still below capacity, so
    // the last seat can be taken exactly once no matter the concurrency.
    const { data: claimed, error: claimErr } = await db
      .from("volunteer_opportunities")
      .update({ current_volunteers: opp.current_volunteers + 1 })
      .eq("id", opportunityId)
      .eq("current_volunteers", opp.current_volunteers)
      .lt("current_volunteers", opp.max_volunteers)
      .select("current_volunteers, max_volunteers")
      .maybeSingle();

    if (claimErr) return serverError("join: claim seat", claimErr);
    if (!claimed) {
      return apiError("capacity", "This event just filled up. Try another opportunity nearby.", 409);
    }

    // Re-registering after cancelling reuses the row (the table has a
    // unique constraint on student+opportunity).
    const registration = existing
      ? await db
          .from("volunteer_registrations")
          .update({ status: "registered", registered_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select("id")
          .single()
      : await db
          .from("volunteer_registrations")
          .insert({ student_id: user.id, opportunity_id: opportunityId, status: "registered" })
          .select("id")
          .single();

    if (registration.error) {
      // Give the seat back rather than leaving the count inflated.
      await db
        .from("volunteer_opportunities")
        .update({ current_volunteers: opp.current_volunteers })
        .eq("id", opportunityId);
      return serverError("join: insert registration", registration.error);
    }

    if (claimed.current_volunteers >= claimed.max_volunteers) {
      await db.from("volunteer_opportunities").update({ status: "full" }).eq("id", opportunityId);
    }

    await db.from("notifications").insert({
      user_id: opp.org_id,
      audience: "organization",
      type: "new-registration",
      title: "New volunteer registered",
      body: `${student.full_name} joined ${opp.title}.`,
      link: `/dashboard/nonprofit/opportunities/${opp.id}`,
    });

    return apiOk({ registrationId: registration.data.id });
  } catch (err) {
    return serverError("join", err);
  }
}
