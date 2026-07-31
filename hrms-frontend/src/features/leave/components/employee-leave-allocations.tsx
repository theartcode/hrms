"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GrantLeaveAllocationDialog } from "./grant-leave-allocation-dialog";
import { EditLeaveAllocationDialog } from "./edit-leave-allocation-dialog";
import { DeleteLeaveAllocationDialog } from "./delete-leave-allocation-dialog";
import { LEAVE_TYPE_LABELS } from "@/features/leave/leave-status-meta";
import * as leaveService from "@/services/leave.service";

interface EmployeeLeaveAllocationsProps {
  employeeId: string;
  employeeName: string;
}

// Admin-only — the scoped-to-one-employee counterpart of the
// Administration → Comp Off Leaves page, but generalized to every
// grantable leave type (see grant-leave-allocation-dialog.tsx) and without
// an employee picker, since we're already on that employee's profile.
export function EmployeeLeaveAllocations({
  employeeId,
  employeeName,
}: EmployeeLeaveAllocationsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["leave-allocations", employeeId],
    queryFn: () => leaveService.listLeaveAllocations({ employeeId }).then((res) => res.data.allocations),
  });

  return (
    <Card>
      <CardHeader className="border-b pb-3 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base font-semibold">Leave Allocations</CardTitle>
        <GrantLeaveAllocationDialog employeeId={employeeId} employeeName={employeeName} />
      </CardHeader>
      <CardContent className="pt-4">
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave Type</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {!isLoading && (!data || data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No extra leave granted yet.
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                data?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {LEAVE_TYPE_LABELS[item.leaveType] ?? item.leaveType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{item.period}</TableCell>
                    <TableCell className="text-sm">{item.year}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        +{item.days}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                      {item.reason}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <EditLeaveAllocationDialog item={item} />
                        <DeleteLeaveAllocationDialog item={item} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
