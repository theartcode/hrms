"use client";

import { useQuery } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { itWorkItemService } from "@/services/it-work-item.service";

interface ItDailyTimesheetWorkItemsPickerProps {
  value: string[];
  onChange: (workItemIds: string[]) => void;
  disabled?: boolean;
}

// No filter passed to the list call — the backend's own listWorkItems
// already scopes an IT team member to their assigned/reviewed items only
// (see it-work-item.service.ts), which is exactly the set the timesheet
// backend allows logging against. No searchable combobox exists in this
// app's component library, so a checkbox list is the simplest fit for what
// is normally a short, per-person set of items.
export function ItDailyTimesheetWorkItemsPicker({
  value,
  onChange,
  disabled,
}: ItDailyTimesheetWorkItemsPickerProps) {
  const { data: workItems, isLoading } = useQuery({
    queryKey: ["it-work-items", {}],
    queryFn: () => itWorkItemService.list({}),
  });

  function toggle(id: string, checked: boolean) {
    if (checked) {
      if (!value.includes(id)) onChange([...value, id]);
    } else {
      onChange(value.filter((v) => v !== id));
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
      </div>
    );
  }

  if (!workItems || workItems.length === 0) {
    return <p className="text-sm text-muted-foreground">No work items are assigned to you yet.</p>;
  }

  return (
    <div className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-lg border p-2.5">
      {workItems.map((item) => (
        <label key={item._id} className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={value.includes(item._id)}
            onCheckedChange={(checked) => toggle(item._id, checked === true)}
            disabled={disabled}
          />
          <span className="font-mono text-xs text-muted-foreground">{item.workItemId}</span>
          <span className="truncate">{item.title}</span>
        </label>
      ))}
    </div>
  );
}
