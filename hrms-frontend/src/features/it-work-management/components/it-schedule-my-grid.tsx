"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { workScheduleService } from "@/services/work-schedule.service";
import { formatISTDate } from "@/lib/format-ist";
import { WorkScheduleEntry } from "@/types/it-work-management.types";
import { ItScheduleAddEntryDialog } from "./it-schedule-add-entry-dialog";

const QUERY_KEY = ["work-schedule", "mine"];

// A responsive card-per-day grid rather than a single wide table — reads
// cleanly for one person's own 5-day plan on both desktop (5 across) and
// mobile (stacked). The team-wide equivalent (ItScheduleTeamGrid) uses an
// actual table instead, since a person-by-day matrix genuinely needs rows
// and columns.
export function ItScheduleMyGrid() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => workScheduleService.getMine(),
  });
  const [addDialogDate, setAddDialogDate] = useState<string | null>(null);

  const removeMutation = useMutation({
    mutationFn: (id: string) => workScheduleService.removeMine(id),
    onSuccess: () => {
      toast.success("Removed from schedule");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const entriesByDate = useMemo(() => {
    const map = new Map<string, WorkScheduleEntry[]>();
    for (const entry of data?.entries ?? []) {
      const bucket = map.get(entry.date) ?? [];
      bucket.push(entry);
      map.set(entry.date, bucket);
    }
    return map;
  }, [data]);

  if (isLoading || !user) {
    return (
      <div className="grid gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  const days = data?.days ?? [];

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-5">
        {days.map((date) => {
          const entries = entriesByDate.get(date) ?? [];
          return (
            <Card key={date} size="sm">
              <CardHeader>
                <CardTitle className="text-sm">{formatISTDate(date)}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {entries.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nothing planned</p>
                )}
                {entries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-1 rounded-md border bg-muted/40 px-2 py-1.5 text-xs"
                  >
                    <div>
                      <div className="font-mono text-muted-foreground">
                        {entry.workItem.workItemId}
                      </div>
                      <div className="line-clamp-2">{entry.workItem.title}</div>
                    </div>
                    <button
                      type="button"
                      aria-label="Remove"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMutation.mutate(entry.id)}
                      disabled={removeMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  onClick={() => setAddDialogDate(date)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {addDialogDate && (
        <ItScheduleAddEntryDialog
          open={!!addDialogDate}
          onOpenChange={(open) => !open && setAddDialogDate(null)}
          employeeId={user.id}
          date={addDialogDate}
          onSubmit={(input) => workScheduleService.addMine(input)}
          invalidateKeys={[QUERY_KEY]}
        />
      )}
    </>
  );
}
