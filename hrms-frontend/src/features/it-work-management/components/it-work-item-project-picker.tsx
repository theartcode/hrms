"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { itProjectService } from "@/services/it-project.service";

interface ItWorkItemProjectPickerProps {
  product: string;
  value?: string | null;
  onChange: (projectId: string | null) => void;
  disabled?: boolean;
}

const UNSET = "";
const NONE = "__none__";

// Dependent on `product` — only that product's projects are ever offered,
// per the Phase 1C-A brief ("must NOT show Treqo Website projects" when
// HRMS is selected). Disabled with no options until a product is chosen.
export function ItWorkItemProjectPicker({
  product,
  value,
  onChange,
  disabled,
}: ItWorkItemProjectPickerProps) {
  const { data: projects, isLoading } = useQuery({
    queryKey: ["it-projects", { product }],
    queryFn: () => itProjectService.list({ product }),
    enabled: !!product,
  });

  const options = projects ?? [];
  const selectValue = value ? value : product ? NONE : UNSET;

  return (
    <Select
      value={selectValue}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled || !product || isLoading}
    >
      <SelectTrigger aria-label="Project" className="w-full">
        <SelectValue placeholder={product ? "No project" : "Select a product first"}>
          {(v: string) => {
            if (v === NONE || v === UNSET) return "No project";
            return options.find((p) => p._id === v)?.name;
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No project</SelectItem>
        {options.map((p) => (
          <SelectItem key={p._id} value={p._id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
