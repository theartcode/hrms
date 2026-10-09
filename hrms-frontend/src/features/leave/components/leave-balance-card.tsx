"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import * as leaveService from "@/services/leave.service";
import { LeaveBalanceBucket } from "@/types/leave.types";

interface LeaveBalanceCardProps {
  employeeId?: string;
}

// "Remaining" is the number an employee actually needs ("how many do I have
// left to use right now") — it leads every row, in large text. The used/
// total ratio and any carry-forward are supporting detail underneath, not
// the headline, so nobody has to do subtraction to understand their balance.
function HalfRow({
  period,
  bucket,
  colorClass,
  // True once this half has ended — its leftover days are already folded
  // into the other half's total, so they're no longer a separate usable
  // pool. Shown dimmed with a "closed" note instead of "X left", so it
  // can't be read as still-available on top of the other half's total.
  closed,
  // The actual amount that rolled into the other half — NOT the same as
  // this bucket's own `remaining` (that also subtracts pending requests,
  // and is nonzero even when Carry Forward is off for this type). Only
  // meaningful when `closed` is true.
  rolledOver,
}: {
  period: string;
  bucket: LeaveBalanceBucket;
  colorClass: string;
  closed?: boolean;
  rolledOver?: number;
}) {
  const total = bucket.total ?? 0;
  const remaining = bucket.remaining ?? 0;
  const percent = total ? Math.min(100, ((total - remaining) / total) * 100) : 0;

  return (
    <div className={cn("flex flex-col gap-1", closed && "opacity-45")}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{period}</span>
        {closed ? (
          <span className="text-xs text-muted-foreground">
            Closed{rolledOver ? ` — ${rolledOver} rolled into Jul–Dec` : ""}
          </span>
        ) : (
          <span>
            <span className="font-semibold tabular-nums">{remaining}</span>
            <span className="text-xs text-muted-foreground"> of {total} left</span>
          </span>
        )}
      </div>
      <Progress value={percent} indicatorClassName={colorClass} />
      {!closed && !!bucket.carriedForward && (
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
          +{bucket.carriedForward} carried over from the first half
        </span>
      )}
    </div>
  );
}

function LeaveTypeSection({
  label,
  half1,
  half2,
  colorClass,
  firstHalfOver,
}: {
  label: string;
  half1: LeaveBalanceBucket;
  half2: LeaveBalanceBucket;
  colorClass: string;
  firstHalfOver: boolean;
}) {
  // Once H1 is over, its leftover is already counted inside half2.remaining
  // (as carriedForward) — summing both here would double-count those days.
  const combinedRemaining = firstHalfOver
    ? (half2.remaining ?? 0)
    : (half1.remaining ?? 0) + (half2.remaining ?? 0);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{label}</span>
        <span className="text-lg font-semibold tabular-nums">
          {combinedRemaining}
          <span className="ml-1 text-xs font-normal text-muted-foreground">days left</span>
        </span>
      </div>
      <HalfRow
        period="Jan–Jun"
        bucket={half1}
        colorClass={colorClass}
        closed={firstHalfOver}
        rolledOver={half2.carriedForward}
      />
      <HalfRow period="Jul–Dec" bucket={half2} colorClass={colorClass} />
    </div>
  );
}

function SimpleLeaveRow({
  label,
  remaining,
  used,
  total,
  totalLabel = "of",
  colorClass,
  caption,
}: {
  label: string;
  remaining: number;
  used: number;
  total: number;
  totalLabel?: string;
  colorClass: string;
  caption?: string;
}) {
  const percent = total ? Math.min(100, (used / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 p-3">
      <div className="flex items-baseline justify-between">
        <span className="font-medium">{label}</span>
        <span>
          <span className="text-lg font-semibold tabular-nums">{remaining}</span>
          <span className="ml-1 text-xs text-muted-foreground">days left</span>
        </span>
      </div>
      <Progress value={percent} indicatorClassName={colorClass} />
      <p className="text-xs text-muted-foreground">
        {used} used {totalLabel} {total}
        {caption ? ` · ${caption}` : ""}
      </p>
    </div>
  );
}

export function LeaveBalanceCard({ employeeId }: LeaveBalanceCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["leave-balance", employeeId],
    queryFn: () => leaveService.getBalance({ employeeId }).then((res) => res.data),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leave Balance</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <LeaveTypeSection
              label="Sick Leave"
              half1={data?.sick.half1 ?? { used: 0, total: 0, remaining: 0 }}
              half2={data?.sick.half2 ?? { used: 0, total: 0, remaining: 0 }}
              colorClass="bg-blue-500"
              firstHalfOver={data?.firstHalfOver ?? false}
            />
            <LeaveTypeSection
              label="Casual Leave"
              half1={data?.casualPaid.half1 ?? { used: 0, total: 0, remaining: 0 }}
              half2={data?.casualPaid.half2 ?? { used: 0, total: 0, remaining: 0 }}
              colorClass="bg-emerald-500"
              firstHalfOver={data?.firstHalfOver ?? false}
            />
            {/* Annual Leave only accrues once Permanent — the row simply
                doesn't exist for a Probation employee. */}
            {data?.employmentType === "PERMANENT" && (
              <SimpleLeaveRow
                label="Annual Leave"
                remaining={data.annual.remaining}
                used={data.annual.used}
                total={data.annual.accrued}
                totalLabel="of"
                colorClass="bg-violet-500"
                caption="grows a little more each month you work"
              />
            )}
            {/* Only visible to employees who've actually been granted Comp
                Off — most employees never have, and showing a permanent
                "0 left" for them is just noise. */}
            {data?.compOff?.hasAnyGrant && (
              <SimpleLeaveRow
                label="Comp Off"
                remaining={data.compOff.remaining}
                used={data.compOff.used}
                total={data.compOff.granted}
                totalLabel="of"
                colorClass="bg-amber-500"
                caption="granted for extra days worked"
              />
            )}
            <div className="flex items-baseline justify-between rounded-lg border border-border/60 p-3">
              <div className="flex flex-col">
                <span className="font-medium">Unpaid Leave</span>
                <span className="text-xs text-muted-foreground">
                  {data?.unpaid.used ?? 0} day(s) taken this year
                </span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">Unlimited</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
