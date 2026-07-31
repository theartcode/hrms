"use client";

import { useState } from "react";
import { useForm, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, CalendarPlus } from "lucide-react";
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
import { LEAVE_TYPES } from "@/constants/leave-types";
import { LEAVE_TYPE_LABELS } from "@/features/leave/leave-status-meta";
import * as leaveService from "@/services/leave.service";

// Unpaid leave has no quota to grant extra of — it's unlimited by design
// (see LeaveBalanceCard's "Unlimited" row) — so it's excluded here.
const GRANTABLE_LEAVE_TYPES = [
  LEAVE_TYPES.SICK,
  LEAVE_TYPES.CASUAL_PAID,
  LEAVE_TYPES.ANNUAL,
  LEAVE_TYPES.COMP_OFF,
] as const;

// Sick/Casual balances are tracked per half-year; the backend defaults an
// omitted period to H2 for these two types (see grantExtraLeave), so the
// form always sends one explicitly rather than relying on that default.
const HALF_YEAR_TYPES: string[] = [LEAVE_TYPES.SICK, LEAVE_TYPES.CASUAL_PAID];

const schema = z.object({
  leaveType: z.enum(GRANTABLE_LEAVE_TYPES),
  period: z.enum(["H1", "H2"]),
  days: z.coerce.number().min(0.5, "At least 0.5 days required"),
  reason: z.string().trim().min(3, "Please enter a reason/remarks"),
});

type FormValues = z.infer<typeof schema>;

interface GrantLeaveAllocationDialogProps {
  employeeId: string;
  employeeName: string;
}

export function GrantLeaveAllocationDialog({
  employeeId,
  employeeName,
}: GrantLeaveAllocationDialogProps) {
  const [open, setOpen] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      leaveType: LEAVE_TYPES.COMP_OFF,
      period: "H1",
      days: 1,
      reason: "",
    },
  });

  const leaveType = useWatch({ control, name: "leaveType" });
  const showPeriod = HALF_YEAR_TYPES.includes(leaveType);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      leaveService.grantExtraLeave({
        employeeId,
        days: values.days,
        reason: values.reason,
        leaveType: values.leaveType,
        period: HALF_YEAR_TYPES.includes(values.leaveType) ? values.period : undefined,
        year: new Date().getFullYear(),
      }),
    onSuccess: () => {
      toast.success("Leave granted successfully!");
      queryClient.invalidateQueries({ queryKey: ["leave-allocations"] });
      queryClient.invalidateQueries({ queryKey: ["leave-balance"] });
      queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
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
      <DialogTrigger render={<Button size="sm" />}>
        <CalendarPlus className="h-4 w-4" />
        Grant Leave
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Grant Leave</DialogTitle>
          <DialogDescription>Credit extra leave days to {employeeName}.</DialogDescription>
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
                    <SelectValue>{(v: string) => LEAVE_TYPE_LABELS[v]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {GRANTABLE_LEAVE_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {LEAVE_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          {showPeriod && (
            <div className="flex flex-col gap-2">
              <Label>Half Year</Label>
              <Controller
                control={control}
                name="period"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Half Year">
                      <SelectValue>
                        {(v: string) => (v === "H1" ? "Jan – Jun" : "Jul – Dec")}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="H1">Jan – Jun</SelectItem>
                      <SelectItem value="H2">Jul – Dec</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          )}

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
              Grant Leave
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
