"use client";

import Link from "next/link";
import { MapPin, Clock, Users, Video, Share2, Bookmark } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatShortDate, formatTimeRange, formatHours } from "@/lib/utils";
import type { VolunteerOpportunity } from "@/lib/types";

export function OpportunityCard({ opp, matchScore }: { opp: VolunteerOpportunity; matchScore?: number }) {
  const { showToast } = useToast();
  const spotsLeft = opp.maxVolunteers - opp.currentVolunteers;

  const share = (e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(`${window.location.origin}/opportunities/${opp.id}`);
    }
    showToast("Link copied to clipboard");
  };

  const save = (e: React.MouseEvent) => {
    e.preventDefault();
    showToast("Saved to your list");
  };

  return (
    <Link href={`/opportunities/${opp.id}`}>
      <Card className="group h-full p-5 transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Badge tone="brand">{opp.category}</Badge>
            {opp.isVirtual && (
              <Badge tone="slate">
                <Video className="h-3 w-3" /> Virtual
              </Badge>
            )}
            {matchScore !== undefined && matchScore >= 60 && <Badge tone="emerald">Great match</Badge>}
          </div>
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={save} aria-label="Save" className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700">
              <Bookmark className="h-4 w-4" />
            </button>
            <button onClick={share} aria-label="Share" className="rounded-lg p-1.5 text-navy-400 hover:bg-navy-50 hover:text-navy-700">
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <p className="mt-3 font-display text-base font-semibold leading-snug text-navy-900">{opp.title}</p>
        <p className="mt-1 text-sm text-navy-500">{opp.orgName}</p>

        <div className="mt-4 space-y-1.5 text-sm text-navy-500">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-navy-300" />
            {formatShortDate(opp.date)} · {formatTimeRange(opp.startTime, opp.endTime)}
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0 text-navy-300" />
            <span className="truncate">{opp.location}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-navy-100 pt-3.5">
          <div className="flex items-center gap-1.5 text-xs text-navy-400">
            <Users className="h-3.5 w-3.5" />
            {opp.status === "full" ? (
              <span className="font-medium text-red-500">Full</span>
            ) : (
              <span>{spotsLeft} spot{spotsLeft === 1 ? "" : "s"} left</span>
            )}
          </div>
          <span className="text-xs font-semibold text-brand">{formatHours(opp.hoursAvailable)}</span>
        </div>
      </Card>
    </Link>
  );
}
