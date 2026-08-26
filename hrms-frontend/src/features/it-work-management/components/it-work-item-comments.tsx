"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { itWorkItemCommentService } from "@/services/it-work-item-comment.service";
import { useItWorkManagementAccess } from "@/hooks/use-it-work-management-access";
import { ItWorkItemCommentItem } from "./it-work-item-comment-item";
import { ItWorkItemCommentForm } from "./it-work-item-comment-form";

// Distinguishes loading/error/empty/success explicitly (§23 of the brief)
// — a failed fetch never silently renders as "no comments yet."
// Read-only viewers (CEO) see comments but never the composer, matching
// the backend's own rule (addComment rejects the "readonly" tier outright).
export function ItWorkItemComments({ workItemId }: { workItemId: string }) {
  const { isReadOnlyViewer } = useItWorkManagementAccess();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["it-work-item-comments", workItemId],
    queryFn: () => itWorkItemCommentService.list(workItemId),
  });

  return (
    <div className="flex flex-col gap-4">
      {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

      {!isLoading && isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Couldn&apos;t load comments.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !isError && (
        <>
          {data && data.length > 0 ? (
            <div className="flex flex-col gap-3">
              {data.map((comment) => (
                <ItWorkItemCommentItem
                  key={comment._id}
                  workItemId={workItemId}
                  comment={comment}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          )}

          {!isReadOnlyViewer && <ItWorkItemCommentForm workItemId={workItemId} />}
        </>
      )}
    </div>
  );
}
