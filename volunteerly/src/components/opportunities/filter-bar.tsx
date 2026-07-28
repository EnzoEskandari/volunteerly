"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CAUSE_CATEGORIES, type CauseCategory } from "@/lib/types";

export interface Filters {
  keyword: string;
  category: CauseCategory | "All";
  format: "All" | "Virtual" | "In-Person";
  maxDistance: number;
  minHours: number;
  orgId: string | "All";
}

export const defaultFilters: Filters = {
  keyword: "",
  category: "All",
  format: "All",
  maxDistance: 30,
  minHours: 0,
  orgId: "All",
};

export function FilterBar({
  filters,
  setFilters,
  organizations,
  resultCount,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
  organizations: { id: string; name: string }[];
  resultCount: number;
}) {
  const activeCount =
    (filters.category !== "All" ? 1 : 0) +
    (filters.format !== "All" ? 1 : 0) +
    (filters.maxDistance < 30 ? 1 : 0) +
    (filters.minHours > 0 ? 1 : 0) +
    (filters.orgId !== "All" ? 1 : 0);

  return (
    <div className="rounded-2xl border border-navy-100 bg-white p-4 shadow-card sm:p-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-navy-300" />
        <Input
          placeholder="Search by keyword, cause, or organization..."
          value={filters.keyword}
          onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
          className="pl-10"
        />
      </div>

      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-navy-400" />
        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value as any })}
          className="h-9 shrink-0 rounded-lg border border-navy-200 bg-white px-2.5 text-xs font-medium text-navy-700"
        >
          <option value="All">All categories</option>
          {CAUSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <select
          value={filters.format}
          onChange={(e) => setFilters({ ...filters, format: e.target.value as any })}
          className="h-9 shrink-0 rounded-lg border border-navy-200 bg-white px-2.5 text-xs font-medium text-navy-700"
        >
          <option value="All">Virtual or in-person</option>
          <option value="Virtual">Virtual only</option>
          <option value="In-Person">In-person only</option>
        </select>

        <select
          value={filters.orgId}
          onChange={(e) => setFilters({ ...filters, orgId: e.target.value })}
          className="h-9 shrink-0 rounded-lg border border-navy-200 bg-white px-2.5 text-xs font-medium text-navy-700"
        >
          <option value="All">All organizations</option>
          {organizations.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>

        <select
          value={filters.minHours}
          onChange={(e) => setFilters({ ...filters, minHours: Number(e.target.value) })}
          className="h-9 shrink-0 rounded-lg border border-navy-200 bg-white px-2.5 text-xs font-medium text-navy-700"
        >
          <option value={0}>Any hours</option>
          <option value={1}>1+ hours</option>
          <option value={2}>2+ hours</option>
          <option value={3}>3+ hours</option>
        </select>

        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-navy-200 px-2.5 py-1.5">
          <span className="text-xs font-medium text-navy-700">Within {filters.maxDistance} mi</span>
          <input
            type="range"
            min={1}
            max={30}
            value={filters.maxDistance}
            onChange={(e) => setFilters({ ...filters, maxDistance: Number(e.target.value) })}
            className="w-20 accent-brand"
          />
        </div>

        {activeCount > 0 && (
          <button
            onClick={() => setFilters(defaultFilters)}
            className={cn("flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-navy-500 hover:bg-navy-50")}
          >
            <X className="h-3.5 w-3.5" />
            Clear ({activeCount})
          </button>
        )}
      </div>

      <p className="mt-3 text-xs text-navy-400">{resultCount} opportunities match your filters</p>
    </div>
  );
}
