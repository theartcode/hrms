"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { dailyTimesheetService } from "@/services/daily-timesheet.service";
import { formatISTDate } from "@/lib/format-ist";
import { DailyTimesheetEntry } from "@/types/it-work-management.types";
import { ItTimesheetStatusBadge } from "./it-timesheet-status-badge";
import { ItDailyTimesheetWorkItemsPicker } from "./it-daily-timesheet-work-items-picker";

export function ItTimesheetTodayCard() {
  const { data: timesheet, isLoading } = useQuery({
    queryKey: ["daily-timesheet", "today"],
    queryFn: () => dailyTimesheetService.getToday(),
  });

  if (isLoading || !timesheet) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Mounted only once "today"'s record has actually loaded, so its local
  // edit state can be seeded from a lazy useState initializer instead of
  // an effect — React keeps this component instance across refetches
  // (save/submit invalidation) rather than remounting it, which is exactly
  // what lets in-progress typing survive a background refetch.
  return <ItTimesheetTodayForm timesheet={timesheet} />;
}

function ItTimesheetTodayForm({ timesheet }: { timesheet: DailyTimesheetEntry }) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(timesheet.description);
  const [workItems, setWorkItems] = useState<string[]>(timesheet.workItems.map((w) => w._id));

  const isSubmitted = timesheet.status === "SUBMITTED";

  const saveMutation = useMutation({
    mutationFn: () => dailyTimesheetService.saveToday({ description, workItems }),
    onSuccess: () => {
      toast.success("Saved");
      queryClient.invalidateQueries({ queryKey: ["daily-timesheet"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await dailyTimesheetService.saveToday({ description, workItems });
      return dailyTimesheetService.submitToday();
    },
    onSuccess: () => {
      toast.success("Timesheet submitted");
      queryClient.invalidateQueries({ queryKey: ["daily-timesheet"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today&apos;s Work — {formatISTDate(timesheet.workDate)}</CardTitle>
        <CardAction>
          <ItTimesheetStatusBadge status={timesheet.status} />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="timesheet-description">What did you work on today?</Label>
          <Textarea
            id="timesheet-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSubmitted}
            placeholder="Briefly describe today's work..."
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Work items (optional)</Label>
          {isSubmitted ? (
            timesheet.workItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">No work items linked.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {timesheet.workItems.map((w) => (
                  <li key={w._id} className="text-muted-foreground">
                    <span className="font-mono text-xs">{w.workItemId}</span> — {w.title}
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ItDailyTimesheetWorkItemsPicker value={workItems} onChange={setWorkItems} />
          )}
        </div>

        {!isSubmitted && (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || submitMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={
                !description.trim() || saveMutation.isPending || submitMutation.isPending
              }
            >
              {submitMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
