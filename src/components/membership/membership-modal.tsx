"use client";

import { useState } from "react";
import { ShieldCheck, Check, HeartHandshake } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";
import { formatMembershipPrice, MEMBERSHIP_INTERVAL } from "@/lib/pricing";

const included = [
  "Join unlimited volunteer opportunities",
  "QR check-in at events",
  "Digitally verified service hours",
  "Downloadable service transcript",
  "Goal tracking & achievements",
];

export function MembershipModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  /** @deprecated identity comes from the session; kept for call-site compatibility */
  studentId?: string;
  onActivated?: () => void;
}) {
  const { startMembershipCheckout, requestFeeWaiver } = useAppData();
  const { showToast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWaiverForm, setShowWaiverForm] = useState(false);
  const [reason, setReason] = useState("");
  const [program, setProgram] = useState("");

  /**
   * Hands off to Stripe Checkout. Membership becomes active only when the
   * webhook confirms the payment settled — this function redirecting is
   * not itself a grant of access.
   */
  const subscribe = async () => {
    setProcessing(true);
    setError(null);
    const result = await startMembershipCheckout();
    if (!result.ok) {
      setProcessing(false);
      setError(result.reason ?? "We couldn't open checkout just now.");
      return;
    }
    // On success the browser is already navigating to Stripe.
  };

  const submitWaiver = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setError(null);
    const result = await requestFeeWaiver({ reason, program: program || undefined });
    setProcessing(false);
    if (!result.ok) {
      setError(result.reason ?? "We couldn't submit that request.");
      return;
    }
    showToast("Waiver request submitted — we'll email you once it's reviewed.");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Become a Volunteerly Member" maxWidth="max-w-md">
      {!showWaiverForm ? (
        <>
          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 text-center">
            <p className="font-display text-3xl font-bold text-navy-900">
              {formatMembershipPrice()}
              <span className="text-base font-medium text-navy-400">/{MEMBERSHIP_INTERVAL}</span>
            </p>
            <p className="mt-1 text-sm text-navy-500">Cancel anytime</p>
          </div>

          <ul className="mt-5 space-y-2.5">
            {included.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-navy-700">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                {item}
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-navy-50 p-3.5 text-xs text-navy-500">
            <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            Nonprofits never pay a cent on Volunteerly — your membership is what keeps the whole network free for
            every organization you volunteer with.
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <Button className="mt-5 w-full" size="lg" loading={processing} onClick={() => void subscribe()}>
            <ShieldCheck className="h-4 w-4" />
            Continue to secure checkout
          </Button>
          <p className="mt-2.5 text-center text-xs text-navy-400">
            Payments are processed by Stripe. Volunteerly never sees your card details.
          </p>
          <button
            onClick={() => {
              setShowWaiverForm(true);
              setError(null);
            }}
            className="mt-3 w-full text-center text-sm font-medium text-navy-500 underline decoration-navy-300 underline-offset-2 hover:text-navy-700"
          >
            Need a fee waiver instead?
          </button>
        </>
      ) : (
        <form onSubmit={submitWaiver}>
          <p className="text-sm text-navy-600">
            Cost should never be the reason you can&apos;t record your service. If you qualify for free or
            reduced-price lunch — or an equivalent need-based program — tell us briefly and we&apos;ll review your
            request.
          </p>

          <div className="mt-5 space-y-4">
            <div>
              <Label htmlFor="program">Program (optional)</Label>
              <Input
                id="program"
                placeholder="e.g. Free/reduced-price lunch"
                value={program}
                onChange={(e) => setProgram(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="reason">Your situation</Label>
              <textarea
                id="reason"
                required
                minLength={10}
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="A sentence or two is plenty."
                className="w-full rounded-xl border border-navy-200 px-3.5 py-2.5 text-sm text-navy-900 outline-none transition placeholder:text-navy-300 focus:border-brand focus:ring-2 focus:ring-brand-100"
              />
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <div className="mt-5 flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                setShowWaiverForm(false);
                setError(null);
              }}
            >
              Back
            </Button>
            <Button type="submit" className="flex-1" loading={processing}>
              Submit request
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
