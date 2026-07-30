"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "./data-context";
import { genId } from "@/lib/utils";
import type { AnyUser, Student, Organization } from "@/lib/types";

const SESSION_KEY = "volunteerly_session_v1";

interface AuthContextValue {
  currentUser: AnyUser | null;
  loading: boolean;
  /**
   * Mock sign-in. In production this becomes:
   *   await supabase.auth.signInWithPassword({ email, password })
   * Here we just look the email up across students/organizations/admins,
   * since password verification requires a real auth backend.
   */
  loginWithEmail: (email: string) => { ok: boolean; reason?: string };
  loginAsDemo: (userId: string) => void;
  loginWithGoogle: () => void;
  registerStudent: (input: { fullName: string; email: string; age?: number }) => void;
  registerOrganization: (input: {
    name: string;
    email: string;
    ein: string;
    website?: string;
    contactName: string;
    category: string[];
  }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const data = useAppData();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AnyUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(SESSION_KEY);
      if (raw) {
        const { id } = JSON.parse(raw);
        const found =
          data.students.find((s) => s.id === id) ??
          data.organizations.find((o) => o.id === id) ??
          data.admins.find((a) => a.id === id) ??
          null;
        setCurrentUser(found as AnyUser | null);
      }
    } catch {
      // ignore corrupt session
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep currentUser fresh as the underlying record changes (e.g. profile edits)
  useEffect(() => {
    if (!currentUser) return;
    const fresh =
      data.students.find((s) => s.id === currentUser.id) ??
      data.organizations.find((o) => o.id === currentUser.id) ??
      data.admins.find((a) => a.id === currentUser.id) ??
      null;
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(currentUser)) {
      setCurrentUser(fresh as AnyUser);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.students, data.organizations, data.admins]);

  const persistSession = (user: AnyUser) => {
    setCurrentUser(user);
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, role: user.role }));
  };

  const loginWithEmail: AuthContextValue["loginWithEmail"] = (email) => {
    const normalized = email.trim().toLowerCase();
    const found =
      data.students.find((s) => s.email.toLowerCase() === normalized) ??
      data.organizations.find((o) => o.email.toLowerCase() === normalized) ??
      data.admins.find((a) => a.email.toLowerCase() === normalized);
    if (!found) return { ok: false, reason: "No account found with that email. Try registering instead." };
    persistSession(found as AnyUser);
    return { ok: true };
  };

  const loginAsDemo = (userId: string) => {
    const found =
      data.students.find((s) => s.id === userId) ??
      data.organizations.find((o) => o.id === userId) ??
      data.admins.find((a) => a.id === userId);
    if (found) persistSession(found as AnyUser);
  };

  const loginWithGoogle = () => {
    // Production implementation:
    //   await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } })
    // Mock mode signs in the seeded demo student so the flow is explorable end to end.
    loginAsDemo("stu_1");
  };

  const registerStudent: AuthContextValue["registerStudent"] = ({ fullName, email, age }) => {
    const student: Student = {
      id: genId("stu"),
      email,
      role: "student",
      createdAt: new Date().toISOString(),
      fullName,
      interests: [],
      skills: [],
      languages: [],
      availableDays: [],
      availableTimes: [],
      travelDistanceMiles: 10,
      virtualPreference: "both",
      transportation: false,
      onboardingComplete: false,
      totalVerifiedHours: 0,
      volunteerStreakWeeks: 0,
      membershipActive: false,
      age,
    };
    data.addStudent(student);
    persistSession(student);
    router.push("/onboarding");
  };

  const registerOrganization: AuthContextValue["registerOrganization"] = ({
    name,
    email,
    ein,
    website,
    contactName,
    category,
  }) => {
    const org: Organization = {
      id: genId("org"),
      email,
      role: "organization",
      createdAt: new Date().toISOString(),
      name,
      ein,
      website,
      contactName,
      category: category as Organization["category"],
      approvalStatus: "pending",
    };
    data.addOrganization(org);
    persistSession(org);
    router.push("/dashboard/nonprofit?justRegistered=1");
  };

  const logout = () => {
    setCurrentUser(null);
    window.localStorage.removeItem(SESSION_KEY);
    router.push("/");
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        loginWithEmail,
        loginAsDemo,
        loginWithGoogle,
        registerStudent,
        registerOrganization,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
