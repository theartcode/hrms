"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ClockTimePicker } from "@/components/ui/clock-time-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as correctionService from "@/services/attendance-correction.service";
import * as attendanceService from "@/services/attendance.service";
import { formatISTDate } from "@/lib/format-ist";

const timeRegex = /^\d{2}:\d{2}$/;

const schema = z
  .object({
    checkInTime: z.string().regex(timeRegex, "Use HH:MM").optional().or(z.literal("")),
    checkOutTime: z.string().regex(timeRegex, "Use HH:MM").optional().or(z.literal("")),
    reason: z.string().trim().min(5, "Please describe the issue (at least 5 characters)"),
  })
  .refine((data) => data.checkInTime || data.checkOutTime, {
    message: "Provide a requested check-in and/or check-out time",
    path: ["checkInTime"],
  });

type FormValues = z.infer<typeof schema>;

interface CorrectionRequestDialogProps {
  date: string | null;
  onClose: () => void;
}

export function CorrectionRequestDialog({ date, onClose }: CorrectionRequestDialogProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: officeHours } = useQuery({
    queryKey: ["office-hours"],
    queryFn: () => attendanceService.getOfficeHours().then((res) => res.data),
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!date) return;
      return correctionService.requestCorrection({
        date,
        requestedCheckIn: values.checkInTime ? `${date}T${values.checkInTime}:00+05:30` : undefined,
        requestedCheckOut: values.checkOutTime
          ? `${date}T${values.checkOutTime}:00+05:30`
          : undefined,
        reason: values.reason,
      });
    },
    onSuccess: () => {
      toast.success("Correction request submitted");
      queryClient.invalidateQueries({ queryKey: ["my-corrections"] });
      reset();
      onClose();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  function handleClose() {
    setServerError(null);
    reset();
    onClose();
  }

  return (
    <Dialog open={date !== null} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Correction</DialogTitle>
          <DialogDescription>
            {date ? formatISTDate(date) : ""} — describe what needs to be fixed. An
            admin will review this request.
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

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="checkInTime">Requested Check In</Label>
              <Controller
                control={control}
                name="checkInTime"
                render={({ field }) => (
                  <ClockTimePicker
                    id="checkInTime"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                    defaultValue={officeHours?.startTime}
                    defaultMeridiem="AM"
                  />
                )}
              />
              {errors.checkInTime && (
                <p className="text-sm text-destructive">{errors.checkInTime.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="checkOutTime">Requested Check Out</Label>
              <Controller
                control={control}
                name="checkOutTime"
                render={({ field }) => (
                  <ClockTimePicker
                    id="checkOutTime"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                    defaultValue={officeHours?.endTime}
                    defaultMeridiem="PM"
                  />
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="e.g. Forgot to check out, left at the usual time"
              disabled={isSubmitting}
              {...register("reason")}
            />
            {errors.reason && (
              <p className="text-sm text-destructive">{errors.reason.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
