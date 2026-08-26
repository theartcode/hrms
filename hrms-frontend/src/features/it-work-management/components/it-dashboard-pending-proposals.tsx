"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DashboardSection } from "@/features/dashboard/components/dashboard-section";
import { ROUTES } from "@/constants/routes";
import { itWorkItemService } from "@/services/it-work-item.service";
import { ItDashboardWorkItem } from "@/types/it-work-management.types";
import { ItProjectPriorityBadge } from "./it-project-badges";
import { ItWorkItemRejectProposalDialog } from "./it-work-item-reject-proposal-dialog";

interface ProposerGroup {
  proposerId: string;
  proposerName: string;
  items: ItDashboardWorkItem[];
}

// Grouped by proposer — with several team members proposing work for
// themselves, a flat list makes it hard to see "whose backlog am I
// approving," and awkward to approve one person's whole batch at once.
function groupByProposer(items: ItDashboardWorkItem[]): ProposerGroup[] {
  const map = new Map<string, ProposerGroup>();
  for (const item of items) {
    const id = item.proposedBy?._id ?? "unknown";
    const name = item.proposedBy?.fullName ?? "Unknown";
    const existing = map.get(id);
    if (existing) existing.items.push(item);
    else map.set(id, { proposerId: id, proposerName: name, items: [item] });
  }
  return Array.from(map.values()).sort((a, b) => a.proposerName.localeCompare(b.proposerName));
}

// Bulk approval, on top of the per-row Approve/Reject already available on
// the Work Item detail page — a deliberate exception to this dashboard's
// usual "no write actions, open the detail page" rule (Phase 1E-A's own
// design principle), because approving a proposal isn't really "managing"
// the work item the way status/assignment changes are: it's a yes/no gate
// on whether it enters the tracked pipeline at all, and reviewing several
// of these one at a time by opening each detail page doesn't add anything
// a checkbox list can't already show.
export function ItDashboardPendingProposals({ items }: { items: ItDashboardWorkItem[] }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectId, setRejectId] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["it-head-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["it-my-dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["it-work-items"] });
  };

  const approveMutation = useMutation({
    mutationFn: async (ids: string[]) => Promise.allSettled(ids.map((id) => itWorkItemService.approveProposal(id))),
    onSuccess: (results, ids) => {
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.length - succeeded;
      invalidate();
      setSelected((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
      if (failed === 0) {
        toast.success(
          succeeded === 1 ? "Proposal approved — now tracked" : `${succeeded} proposals approved — now tracked`
        );
      } else {
        toast.error(`${succeeded} approved, ${failed} failed — refresh and try again`);
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (items.length === 0) {
    return (
      <DashboardSection
        title="Pending Proposals"
        description="Work team members have proposed for themselves — approve or reject before it's tracked."
      >
        <div className="flex h-20 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          No proposals waiting on your decision.
        </div>
      </DashboardSection>
    );
  }

  const groups = groupByProposer(items);
  const allIds = items.map((i) => i._id);
  const allSelected = allIds.every((id) => selected.has(id));

  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (group: ProposerGroup) => {
    const groupIds = group.items.map((i) => i._id);
    const groupSelected = groupIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of groupIds) {
        if (groupSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  return (
    <DashboardSection
      title="Pending Proposals"
      description="Work team members have proposed for themselves, grouped by who proposed it."
      action={
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
            Select all ({items.length})
          </label>
          <Button
            size="sm"
            disabled={selected.size === 0 || approveMutation.isPending}
            onClick={() => approveMutation.mutate(Array.from(selected))}
          >
            {approveMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Approve Selected ({selected.size})
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {groups.map((group) => {
          const groupIds = group.items.map((i) => i._id);
          const groupSelected = groupIds.every((id) => selected.has(id));
          return (
            <div
              key={group.proposerId}
              className="flex flex-col gap-2 rounded-lg border border-l-4 border-l-amber-500 p-3"
            >
              <div className="flex items-center gap-2">
                <Checkbox checked={groupSelected} onCheckedChange={() => toggleGroup(group)} />
                <span className="text-sm font-medium">{group.proposerName}</span>
                <span className="text-xs text-muted-foreground">({group.items.length})</span>
              </div>
              <div className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <div
                    key={item._id}
                    role="button"
                    tabIndex={0}
                    className="flex cursor-pointer flex-wrap items-center gap-3 rounded-md p-2 text-left transition-colors hover:bg-accent"
                    onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_WORK_ITEM_DETAIL(item._id))}
                  >
                    <Checkbox
                      checked={selected.has(item._id)}
                      onCheckedChange={() => toggleOne(item._id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="font-mono text-xs text-muted-foreground">{item.workItemId}</span>
                    <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.product?.name ?? "Unknown Product"}
                    </span>
                    <ItProjectPriorityBadge priority={item.priority} />
                    {item.dueDate && (
                      <span className="text-xs text-muted-foreground">Due {item.dueDate}</span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={approveMutation.isPending}
                      onClick={(e) => {
                        e.stopPropagation();
                        approveMutation.mutate([item._id]);
                      }}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRejectId(item._id);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                      Reject
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {rejectId && (
        <ItWorkItemRejectProposalDialog
          open={rejectId !== null}
          onOpenChange={(open) => !open && setRejectId(null)}
          workItemId={rejectId}
        />
      )}
    </DashboardSection>
  );
}
