"use client";

import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { ItDashboardActivityEntry, ItDashboardTeamActivityEntry } from "@/types/it-work-management.types";
import { DashboardSection } from "@/features/dashboard/components/dashboard-section";
import { IT_WORK_ITEM_ACTIVITY_LABELS } from "../it-work-item-meta";

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function activityLine(action: string, displayId: string | null): string {
  const label = IT_WORK_ITEM_ACTIVITY_LABELS[action] ?? action;
  return displayId ? `${label} ${displayId}` : label;
}

// Reuses the same event log the per-work-item timeline already renders
// (Phase 1D-A/B/C's IT_WORK_ITEM_ACTIVITY_LABELS) — this is the same data,
// just read globally instead of scoped to one item, so no new label set was
// invented. Both lists explicitly frame themselves as events, not hours
// worked (Part 14/33 of the brief).
export function ItDashboardActivityFeed({
  recentActivity,
  todaysTeamActivity,
}: {
  recentActivity: ItDashboardActivityEntry[];
  todaysTeamActivity: ItDashboardTeamActivityEntry[];
}) {
  const router = useRouter();

  const groupedToday = new Map<string, { fullName: string; entries: ItDashboardTeamActivityEntry[] }>();
  for (const entry of todaysTeamActivity) {
    const group = groupedToday.get(entry.actorId);
    if (group) {
      group.entries.push(entry);
    } else {
      groupedToday.set(entry.actorId, { fullName: entry.actorFullName, entries: [entry] });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <DashboardSection title="Recent Activity" description="Latest events across every work item.">
        {recentActivity.length === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            No recent activity.
          </div>
        ) : (
          <div className="flex flex-col gap-1 rounded-lg border p-2">
            {recentActivity.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_WORK_ITEM_DETAIL(entry.workItemId))}
                className="flex items-center gap-3 rounded-md p-2 text-left text-sm transition-colors hover:bg-accent"
              >
                <span className="min-w-0 flex-1 truncate">
                  {activityLine(entry.action, entry.workItemDisplayId)}
                  {entry.workItemTitle && (
                    <span className="text-muted-foreground"> — {entry.workItemTitle}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatTime(entry.createdAt)}
                </span>
              </button>
            ))}
          </div>
        )}
      </DashboardSection>

      <DashboardSection
        title="Today's Team Activity"
        description="What each team member did today — events, not hours worked."
      >
        {groupedToday.size === 0 ? (
          <div className="flex h-20 items-center justify-center rounded-lg border text-sm text-muted-foreground">
            No activity yet today.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {Array.from(groupedToday.entries()).map(([actorId, group]) => (
              <div key={actorId} className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">{group.fullName}</p>
                <ul className="flex flex-col gap-1">
                  {group.entries.map((entry) => (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(ROUTES.IT_WORK_MANAGEMENT_WORK_ITEM_DETAIL(entry.workItemId))
                        }
                        className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground"
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {activityLine(entry.action, entry.workItemDisplayId)}
                        </span>
                        <span className="shrink-0">{formatTime(entry.createdAt)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </DashboardSection>
    </div>
  );
}
