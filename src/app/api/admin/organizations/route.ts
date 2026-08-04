import { z } from "zod";
import { createServiceRoleClient, getSessionUser } from "@/lib/supabase/server";
import { apiError, apiOk, serverError, unauthenticated, forbidden } from "@/lib/api";

const Body = z.object({
  organizationId: z.string().uuid(),
  status: z.enum(["approved", "rejected", "suspended", "pending"]),
  reason: z.string().trim().max(1000).optional(),
});

/** Admin approval queue for organizations (spec §4). */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  if (user.role !== "admin") return forbidden("Only administrators can review organizations.");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid", "That approval decision wasn't valid.");
  const { organizationId, status, reason } = parsed.data;

  if ((status === "rejected" || status === "suspended") && !reason?.trim()) {
    return apiError("invalid", "Please give a reason — the organization sees this message.");
  }

  try {
    const db = createServiceRoleClient();

    const { data: org } = await db
      .from("organizations")
      .select("id, name")
      .eq("id", organizationId)
      .maybeSingle();

    if (!org) return apiError("not-found", "That organization no longer exists.", 404);

    const { error } = await db
      .from("organizations")
      .update({ approval_status: status, rejection_reason: reason ?? null })
      .eq("id", organizationId);

    if (error) return serverError("admin: set org approval", error);

    // Suspending an organization pulls its listings out of discovery so
    // students can't join events it can no longer be trusted to run.
    if (status === "suspended" || status === "rejected") {
      await db
        .from("volunteer_opportunities")
        .update({ status: "cancelled" })
        .eq("org_id", organizationId)
        .in("status", ["open", "full"]);
    }

    await db.from("notifications").insert({
      user_id: organizationId,
      audience: "organization",
      type: status === "approved" ? "org-approved" : "org-rejected",
      title:
        status === "approved"
          ? "Your organization is approved"
          : status === "suspended"
            ? "Your organization has been suspended"
            : "Your registration needs attention",
      body:
        status === "approved"
          ? "You're all set to publish volunteer opportunities on Volunteerly — free, with no limits."
          : (reason ?? "An administrator has reviewed your registration."),
      link: "/dashboard/nonprofit",
    });

    return apiOk({ status });
  } catch (err) {
    return serverError("admin: organizations", err);
  }
}
