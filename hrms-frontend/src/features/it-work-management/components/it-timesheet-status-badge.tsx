import { Badge } from "@/components/ui/badge";
import { DailyTimesheetStatus } from "@/types/it-work-management.types";

const LABELS: Record<DailyTimesheetStatus, string> = {
  NOT_STARTED: "Not Started",
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
};

// Same outline-badge + bg/text color recipe as ItWorkItemStatusBadge, kept
// as its own component since the status set (and its meaning) is entirely
// different — reusing that component's map would just be confusing.
const STYLES: Record<DailyTimesheetStatus, string> = {
  NOT_STARTED: "bg-muted text-muted-foreground border-transparent",
  DRAFT: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent",
  SUBMITTED: "bg-emerald-600 text-white border-transparent dark:bg-emerald-500",
};

export function ItTimesheetStatusBadge({ status }: { status: DailyTimesheetStatus }) {
  return (
    <Badge variant="outline" className={STYLES[status]}>
      {LABELS[status]}
    </Badge>
  );
}
