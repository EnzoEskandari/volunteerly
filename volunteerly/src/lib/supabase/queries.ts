import { createClient } from "./client";
import { rowToCamel, rowsToCamel, objToSnake } from "./case";
import type {
  Student,
  Organization,
  Admin,
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
  OrgApprovalStatus,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────
// Every function here talks directly to Postgres through Supabase's
// row-level-security-aware client — a logged-in user only ever sees rows
// the policies in /supabase/schema.sql allow them to see. This file is the
// only place that knows about snake_case columns or table names; the rest
// of the app only ever touches the camelCase types in src/lib/types.ts.
// ─────────────────────────────────────────────────────────────────────────

const sb = () => createClient();

// ── Students & Organizations (joined with profiles for email/createdAt) ──

export async function fetchStudents(): Promise<Student[]> {
  const { data, error } = await sb().from("students").select("*, profiles!inner(email, created_at, avatar_url)");
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const profile = rowToCamel<any>(row.profiles);
    const { profiles, ...rest } = row;
    return { ...rowToCamel<any>(rest), ...profile, role: "student" } as Student;
  });
}

export async function fetchOrganizations(): Promise<Organization[]> {
  const { data, error } = await sb().from("organizations").select("*, profiles!inner(email, created_at, avatar_url)");
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const profile = rowToCamel<any>(row.profiles);
    const { profiles, ...rest } = row;
    return { ...rowToCamel<any>(rest), ...profile, role: "organization" } as Organization;
  });
}

export async function fetchAdmins(): Promise<Admin[]> {
  const { data, error } = await sb().from("admins").select("*, profiles!inner(email, created_at, avatar_url)");
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const profile = rowToCamel<any>(row.profiles);
    const { profiles, ...rest } = row;
    return { ...rowToCamel<any>(rest), ...profile, role: "admin" } as Admin;
  });
}

/** Creates the shared profile row + role-specific row right after Supabase Auth sign-up. */
export async function createStudentProfile(id: string, email: string, student: Partial<Student>) {
  const supabase = sb();
  const { error: profileErr } = await supabase.from("profiles").insert({ id, email, role: "student" });
  if (profileErr) throw profileErr;
  const { error } = await supabase.from("students").insert({ id, ...objToSnake(student) });
  if (error) throw error;
}

export async function createOrganizationProfile(id: string, email: string, org: Partial<Organization>) {
  const supabase = sb();
  const { error: profileErr } = await supabase.from("profiles").insert({ id, email, role: "organization" });
  if (profileErr) throw profileErr;
  const { error } = await supabase.from("organizations").insert({ id, ...objToSnake(org) });
  if (error) throw error;
}

export async function updateStudentRow(id: string, patch: Partial<Student>) {
  const { error } = await sb().from("students").update(objToSnake(patch)).eq("id", id);
  if (error) throw error;
}

export async function updateOrganizationRow(id: string, patch: Partial<Organization>) {
  const { error } = await sb().from("organizations").update(objToSnake(patch)).eq("id", id);
  if (error) throw error;
}

// ── Opportunities ──────────────────────────────────────────────────────

export async function fetchOpportunities(): Promise<VolunteerOpportunity[]> {
  const { data, error } = await sb().from("volunteer_opportunities").select("*");
  if (error) throw error;
  return (data ?? []).map((row: any) => {
    const camel = rowToCamel<any>(row);
    return {
      ...camel,
      orgId: camel.orgId,
      orgName: "",
      requirements: {
        minAge: camel.minAge ?? undefined,
        certifications: camel.requiredCertifications ?? [],
        backgroundCheck: camel.requiresBackgroundCheck ?? false,
      },
    } as VolunteerOpportunity;
  });
}

export async function insertOpportunity(opp: VolunteerOpportunity) {
  const { requirements, orgName, orgLogoUrl, ...rest } = opp;
  const row = {
    ...objToSnake(rest),
    min_age: requirements.minAge ?? null,
    required_certifications: requirements.certifications ?? [],
    requires_background_check: requirements.backgroundCheck ?? false,
  };
  const { error } = await sb().from("volunteer_opportunities").insert(row);
  if (error) throw error;
}

