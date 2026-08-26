"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ItWorkManagementGuard } from "@/features/it-work-management/components/it-work-management-guard";
import { ItProjectPriorityBadge } from "@/features/it-work-management/components/it-project-badges";
import { ItWorkTypeBadge } from "@/features/it-work-management/components/it-work-item-badges";
import { ItWorkItemStatusControl } from "@/features/it-work-management/components/it-work-item-status-control";
import { ItWorkItemEditDialog } from "@/features/it-work-management/components/it-work-item-edit-dialog";
import { ItWorkItemAssignmentDialog } from "@/features/it-work-management/components/it-work-item-assignment-dialog";
import { ItWorkItemTimeline } from "@/features/it-work-management/components/it-work-item-timeline";
import { ItWorkItemComments } from "@/features/it-work-management/components/it-work-item-comments";
import { ItWorkItemAttachments } from "@/features/it-work-management/components/it-work-item-attachments";
import { useItWorkManagementAccess } from "@/hooks/use-it-work-management-access";
import { itWorkItemService } from "@/services/it-work-item.service";
import { ROUTES } from "@/constants/routes";

export default function ItWorkManagementWorkItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { canManage } = useItWorkManagementAccess();
  const [editOpen, setEditOpen] = useState(false);
  const [assignmentOpen, setAssignmentOpen] = useState(false);

  const { data: workItem, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["it-work-item", id],
    queryFn: () => itWorkItemService.get(id),
  });

  return (
    <ItWorkManagementGuard>
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_WORK_ITEMS)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Work Items
        </Button>

        {isLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!isLoading && isError && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">Couldn&apos;t load this work item.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              Try again
            </Button>
          </div>
        )}

        {!isLoading && !isError && !workItem && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium">Work item not found</p>
          </div>
        )}

        {!isLoading && !isError && workItem && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-muted-foreground">{workItem.workItemId}</p>
                <h1 className="text-2xl font-semibold tracking-tight">{workItem.title}</h1>
                <p className="text-sm text-muted-foreground">
                  {workItem.product ? (
                    <Link
                      href={ROUTES.IT_WORK_MANAGEMENT_PRODUCT_DETAIL(workItem.product._id)}
                      className="hover:underline"
                    >
                      {workItem.product.name}
                    </Link>
                  ) : (
                    "Unknown Product"
                  )}
                  {workItem.project && (
                    <>
                      {" / "}
                      <Link
                        href={ROUTES.IT_WORK_MANAGEMENT_PROJECT_DETAIL(workItem.project._id)}
                        className="hover:underline"
                      >
                        {workItem.project.name}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setAssignmentOpen(true)}>
                    <Users className="h-4 w-4" />
                    Manage Assignment
                  </Button>
                  <Button variant="outline" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-4 rounded-lg border p-4">
                <h2 className="text-sm font-semibold text-muted-foreground">Basic</h2>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Description</span>
                  <p className="text-sm">{workItem.description || "No description."}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Work Type</span>
                  <ItWorkTypeBadge workType={workItem.workType} />
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-lg border p-4">
                <h2 className="text-sm font-semibold text-muted-foreground">Management</h2>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <ItWorkItemStatusControl workItem={workItem} />
                  {workItem.status === "BLOCKED" && workItem.blockedReason && (
                    <p className="mt-1 text-sm text-destructive">
                      Blocked: &ldquo;{workItem.blockedReason}&rdquo;
                    </p>
                  )}
                  {workItem.status === "CANCELLED" && workItem.cancelReason && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Cancelled: &ldquo;{workItem.cancelReason}&rdquo;
                    </p>
                  )}
                  {workItem.status === "IN_PROGRESS" && workItem.reviewNote && (
                    <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                      Changes requested: &ldquo;{workItem.reviewNote}&rdquo;
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Assignee</span>
                    <p className="text-sm">{workItem.assignedTo?.fullName ?? "Unassigned"}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Reviewer</span>
                    <p className="text-sm">{workItem.reviewer?.fullName ?? "None"}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Priority</span>
                  <ItProjectPriorityBadge priority={workItem.priority} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Start Date</span>
                    <p className="text-sm">{workItem.startDate ?? "—"}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Due Date</span>
                    <p className="flex items-center gap-2 text-sm">
                      {workItem.dueDate ?? "—"}
                      {workItem.overdue && (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-red-500/10 text-red-600 dark:text-red-400"
                        >
                          Overdue
                        </Badge>
                      )}
                    </p>
                  </div>
                </div>
                {workItem.completedAt && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Completed</span>
                    <p className="text-sm">{new Date(workItem.completedAt).toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <h2 className="text-sm font-semibold text-muted-foreground">Attachments</h2>
              <ItWorkItemAttachments workItemId={workItem._id} />
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <h2 className="text-sm font-semibold text-muted-foreground">Comments</h2>
              <ItWorkItemComments workItemId={workItem._id} />
            </div>

            <div className="flex flex-col gap-3 rounded-lg border p-4">
              <h2 className="text-sm font-semibold text-muted-foreground">Activity</h2>
              <ItWorkItemTimeline workItemId={workItem._id} />
            </div>

            <div className="rounded-lg border p-4 text-xs text-muted-foreground">
              Created {new Date(workItem.createdAt).toLocaleString()} &middot; Last updated{" "}
              {new Date(workItem.updatedAt).toLocaleString()}
            </div>

            {canManage && (
              <>
                <ItWorkItemEditDialog
                  open={editOpen}
                  onOpenChange={setEditOpen}
                  workItem={workItem}
                />
                <ItWorkItemAssignmentDialog
                  open={assignmentOpen}
                  onOpenChange={setAssignmentOpen}
                  workItem={workItem}
                />
              </>
            )}
          </>
        )}
      </div>
    </ItWorkManagementGuard>
  );
}
