"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { dailyTimesheetService } from "@/services/daily-timesheet.service";
import { formatISTDate, getISTDateString } from "@/lib/format-ist";
import { DailyTimesheetStatus } from "@/types/it-work-management.types";
import { ItTimesheetStatusBadge } from "./it-timesheet-status-badge";

const ALL = "ALL";

// Only `date` is sent server-side — the IT team is small enough that
// employee/status filtering is done client-side over the day's already-
// loaded rows, which also sidesteps having to fetch a separate "IT team
// roster" endpoint just to populate the employee dropdown (its options are
// derived from this same date's rows instead).
export function ItTimesheetTeamTable() {
  const [date, setDate] = useState(() => getISTDateString());
  const [employee, setEmployee] = useState<string>(ALL);
  const [status, setStatus] = useState<DailyTimesheetStatus | typeof ALL>(ALL);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["daily-timesheet", "team", date],
    queryFn: () => dailyTimesheetService.team({ date, limit: 100 }),
  });

  const entries = useMemo(() => data?.entries ?? [], [data]);

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const entry of entries) {
      const ref = typeof entry.employee === "string" ? null : entry.employee;
      if (ref) map.set(ref._id, ref.fullName);
    }
    return Array.from(map.entries()).map(([id, fullName]) => ({ id, fullName }));
  }, [entries]);

  const filtered = entries.filter((entry) => {
    const ref = typeof entry.employee === "string" ? null : entry.employee;
    if (employee !== ALL && ref?._id !== employee) return false;
    if (status !== ALL && entry.status !== status) return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="team-timesheet-date">Date</Label>
          <Input
            id="team-timesheet-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-[160px]"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Employee</Label>
          <Select value={employee} onValueChange={(v) => setEmployee(v ?? ALL)}>
            <SelectTrigger aria-label="Employee" className="w-[180px]">
              <SelectValue placeholder="All Employees">
                {(v: string) =>
                  v === ALL ? "All Employees" : employeeOptions.find((e) => e.id === v)?.fullName
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Employees</SelectItem>
              {employeeOptions.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger aria-label="Status" className="w-[160px]">
              <SelectValue placeholder="All Statuses">
                {(v: string) =>
                  v === ALL
                    ? "All Statuses"
                    : { NOT_STARTED: "Not Started", DRAFT: "Draft", SUBMITTED: "Submitted" }[
                        v as DailyTimesheetStatus
                      ]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              <SelectItem value="SUBMITTED">Submitted</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="NOT_STARTED">Not Started</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Work Summary</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && isError && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <p className="text-sm text-destructive">Couldn&apos;t load team timesheets.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-20 text-center text-sm text-muted-foreground">
                  No entries match these filters.
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !isError &&
              filtered.map((entry) => {
                const ref = typeof entry.employee === "string" ? null : entry.employee;
                return (
                  <TableRow key={ref?._id ?? entry.id}>
                    <TableCell className="font-medium">{ref?.fullName ?? "—"}</TableCell>
                    <TableCell>{formatISTDate(entry.workDate)}</TableCell>
                    <TableCell>
                      <ItTimesheetStatusBadge status={entry.status} />
                    </TableCell>
                    <TableCell className="max-w-md truncate text-muted-foreground">
                      {entry.description || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
