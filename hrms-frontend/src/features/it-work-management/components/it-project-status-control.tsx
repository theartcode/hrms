"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { itProjectService } from "@/services/it-project.service";
import { useItWorkManagementAccess } from "@/hooks/use-it-work-management-access";
import { ItProject, ItProjectStatus } from "@/types/it-work-management.types";
import { IT_PROJECT_STATUS_LABELS, IT_PROJECT_STATUS_TRANSITIONS } from "../it-project-status-meta";
import { ItProjectStatusBadge } from "./it-project-badges";

function getActionConfig(to: ItProjectStatus) {
  if (to === "CANCELLED") {
    return { label: "Cancel Project", icon: X, variant: "destructive" as const };
  }
  return { label: `Move to ${IT_PROJECT_STATUS_LABELS[to]}`, icon: ArrowRight, variant: undefined };
}

// Phase 1C-C: this page is now reachable by team members and read-only
// viewers too, so unlike its original Phase 1B design this can no longer
// assume every viewer is manage-tier — non-manage viewers get the plain
// badge only, never the transition buttons (the backend would reject the
// mutation anyway, but the control shouldn't offer it in the first place).
export function ItProjectStatusControl({ project }: { project: ItProject }) {
  const { canManage } = useItWorkManagementAccess();
  const queryClient = useQueryClient();
  const nextOptions = canManage ? IT_PROJECT_STATUS_TRANSITIONS[project.status] : [];
  const orderedOptions = [
    ...nextOptions.filter((s) => s !== "CANCELLED"),
    ...nextOptions.filter((s) => s === "CANCELLED"),
  ];

  const mutation = useMutation({
    mutationFn: (status: ItProjectStatus) => itProjectService.changeStatus(project._id, status),
    onSuccess: () => {
      toast.success("Project status updated");
      queryClient.invalidateQueries({ queryKey: ["it-project", project._id] });
      queryClient.invalidateQueries({ queryKey: ["it-projects"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (orderedOptions.length === 0) {
    return <ItProjectStatusBadge status={project.status} />;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ItProjectStatusBadge status={project.status} />
      {orderedOptions.map((to) => {
        const { label, icon: Icon, variant } = getActionConfig(to);
        return (
          <Button
            key={to}
            size="sm"
            variant={variant}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(to)}
          >
            {mutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {label}
          </Button>
        );
      })}
    </div>
  );
}
