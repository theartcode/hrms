"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ClipboardList, Loader2, Pencil, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { LeaveRequest, PaginationInfo } from "@/types/leave.types";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave-types";
import { LEAVE_TYPE_LABELS } from "../leave-status-meta";
import { LeaveStatusBadge } from "./leave-status-badge";
import { EditLeaveRequestDialog } from "./edit-leave-request-dialog";
import * as leaveService from "@/services/leave.service";
import { formatISTDate } from "@/lib/format-ist";

const COLUMN_COUNT = 7;

interface AdminLeaveTableProps {
  leaves: LeaveRequest[];
  isLoading: boolean;
  isError: boolean;
  pagination?: PaginationInfo;
  onPageChange: (page: number) => void;
  /** Leave request id to scroll to and visually highlight (e.g. arrived via an email link). */
  highlightId?: string;
}

export function AdminLeaveTable({
  leaves,
  isLoading,
  isError,
  pagination,
  onPageChange,
  highlightId,
}: AdminLeaveTableProps) {
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState<{
    leave: LeaveRequest;
    action: "approve" | "reject";
  } | null>(null);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState<LeaveRequest | null>(null);
  const highlightedRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (highlightId && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, leaves]);

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewing) return;
      return reviewing.action === "approve"
        ? leaveService.approveLeave(reviewing.leave.id, comment || undefined)
        : leaveService.rejectLeave(reviewing.leave.id, comment || undefined);
    },
    onSuccess: () => {
      toast.success(reviewing?.action === "approve" ? "Leave approved" : "Leave rejected");
      queryClient.invalidateQueries({ queryKey: ["admin-leaves"] });
      setReviewing(null);
      setComment("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Days</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLUMN_COUNT }).map((_, c) => (
                    <TableCell key={c}>
                      <Skeleton className="h-5 w-full max-w-28" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {!isLoading && isError && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="h-32 text-center text-sm text-destructive">
                  Couldn&apos;t load leave requests.
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && leaves.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <ClipboardList className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm font-medium">No leave requests found</p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !isError &&
              leaves.map((leave) => {
                const employee =
                  typeof leave.employee === "object" ? leave.employee : null;
                const isHighlighted = leave.id === highlightId;
                return (
                  <TableRow
                    key={leave.id}
                    ref={isHighlighted ? highlightedRowRef : undefined}
                    className={cn(isHighlighted && "bg-amber-500/10 hover:bg-amber-500/15")}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{employee?.fullName ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">
                          {employee?.employeeId}
                        </span>
                      </div>
                    </TableCell>
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
                    <TableCell className="max-w-48 truncate">{leave.reason}</TableCell>
                    <TableCell>
                      <LeaveStatusBadge status={leave.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      {leave.status === LEAVE_REQUEST_STATUS.PENDING && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => setEditing(leave)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewing({ leave, action: "approve" })}
                          >
                            <Check className="h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReviewing({ leave, action: "reject" })}
                          >
                            <X className="h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      {pagination && pagination.total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} requests
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onPageChange(pagination.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onPageChange(pagination.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={reviewing !== null} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewing?.action === "approve" ? "Approve" : "Reject"} leave request
            </DialogTitle>
            <DialogDescription>
              Optionally add a comment visible to the employee.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="leave-review-comment">Comment</Label>
            <Textarea
              id="leave-review-comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => reviewMutation.mutate()} disabled={reviewMutation.isPending}>
              {reviewMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditLeaveRequestDialog leave={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
