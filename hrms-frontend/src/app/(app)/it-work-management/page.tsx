"use client";

import { useState } from "react";
import { Boxes, FolderKanban, ListChecks, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ItWorkManagementGuard } from "@/features/it-work-management/components/it-work-management-guard";
import { ItReadOnlyAccessDialog } from "@/features/it-work-management/components/it-readonly-access-dialog";
import { ItHeadDashboard } from "@/features/it-work-management/components/it-head-dashboard";
import { ItTeamDashboard } from "@/features/it-work-management/components/it-team-dashboard";
import { ItExecutiveDashboard } from "@/features/it-work-management/components/it-executive-dashboard";
import { useItWorkManagementAccess } from "@/hooks/use-it-work-management-access";
import { ROUTES } from "@/constants/routes";
import { SettingsCard } from "@/features/administration/components/settings-card";

// Phase 1C-C: Products/Projects are now viewable (not just manageable) by
// any accessible tier — team members and read-only viewers (CEO) both
// reach them, just without the create/edit controls those pages hide from
// non-manage tiers internally.
const CATEGORIES = [
  {
    title: "Products",
    description: "Systems and products IT is responsible for.",
    href: ROUTES.IT_WORK_MANAGEMENT_PRODUCTS,
    icon: Boxes,
  },
  {
    title: "Projects",
    description: "Projects grouped under each IT product.",
    href: ROUTES.IT_WORK_MANAGEMENT_PROJECTS,
    icon: FolderKanban,
  },
  {
    title: "Work Items",
    description: "Day-to-day IT work — created, assigned, and tracked.",
    href: ROUTES.IT_WORK_MANAGEMENT_WORK_ITEMS,
    icon: ListChecks,
  },
];

// Phase 1E-A: this page becomes role-aware. IT Head/Admin/Super Admin
// (canManage) land on the new dashboard instead of the plain tile grid —
// everything the tiles link to is still one click away underneath the
// dashboard, since the sidebar has only this one "IT Work Management"
// entry (no direct Products/Projects/Work Items links exist anywhere
// else).
// Phase 1E-B adds the second branch: a plain IT team member (isTeamMember)
// now gets the execution-focused Team Member Dashboard instead of the tile
// grid — tiles are dropped for this tier since the dashboard's own rows
// already link straight to the relevant Work Item/Project, and Products/
// Projects browsing isn't part of this dashboard's purpose (Part 2 of the
// Phase 1E-B brief: execution-focused, not catalog-browsing).
// Phase 1E-C adds the third and final branch: a read-only viewer (CEO)
// now gets the Executive Dashboard instead of the tile grid too — the
// access-tier model itself is unchanged (Part 40 of the Phase 1E-C brief),
// only this page's rendering branches one tier further.
export default function ItWorkManagementPage() {
  const { canManage, isAdmin, isTeamMember, isReadOnlyViewer, isLoading } = useItWorkManagementAccess();
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);

  return (
    <ItWorkManagementGuard>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">IT Work Management</h1>
            <p className="text-sm text-muted-foreground">
              Products, projects, and work items for the IT team.
            </p>
          </div>
          {/* Admin/Super Admin only, deliberately not IT Head — deciding who
              gets executive read-only visibility is a company-wide call. */}
          {isAdmin && (
            <Button variant="outline" onClick={() => setAccessDialogOpen(true)}>
              <ShieldCheck className="h-4 w-4" />
              Manage Read-Only Access
            </Button>
          )}
        </div>

        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-19 w-full" />
            ))}
          </div>
        )}

        {!isLoading && canManage && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {CATEGORIES.map((category) => (
                <SettingsCard key={category.href} {...category} />
              ))}
            </div>
            <ItHeadDashboard />
          </>
        )}

        {!isLoading && !canManage && isTeamMember && <ItTeamDashboard />}

        {!isLoading && !canManage && !isTeamMember && isReadOnlyViewer && <ItExecutiveDashboard />}

        {!isLoading && !canManage && !isTeamMember && !isReadOnlyViewer && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.map((category) => (
              <SettingsCard key={category.href} {...category} />
            ))}
          </div>
        )}
      </div>

      <ItReadOnlyAccessDialog open={accessDialogOpen} onOpenChange={setAccessDialogOpen} />
    </ItWorkManagementGuard>
  );
}
