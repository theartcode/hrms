"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DayStatusEntry } from "@/types/attendance.types";
import { formatISTDate, formatISTTime, formatWorkedHours } from "@/lib/format-ist";
import { AttendanceStatusBadge } from "./attendance-status-badge";

interface AttendanceDayDialogProps {
  day: DayStatusEntry | null;
  onClose: () => void;
  onRequestCorrection?: (day: DayStatusEntry) => void;
  readOnly?: boolean;
}

export function AttendanceDayDialog({
  day,
  onClose,
  onRequestCorrection,
  readOnly = false,
}: AttendanceDayDialogProps) {
  return (
    <Dialog open={day !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        {day && (
          <>
            <DialogHeader>
              <DialogTitle>{formatISTDate(day.date)}</DialogTitle>
              <DialogDescription>Attendance details for this day.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <AttendanceStatusBadge status={day.status} />
                {day.status === "HOLIDAY" && day.holidayName && (
                  <span className="text-sm text-muted-foreground">{day.holidayName}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Check In</p>
                  <p className="font-medium">{formatISTTime(day.checkIn)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Check Out</p>
                  <p className="font-medium">{formatISTTime(day.checkOut)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Worked Hours</p>
                  <p className="font-medium">{formatWorkedHours(day.workedHours)}</p>
                </div>
              </div>
            </div>

            {!readOnly && onRequestCorrection && (
              <DialogFooter>
                <Button variant="outline" onClick={() => onRequestCorrection(day)}>
                  Request Correction
                </Button>
              </DialogFooter>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
