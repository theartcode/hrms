"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
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

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const schema = z
  .object({
    leaveType: z.string().min(1, "Select a leave type"),
    startDate: z.string().regex(dateRegex, "Select a start date"),
    endDate: z.string().regex(dateRegex, "Select an end date"),
    isHalfDay: z.boolean().optional(),
    reason: z.string().trim().min(5, "Please provide a reason (at least 5 characters)"),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "Start date must be before or equal to the end date",
    path: ["endDate"],
  })
  .refine((data) => !data.isHalfDay || data.startDate === data.endDate, {
    message: "A half-day request can only be for a single date",
    path: ["endDate"],
  });

type FormValues = z.infer<typeof schema>;

export function ApplyLeaveDialog() {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  // Shares its cache with LeaveBalanceCard's self-view query (same key,
  // both omit employeeId) — just reused here to know whether Annual/Comp
  // Off should even be offered, rather than letting someone pick an option
  // that can only fail with a "0 days available" rejection at submit time.
  const { data: balance } = useQuery({
    queryKey: ["leave-balance", undefined],
    queryFn: () => leaveService.getBalance({}).then((res) => res.data),
  });
  const leaveTypeOptions = useMemo(
    () =>
      Object.values(LEAVE_TYPES).filter((t) => {
        if (t === LEAVE_TYPES.ANNUAL) return balance?.employmentType === "PERMANENT";
        if (t === LEAVE_TYPES.COMP_OFF) return balance?.compOff?.hasAnyGrant ?? false;
        return true;
      }),
    [balance?.employmentType, balance?.compOff?.hasAnyGrant]
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { leaveType: LEAVE_TYPES.CASUAL_PAID, isHalfDay: false },
  });

  const isHalfDay = watch("isHalfDay");
  const startDate = watch("startDate");

  // A half-day request is always a single date — keep End Date in lockstep
  // with Start Date while the checkbox is on, rather than letting it drift.
  useEffect(() => {
    if (isHalfDay && startDate) {
      setValue("endDate", startDate, { shouldValidate: true });
    }
  }, [isHalfDay, startDate, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => leaveService.applyLeave(values),
    onSuccess: () => {
      toast.success("Leave request submitted");
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balance"] });
      reset();
      setOpen(false);
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
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4" />
        Apply Leave
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
          <DialogDescription>
            Select a leave type and date range. An admin will review your request.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <div className="rounded-md bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Leave Policy Reminders:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              <li>Sick, Casual, Annual, and Comp Off leave are capped at <strong>max 2 working days</strong> per request. Leaves &gt; 2 days must be applied as <strong>Unpaid Leave</strong>.</li>
              <li>Casual leave can be taken at most <strong>once per calendar month</strong>.</li>
              <li>Unused Sick and Casual Leave from Jan–Jun <strong>carries forward</strong> into Jul–Dec (not further, and not for Annual Leave).</li>
              <li>Need less than a full day? Check <strong>Half day</strong> below to deduct 0.5 day instead of 1.</li>
              <li>Pending requests immediately reserve leave days from your balance.</li>
            </ul>
          </div>

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
                    <SelectValue placeholder="Select leave type">
                      {(v: string) => LEAVE_TYPE_LABELS[v]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypeOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {LEAVE_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                disabled={isSubmitting}
                {...register("startDate")}
              />
              {errors.startDate && (
                <p className="text-sm text-destructive">{errors.startDate.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                disabled={isSubmitting || isHalfDay}
                {...register("endDate")}
              />
              {errors.endDate && (
                <p className="text-sm text-destructive">{errors.endDate.message}</p>
              )}
            </div>
          </div>

          <Controller
            control={control}
            name="isHalfDay"
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={field.value ?? false}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={isSubmitting}
                />
                Half day
                <span className="text-xs text-muted-foreground">
                  (0.5 day, Start Date only)
                </span>
              </label>
            )}
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea id="reason" disabled={isSubmitting} {...register("reason")} />
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
