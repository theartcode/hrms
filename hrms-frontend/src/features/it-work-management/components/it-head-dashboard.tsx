"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Eye,
  FolderKanban,
  Loader2,
  PlayCircle,
  ShieldAlert,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSection } from "@/features/dashboard/components/dashboard-section";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { ROUTES } from "@/constants/routes";
import { getItHeadDashboard, ItHeadDashboardFilters } from "@/services/it-work-management.service";
import { IT_DASHBOARD_POLL_INTERVAL_MS } from "../it-dashboard-meta";
import { ItDashboardFiltersBar } from "./it-dashboard-filters";
import { ItDashboardTabBar } from "./it-dashboard-tab-bar";
import { ItDashboardAttentionSection } from "./it-dashboard-attention";
import { ItDashboardTeamWorkload } from "./it-dashboard-team-workload";
import { ItWorkItemGroupTabs } from "./it-work-item-group-tabs";
import { ItDashboardProjectStatus } from "./it-dashboard-project-status";
import { ItDashboardActivityFeed } from "./it-dashboard-activity";
import { ItDashboardPendingProposals } from "./it-dashboard-pending-proposals";

type HeadTab = "overview" | "work" | "team" | "projects" | "activity";

// Phase 1E-A — the IT Head Dashboard. Pure monitoring: every KPI, list, and
// table here is read-only and either static or links to an existing detail
// page (Work Item detail, Project detail, the filtered Work Items list) —
// nothing on this page assigns, edits, or changes status (Part 22 of the
// brief). Access is enforced at the route level, both by the backend
// (itManage on GET /dashboard) and by the caller (app/(app)/it-work-management/
// page.tsx only renders this for canManage — see that file for the
// tier-routing logic).
//
// Redesigned around a tab switcher (matching the existing pill-tab pattern
// on the Employee Profile page) instead of one long stack of ~12 full-width
// sections — the six near-identical work-item-bucket sections (In Progress/
// Review/Blocked/Overdue/Upcoming/Completed) now live in ItWorkItemGroupTabs
// as one panel with a sub-nav, and everything else is grouped by what it's
// for (things to act on, work, team, projects, activity) rather than by
// scroll order.
export function ItHeadDashboard() {
  const router = useRouter();
  const [filters, setFilters] = useState<ItHeadDashboardFilters>({});
  const [tab, setTab] = useState<HeadTab>("overview");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["it-head-dashboard", filters],
    queryFn: () => getItHeadDashboard(filters),
    refetchInterval: IT_DASHBOARD_POLL_INTERVAL_MS,
  });

  const goToWorkItems = (params: Record<string, string>) => {
    const qs = new URLSearchParams(params).toString();
    router.push(`${ROUTES.IT_WORK_MANAGEMENT_WORK_ITEMS}${qs ? `?${qs}` : ""}`);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-19 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
        <AlertCircle className="h-6 w-6 text-destructive" />
        <p className="text-sm text-destructive">Couldn&apos;t load the dashboard.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching && <Loader2 className="h-4 w-4 animate-spin" />}
          Try again
        </Button>
      </div>
    );
  }

  const attentionCount =
    data.attention.blocked.length +
    data.attention.reviewRequired.length +
    data.attention.overdue.length +
    data.attention.dueSoon.length;
  const needsActionCount = attentionCount + data.pendingProposals.length;
  const atRiskCount = data.projects.filter((p) => p.atRisk).length;

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-3 px-4">
          <p className="text-xs font-medium text-muted-foreground">Filter every tab below</p>
          <ItDashboardFiltersBar value={filters} onChange={setFilters} />
        </CardContent>
      </Card>

      <ItDashboardTabBar
        value={tab}
        onChange={(k) => setTab(k as HeadTab)}
        tabs={[
          { key: "overview", label: "Overview", icon: Zap, count: needsActionCount, urgent: true },
          { key: "work", label: "Work Items", icon: Activity },
          { key: "team", label: "Team", icon: Users },
          { key: "projects", label: "Projects", icon: FolderKanban, count: atRiskCount, urgent: true },
          { key: "activity", label: "Activity", icon: PlayCircle },
        ]}
      />

      {tab === "overview" && (
        <div className="flex flex-col gap-6">
          <DashboardSection
            title="Overview"
            description="Current counts across every IT product, project, and work item — not a percentage or a forecast."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Active" value={data.summary.active} icon={Zap} />
              <StatCard
                label="In Review"
                value={data.summary.inReview}
                icon={Eye}
                accentClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
                onClick={() => goToWorkItems({ status: "IN_REVIEW" })}
              />
              <StatCard
                label="Blocked"
                value={data.summary.blocked}
                icon={ShieldAlert}
                accentClassName="bg-red-500/10 text-red-600 dark:text-red-400"
                onClick={() => goToWorkItems({ status: "BLOCKED" })}
              />
              <StatCard
                label="Overdue"
                value={data.summary.overdue}
                icon={AlertOctagon}
                accentClassName="bg-red-500/10 text-red-600 dark:text-red-400"
              />
              <StatCard
                label="Completed Recently"
                value={data.summary.completedRecently}
                icon={CheckCircle2}
                accentClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                hint={`Last ${data.meta.recentCompletedWindowDays} days`}
              />
              <StatCard
                label="Projects At Risk"
                value={data.summary.projectsAtRisk}
                icon={AlertTriangle}
                accentClassName="bg-red-500/10 text-red-600 dark:text-red-400"
              />
              <StatCard
                label="Pending Proposals"
                value={data.summary.pendingProposals}
                icon={Clock}
                accentClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              />
            </div>
          </DashboardSection>

          <ItDashboardPendingProposals items={data.pendingProposals} />

          <ItDashboardAttentionSection attention={data.attention} />
        </div>
      )}

      {tab === "work" && (
        <ItWorkItemGroupTabs
          groups={[
            {
              key: "inProgress",
              label: "In Progress",
              icon: Zap,
              items: data.inProgress,
              emptyMessage: "Nothing in progress right now.",
            },
            {
              key: "review",
              label: "Review Queue",
              icon: Eye,
              items: data.reviewQueue,
              emptyMessage: "Nothing waiting for review.",
              description: "Waiting on a review decision, oldest first.",
              extraColumn: "submittedAt",
            },
            {
              key: "blocked",
              label: "Blocked",
              icon: ShieldAlert,
              items: data.blocked,
              emptyMessage: "Nothing blocked.",
              description: "Longest-blocked first.",
              extraColumn: "blockedSince",
              urgent: true,
            },
            {
              key: "overdue",
              label: "Overdue",
              icon: AlertOctagon,
              items: data.overdue,
              emptyMessage: "Nothing overdue.",
              description: "Most overdue first.",
              urgent: true,
            },
            {
              key: "upcoming",
              label: "Upcoming",
              icon: CalendarClock,
              items: data.upcoming,
              emptyMessage: "Nothing due soon.",
              description: `Due in the next ${data.meta.upcomingWindowDays} days, not yet overdue.`,
            },
            {
              key: "completed",
              label: "Completed",
              icon: CheckCircle2,
              items: data.recentlyCompleted,
              emptyMessage: "Nothing completed recently.",
              description: `Completed in the last ${data.meta.recentCompletedWindowDays} days.`,
              extraColumn: "completedAt",
            },
          ]}
        />
      )}

      {tab === "team" && <ItDashboardTeamWorkload team={data.team} />}

      {tab === "projects" && <ItDashboardProjectStatus projects={data.projects} />}

      {tab === "activity" && (
        <ItDashboardActivityFeed
          recentActivity={data.recentActivity}
          todaysTeamActivity={data.todaysTeamActivity}
        />
      )}
    </div>
  );
}
