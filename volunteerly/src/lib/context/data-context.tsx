"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as seed from "@/lib/mock-data";
import { genId, daysUntil } from "@/lib/utils";
import { isEligible } from "@/lib/matching";
import type {
  Student,
  Organization,
  Admin,
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
  OrgApprovalStatus,
} from "@/lib/types";

const STORAGE_KEY = "volunteerly_db_v1";

interface DBShape {
  students: Student[];
  organizations: Organization[];
  admins: Admin[];
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
}

function seedDB(): DBShape {
  return {
    students: seed.students,
    organizations: seed.organizations,
    admins: seed.admins,
    opportunities: seed.opportunities,
    registrations: seed.registrations,
    attendanceRecords: seed.attendanceRecords,
    verifiedHours: seed.verifiedHours,
    goals: seed.goals,
    studentAchievements: seed.studentAchievements,
    notifications: seed.notifications,
    reports: seed.reports,
    announcements: seed.announcements,
    qrTokens: seed.qrTokens,
  };
}

interface DataContextValue extends DBShape {
  achievementsCatalog: typeof seed.achievementsCatalog;
  platformStats: typeof seed.platformStatsSeed;
  resetDemoData: () => void;

  // Students
  addStudent: (s: Student) => void;
  updateStudent: (id: string, patch: Partial<Student>) => void;
  removeStudent: (id: string) => void;

  // Organizations
  addOrganization: (o: Organization) => void;
  updateOrganization: (id: string, patch: Partial<Organization>) => void;
  setOrgApproval: (id: string, status: OrgApprovalStatus, reason?: string) => void;

  // Opportunities
  createOpportunity: (o: VolunteerOpportunity) => void;
  updateOpportunity: (id: string, patch: Partial<VolunteerOpportunity>) => void;
  deleteOpportunity: (id: string) => void;

  // Registrations / join flow
  joinOpportunity: (studentId: string, opportunityId: string) => { ok: boolean; reason?: string };
  cancelRegistration: (registrationId: string) => void;

  // QR check-in
  checkIn: (studentId: string, token: string) => { ok: boolean; reason?: string };

  // Hour verification
  verifyHours: (input: Omit<VerifiedHours, "id" | "verifiedAt" | "verifiedBadge" | "orgName">) => void;

  // Goals
  createGoal: (g: Goal) => void;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;

  // Notifications
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: (userId: string) => void;
  pushNotification: (n: Omit<AppNotification, "id" | "createdAt" | "read">) => void;

  // Announcements
  postAnnouncement: (a: Omit<Announcement, "id" | "createdAt">) => void;

