"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./auth-context";
import { ACHIEVEMENTS_CATALOG } from "@/lib/achievements";
import * as q from "@/lib/supabase/queries";
import type {
  Student,
  Organization,
  VolunteerOpportunity,
  VolunteerRegistration,
  VerifiedHours,
  Goal,
  StudentAchievement,
  AppNotification,
  Report,
  Announcement,
  QRToken,
  AttendanceRecord,
  MembershipWaiverRequest,
  PlatformStats,
} from "@/lib/types";

/**
 * The app's data layer, backed entirely by the shared Postgres database.
 *
 * Two properties matter here:
 *
 *   1. Reads are scoped to the signed-in user's role. A student's browser
 *      asks for its own registrations and the public opportunity feed —
 *      not for every row in every table — and row-level security enforces
 *      that independently of what this code requests.
 *
 *   2. Writes that carry trust don't happen here. Joining, checking in,
 *      verifying hours and anything touching membership are POSTed to
 *      route handlers that validate server-side. Those calls return a real
 *      result and this context refetches from the database afterwards, so
 *      the UI reflects what was actually persisted rather than what it
 *      optimistically hoped for.
 */

export type ActionResult = { ok: boolean; reason?: string; code?: string };

interface DataContextValue {
  students: Student[];
  organizations: Organization[];
  opportunities: VolunteerOpportunity[];
  registrations: VolunteerRegistration[];
  attendanceRecords: AttendanceRecord[];
  verifiedHours: VerifiedHours[];
  goals: Goal[];
  studentAchievements: StudentAchievement[];
  notifications: AppNotification[];
  reports: Report[];
  announcements: Announcement[];
  qrTokens: QRToken[];
  waiverRequests: MembershipWaiverRequest[];
  achievementsCatalog: typeof ACHIEVEMENTS_CATALOG;
  platformStats: PlatformStats;

  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;

  // Profile edits — the user's own row, guarded further by the database.
  updateStudent: (id: string, patch: Partial<Student>) => Promise<ActionResult>;
  updateOrganization: (id: string, patch: Partial<Organization>) => Promise<ActionResult>;

  // Server-validated actions.
  joinOpportunity: (opportunityId: string) => Promise<ActionResult>;
  cancelRegistration: (registrationId: string) => Promise<ActionResult>;
  checkIn: (token: string) => Promise<ActionResult>;
  verifyHours: (input: {
    studentId: string;
    opportunityId: string;
    hours: number;
    activityDescription: string;
    supervisor: string;
    date: string;
  }) => Promise<ActionResult>;
  createOpportunity: (input: Record<string, unknown>) => Promise<ActionResult & { id?: string }>;
  updateOpportunity: (id: string, patch: Partial<VolunteerOpportunity>) => Promise<ActionResult>;
  deleteOpportunity: (id: string) => Promise<ActionResult>;
  setOrgApproval: (id: string, status: string, reason?: string) => Promise<ActionResult>;
  removeStudent: (id: string) => Promise<ActionResult>;
  postAnnouncement: (input: { title: string; body: string; opportunityId?: string }) => Promise<ActionResult>;
  startMembershipCheckout: () => Promise<ActionResult>;
  requestFeeWaiver: (input: { reason: string; program?: string }) => Promise<ActionResult>;
  decideWaiver: (requestId: string, decision: "approved" | "denied", note?: string) => Promise<ActionResult>;

  // Goals.
  createGoal: (g: Omit<Goal, "id" | "createdAt">) => Promise<ActionResult>;
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<ActionResult>;
  deleteGoal: (id: string) => Promise<ActionResult>;

  // Notifications & moderation.
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: (userId: string) => Promise<void>;
  submitReport: (r: Record<string, unknown>) => Promise<ActionResult>;
  updateReportStatus: (id: string, status: Report["status"]) => Promise<ActionResult>;
}

const DataContext = createContext<DataContextValue | null>(null);

const EMPTY_STATS: PlatformStats = { students: 0, organizations: 0, opportunities: 0, verifiedHours: 0 };

