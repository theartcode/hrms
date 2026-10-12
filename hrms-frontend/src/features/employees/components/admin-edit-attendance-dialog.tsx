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
import { ClockTimePicker } from "@/components/ui/clock-time-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import * as attendanceService from "@/services/attendance.service";
import * as leaveService from "@/services/leave.service";
import { DayStatusEntry } from "@/types/attendance.types";
import { formatISTDate } from "@/lib/format-ist";
import { LEAVE_TYPES } from "@/constants/leave-types";
import { LEAVE_TYPE_LABELS } from "@/features/leave/leave-status-meta";

const IST_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

// Same composite "TYPE" / "TYPE:HALF" dropdown-value scheme used in
// apply-leave-dialog.tsx / edit-leave-request-dialog.tsx — unfiltered here
// (admin tool; eligibility is enforced server-side in adminMarkDayAsLeave).
const HALF_SUFFIX = ":HALF";

function parseLeaveTypeOption(option: string): { leaveType: string; isHalfDay: boolean } {
  if (option.endsWith(HALF_SUFFIX)) {
    return { leaveType: option.slice(0, -HALF_SUFFIX.length), isHalfDay: true };
  }
  return { leaveType: option, isHalfDay: false };
}

const LEAVE_TYPE_OPTIONS = Object.values(LEAVE_TYPES).flatMap((t) => [
  { value: t, label: LEAVE_TYPE_LABELS[t] ?? t },
  { value: `${t}${HALF_SUFFIX}`, label: `Half Day ${LEAVE_TYPE_LABELS[t] ?? t}` },
]);
const LEAVE_TYPE_OPTION_LABELS = Object.fromEntries(
  LEAVE_TYPE_OPTIONS.map((o) => [o.value, o.label])
);

function toHHMM(iso: string | null): string {
  if (!iso) return "";
  return IST_TIME_FORMATTER.format(new Date(iso));
}

function toIso(date: string, time: string): string | null {
  if (!time) return null;
  return `${date}T${time}:00+05:30`;
}

interface AdminEditAttendanceDialogProps {
  employeeId: string;
  day: DayStatusEntry | null;
  onClose: () => void;
}

export function AdminEditAttendanceDialog({ employeeId, day, onClose }: AdminEditAttendanceDialogProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"times" | "leave">("times");
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [leaveTypeOption, setLeaveTypeOption] = useState<string>(LEAVE_TYPES.CASUAL_PAID);
  const [leaveReason, setLeaveReason] = useState("");
  const [lastDay, setLastDay] = useState<DayStatusEntry | null>(null);

  if (day !== lastDay) {
    setLastDay(day);
    setCheckInTime(day ? toHHMM(day.checkIn) : "");
    setCheckOutTime(day ? toHHMM(day.checkOut) : "");
    setMode("times");
    setLeaveTypeOption(LEAVE_TYPES.CASUAL_PAID);
    setLeaveReason("");
  }

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ["employee-daily-detail"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-calendar"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    queryClient.invalidateQueries({ queryKey: ["attendance-admin"] });
    queryClient.invalidateQueries({ queryKey: ["leave-balance"] });
    queryClient.invalidateQueries({ queryKey: ["my-leaves"] });
    queryClient.invalidateQueries({ queryKey: ["admin-leaves"] });
  }

  const timesMutation = useMutation({
    mutationFn: () => {
      if (!day) throw new Error("No day selected");
      return attendanceService.adminSetAttendance(employeeId, day.date, {
        checkIn: toIso(day.date, checkInTime),
        checkOut: toIso(day.date, checkOutTime),
      });
    },
    onSuccess: () => {
      toast.success(checkInTime || checkOutTime ? "Attendance updated" : "Attendance record cleared");
      invalidateAll();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const leaveMutation = useMutation({
    mutationFn: () => {
      if (!day) throw new Error("No day selected");
      const parsed = parseLeaveTypeOption(leaveTypeOption);
      return leaveService.adminMarkDayAsLeave({
        employeeId,
        date: day.date,
        leaveType: parsed.leaveType,
        isHalfDay: parsed.isHalfDay,
        reason: leaveReason || undefined,
      });
    },
    onSuccess: () => {
      toast.success("Day marked as leave");
      invalidateAll();
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isPending = timesMutation.isPending || leaveMutation.isPending;

  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Attendance</DialogTitle>
          <DialogDescription>
            {day ? formatISTDate(day.date) : ""} — set check-in/check-out directly, or mark the whole
            day as leave.
          </DialogDescription>
        </DialogHeader>

        <div className="flex w-fit overflow-hidden rounded-lg border">
          <button
            type="button"
            onClick={() => setMode("times")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium",
              mode === "times" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            Check In / Out
          </button>
          <button
            type="button"
            onClick={() => setMode("leave")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium",
              mode === "leave" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            Mark as Leave
          </button>
        </div>

        {mode === "times" ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-check-in">Check In</Label>
              <ClockTimePicker
                id="admin-check-in"
                value={checkInTime}
                onChange={setCheckInTime}
                disabled={isPending}
                defaultMeridiem="AM"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-check-out">Check Out</Label>
              <ClockTimePicker
                id="admin-check-out"
                value={checkOutTime}
                onChange={setCheckOutTime}
                disabled={isPending}
                defaultMeridiem="PM"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-leave-type">Leave Type</Label>
              <Select value={leaveTypeOption} onValueChange={(v) => v && setLeaveTypeOption(v)}>
                <SelectTrigger id="admin-leave-type" className="w-full">
                  <SelectValue>{(v: string) => LEAVE_TYPE_OPTION_LABELS[v]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Creates an approved leave request for this day and deducts from the employee&apos;s
                balance, same as a normal approval.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-leave-reason">Reason (optional)</Label>
              <Textarea
                id="admin-leave-reason"
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                disabled={isPending}
                placeholder="e.g. Backfilled from paper record"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {mode === "times" ? (
            <>
              <Button
                variant="outline"
                disabled={isPending || (!checkInTime && !checkOutTime)}
                onClick={() => {
                  setCheckInTime("");
                  setCheckOutTime("");
                }}
              >
                Clear Times
              </Button>
              <Button onClick={() => timesMutation.mutate()} disabled={isPending}>
                {timesMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </>
          ) : (
            <Button onClick={() => leaveMutation.mutate()} disabled={isPending}>
              {leaveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Mark as Leave
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
