"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppData } from "./data-context";
import { genId } from "@/lib/utils";
import { isMockMode } from "@/lib/mode";
import { createClient } from "@/lib/supabase/client";
import { createStudentProfile, createOrganizationProfile } from "@/lib/supabase/queries";
import type { AnyUser, Student, Organization } from "@/lib/types";

const SESSION_KEY = "volunteerly_session_v1";
const MOCK = isMockMode();

type AuthResult = { ok: boolean; reason?: string; needsEmailConfirmation?: boolean };

interface AuthContextValue {
  currentUser: AnyUser | null;
  loading: boolean;
  loginWithEmail: (email: string, password?: string) => Promise<AuthResult>;
  loginAsDemo: (userId: string) => void;
  loginWithGoogle: () => void;
  registerStudent: (input: { fullName: string; email: string; password: string; age?: number }) => Promise<AuthResult>;
  registerOrganization: (input: {
    name: string;
    email: string;
    password: string;
    ein: string;
    website?: string;
    contactName: string;
    category: string[];
    description?: string;
  }) => Promise<AuthResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const data = useAppData();
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AnyUser | null>(null);
  const [loading, setLoading] = useState(true);
  // The authenticated user's id, resolved separately from the actual profile
  // object — the profile itself only becomes available once data-context has
  // finished fetching, which can happen a beat after auth resolves.
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  // ── Resolve who's logged in ──────────────────────────────────────────
  useEffect(() => {
    if (MOCK) {
      try {
        const raw = window.localStorage.getItem(SESSION_KEY);
        if (raw) setActiveUserId(JSON.parse(raw).id);
      } catch {
        // ignore corrupt session
      }
      setLoading(false);
      return;
    }

    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setActiveUserId(session?.user.id ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setActiveUserId(session?.user.id ?? null);
      if (session?.user.id) data.refetch();
    });

    return () => sub.subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Once we know *who*, look their profile up in whatever data-context has
  // loaded (localStorage in mock mode, Supabase everywhere else).
  useEffect(() => {
    if (!activeUserId) {
      setCurrentUser(null);
      return;
    }
    const found =
      data.students.find((s) => s.id === activeUserId) ??
      data.organizations.find((o) => o.id === activeUserId) ??
      data.admins.find((a) => a.id === activeUserId) ??
      null;
    setCurrentUser(found as AnyUser | null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUserId, data.students, data.organizations, data.admins]);

  const persistMockSession = (user: AnyUser) => {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify({ id: user.id, role: user.role }));
    setActiveUserId(user.id);
  };

  // ── Login ─────────────────────────────────────────────────────────────
  const loginWithEmail: AuthContextValue["loginWithEmail"] = async (email, password) => {
    if (MOCK) {
      const normalized = email.trim().toLowerCase();
      const found =
        data.students.find((s) => s.email.toLowerCase() === normalized) ??
        data.organizations.find((o) => o.email.toLowerCase() === normalized) ??
        data.admins.find((a) => a.email.toLowerCase() === normalized);
      if (!found) return { ok: false, reason: "No account found with that email. Try registering instead." };
      persistMockSession(found as AnyUser);
      return { ok: true };
    }

    const supabase = createClient();
    const { data: signInData, error } = await supabase.auth.signInWithPassword({
      email,
      password: password ?? "",
    });
    if (error) return { ok: false, reason: error.message };
    setActiveUserId(signInData.user.id);
    data.refetch();
    return { ok: true };
  };

  const loginAsDemo = (userId: string) => {
    if (!MOCK) return; // demo accounts only make sense against local mock data
    const found =
      data.students.find((s) => s.id === userId) ??
      data.organizations.find((o) => o.id === userId) ??
      data.admins.find((a) => a.id === userId);
    if (found) persistMockSession(found as AnyUser);
  };

  const loginWithGoogle = () => {
    if (MOCK) {
      loginAsDemo("stu_1");
      return;
    }
    const supabase = createClient();
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  // ── Registration ──────────────────────────────────────────────────────
  const registerStudent: AuthContextValue["registerStudent"] = async ({ fullName, email, password, age }) => {
    const base: Omit<Student, "id" | "email" | "role" | "createdAt"> = {
      fullName,
      age,
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
    };

    if (MOCK) {
      const student: Student = { id: genId("stu"), email, role: "student", createdAt: new Date().toISOString(), ...base };
      data.addStudent(student);
      persistMockSession(student);
      router.push("/onboarding");
      return { ok: true };
    }

    const supabase = createClient();
    const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, reason: error.message };
    const userId = signUpData.user?.id;
    if (!userId) return { ok: false, reason: "Something went wrong creating your account." };

    try {
      await createStudentProfile(userId, email, base);
    } catch (e: any) {
      return { ok: false, reason: e.message ?? "Couldn't finish setting up your profile." };
    }

    const student: Student = { id: userId, email, role: "student", createdAt: new Date().toISOString(), ...base };
    data.addStudent(student);

    if (!signUpData.session) {
      return { ok: true, needsEmailConfirmation: true };
    }
    setActiveUserId(userId);
    router.push("/onboarding");
    return { ok: true };
  };

  const registerOrganization: AuthContextValue["registerOrganization"] = async ({
    name,
    email,
    password,
    ein,
    website,
    contactName,
    category,
    description,
  }) => {
    const base: Omit<Organization, "id" | "email" | "role" | "createdAt"> = {
      name,
      ein,
      website,
      contactName,
      description,
      category: category as Organization["category"],
      approvalStatus: "pending",
    };

    if (MOCK) {
      const org: Organization = { id: genId("org"), email, role: "organization", createdAt: new Date().toISOString(), ...base };
      data.addOrganization(org);
      persistMockSession(org);
      router.push("/dashboard/nonprofit?justRegistered=1");
      return { ok: true };
    }

    const supabase = createClient();
    const { data: signUpData, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, reason: error.message };
    const userId = signUpData.user?.id;
    if (!userId) return { ok: false, reason: "Something went wrong creating your account." };

    try {
      await createOrganizationProfile(userId, email, base);
    } catch (e: any) {
      return { ok: false, reason: e.message ?? "Couldn't finish setting up your organization." };
    }

    const org: Organization = { id: userId, email, role: "organization", createdAt: new Date().toISOString(), ...base };
    data.addOrganization(org);

    if (!signUpData.session) {
      return { ok: true, needsEmailConfirmation: true };
    }
    setActiveUserId(userId);
    router.push("/dashboard/nonprofit?justRegistered=1");
    return { ok: true };
  };

  const logout = () => {
    setCurrentUser(null);
    setActiveUserId(null);
    if (MOCK) {
      window.localStorage.removeItem(SESSION_KEY);
    } else {
      createClient().auth.signOut();
    }
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
