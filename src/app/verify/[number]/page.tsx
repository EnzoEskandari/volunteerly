import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";
import { ShieldCheck, ShieldX, HeartHandshake } from "lucide-react";
import { fetchCertificate, certificateUrl } from "@/lib/certificates";
import { normalizeCertificateNumber, CERTIFICATE_EXAMPLE } from "@/lib/certificate-number";
import { ServiceCertificateDocument } from "@/components/certificate/service-certificate";
import { CertificateActions } from "@/components/certificate/certificate-actions";

/**
 * Public certificate verification.
 *
 * No account required, by design — a scholarship committee or admissions
 * office receives a certificate number from a student and needs to confirm
 * it without signing up for anything. The number is the credential: 12
 * characters from a CSPRNG, so it can't be enumerated, and it only ever
 * discloses what is already printed on the certificate the student chose
 * to hand over.
 */

export const dynamic = "force-dynamic";

// Certificates carry a named individual and their school. They're meant to
// be shared deliberately by the student, not surfaced in search results.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function VerifyCertificatePage({
  params,
}: {
  params: { number: string };
}) {
  const raw = decodeURIComponent(params.number);
  const normalized = normalizeCertificateNumber(raw);
  const certificate = normalized ? await fetchCertificate(normalized) : null;

  if (!certificate) return <NotFound attempted={raw} />;

  const verifyUrl = certificateUrl(certificate.certificateNumber);

  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 320,
    margin: 1,
    color: { dark: "#0F172A", light: "#FFFFFF" },
  }).catch(() => null);

  return (
    <main className="min-h-screen bg-surface px-4 py-10 print:bg-white print:p-0">
      {/* Confirmation banner — the answer to "is this real?", stated first */}
      <div className="mx-auto mb-6 max-w-3xl print:hidden">
        <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold text-emerald-900">This is a genuine Volunteerly record</p>
            <p className="mt-0.5 text-sm text-emerald-800">
              Certificate {certificate.certificateNumber} was issued by {certificate.organization.name} and
              has not been altered since.
            </p>
          </div>
        </div>
      </div>

      <ServiceCertificateDocument
        certificate={certificate}
        qrDataUrl={qrDataUrl}
        verifyUrl={verifyUrl}
      />

      <div className="mx-auto mt-6 max-w-3xl">
        <CertificateActions verifyUrl={verifyUrl} />
      </div>

      <PageFooter />
    </main>
  );
}

function NotFound({ attempted }: { attempted: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-navy-100 bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
          <ShieldX className="h-7 w-7 text-red-500" />
        </div>

        <h1 className="mt-5 font-display text-xl font-bold text-navy-900">No certificate found</h1>
        <p className="mt-2 text-sm text-navy-500">
          Nothing on Volunteerly carries this number, so it isn&apos;t a record we issued.
        </p>

        <p className="mt-4 break-all rounded-lg bg-navy-50 px-3 py-2 font-mono text-xs text-navy-600">
          {attempted}
        </p>

        <p className="mt-4 text-xs leading-relaxed text-navy-400">
          Certificate numbers look like <span className="font-mono">{CERTIFICATE_EXAMPLE}</span>. If you
          typed it by hand, check for a mistyped character; if it was given to you as genuine, treat it with
          suspicion.
        </p>

        <Link href="/verify" className="mt-6 inline-block text-sm font-medium text-brand hover:underline">
          Try another number
        </Link>
      </div>

      <PageFooter />
    </main>
  );
}

function PageFooter() {
  return (
    <footer className="mx-auto mt-10 max-w-3xl text-center print:hidden">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm font-medium text-navy-400 transition-colors hover:text-navy-700"
      >
        <HeartHandshake className="h-4 w-4" />
        Volunteerly
      </Link>
    </footer>
  );
}
