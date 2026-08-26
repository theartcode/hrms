"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/hooks/use-auth";
import { itWorkItemCommentService } from "@/services/it-work-item-comment.service";
import { ItWorkItemComment } from "@/types/it-work-management.types";

interface ItWorkItemCommentItemProps {
  workItemId: string;
  comment: ItWorkItemComment;
}

// Author-only edit/delete — no management override, matching the backend
// exactly (an IT Head cannot silently edit someone else's comment). Body
// is always rendered as plain text (React's default escaping), never
// dangerouslySetInnerHTML, so nothing typed into a comment can inject markup.
export function ItWorkItemCommentItem({ workItemId, comment }: ItWorkItemCommentItemProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isAuthor = !!user && user.id === comment.author._id;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["it-work-item-comments", workItemId] });

  const updateMutation = useMutation({
    mutationFn: () => itWorkItemCommentService.update(workItemId, comment._id, editBody.trim()),
    onSuccess: () => {
      toast.success("Comment updated");
      setEditing(false);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => itWorkItemCommentService.remove(workItemId, comment._id),
    onSuccess: () => {
      toast.success("Comment deleted");
      setDeleteOpen(false);
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-sm font-medium">{comment.author.fullName}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(comment.createdAt).toLocaleString()}
            {comment.updatedAt !== comment.createdAt && " (edited)"}
          </span>
        </div>
        {isAuthor && !editing && (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Edit comment"
              onClick={() => {
                setEditBody(comment.body);
                setEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label="Delete comment"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <Textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            disabled={updateMutation.isPending}
            maxLength={2000}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={editBody.trim().length === 0 || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete comment?"
        description="This can't be undone."
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
}
