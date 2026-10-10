"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarDays, Info, Loader2, Plus } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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

// The dropdown offers a full-day and a half-day entry per leave type (e.g.
// "Casual Leave" / "Half Day – Casual Leave") rather than a type picker plus
// a separate checkbox — a composite "TYPE" / "TYPE:HALF" value carries both
// the leave type and whether it's a half day in one selection.
const HALF_SUFFIX = ":HALF";

function parseLeaveTypeOption(option: string): { leaveType: string; isHalfDay: boolean } {
  if (option.endsWith(HALF_SUFFIX)) {
    return { leaveType: option.slice(0, -HALF_SUFFIX.length), isHalfDay: true };
  }
  return { leaveType: option, isHalfDay: false };
}

const schema = z
  .object({
    leaveTypeOption: z.string().min(1, "Select a leave type"),
    startDate: z.string().regex(dateRegex, "Select a start date"),
    endDate: z.string().regex(dateRegex, "Select an end date"),
    reason: z.string().trim().min(5, "Please provide a reason (at least 5 characters)"),
  })
  .refine((data) => data.startDate <= data.endDate, {
    message: "Start date must be before or equal to the end date",
    path: ["endDate"],
  })
  .refine(
    (data) => !parseLeaveTypeOption(data.leaveTypeOption).isHalfDay || data.startDate === data.endDate,
    {
      message: "A half-day request can only be for a single date",
      path: ["endDate"],
    }
  );

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
  const leaveTypeOptions = useMemo(() => {
    const types = Object.values(LEAVE_TYPES).filter((t) => {
      // Casual and Annual Leave are Permanent-employee benefits — Probation
      // employees can apply for Sick/Unpaid/Comp Off only, until they're
      // made Permanent (enforced server-side too, in applyLeave).
      if (t === LEAVE_TYPES.ANNUAL || t === LEAVE_TYPES.CASUAL_PAID) {
        return balance?.employmentType === "PERMANENT";
      }
      if (t === LEAVE_TYPES.COMP_OFF) return balance?.compOff?.hasAnyGrant ?? false;
      return true;
    });
    return types.flatMap((t) => [
      { value: t, label: LEAVE_TYPE_LABELS[t] },
      { value: `${t}${HALF_SUFFIX}`, label: `Half Day ${LEAVE_TYPE_LABELS[t]}` },
    ]);
  }, [balance?.employmentType, balance?.compOff?.hasAnyGrant]);
  const leaveTypeOptionLabels = useMemo(
    () => Object.fromEntries(leaveTypeOptions.map((o) => [o.value, o.label])),
    [leaveTypeOptions]
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
    // SICK is the one type always available regardless of employment type
    // or whether the balance query has finished loading yet (Casual/Annual
    // are conditionally hidden above) — defaulting to it avoids the Select
    // landing on a value that isn't a visible option.
    defaultValues: { leaveTypeOption: LEAVE_TYPES.SICK },
  });

  const leaveTypeOption = watch("leaveTypeOption");
  const startDate = watch("startDate");
  const isHalfDay = parseLeaveTypeOption(leaveTypeOption ?? "").isHalfDay;

  // A half-day request is always a single date — keep End Date in lockstep
  // with Start Date whenever a half-day option is selected, rather than
  // letting it drift.
  useEffect(() => {
    if (isHalfDay && startDate) {
      setValue("endDate", startDate, { shouldValidate: true });
    }
  }, [isHalfDay, startDate, setValue]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const parsed = parseLeaveTypeOption(values.leaveTypeOption);
      return leaveService.applyLeave({
        leaveType: parsed.leaveType,
        startDate: values.startDate,
        endDate: values.endDate,
        isHalfDay: parsed.isHalfDay,
        reason: values.reason,
      });
    },
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
          <div className="flex gap-2.5 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 shrink-0 text-primary" />
            <ul className="list-disc space-y-1 pl-4">
              <li>Sick, Casual, Annual, and Comp Off leave are capped at <strong className="text-foreground">max 2 working days</strong> per request. Leaves &gt; 2 days must be applied as <strong className="text-foreground">Unpaid Leave</strong>.</li>
              <li>Casual leave can be taken at most <strong className="text-foreground">once per calendar month</strong>.</li>
              <li>Unused Sick and Casual Leave from Jan–Jun <strong className="text-foreground">carries forward</strong> into Jul–Dec (not further, and not for Annual Leave).</li>
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
              name="leaveTypeOption"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Leave Type" className="w-full">
                    <SelectValue placeholder="Select leave type">
                      {(v: string) => leaveTypeOptionLabels[v]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {leaveTypeOptions.map((option) => (
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
              <Label htmlFor="startDate" className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                Start Date
              </Label>
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
              <Label htmlFor="endDate" className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                End Date
              </Label>
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

          {isHalfDay && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Badge variant="secondary" className="shrink-0 text-[10px]">
                ½ day
              </Badge>
              This deducts 0.5 day from your balance, for Start Date only.
            </div>
          )}

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