export async function updateOpportunityRow(id: string, patch: Partial<VolunteerOpportunity>) {
  const { requirements, orgName, orgLogoUrl, ...rest } = patch as any;
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

// ── Registrations, attendance, QR tokens ──────────────────────────────

export async function fetchRegistrations(): Promise<VolunteerRegistration[]> {
  const { data, error } = await sb().from("volunteer_registrations").select("*");
  if (error) throw error;
  return rowsToCamel<VolunteerRegistration>(data ?? []);
}

export async function insertRegistration(reg: VolunteerRegistration) {
  const { error } = await sb().from("volunteer_registrations").insert(objToSnake(reg));
  if (error) throw error;
}

export async function updateRegistrationRow(id: string, patch: Partial<VolunteerRegistration>) {
  const { error } = await sb().from("volunteer_registrations").update(objToSnake(patch)).eq("id", id);
  if (error) throw error;
}

export async function fetchAttendance(): Promise<AttendanceRecord[]> {
  const { data, error } = await sb().from("attendance_records").select("*");
  if (error) throw error;
  return rowsToCamel<AttendanceRecord>(data ?? []);
}

export async function insertAttendanceRow(record: AttendanceRecord) {
  const { error } = await sb().from("attendance_records").insert(objToSnake(record));
  if (error) throw error;
}

export async function fetchQrTokens(): Promise<QRToken[]> {
  const { data, error } = await sb().from("qr_tokens").select("*");
  if (error) throw error;
  return rowsToCamel<QRToken>(data ?? []);
}

export async function upsertQrToken(token: QRToken) {
  const { error } = await sb().from("qr_tokens").upsert(objToSnake(token));
  if (error) throw error;
}

export async function markQrTokenUsed(token: string) {
  const { error } = await sb().from("qr_tokens").update({ used: true }).eq("token", token);
  if (error) throw error;
}

// ── Verified hours ─────────────────────────────────────────────────────

export async function fetchVerifiedHours(): Promise<VerifiedHours[]> {
  const { data, error } = await sb().from("verified_hours").select("*");
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ ...rowToCamel<any>(row), orgName: "", verifiedBadge: true }) as VerifiedHours);
}

export async function insertVerifiedHoursRow(record: Omit<VerifiedHours, "orgName" | "verifiedBadge">) {
  const { error } = await sb().from("verified_hours").insert(objToSnake(record));
  if (error) throw error;
}

// ── Goals ──────────────────────────────────────────────────────────────

export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await sb().from("goals").select("*");
  if (error) throw error;
  return rowsToCamel<Goal>(data ?? []);
}

export async function insertGoalRow(goal: Goal) {
  const { error } = await sb().from("goals").insert(objToSnake(goal));
  if (error) throw error;
}

export async function updateGoalRow(id: string, patch: Partial<Goal>) {
  const { error } = await sb().from("goals").update(objToSnake(patch)).eq("id", id);
  if (error) throw error;
}

export async function deleteGoalRow(id: string) {
  const { error } = await sb().from("goals").delete().eq("id", id);
  if (error) throw error;
}

// ── Achievements earned ────────────────────────────────────────────────

export async function fetchStudentAchievements(): Promise<StudentAchievement[]> {
  const { data, error } = await sb().from("student_achievements").select("*");
  if (error) throw error;
  return rowsToCamel<StudentAchievement>(data ?? []);
}

export async function insertStudentAchievementRow(record: StudentAchievement) {
  const { error } = await sb().from("student_achievements").insert(objToSnake(record));
  if (error) throw error;
}

// ── Notifications ──────────────────────────────────────────────────────

export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await sb().from("notifications").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return rowsToCamel<AppNotification>(data ?? []);
}

export async function insertNotificationRow(n: Omit<AppNotification, "id" | "createdAt" | "read">) {
  const { error } = await sb().from("notifications").insert(objToSnake(n));
  if (error) throw error;
}

export async function markNotificationReadRow(id: string) {
  const { error } = await sb().from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsReadRow(userId: string) {
  const { error } = await sb().from("notifications").update({ read: true }).eq("user_id", userId);
  if (error) throw error;
}

// ── Announcements ──────────────────────────────────────────────────────

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const { data, error } = await sb().from("announcements").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return rowsToCamel<Announcement>(data ?? []);
}

export async function insertAnnouncementRow(a: Omit<Announcement, "id" | "createdAt">) {
  const { error } = await sb().from("announcements").insert(objToSnake(a));
  if (error) throw error;
}

// ── Reports (moderation) ───────────────────────────────────────────────

export async function fetchReports(): Promise<Report[]> {
  const { data, error } = await sb().from("reports").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return rowsToCamel<Report>(data ?? []);
}

export async function insertReportRow(r: Omit<Report, "id" | "createdAt" | "status">) {
  const { error } = await sb().from("reports").insert(objToSnake(r));
  if (error) throw error;
}

export async function updateReportStatusRow(id: string, status: Report["status"]) {
  const { error } = await sb().from("reports").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function setOrgApprovalRow(id: string, status: OrgApprovalStatus, reason?: string) {
  const { error } = await sb()
    .from("organizations")
    .update({ approval_status: status, rejection_reason: reason ?? null })
    .eq("id", id);
  if (error) throw error;
}

// ── Platform stats (real counts, no placeholders) ─────────────────────

export async function fetchPlatformStats() {
  const supabase = sb();
  const [students, organizations, opportunities, hoursRows] = await Promise.all([
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("organizations").select("id", { count: "exact", head: true }).eq("approval_status", "approved"),
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
