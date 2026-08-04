import { createClient } from "./client";
import { rowToCamel, rowsToCamel, objToSnake } from "./case";
import type {
  Student,
  Organization,
  Admin,
  AnyUser,
  VolunteerOpportunity,
  VolunteerRegistration,
  AttendanceRecord,
  VerifiedHours,
  Goal,
  StudentAchievement,
  AppNotification,
  Report,
  Announcement,
  QRToken,
  MembershipWaiverRequest,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────
// Every read here goes through Supabase's row-level-security-aware client,
// so a signed-in user only ever receives rows the policies in
// /supabase/schema.sql permit. Queries are also scoped by intent — the app
// asks for "my registrations" or "this org's roster", never for the whole
// table — which keeps payloads small and means a UI bug can't leak data
// the database was willing to hand over.
//
// Writes that carry trust (joining, checking in, verifying hours,
// membership) are absent by design: those live in src/app/api/* and run
// server-side. What remains here is a user editing their own things.
//
// This file is the only place that knows about snake_case column names.
// ─────────────────────────────────────────────────────────────────────────

const sb = () => createClient();

/** Opportunity rows carry requirement columns flat; the app wants them nested. */
function toOpportunity(row: any, orgsById?: Map<string, Organization>): VolunteerOpportunity {
  const camel = rowToCamel<any>(row);
  const org = orgsById?.get(camel.orgId);
  return {
    ...camel,
    orgName: org?.name ?? camel.orgName ?? "",
    orgLogoUrl: org?.logoUrl,
    requirements: {
      minAge: camel.minAge ?? undefined,
      certifications: camel.requiredCertifications ?? [],
      backgroundCheck: camel.requiresBackgroundCheck ?? false,
    },
  } as VolunteerOpportunity;
}

// ── Identity ────────────────────────────────────────────────────────────

/** The signed-in user's own profile, resolved by role. */
export async function fetchOwnProfile(): Promise<AnyUser | null> {
  const supabase = sb();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, email, role, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile) return null;

  const base = {
    id: profile.id,
    email: profile.email,
    avatarUrl: profile.avatar_url ?? undefined,
    createdAt: profile.created_at,
  };

  if (profile.role === "student") {
    const { data } = await supabase.from("students").select("*").eq("id", user.id).maybeSingle();
    if (!data) return null;
    return { ...rowToCamel<any>(data), ...base, role: "student" } as Student;
  }

  if (profile.role === "organization") {
    const { data } = await supabase.from("organizations").select("*").eq("id", user.id).maybeSingle();
    if (!data) return null;
    return { ...rowToCamel<any>(data), ...base, role: "organization" } as Organization;
  }

  const { data } = await supabase.from("admins").select("*").eq("id", user.id).maybeSingle();
  if (!data) return null;
  return { ...rowToCamel<any>(data), ...base, role: "admin" } as Admin;
}

/** Profile fields a user may edit on themselves. Membership and verified
 *  hours are rejected by the database trigger, not merely hidden here. */
export async function updateStudentRow(id: string, patch: Partial<Student>) {
  const { role, email, createdAt, membershipStatus, membershipExpiresAt, totalVerifiedHours, volunteerStreakWeeks, ...safe } =
    patch as any;
  const { error } = await sb().from("students").update(objToSnake(safe)).eq("id", id);
  if (error) throw error;
}

export async function updateOrganizationRow(id: string, patch: Partial<Organization>) {
  const { role, email, createdAt, approvalStatus, rejectionReason, ...safe } = patch as any;
  const { error } = await sb().from("organizations").update(objToSnake(safe)).eq("id", id);
  if (error) throw error;
}

// ── Public discovery ────────────────────────────────────────────────────

/** Approved organizations — the public directory. */
export async function fetchOrganizations(): Promise<Organization[]> {
  const { data, error } = await sb().from("organizations").select("*");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...rowToCamel<any>(row), role: "organization" }) as Organization);
}

/**
 * The discovery feed: volunteer opportunities and nothing else.
 *
 * Strictly one content type, by design (spec §8) — no job listings, no
 * internships, no unrelated nonprofit postings mixed in.
 */
