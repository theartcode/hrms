"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { workScheduleService } from "@/services/work-schedule.service";
import { formatISTDate } from "@/lib/format-ist";
import { ItScheduleAddEntryDialog } from "./it-schedule-add-entry-dialog";

const QUERY_KEY = ["work-schedule", "team"];

// Rows = employees, columns = the next 6 working days — a genuine matrix,
// so an actual table (with horizontal scroll on narrow screens, same
// convention as ItWorkItemTable/ItDashboardTeamWorkload) fits better here
// than the card-per-day layout ItScheduleMyGrid uses for a single person.
export function ItScheduleTeamGrid() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => workScheduleService.getTeam(),
  });
  const [addDialogFor, setAddDialogFor] = useState<{ employeeId: string; date: string } | null>(
    null
  );

  const removeMutation = useMutation({
    mutationFn: ({ employeeId, id }: { employeeId: string; id: string }) =>
      workScheduleService.removeForEmployee(employeeId, id),
    onSuccess: () => {
      toast.success("Removed from schedule");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">Couldn&apos;t load the team schedule.</p>
    );
  }

  const days = data?.days ?? [];
  const team = data?.team ?? [];

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">Team Member</TableHead>
              {days.map((date) => (
                <TableHead key={date} className="min-w-[180px]">
                  {formatISTDate(date)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {team.length === 0 && (
              <TableRow>
                <TableCell colSpan={days.length + 1} className="h-20 text-center text-sm text-muted-foreground">
                  No IT team members found.
                </TableCell>
              </TableRow>
            )}
            {team.map((row) => (
              <TableRow key={row.employee._id}>
                <TableCell className="align-top font-medium">{row.employee.fullName}</TableCell>
                {days.map((date) => {
                  const entries = row.entries.filter((e) => e.date === date);
                  return (
                    <TableCell key={date} className="align-top whitespace-normal">
                      <div className="flex flex-col gap-1.5">
                        {entries.length === 0 && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        {entries.map((entry) => (
                          <div
                            key={entry.id}
                            className="flex items-start justify-between gap-1 rounded-md border bg-muted/40 px-2 py-1 text-xs"
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
                              onClick={() =>
                                removeMutation.mutate({ employeeId: row.employee._id, id: entry.id })
                              }
                              disabled={removeMutation.isPending}
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setAddDialogFor({ employeeId: row.employee._id, date })
                          }
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add
                        </Button>
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {addDialogFor && (
        <ItScheduleAddEntryDialog
          open={!!addDialogFor}
          onOpenChange={(open) => !open && setAddDialogFor(null)}
          employeeId={addDialogFor.employeeId}
          date={addDialogFor.date}
          onSubmit={(input) => workScheduleService.addForEmployee(addDialogFor.employeeId, input)}
          invalidateKeys={[QUERY_KEY]}
        />
      )}
    </>
  );
}
