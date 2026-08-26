"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssignableEmployees } from "@/hooks/use-assignable-employees";

interface ItWorkItemPersonPickerProps {
  label: string;
  value?: string | null;
  onChange: (employeeId: string | null) => void;
  disabled?: boolean;
}

const NONE = "__none__";

// Generic picker reused for both Assignee and Reviewer — same underlying
// scoped employee list (GET /employees/assignable) as
// ItProjectOwnerPicker, just with a caller-supplied label since "Owner"
// doesn't fit either of these two fields.
export function ItWorkItemPersonPicker({
  label,
  value,
  onChange,
  disabled,
}: ItWorkItemPersonPickerProps) {
  const { data: employees, isLoading } = useAssignableEmployees();
  const options = employees ?? [];

  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue placeholder={`Unassigned`}>
          {(v: string) => {
            if (v === NONE) return "Unassigned";
            const employee = options.find((e) => e.id === v);
            return employee ? `${employee.fullName} (${employee.employeeId})` : undefined;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Unassigned</SelectItem>
        {options.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.fullName} ({e.employeeId})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
