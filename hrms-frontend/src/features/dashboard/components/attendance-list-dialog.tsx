"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import * as attendanceService from "@/services/attendance.service";
import { ROUTES } from "@/constants/routes";
import { getISTDateString, formatISTTime } from "@/lib/format-ist";

export type AttendanceListMode = "checkedIn" | "notCheckedIn" | null;

interface EmployeeRow {
  id: string;
  employeeId: string;
  fullName: string;
  department: string | null;
  checkIn?: string | null;
}

export function AttendanceListDialog({
  mode,
  onClose,
}: {
  mode: AttendanceListMode;
  onClose: () => void;
}) {
  const router = useRouter();
  const todayStr = getISTDateString();

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-attendance-list", mode, todayStr],
    queryFn: async (): Promise<EmployeeRow[]> => {
      if (mode === "notCheckedIn") {
        const res = await attendanceService.notCheckedInToday(todayStr);
        return res.data.employees;
      }
      const res = await attendanceService.adminList({ date: todayStr, limit: 100 });
      return res.data.records.map((r) => ({
        id: r.employee.id,
        employeeId: r.employee.employeeId,
        fullName: r.employee.fullName,
        department: r.department,
        checkIn: r.checkIn,
      }));
    },
    enabled: mode !== null,
  });

  const title = mode === "notCheckedIn" ? "Not Checked In" : "Checked In Today";

  return (
    <Dialog open={mode !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {data ? `${data.length} employee${data.length === 1 ? "" : "s"}` : "Loading…"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-96 flex-col gap-1 overflow-y-auto">
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={`skeleton-${i}`} className="h-12 w-full" />
            ))}

          {!isLoading && (data?.length ?? 0) === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Users className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No employees to show.</p>
            </div>
          )}

          {!isLoading &&
            data?.map((employee) => (
              <button
                key={employee.id}
                type="button"
                onClick={() => {
                  router.push(ROUTES.EMPLOYEE_DETAIL(employee.id));
                  onClose();
                }}
                className="flex w-full items-center justify-between gap-3 rounded-lg p-2.5 text-left transition-colors hover:bg-accent"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{employee.fullName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {employee.employeeId}
                    {employee.department ? ` · ${employee.department}` : ""}
                  </span>
                </div>
                {mode === "checkedIn" && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatISTTime(employee.checkIn ?? null)}
                  </span>
                )}
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
