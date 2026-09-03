"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { itWorkItemService } from "@/services/it-work-item.service";

interface ItScheduleWorkItemSelectProps {
  employeeId: string;
  value: string | null;
  onChange: (workItemId: string) => void;
  disabled?: boolean;
}

// Scoped with an explicit assignedTo filter (unlike the timesheet's
// no-filter picker) — the backend only ever accepts a Work Item that is
// assigned to the exact employee being scheduled (see
// work-schedule.service.ts's assertWorkItemSchedulable), never "visible
// to" via a reviewer relationship.
export function ItScheduleWorkItemSelect({
  employeeId,
  value,
  onChange,
  disabled,
}: ItScheduleWorkItemSelectProps) {
  const { data: workItems, isLoading } = useQuery({
    queryKey: ["it-work-items", { assignedTo: employeeId }],
    queryFn: () => itWorkItemService.list({ assignedTo: employeeId }),
  });

  const options = (workItems ?? []).filter((item) => item.status !== "CANCELLED");

  return (
    <Select
      value={value ?? ""}
      onValueChange={(v) => v && onChange(v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger aria-label="Work Item" className="w-full">
        <SelectValue placeholder="Select a work item">
          {(v: string) => {
            const item = options.find((o) => o._id === v);
            return item ? `${item.workItemId} — ${item.title}` : undefined;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.length === 0 && (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">No assigned work items</div>
        )}
        {options.map((item) => (
          <SelectItem key={item._id} value={item._id}>
            {item.workItemId} — {item.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
