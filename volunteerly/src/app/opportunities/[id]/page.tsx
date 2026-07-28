"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Clock,
  Users,
  Video,
  Share2,
  Bookmark,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Navbar } from "@/components/nav/navbar";
import { Footer } from "@/components/nav/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { MapEmbed } from "@/components/opportunities/map-embed";
import { useAppData } from "@/lib/context/data-context";
import { useAuth } from "@/lib/context/auth-context";
import { useToast } from "@/components/ui/toast";
import { isEligible } from "@/lib/matching";
import { formatDate, formatTimeRange, formatHours } from "@/lib/utils";
import type { Student } from "@/lib/types";

export default function OpportunityDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { opportunities, registrations, joinOpportunity, cancelRegistration } = useAppData();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const opp = opportunities.find((o) => o.id === params.id);
  const [busy, setBusy] = useState(false);

  if (!opp) {
    return (
      <>
        <Navbar />
        <div className="container-app py-20 text-center">
          <p className="font-display text-xl font-semibold text-navy-900">Opportunity not found</p>
          <Link href="/opportunities" className="mt-4 inline-block text-brand hover:underline">
            Back to opportunities
          </Link>
        </div>
        <Footer />
      </>
    );
  }

  const student = currentUser?.role === "student" ? (currentUser as Student) : null;
  const myRegistration = student
    ? registrations.find((r) => r.studentId === student.id && r.opportunityId === opp.id && r.status !== "cancelled")
    : undefined;
  const eligibility = student ? isEligible(student, opp) : null;
  const spotsLeft = opp.maxVolunteers - opp.currentVolunteers;

  const handleJoin = () => {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    if (!student) {
      showToast("Only student accounts can join events.", "error");
      return;
    }
    setBusy(true);
    const result = joinOpportunity(student.id, opp.id);
    setBusy(false);
    if (result.ok) {
      showToast("You're registered! The organization has been notified.");
    } else {
      showToast(result.reason ?? "Couldn't join this event.", "error");
    }
  };

  const handleCancel = () => {
    if (!myRegistration) return;
    cancelRegistration(myRegistration.id);
    showToast("Registration cancelled.", "info");
  };

  const share = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
    }
    showToast("Link copied to clipboard");
  };

  return (
    <>
      <Navbar />
      <main className="bg-surface">
        <div className="container-app py-8">
          <Link href="/opportunities" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-navy-900">
            <ArrowLeft className="h-4 w-4" />
            Back to opportunities
          </Link>

          <div className="mt-6 grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{opp.category}</Badge>
                {opp.isVirtual && (
                  <Badge tone="slate">
                    <Video className="h-3 w-3" /> Virtual
                  </Badge>
                )}
                {opp.status === "full" && <Badge tone="red">Full</Badge>}
              </div>
              <h1 className="mt-3 font-display text-3xl font-bold text-navy-900">{opp.title}</h1>
              <p className="mt-1.5 text-navy-500">
                Hosted by{" "}
                <Link href={`/opportunities?org=${opp.orgId}`} className="font-medium text-brand hover:underline">
                  {opp.orgName}
                </Link>
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <InfoRow icon={Clock} label="Date & time" value={`${formatDate(opp.date)} · ${formatTimeRange(opp.startTime, opp.endTime)}`} />
                <InfoRow icon={MapPin} label="Location" value={opp.location} />
                <InfoRow icon={Users} label="Volunteers" value={`${opp.currentVolunteers} of ${opp.maxVolunteers} joined`} />
                <InfoRow icon={ShieldCheck} label="Hours available" value={formatHours(opp.hoursAvailable)} />
              </div>

              <div className="mt-8">
                <p className="font-display text-base font-semibold text-navy-900">About this opportunity</p>
                <p className="mt-2 leading-relaxed text-navy-600">{opp.description}</p>
              </div>

              {(opp.requirements.minAge || opp.requirements.certifications?.length || opp.requirements.backgroundCheck) && (
                <div className="mt-6">
                  <p className="font-display text-base font-semibold text-navy-900">Requirements</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-navy-600">
                    {opp.requirements.minAge && <li>• Minimum age: {opp.requirements.minAge}</li>}
                    {opp.requirements.certifications?.map((c) => <li key={c}>• Certification required: {c}</li>)}
                    {opp.requirements.backgroundCheck && <li>• Background check required</li>}
                  </ul>
                </div>
              )}

              {!opp.isVirtual && opp.lat && opp.lng && (
                <div className="mt-8">
                  <p className="mb-3 font-display text-base font-semibold text-navy-900">Location</p>
                  <MapEmbed lat={opp.lat} lng={opp.lng} label={opp.location} />
                </div>
              )}
            </div>

            <div>
              <div className="sticky top-24 rounded-2xl border border-navy-100 bg-white p-6 shadow-card">
                <div className="mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-navy-500">Capacity</span>
                    <span className="font-medium text-navy-900">
                      {opp.currentVolunteers}/{opp.maxVolunteers}
                    </span>
                  </div>
                  <ProgressBar value={opp.currentVolunteers} max={opp.maxVolunteers} className="mt-2" tone={opp.status === "full" ? "navy" : "brand"} />
                  {opp.status !== "full" && <p className="mt-1.5 text-xs text-navy-400">{spotsLeft} spots left</p>}
                </div>

                {myRegistration ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      You're registered
                    </div>
                    <Button variant="outline" className="w-full" onClick={handleCancel}>
                      Cancel registration
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button className="w-full" size="lg" loading={busy} onClick={handleJoin} disabled={opp.status === "full" || eligibility?.eligible === false}>
                      {opp.status === "full" ? "Event Full" : "Join Event"}
                    </Button>
                    {eligibility && !eligibility.eligible && (
                      <p className="mt-2 text-xs text-red-600">{eligibility.reason}</p>
                    )}
                    {!currentUser && <p className="mt-2 text-center text-xs text-navy-400">Log in to join this event.</p>}
                  </>
                )}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={share}>
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => showToast("Saved to your list")}>
                    <Bookmark className="h-4 w-4" />
                    Save
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white p-3.5 shadow-card">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50">
        <Icon className="h-4.5 w-4.5 text-brand" />
      </div>
      <div>
        <p className="text-xs text-navy-400">{label}</p>
        <p className="text-sm font-medium text-navy-900">{value}</p>
      </div>
    </div>
  );
}
