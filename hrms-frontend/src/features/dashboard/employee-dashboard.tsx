"use client";

import { CalendarDays, CalendarPlus, ClipboardList, UserCog } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { TodayStatusCard } from "@/features/attendance/components/today-status-card";
import { MonthSummaryCard } from "@/features/attendance/components/month-summary-card";
import { RecentAnnouncementsWidget } from "@/features/announcements/components/recent-announcements-widget";
import { WelcomeHeader } from "./components/welcome-header";
import { RecentLeaveRequests } from "./components/recent-leave-requests";
import { UpcomingHolidays } from "./components/upcoming-holidays";
import { UpcomingAnniversaries } from "./components/upcoming-anniversaries";
import { QuickActions } from "./components/quick-actions";

const QUICK_ACTIONS = [
  { label: "Apply Leave", href: ROUTES.LEAVE, icon: CalendarPlus },
  { label: "View Attendance", href: ROUTES.ATTENDANCE, icon: CalendarDays },
  { label: "Leave History", href: ROUTES.LEAVE, icon: ClipboardList },
  { label: "Edit Profile", href: ROUTES.PROFILE, icon: UserCog },
];

export function EmployeeDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <WelcomeHeader />

      <QuickActions actions={QUICK_ACTIONS} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TodayStatusCard />
        <MonthSummaryCard />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RecentLeaveRequests />
        <UpcomingHolidays />
        <UpcomingAnniversaries />
        <RecentAnnouncementsWidget />
      </div>
    </div>
  );
}
