"use client";

import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LeaveHistoryTable } from "./leave-history-table";
import { LeaveImportWizard } from "./leave-import-wizard";
import { LeaveMigrationConfirmDialog } from "./leave-migration-confirm-dialog";
import { EmployeeLeaveAllocations } from "./employee-leave-allocations";
import { LEAVE_TYPE_LABELS } from "@/features/leave/leave-status-meta";
import * as leaveService from "@/services/leave.service";

interface LeaveMigrationPanelProps {
  employeeId: string;
  employeeName: string;
  isSuperAdmin: boolean;
}

// The gate: EmployeeLeaveAllocations (grant/edit/delete) only ever renders
// once migrationStatus is CONFIRMED — matching the backend guard in
// grantExtraLeave/updateLeaveAllocation/deleteLeaveAllocation.
export function LeaveMigrationPanel({
  employeeId,
  employeeName,
  isSuperAdmin,
}: LeaveMigrationPanelProps) {
  const queryClient = useQueryClient();
  const [reopenOpen, setReopenOpen] = useState(false);
  const queryKey = ["leave-migration-analysis", employeeId];

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => leaveService.getLeaveMigrationAnalysis(employeeId).then((res) => res.data),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["leave-balance", employeeId] });
  };

  const reopenMutation = useMutation({
    mutationFn: () => leaveService.reopenLeaveMigration(employeeId),
    onSuccess: () => {
      toast.success("Leave migration reopened");
      setReopenOpen(false);
      refresh();
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setReopenOpen(false);
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">Couldn&apos;t load leave migration data.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base font-semibold">Leave Analysis & Migration</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          {data.migrationStatus === "CONFIRMED" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm">
                {data.migrationConfirmedBy ? (
                  <>
                    Migration confirmed by <strong>{data.migrationConfirmedBy.fullName}</strong> on{" "}
                    {data.migrationConfirmedAt
                      ? new Date(data.migrationConfirmedAt).toLocaleDateString("en-IN")
                      : "—"}
                  </>
                ) : (
                  "Backfilled at HRMS launch — no individual review performed"
                )}
                {data.migrationConfirmedReason ? ` — ${data.migrationConfirmedReason}` : ""}
              </p>
              {isSuperAdmin && (
                <Button variant="outline" size="sm" onClick={() => setReopenOpen(true)}>
                  <RotateCcw className="h-4 w-4" />
                  Reopen for Re-audit
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              This employee&apos;s leave balance can&apos;t be manually adjusted until an admin
              reviews and confirms a calculated baseline below.
            </p>
          )}

          {/* Pending leave requests */}
          {data.pendingRequests.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Pending Leave Requests</p>
              <div className="flex flex-col gap-1">
                {data.pendingRequests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
                    <span>
                      {LEAVE_TYPE_LABELS[r.leaveType] ?? r.leaveType} · {r.startDate} – {r.endDate} ·{" "}
                      {r.days} day(s)
                    </span>
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent">
                      Pending
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Complete leave history — always visible, imported rows badged */}
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Leave History</p>
            <LeaveHistoryTable history={data.history} />
          </div>

          {data.migrationStatus === "NOT_STARTED" && (
            <div className="flex flex-col gap-4 border-t pt-4">
              <p className="text-sm font-medium">Import Historical Records</p>
              <LeaveImportWizard
                employeeId={employeeId}
                importBatches={data.importBatches}
                onChanged={refresh}
              />
              <div className="flex justify-end">
                <LeaveMigrationConfirmDialog
                  employeeId={employeeId}
                  employeeName={employeeName}
                  proposedAdjustments={data.proposedAdjustments}
                  onConfirmed={refresh}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {data.migrationStatus === "CONFIRMED" && (
        <EmployeeLeaveAllocations employeeId={employeeId} employeeName={employeeName} />
      )}

      <ConfirmDialog
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        title="Reopen leave migration?"
        description={`This locks manual leave adjustments for ${employeeName} again until the migration is re-confirmed. Historical imported records remain untouched.`}
        confirmLabel="Reopen"
        destructive
        isLoading={reopenMutation.isPending}
        onConfirm={() => reopenMutation.mutate()}
      />
    </div>
  );
}
