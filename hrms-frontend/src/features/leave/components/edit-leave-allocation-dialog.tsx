"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LEAVE_TYPE_LABELS } from "@/features/leave/leave-status-meta";
import * as leaveService from "@/services/leave.service";
import { LeaveAllocationItem } from "@/services/leave.service";

const schema = z.object({
  days: z.coerce.number().min(0.5, "At least 0.5 days required"),
  reason: z.string().trim().min(3, "Please enter a reason/remarks"),
});

type FormValues = z.infer<typeof schema>;

interface EditLeaveAllocationDialogProps {
  item: LeaveAllocationItem;
}

export function EditLeaveAllocationDialog({ item }: EditLeaveAllocationDialogProps) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const label = LEAVE_TYPE_LABELS[item.leaveType] ?? item.leaveType;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      days: item.days,
      reason: item.reason,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        days: item.days,
        reason: item.reason,
      });
    }
  }, [open, item, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => leaveService.updateLeaveAllocation(item.id, values),
    onSuccess: () => {
      toast.success(`${label} allocation updated successfully!`);
      queryClient.invalidateQueries({ queryKey: ["leave-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balance"] });
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
      setOpen(false);
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setServerError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit {label} Allocation</DialogTitle>
          <DialogDescription>
            Update {label.toLowerCase()} days or reason for {item.employee.fullName}.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values as FormValues))}
          className="flex flex-col gap-4"
        >
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label>Employee</Label>
            <Input
              value={`${item.employee.fullName} (${item.employee.employeeId})`}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="days">Days to Credit</Label>
            <Input
              id="days"
              type="number"
              step="0.5"
              min="0.5"
              disabled={isSubmitting}
              {...register("days")}
            />
            {errors.days && <p className="text-xs text-destructive">{errors.days.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Reason / Remarks</Label>
            <Textarea id="reason" disabled={isSubmitting} {...register("reason")} />
            {errors.reason && (
              <p className="text-xs text-destructive">{errors.reason.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
