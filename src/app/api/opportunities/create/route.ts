import { randomBytes } from "crypto";
import { z } from "zod";
import { createServiceRoleClient, getSessionUser } from "@/lib/supabase/server";
import { apiError, apiOk, serverError, unauthenticated, forbidden } from "@/lib/api";
import { CAUSE_CATEGORIES } from "@/lib/types";

const Body = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  category: z.enum(CAUSE_CATEGORIES as [string, ...string[]]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  location: z.string().trim().min(2).max(300),
  isVirtual: z.boolean().default(false),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  hoursAvailable: z.number().positive().max(24),
  maxVolunteers: z.number().int().positive().max(10000),
  minAge: z.number().int().min(0).max(120).optional(),
  certifications: z.array(z.string().trim().max(100)).max(20).default([]),
  backgroundCheck: z.boolean().default(false),
});

/**
 * Creates an opportunity and its check-in code in one step.
 *
 * The QR token is generated here, server-side, with crypto-grade
 * randomness — it is the sole proof of physical attendance, so it must not
 * be guessable. (Client-side ID helpers built on Math.random are fine for
 * React keys and wrong for this.)
 *
 * The code expires at the event's end time, per spec §5.5.
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  if (user.role !== "organization") {
    return forbidden("Only organizations can post volunteer opportunities.");
  }

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error?.issues[0];
    return apiError("invalid", first ? `${first.path.join(".")}: ${first.message}` : "Please check the form.");
  }
  const input = parsed.data;

  if (input.endTime <= input.startTime) {
    return apiError("invalid", "The end time needs to be after the start time.");
  }

  try {
    const db = createServiceRoleClient();

    // Posting is free and unlimited (spec §6) — the only gate is that the
    // organization has been approved by an admin.
    const { data: org, error: orgErr } = await db
      .from("organizations")
      .select("id, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (orgErr) return serverError("create opportunity: fetch organization", orgErr);
    if (!org) return apiError("not-found", "We couldn't find your organization profile.", 404);
    if (org.approval_status !== "approved") {
      return forbidden(
        org.approval_status === "pending"
          ? "Your organization is still awaiting approval. You'll be able to post as soon as that's done."
          : "Your organization isn't currently approved to post opportunities.",
      );
    }

    const { data: opp, error: oppErr } = await db
      .from("volunteer_opportunities")
      .insert({
        org_id: user.id,
        title: input.title,
        description: input.description,
        category: input.category,
        date: input.date,
        start_time: input.startTime,
        end_time: input.endTime,
        location: input.location,
        is_virtual: input.isVirtual,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        hours_available: input.hoursAvailable,
        max_volunteers: input.maxVolunteers,
        min_age: input.minAge ?? null,
        required_certifications: input.certifications,
        requires_background_check: input.backgroundCheck,
        status: "open",
      })
      .select("id")
      .single();

    if (oppErr || !opp) return serverError("create opportunity", oppErr);

    const { error: qrErr } = await db.from("qr_tokens").insert({
      opportunity_id: opp.id,
      token: randomBytes(24).toString("base64url"),
      expires_at: new Date(`${input.date}T${input.endTime}:00`).toISOString(),
    });

    if (qrErr) {
      // An event without a check-in code can't record attendance, so don't
      // leave a half-built listing behind.
      await db.from("volunteer_opportunities").delete().eq("id", opp.id);
      return serverError("create opportunity: qr token", qrErr);
    }

    return apiOk({ id: opp.id });
  } catch (err) {
    return serverError("create opportunity", err);
  }
}
