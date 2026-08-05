import { ShieldCheck, Globe, Mail, Phone, MapPin, Building2 } from "lucide-react";
import { formatDate, formatTimeRange } from "@/lib/utils";
import type { ServiceCertificate } from "@/lib/types";

/**
 * The certificate document.
 *
 * Deliberately plain markup with no interactivity so it can be server
 * rendered, printed, or saved as a PDF without anything being lost. Every
 * claim on it is paired with the means to check that claim — the issuing
 * organization's tax ID and contact details, the named supervisor, the
 * exact attestation timestamp, and the serial number that resolves back
 * to this record.
 */
export function ServiceCertificateDocument({
  certificate,
  qrDataUrl,
  verifyUrl,
}: {
  certificate: ServiceCertificate;
  qrDataUrl: string | null;
  verifyUrl: string;
}) {
  const { student, organization, opportunity } = certificate;

  return (
    <article className="mx-auto w-full max-w-3xl bg-white text-navy-900 print:max-w-none">
      {/* Double rule reads as a document border in print as well as on screen */}
      <div className="border-4 border-double border-navy-900 p-8 sm:p-12 print:border-2">
        {/* ── Masthead ─────────────────────────────────────────────── */}
        <header className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-900 text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Volunteerly</span>
          </div>

          <h1 className="mt-6 font-display text-2xl font-bold uppercase tracking-[0.18em] sm:text-3xl">
            Certificate of Service
          </h1>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-navy-400">
            Verified Community Service Record
          </p>

          <div className="mx-auto mt-6 h-px w-24 bg-navy-200" />
        </header>

        {/* ── Attestation ──────────────────────────────────────────── */}
        <section className="mt-8 text-center">
          <p className="text-sm text-navy-500">This certifies that</p>
          <p className="mt-2 font-display text-3xl font-bold sm:text-4xl">{student.fullName}</p>
          {(student.school || student.gradYear) && (
            <p className="mt-1.5 text-sm text-navy-500">
              {student.school}
              {student.school && student.gradYear ? " · " : ""}
              {student.gradYear ? `Class of ${student.gradYear}` : ""}
            </p>
          )}

          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-navy-600">
            completed and had independently verified
            <span className="mx-1.5 font-display text-xl font-bold text-navy-900">
              {formatHourCount(certificate.hours)}
            </span>
            of community service with
            <span className="font-semibold text-navy-900"> {organization.name}</span>, attested by the
            organization named below.
          </p>
        </section>

        {/* ── Service detail ───────────────────────────────────────── */}
        <section className="mt-10">
          <SectionLabel>Service performed</SectionLabel>
          <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <Field label="Activity" value={opportunity.title} />
            <Field label="Category" value={opportunity.category} />
            <Field label="Date of service" value={formatDate(certificate.serviceDate)} />
            <Field
              label="Hours credited"
              value={formatHourCount(certificate.hours)}
            />
            <Field
              label="Location"
              value={opportunity.isVirtual ? "Virtual / remote" : opportunity.location}
            />
            {opportunity.startTime && opportunity.endTime && (
              <Field label="Scheduled time" value={formatTimeRange(opportunity.startTime, opportunity.endTime)} />
            )}
          </dl>

          <div className="mt-4">
            <FieldLabel>Description of work</FieldLabel>
            <p className="mt-1 text-sm leading-relaxed text-navy-700">{certificate.activityDescription}</p>
          </div>
        </section>

        {/* ── Who is vouching for this ─────────────────────────────── */}
        <section className="mt-10 rounded-xl bg-navy-50 p-5 print:bg-white print:ring-1 print:ring-navy-200">
          <SectionLabel>Verified by</SectionLabel>

          <p className="mt-3 flex items-center gap-2 font-display text-base font-semibold">
            <Building2 className="h-4 w-4 shrink-0 text-navy-400" />
            {organization.name}
          </p>

          <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
            <Field label="Supervisor" value={certificate.supervisor} />
            {/* Often the same person — printing the name twice reads as
                padding rather than corroboration. */}
            {organization.contactName && !sameName(organization.contactName, certificate.supervisor) && (
              <Field label="Organization contact" value={organization.contactName} />
            )}
            {organization.ein && <Field label="Tax ID (EIN)" value={organization.ein} mono />}
            <Field
              label="Attested"
              value={formatTimestamp(certificate.verifiedAt)}
            />
          </dl>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-navy-600">
            {organization.email && (
              <ContactLine icon={Mail}>{organization.email}</ContactLine>
            )}
            {organization.contactPhone && (
              <ContactLine icon={Phone}>{organization.contactPhone}</ContactLine>
            )}
            {organization.website && (
              <ContactLine icon={Globe}>{stripScheme(organization.website)}</ContactLine>
            )}
            {organization.location && (
              <ContactLine icon={MapPin}>{organization.location}</ContactLine>
            )}
          </div>
        </section>

        {/* ── Recipient of record ──────────────────────────────────── */}
        <section className="mt-6">
          <SectionLabel>Issued to</SectionLabel>
          <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2.5 sm:grid-cols-2">
            <Field label="Volunteer" value={student.fullName} />
            {student.email && <Field label="Email of record" value={student.email} />}
          </dl>
        </section>

        {/* ── Serial number + how to check it ──────────────────────── */}
        <footer className="mt-10 border-t-2 border-navy-900 pt-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <FieldLabel>Certificate number</FieldLabel>
              <p className="mt-1 font-mono text-base font-semibold tracking-wider text-navy-900">
                {certificate.certificateNumber}
              </p>

              <p className="mt-4 max-w-sm text-xs leading-relaxed text-navy-500">
                This record is stored permanently and cannot be edited or deleted after issue — not by
                the volunteer, and not by the organization. Anyone may confirm it independently at:
              </p>
              <p className="mt-1.5 break-all font-mono text-xs text-navy-700">{verifyUrl}</p>
            </div>

            {qrDataUrl && (
              <div className="shrink-0 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`QR code linking to the verification page for certificate ${certificate.certificateNumber}`}
                  width={104}
                  height={104}
                  className="rounded-lg border border-navy-200 p-1"
                />
                <p className="mt-1.5 text-[10px] uppercase tracking-wider text-navy-400">Scan to verify</p>
              </div>
            )}
          </div>
        </footer>
      </div>
    </article>
  );
}

// ── small presentational pieces ────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-navy-400">{children}</h2>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <dt className="text-[11px] uppercase tracking-wider text-navy-400">{children}</dt>;
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <dd className={`mt-0.5 text-sm text-navy-900 ${mono ? "font-mono" : "font-medium"}`}>{value}</dd>
    </div>
  );
}

function ContactLine({
  icon: Icon,
  children,
}: {
  icon: typeof Mail;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon className="h-3.5 w-3.5 shrink-0 text-navy-400" />
      {children}
    </span>
  );
}

/** "3 hours" / "1 hour" / "2.5 hours" — never "2.0 hours". */
function formatHourCount(hours: number): string {
  const n = hours % 1 === 0 ? String(hours) : hours.toFixed(1);
  return `${n} ${hours === 1 ? "hour" : "hours"}`;
}

/** Full timestamp including timezone — an attestation needs a when. */
function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC";
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/** Loose comparison — "Renee Ford" and "renee  ford" are the same person. */
function sameName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return norm(a) === norm(b);
}
