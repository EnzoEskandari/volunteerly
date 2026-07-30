"use client";

import React from "react";
import { DataProvider } from "@/lib/context/data-context";
import { AuthProvider } from "@/lib/context/auth-context";
import { ToastProvider } from "@/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <DataProvider>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </DataProvider>
  );
}
