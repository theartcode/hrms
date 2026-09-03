"use client";

import { ItWorkManagementGuard } from "@/features/it-work-management/components/it-work-management-guard";
import { ItTimesheetTeamTable } from "@/features/it-work-management/components/it-timesheet-team-table";

export default function ItWorkManagementTeamTimesheetPage() {
  return (
    <ItWorkManagementGuard require="manage">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team Timesheet</h1>
          <p className="text-sm text-muted-foreground">
            See who has submitted today&apos;s work log — and who hasn&apos;t.
          </p>
        </div>

        <ItTimesheetTeamTable />
      </div>
    </ItWorkManagementGuard>
  );
}
