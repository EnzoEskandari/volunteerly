import type { UserRole } from "./types";

export function dashboardPathForRole(role: UserRole): string {
  switch (role) {
    case "student":
      return "/dashboard/student";
    case "organization":
      return "/dashboard/nonprofit";
    case "admin":
      return "/dashboard/admin";
  }
}
