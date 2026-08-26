// Plain string enums, validated at the schema/Zod layer — adding a new
// work type or status later is a one-line addition to these objects plus
// the corresponding Mongoose `enum` array, never a restructuring.
export const IT_WORK_TYPE = {
  NEW_WEBSITE: "NEW_WEBSITE",
  EXISTING_WEBSITE_CHANGE: "EXISTING_WEBSITE_CHANGE",
  HRMS_DEVELOPMENT: "HRMS_DEVELOPMENT",
  BUG_FIX: "BUG_FIX",
  CLIENT_REQUEST: "CLIENT_REQUEST",
  INTERNAL_IT_SUPPORT: "INTERNAL_IT_SUPPORT",
  SERVER_DEPLOYMENT: "SERVER_DEPLOYMENT",
  UI_UX: "UI_UX",
  RESEARCH: "RESEARCH",
  MAINTENANCE: "MAINTENANCE",
} as const;

export type ITWorkType = (typeof IT_WORK_TYPE)[keyof typeof IT_WORK_TYPE];

// Phase 1C-A establishes this enum and a default only — no transition
// rules yet (Phase 1C-B). Every Work Item is created at REQUESTED and
// nothing in this phase moves it anywhere else.
export const IT_WORK_ITEM_STATUS = {
  REQUESTED: "REQUESTED",
  ANALYSIS: "ANALYSIS",
  PLANNED: "PLANNED",
  ASSIGNED: "ASSIGNED",
  IN_PROGRESS: "IN_PROGRESS",
  IN_REVIEW: "IN_REVIEW",
  COMPLETED: "COMPLETED",
  BLOCKED: "BLOCKED",
  CANCELLED: "CANCELLED",
} as const;

export type ITWorkItemStatus = (typeof IT_WORK_ITEM_STATUS)[keyof typeof IT_WORK_ITEM_STATUS];
