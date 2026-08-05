import { z } from "zod";
import { createServiceRoleClient, getSessionUser } from "@/lib/supabase/server";
import { apiError, apiOk, serverError, unauthenticated, forbidden } from "@/lib/api";

const Body = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approved", "denied"]),
  note: z.string().trim().max(1000).optional(),
});

/** Approving a waiver is the only non-Stripe path to full membership. */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  if (user.role !== "admin") return forbidden("Only administrators can decide fee waivers.");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid", "That waiver decision wasn't valid.");
  const { requestId, decision, note } = parsed.data;

  try {
    const db = createServiceRoleClient();

    const { data: req, error: reqErr } = await db
      .from("membership_waiver_requests")
      .select("id, student_id, status")
      .eq("id", requestId)
      .maybeSingle();

    if (reqErr) return serverError("admin waiver: fetch request", reqErr);
    if (!req) return apiError("not-found", "That waiver request no longer exists.", 404);
    if (req.status !== "pending") {
      return apiError("invalid", "That waiver request has already been decided.");
    }

    const { error: updateErr } = await db
      .from("membership_waiver_requests")
      .update({ status: decision, decided_by: user.id, decided_at: new Date().toISOString() })
      .eq("id", requestId);

    if (updateErr) return serverError("waiver decide: update request", updateErr);

    if (decision === "approved") {
      // A waived membership doesn't expire — there's no renewal to track,
      // so membership_expires_at stays null and the UI shows it as waived
      // rather than inventing a date.
      const { error } = await db
        .from("students")
        .update({ membership_status: "waived", membership_expires_at: null })
        .eq("id", req.student_id);
      if (error) return serverError("waiver decide: grant", error);
    }

    await db.from("notifications").insert({
      user_id: req.student_id,
      audience: "student",
      type: "announcement",
      title: decision === "approved" ? "Your fee waiver was approved" : "Update on your fee waiver request",
      body:
        decision === "approved"
          ? "Your membership fee has been waived. You have full access to join opportunities and receive verified hours."
          : note?.trim()
            ? note
            : "An administrator has reviewed your request. Reach out if your circumstances change.",
      link: "/dashboard/student",
    });

    return apiOk({ decision });
  } catch (err) {
    return serverError("waiver decide", err);
  }
}
