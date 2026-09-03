"use client";

import { ItWorkManagementGuard } from "@/features/it-work-management/components/it-work-management-guard";
import { ItScheduleTeamGrid } from "@/features/it-work-management/components/it-schedule-team-grid";

export default function ItWorkManagementTeamSchedulePage() {
  return (
    <ItWorkManagementGuard require="manage">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Schedule</h1>
          <p className="text-sm text-muted-foreground">
            The whole team&apos;s next 5 working days, at a glance.
          </p>
        </div>

        <ItScheduleTeamGrid />
      </div>
    </ItWorkManagementGuard>
  );
}
