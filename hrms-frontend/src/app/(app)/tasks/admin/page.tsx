"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/layout/role-guard";
import { ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import * as taskService from "@/services/task.service";
import { TASK_POLL_INTERVAL_MS } from "@/features/tasks/task-status-meta";
import { TaskFilters, TaskFilterValues } from "@/features/tasks/components/task-filters";
import { TasksTable } from "@/features/tasks/components/tasks-table";
import { TaskFormDialog } from "@/features/tasks/components/task-form-dialog";
import { TaskDetailSheet } from "@/features/tasks/components/task-detail-sheet";

export default function AdminTasksPage() {
  return (
    <RoleGuard allow={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}>
      <AdminTasksContent />
    </RoleGuard>
  );
}

function AdminTasksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<TaskFilterValues>({});
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    searchParams.get("taskId")
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-tasks", filters, page],
    queryFn: () => taskService.adminTasks({ ...filters, page, limit: 15 }).then((res) => res.data),
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
          <h1 className="text-2xl font-semibold tracking-tight">All Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Every task across the company.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create Task
        </Button>
      </div>

      <TaskFilters scope="admin" value={filters} onChange={handleFiltersChange} />

      <TasksTable
        scope="admin"
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
