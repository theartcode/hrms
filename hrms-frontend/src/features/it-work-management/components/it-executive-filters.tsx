"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useItProducts } from "@/hooks/use-it-products";
import { useAssignableEmployees } from "@/hooks/use-assignable-employees";
import { itProjectService } from "@/services/it-project.service";
import { ItExecutiveDashboardFilters } from "@/services/it-work-management.service";
import { ItProjectPriority, ItWorkItemStatus } from "@/types/it-work-management.types";
import { IT_PROJECT_PRIORITY_LABELS } from "../it-project-status-meta";
import { IT_WORK_ITEM_STATUS_LABELS } from "../it-work-item-meta";

const ALL = "ALL";

interface ItExecutiveFiltersBarProps {
  value: ItExecutiveDashboardFilters;
  onChange: (value: ItExecutiveDashboardFilters) => void;
}

// Part 27: simple executive filters only — Product, Project, Status,
// Priority, Owner/Assignee, plus a small search box (Part 28). No
// developer-level filters (e.g. Work Type is deliberately left out here,
// unlike the Work Items list page's own filter bar).
export function ItExecutiveFiltersBar({ value, onChange }: ItExecutiveFiltersBarProps) {
  const { data: products } = useItProducts(true);
  const { data: projects } = useQuery({
    queryKey: ["it-projects", {}],
    queryFn: () => itProjectService.list(),
  });
  const { data: employees } = useAssignableEmployees();

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative w-[220px]">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search Work Item ID or title…"
          className="pl-8"
          value={value.search ?? ""}
          onChange={(e) => onChange({ ...value, search: e.target.value || undefined })}
        />
      </div>

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
        <SelectTrigger aria-label="Owner / Assignee" className="w-[160px]">
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
