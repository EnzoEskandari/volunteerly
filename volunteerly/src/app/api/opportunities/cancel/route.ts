import { z } from "zod";
import { createServiceRoleClient, getSessionUser } from "@/lib/supabase/server";
import { apiError, apiOk, serverError, unauthenticated } from "@/lib/api";

const Body = z.object({ registrationId: z.string().uuid() });

/**
 * Cancelling a registration frees the seat back up. Handled server-side
 * alongside join so the headcount has exactly one owner — see the
 * protect_opportunity_columns() trigger, which blocks anyone else from
 * touching current_volunteers.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("invalid", "That registration reference wasn't valid.");

  try {
    const db = createServiceRoleClient();

    const { data: reg } = await db
      .from("volunteer_registrations")
      .select("id, student_id, opportunity_id, status")
      .eq("id", parsed.data.registrationId)
      .maybeSingle();

    if (!reg) return apiError("not-found", "We couldn't find that registration.", 404);
    if (reg.student_id !== user.id) {
      return apiError("forbidden", "You can only cancel your own registration.", 403);
    }
    if (reg.status === "cancelled") return apiOk({ alreadyCancelled: true });
    if (reg.status === "attended") {
      return apiError("invalid", "You've already checked in to this event, so it can't be cancelled.");
    }

    const { error: cancelErr } = await db
      .from("volunteer_registrations")
      .update({ status: "cancelled" })
      .eq("id", reg.id);
    if (cancelErr) return serverError("cancel: update registration", cancelErr);

    const { data: opp } = await db
      .from("volunteer_opportunities")
      .select("current_volunteers, status")
      .eq("id", reg.opportunity_id)
      .single();

    if (opp) {
      await db
        .from("volunteer_opportunities")
        .update({
          current_volunteers: Math.max(0, opp.current_volunteers - 1),
          // A cancellation reopens a full event, but must not resurrect one
          // that was cancelled or has already finished.
          status: opp.status === "full" ? "open" : opp.status,
        })
        .eq("id", reg.opportunity_id);
    }

    return apiOk();
  } catch (err) {
    return serverError("cancel", err);
  }
}
