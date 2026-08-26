"use client";

import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, PlayCircle, ShieldAlert } from "lucide-react";
import { ROUTES } from "@/constants/routes";
import { ItExecutiveActivityEntry, ItExecutiveTodaySummary } from "@/types/it-work-management.types";
import { DashboardSection } from "@/features/dashboard/components/dashboard-section";
import { StatCard } from "@/features/dashboard/components/stat-card";
import { IT_WORK_ITEM_ACTIVITY_LABELS } from "../it-work-item-meta";

// Part 18/19 — significant delivery events only (the backend already
// filtered to this whitelist; comments/attachments never reach this feed),
// spanning both Projects and Work Items. Today is a SUMMARY of counts, not
// the Team dashboard's detailed per-junior event list — Part 19 explicitly
// rules that out for this audience.
const PROJECT_ACTIVITY_LABELS: Record<string, string> = {
  IT_PROJECT_CREATED: "Project created",
  IT_PROJECT_STATUS_CHANGED: "Project status changed",
};

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function ItExecutiveActivityFeed({
  recentActivity,
  today,
}: {
  recentActivity: ItExecutiveActivityEntry[];
  today: ItExecutiveTodaySummary;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-6">
      <DashboardSection title="Today's Activity" description="Delivery events so far today.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Completed"
            value={today.completed}
            icon={CheckCircle2}
            accentClassName="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Submitted for Review"
            value={today.submittedForReview}
            icon={Eye}
            accentClassName="bg-amber-500/10 text-amber-600 dark:text-amber-400"
          />
          <StatCard
            label="Blocked"
            value={today.blocked}
            icon={ShieldAlert}
            accentClassName="bg-red-500/10 text-red-600 dark:text-red-400"
          />
          <StatCard label="Projects Moved to Active" value={today.projectsActivated} icon={PlayCircle} />
        </div>
      </DashboardSection>

      <DashboardSection
        title="Recent IT Activity"
        description="Significant delivery events — project and work item milestones only."
      >
        {recentActivity.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            No recent delivery activity.
          </div>
        ) : (
          <div className="flex flex-col gap-1 rounded-lg border p-2">
            {recentActivity.map((entry) => {
              const label =
                entry.targetType === "ITProject"
                  ? (PROJECT_ACTIVITY_LABELS[entry.action] ?? entry.action)
                  : (IT_WORK_ITEM_ACTIVITY_LABELS[entry.action] ?? entry.action);
              const detailRoute =
                entry.targetType === "ITProject"
                  ? ROUTES.IT_WORK_MANAGEMENT_PROJECT_DETAIL(entry.targetId)
                  : ROUTES.IT_WORK_MANAGEMENT_WORK_ITEM_DETAIL(entry.targetId);
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => router.push(detailRoute)}
                  className="flex items-center gap-3 rounded-md p-2 text-left text-sm transition-colors hover:bg-accent"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {label}
                    {entry.label && <span className="text-muted-foreground"> — {entry.label}</span>}
                    {entry.title && <span className="text-muted-foreground"> {entry.title}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTime(entry.createdAt)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
