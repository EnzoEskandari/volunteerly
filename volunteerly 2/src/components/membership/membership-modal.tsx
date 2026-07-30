"use client";

import { useState } from "react";
import { ShieldCheck, Check, HeartHandshake } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useAppData } from "@/lib/context/data-context";
import { useToast } from "@/components/ui/toast";
import { MEMBERSHIP_PRICE_USD } from "@/lib/types";

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
  studentId,
  onActivated,
}: {
  open: boolean;
  onClose: () => void;
  studentId: string;
  onActivated?: () => void;
}) {
  const { activateMembership } = useAppData();
  const { showToast } = useToast();
  const [processing, setProcessing] = useState(false);
  const [showWaiverForm, setShowWaiverForm] = useState(false);

  const subscribe = () => {
    setProcessing(true);
    // Simulated checkout — production wires this to a real Stripe Checkout
    // Session (see src/lib/stripe.ts) and activates membership from the
    // webhook once payment succeeds, rather than client-side like this demo.
    setTimeout(() => {
      activateMembership(studentId, false);
      setProcessing(false);
      showToast(`You're a Volunteerly member! $${MEMBERSHIP_PRICE_USD}/year, renews next July.`);
      onActivated?.();
      onClose();
    }, 700);
  };

  const requestWaiver = () => {
    activateMembership(studentId, true);
    showToast("Fee waiver applied — you're all set for this year.");
    onActivated?.();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Become a Volunteerly Member" maxWidth="max-w-md">
      {!showWaiverForm ? (
        <>
          <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 text-center">
            <p className="font-display text-3xl font-bold text-navy-900">
              ${MEMBERSHIP_PRICE_USD}
              <span className="text-base font-medium text-navy-400">/year</span>
            </p>
            <p className="mt-1 text-sm text-navy-500">Less than 42¢/month — cancel anytime</p>
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

          <Button className="mt-5 w-full" size="lg" loading={processing} onClick={subscribe}>
            <ShieldCheck className="h-4 w-4" />
            Subscribe — ${MEMBERSHIP_PRICE_USD}/year
          </Button>
          <button
            onClick={() => setShowWaiverForm(true)}
            className="mt-3 w-full text-center text-sm font-medium text-navy-500 underline decoration-navy-300 underline-offset-2 hover:text-navy-700"
          >
            Need a fee waiver instead?
          </button>
        </>
      ) : (
        <div>
          <p className="text-sm text-navy-600">
            If cost is a barrier, Volunteerly waives the membership fee for students who qualify for free or
            reduced-price lunch, or an equivalent need-based school program. No documentation is required in this
            demo — in production this would route to a short verification step with your school.
          </p>
          <div className="mt-5 flex gap-2.5">
            <Button variant="outline" className="flex-1" onClick={() => setShowWaiverForm(false)}>
              Back
            </Button>
            <Button className="flex-1" onClick={requestWaiver}>
              Apply Waiver
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
