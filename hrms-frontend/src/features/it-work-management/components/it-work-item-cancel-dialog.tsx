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

interface ItWorkItemCancelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItemId: string;
}

// Management-only (the page never renders the trigger for a team member —
// the backend enforces this independently either way). Deliberately not a
// one-click action: a reason is required and the confirm button is styled
// destructive, matching §23's "must not be a one-click accidental action."
export function ItWorkItemCancelDialog({
  open,
  onOpenChange,
  workItemId,
}: ItWorkItemCancelDialogProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const mutation = useMutation({
    mutationFn: () => itWorkItemService.changeStatus(workItemId, "CANCELLED", reason.trim()),
    onSuccess: () => {
      toast.success("Work item cancelled");
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
          <DialogTitle>Cancel Work Item</DialogTitle>
          <DialogDescription>
            This is terminal — a cancelled work item cannot be moved to any other status.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Textarea
            id="cancel-reason"
            placeholder="e.g. Requirement was dropped by the client"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={mutation.isPending}
            maxLength={1000}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Keep Work Item
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || reason.trim().length === 0}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Cancel Work Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
