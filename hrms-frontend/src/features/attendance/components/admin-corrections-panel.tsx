"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Correction Requests</CardTitle>
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
