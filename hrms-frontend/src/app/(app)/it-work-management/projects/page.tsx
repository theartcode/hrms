"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItWorkManagementGuard } from "@/features/it-work-management/components/it-work-management-guard";
import { ItProjectFiltersBar } from "@/features/it-work-management/components/it-project-filters";
import { ItProjectTable } from "@/features/it-work-management/components/it-project-table";
import { ItProjectFormDialog } from "@/features/it-work-management/components/it-project-form-dialog";
import { useItWorkManagementAccess } from "@/hooks/use-it-work-management-access";
import { itProjectService, ItProjectFilters } from "@/services/it-project.service";

export default function ItWorkManagementProjectsPage() {
  const { canManage } = useItWorkManagementAccess();
  const [filters, setFilters] = useState<ItProjectFilters>({});
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["it-projects", filters],
    queryFn: () => itProjectService.list(filters),
  });

  return (
    <ItWorkManagementGuard>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            <p className="text-sm text-muted-foreground">
              Projects grouped under each IT product.
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          )}
        </div>

        <ItProjectFiltersBar value={filters} onChange={setFilters} />

        <ItProjectTable
          projects={data}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          isRefetching={isRefetching}
        />
      </div>

      {canManage && <ItProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} />}
    </ItWorkManagementGuard>
  );
}
