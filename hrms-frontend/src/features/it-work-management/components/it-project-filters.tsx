"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useItProducts } from "@/hooks/use-it-products";
import { useAssignableEmployees } from "@/hooks/use-assignable-employees";
import { ItProjectFilters as Filters } from "@/services/it-project.service";
import { ItProjectPriority, ItProjectStatus } from "@/types/it-work-management.types";
import { IT_PROJECT_PRIORITY_LABELS, IT_PROJECT_STATUS_LABELS } from "../it-project-status-meta";

const ALL = "ALL";

interface ItProjectFiltersBarProps {
  value: Filters;
  onChange: (value: Filters) => void;
}

export function ItProjectFiltersBar({ value, onChange }: ItProjectFiltersBarProps) {
  const { data: products } = useItProducts(true);
  const { data: employees } = useAssignableEmployees();

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        value={value.product ?? ALL}
        onValueChange={(v) => onChange({ ...value, product: v && v !== ALL ? v : undefined })}
      >
        <SelectTrigger aria-label="Product" className="w-[180px]">
          <SelectValue placeholder="All Products">
            {(v: string) =>
              v === ALL ? "All Products" : products?.find((p) => p._id === v)?.name
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Products</SelectItem>
          {(products ?? []).map((p) => (
            <SelectItem key={p._id} value={p._id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.status ?? ALL}
        onValueChange={(v) =>
          onChange({ ...value, status: v === ALL ? undefined : (v as ItProjectStatus) })
        }
      >
        <SelectTrigger aria-label="Status" className="w-[150px]">
          <SelectValue placeholder="All Statuses">
            {(v: string) =>
              v === ALL ? "All Statuses" : IT_PROJECT_STATUS_LABELS[v as ItProjectStatus]
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Statuses</SelectItem>
          {Object.entries(IT_PROJECT_STATUS_LABELS).map(([v, label]) => (
            <SelectItem key={v} value={v}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.priority ?? ALL}
        onValueChange={(v) =>
          onChange({ ...value, priority: v === ALL ? undefined : (v as ItProjectPriority) })
        }
      >
        <SelectTrigger aria-label="Priority" className="w-[150px]">
          <SelectValue placeholder="All Priorities">
            {(v: string) =>
              v === ALL ? "All Priorities" : IT_PROJECT_PRIORITY_LABELS[v as ItProjectPriority]
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Priorities</SelectItem>
          {Object.entries(IT_PROJECT_PRIORITY_LABELS).map(([v, label]) => (
            <SelectItem key={v} value={v}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.owner ?? ALL}
        onValueChange={(v) => onChange({ ...value, owner: v && v !== ALL ? v : undefined })}
      >
        <SelectTrigger aria-label="Owner" className="w-[180px]">
          <SelectValue placeholder="All Owners">
            {(v: string) =>
              v === ALL ? "All Owners" : employees?.find((e) => e.id === v)?.fullName
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Owners</SelectItem>
          {(employees ?? []).map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