  // Reports (moderation)
  submitReport: (r: Omit<Report, "id" | "createdAt" | "status">) => void;
  updateReportStatus: (id: string, status: Report["status"]) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DBShape>(seedDB);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount (client only)
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setDb(JSON.parse(raw));
    } catch {
      // corrupt/blocked storage — fall back to seed data silently
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // storage full or unavailable — demo continues in-memory
    }
  }, [db, hydrated]);

  const resetDemoData = () => {
    window.localStorage.removeItem(STORAGE_KEY);
    setDb(seedDB());
  };

  // ── Students ─────────────────────────────────────────────────────────
  const addStudent = (s: Student) => setDb((d) => ({ ...d, students: [...d.students, s] }));
  const updateStudent = (id: string, patch: Partial<Student>) =>
    setDb((d) => ({ ...d, students: d.students.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));

  const removeStudent = (id: string) =>
    setDb((d) => ({
      ...d,
      students: d.students.filter((s) => s.id !== id),
      registrations: d.registrations.filter((r) => r.studentId !== id),
    }));

  // ── Organizations ────────────────────────────────────────────────────
  const addOrganization = (o: Organization) => setDb((d) => ({ ...d, organizations: [...d.organizations, o] }));
  const updateOrganization = (id: string, patch: Partial<Organization>) =>
    setDb((d) => ({ ...d, organizations: d.organizations.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

  const setOrgApproval = (id: string, status: OrgApprovalStatus, reason?: string) => {
    updateOrganization(id, { approvalStatus: status, rejectionReason: reason });
    pushNotification({
      userId: id,
      audience: "organization",
      type: status === "approved" ? "org-approved" : "org-rejected",
      title: status === "approved" ? "Your organization is approved!" : "Your registration needs attention",
      body:
        status === "approved"
          ? "You're all set to publish volunteer opportunities on Volunteerly."
          : reason ?? "An administrator has reviewed your registration.",
    });
  };

  // ── Opportunities ────────────────────────────────────────────────────
  const createOpportunity = (o: VolunteerOpportunity) => {
    const qrToken: QRToken = {
      opportunityId: o.id,
      token: `qr_${o.id}_${genId("").slice(1)}`,
      expiresAt: `${o.date}T${o.endTime}:00`,
      used: false,
    };
    setDb((d) => ({ ...d, opportunities: [o, ...d.opportunities], qrTokens: [...d.qrTokens, qrToken] }));
  };

  const updateOpportunity = (id: string, patch: Partial<VolunteerOpportunity>) =>
    setDb((d) => ({ ...d, opportunities: d.opportunities.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));

  const deleteOpportunity = (id: string) =>
    setDb((d) => ({ ...d, opportunities: d.opportunities.filter((o) => o.id !== id) }));

  // ── Registration / join flow ────────────────────────────────────────
  const joinOpportunity = (studentId: string, opportunityId: string) => {
    const opp = db.opportunities.find((o) => o.id === opportunityId);
    const student = db.students.find((s) => s.id === studentId);
    if (!opp || !student) return { ok: false, reason: "Opportunity or student not found." };

    const already = db.registrations.some(
      (r) => r.studentId === studentId && r.opportunityId === opportunityId && r.status !== "cancelled",
    );
    if (already) return { ok: false, reason: "You're already registered for this event." };

    const eligibility = isEligible(student, opp);
    if (!eligibility.eligible) return { ok: false, reason: eligibility.reason };

    const reg: VolunteerRegistration = {
      id: genId("reg"),
      studentId,
      opportunityId,
      registeredAt: new Date().toISOString(),
      status: "registered",
    };

    setDb((d) => ({
      ...d,
      registrations: [...d.registrations, reg],
      opportunities: d.opportunities.map((o) =>
        o.id === opportunityId
          ? {
              ...o,
              currentVolunteers: o.currentVolunteers + 1,
              status: o.currentVolunteers + 1 >= o.maxVolunteers ? "full" : o.status,
            }
          : o,
      ),
    }));

    pushNotification({
      userId: opp.orgId,
      audience: "organization",
      type: "new-registration",
      title: "New volunteer registered",
      body: `${student.fullName} joined ${opp.title}.`,
      link: `/dashboard/nonprofit/opportunities/${opp.id}`,
    });

    return { ok: true };
  };

  const cancelRegistration = (registrationId: string) => {
    const reg = db.registrations.find((r) => r.id === registrationId);
    if (!reg) return;
    setDb((d) => ({
      ...d,
      registrations: d.registrations.map((r) => (r.id === registrationId ? { ...r, status: "cancelled" } : r)),
      opportunities: d.opportunities.map((o) =>
        o.id === reg.opportunityId
          ? { ...o, currentVolunteers: Math.max(0, o.currentVolunteers - 1), status: "open" }
          : o,
      ),
    }));
  };

  // ── QR check-in ──────────────────────────────────────────────────────
  const checkIn = (studentId: string, token: string) => {
    const qr = db.qrTokens.find((q) => q.token === token);
    if (!qr) return { ok: false, reason: "This QR code isn't recognized." };
    if (qr.used && qr.opportunityId) {
      const alreadyScanned = db.attendanceRecords.some(
        (a) => a.studentId === studentId && a.opportunityId === qr.opportunityId,
      );
      if (alreadyScanned) return { ok: false, reason: "You've already checked in to this event." };
    }
    if (new Date(qr.expiresAt).getTime() < Date.now()) {
      return { ok: false, reason: "This QR code has expired." };
    }
    const reg = db.registrations.find(
      (r) => r.studentId === studentId && r.opportunityId === qr.opportunityId && r.status !== "cancelled",
    );
    if (!reg) return { ok: false, reason: "You aren't registered for this event." };

    const record: AttendanceRecord = {
      id: genId("att"),
      registrationId: reg.id,
      opportunityId: qr.opportunityId,
      studentId,
      qrTokenUsed: token,
      scannedAt: new Date().toISOString(),
    };

    setDb((d) => ({
      ...d,
      attendanceRecords: [...d.attendanceRecords, record],
      registrations: d.registrations.map((r) => (r.id === reg.id ? { ...r, status: "attended" } : r)),
      qrTokens: d.qrTokens.map((q) => (q.token === token ? { ...q, used: true } : q)),
    }));

    const opp = db.opportunities.find((o) => o.id === qr.opportunityId);
    const student = db.students.find((s) => s.id === studentId);
    if (opp && student) {
      pushNotification({
        userId: opp.orgId,
        audience: "organization",
        type: "attendance",
        title: "Attendance recorded",
        body: `${student.fullName} checked in to ${opp.title} via QR code.`,
      });
    }

    return { ok: true };
  };

  // ── Hour verification ───────────────────────────────────────────────
  const verifyHours: DataContextValue["verifyHours"] = (input) => {
    const org = db.organizations.find((o) => o.id === input.orgId);
    const record: VerifiedHours = {
      ...input,
      id: genId("vh"),
      orgName: org?.name ?? "Organization",
      verifiedAt: new Date().toISOString(),
      verifiedBadge: true,
    };

    setDb((d) => ({
      ...d,
      verifiedHours: [record, ...d.verifiedHours],
      students: d.students.map((s) =>
        s.id === input.studentId ? { ...s, totalVerifiedHours: s.totalVerifiedHours + input.hours } : s,
      ),
    }));

    pushNotification({
      userId: input.studentId,
      audience: "student",
      type: "hour-verified",
      title: `Hours verified by ${org?.name ?? "an organization"}`,
      body: `${input.hours} hours from ${input.activityDescription.slice(0, 60)} were just verified.`,
      link: "/dashboard/student/transcript",
    });

    return record;
  };

  // ── Goals ────────────────────────────────────────────────────────────
  const createGoal = (g: Goal) => setDb((d) => ({ ...d, goals: [...d.goals, g] }));
  const updateGoal = (id: string, patch: Partial<Goal>) =>
    setDb((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  const deleteGoal = (id: string) => setDb((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }));

  // ── Notifications ────────────────────────────────────────────────────
  const markNotificationRead = (id: string) =>
    setDb((d) => ({ ...d, notifications: d.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) }));

  const markAllNotificationsRead = (userId: string) =>
    setDb((d) => ({
      ...d,
      notifications: d.notifications.map((n) => (n.userId === userId ? { ...n, read: true } : n)),
    }));

  const pushNotification: DataContextValue["pushNotification"] = (n) =>
    setDb((d) => ({
      ...d,
      notifications: [
        { ...n, id: genId("notif"), createdAt: new Date().toISOString(), read: false },
        ...d.notifications,
      ],
    }));

  // ── Announcements ────────────────────────────────────────────────────
  const postAnnouncement: DataContextValue["postAnnouncement"] = (a) =>
    setDb((d) => ({ ...d, announcements: [{ ...a, id: genId("ann"), createdAt: new Date().toISOString() }, ...d.announcements] }));

  // ── Reports / moderation ────────────────────────────────────────────
  const submitReport: DataContextValue["submitReport"] = (r) =>
    setDb((d) => ({
      ...d,
      reports: [{ ...r, id: genId("report"), createdAt: new Date().toISOString(), status: "open" }, ...d.reports],
    }));

  const updateReportStatus = (id: string, status: Report["status"]) =>
    setDb((d) => ({ ...d, reports: d.reports.map((r) => (r.id === id ? { ...r, status } : r)) }));

  const value = useMemo<DataContextValue>(
    () => ({
      ...db,
      achievementsCatalog: seed.achievementsCatalog,
      platformStats: seed.platformStatsSeed,
      resetDemoData,
      addStudent,
      updateStudent,
      removeStudent,
      addOrganization,
      updateOrganization,
      setOrgApproval,
      createOpportunity,
      updateOpportunity,
      deleteOpportunity,
      joinOpportunity,
      cancelRegistration,
      checkIn,
      verifyHours,
      createGoal,
      updateGoal,
      deleteGoal,
      markNotificationRead,
      markAllNotificationsRead,
      pushNotification,
      postAnnouncement,
      submitReport,
      updateReportStatus,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useAppData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useAppData must be used within a DataProvider");
  return ctx;
}

export { daysUntil };
