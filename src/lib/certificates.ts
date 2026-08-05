import { createServiceRoleClient } from "@/lib/supabase/server";
import { normalizeCertificateNumber } from "@/lib/certificate-number";
import type { ServiceCertificate } from "@/lib/types";

/**
 * Certificate lookup. SERVER-ONLY — imports the service-role client, so
 * importing this from a client component will break the build. Parsing
 * helpers live in @/lib/certificate-number, which is safe on both sides.
 *
 * The public /verify page has no signed-in user to scope reads against, so
 * this runs with the service role and returns a deliberately narrow,
 * hand-assembled object rather than raw rows. Nothing reaches the page that
 * isn't printed on the certificate itself.
 */

/**
 * Fetches the certificate for a number, or null if no such record exists.
 *
 * A null return is the honest answer to "is this real?" — it means no
 * verified entry carries that number, and the page says exactly that
 * rather than implying the lookup merely failed.
 */
export async function fetchCertificate(certificateNumber: string): Promise<ServiceCertificate | null> {
  const normalized = normalizeCertificateNumber(certificateNumber);
  if (!normalized) return null;

  const db = createServiceRoleClient();

  const { data, error } = await db
    .from("verified_hours")
    .select(
      `certificate_number, hours, activity_description, supervisor, date, verified_at,
       students ( full_name, school, grad_year, profiles ( email ) ),
       organizations ( name, ein, website, location, contact_name, contact_phone, profiles ( email ) ),
       volunteer_opportunities ( title, category, location, is_virtual, date, start_time, end_time )`,
    )
    .eq("certificate_number", normalized)
    .maybeSingle();

  if (error) {
    console.error("[volunteerly] certificate lookup failed:", error);
    return null;
  }
  if (!data) return null;

  const row = data as any;
  const student = row.students;
  const org = row.organizations;
  const opp = row.volunteer_opportunities;

  // A certificate missing its counterparties can't be presented as valid.
  if (!student || !org || !opp) {
    console.error(`[volunteerly] certificate ${normalized} is missing joined records`);
    return null;
  }

  return {
    certificateNumber: row.certificate_number,
    hours: Number(row.hours),
    activityDescription: row.activity_description,
    supervisor: row.supervisor,
    serviceDate: row.date,
    verifiedAt: row.verified_at,

    student: {
      fullName: student.full_name,
      email: student.profiles?.email ?? "",
      school: student.school ?? undefined,
      gradYear: student.grad_year ?? undefined,
    },

    organization: {
      name: org.name,
      email: org.profiles?.email ?? "",
      ein: org.ein ?? undefined,
      website: org.website ?? undefined,
      location: org.location ?? undefined,
      contactName: org.contact_name ?? undefined,
      contactPhone: org.contact_phone ?? undefined,
    },

    opportunity: {
      title: opp.title,
      category: opp.category,
      location: opp.location,
      isVirtual: opp.is_virtual,
      date: opp.date,
      startTime: opp.start_time ?? undefined,
      endTime: opp.end_time ?? undefined,
    },
  };
}

/** Absolute URL a third party can visit to check a certificate. */
export function certificateUrl(certificateNumber: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/verify/${certificateNumber}`;
}
