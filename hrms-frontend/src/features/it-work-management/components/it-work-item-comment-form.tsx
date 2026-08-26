"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { itWorkItemCommentService } from "@/services/it-work-item-comment.service";

export function ItWorkItemCommentForm({ workItemId }: { workItemId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const mutation = useMutation({
    mutationFn: () => itWorkItemCommentService.create(workItemId, body.trim()),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["it-work-item-comments", workItemId] });
      queryClient.invalidateQueries({ queryKey: ["it-work-item-activity", workItemId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        placeholder="Write a comment..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={mutation.isPending}
        maxLength={2000}
      />
      <Button
        size="sm"
        className="self-end"
        disabled={body.trim().length === 0 || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Post Comment
      </Button>
    </div>
  );
}
