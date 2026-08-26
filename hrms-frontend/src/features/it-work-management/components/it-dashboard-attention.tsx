"use client";

import { useRouter } from "next/navigation";
import { AlertOctagon, CalendarClock, Eye, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/constants/routes";
import { ItDashboardAttention, ItDashboardWorkItem } from "@/types/it-work-management.types";
import { DashboardSection } from "@/features/dashboard/components/dashboard-section";
import { ItProjectPriorityBadge } from "./it-project-badges";

type Reason = "blocked" | "reviewRequired" | "overdue" | "dueSoon";

const REASON_META: Record<
  Reason,
  { label: string; icon: typeof AlertOctagon; className: string; accentClassName: string }
> = {
  blocked: {
    label: "Blocked",
    icon: ShieldAlert,
    className: "border-transparent bg-red-500/10 text-red-600 dark:text-red-400",
    accentClassName: "border-l-red-500",
  },
  reviewRequired: {
    label: "Review Required",
    icon: Eye,
    className: "border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400",
    accentClassName: "border-l-amber-500",
  },
  overdue: {
    label: "Overdue",
    icon: AlertOctagon,
    className: "border-transparent bg-red-500/10 text-red-600 dark:text-red-400",
    accentClassName: "border-l-red-500",
  },
  dueSoon: {
    label: "Due Soon",
    icon: CalendarClock,
    className: "border-transparent bg-blue-500/10 text-blue-600 dark:text-blue-400",
    accentClassName: "border-l-blue-500",
  },
};

// Flattens the four already-prioritized, already-deduplicated buckets the
// backend returns (Blocked > Review Required > Overdue > Due Soon — Part 5
// of the brief: each work item appears in exactly one bucket, never more
// than one) into a single scannable list, tagged with why each item is here.
function flatten(attention: ItDashboardAttention): { item: ItDashboardWorkItem; reason: Reason }[] {
  return [
    ...attention.blocked.map((item) => ({ item, reason: "blocked" as const })),
    ...attention.reviewRequired.map((item) => ({ item, reason: "reviewRequired" as const })),
    ...attention.overdue.map((item) => ({ item, reason: "overdue" as const })),
    ...attention.dueSoon.map((item) => ({ item, reason: "dueSoon" as const })),
  ];
}

export function ItDashboardAttentionSection({ attention }: { attention: ItDashboardAttention }) {
  const router = useRouter();
  const entries = flatten(attention);

  return (
    <DashboardSection
      title="Needs My Attention"
      description="Blocked work first, then items waiting on review, then overdue, then due soon — each item listed once."
    >
      {entries.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          Nothing needs attention right now.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map(({ item, reason }) => {
            const meta = REASON_META[reason];
            const Icon = meta.icon;
            return (
              <button
                key={item._id}
                type="button"
                onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_WORK_ITEM_DETAIL(item._id))}
                className={`flex w-full flex-wrap items-center gap-3 rounded-lg border border-l-4 p-3 text-left transition-colors hover:bg-accent ${meta.accentClassName}`}
              >
                <Badge variant="outline" className={meta.className}>
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </Badge>
                <span className="font-mono text-xs text-muted-foreground">{item.workItemId}</span>
                <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                <span className="text-xs text-muted-foreground">
                  {item.assignedTo?.fullName ?? "Unassigned"}
                </span>
                <ItProjectPriorityBadge priority={item.priority} />
                {item.dueDate && (
                  <span className="text-xs text-muted-foreground">Due {item.dueDate}</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </DashboardSection>
  );
}
