// ─────────────────────────────────────────────────────────────────────────
// Volunteerly domain types
// These mirror the Postgres schema in /supabase/schema.sql. Every table
// listed in the product spec's "Database" section has a matching type here.
// ─────────────────────────────────────────────────────────────────────────

export type UserRole = "student" | "organization" | "admin";

export type CauseCategory =
  | "Animals"
  | "Environment"
  | "Education"
  | "Healthcare"
  | "Food Banks"
  | "Community Events"
  | "Technology"
  | "Sports"
  | "Arts"
  | "Senior Care"
  | "Children"
  | "Homelessness"
  | "Mental Health";

export const CAUSE_CATEGORIES: CauseCategory[] = [
  "Animals",
  "Environment",
  "Education",
  "Healthcare",
  "Food Banks",
  "Community Events",
  "Technology",
  "Sports",
  "Arts",
  "Senior Care",
  "Children",
  "Homelessness",
  "Mental Health",
];

export type WeekDay = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";
export type TimeOfDay = "Morning" | "Afternoon" | "Evening";

export interface BaseUser {
  id: string;
  email: string;
  createdAt: string;
  role: UserRole;
  avatarUrl?: string;
}

export interface Student extends BaseUser {
  role: "student";
  fullName: string;
  bio?: string;
  school?: string;
  gradYear?: number;
  location?: string;
  age?: number;
  interests: CauseCategory[];
  skills: string[];
  languages: string[];
  availableDays: WeekDay[];
  availableTimes: TimeOfDay[];
  travelDistanceMiles: number;
  virtualPreference: "virtual" | "in-person" | "both";
  transportation: boolean;
  onboardingComplete: boolean;
  totalVerifiedHours: number;
  volunteerStreakWeeks: number;
}

export type OrgApprovalStatus = "pending" | "approved" | "rejected" | "suspended";

export interface Organization extends BaseUser {
  role: "organization";
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  ein?: string; // tax ID submitted for approval
  category: CauseCategory[];
  location?: string;
  approvalStatus: OrgApprovalStatus;
  rejectionReason?: string;
  contactName?: string;
  contactPhone?: string;
}

export interface Admin extends BaseUser {
  role: "admin";
  fullName: string;
}

export type AnyUser = Student | Organization | Admin;

export interface Requirement {
  minAge?: number;
  certifications?: string[];
  backgroundCheck?: boolean;
}

export interface VolunteerOpportunity {
  id: string;
  orgId: string;
  orgName: string;
  orgLogoUrl?: string;
  title: string;
  description: string;
  category: CauseCategory;
  date: string; // ISO date
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  location: string;
  isVirtual: boolean;
  lat?: number;
  lng?: number;
  hoursAvailable: number;
  maxVolunteers: number;
  currentVolunteers: number;
  requirements: Requirement;
  status: "open" | "full" | "completed" | "cancelled";
  createdAt: string;
}

export type RegistrationStatus = "registered" | "attended" | "no-show" | "cancelled";

export interface VolunteerRegistration {
  id: string;
  studentId: string;
  opportunityId: string;
  registeredAt: string;
  status: RegistrationStatus;
}

export interface AttendanceRecord {
  id: string;
  registrationId: string;
  opportunityId: string;
  studentId: string;
  qrTokenUsed: string;
  scannedAt: string;
}

export interface VerifiedHours {
  id: string;
  studentId: string;
  opportunityId: string;
  orgId: string;
  orgName: string;
  hours: number;
  activityDescription: string;
  supervisor: string;
  date: string;
  verifiedAt: string;
  verifiedBadge: true;
}

export interface Goal {
  id: string;
  studentId: string;
  type: "hours" | "monthly-cadence" | "org-count" | "custom";
  label: string;
  target: number;
  progress: number;
  deadline?: string;
  createdAt: string;
  completed: boolean;
}

export interface Achievement {
  id: string;
  key: string;
  label: string;
  description: string;
  icon: string; // lucide-react icon name
  category: "milestone" | "cause" | "streak";
}

export interface StudentAchievement {
  studentId: string;
  achievementKey: string;
  earnedAt: string;
}

export type NotificationAudience = "student" | "organization";

export interface AppNotification {
  id: string;
  userId: string;
  audience: NotificationAudience;
  type:
    | "new-opportunity"
    | "upcoming-event"
    | "hour-verified"
    | "announcement"
    | "milestone"
    | "new-registration"
    | "attendance"
    | "verification-reminder"
    | "org-approved"
    | "org-rejected";
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: string;
}

export type ReportStatus = "open" | "investigating" | "resolved" | "dismissed";

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: "student" | "organization" | "opportunity";
  targetId: string;
  targetName: string;
  reason: string;
  details: string;
  status: ReportStatus;
  createdAt: string;
}

export interface QRToken {
  opportunityId: string;
  token: string;
  expiresAt: string;
  used: boolean;
}

export interface PlatformStats {
  students: number;
  organizations: number;
  opportunities: number;
  verifiedHours: number;
}

export interface Announcement {
  id: string;
  orgId: string;
  orgName: string;
  title: string;
  body: string;
  createdAt: string;
  opportunityId?: string;
}
