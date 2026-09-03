"use client";

import { ItWorkManagementGuard } from "@/features/it-work-management/components/it-work-management-guard";
import { ItScheduleMyGrid } from "@/features/it-work-management/components/it-schedule-my-grid";

export default function ItWorkManagementSchedulePage() {
  return (
    <ItWorkManagementGuard>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Schedule</h1>
          <p className="text-sm text-muted-foreground">
            What you plan to work on over the next 5 working days.
          </p>
        </div>

        <ItScheduleMyGrid />
      </div>
    </ItWorkManagementGuard>
  );
}
