"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { itWorkItemService } from "@/services/it-work-item.service";
import { IT_WORK_ITEM_ACTIVITY_LABELS } from "../it-work-item-meta";

// A Work Item-specific timeline built on the existing Activity Log — not a
// new activity center, not paginated, just this one item's history. Reads
// through GET /work-items/:id/activity (it-work-item.service.ts's
// listWorkItemActivity), which applies the same visibility check as the
// detail page itself, rather than the Admin/Super Admin-only GET /activity
// this app already has elsewhere.
export function ItWorkItemTimeline({ workItemId }: { workItemId: string }) {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["it-work-item-activity", workItemId],
    queryFn: () => itWorkItemService.activity(workItemId),
  });

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="flex items-center gap-1 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          Couldn&apos;t load activity.
        </p>
        <button
          type="button"
          className="text-xs text-muted-foreground underline disabled:opacity-50"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {data.map((entry) => {
        const reason = entry.metadata?.reason;
        const from = entry.metadata?.from;
        const to = entry.metadata?.to;
        return (
          <li key={entry.id} className="flex flex-col gap-0.5 border-l-2 pl-3">
            <div className="flex flex-wrap items-baseline gap-2 text-sm">
              <span className="font-medium">
                {IT_WORK_ITEM_ACTIVITY_LABELS[entry.action] ?? entry.action}
              </span>
              <span className="text-xs text-muted-foreground">{entry.actorEmployeeId}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(entry.createdAt).toLocaleString()}
              </span>
            </div>
            {typeof from === "string" && typeof to === "string" && (
              <p className="text-xs text-muted-foreground">
                {from} &rarr; {to}
              </p>
            )}
            {typeof reason === "string" && reason && (
              <p className="text-sm text-muted-foreground">&ldquo;{reason}&rdquo;</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
