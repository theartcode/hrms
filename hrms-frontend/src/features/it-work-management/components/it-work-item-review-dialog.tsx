"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { itWorkItemService } from "@/services/it-work-item.service";
import { ItWorkItemReviewDecision } from "@/types/it-work-management.types";

interface ItWorkItemReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItemId: string;
  decision: ItWorkItemReviewDecision;
}

// Handles both review outcomes — Approve needs no reason (just a
// confirmation moment before completing the work), Request Changes
// requires one, per §16/§21. The backend enforces the reason requirement
// independently either way; this only mirrors it so the button disables
// correctly.
export function ItWorkItemReviewDialog({
  open,
  onOpenChange,
  workItemId,
  decision,
}: ItWorkItemReviewDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const isRequestChanges = decision === "REQUEST_CHANGES";

  const mutation = useMutation({
    mutationFn: () => itWorkItemService.review(workItemId, decision, reason.trim() || undefined),
    onSuccess: () => {
      toast.success(isRequestChanges ? "Changes requested" : "Work item approved");
      queryClient.invalidateQueries({ queryKey: ["it-work-items"] });
      queryClient.invalidateQueries({ queryKey: ["it-work-item", workItemId] });
      queryClient.invalidateQueries({ queryKey: ["it-work-item-activity", workItemId] });
      onOpenChange(false);
      setReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setReason(""); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isRequestChanges ? "Request Changes" : "Approve Work Item"}</DialogTitle>
          <DialogDescription>
            {isRequestChanges
              ? "Sends this back to In Progress for the assignee. Let them know what needs to change."
              : "Marks this work item Completed. This cannot be undone in this phase."}
          </DialogDescription>
        </DialogHeader>
        {isRequestChanges && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="review-reason">Reason</Label>
            <Textarea
              id="review-reason"
              placeholder="e.g. Mobile validation is still missing"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={mutation.isPending}
              maxLength={1000}
            />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant={isRequestChanges ? "destructive" : "default"}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (isRequestChanges && reason.trim().length === 0)}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRequestChanges ? "Request Changes" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
