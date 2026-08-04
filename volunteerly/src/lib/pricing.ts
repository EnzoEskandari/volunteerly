/**
 * Membership pricing — one source of truth.
 *
 * Spec §6 treats $5/year as a *starting* price that may be revisited, so
 * nothing downstream hardcodes the number: copy, the checkout session and
 * the pricing section all read from here, and the amount can be overridden
 * per-environment without touching code.
 *
 * The Stripe price object is the billing authority. MEMBERSHIP_PRICE_CENTS
 * exists so the UI can render a figure before checkout opens, and the
 * webhook reconciles against what Stripe actually charged.
 */

const parsedCents = Number(process.env.NEXT_PUBLIC_MEMBERSHIP_PRICE_CENTS);

export const MEMBERSHIP_PRICE_CENTS =
  Number.isFinite(parsedCents) && parsedCents > 0 ? Math.round(parsedCents) : 500;

export const MEMBERSHIP_CURRENCY = (process.env.NEXT_PUBLIC_MEMBERSHIP_CURRENCY ?? "usd").toLowerCase();

export const MEMBERSHIP_INTERVAL: "year" | "month" =
  process.env.NEXT_PUBLIC_MEMBERSHIP_INTERVAL === "month" ? "month" : "year";

/** e.g. "$5" — trims the ".00" that every whole-dollar price would carry. */
export function formatMembershipPrice(cents: number = MEMBERSHIP_PRICE_CENTS): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: MEMBERSHIP_CURRENCY.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
  return formatted;
}

/** e.g. "$5/year" */
export function membershipPriceLabel(): string {
  return `${formatMembershipPrice()}/${MEMBERSHIP_INTERVAL}`;
}

/**
 * Organizations are free forever, at every tier, with no limits — spec §6
 * and §8. This constant exists so the intent is greppable and so no future
 * change quietly introduces an org paywall.
 */
export const ORGANIZATIONS_ARE_FREE = true as const;
