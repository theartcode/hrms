"use client";

import { useState } from "react";
import { LucideIcon } from "lucide-react";
import { ItDashboardWorkItem } from "@/types/it-work-management.types";
import { ItDashboardWorkItemList } from "./it-dashboard-work-item-list";
import { ItDashboardTabBar } from "./it-dashboard-tab-bar";

type ExtraColumn = "blockedSince" | "submittedAt" | "completedAt" | "none";

export interface ItWorkItemGroup {
  key: string;
  label: string;
  icon: LucideIcon;
  items: ItDashboardWorkItem[];
  emptyMessage: string;
  description?: string;
  extraColumn?: ExtraColumn;
  /** Tints this group's count red when non-empty — for buckets that mean something is wrong (blocked/overdue), not just queued. */
  urgent?: boolean;
}

// Replaces what used to be 5-8 near-identical full-width "DashboardSection +
// table" blocks stacked one under another (In Progress, Review Queue,
// Blocked, Overdue, Upcoming, Completed, ...) with one compact panel and a
// pill sub-nav showing each bucket's count. Same data, same
// ItDashboardWorkItemList table underneath — this only changes how the
// buckets are switched between, so a dashboard with mostly-empty buckets
// doesn't read as a wall of empty-state boxes.
export function ItWorkItemGroupTabs({
  groups,
  defaultKey,
}: {
  groups: ItWorkItemGroup[];
  defaultKey?: string;
}) {
  const [active, setActive] = useState(defaultKey ?? groups[0]?.key);
  const activeGroup = groups.find((g) => g.key === active) ?? groups[0];

  if (!activeGroup) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ItDashboardTabBar
          value={activeGroup.key}
          onChange={setActive}
          tabs={groups.map((g) => ({
            key: g.key,
            label: g.label,
            icon: g.icon,
            count: g.items.length,
            urgent: g.urgent,
          }))}
        />
        {activeGroup.description && (
          <p className="text-sm text-muted-foreground">{activeGroup.description}</p>
        )}
      </div>
      <ItDashboardWorkItemList
        items={activeGroup.items}
        emptyMessage={activeGroup.emptyMessage}
        extraColumn={activeGroup.extraColumn}
      />
    </div>
  );
}
