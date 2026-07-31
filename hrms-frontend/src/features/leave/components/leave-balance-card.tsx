"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import * as leaveService from "@/services/leave.service";

interface LeaveBalanceCardProps {
  employeeId?: string;
}

function BalanceRow({
  label,
  used,
  total,
  colorClass,
}: {
  label: string;
  used: number;
  total: number | null;
  colorClass: string;
}) {
  const percent = total ? Math.min(100, (used / total) * 100) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {total === null ? "Unlimited" : `${used} / ${total}`}
        </span>
      </div>
      {total !== null && <Progress value={percent} indicatorClassName={colorClass} />}
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
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            <BalanceRow
              label="Sick Leave (Jan–Jun)"
              used={data?.sick.half1.used ?? 0}
              total={data?.sick.half1.total ?? null}
              colorClass="bg-blue-500"
            />
            <BalanceRow
              label="Sick Leave (Jul–Dec)"
              used={data?.sick.half2.used ?? 0}
              total={data?.sick.half2.total ?? null}
              colorClass="bg-blue-600"
            />
            <BalanceRow
              label="Casual Leave (Jan–Jun)"
              used={data?.casualPaid.half1.used ?? 0}
              total={data?.casualPaid.half1.total ?? null}
              colorClass="bg-emerald-500"
            />
            <BalanceRow
              label="Casual Leave (Jul–Dec)"
              used={data?.casualPaid.half2.used ?? 0}
              total={data?.casualPaid.half2.total ?? null}
              colorClass="bg-emerald-600"
            />
            {/* Annual Leave only accrues once Permanent — the row simply
                doesn't exist for a Probation employee. */}
            {data?.employmentType === "PERMANENT" && (
              <BalanceRow
                label="Annual Leave"
                used={data.annual.used}
                total={data.annual.accrued}
                colorClass="bg-violet-500"
              />
            )}
            {/* Only visible to employees who've actually been granted Comp
                Off — most employees never have, and showing a permanent
                "0 / 0" for them is just noise. */}
            {data?.compOff?.hasAnyGrant && (
              <BalanceRow
                label="Comp Off Leave"
                used={data.compOff.used}
                total={data.compOff.granted}
                colorClass="bg-amber-500"
              />
            )}
            <BalanceRow
              label="Unpaid Leave"
              used={data?.unpaid.used ?? 0}
              total={null}
              colorClass="bg-muted-foreground"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
