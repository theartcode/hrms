"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAssignableEmployees } from "@/hooks/use-assignable-employees";

interface ItProjectOwnerPickerProps {
  value?: string;
  onChange: (employeeId: string) => void;
  disabled?: boolean;
}

const UNSET = "";

// Reuses GET /employees/assignable — the same server-scoped employee list
// Task's AssigneePicker uses (Admin/Super Admin: everyone; Department Head:
// their own department's members). That scoping happens to be exactly
// right here too: an IT Head choosing a Project owner should see IT's
// members, which is what heading the "IT" department already yields.
export function ItProjectOwnerPicker({ value, onChange, disabled }: ItProjectOwnerPickerProps) {
  const { data: employees, isLoading } = useAssignableEmployees();
  const options = employees ?? [];

  return (
    <Select
      value={value ?? UNSET}
      onValueChange={(v) => v && onChange(v)}
      disabled={disabled || isLoading}
    >
      <SelectTrigger aria-label="Owner" className="w-full">
        <SelectValue placeholder="Select an owner">
          {(v: string) => {
            if (v === UNSET) return undefined;
            const employee = options.find((e) => e.id === v);
            return employee ? `${employee.fullName} (${employee.employeeId})` : undefined;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.fullName} ({e.employeeId})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
