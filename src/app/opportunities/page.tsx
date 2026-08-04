"use client";

import { useMemo, useState } from "react";
import { Navbar } from "@/components/nav/navbar";
import { Footer } from "@/components/nav/footer";
import { OpportunityCard } from "@/components/opportunities/opportunity-card";
import { FilterBar, defaultFilters, type Filters } from "@/components/opportunities/filter-bar";
import { EmptyState } from "@/components/ui/progress";
import { useAppData } from "@/lib/context/data-context";
import { useAuth } from "@/lib/context/auth-context";
import { milesBetween } from "@/lib/utils";
import { recommendedOpportunities } from "@/lib/matching";
import { SearchX, Sparkles } from "lucide-react";
import type { Student } from "@/lib/types";

export default function OpportunitiesPage() {
  const { opportunities, organizations, verifiedHours } = useAppData();
  const { currentUser } = useAuth();
  const [filters, setFilters] = useState<Filters>(defaultFilters);

  const student = currentUser?.role === "student" ? (currentUser as Student) : null;

  const filtered = useMemo(() => {
    return opportunities.filter((o) => {
      if (o.status === "completed" || o.status === "cancelled") return false;
      if (filters.keyword) {
        const q = filters.keyword.toLowerCase();
        const haystack = `${o.title} ${o.orgName} ${o.description} ${o.category}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.category !== "All" && o.category !== filters.category) return false;
      if (filters.format === "Virtual" && !o.isVirtual) return false;
      if (filters.format === "In-Person" && o.isVirtual) return false;
      if (filters.orgId !== "All" && o.orgId !== filters.orgId) return false;
      if (filters.minHours > 0 && o.hoursAvailable < filters.minHours) return false;
      // Distance filtering needs a real origin. Without saved coordinates
      // we show the listing rather than measuring from an invented point.
      if (!o.isVirtual && o.lat && o.lng && student?.lat != null && student?.lng != null) {
        const dist = milesBetween(student.lat, student.lng, o.lat, o.lng);
        if (dist > filters.maxDistance) return false;
      }
      return true;
    });
  }, [opportunities, filters, student]);

  const recommended = useMemo(() => {
    if (!student) return [];
    const myPastHours = verifiedHours.filter((h) => h.studentId === student.id);
    return recommendedOpportunities(student, opportunities, myPastHours, 3);
  }, [student, opportunities, verifiedHours]);

  return (
    <>
      <Navbar />
      <main className="bg-surface">
        <div className="container-app py-10">
          <h1 className="font-display text-3xl font-bold text-navy-900">Browse Opportunities</h1>
          <p className="mt-1.5 text-navy-500">Find a cause that fits your schedule and interests.</p>

          {student && recommended.length > 0 && (
            <div className="mt-8">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-brand" />
                <p className="font-display text-sm font-semibold text-navy-900">Recommended for You</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {recommended.map((o) => (
                  <OpportunityCard key={o.id} opp={o} matchScore={80} />
                ))}
              </div>
            </div>
          )}

          <div className="mt-8">
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              organizations={organizations.filter((o) => o.approvalStatus === "approved")}
              resultCount={filtered.length}
            />
          </div>

          <div className="mt-6">
            {filtered.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No opportunities match those filters"
                description="Try widening your distance range or clearing a filter."
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((o) => (
                  <OpportunityCard key={o.id} opp={o} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
