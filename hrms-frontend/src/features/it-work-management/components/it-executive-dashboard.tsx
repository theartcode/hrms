"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Eye,
  FolderKanban,
  Loader2,
  PlayCircle,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSection } from "@/features/dashboard/components/dashboard-section";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { getExecutiveItDashboard, ItExecutiveDashboardFilters } from "@/services/it-work-management.service";
import { ItProjectStatus, ItWorkItemStatus } from "@/types/it-work-management.types";
import { IT_DASHBOARD_POLL_INTERVAL_MS } from "../it-dashboard-meta";
import { IT_PROJECT_STATUS_LABELS } from "../it-project-status-meta";
import { IT_WORK_ITEM_STATUS_LABELS } from "../it-work-item-meta";
import { ItExecutiveFiltersBar } from "./it-executive-filters";
import { ItDashboardTabBar } from "./it-dashboard-tab-bar";
import { ItExecutiveStatusChips } from "./it-executive-status-breakdown";
import { ItDashboardProjectStatus } from "./it-dashboard-project-status";
import { ItExecutiveProductOverview } from "./it-executive-product-overview";
import { ItWorkItemGroupTabs } from "./it-work-item-group-tabs";
import { ItExecutiveActivityFeed } from "./it-executive-activity";

const PROJECT_STATUS_ORDER: ItProjectStatus[] = ["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"];
const WORK_ITEM_STATUS_ORDER: ItWorkItemStatus[] = [
  "REQUESTED",
  "ANALYSIS",
  "PLANNED",
  "ASSIGNED",
  "IN_PROGRESS",
  "IN_REVIEW",
  "BLOCKED",
  "COMPLETED",
  "CANCELLED",
];

type ExecTab = "overview" | "projects" | "work" | "activity";

// Phase 1E-C — the CEO / Executive Dashboard. A business-delivery view
// (PRODUCT -> PROJECT -> DELIVERY -> RISK, Part 3 of the brief): every
// section here is read-only, either a factual count or a link into an
// existing detail page. There is no per-employee workload/ranking anywhere
// on this page — the underlying endpoint never computes that data in the
// first place (see it-work-item-executive-dashboard.service.ts), so there
// is nothing here that could accidentally leak it.
//
// Redesigned around four tabs instead of one long stack — Overview (KPIs +
// what needs attention), Projects (portfolio + product breakdown), Work
// Items (every bucket as one panel via ItWorkItemGroupTabs, plus the full
// status chip breakdown), and Activity — the same tab pattern used on the
// IT Head and Team dashboards.
export function ItExecutiveDashboard() {
  const [filters, setFilters] = useState<ItExecutiveDashboardFilters>({});
  const [tab, setTab] = useState<ExecTab>("overview");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["it-executive-dashboard", filters],
    queryFn: () => getExecutiveItDashboard(filters),
    refetchInterval: IT_DASHBOARD_POLL_INTERVAL_MS,
  });

  const atRiskProjects = useMemo(() => (data ? data.projects.filter((p) => p.atRisk) : []), [data]);

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
        <p className="text-sm text-destructive">Couldn&apos;t load the executive dashboard.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching && <Loader2 className="h-4 w-4 animate-spin" />}
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-3 px-4">
          <p className="text-xs font-medium text-muted-foreground">Filter every tab below</p>
          <ItExecutiveFiltersBar value={filters} onChange={setFilters} />
        </CardContent>
      </Card>

      <ItDashboardTabBar
        value={tab}
        onChange={(k) => setTab(k as ExecTab)}
        tabs={[
          { key: "overview", label: "Overview", icon: Zap, count: atRiskProjects.length, urgent: true },
          { key: "projects", label: "Projects", icon: FolderKanban },
          { key: "work", label: "Work Items", icon: Boxes },
          { key: "activity", label: "Activity", icon: PlayCircle },
        ]}
      />

      {tab === "overview" && (
        <div className="flex flex-col gap-6">
          <DashboardSection
            title="IT Overview"
            description="Current state across every IT product and project — factual counts, not percentages."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard label="Active Projects" value={data.summary.activeProjects} icon={FolderKanban} />
              <StatCard label="Active Work Items" value={data.summary.activeWorkItems} icon={Zap} />
              <StatCard
                label="In Review"
                value={data.summary.inReview}
                icon={Eye}
                accentClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              />
              <StatCard
                label="Blocked"
                value={data.summary.blocked}
                icon={ShieldAlert}
                accentClassName="bg-red-500/10 text-red-600 dark:text-red-400"
              />
              <StatCard
                label="Overdue"
                value={data.summary.overdue}
                icon={AlertOctagon}
                accentClassName="bg-red-500/10 text-red-600 dark:text-red-400"
              />
              <StatCard
                label="Projects at Risk"
                value={data.summary.projectsAtRisk}
                icon={AlertTriangle}
                accentClassName="bg-red-500/10 text-red-600 dark:text-red-400"
              />
            </div>
          </DashboardSection>

          <ItDashboardProjectStatus
            projects={atRiskProjects}
            title="Projects Needing Attention"
            description="Projects that are overdue, blocked, or past their target date — with the reason."
            emptyMessage="No projects need attention right now."
          />
        </div>
      )}

      {tab === "projects" && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <ItDashboardProjectStatus
              projects={data.projects}
              title="Project Portfolio"
              description="Every active IT project, at a glance."
              emptyMessage="No active projects."
            />
            <ItExecutiveStatusChips
              counts={data.projectStatusCounts}
              labels={IT_PROJECT_STATUS_LABELS}
              order={PROJECT_STATUS_ORDER}
            />
          </div>
          <ItExecutiveProductOverview products={data.products} />
        </div>
      )}

      {tab === "work" && (
        <div className="flex flex-col gap-6">
          <DashboardSection title="Work Item Status" description="Every status, company-wide — zero shown cleanly.">
            <ItExecutiveStatusChips
              counts={data.workItemStatusCounts}
              labels={IT_WORK_ITEM_STATUS_LABELS}
              order={WORK_ITEM_STATUS_ORDER}
            />
          </DashboardSection>

          <ItWorkItemGroupTabs
            groups={[
              {
                key: "blocked",
                label: "Blocked",
                icon: ShieldAlert,
                items: data.blocked,
                emptyMessage: "No blocked work.",
                description: "What is stopping delivery, most urgent first.",
                urgent: true,
              },
              {
                key: "overdue",
                label: "Overdue",
                icon: AlertOctagon,
                items: data.overdue,
                emptyMessage: "No overdue work.",
                description: "A delivery signal, not a judgment of anyone's work.",
                urgent: true,
              },
              {
                key: "review",
                label: "In Review",
                icon: Eye,
                items: data.reviewQueue,
                emptyMessage: "No work currently in review.",
                description: "Waiting for review, therefore not yet complete.",
                extraColumn: "submittedAt",
              },
              {
                key: "upcoming",
                label: "Upcoming",
                icon: PlayCircle,
                items: data.upcoming,
                emptyMessage: "Nothing due soon.",
                description: `Due in the next ${data.meta.upcomingWindowDays} days — not a guarantee of on-time delivery.`,
              },
              {
                key: "completed",
                label: "Completed",
                icon: CheckCircle2,
                items: data.recentlyCompleted,
                emptyMessage: "No recent completed work.",
                description: `Completed in the last ${data.meta.recentCompletedWindowDays} days.`,
                extraColumn: "completedAt",
              },
            ]}
          />
        </div>
      )}

      {tab === "activity" && (
        <ItExecutiveActivityFeed recentActivity={data.recentActivity} today={data.today} />
      )}
    </div>
  );
}
