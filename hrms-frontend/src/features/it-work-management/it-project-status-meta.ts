import { ItProjectPriority, ItProjectStatus } from "@/types/it-work-management.types";

export const IT_PROJECT_STATUS_LABELS: Record<ItProjectStatus, string> = {
  PLANNED: "Planned",
  ACTIVE: "Active",
  ON_HOLD: "On Hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const IT_PROJECT_STATUS_BADGE: Record<ItProjectStatus, string> = {
  PLANNED: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-transparent",
  ACTIVE: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-transparent",
  ON_HOLD: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent",
  COMPLETED: "bg-emerald-600 text-white border-transparent dark:bg-emerald-500",
  CANCELLED: "bg-muted text-muted-foreground border-transparent",
};

export const IT_PROJECT_PRIORITY_LABELS: Record<ItProjectPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const IT_PROJECT_PRIORITY_BADGE: Record<ItProjectPriority, string> = {
  LOW: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-transparent",
  MEDIUM: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-transparent",
  HIGH: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent",
  URGENT: "bg-red-500/10 text-red-600 dark:text-red-400 border-transparent",
};

// Mirrors it-project.util.ts's transition table on the backend exactly —
// keeping these in sync is what lets the status control only ever offer a
// move the API will actually accept. Every Phase 1B actor who can reach the
// status control (Admin/Super Admin/IT Head) gets the same full graph —
// there's no assignee-vs-privileged split yet since Work Items (and the
// people who'd be assigned to them) don't exist until Phase 1C.
export const IT_PROJECT_STATUS_TRANSITIONS: Record<ItProjectStatus, ItProjectStatus[]> = {
  PLANNED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["ACTIVE", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
