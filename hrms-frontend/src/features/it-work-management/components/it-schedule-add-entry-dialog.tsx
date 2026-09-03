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
import { formatISTDate } from "@/lib/format-ist";
import { AddScheduleEntryInput } from "@/services/work-schedule.service";
import { WorkScheduleEntry } from "@/types/it-work-management.types";
import { ItScheduleWorkItemSelect } from "./it-schedule-work-item-select";

interface ItScheduleAddEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  date: string;
  /** Lets the self and on-behalf-of grids reuse this one dialog against their own endpoint. */
  onSubmit: (input: AddScheduleEntryInput) => Promise<WorkScheduleEntry>;
  /** Query keys to invalidate on success — differs between the self and team grids. */
  invalidateKeys: string[][];
}

export function ItScheduleAddEntryDialog({
  open,
  onOpenChange,
  employeeId,
  date,
  onSubmit,
  invalidateKeys,
}: ItScheduleAddEntryDialogProps) {
  const queryClient = useQueryClient();
  const [workItem, setWorkItem] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () => {
      if (!workItem) throw new Error("Select a work item");
      return onSubmit({ date, workItem, note: note.trim() || undefined });
    },
    onSuccess: () => {
      toast.success("Added to schedule");
      for (const key of invalidateKeys) queryClient.invalidateQueries({ queryKey: key });
      setWorkItem(null);
      setNote("");
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setWorkItem(null);
          setNote("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Schedule work for {formatISTDate(date)}</DialogTitle>
          <DialogDescription>Pick a work item to plan for this day.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Work Item</Label>
            <ItScheduleWorkItemSelect
              employeeId={employeeId}
              value={workItem}
              onChange={setWorkItem}
              disabled={mutation.isPending}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="schedule-note">Note (optional)</Label>
            <Textarea
              id="schedule-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={!workItem || mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
