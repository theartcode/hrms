"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItWorkManagementGuard } from "@/features/it-work-management/components/it-work-management-guard";
import { ItWorkItemFiltersBar } from "@/features/it-work-management/components/it-work-item-filters";
import { ItWorkItemTable } from "@/features/it-work-management/components/it-work-item-table";
import { ItWorkItemFormDialog } from "@/features/it-work-management/components/it-work-item-form-dialog";
import { useItWorkManagementAccess } from "@/hooks/use-it-work-management-access";
import { itWorkItemService, ItWorkItemFilters } from "@/services/it-work-item.service";

export default function ItWorkManagementWorkItemsPage() {
  const { canAccess: canManage } = useItWorkManagementAccess();
  // Phase 1E-A: the dashboard's Team Workload table links here with
  // ?assignedTo=<id> as a stand-in for a dedicated employee-detail view
  // (Part 6 of the brief) — read once on mount to seed the filter, same as
  // any other initial-filter state.
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<ItWorkItemFilters>(() => {
    const assignedTo = searchParams.get("assignedTo");
    return assignedTo ? { assignedTo } : {};
  });
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["it-work-items", filters],
    queryFn: () => itWorkItemService.list(filters),
  });

  return (
    <ItWorkManagementGuard>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Work Items</h1>
            <p className="text-sm text-muted-foreground">
              {canManage
                ? "All IT work items, across every product and project."
                : "Work items assigned to you."}
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create Work Item
            </Button>
          )}
        </div>

        <ItWorkItemFiltersBar value={filters} onChange={setFilters} />

        <ItWorkItemTable
          workItems={data}
          isLoading={isLoading}
          isError={isError}
          onRetry={() => refetch()}
          isRefetching={isRefetching}
        />
      </div>

      <ItWorkItemFormDialog open={createOpen} onOpenChange={setCreateOpen} />
    </ItWorkManagementGuard>
  );
}
