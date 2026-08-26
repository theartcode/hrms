"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useItProducts } from "@/hooks/use-it-products";
import { itProjectService } from "@/services/it-project.service";
import { ItMyDashboardFilters } from "@/services/it-work-management.service";
import { ItProjectPriority, ItWorkItemStatus, ItWorkType } from "@/types/it-work-management.types";
import { IT_PROJECT_PRIORITY_LABELS } from "../it-project-status-meta";
import { IT_WORK_ITEM_STATUS_LABELS, IT_WORK_TYPE_LABELS } from "../it-work-item-meta";

const ALL = "ALL";

interface ItTeamDashboardFiltersBarProps {
  value: ItMyDashboardFilters;
  onChange: (value: ItMyDashboardFilters) => void;
}

// Status, Priority, Product, Project, Work Type, and a small ID/title
// search — deliberately no Assignee filter (Part 21 of the brief: a team
// member's scope is always their own authorized Work Items; exposing an
// assignee picker here would look like a way to browse someone else's
// work, even though the backend would reject it regardless).
export function ItTeamDashboardFiltersBar({ value, onChange }: ItTeamDashboardFiltersBarProps) {
  const { data: products } = useItProducts(true);
  const { data: projects } = useQuery({
    queryKey: ["it-projects", {}],
    queryFn: () => itProjectService.list(),
  });

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative w-[220px]">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search ID or title…"
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
        value={value.workType ?? ALL}
        onValueChange={(v) =>
          onChange({ ...value, workType: v && v !== ALL ? (v as ItWorkType) : undefined })
        }
      >
        <SelectTrigger aria-label="Work Type" className="w-[170px]">
          <SelectValue placeholder="All Work Types">
            {(v: string) => (v === ALL ? "All Work Types" : IT_WORK_TYPE_LABELS[v as ItWorkType])}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All Work Types</SelectItem>
          {Object.entries(IT_WORK_TYPE_LABELS).map(([v, label]) => (
            <SelectItem key={v} value={v}>
              {label}
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
