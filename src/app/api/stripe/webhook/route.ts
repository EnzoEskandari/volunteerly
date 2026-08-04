import type Stripe from "stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

/**
 * The only place a membership becomes active.
 *
 * Stripe is the source of truth for whether someone paid, so membership
 * state is written here — after verifying the signature — and nowhere
 * else. The client cannot grant itself access by calling anything.
 *
 * Renewals, failed payments and cancellations all flow through here too,
 * which is what keeps the renewal date shown on the student's dashboard
 * honest rather than a date we invented at signup.
 */

// Stripe signature verification needs the raw body, so this route must not
// run on the edge runtime (which would hand us a parsed body).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[volunteerly] STRIPE_WEBHOOK_SECRET is not set — refusing to process webhook.");
    return new Response("Webhook not configured", { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    // An unverifiable payload is either misconfiguration or someone
    // pretending to be Stripe. Either way it never touches the database.
    console.error("[volunteerly] Stripe signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const db = createServiceRoleClient();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Only a paid session grants access — an unpaid one means the
        // customer reached the success URL without completing payment.
        if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") break;

        const studentId = await resolveStudentId(db, session.client_reference_id, session.customer);
        if (!studentId) break;

        const stripe = getStripe();
        const subscriptionId =
          typeof session.subscription === "string" ? session.subscription : session.subscription?.id;

        let periodEnd: string | null = null;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          periodEnd = toDate(sub.current_period_end);
        }

        await db
          .from("students")
          .update({
            membership_status: "active",
            membership_expires_at: periodEnd,
            stripe_subscription_id: subscriptionId ?? null,
            stripe_customer_id: typeof session.customer === "string" ? session.customer : undefined,
          })
          .eq("id", studentId);

        await recordPayment(db, {
          studentId,
          eventId: event.id,
          invoiceId: typeof session.invoice === "string" ? session.invoice : null,
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? "usd",
          periodEnd,
        });

        await notify(db, studentId, {
          title: "Your Volunteerly membership is active",
          body: periodEnd
            ? `You can now join opportunities, check in by QR code, and receive verified hours. Renews ${periodEnd}.`
            : "You can now join opportunities, check in by QR code, and receive verified hours.",
        });
        break;
      }

      // Renewal succeeded — push the expiry date forward.
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const studentId = await resolveStudentId(db, null, invoice.customer);
        if (!studentId) break;

        const periodEnd = toDate(invoice.lines.data[0]?.period?.end);

        await db
          .from("students")
          .update({ membership_status: "active", membership_expires_at: periodEnd })
          .eq("id", studentId);

        await recordPayment(db, {
          studentId,
          eventId: event.id,
          invoiceId: invoice.id,
          amountCents: invoice.amount_paid ?? 0,
          currency: invoice.currency ?? "usd",
          periodEnd,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const studentId = await resolveStudentId(db, null, invoice.customer);
        if (!studentId) break;

        await db.from("students").update({ membership_status: "past_due" }).eq("id", studentId);
        await notify(db, studentId, {
          title: "We couldn't renew your membership",
          body: "Your payment didn't go through. Update your payment details to keep joining opportunities.",
        });
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const studentId = await resolveStudentId(db, sub.metadata?.volunteerly_student_id, sub.customer);
        if (!studentId) break;

        // A subscription that's ending stays usable until the period runs
        // out, so access is not revoked the moment someone cancels.
        const status =
          sub.status === "active" || sub.status === "trialing"
            ? "active"
            : sub.status === "past_due" || sub.status === "unpaid"
              ? "past_due"
              : "cancelled";

        await db
          .from("students")
          .update({ membership_status: status, membership_expires_at: toDate(sub.current_period_end) })
          .eq("id", studentId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const studentId = await resolveStudentId(db, sub.metadata?.volunteerly_student_id, sub.customer);
        if (!studentId) break;

        await db
          .from("students")
          .update({ membership_status: "cancelled" })
          .eq("id", studentId)
          // Never downgrade someone whose fee was waived on a billing event.
          .neq("membership_status", "waived");
        break;
      }

      default:
        break;
    }

    return Response.json({ received: true });
  } catch (err) {
    // Returning 500 tells Stripe to retry; recordPayment is idempotent on
    // the event id, so a retry can't double-count.
    console.error(`[volunteerly] Webhook handler failed for ${event.type}:`, err);
    return new Response("Handler error", { status: 500 });
  }
}

/** Maps a Stripe payload back to a Volunteerly student. */
async function resolveStudentId(
  db: ReturnType<typeof createServiceRoleClient>,
  explicitId: string | null | undefined,
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): Promise<string | null> {
  if (explicitId) return explicitId;

  const customerId = typeof customer === "string" ? customer : customer?.id;
  if (!customerId) return null;

  const { data } = await db
    .from("students")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return data?.id ?? null;
}

async function recordPayment(
  db: ReturnType<typeof createServiceRoleClient>,
  input: {
    studentId: string;
    eventId: string;
    invoiceId: string | null;
    amountCents: number;
    currency: string;
    periodEnd: string | null;
  },
) {
  // stripe_event_id is unique, so Stripe's at-least-once delivery can't
  // produce duplicate rows.
  await db.from("membership_payments").upsert(
    {
      student_id: input.studentId,
      stripe_event_id: input.eventId,
      stripe_invoice_id: input.invoiceId,
      amount_cents: input.amountCents,
      currency: input.currency,
      period_end: input.periodEnd,
    },
    { onConflict: "stripe_event_id", ignoreDuplicates: true },
  );
}

async function notify(
  db: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  input: { title: string; body: string },
) {
  await db.from("notifications").insert({
    user_id: userId,
    audience: "student",
    type: "announcement",
    title: input.title,
    body: input.body,
    link: "/dashboard/student",
  });
}

function toDate(unixSeconds: number | null | undefined): string | null {
  if (!unixSeconds) return null;
  return new Date(unixSeconds * 1000).toISOString().slice(0, 10);
}
