import { Badge } from "@/components/ui/badge";
import { ItProjectPriority, ItProjectStatus } from "@/types/it-work-management.types";
import {
  IT_PROJECT_PRIORITY_BADGE,
  IT_PROJECT_PRIORITY_LABELS,
  IT_PROJECT_STATUS_BADGE,
  IT_PROJECT_STATUS_LABELS,
} from "../it-project-status-meta";

export function ItProjectStatusBadge({ status }: { status: ItProjectStatus }) {
  return (
    <Badge variant="outline" className={IT_PROJECT_STATUS_BADGE[status]}>
      {IT_PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ItProjectPriorityBadge({ priority }: { priority: ItProjectPriority }) {
  return (
    <Badge variant="outline" className={IT_PROJECT_PRIORITY_BADGE[priority]}>
      {IT_PROJECT_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