/** POSTs to a route handler and normalises the response into ActionResult. */
async function post(url: string, body?: unknown): Promise<ActionResult & Record<string, any>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      return { ok: false, reason: json.reason ?? "Something went wrong. Please try again.", code: json.code };
    }
    return { ok: true, ...json };
  } catch {
    return { ok: false, reason: "We couldn't reach Volunteerly. Check your connection and try again." };
  }
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentUser, loading: authLoading, refreshUser } = useAuth();

  const [students, setStudents] = useState<Student[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [opportunities, setOpportunities] = useState<VolunteerOpportunity[]>([]);
  const [registrations, setRegistrations] = useState<VolunteerRegistration[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [verifiedHours, setVerifiedHours] = useState<VerifiedHours[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [studentAchievements, setStudentAchievements] = useState<StudentAchievement[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [qrTokens, setQrTokens] = useState<QRToken[]>([]);
  const [waiverRequests, setWaiverRequests] = useState<MembershipWaiverRequest[]>([]);
  const [platformStats, setPlatformStats] = useState<PlatformStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Public data — available to signed-out visitors browsing the feed.
      const [opps, orgs, stats] = await Promise.all([
        q.fetchOpportunities(),
        q.fetchOrganizations(),
        q.fetchPlatformStats(),
      ]);
      setOpportunities(opps);
      setOrganizations(orgs);
      setPlatformStats(stats);

      if (!currentUser) {
        setStudents([]);
        setRegistrations([]);
        setAttendanceRecords([]);
        setVerifiedHours([]);
        setGoals([]);
        setStudentAchievements([]);
        setNotifications([]);
        setReports([]);
        setQrTokens([]);
        setWaiverRequests([]);
        return;
      }

      const notifs = await q.fetchMyNotifications();
      setNotifications(notifs);

      if (currentUser.role === "student") {
        const [regs, hours, myGoals, achievements, attendance, anns, waiver] = await Promise.all([
          q.fetchMyRegistrations(),
          q.fetchMyVerifiedHours(),
          q.fetchMyGoals(),
          q.fetchMyAchievements(),
          q.fetchMyAttendance(),
          q.fetchAnnouncements(),
          q.fetchMyWaiverRequest(),
        ]);
        setRegistrations(regs);
        setVerifiedHours(hours);
        setGoals(myGoals);
        setStudentAchievements(achievements);
        setAttendanceRecords(attendance);
        setAnnouncements(anns);
        setWaiverRequests(waiver ? [waiver] : []);
        setStudents([currentUser as Student]);
      }

      if (currentUser.role === "organization") {
        const [roster, hours, tokens, attendance, anns] = await Promise.all([
          q.fetchOrgRegistrations(),
          q.fetchOrgVerifiedHours(),
          q.fetchOrgQrTokens(),
          q.fetchOrgAttendance(),
          q.fetchAnnouncements(),
        ]);
        setRegistrations(roster.registrations);
        setStudents(roster.students);
        setVerifiedHours(hours);
        setQrTokens(tokens);
        setAttendanceRecords(attendance);
        setAnnouncements(anns);
      }

      if (currentUser.role === "admin") {
        const [allStudents, allReports, waivers] = await Promise.all([
          q.fetchAllStudents(),
          q.fetchReports(),
          q.fetchWaiverRequests(),
        ]);
        setStudents(allStudents);
        setReports(allReports);
        setWaiverRequests(waivers);
      }
    } catch (err: any) {
      console.error("[volunteerly] Failed to load data:", err);
      setError(
        err?.message?.includes("not configured")
          ? err.message
          : "We couldn't load your data just now. Please refresh to try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (authLoading) return;
    void load();
  }, [authLoading, load]);

  /** Runs an action, then resyncs from the database so the UI shows what
   *  was actually persisted — never an optimistic guess. */
  const withRefresh = useCallback(
    async (result: ActionResult, alsoRefreshUser = false): Promise<ActionResult> => {
      if (result.ok) {
        if (alsoRefreshUser) await refreshUser();
        await load();
      }
      return result;
    },
    [load, refreshUser],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      students,
      organizations,
      opportunities,
      registrations,
      attendanceRecords,
      verifiedHours,
      goals,
      studentAchievements,
      notifications,
      reports,
      announcements,
      qrTokens,
      waiverRequests,
      achievementsCatalog: ACHIEVEMENTS_CATALOG,
      platformStats,
      loading,
      error,
      refetch: load,

      updateStudent: async (id, patch) => {
        try {
          await q.updateStudentRow(id, patch);
          await refreshUser();
          await load();
          return { ok: true };
        } catch (err: any) {
          return { ok: false, reason: err?.message ?? "Couldn't save those changes." };
        }
      },

      updateOrganization: async (id, patch) => {
        try {
          await q.updateOrganizationRow(id, patch);
          await refreshUser();
          await load();
          return { ok: true };
        } catch (err: any) {
          return { ok: false, reason: err?.message ?? "Couldn't save those changes." };
        }
      },

      joinOpportunity: (opportunityId) =>
        post("/api/opportunities/join", { opportunityId }).then((r) => withRefresh(r)),

      cancelRegistration: (registrationId) =>
        post("/api/opportunities/cancel", { registrationId }).then((r) => withRefresh(r)),

      checkIn: (token) => post("/api/checkin", { token }).then((r) => withRefresh(r)),

      verifyHours: (input) => post("/api/hours/verify", input).then((r) => withRefresh(r)),

      createOpportunity: (input) =>
        post("/api/opportunities/create", input).then(async (r) => {
          const result = await withRefresh(r);
          return { ...result, id: r.id };
        }),

      updateOpportunity: async (id, patch) => {
        try {
          await q.updateOpportunityRow(id, patch);
          await load();
          return { ok: true };
        } catch (err: any) {
          return { ok: false, reason: err?.message ?? "Couldn't update that opportunity." };
        }
      },

      deleteOpportunity: async (id) => {
        try {
          await q.deleteOpportunityRow(id);
          await load();
          return { ok: true };
        } catch (err: any) {
          return { ok: false, reason: err?.message ?? "Couldn't delete that opportunity." };
        }
      },

      setOrgApproval: (id, status, reason) =>
        post("/api/admin/organizations", { organizationId: id, status, reason }).then((r) => withRefresh(r)),

      removeStudent: (id) => post("/api/admin/users", { userId: id }).then((r) => withRefresh(r)),

      postAnnouncement: (input) => post("/api/announcements", input).then((r) => withRefresh(r)),

      /**
       * Sends the student to Stripe. Membership is granted by the webhook
       * after payment actually settles, never by this call returning.
       */
      startMembershipCheckout: async () => {
        const result = await post("/api/membership/checkout");
        if (result.ok && result.url) {
          window.location.href = result.url as string;
          return { ok: true };
        }
        return result;
      },

      requestFeeWaiver: (input) => post("/api/membership/waiver", input).then((r) => withRefresh(r)),

      decideWaiver: (requestId, decision, note) =>
        post("/api/admin/waiver", { requestId, decision, note }).then((r) => withRefresh(r)),

      createGoal: async (g) => {
        try {
          await q.insertGoalRow(g);
          await load();
          return { ok: true };
        } catch (err: any) {
          return { ok: false, reason: err?.message ?? "Couldn't create that goal." };
        }
      },

      updateGoal: async (id, patch) => {
        try {
          await q.updateGoalRow(id, patch);
          await load();
          return { ok: true };
        } catch (err: any) {
          return { ok: false, reason: err?.message ?? "Couldn't update that goal." };
        }
      },

      deleteGoal: async (id) => {
        try {
          await q.deleteGoalRow(id);
          await load();
          return { ok: true };
        } catch (err: any) {
          return { ok: false, reason: err?.message ?? "Couldn't delete that goal." };
        }
      },

      markNotificationRead: async (id) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        try {
          await q.markNotificationReadRow(id);
        } catch (err) {
          console.error("[volunteerly] Couldn't mark notification read:", err);
        }
      },

      markAllNotificationsRead: async (userId) => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        try {
          await q.markAllNotificationsReadRow(userId);
        } catch (err) {
          console.error("[volunteerly] Couldn't mark notifications read:", err);
        }
      },

      submitReport: async (r) => {
        try {
          await q.insertReportRow(r as any);
          await load();
          return { ok: true };
        } catch (err: any) {
          return { ok: false, reason: err?.message ?? "Couldn't submit that report." };
        }
      },

      updateReportStatus: async (id, status) => {
        try {
          await q.updateReportStatusRow(id, status);
          await load();
          return { ok: true };
        } catch (err: any) {
          return { ok: false, reason: err?.message ?? "Couldn't update that report." };
        }
      },
    }),
    [
      students,
      organizations,
      opportunities,
      registrations,
      attendanceRecords,
      verifiedHours,
      goals,
      studentAchievements,
      notifications,
      reports,
      announcements,
      qrTokens,
      waiverRequests,
      platformStats,
      loading,
      error,
      load,
      refreshUser,
      withRefresh,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useAppData must be used within a DataProvider");
  return ctx;
}

export { daysUntil } from "@/lib/utils";
