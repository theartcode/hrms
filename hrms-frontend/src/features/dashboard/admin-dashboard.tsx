"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  CalendarClock,
  CalendarHeart,
  ClipboardList,
  FileSpreadsheet,
  History,
  LogIn,
  LogOut,
  Megaphone,
  UserCheck,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { Card, CardContent } from "@/components/ui/card";
import * as dashboardService from "@/services/dashboard.service";
import { STATUS_CHART_COLORS } from "./chart-colors";
import { WelcomeHeader } from "./components/welcome-header";
import { StatCard } from "./components/stat-card";
import { AttendanceListDialog, AttendanceListMode } from "./components/attendance-list-dialog";
import { ChartCard } from "./components/chart-card";
import { DashboardSection } from "./components/dashboard-section";
import { PendingApprovals } from "./components/pending-approvals";
import { UpcomingHolidays } from "./components/upcoming-holidays";
import { UpcomingAnniversaries } from "./components/upcoming-anniversaries";
import { QuickActions } from "./components/quick-actions";
import { TrendAreaChart } from "./components/charts/trend-area-chart";
import { TrendBarChart } from "./components/charts/trend-bar-chart";
import { DistributionBarChart } from "./components/charts/distribution-bar-chart";
import { StatusBarChart } from "./components/charts/status-bar-chart";
import { LEAVE_TYPE_LABELS } from "@/features/leave/leave-status-meta";

const QUICK_ACTIONS = [
  { label: "Add Employee", href: ROUTES.EMPLOYEE_NEW, icon: UserPlus },
  { label: "Leave Requests", href: ROUTES.LEAVE_ADMIN, icon: CalendarClock },
  { label: "View Attendance", href: ROUTES.ATTENDANCE_TEAM, icon: ClipboardList },
  { label: "Manage Holidays", href: ROUTES.ADMINISTRATION_HOLIDAYS, icon: CalendarHeart },
  { label: "Manage Departments", href: ROUTES.ADMINISTRATION_DEPARTMENTS, icon: Building2 },
  { label: "Manage Designations", href: ROUTES.ADMINISTRATION_DESIGNATIONS, icon: UsersRound },
  { label: "Manage Announcements", href: ROUTES.ANNOUNCEMENTS_ADMIN, icon: Megaphone },
  { label: "Activity Center", href: ROUTES.ACTIVITY, icon: History },
  { label: "Adobe Licenses", href: ROUTES.ADMINISTRATION_ADOBE_LICENSES, icon: FileSpreadsheet },
];

const LEAVE_STATUS_COLOR: Record<string, string> = {
  PENDING: STATUS_CHART_COLORS.pending,
  APPROVED: STATUS_CHART_COLORS.approved,
  REJECTED: STATUS_CHART_COLORS.rejected,
  CANCELLED: STATUS_CHART_COLORS.cancelled,
};

const EMPLOYEE_STATUS_COLOR: Record<string, string> = {
  ACTIVE: STATUS_CHART_COLORS.active,
  INACTIVE: STATUS_CHART_COLORS.inactive,
  NOTICE_PERIOD: STATUS_CHART_COLORS.noticePeriod,
  RESIGNED: STATUS_CHART_COLORS.resigned,
  TERMINATED: STATUS_CHART_COLORS.terminated,
};

const EMPLOYEE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  NOTICE_PERIOD: "Notice Period",
  RESIGNED: "Resigned",
  TERMINATED: "Terminated",
};

function formatMonthLabel(ym: string): string {
  const [year, month] = ym.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-US", {
    month: "short",
  });
}