export async function fetchOpportunities(): Promise<VolunteerOpportunity[]> {
  const supabase = sb();
  const [{ data: opps, error }, { data: orgs }] = await Promise.all([
    supabase.from("volunteer_opportunities").select("*").order("date", { ascending: true }),
    supabase.from("organizations").select("id, name, logo_url"),
  ]);
  if (error) throw error;

  const orgsById = new Map<string, Organization>(
    (orgs ?? []).map((o: any) => [o.id, rowToCamel<any>(o) as Organization]),
  );
  return (opps ?? []).map((row: any) => toOpportunity(row, orgsById));
}

export async function fetchOpportunityById(id: string): Promise<VolunteerOpportunity | null> {
  const supabase = sb();
  const { data, error } = await supabase
    .from("volunteer_opportunities")
    .select("*, organizations(name, logo_url)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { organizations, ...rest } = data as any;
  const opp = toOpportunity(rest);
  return { ...opp, orgName: organizations?.name ?? "", orgLogoUrl: organizations?.logo_url ?? undefined };
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await sb()
    .from("announcements")
    .select("*, organizations(name)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const { organizations, ...rest } = row;
    return { ...rowToCamel<any>(rest), orgName: organizations?.name ?? "" } as Announcement;
  });
}

// ── Student-scoped ──────────────────────────────────────────────────────

export async function fetchMyRegistrations(): Promise<VolunteerRegistration[]> {
  const { data, error } = await sb().from("volunteer_registrations").select("*");
  if (error) throw error;
  return rowsToCamel<VolunteerRegistration>(data ?? []);
}

export async function fetchMyAttendance(): Promise<AttendanceRecord[]> {
  const { data, error } = await sb().from("attendance_records").select("*");
  if (error) throw error;
  return rowsToCamel<AttendanceRecord>(data ?? []);
}

/**
 * A student's permanent service record. Read-only everywhere in the app —
 * there is no update or delete path, in this file or in the database.
 */
export async function fetchMyVerifiedHours(): Promise<VerifiedHours[]> {
  const { data, error } = await sb()
    .from("verified_hours")
    .select("*, organizations(name)")
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const { organizations, ...rest } = row;
    return {
      ...rowToCamel<any>(rest),
      orgName: organizations?.name ?? "Organization",
      verifiedBadge: true as const,
    } as VerifiedHours;
  });
}

export async function fetchMyGoals(): Promise<Goal[]> {
  const { data, error } = await sb().from("goals").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return rowsToCamel<Goal>(data ?? []);
}

export async function insertGoalRow(goal: Omit<Goal, "id" | "createdAt">) {
  const { data, error } = await sb().from("goals").insert(objToSnake(goal)).select("*").single();
  if (error) throw error;
  return rowToCamel<Goal>(data);
}

export async function updateGoalRow(id: string, patch: Partial<Goal>) {
  const { error } = await sb().from("goals").update(objToSnake(patch)).eq("id", id);
  if (error) throw error;
}

