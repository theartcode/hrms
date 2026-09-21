"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import * as correctionService from "@/services/attendance-correction.service";
import { AttendanceCorrection } from "@/types/attendance.types";
import { formatISTDate, formatISTTime } from "@/lib/format-ist";

interface AdminCorrectionsPanelProps {
  /** Correction id to scroll to and visually highlight (e.g. arrived via a notification link). */
  highlightId?: string;
}

export function AdminCorrectionsPanel({ highlightId }: AdminCorrectionsPanelProps) {
  const queryClient = useQueryClient();
  const [reviewing, setReviewing] = useState<{
    correction: AttendanceCorrection;
    action: "approve" | "reject";
  } | null>(null);
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const highlightedRowRef = useRef<HTMLDivElement | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-corrections", "PENDING"],
    queryFn: () =>
      correctionService
        .adminListCorrections({ status: "PENDING", limit: 20 })
        .then((res) => res.data.corrections),
  });

  useEffect(() => {
    if (highlightId && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightId, data]);

  const reviewMutation = useMutation({
    mutationFn: async () => {
      if (!reviewing) return;
      return reviewing.action === "approve"
        ? correctionService.approveCorrection(reviewing.correction.id, comment || undefined)
        : correctionService.rejectCorrection(reviewing.correction.id, comment || undefined);
    },
    onSuccess: () => {
      toast.success(reviewing?.action === "approve" ? "Correction approved" : "Correction rejected");
      queryClient.invalidateQueries({ queryKey: ["admin-corrections"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-admin"] });
      setReviewing(null);
      setComment("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) =>
      Promise.allSettled(ids.map((id) => correctionService.approveCorrection(id))),
    onSuccess: (results, ids) => {
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      queryClient.invalidateQueries({ queryKey: ["admin-corrections"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-admin"] });
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      if (failed === 0) {
        toast.success(succeeded === 1 ? "Correction approved" : `${succeeded} corrections approved`);
      } else {
        toast.error(`${succeeded} approved, ${failed} failed — refresh and try again`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const allIds = data?.map((c) => c.id) ?? [];
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle>Pending Correction Requests</CardTitle>
        {!isLoading && data && data.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              Select all ({data.length})
            </label>
            <Button
              size="sm"
              disabled={selected.size === 0 || bulkApproveMutation.isPending}
              onClick={() => bulkApproveMutation.mutate(Array.from(selected))}
            >
              {bulkApproveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Approve Selected ({selected.size})
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-24 w-full" />}

        {!isLoading && (!data || data.length === 0) && (
          <p className="text-sm text-muted-foreground">No pending requests.</p>
        )}

        {!isLoading && data && data.length > 0 && (
          <div className="flex flex-col divide-y">
            {data.map((c) => {
              const employee =
                typeof c.employee === "object" ? c.employee : { fullName: "—", employeeId: "" };
              const isHighlighted = c.id === highlightId;
              return (
                <div
                  key={c.id}
                  ref={isHighlighted ? highlightedRowRef : undefined}
                  className={cn(
                    "flex flex-col gap-2 py-3 first:pt-0 last:pb-0",
                    isHighlighted && "-mx-3 rounded-lg bg-amber-500/10 px-3"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        className="mt-1"
                        checked={selected.has(c.id)}
                        onCheckedChange={() => toggleOne(c.id)}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {employee.fullName}{" "}
                          <span className="text-muted-foreground">({employee.employeeId})</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatISTDate(c.date)} — {c.reason}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested: {formatISTTime(c.requestedCheckIn)} →{" "}
                          {formatISTTime(c.requestedCheckOut)}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReviewing({ correction: c, action: "approve" })}
                      >
                        <Check className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setReviewing({ correction: c, action: "reject" })}
                      >
                        <X className="h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={reviewing !== null} onOpenChange={(open) => !open && setReviewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewing?.action === "approve" ? "Approve" : "Reject"} correction request
            </DialogTitle>
            <DialogDescription>
              Optionally add a comment visible to the employee.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-comment">Comment</Label>
            <Textarea
              id="review-comment"
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
    </Card>
  );
}
