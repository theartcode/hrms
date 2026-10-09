"use client";

import { useQuery } from "@tanstack/react-query";
import { PartyPopper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import * as employeeService from "@/services/employee.service";
import { formatISTDate } from "@/lib/format-ist";

export function UpcomingAnniversaries() {
  const { data, isLoading } = useQuery({
    queryKey: ["employees", "upcoming-anniversaries"],
    queryFn: () => employeeService.listUpcomingAnniversaries(30),
  });

  const upcoming = data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Upcoming Work Anniversaries</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <Skeleton className="h-24 w-full" />}

        {!isLoading && upcoming.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <PartyPopper className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No work anniversaries in the next 30 days.</p>
          </div>
        )}

        {!isLoading && upcoming.length > 0 && (
          <div className="flex flex-col divide-y">
            {upcoming.map((a) => (
              <div
                key={`${a.employeeId}-${a.date}`}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{a.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatISTDate(a.date)}
                  </span>
                </div>
                <Badge variant="secondary">
                  {a.years} {a.years === 1 ? "year" : "years"}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
