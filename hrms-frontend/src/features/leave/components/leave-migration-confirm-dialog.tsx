"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
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
import { ADJUSTABLE_FIELD_LABELS } from "@/features/leave/leave-status-meta";
import * as leaveService from "@/services/leave.service";
import { AdjustableBalanceField, ProposedLeaveAdjustment } from "@/types/leave.types";

interface LeaveMigrationConfirmDialogProps {
  employeeId: string;
  employeeName: string;
  proposedAdjustments: ProposedLeaveAdjustment[];
  onConfirmed: () => void;
}

export function LeaveMigrationConfirmDialog({
  employeeId,
  employeeName,
  proposedAdjustments,
  onConfirmed,
}: LeaveMigrationConfirmDialogProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [compOffGrant, setCompOffGrant] = useState("0");
  const [values, setValues] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setValues(
        Object.fromEntries(proposedAdjustments.map((a) => [a.field, String(a.proposedValue)]))
      );
      setCompOffGrant("0");
      setReason("");
      setServerError(null);
    }
  }

  const mutation = useMutation({
    mutationFn: () => {
      const adjustments: { field: AdjustableBalanceField; newValue: number }[] =
        proposedAdjustments.map((a) => ({
          field: a.field,
          newValue: Number(values[a.field] ?? a.proposedValue),
        }));
      const grant = Number(compOffGrant);
      if (grant > 0) {
        adjustments.push({ field: "compOffGranted", newValue: grant });
      }
      return leaveService.confirmLeaveMigration(employeeId, { reason, adjustments });
    },
    onSuccess: () => {
      toast.success("Leave migration confirmed");
      setOpen(false);
      onConfirmed();
    },
    onError: (err: Error) => setServerError(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <CheckCircle2 className="h-4 w-4" />
        Review & Confirm Migration
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Confirm Leave Migration</DialogTitle>
          <DialogDescription>
            Review the calculated balance for {employeeName} before it becomes the baseline for
            manual adjustments. Numbers below are editable.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}

          {proposedAdjustments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No imported records feed this year&apos;s balance. Confirming establishes a zero
              baseline you can adjust manually afterward.
            </p>
          ) : (
            proposedAdjustments.map((a) => (
              <div key={a.field} className="flex items-center justify-between gap-3">
                <Label className="text-sm">{ADJUSTABLE_FIELD_LABELS[a.field] ?? a.field}</Label>
                <Input
                  type="number"
                  min={0}
                  className="w-28"
                  value={values[a.field] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [a.field]: e.target.value }))}
                />
              </div>
            ))
          )}

          <div className="flex items-center justify-between gap-3 border-t pt-3">
            <Label className="text-sm">Historical Comp Off Grant (opening balance)</Label>
            <Input
              type="number"
              min={0}
              className="w-28"
              value={compOffGrant}
              onChange={(e) => setCompOffGrant(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="migration-reason">Reason</Label>
            <Textarea
              id="migration-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Migrated from Razorpay export dated 2026-01-15"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || reason.trim().length < 3}
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Migration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
