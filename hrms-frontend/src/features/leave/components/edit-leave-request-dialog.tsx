"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAVE_TYPES } from "@/constants/leave-types";
import { LEAVE_TYPE_LABELS } from "../leave-status-meta";
import * as leaveService from "@/services/leave.service";
import { LeaveRequest } from "@/types/leave.types";

const HALF_SUFFIX = ":HALF";

function parseLeaveTypeOption(option: string): { leaveType: string; isHalfDay: boolean } {
  if (option.endsWith(HALF_SUFFIX)) {
    return { leaveType: option.slice(0, -HALF_SUFFIX.length), isHalfDay: true };
  }
  return { leaveType: option, isHalfDay: false };
}

// Every type × full/half combination, unfiltered — unlike the employee's
// Apply Leave dialog, an admin correcting a mistaken request needs to be
// able to set any type; eligibility (Permanent-only for Casual/Annual, etc.)
// is enforced server-side in adminEditLeaveRequest, not hidden here.
const LEAVE_TYPE_OPTIONS = Object.values(LEAVE_TYPES).flatMap((t) => [
  { value: t, label: LEAVE_TYPE_LABELS[t] },
  { value: `${t}${HALF_SUFFIX}`, label: `Half Day ${LEAVE_TYPE_LABELS[t]}` },
]);
const LEAVE_TYPE_OPTION_LABELS = Object.fromEntries(
  LEAVE_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

interface FormValues {
  leaveTypeOption: string;
  startDate: string;
  endDate: string;
  reason: string;
}

function toFormValues(leave: LeaveRequest): FormValues {
  return {
    leaveTypeOption: leave.isHalfDay ? `${leave.leaveType}${HALF_SUFFIX}` : leave.leaveType,
    startDate: leave.startDate,
    endDate: leave.endDate,
    reason: leave.reason,
  };
}

interface EditLeaveRequestDialogProps {
  leave: LeaveRequest | null;
  onClose: () => void;
}

export function EditLeaveRequestDialog({ leave, onClose }: EditLeaveRequestDialogProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [lastLeaveId, setLastLeaveId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { isSubmitting },
  } = useForm<FormValues>();

  // Re-seed the form whenever a different (or newly opened) leave request
  // comes in — render-time reset, not an effect, same pattern used by
  // ClockTimePicker/AdminEditAttendanceDialog elsewhere in this app.
  if (leave && leave.id !== lastLeaveId) {
    setLastLeaveId(leave.id);
    reset(toFormValues(leave));
    setServerError(null);
  }

  const leaveTypeOption = watch("leaveTypeOption");
  const startDate = watch("startDate");
  const isHalfDay = parseLeaveTypeOption(leaveTypeOption ?? "").isHalfDay;

  // A half-day request is always a single date — keep End Date in lockstep
  // with Start Date whenever a half-day option is selected.
  useEffect(() => {
    if (isHalfDay && startDate) {
      setValue("endDate", startDate, { shouldValidate: true });
    }
  }, [isHalfDay, startDate, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!leave) throw new Error("No leave request selected");
      const parsed = parseLeaveTypeOption(values.leaveTypeOption);
      return leaveService.adminEditLeave(leave.id, {
        leaveType: parsed.leaveType,
        startDate: values.startDate,
        endDate: values.endDate,
        isHalfDay: parsed.isHalfDay,
        reason: values.reason,
      });
    },
    onSuccess: () => {
      toast.success("Leave request updated");
      queryClient.invalidateQueries({ queryKey: ["admin-leaves"] });
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Dialog open={leave !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Leave Request</DialogTitle>
          <DialogDescription>
            Correct the type, dates, or reason before approving — the request stays Pending.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2">
            <Label>Leave Type</Label>
            <Controller
              control={control}
              name="leaveTypeOption"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Leave Type" className="w-full">
                    <SelectValue placeholder="Select leave type">
                      {(v: string) => LEAVE_TYPE_OPTION_LABELS[v]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {LEAVE_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-leave-start">Start Date</Label>
              <Input id="edit-leave-start" type="date" {...register("startDate")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-leave-end">End Date</Label>
              <Input
                id="edit-leave-end"
                type="date"
                disabled={isHalfDay}
                {...register("endDate")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-leave-reason">Reason</Label>
            <Textarea id="edit-leave-reason" {...register("reason")} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
