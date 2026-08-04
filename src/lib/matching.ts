import type { Student, VolunteerOpportunity, VerifiedHours } from "./types";

/**
 * Scores how well an opportunity matches a student, from 0–100.
 * Used to power the "Recommended for You" section and the discovery
 * page's default sort order.
 *
 * Weighting rationale:
 *  - Interest overlap is the strongest signal (cause alignment).
 *  - Availability (day + time) filters out opportunities the student
 *    literally cannot attend.
 *  - Distance / virtual preference reflects logistic feasibility.
 *  - Age & transportation are treated as eligibility gates elsewhere
 *    (see isEligible), so here they only lightly influence ranking.
 *  - Past org history gives a small boost — students who've volunteered
 *    with an org before tend to return to it.
 */
export function scoreOpportunity(
  student: Student,
  opp: VolunteerOpportunity,
  pastHours: VerifiedHours[],
): number {
  let score = 0;

  // Interest match — up to 40 points
  if (student.interests.includes(opp.category)) score += 40;

  // Virtual / in-person preference — up to 15 points
  if (student.virtualPreference === "both") score += 10;
  else if (student.virtualPreference === "virtual" && opp.isVirtual) score += 15;
  else if (student.virtualPreference === "in-person" && !opp.isVirtual) score += 15;

  // Distance feasibility — up to 15 points (approximate; real build would
  // use lat/lng haversine distance against the student's saved location)
  if (opp.isVirtual || student.travelDistanceMiles >= 15) score += 15;
  else if (student.travelDistanceMiles >= 8) score += 8;

  // Transportation — up to 10 points
  if (opp.isVirtual || student.transportation) score += 10;

  // Availability — up to 10 points, based on rough time-of-day bucket
  const startHour = Number(opp.startTime.split(":")[0]);
  const bucket = startHour < 12 ? "Morning" : startHour < 17 ? "Afternoon" : "Evening";
  if (student.availableTimes.includes(bucket as any)) score += 10;

  // Past organization history — up to 10 points
  const volunteeredWithOrgBefore = pastHours.some((h) => h.orgId === opp.orgId);
  if (volunteeredWithOrgBefore) score += 10;

  return Math.min(100, score);
}

export function isEligible(student: Student, opp: VolunteerOpportunity): { eligible: boolean; reason?: string } {
  if (opp.currentVolunteers >= opp.maxVolunteers) {
    return { eligible: false, reason: "This event has reached capacity." };
  }
  if (opp.requirements.minAge && (student.age ?? 0) < opp.requirements.minAge) {
    return { eligible: false, reason: `Volunteers must be at least ${opp.requirements.minAge} years old.` };
  }
  if (opp.requirements.certifications?.length) {
    const missing = opp.requirements.certifications.filter(
      (c) => !student.skills.some((s) => s.toLowerCase().includes(c.toLowerCase())),
    );
    if (missing.length > 0) {
      return { eligible: false, reason: `Missing required certification: ${missing.join(", ")}.` };
    }
  }
  return { eligible: true };
}

export function recommendedOpportunities(
  student: Student,
  opportunities: VolunteerOpportunity[],
  pastHours: VerifiedHours[],
  limit = 6,
): VolunteerOpportunity[] {
  return opportunities
    .filter((o) => o.status === "open")
    .map((o) => ({ opp: o, score: scoreOpportunity(student, o, pastHours) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.opp);
}
