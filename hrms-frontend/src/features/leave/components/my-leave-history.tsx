"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarX, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave-types";
import { LEAVE_TYPE_LABELS } from "../leave-status-meta";
import { LeaveStatusBadge } from "./leave-status-badge";
import * as leaveService from "@/services/leave.service";
import { formatISTDate } from "@/lib/format-ist";
import { LeaveRequest } from "@/types/leave.types";

const ALL = "ALL";

export function MyLeaveHistory() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [cancelling, setCancelling] = useState<LeaveRequest | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["my-leaves", status, page],
    queryFn: () => leaveService.myLeaves({ status, page, limit: 10 }).then((res) => res.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => leaveService.cancelLeave(id),
    onSuccess: () => {
      toast.success("Leave request cancelled");
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
      setCancelling(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setCancelling(null);
    },
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Leave History</h3>
        <Select
          value={status ?? ALL}
          onValueChange={(v) => {
            setStatus(v && v !== ALL ? v : undefined);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40" aria-label="Filter by status">
            <SelectValue placeholder="Status">
              {(v: string) => (v === ALL ? "All Statuses" : v)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All Statuses</SelectItem>
            {Object.values(LEAVE_REQUEST_STATUS).map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Admin Comment</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && isError && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-sm text-destructive">
                  Couldn&apos;t load leave history.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && (data?.leaves.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <CalendarX className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">No leave requests yet</p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !isError &&
              data?.leaves.map((leave) => (
                <TableRow key={leave.id}>
                  <TableCell>{LEAVE_TYPE_LABELS[leave.leaveType]}</TableCell>
                  <TableCell>
                    {formatISTDate(leave.startDate)} – {formatISTDate(leave.endDate)}
                  </TableCell>
                  <TableCell>
                    {leave.days}
                    {leave.isHalfDay && (
                      <span className="ml-1 text-xs text-muted-foreground">(Half Day)</span>
                    )}
                  </TableCell>
                  <TableCell>{formatISTDate(leave.createdAt.slice(0, 10))}</TableCell>
                  <TableCell>
                    <LeaveStatusBadge status={leave.status} />
                  </TableCell>
                  <TableCell className="max-w-48 truncate text-sm text-muted-foreground">
                    {leave.reviewComment ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {leave.status === LEAVE_REQUEST_STATUS.PENDING && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCancelling(leave)}
                      >
                        <X className="h-4 w-4" />
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {data && data.pagination.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {data.pagination.page} of {data.pagination.totalPages} ·{" "}
            {data.pagination.total} requests
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= data.pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={cancelling !== null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancel leave request?"
        description={
          cancelling
            ? `Your ${LEAVE_TYPE_LABELS[cancelling.leaveType]} request for ${formatISTDate(cancelling.startDate)} – ${formatISTDate(cancelling.endDate)} will be cancelled.`
            : ""
        }
        confirmLabel="Cancel Request"
        destructive
        isLoading={cancelMutation.isPending}
        onConfirm={() => cancelling && cancelMutation.mutate(cancelling.id)}
      />
    </div>
  );
}
