/**
 * Certificate number parsing — pure, no I/O, safe to import from client
 * components. The database-backed lookup lives in src/lib/certificates.ts,
 * which is server-only.
 */

/** Certificate numbers as issued: VLY-2026-K7M2-P9XQ-3B7T */
export const CERTIFICATE_PATTERN =
  /^VLY-\d{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/;

export const CERTIFICATE_EXAMPLE = "VLY-2026-K7M2-P9XQ-3B7T";

/**
 * Accepts what a human actually types — lowercase, missing dashes, pasted
 * with stray spaces — and returns the canonical form, or null if it
 * couldn't possibly be a certificate number.
 *
 * The issuing alphabet has no I, L, O or U, so the classic transcription
 * slips are unambiguous and safe to repair rather than reject.
 */
export function normalizeCertificateNumber(input: string): string | null {
  const cleaned = input
    .trim()
    .toUpperCase()
    .replace(/[\s‐-―-]/g, "") // spaces and every flavour of dash
    .replace(/^VLY/, "")
    .replace(/[IL]/g, "1")
    .replace(/O/g, "0")
    .replace(/U/g, "V");

  // 4 year digits + 12 payload characters
  if (!/^\d{4}[0-9A-HJKMNP-TV-Z]{12}$/.test(cleaned)) return null;

  const year = cleaned.slice(0, 4);
  const body = cleaned.slice(4);
  const candidate = `VLY-${year}-${body.slice(0, 4)}-${body.slice(4, 8)}-${body.slice(8, 12)}`;

  return CERTIFICATE_PATTERN.test(candidate) ? candidate : null;
}
