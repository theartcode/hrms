"use client";

import { useQuery } from "@tanstack/react-query";
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
import { formatISTDate } from "@/lib/format-ist";
import { ItTimesheetStatusBadge } from "./it-timesheet-status-badge";

export function ItTimesheetHistoryList() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["daily-timesheet", "my-history"],
    queryFn: () => dailyTimesheetService.myHistory({ limit: 20 }),
  });

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Work Summary</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={3}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {!isLoading && isError && (
            <TableRow>
              <TableCell colSpan={3} className="h-20 text-center text-sm text-destructive">
                Couldn&apos;t load your timesheet history.
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !isError && data?.entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="h-20 text-center text-sm text-muted-foreground">
                No previous entries yet.
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            !isError &&
            data?.entries.map((entry) => (
              <TableRow key={entry.id ?? entry.workDate}>
                <TableCell>{formatISTDate(entry.workDate)}</TableCell>
                <TableCell>
                  <ItTimesheetStatusBadge status={entry.status} />
                </TableCell>
                <TableCell className="max-w-md truncate text-muted-foreground">
                  {entry.description || "—"}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
