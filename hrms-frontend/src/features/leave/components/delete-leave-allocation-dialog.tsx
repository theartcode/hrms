"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LEAVE_TYPE_LABELS } from "@/features/leave/leave-status-meta";
import * as leaveService from "@/services/leave.service";
import { LeaveAllocationItem } from "@/services/leave.service";

interface DeleteLeaveAllocationDialogProps {
  item: LeaveAllocationItem;
}

export function DeleteLeaveAllocationDialog({ item }: DeleteLeaveAllocationDialogProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const label = LEAVE_TYPE_LABELS[item.leaveType] ?? item.leaveType;

  const mutation = useMutation({
    mutationFn: () => leaveService.deleteLeaveAllocation(item.id),
    onSuccess: () => {
      toast.success(`${label} allocation deleted successfully!`);
      queryClient.invalidateQueries({ queryKey: ["leave-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balance"] });
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
      setOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          />
        }
      >
        <Trash2 className="h-4 w-4" />
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label} Allocation</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this allocation of{" "}
            <strong>
              +{item.days} {label.toLowerCase()} day(s)
            </strong>{" "}
            for <strong>{item.employee.fullName}</strong>? This will deduct the days from their
            balance.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mutation.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
            disabled={mutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
