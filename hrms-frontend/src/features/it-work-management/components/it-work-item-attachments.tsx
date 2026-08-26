"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Download, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useItWorkManagementAccess } from "@/hooks/use-it-work-management-access";
import { itWorkItemAttachmentService } from "@/services/it-work-item-attachment.service";
import { ItWorkItemAttachment } from "@/types/it-work-management.types";

// Independent of the existing Task module's TaskAttachmentPanel — no
// shared code, no shared import, per the Phase 1D-B brief. The overall
// shape (hidden file input + button, progress bar, list with a download
// action) is a deliberately similar established pattern in this codebase,
// reimplemented against this module's own service/permissions, with
// delete added (which Task's own panel deliberately omits for its
// employee-facing scope).
const ACCEPTED_TYPES = ".pdf,.jpg,.jpeg,.png,.docx";
const MAX_BYTES = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ItWorkItemAttachments({ workItemId }: { workItemId: string }) {
  const { user } = useAuth();
  const { canManage, isReadOnlyViewer } = useItWorkManagementAccess();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ItWorkItemAttachment | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["it-work-item-attachments", workItemId],
    queryFn: () => itWorkItemAttachmentService.list(workItemId),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["it-work-item-attachments", workItemId] });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast.error("File must be under 10MB");
      return;
    }

    setProgress(0);
    try {
      await itWorkItemAttachmentService.upload(workItemId, file, setProgress);
      toast.success("Attachment uploaded");
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["it-work-item-activity", workItemId] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload attachment");
    } finally {
      setProgress(null);
    }
  }

  const downloadMutation = useMutation({
    mutationFn: (attachmentId: string) =>
      itWorkItemAttachmentService.getDownloadUrl(workItemId, attachmentId),
    onSuccess: (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (attachmentId: string) => itWorkItemAttachmentService.remove(workItemId, attachmentId),
    onSuccess: () => {
      toast.success("Attachment deleted");
      setPendingDelete(null);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["it-work-item-activity", workItemId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-3">
      {!isReadOnlyViewer && (
        <div className="flex items-center justify-end gap-3">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={progress !== null}
            onClick={() => inputRef.current?.click()}
          >
            {progress !== null ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Upload
          </Button>
        </div>
      )}

      {progress !== null && <Progress value={progress} className="h-1.5" />}

      {isLoading && <Skeleton className="h-16 w-full" />}

      {!isLoading && isError && (
        <div className="flex flex-col items-start gap-2">
          <p className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Couldn&apos;t load attachments.
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            {isRefetching && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Try again
          </Button>
        </div>
      )}

      {!isLoading && !isError && data?.length === 0 && (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      )}

      {!isLoading && !isError && data && data.length > 0 && (
        <ul className="flex flex-col gap-2">
          {data.map((attachment) => {
            const isUploader = !!user && user.id === attachment.uploadedBy._id;
            const canDelete = canManage || isUploader;
            return (
              <li
                key={attachment._id}
                className="flex items-center justify-between gap-3 rounded-lg border p-3"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {attachment.originalFileName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(attachment.fileSizeBytes)} &middot; Uploaded by{" "}
                      {attachment.uploadedBy.fullName} &middot;{" "}
                      {new Date(attachment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Download ${attachment.originalFileName}`}
                    disabled={downloadMutation.isPending}
                    onClick={() => downloadMutation.mutate(attachment._id)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Delete ${attachment.originalFileName}`}
                      onClick={() => setPendingDelete(attachment)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete attachment?"
        description={`"${pendingDelete?.originalFileName}" will be permanently removed.`}
        confirmLabel="Delete"
        destructive
        isLoading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete._id)}
      />
    </div>
  );
}
