"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, CalendarPlus2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAVE_TYPES, LEAVE_IMPORT_STATUS } from "@/constants/leave-types";
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS } from "@/features/leave/leave-status-meta";
import * as leaveService from "@/services/leave.service";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    leaveType: z.string().min(1, "Select a leave type"),
    startDate: z.string().regex(dateRegex, "Select a start date"),
    endDate: z.string().regex(dateRegex, "Select an end date"),
    days: z.coerce.number().positive("Days must be greater than 0"),
    status: z.string().min(1, "Select a status"),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

type FormValues = z.infer<typeof schema>;

export function AddManualLeaveDialog({
  employeeId,
  onAdded,
}: {
  employeeId: string;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      leaveType: "",
      startDate: "",
      endDate: "",
      days: 1,
      status: LEAVE_IMPORT_STATUS.APPROVED,
      reason: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      leaveService.importLeaveHistory(employeeId, {
        source: "MANUAL",
        rows: [
          {
            leaveType: values.leaveType as never,
            startDate: values.startDate,
            endDate: values.endDate,
            days: values.days,
            status: values.status as never,
            reason: values.reason || undefined,
          },
        ],
      }),
    onSuccess: () => {
      toast.success("Leave record added");
      reset();
      setOpen(false);
      onAdded();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setServerError(null);
          reset();
        }
      }}
    >
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        <CalendarPlus2 className="h-4 w-4" />
        Add Manual Record
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Manual Leave Record</DialogTitle>
          <DialogDescription>
            Record a single historical leave for this employee — e.g. one that wasn&apos;t
            captured through a CSV import.
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
            <Label>Leave Type</Label>
            <Controller
              control={control}
              name="leaveType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Leave Type">
                    <SelectValue placeholder="Select leave type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.values(LEAVE_TYPES).map((type) => (
                      <SelectItem key={type} value={type}>
                        {LEAVE_TYPE_LABELS[type] ?? type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.leaveType && (
              <p className="text-xs text-destructive">{errors.leaveType.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input id="startDate" type="date" disabled={isSubmitting} {...register("startDate")} />
              {errors.startDate && (
                <p className="text-xs text-destructive">{errors.startDate.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input id="endDate" type="date" disabled={isSubmitting} {...register("endDate")} />
              {errors.endDate && (
                <p className="text-xs text-destructive">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="days">Days</Label>
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
              <Label>Status</Label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(LEAVE_IMPORT_STATUS).map((status) => (
                        <SelectItem key={status} value={status}>
                          {LEAVE_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.status && <p className="text-xs text-destructive">{errors.status.message}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              placeholder="e.g. Recorded from paper leave register, missed during CSV import..."
              disabled={isSubmitting}
              {...register("reason")}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Record
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
