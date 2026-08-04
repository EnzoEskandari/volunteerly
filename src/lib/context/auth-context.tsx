"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fetchOwnProfile } from "@/lib/supabase/queries";
import type { AnyUser } from "@/lib/types";

/**
 * Authentication against Supabase Auth — the only source of identity.
 *
 * There is deliberately no demo or shortcut sign-in: every account on
 * Volunteerly is created through real registration, and the session lives
 * in Supabase's httpOnly cookie rather than anything this code can forge.
 */

type AuthResult = { ok: boolean; reason?: string; needsEmailConfirmation?: boolean };

interface AuthContextValue {
  currentUser: AnyUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<AuthResult>;
  loginWithGoogle: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<AuthResult>;
  registerStudent: (input: { fullName: string; email: string; password: string }) => Promise<AuthResult>;
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
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AnyUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    try {
      const profile = await fetchOwnProfile();
      setCurrentUser(profile);
    } catch (err) {
      console.error("[volunteerly] Couldn't load your profile:", err);
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!active) return;
      if (user) await loadProfile();
      if (active) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      if (event === "SIGNED_OUT" || !session) {
        setCurrentUser(null);
        return;
      }
      await loadProfile();
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const loginWithEmail: AuthContextValue["loginWithEmail"] = async (email, password) => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { ok: false, reason: friendlyAuthError(error.message) };
    await loadProfile();
    return { ok: true };
  };

  const loginWithGoogle: AuthContextValue["loginWithGoogle"] = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const sendPasswordReset: AuthContextValue["sendPasswordReset"] = async (email) => {
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/student/profile`,
    });
    if (error) return { ok: false, reason: friendlyAuthError(error.message) };
    return { ok: true };
  };

  /**
   * Registration collects name, email and password — nothing else (spec
   * §4). Everything about interests, availability and age is asked once,
   * during onboarding, so no field is ever requested twice.
   *
   * The profile row itself is created by the on_auth_user_created trigger
   * from this metadata, which is what lets registration work whether or
   * not email confirmation is enabled.
   */
  const registerStudent: AuthContextValue["registerStudent"] = async ({ fullName, email, password }) => {
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { role: "student", full_name: fullName.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    if (error) return { ok: false, reason: friendlyAuthError(error.message) };
    if (!data.session) return { ok: true, needsEmailConfirmation: true };

    await loadProfile();
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
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          role: "organization",
          name: name.trim(),
          ein: ein.trim(),
          website: website?.trim() ?? "",
          contact_name: contactName.trim(),
          description: description?.trim() ?? "",
          category,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard/nonprofit`,
      },
    });

    if (error) return { ok: false, reason: friendlyAuthError(error.message) };
    if (!data.session) return { ok: true, needsEmailConfirmation: true };

    await loadProfile();
    router.push("/dashboard/nonprofit?justRegistered=1");
    return { ok: true };
  };

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setCurrentUser(null);
    router.push("/");
    router.refresh();
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        refreshUser: loadProfile,
        loginWithEmail,
        loginWithGoogle,
        sendPasswordReset,
        registerStudent,
        registerOrganization,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/** Supabase's raw messages are terse; these are the ones users actually hit. */
function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) {
    return "That email and password don't match an account. Check them and try again.";
  }
  if (m.includes("email not confirmed")) {
    return "Please confirm your email address first — check your inbox for the link.";
  }
  if (m.includes("already registered") || m.includes("already been registered")) {
    return "An account with that email already exists. Try signing in instead.";
  }
  if (m.includes("password should be")) {
    return "Please choose a password with at least 6 characters.";
  }
  if (m.includes("rate limit") || m.includes("too many")) {
    return "Too many attempts just now. Please wait a moment and try again.";
  }
  return message;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
