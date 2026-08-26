"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { ItWorkItem } from "@/types/it-work-management.types";
import { ItProjectPriorityBadge } from "./it-project-badges";
import { ItWorkItemStatusBadge, ItWorkTypeBadge } from "./it-work-item-badges";

interface ItWorkItemTableProps {
  workItems: ItWorkItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isRefetching: boolean;
  /** Hides the Product/Project columns — used when the table is already embedded on that Project's own page. */
  scopedToProject?: boolean;
}

export function ItWorkItemTable({
  workItems,
  isLoading,
  isError,
  onRetry,
  isRefetching,
  scopedToProject = false,
}: ItWorkItemTableProps) {
  const router = useRouter();
  const columnCount = scopedToProject ? 7 : 9;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Title</TableHead>
            {!scopedToProject && (
              <>
                <TableHead>Product</TableHead>
                <TableHead>Project</TableHead>
              </>
            )}
            <TableHead>Work Type</TableHead>
            <TableHead>Assignee</TableHead>
            <TableHead>Reviewer</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Due Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={columnCount}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {!isLoading && isError && (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <p className="text-sm text-destructive">Couldn&apos;t load work items.</p>
                  <Button variant="outline" size="sm" onClick={onRetry} disabled={isRefetching}>
                    {isRefetching && <Loader2 className="h-4 w-4 animate-spin" />}
                    Try again
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !isError && workItems?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No work items match these filters.
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            !isError &&
            workItems?.map((item) => (
              <TableRow
                key={item._id}
                className="cursor-pointer"
                onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_WORK_ITEM_DETAIL(item._id))}
              >
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {item.workItemId}
                </TableCell>
                <TableCell className="font-medium">{item.title}</TableCell>
                {!scopedToProject && (
                  <>
                    <TableCell>{item.product?.name ?? "Unknown Product"}</TableCell>
                    <TableCell>{item.project?.name ?? "—"}</TableCell>
                  </>
                )}
                <TableCell>
                  <ItWorkTypeBadge workType={item.workType} />
                </TableCell>
                <TableCell>{item.assignedTo?.fullName ?? "Unassigned"}</TableCell>
                <TableCell>{item.reviewer?.fullName ?? "—"}</TableCell>
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
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
