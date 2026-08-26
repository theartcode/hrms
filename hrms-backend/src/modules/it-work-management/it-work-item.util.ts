import { IT_WORK_ITEM_STATUS, ITWorkItemStatus } from "../../shared/constants/itWorkItemTypes";

// The full legal graph — every edge the system will ever accept, from any
// endpoint. IN_REVIEW's two decision edges (-> COMPLETED via approve,
// -> IN_PROGRESS via request-changes) and IN_PROGRESS -> IN_REVIEW appear
// here for completeness, but are only ever reachable through the dedicated
// /submit-review and /review endpoints — never through the generic
// /status endpoint (see below). This mirrors the *shape* of the existing
// Task module's own transition-table pattern (task.util.ts); it shares no
// code or import with it — an independent reimplementation per the
// Phase 1C-A/1C-B brief's explicit instruction not to reuse Task's status
// logic.
const WORK_ITEM_TRANSITIONS: Record<ITWorkItemStatus, ITWorkItemStatus[]> = {
  REQUESTED: [IT_WORK_ITEM_STATUS.ANALYSIS, IT_WORK_ITEM_STATUS.CANCELLED],
  ANALYSIS: [IT_WORK_ITEM_STATUS.PLANNED, IT_WORK_ITEM_STATUS.CANCELLED],
  PLANNED: [IT_WORK_ITEM_STATUS.ASSIGNED, IT_WORK_ITEM_STATUS.CANCELLED],
  ASSIGNED: [
    IT_WORK_ITEM_STATUS.IN_PROGRESS,
    IT_WORK_ITEM_STATUS.BLOCKED,
    IT_WORK_ITEM_STATUS.CANCELLED,
  ],
  IN_PROGRESS: [
    IT_WORK_ITEM_STATUS.IN_REVIEW,
    IT_WORK_ITEM_STATUS.BLOCKED,
    IT_WORK_ITEM_STATUS.CANCELLED,
  ],
  IN_REVIEW: [
    IT_WORK_ITEM_STATUS.IN_PROGRESS,
    IT_WORK_ITEM_STATUS.COMPLETED,
    IT_WORK_ITEM_STATUS.BLOCKED,
  ],
  BLOCKED: [IT_WORK_ITEM_STATUS.IN_PROGRESS, IT_WORK_ITEM_STATUS.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidWorkItemTransition(from: ITWorkItemStatus, to: ITWorkItemStatus): boolean {
  return WORK_ITEM_TRANSITIONS[from].includes(to);
}

// The subset reachable through the generic PATCH /:id/status endpoint —
// deliberately excludes IN_REVIEW and COMPLETED as targets for EVERYONE,
// management included (see the Phase 1C-B report's "management override"
// section): those two require /submit-review and /review specifically,
// which carry checks (reviewer authorization, non-self-approval,
// mandatory reason) the generic endpoint doesn't have and shouldn't grow.
const TEAM_GENERIC_STATUS_TRANSITIONS: Record<ITWorkItemStatus, ITWorkItemStatus[]> = {
  REQUESTED: [IT_WORK_ITEM_STATUS.ANALYSIS],
  ANALYSIS: [IT_WORK_ITEM_STATUS.PLANNED],
  PLANNED: [IT_WORK_ITEM_STATUS.ASSIGNED],
  ASSIGNED: [IT_WORK_ITEM_STATUS.IN_PROGRESS],
  IN_PROGRESS: [IT_WORK_ITEM_STATUS.BLOCKED],
  IN_REVIEW: [],
  BLOCKED: [IT_WORK_ITEM_STATUS.IN_PROGRESS],
  COMPLETED: [],
  CANCELLED: [],
};

const MANAGEMENT_GENERIC_STATUS_TRANSITIONS: Record<ITWorkItemStatus, ITWorkItemStatus[]> = {
  REQUESTED: [IT_WORK_ITEM_STATUS.ANALYSIS, IT_WORK_ITEM_STATUS.CANCELLED],
  ANALYSIS: [IT_WORK_ITEM_STATUS.PLANNED, IT_WORK_ITEM_STATUS.CANCELLED],
  PLANNED: [IT_WORK_ITEM_STATUS.ASSIGNED, IT_WORK_ITEM_STATUS.CANCELLED],
  ASSIGNED: [
    IT_WORK_ITEM_STATUS.IN_PROGRESS,
    IT_WORK_ITEM_STATUS.BLOCKED,
    IT_WORK_ITEM_STATUS.CANCELLED,
  ],
  IN_PROGRESS: [IT_WORK_ITEM_STATUS.BLOCKED, IT_WORK_ITEM_STATUS.CANCELLED],
  // Management may still move a reviewed-but-stuck item straight to
  // Blocked (e.g. an environment issue discovered during review) — the
  // one IN_REVIEW edge that doesn't need the dedicated /review endpoint's
  // extra checks, since it isn't a review decision.
  IN_REVIEW: [IT_WORK_ITEM_STATUS.BLOCKED],
  BLOCKED: [IT_WORK_ITEM_STATUS.IN_PROGRESS, IT_WORK_ITEM_STATUS.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

export function getGenericStatusTransitions(
  tier: "manage" | "team",
  from: ITWorkItemStatus
): ITWorkItemStatus[] {
  return (tier === "manage"
    ? MANAGEMENT_GENERIC_STATUS_TRANSITIONS
    : TEAM_GENERIC_STATUS_TRANSITIONS)[from];
}

const REASON_REQUIRED_STATUSES: ITWorkItemStatus[] = [
  IT_WORK_ITEM_STATUS.BLOCKED,
  IT_WORK_ITEM_STATUS.CANCELLED,
];

export function isReasonRequiredForStatus(status: ITWorkItemStatus): boolean {
  return REASON_REQUIRED_STATUSES.includes(status);
}

// Computed on read, never stored — same convention as the existing Task
// module's isTaskOverdue (task.util.ts), independently reapplied here.
export function isWorkItemOverdue(dueDate: string | null, status: ITWorkItemStatus): boolean {
  if (!dueDate) return false;
  if (status === IT_WORK_ITEM_STATUS.COMPLETED || status === IT_WORK_ITEM_STATUS.CANCELLED) {
    return false;
  }
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
}
