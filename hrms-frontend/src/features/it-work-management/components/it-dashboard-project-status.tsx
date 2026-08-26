"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/constants/routes";
import { ItDashboardProject } from "@/types/it-work-management.types";
import { DashboardSection } from "@/features/dashboard/components/dashboard-section";
import { ItProjectPriorityBadge, ItProjectStatusBadge } from "./it-project-badges";

interface ItDashboardProjectStatusProps {
  projects: ItDashboardProject[];
  /** Phase 1E-C reuses this component for two differently-titled sections (the full Project Portfolio and the at-risk-only "Projects Needing Attention") — these default to 1E-A's original copy so its own rendering is unchanged. */
  title?: string;
  description?: string;
  emptyMessage?: string;
}

// The exact, documented "At Risk" rule (Part 13 of the Phase 1E-A brief,
// reapplied verbatim by Phase 1E-C's executive dashboard — Part 8 of that
// brief: not a second algorithm): a project is at risk if it has >=1
// overdue work item, OR >=1 blocked work item, OR its target date has
// passed while the project itself isn't Completed/Cancelled. The reason is
// always shown, never just a flag — see riskReasons, built server-side.
// No completion percentage or forecast anywhere here.
export function ItDashboardProjectStatus({
  projects,
  title = "Project Status",
  description = "Every active project, with work item counts and risk flags. At risk = overdue work, blocked work, or a passed target date.",
  emptyMessage = "No active projects.",
}: ItDashboardProjectStatusProps) {
  const router = useRouter();

  return (
    <DashboardSection title={title} description={description}>
      {projects.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_PROJECT_DETAIL(project.id))}
              className="flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-accent"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">{project.product?.name ?? "Unknown Product"}</span>
                <span className="font-medium">{project.name}</span>
                <ItProjectStatusBadge status={project.status} />
                <ItProjectPriorityBadge priority={project.priority} />
                {project.atRisk && (
                  <Badge
                    variant="outline"
                    className="border-transparent bg-red-500/10 text-red-600 dark:text-red-400"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    AT RISK
                  </Badge>
                )}
                <span className="ml-auto text-xs text-muted-foreground">
                  Owner: {project.owner?.fullName ?? "Unknown Owner"}
                </span>
              </div>

              {project.atRisk && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Reason: {project.riskReasons.join(", ")}
                </p>
              )}

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Total: {project.counts.total}</span>
                <span>Active: {project.counts.active}</span>
                <span>In Review: {project.counts.review}</span>
                <span>Blocked: {project.counts.blocked}</span>
                <span>Completed: {project.counts.completed}</span>
                <span>Overdue: {project.counts.overdue}</span>
                <span>Target: {project.targetDate ?? "—"}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
