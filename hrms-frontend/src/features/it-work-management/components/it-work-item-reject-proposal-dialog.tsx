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

interface ItWorkItemRejectProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItemId: string;
}

// IT Head/Admin/Super Admin only (the page never renders the trigger for
// anyone else — the backend enforces this independently either way).
// Rejecting moves the item straight to CANCELLED — a proposal is always at
// REQUESTED while pending, and REQUESTED -> CANCELLED is already a valid
// transition, so this doesn't invent a new terminal state.
export function ItWorkItemRejectProposalDialog({
  open,
  onOpenChange,
  workItemId,
}: ItWorkItemRejectProposalDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () => itWorkItemService.rejectProposal(workItemId, reason.trim()),
    onSuccess: () => {
      toast.success("Proposal rejected");
      queryClient.invalidateQueries({ queryKey: ["it-work-items"] });
      queryClient.invalidateQueries({ queryKey: ["it-work-item", workItemId] });
      queryClient.invalidateQueries({ queryKey: ["it-work-item-activity", workItemId] });
      queryClient.invalidateQueries({ queryKey: ["it-head-dashboard"] });
      onOpenChange(false);
      setReason("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog onOpenChange={(next) => { onOpenChange(next); if (!next) setReason(""); }} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject Proposal</DialogTitle>
          <DialogDescription>
            The work item will be cancelled and the proposer will be notified with your reason.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="reject-proposal-reason">Reason</Label>
          <Textarea
            id="reject-proposal-reason"
            placeholder="e.g. This is already covered by another Work Item"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={mutation.isPending}
            maxLength={1000}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Keep Pending
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || reason.trim().length === 0}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Reject Proposal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
