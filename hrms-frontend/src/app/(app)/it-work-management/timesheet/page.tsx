"use client";

import { ItWorkManagementGuard } from "@/features/it-work-management/components/it-work-management-guard";
import { ItTimesheetTodayCard } from "@/features/it-work-management/components/it-timesheet-today-card";
import { ItTimesheetHistoryList } from "@/features/it-work-management/components/it-timesheet-history-list";

export default function ItWorkManagementTimesheetPage() {
  return (
    <ItWorkManagementGuard>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Daily Timesheet</h1>
          <p className="text-sm text-muted-foreground">
            A quick daily log — what you worked on today.
          </p>
        </div>

        <ItTimesheetTodayCard />

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold tracking-tight">Previous Entries</h2>
          <ItTimesheetHistoryList />
        </div>
      </div>
    </ItWorkManagementGuard>
  );
}
