import { ItWorkItemStatus, ItWorkType } from "@/types/it-work-management.types";

export const IT_WORK_TYPE_LABELS: Record<ItWorkType, string> = {
  NEW_WEBSITE: "New Website",
  EXISTING_WEBSITE_CHANGE: "Existing Website Change",
  HRMS_DEVELOPMENT: "HRMS Development",
  BUG_FIX: "Bug Fixing",
  CLIENT_REQUEST: "Client Request",
  INTERNAL_IT_SUPPORT: "Internal IT Support",
  SERVER_DEPLOYMENT: "Server / Deployment",
  UI_UX: "UI/UX",
  RESEARCH: "Research",
  MAINTENANCE: "Maintenance",
};

export const IT_WORK_ITEM_STATUS_LABELS: Record<ItWorkItemStatus, string> = {
  REQUESTED: "Requested",
  ANALYSIS: "Analysis",
  PLANNED: "Planned",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  IN_REVIEW: "In Review",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
  CANCELLED: "Cancelled",
};

export const IT_WORK_ITEM_STATUS_BADGE: Record<ItWorkItemStatus, string> = {
  REQUESTED: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-transparent",
  ANALYSIS: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-transparent",
  PLANNED: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-transparent",
  ASSIGNED: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-transparent",
  IN_PROGRESS: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-transparent",
  IN_REVIEW: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent",
  COMPLETED: "bg-emerald-600 text-white border-transparent dark:bg-emerald-500",
  BLOCKED: "bg-red-500/10 text-red-600 dark:text-red-400 border-transparent",
  CANCELLED: "bg-muted text-muted-foreground border-transparent",
};

// Mirrors it-work-item.util.ts's getGenericStatusTransitions on the
// backend exactly, target-for-target (both tiers) — keeping these in sync
// is what lets the status control only ever offer a move the API will
// actually accept. IN_REVIEW and COMPLETED are never targets here for
// either tier: reaching IN_REVIEW goes through "Submit for Review", and
// IN_REVIEW's own two outcomes go through the review dialog. BLOCKED and
// CANCELLED targets ARE included here (matching the backend) but the
// status control renders them as their own reason-collecting buttons
// rather than a plain "Move to X" button — see
// ItWorkItemStatusControl's partitioning of these arrays.
export const IT_WORK_ITEM_TEAM_STATUS_TRANSITIONS: Record<ItWorkItemStatus, ItWorkItemStatus[]> = {
  REQUESTED: ["ANALYSIS"],
  ANALYSIS: ["PLANNED"],
  PLANNED: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["BLOCKED"],
  IN_REVIEW: [],
  BLOCKED: ["IN_PROGRESS"],
  COMPLETED: [],
  CANCELLED: [],
};

export const IT_WORK_ITEM_MANAGEMENT_STATUS_TRANSITIONS: Record<ItWorkItemStatus, ItWorkItemStatus[]> = {
  REQUESTED: ["ANALYSIS", "CANCELLED"],
  ANALYSIS: ["PLANNED", "CANCELLED"],
  PLANNED: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "BLOCKED", "CANCELLED"],
  IN_PROGRESS: ["BLOCKED", "CANCELLED"],
  IN_REVIEW: ["BLOCKED"],
  BLOCKED: ["IN_PROGRESS", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export interface ItWorkItemStatusSummary {
  total: number;
  active: number;
  inReview: number;
  blocked: number;
  completed: number;
  cancelled: number;
}

const ACTIVE_STATUSES: ItWorkItemStatus[] = [
  "REQUESTED",
  "ANALYSIS",
  "PLANNED",
  "ASSIGNED",
  "IN_PROGRESS",
];

// Phase 1C-C's Product/Project rollup counts (Parts E/F of the brief) —
// simple tallies over a list the caller already fetched server-side-
// scoped (to one product or one project), never a percentage, velocity,
// or forecast. "Active" collapses every pre-review working status into
// one bucket, matching the brief's own example grouping.
export function summarizeWorkItemStatuses(
  items: { status: ItWorkItemStatus }[]
): ItWorkItemStatusSummary {
  const summary: ItWorkItemStatusSummary = {
    total: items.length,
    active: 0,
    inReview: 0,
    blocked: 0,
    completed: 0,
    cancelled: 0,
  };
  for (const item of items) {
    if (ACTIVE_STATUSES.includes(item.status)) summary.active += 1;
    else if (item.status === "IN_REVIEW") summary.inReview += 1;
    else if (item.status === "BLOCKED") summary.blocked += 1;
    else if (item.status === "COMPLETED") summary.completed += 1;
    else if (item.status === "CANCELLED") summary.cancelled += 1;
  }
  return summary;
}

// Human-readable labels for the activity timeline — falls back to the raw
// action string for anything not in this map (defensive, not expected to
// ever actually trigger given the fixed set of actions this module logs).
export const IT_WORK_ITEM_ACTIVITY_LABELS: Record<string, string> = {
  IT_WORK_ITEM_CREATED: "Created",
  IT_WORK_ITEM_UPDATED: "Updated",
  IT_WORK_ITEM_ASSIGNED: "Assigned",
  IT_WORK_ITEM_REASSIGNED: "Reassigned",
  IT_WORK_ITEM_STATUS_CHANGED: "Status changed",
  IT_WORK_ITEM_SUBMITTED_FOR_REVIEW: "Submitted for review",
  IT_WORK_ITEM_REVIEW_APPROVED: "Approved",
  IT_WORK_ITEM_CHANGES_REQUESTED: "Changes requested",
  IT_WORK_ITEM_BLOCKED: "Marked blocked",
  IT_WORK_ITEM_CANCELLED: "Cancelled",
  IT_WORK_ITEM_COMMENTED: "Commented",
  IT_WORK_ITEM_ATTACHMENT_UPLOADED: "Attachment uploaded",
  IT_WORK_ITEM_ATTACHMENT_DELETED: "Attachment deleted",
  IT_WORK_ITEM_PROPOSED: "Proposed",
  IT_WORK_ITEM_PROPOSAL_APPROVED: "Proposal approved",
  IT_WORK_ITEM_PROPOSAL_REJECTED: "Proposal rejected",
  IT_WORK_ITEM_PROPOSAL_CHANGES_REQUESTED: "Changes requested on proposal",
  IT_WORK_ITEM_PROPOSAL_UPDATED: "Proposal updated",
};
