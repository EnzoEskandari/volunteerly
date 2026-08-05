import { z } from "zod";
import { createServiceRoleClient, getSessionUser } from "@/lib/supabase/server";
import { apiError, apiOk, serverError, unauthenticated, forbidden } from "@/lib/api";

const Body = z.object({ userId: z.string().uuid() });

/**
 * Removes a fraudulent account (spec §4).
 *
 * Deleting the auth user cascades through profiles and every dependent
 * row via the foreign keys in the schema — with one deliberate exception:
 * verified_hours can never be updated or deleted, so a removal that would
 * destroy another student's service record is refused rather than
 * silently failing against the immutability trigger.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  if (user.role !== "admin") return forbidden("Only administrators can remove accounts.");

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid", "That user reference wasn't valid.");
  const { userId } = parsed.data;

  if (userId === user.id) {
    return apiError("invalid", "You can't remove your own administrator account.");
  }

  try {
    const db = createServiceRoleClient();

    const { data: profile, error: profileErr } = await db
      .from("profiles")
      .select("id, role")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) return serverError("admin: fetch profile", profileErr);
    if (!profile) return apiError("not-found", "That account no longer exists.", 404);
    if (profile.role === "admin") {
      return forbidden("Administrator accounts can't be removed from here.");
    }

    // An organization that has issued verified hours can't be deleted —
    // doing so would erase students' permanent records. Suspend instead.
    if (profile.role === "organization") {
      const { count } = await db
        .from("verified_hours")
        .select("id", { count: "exact", head: true })
        .eq("org_id", userId);

      if ((count ?? 0) > 0) {
        return apiError(
          "forbidden",
          "This organization has verified hours on students' permanent records, so it can't be deleted. Suspend it instead.",
          409,
        );
      }
    }

    const { error } = await db.auth.admin.deleteUser(userId);
    if (error) return serverError("admin: delete user", error);

    return apiOk();
  } catch (err) {
    return serverError("admin: remove user", err);
  }
}
