import Stripe from "stripe";

/**
 * Stripe is included in the stack per the technical spec but has no
 * required flows yet — Volunteerly's core loop (discover → join → verify)
 * is free for students and nonprofits. This client is scaffolded for the
 * likely future features it will power:
 *
 *   - Paid "Volunteerly Pro" tier for organizations (bulk QR codes,
 *     advanced analytics, priority placement in search)
 *   - Optional event insurance add-ons for high-risk activities
 *   - Donation pass-through so students can support a listed nonprofit
 *
 * Import this only in server-side code (Route Handlers / Server Actions).
 */
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2024-06-20",
  typescript: true,
});
