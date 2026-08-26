"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { ItWorkManagementGuard } from "@/features/it-work-management/components/it-work-management-guard";
import { ItProjectStatusControl } from "@/features/it-work-management/components/it-project-status-control";
import { ItProjectPriorityBadge } from "@/features/it-work-management/components/it-project-badges";
import { ItProjectFormDialog } from "@/features/it-work-management/components/it-project-form-dialog";
import { ItWorkItemFiltersBar } from "@/features/it-work-management/components/it-work-item-filters";
import { ItWorkItemTable } from "@/features/it-work-management/components/it-work-item-table";
import { ItWorkItemSummaryCounts } from "@/features/it-work-management/components/it-work-item-summary-counts";
import { summarizeWorkItemStatuses } from "@/features/it-work-management/it-work-item-meta";
import { useItWorkManagementAccess } from "@/hooks/use-it-work-management-access";
import { itProjectService } from "@/services/it-project.service";
import { itWorkItemService, ItWorkItemFilters } from "@/services/it-work-item.service";
import { ROUTES } from "@/constants/routes";

export default function ItWorkManagementProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { canManage } = useItWorkManagementAccess();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [workItemFilters, setWorkItemFilters] = useState<ItWorkItemFilters>({});

  const { data: project, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["it-project", id],
    queryFn: () => itProjectService.get(id),
  });

  // Requests only this Project's Work Items — server-side filtered via
  // ?project=id, never the full Work Items collection fetched and
  // filtered client-side (Part I of the Phase 1C-C brief).
  const {
    data: workItems,
    isLoading: workItemsLoading,
    isError: workItemsError,
    refetch: refetchWorkItems,
    isRefetching: workItemsRefetching,
  } = useQuery({
    queryKey: ["it-work-items", { ...workItemFilters, project: id }],
    queryFn: () => itWorkItemService.list({ ...workItemFilters, project: id }),
    enabled: !!id,
  });

  const summary = useMemo(() => summarizeWorkItemStatuses(workItems ?? []), [workItems]);

  const deleteMutation = useMutation({
    mutationFn: () => itProjectService.remove(id),
    onSuccess: () => {
      toast.success("Project deleted");
      queryClient.invalidateQueries({ queryKey: ["it-projects"] });
      router.push(ROUTES.IT_WORK_MANAGEMENT_PROJECTS);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <ItWorkManagementGuard>
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_PROJECTS)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
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
            <p className="text-sm text-destructive">Couldn&apos;t load this project.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
              Try again
            </Button>
          </div>
        )}

        {!isLoading && !isError && !project && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium">Project not found</p>
          </div>
        )}

        {!isLoading && !isError && project && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">
                  {project.product ? (
                    <Link
                      href={ROUTES.IT_WORK_MANAGEMENT_PRODUCT_DETAIL(project.product._id)}
                      className="hover:underline"
                    >
                      {project.product.name}
                    </Link>
                  ) : (
                    "Unknown Product"
                  )}
                </p>
                <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setEditOpen(true)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-4 rounded-lg border p-4">
                <h2 className="text-sm font-semibold text-muted-foreground">Basic Information</h2>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Description</span>
                  <p className="text-sm">{project.description || "No description."}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Owner</span>
                  <p className="text-sm">
                    {project.owner ? `${project.owner.fullName} (${project.owner.employeeId})` : "Unknown Owner"}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-lg border p-4">
                <h2 className="text-sm font-semibold text-muted-foreground">Management</h2>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Status</span>
                  <ItProjectStatusControl project={project} />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">Priority</span>
                  <ItProjectPriorityBadge priority={project.priority} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Start Date</span>
                    <p className="text-sm">{project.startDate ?? "—"}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">Target Date</span>
                    <p className="text-sm">{project.targetDate ?? "—"}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Work Item Summary</h2>
              <ItWorkItemSummaryCounts summary={summary} />
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Work Items</h2>
              <ItWorkItemFiltersBar
                value={workItemFilters}
                onChange={setWorkItemFilters}
                scopedToProject
              />
              <ItWorkItemTable
                workItems={workItems}
                isLoading={workItemsLoading}
                isError={workItemsError}
                onRetry={() => refetchWorkItems()}
                isRefetching={workItemsRefetching}
                scopedToProject
              />
            </div>

            {canManage && (
              <>
                <ItProjectFormDialog open={editOpen} onOpenChange={setEditOpen} project={project} />
                <ConfirmDialog
                  open={deleteOpen}
                  onOpenChange={setDeleteOpen}
                  title={`Delete "${project.name}"?`}
                  description="This permanently deletes the project. Any Work Items currently linked to it will be unlinked (shown as “No Project”), not deleted. This cannot be undone."
                  confirmLabel="Delete"
                  destructive
                  isLoading={deleteMutation.isPending}
                  onConfirm={() => deleteMutation.mutate()}
                />
              </>
            )}
          </>
        )}
      </div>
    </ItWorkManagementGuard>
  );
}
