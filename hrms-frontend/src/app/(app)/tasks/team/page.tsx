"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useAuth } from "@/hooks/use-auth";
import * as taskService from "@/services/task.service";
import { TASK_POLL_INTERVAL_MS } from "@/features/tasks/task-status-meta";
import { TaskFilters, TaskFilterValues } from "@/features/tasks/components/task-filters";
import { TasksTable } from "@/features/tasks/components/tasks-table";
import { TaskFormDialog } from "@/features/tasks/components/task-form-dialog";
import { TaskDetailSheet } from "@/features/tasks/components/task-detail-sheet";

// "Department Head" isn't a role, so this can't use RoleGuard (role-based
// only) — it gates on user.departmentHeadOf, which /auth/me already
// exposes (added in Phase 0 for exactly this). The fallback markup mirrors
// RoleGuard's own "Access restricted" state for a consistent look.
export default function TeamTasksPage() {
  const { user } = useAuth();

  if (!user || user.departmentHeadOf.length === 0) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-1 text-center">
        <p className="text-sm font-medium">Access restricted</p>
        <p className="text-sm text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
      </div>
    );
  }

  return <TeamTasksContent />;
}

function TeamTasksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<TaskFilterValues>({});
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    searchParams.get("taskId")
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["team-tasks", filters, page],
    queryFn: () => taskService.teamTasks({ ...filters, page, limit: 15 }).then((res) => res.data),
    refetchInterval: TASK_POLL_INTERVAL_MS,
  });

  function handleFiltersChange(next: TaskFilterValues) {
    setFilters(next);
    setPage(1);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-2"
            onClick={() => router.push(ROUTES.TASKS)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Tasks
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">Team Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Tasks assigned within the department(s) you head.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Task
        </Button>
      </div>

      <TaskFilters scope="team" value={filters} onChange={handleFiltersChange} />

      <TasksTable
        scope="team"
        tasks={data?.tasks ?? []}
        isLoading={isLoading}
        isError={isError}
        pagination={data?.pagination}
        onPageChange={setPage}
        onViewDetail={setSelectedTaskId}
      />

      <TaskFormDialog open={createOpen} onOpenChange={setCreateOpen} />

      <TaskDetailSheet
        taskId={selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />
    </div>
  );
}
