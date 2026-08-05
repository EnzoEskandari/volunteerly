import { createServiceRoleClient, getSessionUser } from "@/lib/supabase/server";
import { apiError, apiOk, serverError, unauthenticated, forbidden } from "@/lib/api";
import { getStripe, isStripeConfigured, membershipLineItem } from "@/lib/stripe";

/**
 * Opens a real Stripe Checkout session for the student membership.
 *
 * Nothing about the account changes here. Membership is granted only by
 * the webhook, after Stripe confirms money actually moved — a button that
 * flips a flag on click is the failure mode this design exists to avoid.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthenticated();
  if (user.role !== "student") return forbidden("Memberships are for student accounts.");

  if (!isStripeConfigured()) {
    return apiError(
      "server-error",
      "Payments aren't configured on this deployment yet. Please try again shortly.",
      503,
    );
  }

  try {
    const db = createServiceRoleClient();
    const stripe = getStripe();

    const { data: student, error: studentErr } = await db
      .from("students")
      .select("id, full_name, membership_status, stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (studentErr) return serverError("checkout: fetch student", studentErr);
    if (!student) {
      console.error(`[volunteerly] checkout: no students row for auth id ${user.id}`);
      return apiError("not-found", "We couldn't find your student profile.", 404);
    }

    if (student.membership_status === "active" || student.membership_status === "waived") {
      return apiError("invalid", "Your membership is already active.");
    }

    // Reuse the Stripe customer across renewals so billing history stays
    // on one record.
    let customerId = student.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: student.full_name,
        metadata: { volunteerly_student_id: user.id },
      });
      customerId = customer.id;
      await db.from("students").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [membershipLineItem()],
      // Both of these are how the webhook ties the payment back to a
      // student without trusting anything the browser sends it.
      client_reference_id: user.id,
      subscription_data: { metadata: { volunteerly_student_id: user.id } },
      metadata: { volunteerly_student_id: user.id },
      success_url: `${siteUrl}/dashboard/student?membership=success`,
      cancel_url: `${siteUrl}/dashboard/student?membership=cancelled`,
      allow_promotion_codes: true,
      // Stripe's "Managed Payments" (on by default for newer accounts)
      // requires a tax code on every product unless explicitly disabled.
      // A flat membership fee has no tax complexity to model, so this
      // opts out rather than configuring Stripe Tax product codes.
      // Newer than the pinned SDK's TS types (v16), hence the cast.
      ...({ managed_payments: { enabled: false } } as Record<string, unknown>),
    });

    if (!session.url) return serverError("checkout: no session url", new Error("Stripe returned no URL"));

    return apiOk({ url: session.url });
  } catch (err) {
    return serverError("membership checkout", err);
  }
}
