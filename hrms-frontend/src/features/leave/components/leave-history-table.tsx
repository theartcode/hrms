"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LEAVE_TYPE_LABELS, LEAVE_STATUS_LABELS, LEAVE_STATUS_BADGE } from "@/features/leave/leave-status-meta";
import { LeaveHistoryItem } from "@/types/leave.types";

// Shows both native (post-go-live) leave requests and imported historical
// rows in one merged timeline — imported rows always carry an "Imported
// Data" badge so it's never ambiguous which numbers came from Razorpay.
export function LeaveHistoryTable({ history }: { history: LeaveHistoryItem[] }) {
  if (history.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No leave history yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dates</TableHead>
            <TableHead>Leave Type</TableHead>
            <TableHead>Days</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history.map((item) => (
            <TableRow key={`${item.source}-${item.id}`}>
              <TableCell className="text-sm">
                {item.startDate === item.endDate ? item.startDate : `${item.startDate} – ${item.endDate}`}
              </TableCell>
              <TableCell>{LEAVE_TYPE_LABELS[item.leaveType] ?? item.leaveType}</TableCell>
              <TableCell>{item.days}</TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={LEAVE_STATUS_BADGE[item.status as keyof typeof LEAVE_STATUS_BADGE]}
                >
                  {LEAVE_STATUS_LABELS[item.status as keyof typeof LEAVE_STATUS_LABELS] ?? item.status}
                </Badge>
              </TableCell>
              <TableCell>
                {item.source === "NATIVE" ? (
                  <span className="text-xs text-muted-foreground">Native</span>
                ) : (
                  <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-transparent">
                    Imported Data
                  </Badge>
                )}
              </TableCell>
              <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                {item.reason ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
