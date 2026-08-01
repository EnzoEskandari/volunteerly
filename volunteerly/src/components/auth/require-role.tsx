"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/context/auth-context";
import { useAppData } from "@/lib/context/data-context";
import type { UserRole } from "@/lib/types";
import { Loader2 } from "lucide-react";
import { dashboardPathForRole } from "@/lib/routes";

/**
 * Client-side route guard.
 *
 * In production, `middleware.ts` performs the same check server-side by
 * reading the Supabase session cookie before the page ever renders (see
 * that file for the equivalent logic). Because this build's auth layer is
 * a mock, localStorage-backed session (no server to read cookies from
 * during SSR), the guard runs here instead, on mount, in the browser.
 */
export function RequireRole({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { currentUser, loading: authLoading } = useAuth();
  const { loading: dataLoading } = useAppData();
  const router = useRouter();
  const loading = authLoading || dataLoading;

  useEffect(() => {
    if (loading) return;
    if (!currentUser) {
      router.replace(`/login?redirectRole=${role}`);
      return;
    }
    if (currentUser.role !== role) {
      router.replace(dashboardPathForRole(currentUser.role));
    }
  }, [loading, currentUser, role, router]);

  if (loading || !currentUser || currentUser.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return <>{children}</>;
}
