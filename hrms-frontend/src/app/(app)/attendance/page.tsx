"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { DayStatusEntry } from "@/types/attendance.types";
import { TodayStatusCard } from "@/features/attendance/components/today-status-card";
import { MonthSummaryCard } from "@/features/attendance/components/month-summary-card";
import { AttendanceCalendar } from "@/features/attendance/components/attendance-calendar";
import { AttendanceDayDialog } from "@/features/attendance/components/attendance-day-dialog";
import { CorrectionRequestDialog } from "@/features/attendance/components/correction-request-dialog";
import { MyCorrectionsList } from "@/features/attendance/components/my-corrections-list";
import * as attendanceService from "@/services/attendance.service";
import { formatHHMMTo12Hour } from "@/lib/format-ist";

export default function AttendancePage() {
  const { user } = useAuth();
  const [selectedDay, setSelectedDay] = useState<DayStatusEntry | null>(null);
  const [correctionDate, setCorrectionDate] = useState<string | null>(null);
  const isAdmin = user?.role === ROLES.ADMIN || user?.role === ROLES.SUPER_ADMIN;

  const { data: officeHours } = useQuery({
    queryKey: ["office-hours"],
    queryFn: () => attendanceService.getOfficeHours().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <p className="text-sm text-muted-foreground">
            {officeHours
              ? `Office hours ${formatHHMMTo12Hour(officeHours.startTime)} – ${formatHHMMTo12Hour(officeHours.endTime)} IST · ${officeHours.gracePeriodMinutes} min grace period`
              : "Loading office hours…"}
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={ROUTES.ATTENDANCE_TEAM} />}
          >
            <Users className="h-4 w-4" />
            Team Attendance
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TodayStatusCard />
        <MonthSummaryCard />
      </div>

      <AttendanceCalendar onDayClick={setSelectedDay} />

      <MyCorrectionsList />

      <AttendanceDayDialog
        day={selectedDay}
        onClose={() => setSelectedDay(null)}
        onRequestCorrection={(day) => {
          setCorrectionDate(day.date);
          setSelectedDay(null);
        }}
      />

      <CorrectionRequestDialog
        date={correctionDate}
        onClose={() => setCorrectionDate(null)}
      />
    </div>
  );
}
