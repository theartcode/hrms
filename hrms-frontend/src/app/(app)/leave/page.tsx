"use client";

import { useState } from "react";
import { Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { DayStatusEntry } from "@/types/attendance.types";
import { LeaveBalanceCard } from "@/features/leave/components/leave-balance-card";
import { ApplyLeaveDialog } from "@/features/leave/components/apply-leave-dialog";
import { MyLeaveHistory } from "@/features/leave/components/my-leave-history";
import { AttendanceCalendar } from "@/features/attendance/components/attendance-calendar";
import { AttendanceDayDialog } from "@/features/attendance/components/attendance-day-dialog";

export default function LeavePage() {
  const { user } = useAuth();
  const [selectedDay, setSelectedDay] = useState<DayStatusEntry | null>(null);
  const isAdmin = user?.role === ROLES.ADMIN || user?.role === ROLES.SUPER_ADMIN;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leave</h1>
          <p className="text-sm text-muted-foreground">
            Sick, Casual, Annual, and Unpaid leave.
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={ROUTES.LEAVE_ADMIN} />}
            >
              <Users className="h-4 w-4" />
              Leave Requests
            </Button>
          )}
          <ApplyLeaveDialog />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <LeaveBalanceCard />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-2">
          <AttendanceCalendar onDayClick={setSelectedDay} />
          <Card className="p-4">
            <MyLeaveHistory />
          </Card>
        </div>
      </div>

      <AttendanceDayDialog day={selectedDay} onClose={() => setSelectedDay(null)} readOnly />
    </div>
  );
}
