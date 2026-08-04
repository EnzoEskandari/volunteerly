import type { Achievement } from "./types";

/**
 * The badge catalog — a static list of achievements the product defines,
 * mirroring the `achievements` table seeded in /supabase/schema.sql.
 *
 * This is product configuration, not user data: it describes what *can* be
 * earned. Whether a given student has earned any of it always comes from
 * the student_achievements table, so a brand-new account correctly shows
 * "0 of 10 unlocked" rather than anything pre-filled.
 */
export const ACHIEVEMENTS_CATALOG: Achievement[] = [
  {
    key: "first-event",
    label: "First Volunteer Event",
    description: "Completed your first verified volunteer event",
    icon: "Sparkles",
    category: "milestone",
  },
  { key: "hours-10", label: "10 Hours", description: "Reached 10 verified service hours", icon: "Clock", category: "milestone" },
  { key: "hours-25", label: "25 Hours", description: "Reached 25 verified service hours", icon: "Clock", category: "milestone" },
  { key: "hours-50", label: "50 Hours", description: "Reached 50 verified service hours", icon: "Trophy", category: "milestone" },
  { key: "hours-100", label: "100 Hours", description: "Reached 100 verified service hours", icon: "Trophy", category: "milestone" },
  {
    key: "community-leader",
    label: "Community Leader",
    description: "Volunteered with 5 or more organizations",
    icon: "Users",
    category: "milestone",
  },
  {
    key: "environmental-champion",
    label: "Environmental Champion",
    description: "Logged 10+ hours in Environment causes",
    icon: "Leaf",
    category: "cause",
  },
  {
    key: "animal-advocate",
    label: "Animal Advocate",
    description: "Logged 10+ hours in Animal causes",
    icon: "PawPrint",
    category: "cause",
  },
  {
    key: "education-mentor",
    label: "Education Mentor",
    description: "Logged 10+ hours in Education causes",
    icon: "GraduationCap",
    category: "cause",
  },
  {
    key: "four-week-streak",
    label: "Four Week Streak",
    description: "Volunteered four weeks in a row",
    icon: "Flame",
    category: "streak",
  },
];

/**
 * Which badges a student qualifies for, derived from their verified record.
 * Called server-side after hours are verified; the returned keys are
 * upserted into student_achievements.
 */
export function earnedAchievementKeys(input: {
  totalHours: number;
  distinctOrgCount: number;
  eventCount: number;
  hoursByCategory: Record<string, number>;
  streakWeeks: number;
}): string[] {
  const keys: string[] = [];

  if (input.eventCount >= 1) keys.push("first-event");
  if (input.totalHours >= 10) keys.push("hours-10");
  if (input.totalHours >= 25) keys.push("hours-25");
  if (input.totalHours >= 50) keys.push("hours-50");
  if (input.totalHours >= 100) keys.push("hours-100");
  if (input.distinctOrgCount >= 5) keys.push("community-leader");
  if ((input.hoursByCategory["Environment"] ?? 0) >= 10) keys.push("environmental-champion");
  if ((input.hoursByCategory["Animals"] ?? 0) >= 10) keys.push("animal-advocate");
  if ((input.hoursByCategory["Education"] ?? 0) >= 10) keys.push("education-mentor");
  if (input.streakWeeks >= 4) keys.push("four-week-streak");

  return keys;
}
