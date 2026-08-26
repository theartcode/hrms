"use client";

import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface ItDashboardTab {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Shown as a small count badge next to the label — omitted when undefined, shown greyed-out at 0. */
  count?: number;
  /** Tints the badge red when this tab has something that needs attention (e.g. blocked/overdue). */
  urgent?: boolean;
}

interface ItDashboardTabBarProps {
  tabs: ItDashboardTab[];
  value: string;
  onChange: (key: string) => void;
}

// Same pill-button tab switcher already established on the Employee Profile
// page (border bg-muted/40 p-1.5 rounded-lg, Button variant default/ghost) —
// reused here rather than introducing a new tab primitive, so the dashboards
// look and behave like the rest of the app instead of a one-off widget.
export function ItDashboardTabBar({ tabs, value, onChange }: ItDashboardTabBarProps) {
  return (
    <div className="flex w-fit flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.key === value;
        return (
          <Button
            key={tab.key}
            type="button"
            variant={active ? "default" : "ghost"}
            size="sm"
            onClick={() => onChange(tab.key)}
            className="gap-2 text-xs font-medium"
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
            {tab.count !== undefined && (
              <Badge
                variant="outline"
                className={cn(
                  "h-4.5 min-w-4.5 justify-center border-transparent px-1 text-[10px] tabular-nums",
                  active
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : tab.urgent && tab.count > 0
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "bg-foreground/10 text-foreground"
                )}
              >
                {tab.count}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
