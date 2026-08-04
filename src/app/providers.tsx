"use client";

import React from "react";
import { DataProvider } from "@/lib/context/data-context";
import { AuthProvider } from "@/lib/context/auth-context";
import { ToastProvider } from "@/components/ui/toast";

/**
 * AuthProvider sits outside DataProvider: identity resolves first, and the
 * data layer then loads only what that particular user is entitled to.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DataProvider>
        <ToastProvider>{children}</ToastProvider>
      </DataProvider>
    </AuthProvider>
  );
}