function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00+05:30`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
  });
}

export function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => dashboardService.getAdminDashboard().then((res) => res.data),
  });
  const [attendanceListMode, setAttendanceListMode] = useState<AttendanceListMode>(null);

  return (
    <div className="flex flex-col gap-6">
      <WelcomeHeader />

      <QuickActions actions={QUICK_ACTIONS} />

      <DashboardSection title="Overview" description="Today at a glance">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card
            onClick={() => setAttendanceListMode("checkedIn")}
            role="button"
            tabIndex={0}
            className="group relative cursor-pointer gap-0 overflow-hidden border-border/60 py-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 lg:col-span-2"
          >
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-transparent" />
            <CardContent className="relative flex items-center gap-4 p-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105">
                <UsersRound className="h-5 w-5" />
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-3xl font-bold tracking-tight tabular-nums">
                  {data?.kpis.presentToday ?? "—"}
                </span>
                <span className="truncate text-xs font-medium text-muted-foreground">
                  Present Today · out of {data?.kpis.totalEmployees ?? "—"} total
                </span>
              </div>
            </CardContent>
          </Card>
          <StatCard
            label="Active Employees"
            value={data?.kpis.activeEmployees ?? "—"}
            icon={UserCheck}
            accentClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Checked In Today"
            value={data?.kpis.checkedInToday ?? "—"}
            icon={LogIn}
            accentClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            onClick={() => setAttendanceListMode("checkedIn")}
          />
          <StatCard
            label="Not Checked In"
            value={data?.kpis.notCheckedInToday ?? "—"}
            icon={LogOut}
            accentClassName="bg-rose-500/10 text-rose-600 dark:text-rose-400"
            onClick={() => setAttendanceListMode("notCheckedIn")}
          />
          <StatCard
            label="Late Today"
            value={data?.kpis.lateToday ?? "—"}
            icon={CalendarClock}
            accentClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
          <StatCard
            label="On Leave Today"
            value={data?.kpis.onLeaveToday ?? "—"}
            icon={CalendarHeart}
            accentClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
          />
          <StatCard
            label="Pending Leave Requests"
            value={data?.kpis.pendingLeaveRequests ?? "—"}
            icon={ClipboardList}
            accentClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
        </div>
      </DashboardSection>

      <DashboardSection title="Analytics" description="Attendance & leave trends">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <ChartCard
            title="Daily Attendance Trend"
            description="Last 14 days"
            isLoading={isLoading}
            className="lg:col-span-2"
          >
            <TrendAreaChart
              data={data?.dailyTrend.map((d) => ({ ...d })) ?? []}
              xKey="date"
              xFormatter={formatDayLabel}
              series={[
                { key: "present", label: "Present", color: STATUS_CHART_COLORS.onTime },
                { key: "onLeave", label: "On Leave", color: STATUS_CHART_COLORS.onLeave },
                { key: "absent", label: "Absent", color: STATUS_CHART_COLORS.absent },
              ]}
            />
          </ChartCard>
          <ChartCard
            title="Monthly Attendance Trend"
            description="Last 6 months"
            isLoading={isLoading}
            className="lg:col-span-2"
          >
            <TrendBarChart
              data={data?.monthlyTrend.map((m) => ({ ...m, month: formatMonthLabel(m.month) })) ?? []}
              xKey="month"
              series={[
                { key: "present", label: "Present days", color: STATUS_CHART_COLORS.onTime },
                { key: "leaves", label: "Leave requests", color: STATUS_CHART_COLORS.onLeave },
              ]}
            />
          </ChartCard>
          <ChartCard
            title="Leave Type Distribution"
            description="Approved leave, this year"
            isLoading={isLoading}
            isEmpty={(data?.leaveAnalytics.byType.length ?? 0) === 0}
            className="lg:col-span-2"
          >
            <DistributionBarChart
              data={(data?.leaveAnalytics.byType ?? []).map((t) => ({
                name: LEAVE_TYPE_LABELS[t.leaveType] ?? t.leaveType,
                value: t.count,
                color:
                  t.leaveType === "SICK"
                    ? STATUS_CHART_COLORS.onLeave
                    : t.leaveType === "CASUAL_PAID"
                      ? STATUS_CHART_COLORS.onTime
                      : STATUS_CHART_COLORS.weekend,
              }))}
            />
          </ChartCard>
          <ChartCard
            title="Leave Requests by Status"
            description="This year"
            isLoading={isLoading}
            isEmpty={(data?.leaveAnalytics.byStatus.length ?? 0) === 0}
            className="lg:col-span-2"
          >
            <StatusBarChart
              data={(data?.leaveAnalytics.byStatus ?? []).map((s) => ({
                label: s.status,
                count: s.count,
                color: LEAVE_STATUS_COLOR[s.status] ?? STATUS_CHART_COLORS.weekend,
              }))}
            />
          </ChartCard>
          <ChartCard
            title="Employee Status Breakdown"
            isLoading={isLoading}
            isEmpty={(data?.employeeStatusBreakdown ?? []).every((s) => s.count === 0)}
            className="lg:col-span-4"
          >
            <DistributionBarChart
              data={(data?.employeeStatusBreakdown ?? [])
                .filter((s) => s.count > 0)
                .map((s) => ({
                  name: EMPLOYEE_STATUS_LABEL[s.status] ?? s.status,
                  value: s.count,
                  color: EMPLOYEE_STATUS_COLOR[s.status] ?? STATUS_CHART_COLORS.weekend,
                }))}
            />
          </ChartCard>
        </div>
      </DashboardSection>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <UpcomingHolidays />
        <UpcomingAnniversaries />
      </div>

      <PendingApprovals />

      <AttendanceListDialog mode={attendanceListMode} onClose={() => setAttendanceListMode(null)} />
    </div>
  );
}
