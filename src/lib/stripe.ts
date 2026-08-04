import Stripe from "stripe";
import { MEMBERSHIP_CURRENCY, MEMBERSHIP_INTERVAL, MEMBERSHIP_PRICE_CENTS } from "./pricing";

/**
 * Stripe powers exactly one thing: the student membership (spec §6).
 *
 * Students pay a small annual fee to join opportunities, check in, and
 * receive verified hours. Browsing and creating a profile stay free.
 *
 * Organizations are never charged — not now, and not at some future tier.
 * That is a deliberate product commitment (§6, §8): organizations supply
 * the opportunities that make the platform worth anything, and every
 * competitor that put a paywall on that side is one this product is
 * meant to beat. There is no org billing code here because there is no
 * org billing.
 *
 * Server-side only. Never import this from a client component.
 */
export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "STRIPE_SECRET_KEY is not set. Membership checkout needs real Stripe credentials — " +
        "see the Stripe section of README.md.",
    );
  }
  return new Stripe(key, { apiVersion: "2024-06-20", typescript: true });
}

/** True when Stripe is configured well enough to open a checkout session. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * The recurring item a membership checkout bills.
 *
 * Preferred: set STRIPE_MEMBERSHIP_PRICE_ID to a Price you created in the
 * Stripe dashboard — that keeps pricing changes in Stripe where they
 * belong. Without it, an inline price is built from src/lib/pricing.ts so
 * the flow still works on a fresh account.
 */
export function membershipLineItem(): Stripe.Checkout.SessionCreateParams.LineItem {
  const priceId = process.env.STRIPE_MEMBERSHIP_PRICE_ID;
  if (priceId) return { price: priceId, quantity: 1 };

  return {
    quantity: 1,
    price_data: {
      currency: MEMBERSHIP_CURRENCY,
      unit_amount: MEMBERSHIP_PRICE_CENTS,
      recurring: { interval: MEMBERSHIP_INTERVAL },
      product_data: {
        name: "Volunteerly Student Membership",
        description:
          "Join volunteer opportunities, check in by QR code, and receive verified service hours.",
      },
    },
  };
}
