import { z } from "zod";
import { createServiceRoleClient, getSessionUser } from "@/lib/supabase/server";
import { apiError, apiOk, serverError, unauthenticated, forbidden } from "@/lib/api";

const Body = z.object({ token: z.string().min(8).max(200) });

/**
 * QR check-in (spec §5.5).
 *
 * The scanned token arrives here as an opaque string and is resolved
 * server-side. Students have no read access to the qr_tokens table at all
 * (see the qr_select_own_org policy), which is what makes the code
 * meaningful: you cannot check in to an event without having physically
 * scanned the code the organization displayed.
 *
 * Three conditions are enforced: the code is real and unexpired, the
 * scanner is actually registered for that event, and they haven't already
 * checked in.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  if (user.role !== "student") return forbidden("Only students check in to events.");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid", "That doesn't look like a valid Volunteerly check-in code.");

  try {
    const db = createServiceRoleClient();

    const { data: qr } = await db
      .from("qr_tokens")
      .select("opportunity_id, token, expires_at")
      .eq("token", parsed.data.token)
      .maybeSingle();

    if (!qr) return apiError("not-found", "This check-in code isn't recognized.", 404);

    if (new Date(qr.expires_at).getTime() < Date.now()) {
      return apiError("expired", "This check-in code has expired — the event has already ended.", 410);
    }

    const { data: membership } = await db
      .from("students")
      .select("membership_status, full_name")
      .eq("id", user.id)
      .single();

    const active =
      membership?.membership_status === "active" || membership?.membership_status === "waived";
    if (!active) {
      return apiError(
        "membership-required",
        "Checking in requires an active Volunteerly membership.",
        402,
      );
    }

    const { data: reg } = await db
      .from("volunteer_registrations")
      .select("id, status")
      .eq("student_id", user.id)
      .eq("opportunity_id", qr.opportunity_id)
      .maybeSingle();

    if (!reg || reg.status === "cancelled") {
      return apiError("forbidden", "You aren't registered for this event.", 403);
    }

    const { data: alreadyIn } = await db
      .from("attendance_records")
      .select("id")
      .eq("registration_id", reg.id)
      .maybeSingle();

    if (alreadyIn) {
      return apiError("duplicate", "You've already checked in to this event.", 409);
    }

    const scannedAt = new Date().toISOString();
    const { error: insertErr } = await db.from("attendance_records").insert({
      registration_id: reg.id,
      opportunity_id: qr.opportunity_id,
      student_id: user.id,
      qr_token_used: qr.token,
      scanned_at: scannedAt,
    });

    // The unique constraint on registration_id is the real guard against a
    // double scan; two rapid taps land here rather than creating two rows.
    if (insertErr) {
      if ((insertErr as { code?: string }).code === "23505") {
        return apiError("duplicate", "You've already checked in to this event.", 409);
      }
      return serverError("checkin: insert attendance", insertErr);
    }

    await db.from("volunteer_registrations").update({ status: "attended" }).eq("id", reg.id);

    const { data: opp } = await db
      .from("volunteer_opportunities")
      .select("title, org_id")
      .eq("id", qr.opportunity_id)
      .single();

    if (opp) {
      await db.from("notifications").insert({
        user_id: opp.org_id,
        audience: "organization",
        type: "attendance",
        title: "Attendance recorded",
        body: `${membership?.full_name ?? "A volunteer"} checked in to ${opp.title}.`,
        link: `/dashboard/nonprofit/opportunities/${qr.opportunity_id}`,
      });
    }

    return apiOk({ opportunityId: qr.opportunity_id, title: opp?.title ?? null, scannedAt });
  } catch (err) {
    return serverError("checkin", err);
  }
}