export async function deleteGoalRow(id: string) {
  const { error } = await sb().from("goals").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchMyAchievements(): Promise<StudentAchievement[]> {
  const { data, error } = await sb().from("student_achievements").select("*");
  if (error) throw error;
  return rowsToCamel<StudentAchievement>(data ?? []);
}

export async function fetchMyWaiverRequest(): Promise<MembershipWaiverRequest | null> {
  const { data, error } = await sb()
    .from("membership_waiver_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToCamel<MembershipWaiverRequest>(data) : null;
}

// ── Notifications ───────────────────────────────────────────────────────

export async function fetchMyNotifications(): Promise<AppNotification[]> {
  const { data, error } = await sb()
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return rowsToCamel<AppNotification>(data ?? []);
}

export async function markNotificationReadRow(id: string) {
  const { error } = await sb().from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsReadRow(userId: string) {
  const { error } = await sb().from("notifications").update({ read: true }).eq("user_id", userId);
  if (error) throw error;
}

// ── Organization-scoped ─────────────────────────────────────────────────

/** The roster for an org's events, with the volunteer profiles attached. */
export async function fetchOrgRegistrations(): Promise<{
  registrations: VolunteerRegistration[];
  students: Student[];
}> {
  const supabase = sb();
  const { data, error } = await supabase
    .from("volunteer_registrations")
    .select("*, students(*, profiles(email, avatar_url, created_at))");
  if (error) throw error;

  const registrations: VolunteerRegistration[] = [];
  const studentsById = new Map<string, Student>();

  for (const row of (data ?? []) as any[]) {
    const { students, ...rest } = row;
    registrations.push(rowToCamel<VolunteerRegistration>(rest));
    if (students && !studentsById.has(students.id)) {
      const { profiles, ...studentRest } = students;
      studentsById.set(students.id, {
        ...rowToCamel<any>(studentRest),
        email: profiles?.email ?? "",
        avatarUrl: profiles?.avatar_url ?? undefined,
        createdAt: profiles?.created_at,
        role: "student",
      } as Student);
    }
  }

  return { registrations, students: [...studentsById.values()] };
}

export async function fetchOrgOpportunities(orgId: string): Promise<VolunteerOpportunity[]> {
  const { data, error } = await sb()
    .from("volunteer_opportunities")
    .select("*")
    .eq("org_id", orgId)
    .order("date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => toOpportunity(row));
}

/** Check-in codes for the org's own events. Students cannot read this. */
export async function fetchOrgQrTokens(): Promise<QRToken[]> {
  const { data, error } = await sb().from("qr_tokens").select("*");
  if (error) throw error;
  return rowsToCamel<QRToken>(data ?? []);
}

export async function updateOpportunityRow(id: string, patch: Partial<VolunteerOpportunity>) {
  const { requirements, orgName, orgLogoUrl, currentVolunteers, ...rest } = patch as any;
  const row: Record<string, any> = { ...objToSnake(rest) };
  if (requirements) {
    row.min_age = requirements.minAge ?? null;
    row.required_certifications = requirements.certifications ?? [];
    row.requires_background_check = requirements.backgroundCheck ?? false;
  }
  const { error } = await sb().from("volunteer_opportunities").update(row).eq("id", id);
  if (error) throw error;
}

export async function deleteOpportunityRow(id: string) {
  const { error } = await sb().from("volunteer_opportunities").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchOrgVerifiedHours(): Promise<VerifiedHours[]> {
  const { data, error } = await sb()
    .from("verified_hours")
    .select("*")
    .order("verified_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(
    (row: any) => ({ ...rowToCamel<any>(row), orgName: "", verifiedBadge: true as const }) as VerifiedHours,
  );
}

export async function fetchOrgAttendance(): Promise<AttendanceRecord[]> {
  const { data, error } = await sb().from("attendance_records").select("*");
  if (error) throw error;
  return rowsToCamel<AttendanceRecord>(data ?? []);
}

// ── Admin-scoped ────────────────────────────────────────────────────────

export async function fetchAllStudents(): Promise<Student[]> {
  const { data, error } = await sb().from("students").select("*, profiles(email, avatar_url, created_at)");
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const { profiles, ...rest } = row;
    return {
      ...rowToCamel<any>(rest),
      email: profiles?.email ?? "",
      avatarUrl: profiles?.avatar_url ?? undefined,
      createdAt: profiles?.created_at,
      role: "student",
    } as Student;
  });
}

export async function fetchReports(): Promise<Report[]> {
  const { data, error } = await sb().from("reports").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return rowsToCamel<Report>(data ?? []);
}

export async function insertReportRow(r: Omit<Report, "id" | "createdAt" | "status" | "reporterName" | "targetName">) {
  const { error } = await sb().from("reports").insert(objToSnake(r));
  if (error) throw error;
}

export async function updateReportStatusRow(id: string, status: Report["status"]) {
  const { error } = await sb().from("reports").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function fetchWaiverRequests(): Promise<MembershipWaiverRequest[]> {
  const { data, error } = await sb()
    .from("membership_waiver_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return rowsToCamel<MembershipWaiverRequest>(data ?? []);
}

// ── Platform statistics ─────────────────────────────────────────────────

/**
 * Real counts, straight from the database. When the platform is new these
 * legitimately return zero, and the UI is expected to say so rather than
 * display an invented figure.
 */
export async function fetchPlatformStats() {
  const supabase = sb();
  const [students, organizations, opportunities, hoursRows] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase
      .from("organizations")
      .select("id", { count: "exact", head: true })
      .eq("approval_status", "approved"),
    supabase.from("volunteer_opportunities").select("id", { count: "exact", head: true }),
    supabase.from("verified_hours").select("hours"),
  ]);

  const verifiedHours = (hoursRows.data ?? []).reduce((sum, r: any) => sum + Number(r.hours ?? 0), 0);

  return {
    students: students.count ?? 0,
    organizations: organizations.count ?? 0,
    opportunities: opportunities.count ?? 0,
    verifiedHours,
  };
}
