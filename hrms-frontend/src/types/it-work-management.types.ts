export interface ItProduct {
  _id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ItProjectStatus = "PLANNED" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type ItProjectPriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";

export interface ItProjectProductRef {
  _id: string;
  name: string;
  isActive: boolean;
}

export interface ItProjectOwnerRef {
  _id: string;
  fullName: string;
  employeeId: string;
}

export interface ItProject {
  _id: string;
  name: string;
  description: string | null;
  // null when the referenced Product no longer exists — the app has no
  // delete-Product operation, but a document removed directly at the
  // database level still leaves this populated field null rather than the
  // backend throwing, so every renderer of this field must handle it.
  product: ItProjectProductRef | null;
  status: ItProjectStatus;
  priority: ItProjectPriority;
  startDate: string | null;
  targetDate: string | null;
  // null when the referenced owner User no longer exists — same caveat as
  // product above (a document removed directly at the database level
  // leaves this null rather than the backend throwing).
  owner: ItProjectOwnerRef | null;
  createdAt: string;
  updatedAt: string;
}

export type ItWorkType =
  | "NEW_WEBSITE"
  | "EXISTING_WEBSITE_CHANGE"
  | "HRMS_DEVELOPMENT"
  | "BUG_FIX"
  | "CLIENT_REQUEST"
  | "INTERNAL_IT_SUPPORT"
  | "SERVER_DEPLOYMENT"
  | "UI_UX"
  | "RESEARCH"
  | "MAINTENANCE";

// Phase 1C-B implements the full transition engine, review workflow, and
// blocked/cancelled handling — see it-work-item-status-meta.ts.
export type ItWorkItemStatus =
  | "REQUESTED"
  | "ANALYSIS"
  | "PLANNED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "COMPLETED"
  | "BLOCKED"
  | "CANCELLED";

export interface ItWorkItemProjectRef {
  _id: string;
  name: string;
}

// Same shape as ItProjectOwnerRef — kept as its own named type since
// assignee/reviewer are a distinct concept from a Project's owner, even
// though the populated fields the backend returns are identical.
export interface ItWorkItemPersonRef {
  _id: string;
  fullName: string;
  employeeId: string;
}

export interface ItWorkItem {
  _id: string;
  workItemId: string;
  title: string;
  description: string | null;
  // Same "may be null" caveat as ItProject.product above.
  product: ItProjectProductRef | null;
  project: ItWorkItemProjectRef | null;
  workType: ItWorkType;
  priority: ItProjectPriority;
  status: ItWorkItemStatus;
  assignedTo: ItWorkItemPersonRef | null;
  reviewer: ItWorkItemPersonRef | null;
  startDate: string | null;
  dueDate: string | null;
  // Phase 1C-B: reflect the CURRENT outstanding reason only — cleared by
  // the backend once the item leaves that state. Past reasons live only in
  // the activity timeline (see ItWorkItemActivityEntry below).
  blockedReason: string | null;
  cancelReason: string | null;
  reviewNote: string | null;
  completedAt: string | null;
  // Set only when a team member proposed this item for themselves —
  // permanent historical marker, never cleared even after approval.
  proposedBy: ItWorkItemPersonRef | null;
  // "PENDING" while awaiting the IT Head's approve/reject decision; null
  // once resolved. Every status-changing action is blocked while PENDING.
  approvalStatus: "PENDING" | null;
  createdAt: string;
  updatedAt: string;
  // Computed by the backend at read time, never stored — same convention
  // as the existing Task module.
  overdue: boolean;
}

export type ItWorkItemReviewDecision = "APPROVE" | "REQUEST_CHANGES";

export interface ItWorkItemActivityEntry {
  id: string;
  action: string;
  actorEmployeeId: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ItWorkItemComment {
  _id: string;
  workItem: string;
  author: ItWorkItemPersonRef;
  body: string;
  createdAt: string;
  updatedAt: string;
}

// Daily Timesheet — a lightweight daily work log, deliberately not an
// hours-tracking system (no start/end time). "NOT_STARTED" is synthesized
// by the backend when no row exists yet for the day; it's never a stored
// status value.
export type DailyTimesheetStatus = "NOT_STARTED" | "DRAFT" | "SUBMITTED";

export interface DailyTimesheetWorkItemRef {
  _id: string;
  workItemId: string;
  title: string;
  status: ItWorkItemStatus;
}

export interface DailyTimesheetEmployeeRef {
  _id: string;
  fullName: string;
  employeeId: string;
}

export interface DailyTimesheetEntry {
  id: string | null;
  employee: string | DailyTimesheetEmployeeRef;
  workDate: string;
  description: string;
  workItems: DailyTimesheetWorkItemRef[];
  status: DailyTimesheetStatus;
  submittedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface DailyTimesheetPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// Work Schedule — "what I plan to work on" per upcoming working day,
// distinct from a Work Item's own dueDate/startDate.
export interface WorkScheduleEntry {
  id: string;
  date: string;
  workItem: DailyTimesheetWorkItemRef;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkScheduleTeamRow {
  employee: DailyTimesheetEmployeeRef;
  entries: WorkScheduleEntry[];
}

export interface ItWorkItemAttachment {
  _id: string;
  workItem: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedBy: ItWorkItemPersonRef;
  createdAt: string;
}

// Phase 1E-A — IT Head Dashboard. Dashboard rows are plain ItWorkItem
// objects (same shape the rest of the module already renders) plus two
// activity-log-derived fields that only exist in this context, since the
// Work Item model itself has no reliable "since" timestamp for either
// state — see the backend's it-work-item-dashboard.service.ts.
export interface ItDashboardWorkItem extends ItWorkItem {
  blockedSince?: string | null;
  submittedAt?: string;
}

export interface ItDashboardSummary {
  active: number;
  inReview: number;
  blocked: number;
  overdue: number;
  completedRecently: number;
  projectsAtRisk: number;
  pendingProposals: number;
}

export interface ItDashboardAttention {
  blocked: ItDashboardWorkItem[];
  reviewRequired: ItDashboardWorkItem[];
  overdue: ItDashboardWorkItem[];
  dueSoon: ItDashboardWorkItem[];
}

export interface ItDashboardTeamMember {
  id: string;
  fullName: string;
  employeeId: string;
  active: number;
  review: number;
  blocked: number;
  overdue: number;
  nextDue: string | null;
}

export interface ItDashboardProjectCounts {
  total: number;
  active: number;
  review: number;
  blocked: number;
  completed: number;
  overdue: number;
}

export interface ItDashboardProject {
  id: string;
  name: string;
  // null when the Project's Product reference no longer resolves — see
  // ItProject.product above.
  product: { id: string; name: string } | null;
  // null when the Project's owner User reference no longer resolves — see
  // ItProject.owner above.
  owner: { id: string; fullName: string; employeeId: string } | null;
  status: ItProjectStatus;
  priority: ItProjectPriority;
  targetDate: string | null;
  counts: ItDashboardProjectCounts;
  atRisk: boolean;
  riskReasons: string[];
}

export interface ItDashboardActivityEntry {
  id: string;
  action: string;
  actorEmployeeId: string;
  workItemId: string;
  workItemDisplayId: string | null;
  workItemTitle: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface ItDashboardTeamActivityEntry {
  id: string;
  actorId: string;
  actorFullName: string;
  action: string;
  workItemId: string;
  workItemDisplayId: string | null;
  workItemTitle: string | null;
  createdAt: string;
}

export interface ItHeadDashboard {
  summary: ItDashboardSummary;
  attention: ItDashboardAttention;
  team: ItDashboardTeamMember[];
  inProgress: ItDashboardWorkItem[];
  reviewQueue: ItDashboardWorkItem[];
  blocked: ItDashboardWorkItem[];
  overdue: ItDashboardWorkItem[];
  upcoming: ItDashboardWorkItem[];
  projects: ItDashboardProject[];
  recentlyCompleted: ItDashboardWorkItem[];
  pendingProposals: ItDashboardWorkItem[];
  recentActivity: ItDashboardActivityEntry[];
  todaysTeamActivity: ItDashboardTeamActivityEntry[];
  meta: {
    recentCompletedWindowDays: number;
    upcomingWindowDays: number;
    dueSoonWindowDays: number;
    generatedAt: string;
  };
}

// Phase 1E-B — IT Team Member Dashboard. Rows reuse ItDashboardWorkItem
// (the same ItWorkItem-plus-blockedSince/submittedAt shape Phase 1E-A
// already defined) since the derivation is identical, just scoped to
// assignedTo === the authenticated actor on the backend.
export interface ItMyDashboardSummary {
  myActive: number;
  inReview: number;
  blocked: number;
  overdue: number;
  dueSoon: number;
  completedRecently: number;
  pendingProposals: number;
}

export interface ItMyDashboardActivityEntry {
  id: string;
  action: string;
  actorEmployeeId: string;
  workItemId: string;
  workItemDisplayId: string | null;
  workItemTitle: string | null;
  createdAt: string;
}

export interface ItMyDashboardTodayActivityEntry {
  id: string;
  actorFullName: string;
  action: string;
  workItemId: string;
  workItemDisplayId: string | null;
  workItemTitle: string | null;
  createdAt: string;
}

export interface ItMyDashboardTodaySummary {
  startedToday: number;
  submittedForReviewToday: number;
  completedToday: number;
  commentsToday: number;
  attachmentsToday: number;
}

export interface ItMyDashboard {
  summary: ItMyDashboardSummary;
  myWork: ItDashboardWorkItem[];
  pendingProposals: ItDashboardWorkItem[];
  nextUp: ItDashboardWorkItem[];
  inProgress: ItDashboardWorkItem[];
  waitingForReview: ItDashboardWorkItem[];
  changesRequested: ItDashboardWorkItem[];
  blocked: ItDashboardWorkItem[];
  overdue: ItDashboardWorkItem[];
  dueSoon: ItDashboardWorkItem[];
  recentlyCompleted: ItDashboardWorkItem[];
  recentActivity: ItMyDashboardActivityEntry[];
  today: {
    summary: ItMyDashboardTodaySummary;
    activity: ItMyDashboardTodayActivityEntry[];
  };
  meta: {
    recentCompletedWindowDays: number;
    dueSoonWindowDays: number;
    generatedAt: string;
  };
}

// Phase 1E-C — CEO / Executive Dashboard. A business-delivery view: no
// per-employee workload data is ever part of this shape (Part 3/20 of the
// brief) — `projects`/`products` carry ownership for accountability only
// (name + employeeId), never a ranking or count of "items per person".
export interface ItExecutiveDashboardSummary {
  activeProjects: number;
  activeWorkItems: number;
  inReview: number;
  blocked: number;
  overdue: number;
  completedRecently: number;
  projectsAtRisk: number;
}

export interface ItExecutiveProduct {
  id: string;
  name: string;
  activeProjects: number;
  activeWorkItems: number;
  blocked: number;
  overdue: number;
  inReview: number;
  completedRecently: number;
}

export interface ItExecutiveActivityEntry {
  id: string;
  action: string;
  targetType: "ITWorkItem" | "ITProject";
  targetId: string;
  label: string | null;
  title: string | null;
  createdAt: string;
}

export interface ItExecutiveTodaySummary {
  completed: number;
  submittedForReview: number;
  blocked: number;
  projectsActivated: number;
}

export interface ItExecutiveDashboard {
  summary: ItExecutiveDashboardSummary;
  projectStatusCounts: Record<ItProjectStatus, number>;
  workItemStatusCounts: Record<ItWorkItemStatus, number>;
  // Reuses ItDashboardProject (Phase 1E-A) — identical shape, since this is
  // the same "At Risk" rule and the same per-project tally computation.
  projects: ItDashboardProject[];
  products: ItExecutiveProduct[];
  blocked: ItDashboardWorkItem[];
  overdue: ItDashboardWorkItem[];
  reviewQueue: ItDashboardWorkItem[];
  upcoming: ItDashboardWorkItem[];
  recentlyCompleted: ItDashboardWorkItem[];
  recentActivity: ItExecutiveActivityEntry[];
  today: ItExecutiveTodaySummary;
  meta: {
    recentCompletedWindowDays: number;
    upcomingWindowDays: number;
    generatedAt: string;
  };
}
