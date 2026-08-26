"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { ItDashboardWorkItem } from "@/types/it-work-management.types";
import { ItProjectPriorityBadge } from "./it-project-badges";
import { ItWorkItemStatusBadge } from "./it-work-item-badges";

// Product > Project context (Part 19/20 of the Phase 1E-B brief, kept here
// since this list component is shared by both dashboards): the Project
// name is a real link to the existing Project detail page — stopping
// propagation so it doesn't also trigger the row's own navigation to the
// Work Item. A Work Item with no Project shows "No Project" rather than
// omitting the cell inconsistently.
function ProjectCell({ item }: { item: ItDashboardWorkItem }) {
  const router = useRouter();
  return (
    <div className="flex min-w-0 flex-col text-xs">
      <span className="truncate text-muted-foreground">{item.product?.name ?? "Unknown Product"}</span>
      {item.project ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(ROUTES.IT_WORK_MANAGEMENT_PROJECT_DETAIL(item.project!._id));
          }}
          className="truncate text-left font-medium hover:underline"
        >
          {item.project.name}
        </button>
      ) : (
        <span className="text-muted-foreground">No Project</span>
      )}
    </div>
  );
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

type ExtraColumn = "blockedSince" | "submittedAt" | "completedAt" | "none";

interface ItDashboardWorkItemListProps {
  items: ItDashboardWorkItem[];
  emptyMessage: string;
  /** Adds a section-specific extra date column, driven by fields the base ItWorkItem shape doesn't carry — see the backend's it-work-item-dashboard.service.ts for how each is derived. */
  extraColumn?: ExtraColumn;
}

// One compact, reusable table for every dashboard work-item section
// (In Progress, Review Queue, Blocked, Overdue, Upcoming, Recently
// Completed) rather than six near-identical ones — each section only
// differs in which items it's given and, for three of them, one extra
// date column. Clicking a row navigates straight to the existing Work Item
// detail page — no dashboard-embedded write actions (Part 22 of the brief).
export function ItDashboardWorkItemList({
  items,
  emptyMessage,
  extraColumn = "none",
}: ItDashboardWorkItemListProps) {
  const router = useRouter();

  if (items.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg border text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Product / Project</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
            {extraColumn === "blockedSince" && <TableHead>Blocked Since</TableHead>}
            {extraColumn === "submittedAt" && <TableHead>Submitted</TableHead>}
            {extraColumn === "completedAt" && <TableHead>Completed</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item._id}
              className="cursor-pointer"
              onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_WORK_ITEM_DETAIL(item._id))}
            >
              <TableCell className="font-mono text-xs text-muted-foreground">
                {item.workItemId}
              </TableCell>
              <TableCell className="max-w-[220px] truncate font-medium">{item.title}</TableCell>
              <TableCell className="max-w-40">
                <ProjectCell item={item} />
              </TableCell>
              <TableCell>{item.assignedTo?.fullName ?? "Unassigned"}</TableCell>
              <TableCell>
                <ItProjectPriorityBadge priority={item.priority} />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <ItWorkItemStatusBadge status={item.status} />
                  {item.approvalStatus === "PENDING" && (
                    <Badge
                      variant="outline"
                      className="border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    >
                      Pending Approval
                    </Badge>
                  )}
                  {item.overdue && (
                    <Badge
                      variant="outline"
                      className="border-transparent bg-red-500/10 text-red-600 dark:text-red-400"
                    >
                      Overdue
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{item.dueDate ?? "—"}</TableCell>
              {extraColumn === "blockedSince" && (
                <TableCell className="text-muted-foreground">{formatDate(item.blockedSince)}</TableCell>
              )}
              {extraColumn === "submittedAt" && (
                <TableCell className="text-muted-foreground">{formatDate(item.submittedAt)}</TableCell>
              )}
              {extraColumn === "completedAt" && (
                <TableCell className="text-muted-foreground">{formatDate(item.completedAt)}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
