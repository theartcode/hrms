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

interface ItWorkItemRequestProposalChangesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItemId: string;
}

// IT Head/Admin/Super Admin only. The middle ground between Approve and
// Reject: the proposal stays PENDING (not cancelled) and your note goes
// straight to the proposer, who can then edit the proposal themselves (see
// ItWorkItemEditProposalDialog) rather than having to cancel it and start
// over. Use this instead of Reject when the idea is fine but a detail
// needs fixing — e.g. wrong product, unclear title, a due date to adjust.
export function ItWorkItemRequestProposalChangesDialog({
  open,
  onOpenChange,
  workItemId,
}: ItWorkItemRequestProposalChangesDialogProps) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () => itWorkItemService.requestProposalChanges(workItemId, note.trim()),
    onSuccess: () => {
      toast.success("Changes requested — the proposer has been notified");
      queryClient.invalidateQueries({ queryKey: ["it-work-items"] });
      queryClient.invalidateQueries({ queryKey: ["it-work-item", workItemId] });
      queryClient.invalidateQueries({ queryKey: ["it-work-item-activity", workItemId] });
      queryClient.invalidateQueries({ queryKey: ["it-head-dashboard"] });
      onOpenChange(false);
      setNote("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog onOpenChange={(next) => { onOpenChange(next); if (!next) setNote(""); }} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Changes on Proposal</DialogTitle>
          <DialogDescription>
            The proposal stays pending — tell the proposer what to fix, and they can update it
            themselves and you&apos;ll see it again for a decision.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="request-changes-note">What needs to change</Label>
          <Textarea
            id="request-changes-note"
            placeholder="e.g. Please move this under the LMS product and push the due date to next Friday"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={mutation.isPending}
            maxLength={1000}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || note.trim().length === 0}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Send Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
