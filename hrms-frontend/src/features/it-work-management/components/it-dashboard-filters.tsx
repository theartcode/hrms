"use client";

import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useItProducts } from "@/hooks/use-it-products";
import { useAssignableEmployees } from "@/hooks/use-assignable-employees";
import { itProjectService } from "@/services/it-project.service";
import { ItHeadDashboardFilters } from "@/services/it-work-management.service";
import { ItProjectPriority, ItWorkItemStatus } from "@/types/it-work-management.types";
import { IT_PROJECT_PRIORITY_LABELS } from "../it-project-status-meta";
import { IT_WORK_ITEM_STATUS_LABELS } from "../it-work-item-meta";

const ALL = "ALL";

interface ItDashboardFiltersBarProps {
  value: ItHeadDashboardFilters;
  onChange: (value: ItHeadDashboardFilters) => void;
}

// Exactly the five filters the brief asks for (Product, Project, Assignee,
// Priority, Status) — deliberately not Work Type, to keep this one
// dimension narrower than the Work Items page's own filter bar rather than
// reusing it wholesale (Part 15: "do not create an unnecessarily complex
// filter system").
export function ItDashboardFiltersBar({ value, onChange }: ItDashboardFiltersBarProps) {
  const { data: products } = useItProducts(true);
  const { data: projects } = useQuery({
    queryKey: ["it-projects", {}],
    queryFn: () => itProjectService.list(),
  });
  const { data: employees } = useAssignableEmployees();

  return (
    <div className="flex flex-wrap gap-2">
      <Select
        value={value.product ?? ALL}
        onValueChange={(v) => onChange({ ...value, product: v && v !== ALL ? v : undefined })}
      >
        <SelectTrigger aria-label="Product" className="w-[160px]">
          <SelectValue placeholder="All Products">
            {(v: string) => (v === ALL ? "All Products" : products?.find((p) => p._id === v)?.name)}
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
        value={value.project ?? ALL}
        onValueChange={(v) => onChange({ ...value, project: v && v !== ALL ? v : undefined })}
      >
        <SelectTrigger aria-label="Project" className="w-[160px]">
          <SelectValue placeholder="All Projects">
            {(v: string) => (v === ALL ? "All Projects" : projects?.find((p) => p._id === v)?.name)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Projects</SelectItem>
          {(projects ?? []).map((p) => (
            <SelectItem key={p._id} value={p._id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.assignedTo ?? ALL}
        onValueChange={(v) => onChange({ ...value, assignedTo: v && v !== ALL ? v : undefined })}
      >
        <SelectTrigger aria-label="Assignee" className="w-[160px]">
          <SelectValue placeholder="All Assignees">
            {(v: string) =>
              v === ALL ? "All Assignees" : employees?.find((e) => e.id === v)?.fullName
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Assignees</SelectItem>
          {(employees ?? []).map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.fullName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.priority ?? ALL}
        onValueChange={(v) =>
          onChange({ ...value, priority: v && v !== ALL ? (v as ItProjectPriority) : undefined })
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
        value={value.status ?? ALL}
        onValueChange={(v) =>
          onChange({ ...value, status: v && v !== ALL ? (v as ItWorkItemStatus) : undefined })
        }
      >
        <SelectTrigger aria-label="Status" className="w-[150px]">
          <SelectValue placeholder="All Statuses">
            {(v: string) =>
              v === ALL ? "All Statuses" : IT_WORK_ITEM_STATUS_LABELS[v as ItWorkItemStatus]
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Statuses</SelectItem>
          {Object.entries(IT_WORK_ITEM_STATUS_LABELS).map(([v, label]) => (
            <SelectItem key={v} value={v}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
