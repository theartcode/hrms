"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Clock, Loader2, Pencil, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useItWorkManagementAccess } from "@/hooks/use-it-work-management-access";
import { itWorkItemService } from "@/services/it-work-item.service";
import { ItWorkItem, ItWorkItemStatus } from "@/types/it-work-management.types";
import {
  IT_WORK_ITEM_MANAGEMENT_STATUS_TRANSITIONS,
  IT_WORK_ITEM_STATUS_LABELS,
  IT_WORK_ITEM_TEAM_STATUS_TRANSITIONS,
} from "../it-work-item-meta";
import { ItWorkItemStatusBadge } from "./it-work-item-badges";
import { ItWorkItemBlockDialog } from "./it-work-item-block-dialog";
import { ItWorkItemCancelDialog } from "./it-work-item-cancel-dialog";
import { ItWorkItemReviewDialog } from "./it-work-item-review-dialog";
import { ItWorkItemRejectProposalDialog } from "./it-work-item-reject-proposal-dialog";
import { ItWorkItemRequestProposalChangesDialog } from "./it-work-item-request-proposal-changes-dialog";
import { ItWorkItemEditProposalDialog } from "./it-work-item-edit-proposal-dialog";

// A team-proposed item awaiting the IT Head's approve/reject decision —
// every other status-changing action is blocked server-side while PENDING
// (see it-work-item.service.ts's assertNotPendingApproval), so this
// renders in place of the normal status control entirely rather than
// alongside it. Three outcomes for the Head: Approve, Reject (cancels it),
// or Request Changes (stays pending, sends the proposer a note via the
// existing reviewNote field). The proposer can then edit their own
// proposal directly — see ItWorkItemEditProposalDialog — no need to cancel
// and repropose from scratch.
function PendingApprovalControl({ workItem }: { workItem: ItWorkItem }) {
  const { user } = useAuth();
  const { canManage } = useItWorkManagementAccess();
  const queryClient = useQueryClient();
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const isProposer = !!user && workItem.proposedBy?._id === user.id;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["it-work-item", workItem._id] });
    queryClient.invalidateQueries({ queryKey: ["it-work-items"] });
    queryClient.invalidateQueries({ queryKey: ["it-work-item-activity", workItem._id] });
    queryClient.invalidateQueries({ queryKey: ["it-head-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["it-my-dashboard"] });
  };

  const approveMutation = useMutation({
    mutationFn: () => itWorkItemService.approveProposal(workItem._id),
    onSuccess: () => {
      toast.success("Proposal approved — now tracked");
      invalidate();
      setApproveOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400"
        >
          <Clock className="h-3 w-3" />
          Pending Approval
        </Badge>

        {canManage && (
          <>
            <Button size="sm" onClick={() => setApproveOpen(true)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRequestChangesOpen(true)}>
              <Undo2 className="h-3.5 w-3.5" />
              Request Changes
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
          </>
        )}

        {!canManage && isProposer && (
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="h-3.5 w-3.5" />
            Edit Proposal
          </Button>
        )}
      </div>

      {workItem.reviewNote && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          Changes requested: &ldquo;{workItem.reviewNote}&rdquo;
        </p>
      )}

      {!canManage && (
        <p className="text-xs text-muted-foreground">
          Proposed{workItem.proposedBy ? ` by ${workItem.proposedBy.fullName}` : ""} — waiting for
          the IT Head to approve, request changes, or reject before this is tracked.
        </p>
      )}

      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve this proposal?"
        description="The work item becomes part of the tracked backlog and can then be moved through the normal status workflow."
        confirmLabel="Approve"
        isLoading={approveMutation.isPending}
        onConfirm={() => approveMutation.mutate()}
      />
      <ItWorkItemRequestProposalChangesDialog
        open={requestChangesOpen}
        onOpenChange={setRequestChangesOpen}
        workItemId={workItem._id}
      />
      <ItWorkItemRejectProposalDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        workItemId={workItem._id}
      />
      {isProposer && (
        <ItWorkItemEditProposalDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          workItem={workItem}
        />
      )}
    </div>
  );
}

// Independent of the existing Task module's TaskStatusSelector — no
// shared code, no shared import — per the Phase 1C-B brief's explicit
// instruction not to reuse Task's status logic. The shape (badge + a row
// of contextual action buttons, dialogs for anything needing a reason) is
// a deliberately similar established pattern in this codebase, just
// reimplemented against this module's own transition tables and roles.
export function ItWorkItemStatusControl({ workItem }: { workItem: ItWorkItem }) {
  const { user } = useAuth();
  const { canManage } = useItWorkManagementAccess();
  const queryClient = useQueryClient();
  const [blockOpen, setBlockOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [requestChangesOpen, setRequestChangesOpen] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["it-work-item", workItem._id] });
    queryClient.invalidateQueries({ queryKey: ["it-work-items"] });
    queryClient.invalidateQueries({ queryKey: ["it-work-item-activity", workItem._id] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: ItWorkItemStatus) => itWorkItemService.changeStatus(workItem._id, status),
    onSuccess: () => {
      toast.success("Work item status updated");
      invalidate();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: () => itWorkItemService.submitForReview(workItem._id),
    onSuccess: () => {
      toast.success("Submitted for review");
      invalidate();
      setSubmitConfirmOpen(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Every hook this component ever calls is declared above this point —
  // safe to conditionally return now. Blocked from every other status-
  // changing action until the IT Head approves/rejects it (the backend
  // rejects them anyway), so this renders instead of, not alongside, the
  // normal control.
  if (workItem.approvalStatus === "PENDING") {
    return <PendingApprovalControl workItem={workItem} />;
  }

  const isAssignee = !!user && workItem.assignedTo?._id === user.id;
  const isReviewer = !!user && workItem.reviewer?._id === user.id;
  // A team member only ever acts on their own assigned item — being the
  // reviewer of someone else's item grants review actions only (below),
  // never the general execution actions (submit, block, planning moves).
  const canActOnExecution = canManage || isAssignee;

  const allTargets = canActOnExecution
    ? (canManage
        ? IT_WORK_ITEM_MANAGEMENT_STATUS_TRANSITIONS
        : IT_WORK_ITEM_TEAM_STATUS_TRANSITIONS)[workItem.status]
    : [];
  // BLOCKED/CANCELLED need a reason, so they render as their own dialog-
  // opening buttons rather than a plain "Move to X" — everything else in
  // the table is a simple one-click forward move.
  const simpleTargets = allTargets.filter((s) => s !== "BLOCKED" && s !== "CANCELLED");
  const canBlock = allTargets.includes("BLOCKED");
  const canCancelHere = allTargets.includes("CANCELLED");
  const canSubmitForReview = canActOnExecution && workItem.status === "IN_PROGRESS";
  const canReview = workItem.status === "IN_REVIEW" && !isAssignee && (isReviewer || canManage);

  const nothingToShow =
    simpleTargets.length === 0 && !canBlock && !canCancelHere && !canSubmitForReview && !canReview;

  if (nothingToShow) {
    return <ItWorkItemStatusBadge status={workItem.status} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <ItWorkItemStatusBadge status={workItem.status} />

        {simpleTargets.map((to) => (
          <Button
            key={to}
            size="sm"
            variant="outline"
            disabled={statusMutation.isPending}
            onClick={() => statusMutation.mutate(to)}
          >
            {statusMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5" />
            )}
            Move to {IT_WORK_ITEM_STATUS_LABELS[to]}
          </Button>
        ))}

        {canSubmitForReview && (
          <Button size="sm" onClick={() => setSubmitConfirmOpen(true)}>
            <ArrowRight className="h-3.5 w-3.5" />
            Submit for Review
          </Button>
        )}

        {canBlock && (
          <Button size="sm" variant="outline" onClick={() => setBlockOpen(true)}>
            Mark Blocked
          </Button>
        )}

        {canReview && (
          <>
            <Button size="sm" onClick={() => setApproveOpen(true)}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRequestChangesOpen(true)}>
              <Undo2 className="h-3.5 w-3.5" />
              Request Changes
            </Button>
          </>
        )}

        {canCancelHere && (
          <Button size="sm" variant="destructive" onClick={() => setCancelOpen(true)}>
            <X className="h-3.5 w-3.5" />
            Cancel Work Item
          </Button>
        )}
      </div>

      {workItem.status === "IN_REVIEW" && isAssignee && (
        <p className="text-xs text-muted-foreground">
          Awaiting review — no action needed from you.
        </p>
      )}

      <ConfirmDialog
        open={submitConfirmOpen}
        onOpenChange={setSubmitConfirmOpen}
        title="Submit for review?"
        description={
          workItem.reviewer
            ? `${workItem.reviewer.fullName} will be able to approve or request changes.`
            : "No reviewer is assigned — the IT Head, Admin, or Super Admin can review it."
        }
        confirmLabel="Submit for Review"
        isLoading={submitMutation.isPending}
        onConfirm={() => submitMutation.mutate()}
      />

      <ItWorkItemBlockDialog open={blockOpen} onOpenChange={setBlockOpen} workItemId={workItem._id} />
      <ItWorkItemCancelDialog
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        workItemId={workItem._id}
      />
      <ItWorkItemReviewDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        workItemId={workItem._id}
        decision="APPROVE"
      />
      <ItWorkItemReviewDialog
        open={requestChangesOpen}
        onOpenChange={setRequestChangesOpen}
        workItemId={workItem._id}
        decision="REQUEST_CHANGES"
      />
    </div>
  );
}
