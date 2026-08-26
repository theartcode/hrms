"use client";

import { useItWorkManagementAccess } from "@/hooks/use-it-work-management-access";

interface ItWorkManagementGuardProps {
  children: React.ReactNode;
  /**
   * "any" (default) — Admin/Super Admin/IT Head or a plain IT team member.
   * "manage" — Admin/Super Admin/IT Head only. Products and Projects stay
   * manage-only per the backend's itManage gate; Work Items (Phase 1C-A)
   * is the first page a team member can actually reach, since they can
   * view work assigned to them.
   */
  require?: "any" | "manage";
}

// Same "Access restricted" presentation as RoleGuard, but driven by the
// relationship-based check in useItWorkManagementAccess rather than a plain
// role list — RoleGuard itself can't express "Admin, IT Head, or an IT
// team member" (see hooks/use-it-work-management-access.ts).
export function ItWorkManagementGuard({
  children,
  require = "any",
}: ItWorkManagementGuardProps) {
  const { canAccess, canManage } = useItWorkManagementAccess();
  const allowed = require === "manage" ? canManage : canAccess;

  if (!allowed) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">Access restricted</p>
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
