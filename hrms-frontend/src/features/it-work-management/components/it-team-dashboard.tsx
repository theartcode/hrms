"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertOctagon,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  Eye,
  Loader2,
  Plus,
  ShieldAlert,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSection } from "@/features/dashboard/components/dashboard-section";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { ROUTES } from "@/constants/routes";
import { getMyItDashboard, ItMyDashboardFilters } from "@/services/it-work-management.service";
import { IT_DASHBOARD_POLL_INTERVAL_MS } from "../it-dashboard-meta";
import { ItTeamDashboardFiltersBar } from "./it-team-dashboard-filters";
import { ItDashboardTabBar } from "./it-dashboard-tab-bar";
import { ItDashboardWorkItemList } from "./it-dashboard-work-item-list";
import { ItWorkItemGroupTabs } from "./it-work-item-group-tabs";
import { ItTeamDashboardChangesRequested } from "./it-team-dashboard-changes-requested";
import { ItWorkItemProposeDialog } from "./it-work-item-propose-dialog";

type TeamTab = "overview" | "work";

// Phase 1E-B — the IT Team Member Dashboard. Execution-focused: every
// section here is either static data or a link to an existing detail page
// (Work Item detail, Project detail, or the existing Work Items list) —
// nothing on this page assigns, edits, reviews, or changes status directly
// (Part 23 of the brief). Scope is enforced entirely server-side by
// GET /it-work-management/my-dashboard (itTeamOnly + assignedTo-only
// queries — see it-work-item-my-dashboard.service.ts); this component never
// filters a broader dataset down to "mine" client-side.
//
// Redesigned around two tabs instead of eight stacked sections — "Overview"
// (the stat cards plus the two things that need a decision: proposals
// awaiting approval and changes requested on them) and "My Work" (every
// bucket of assigned work as one panel with a sub-nav, via
// ItWorkItemGroupTabs), matching the same pattern used on the IT Head and
// Executive dashboards.
export function ItTeamDashboard() {
  const router = useRouter();
  const [filters, setFilters] = useState<ItMyDashboardFilters>({});
  const [proposeOpen, setProposeOpen] = useState(false);
  const [tab, setTab] = useState<TeamTab>("overview");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["it-my-dashboard", filters],
    queryFn: () => getMyItDashboard(filters),
    refetchInterval: IT_DASHBOARD_POLL_INTERVAL_MS,
  });

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
        <p className="text-sm text-destructive">Couldn&apos;t load your dashboard.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
          {isRefetching && <Loader2 className="h-4 w-4 animate-spin" />}
          Try again
        </Button>
      </div>
    );
  }

  const needsActionCount = data.pendingProposals.length + data.changesRequested.length;

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/60">
        <CardContent className="flex flex-col gap-3 px-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-muted-foreground">Filter every tab below</p>
            <Button size="sm" onClick={() => setProposeOpen(true)}>
              <Plus className="h-4 w-4" />
              Propose Work
            </Button>
          </div>
          <ItTeamDashboardFiltersBar value={filters} onChange={setFilters} />
        </CardContent>
      </Card>

      <ItDashboardTabBar
        value={tab}
        onChange={(k) => setTab(k as TeamTab)}
        tabs={[
          { key: "overview", label: "Overview", icon: Zap, count: needsActionCount, urgent: true },
          { key: "work", label: "My Work", icon: ClipboardList },
        ]}
      />

      {tab === "overview" && (
        <div className="flex flex-col gap-6">
          <DashboardSection
            title="Overview"
            description="Your current work item counts — not a performance measure."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard label="My Active" value={data.summary.myActive} icon={Zap} />
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
                label="Due Soon"
                value={data.summary.dueSoon}
                icon={CalendarClock}
                accentClassName="bg-blue-500/10 text-blue-600 dark:text-blue-400"
                hint={`Next ${data.meta.dueSoonWindowDays} days`}
              />
              <StatCard
                label="Completed Recently"
                value={data.summary.completedRecently}
                accentClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                icon={CheckCircle2}
                hint={`Last ${data.meta.recentCompletedWindowDays} days`}
              />
              <StatCard
                label="Pending Proposals"
                value={data.summary.pendingProposals}
                icon={Clock}
                accentClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              />
            </div>
          </DashboardSection>

          <ItTeamDashboardChangesRequested items={data.changesRequested} />

          <DashboardSection
            title="My Proposals"
            description="Work you've proposed for yourself, awaiting your IT Head's approval."
          >
            <ItDashboardWorkItemList
              items={data.pendingProposals}
              emptyMessage="No proposals waiting on approval."
            />
          </DashboardSection>
        </div>
      )}

      {tab === "work" && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_WORK_ITEMS)}
            >
              View All My Work
            </Button>
          </div>
          <ItWorkItemGroupTabs
            groups={[
              {
                key: "myWork",
                label: "My Work",
                icon: Zap,
                items: data.myWork,
                emptyMessage: "No active work assigned to you.",
                description: "Urgent and high priority first, then overdue and due-soon work.",
              },
              {
                key: "nextUp",
                label: "Next Up",
                icon: ClipboardList,
                items: data.nextUp,
                emptyMessage: "Nothing queued up right now.",
                description: "What to work on next — overdue first, then by priority.",
              },
              {
                key: "inProgress",
                label: "In Progress",
                icon: Zap,
                items: data.inProgress,
                emptyMessage: "You're not currently working on anything.",
              },
              {
                key: "review",
                label: "Waiting for Review",
                icon: Eye,
                items: data.waitingForReview,
                emptyMessage: "Nothing is waiting for review.",
                description: "Submitted and waiting on a reviewer — you can't approve your own work.",
                extraColumn: "submittedAt",
              },
              {
                key: "blocked",
                label: "Blocked",
                icon: ShieldAlert,
                items: data.blocked,
                emptyMessage: "You're not blocked on any work.",
                description: "Longest-blocked first.",
                extraColumn: "blockedSince",
                urgent: true,
              },
              {
                key: "overdue",
                label: "Overdue",
                icon: AlertOctagon,
                items: data.overdue,
                emptyMessage: "No overdue work.",
                description: "Most overdue first.",
                urgent: true,
              },
              {
                key: "dueSoon",
                label: "Due Soon",
                icon: CalendarClock,
                items: data.dueSoon,
                emptyMessage: "Nothing due soon.",
                description: `Due in the next ${data.meta.dueSoonWindowDays} days, not yet overdue.`,
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

      <ItWorkItemProposeDialog open={proposeOpen} onOpenChange={setProposeOpen} />
    </div>
  );
}
