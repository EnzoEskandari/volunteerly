import { z } from "zod";
import { createServiceRoleClient, getSessionUser } from "@/lib/supabase/server";
import { apiError, apiOk, serverError, unauthenticated, forbidden } from "@/lib/api";

const Body = z.object({
  reason: z.string().trim().min(10).max(1000),
  program: z.string().trim().max(200).optional(),
});

/**
 * Need-based fee waiver request (spec §6).
 *
 * Cost must never be the reason a student can't record their service
 * hours, so this is self-serve: the student states their situation and an
 * administrator decides. Approval is handled in the admin route, which is
 * the only path that can set membership_status to 'waived'.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  if (user.role !== "student") return forbidden("Fee waivers are for student accounts.");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("invalid", "Please tell us a little about why you're requesting a waiver.");
  }

  try {
    const db = createServiceRoleClient();

    const { data: student, error: studentErr } = await db
      .from("students")
      .select("membership_status")
      .eq("id", user.id)
      .maybeSingle();

    if (studentErr) return serverError("waiver: fetch student", studentErr);
    if (!student) return apiError("not-found", "We couldn't find your student profile.", 404);
    if (student.membership_status === "waived") {
      return apiError("invalid", "Your membership fee is already waived.");
    }
    if (student.membership_status === "active") {
      return apiError("invalid", "You already have an active paid membership.");
    }

    const { data: pending, error: pendingErr } = await db
      .from("membership_waiver_requests")
      .select("id")
      .eq("student_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingErr) return serverError("waiver: check pending", pendingErr);
    if (pending) {
      return apiError("duplicate", "You already have a waiver request under review.", 409);
    }

    const { error } = await db.from("membership_waiver_requests").insert({
      student_id: user.id,
      reason: parsed.data.reason,
      program: parsed.data.program ?? null,
      status: "pending",
    });

    if (error) return serverError("waiver: insert", error);

    return apiOk({ status: "pending" });
  } catch (err) {
    return serverError("waiver", err);
  }
}
