"use client";

import { useRouter } from "next/navigation";
import { ROUTES } from "@/constants/routes";
import { ItDashboardWorkItem } from "@/types/it-work-management.types";
import { DashboardSection } from "@/features/dashboard/components/dashboard-section";
import { ItProjectPriorityBadge } from "./it-project-badges";

// Part 10 — the one section built from a field no other dashboard section
// needs: the live `reviewNote`, set only by a REQUEST_CHANGES decision and
// cleared on resubmit/approve (it-work-item.service.ts). No second
// feedback system — this is the same reviewNote the Work Item detail page
// already shows.
export function ItTeamDashboardChangesRequested({ items }: { items: ItDashboardWorkItem[] }) {
  const router = useRouter();

  return (
    <DashboardSection
      title="Changes Requested"
      description="Feedback from your most recent review — resubmit once addressed."
    >
      {items.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          No changes requested.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <button
              key={item._id}
              type="button"
              onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_WORK_ITEM_DETAIL(item._id))}
              className="flex w-full flex-col gap-2 rounded-lg border border-l-4 border-amber-500/30 border-l-amber-500 bg-amber-500/5 p-3 text-left transition-colors hover:bg-amber-500/10"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{item.workItemId}</span>
                <span className="font-medium">{item.title}</span>
                <ItProjectPriorityBadge priority={item.priority} />
                {item.reviewer && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    Reviewer: {item.reviewer.fullName}
                  </span>
                )}
              </div>
              {item.reviewNote && (
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  &ldquo;{item.reviewNote}&rdquo;
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
