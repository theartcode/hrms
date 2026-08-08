"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { ROLES } from "@/constants/roles";
import { useAuth } from "@/hooks/use-auth";
import { TaskList } from "@/features/tasks/components/task-list";
import { TaskDetailSheet } from "@/features/tasks/components/task-detail-sheet";

export default function TasksPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(
    searchParams.get("taskId")
  );

  const isDepartmentHead = (user?.departmentHeadOf.length ?? 0) > 0;
  const isAdmin = user?.role === ROLES.ADMIN || user?.role === ROLES.SUPER_ADMIN;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Tasks</h1>
          <p className="text-sm text-muted-foreground">
            Tasks assigned to you — update status, comment, and share files.
          </p>
        </div>
        <div className="flex gap-2">
          {isDepartmentHead && (
            <Button variant="outline" nativeButton={false} render={<Link href={ROUTES.TASKS_TEAM} />}>
              <Users className="h-4 w-4" />
              Team Tasks
            </Button>
          )}
          {isAdmin && (
            <Button variant="outline" nativeButton={false} render={<Link href={ROUTES.TASKS_ADMIN} />}>
              <ShieldCheck className="h-4 w-4" />
              All Tasks
            </Button>
          )}
        </div>
      </div>

      <TaskList onSelectTask={setSelectedTaskId} />

      <TaskDetailSheet
        taskId={selectedTaskId}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />
    </div>
  );
}
