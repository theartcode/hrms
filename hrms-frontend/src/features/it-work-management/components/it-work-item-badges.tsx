import { Badge } from "@/components/ui/badge";
import { ItWorkItemStatus, ItWorkType } from "@/types/it-work-management.types";
import { IT_WORK_ITEM_STATUS_BADGE, IT_WORK_ITEM_STATUS_LABELS, IT_WORK_TYPE_LABELS } from "../it-work-item-meta";

export function ItWorkItemStatusBadge({ status }: { status: ItWorkItemStatus }) {
  return (
    <Badge variant="outline" className={IT_WORK_ITEM_STATUS_BADGE[status]}>
      {IT_WORK_ITEM_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ItWorkTypeBadge({ workType }: { workType: ItWorkType }) {
  return <Badge variant="outline">{IT_WORK_TYPE_LABELS[workType]}</Badge>;
}
