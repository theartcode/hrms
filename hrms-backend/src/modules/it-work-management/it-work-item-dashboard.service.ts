import { ITWorkItemModel, IITWorkItem } from "./it-work-item.model";
import { ITProjectModel } from "./it-project.model";
import { DepartmentModel } from "../department/department.model";
import { UserModel } from "../user/user.model";
import { ActivityLogModel } from "../activity-log/activity-log.model";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { isWorkItemOverdue } from "./it-work-item.util";
import { IT_WORK_ITEM_STATUS, ITWorkItemStatus } from "../../shared/constants/itWorkItemTypes";
import { IT_PROJECT_STATUS } from "../../shared/constants/itProjectTypes";
import { toId } from "../../shared/utils/toId";
import { ITProjectPriority } from "../../shared/constants/itProjectTypes";

// Phase 1E-A — the IT Head Dashboard. One endpoint, a small fixed number of
// queries (work items, projects, IT roster, two activity reads), every
// section computed server-side from that one work-item fetch — chosen over
// composing the page from several existing filtered list endpoints because
// most sections (team workload, attention, project risk) are cross-cutting
// aggregations over the SAME underlying set, and over shipping the raw list
// to the browser to crunch (Part 19 of the brief explicitly rules that out).
// No write operations live here — pure read/aggregate.

const ACTIVE_STATUSES: ITWorkItemStatus[] = [
  IT_WORK_ITEM_STATUS.REQUESTED,
  IT_WORK_ITEM_STATUS.ANALYSIS,
  IT_WORK_ITEM_STATUS.PLANNED,
  IT_WORK_ITEM_STATUS.ASSIGNED,
  IT_WORK_ITEM_STATUS.IN_PROGRESS,
];
const TERMINAL_STATUSES: ITWorkItemStatus[] = [
  IT_WORK_ITEM_STATUS.COMPLETED,
  IT_WORK_ITEM_STATUS.CANCELLED,
];

// Explicit, documented windows — never hardcoded in the frontend (Part 17 of
// the brief). Returned in `meta` below so the UI can label them honestly.
const RECENT_COMPLETED_WINDOW_DAYS = 7;
const UPCOMING_WINDOW_DAYS = 7;
const DUE_SOON_WINDOW_DAYS = 3; // narrower tier used only inside "Needs My Attention"
const ATTENTION_LIST_CAP = 8;
const DASHBOARD_LIST_CAP = 50; // dashboard lists are scannable summaries, not full pagination — see the Phase 1E-A report
const RECENT_ACTIVITY_LIMIT = 30;
// Not real pagination, a defensive ceiling on the one unfiltered fetch this
// endpoint makes — see the Phase 1E-A report's "known limitations" section.
const WORK_ITEM_SAFETY_LIMIT = 2000;

// Matches it-work-item.service.ts's own POPULATE exactly (including
// product.isActive) so the frontend's existing ItWorkItem type — and every
// component built around it — applies to dashboard rows unmodified.
const WORK_ITEM_POPULATE = [
  { path: "product", select: "name isActive" },
  { path: "project", select: "name" },
  { path: "proposedBy", select: "fullName employeeId" },
  { path: "assignedTo", select: "fullName employeeId" },
  { path: "reviewer", select: "fullName employeeId" },
];

const PROJECT_POPULATE = [
  { path: "product", select: "name" },
  { path: "owner", select: "fullName employeeId" },
];

interface PlainWorkItem extends Record<string, unknown> {
  _id: unknown;
  status: ITWorkItemStatus;
  dueDate: string | null;
  completedAt: Date | null;
  updatedAt: Date;
  assignedTo: { _id: unknown } | null;
  project: { _id: unknown } | null;
  overdue: boolean;
  blockedSince?: Date | null;
  submittedAt?: Date;
  approvalStatus: "PENDING" | null;
  createdAt: Date;
}

function toPlainWorkItem(doc: IITWorkItem): PlainWorkItem {
  const obj = doc.toObject() as unknown as PlainWorkItem;
  obj.overdue = isWorkItemOverdue(obj.dueDate, obj.status);
  return obj;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = startOfToday();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNowDateOnly(n: number): string {
  const d = startOfToday();
  d.setDate(d.getDate() + n);
  return toDateOnly(d);
}

interface RosterMember {
  id: string;
  fullName: string;
  employeeId: string;
}

// The same "IT team member" definition as it-access.ts's isItTeamMember
// (department named IT, minus its head) — reapplied here as a roster query
// rather than the per-user boolean check, since Team Workload needs the
// whole list, including a member with zero current work items.
async function getItTeamRoster(): Promise<RosterMember[]> {
  const itDepartment = await DepartmentModel.findOne({ name: /^IT$/i }).select(
    "headEmployeeId"
  );
  if (!itDepartment) return [];
  const members = await UserModel.find({
    department: itDepartment._id,
    _id: { $ne: itDepartment.headEmployeeId },
  }).select("fullName employeeId");
  return members.map((m) => ({
    id: String(m._id),
    fullName: m.fullName,
    employeeId: m.employeeId,
  }));
}

// One batch lookup (not per-row) for the two activity feeds' work-item
// context — avoids the N+1 that would come from resolving each log entry's
// work item individually.
async function buildWorkItemLabelMap(
  ids: string[]
): Promise<Map<string, { workItemId: string; title: string }>> {
  if (ids.length === 0) return new Map();
  const items = await ITWorkItemModel.find({ _id: { $in: ids } }).select("workItemId title");
  const map = new Map<string, { workItemId: string; title: string }>();
  for (const item of items) {
    map.set(String(item._id), { workItemId: item.workItemId, title: item.title });
  }
  return map;
}

export interface DashboardFilters {
  product?: string;
  project?: string;
  assignedTo?: string;
  priority?: ITProjectPriority;
  status?: ITWorkItemStatus;
}

// Filters apply to the one base Work Item query — every section below is
// derived from that same array, so a Product/Project/Assignee/Priority/
// Status filter narrows everything downstream for free, with no separate
// filter plumbing per section (Part 15 of the brief: keep this simple).
// Recent Activity and Today's Team Activity are the one exception — they
// read from the Activity Log, not this array, and stay unfiltered; see the
// Phase 1E-A report's known limitations.
export async function getItHeadDashboard(filters: DashboardFilters = {}) {
  const workItemQuery: Record<string, unknown> = {};
  if (filters.product) workItemQuery.product = filters.product;
  if (filters.project) workItemQuery.project = filters.project;
  if (filters.assignedTo) workItemQuery.assignedTo = filters.assignedTo;
  if (filters.priority) workItemQuery.priority = filters.priority;
  if (filters.status) workItemQuery.status = filters.status;

  const [workItemDocs, projects, roster] = await Promise.all([
    ITWorkItemModel.find(workItemQuery)
      .sort({ createdAt: -1 })
      .limit(WORK_ITEM_SAFETY_LIMIT)
      .populate(WORK_ITEM_POPULATE),
    ITProjectModel.find({}).sort({ createdAt: -1 }).populate(PROJECT_POPULATE),
    getItTeamRoster(),
  ]);
  const workItems = workItemDocs.map(toPlainWorkItem);

  const teamTally = new Map(
    roster.map((r) => [
      r.id,
      { active: 0, review: 0, blocked: 0, overdue: 0, nextDue: null as string | null },
    ])
  );
  const projectTally = new Map(
    projects.map((p) => [
      String(p._id),
      { total: 0, active: 0, review: 0, blocked: 0, completed: 0, overdue: 0 },
    ])
  );

  let activeCount = 0;
  let inReviewCount = 0;
  let blockedCount = 0;
  let overdueCount = 0;
  let completedRecentlyCount = 0;

  const inProgress: PlainWorkItem[] = [];
  const reviewQueue: PlainWorkItem[] = [];
  const blockedItems: PlainWorkItem[] = [];
  const overdueItems: PlainWorkItem[] = [];
  const upcomingItems: PlainWorkItem[] = [];
  const recentlyCompleted: PlainWorkItem[] = [];
  const attentionBlocked: PlainWorkItem[] = [];
  const attentionReview: PlainWorkItem[] = [];
  const attentionOverdue: PlainWorkItem[] = [];
  const attentionDueSoon: PlainWorkItem[] = [];
  // Team-proposed work items awaiting this Head's approve/reject decision
  // (Part: "team can add their own work, Head approves it into the
  // track") — every status-changing action is blocked on these until
  // resolved, so surfacing them clearly matters more than folding them
  // into any of the buckets above.
  const pendingProposals: PlainWorkItem[] = [];

  const recentCompletedCutoff = daysAgo(RECENT_COMPLETED_WINDOW_DAYS);
  const upcomingCutoff = daysFromNowDateOnly(UPCOMING_WINDOW_DAYS);
  const dueSoonCutoff = daysFromNowDateOnly(DUE_SOON_WINDOW_DAYS);
  const todayStr = toDateOnly(startOfToday());

  for (const item of workItems) {
    // Not yet part of the tracked backlog — excluded from every KPI,
    // tally, and section below, and shown only in its own Pending
    // Proposals list, until the Head approves or rejects it.
    if (item.approvalStatus === "PENDING") {
      pendingProposals.push(item);
      continue;
    }

    const assignedToId = item.assignedTo ? String(item.assignedTo._id) : null;
    const projectId = item.project ? String(item.project._id) : null;

    if (projectId && projectTally.has(projectId)) {
      const t = projectTally.get(projectId)!;
      t.total += 1;
      if (ACTIVE_STATUSES.includes(item.status)) t.active += 1;
      else if (item.status === IT_WORK_ITEM_STATUS.IN_REVIEW) t.review += 1;
      else if (item.status === IT_WORK_ITEM_STATUS.BLOCKED) t.blocked += 1;
      else if (item.status === IT_WORK_ITEM_STATUS.COMPLETED) t.completed += 1;
      if (item.overdue) t.overdue += 1;
    }

    if (assignedToId && teamTally.has(assignedToId)) {
      const t = teamTally.get(assignedToId)!;
      if (ACTIVE_STATUSES.includes(item.status)) t.active += 1;
      if (item.status === IT_WORK_ITEM_STATUS.IN_REVIEW) t.review += 1;
      if (item.status === IT_WORK_ITEM_STATUS.BLOCKED) t.blocked += 1;
      if (item.overdue) t.overdue += 1;
      if (item.dueDate && !TERMINAL_STATUSES.includes(item.status)) {
        if (!t.nextDue || item.dueDate < t.nextDue) t.nextDue = item.dueDate;
      }
    }

    if (ACTIVE_STATUSES.includes(item.status)) activeCount += 1;
    if (item.status === IT_WORK_ITEM_STATUS.IN_REVIEW) inReviewCount += 1;
    if (item.status === IT_WORK_ITEM_STATUS.BLOCKED) blockedCount += 1;
    if (item.overdue) overdueCount += 1;
    if (
      item.status === IT_WORK_ITEM_STATUS.COMPLETED &&
      item.completedAt &&
      new Date(item.completedAt) >= recentCompletedCutoff
    ) {
      completedRecentlyCount += 1;
      recentlyCompleted.push(item);
    }

    if (item.status === IT_WORK_ITEM_STATUS.IN_PROGRESS) inProgress.push(item);
    if (item.status === IT_WORK_ITEM_STATUS.IN_REVIEW) reviewQueue.push(item);
    if (item.status === IT_WORK_ITEM_STATUS.BLOCKED) blockedItems.push(item);
    if (item.overdue) overdueItems.push(item);
    if (
      !item.overdue &&
      !TERMINAL_STATUSES.includes(item.status) &&
      item.dueDate &&
      item.dueDate >= todayStr &&
      item.dueDate <= upcomingCutoff
    ) {
      upcomingItems.push(item);
    }

    // "Needs My Attention" — mutually exclusive by priority (Part 5 of the
    // brief: no duplicate entries across categories), so each item lands in
    // exactly one bucket even though it may qualify for several below it.
    if (item.status === IT_WORK_ITEM_STATUS.BLOCKED) {
      attentionBlocked.push(item);
    } else if (item.status === IT_WORK_ITEM_STATUS.IN_REVIEW) {
      attentionReview.push(item);
    } else if (item.overdue) {
      attentionOverdue.push(item);
    } else if (
      !TERMINAL_STATUSES.includes(item.status) &&
      item.dueDate &&
      item.dueDate >= todayStr &&
      item.dueDate <= dueSoonCutoff
    ) {
      attentionDueSoon.push(item);
    }
  }

  // "Blocked since" / "submitted at" — the Work Item model has no dedicated
  // timestamp for either (updatedAt is unreliable: a general edit can bump
  // it without changing status). The Activity Log already records both
  // transitions precisely, so this reads the most recent matching entry per
  // item instead of inventing a new schema field (Part 9: don't fake a
  // duration that isn't reliably derivable — this IS reliably derivable).
  const blockedIds = blockedItems.map((i) => String(i._id));
  const reviewIds = reviewQueue.map((i) => String(i._id));
  const [blockedActivity, reviewActivity] = await Promise.all([
    blockedIds.length
      ? ActivityLogModel.find({
          targetType: "ITWorkItem",
          targetId: { $in: blockedIds },
          action: ACTIVITY_ACTIONS.IT_WORK_ITEM_BLOCKED,
        }).sort({ createdAt: -1 })
      : Promise.resolve([]),
    reviewIds.length
      ? ActivityLogModel.find({
          targetType: "ITWorkItem",
          targetId: { $in: reviewIds },
          action: ACTIVITY_ACTIONS.IT_WORK_ITEM_SUBMITTED_FOR_REVIEW,
        }).sort({ createdAt: -1 })
      : Promise.resolve([]),
  ]);
  const blockedSinceMap = new Map<string, Date>();
  for (const log of blockedActivity) {
    const key = String(log.targetId);
    if (!blockedSinceMap.has(key)) blockedSinceMap.set(key, log.createdAt); // sorted desc — first seen per id is the most recent
  }
  const submittedAtMap = new Map<string, Date>();
  for (const log of reviewActivity) {
    const key = String(log.targetId);
    if (!submittedAtMap.has(key)) submittedAtMap.set(key, log.createdAt);
  }
  // blockedItems/attentionBlocked (and reviewQueue/attentionReview) share
  // the same object references, so mutating here is visible in both lists.
  for (const item of blockedItems) {
    item.blockedSince = blockedSinceMap.get(String(item._id)) ?? null;
  }
  for (const item of reviewQueue) {
    item.submittedAt = submittedAtMap.get(String(item._id)) ?? item.updatedAt;
  }

  inProgress.sort((a, b) => (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99"));
  overdueItems.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  upcomingItems.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  recentlyCompleted.sort(
    (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
  );
  blockedItems.sort(
    (a, b) =>
      new Date(a.blockedSince ?? a.updatedAt).getTime() -
      new Date(b.blockedSince ?? b.updatedAt).getTime()
  );
  reviewQueue.sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime());
  attentionBlocked.sort(
    (a, b) =>
      new Date(a.blockedSince ?? a.updatedAt).getTime() -
      new Date(b.blockedSince ?? b.updatedAt).getTime()
  );
  attentionReview.sort(
    (a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime()
  );
  attentionOverdue.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  attentionDueSoon.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));

  // Project Status + the documented "At Risk" rule (Part 13 of the brief,
  // reproduced exactly): a project is at risk if it has >=1 overdue work
  // item, OR >=1 blocked work item, OR its target date has passed while the
  // project itself is not COMPLETED/CANCELLED. Only non-terminal projects
  // are listed — a completed/cancelled project can't meaningfully be "at
  // risk" and isn't part of ongoing monitoring.
  const projectStatusList: Array<{
    id: string;
    name: string;
    // null when the Project's `product` reference no longer resolves — the
    // app has no delete-Product operation, but a document removed directly
    // at the database level still leaves this populate() call returning
    // null rather than throwing, so this must be handled, not assumed away.
    product: { id: string; name: string } | null;
    // Same "may be dangling" caveat as product above — a Project's owner
    // is a required User reference, but a User document removed directly
    // at the database level leaves this null after populate() too.
    owner: { id: string; fullName: string; employeeId: string } | null;
    status: string;
    priority: string;
    targetDate: string | null;
    counts: { total: number; active: number; review: number; blocked: number; completed: number; overdue: number };
    atRisk: boolean;
    riskReasons: string[];
  }> = [];
  let projectsAtRiskCount = 0;
  for (const project of projects) {
    if (
      project.status === IT_PROJECT_STATUS.COMPLETED ||
      project.status === IT_PROJECT_STATUS.CANCELLED
    ) {
      continue;
    }
    const tally = projectTally.get(String(project._id))!;
    const product = project.product as unknown as { _id: unknown; name: string } | null;
    const owner = project.owner as unknown as { _id: unknown; fullName: string; employeeId: string } | null;

    const reasons: string[] = [];
    if (tally.overdue > 0) {
      reasons.push(`${tally.overdue} overdue Work Item${tally.overdue === 1 ? "" : "s"}`);
    }
    if (tally.blocked > 0) {
      reasons.push(`${tally.blocked} blocked Work Item${tally.blocked === 1 ? "" : "s"}`);
    }
    if (project.targetDate && project.targetDate < todayStr) {
      reasons.push("Target date passed");
    }
    if (reasons.length > 0) projectsAtRiskCount += 1;

    projectStatusList.push({
      id: String(project._id),
      name: project.name,
      product: product ? { id: String(product._id), name: product.name } : null,
      owner: owner ? { id: String(owner._id), fullName: owner.fullName, employeeId: owner.employeeId } : null,
      status: project.status,
      priority: project.priority,
      targetDate: project.targetDate,
      counts: tally,
      atRisk: reasons.length > 0,
      riskReasons: reasons,
    });
  }

  const team = roster
    .map((r) => ({ ...r, ...teamTally.get(r.id)! }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  // Recent Activity (global, most recent N events) and Today's Team
  // Activity (date-bounded, roster-scoped) — the one thing with no existing
  // read path (listWorkItemActivity is per-work-item only), built here from
  // the same Activity Log rows already recorded by every other IT phase, no
  // new logging added.
  const rosterIds = roster.map((r) => r.id);
  const [recentActivityLogs, todayLogs] = await Promise.all([
    ActivityLogModel.find({ targetType: "ITWorkItem" })
      .sort({ createdAt: -1 })
      .limit(RECENT_ACTIVITY_LIMIT),
    rosterIds.length
      ? ActivityLogModel.find({
          targetType: "ITWorkItem",
          createdAt: { $gte: startOfToday() },
          actorId: { $in: rosterIds },
        }).sort({ createdAt: -1 })
      : Promise.resolve([]),
  ]);
  const labelMap = await buildWorkItemLabelMap(
    Array.from(new Set([...recentActivityLogs, ...todayLogs].map((l) => String(l.targetId))))
  );
  const rosterMap = new Map(roster.map((r) => [r.id, r]));

  const recentActivity = recentActivityLogs.map((log) => {
    const wi = labelMap.get(String(log.targetId));
    return {
      id: toId(log),
      action: log.action,
      actorEmployeeId: log.actorEmployeeId,
      workItemId: String(log.targetId),
      workItemDisplayId: wi?.workItemId ?? null,
      workItemTitle: wi?.title ?? null,
      metadata: log.metadata ?? null,
      createdAt: log.createdAt,
    };
  });

  const todaysTeamActivity = todayLogs.map((log) => {
    const wi = labelMap.get(String(log.targetId));
    const member = rosterMap.get(String(log.actorId));
    return {
      id: toId(log),
      actorId: String(log.actorId),
      actorFullName: member?.fullName ?? log.actorEmployeeId,
      action: log.action,
      workItemId: String(log.targetId),
      workItemDisplayId: wi?.workItemId ?? null,
      workItemTitle: wi?.title ?? null,
      createdAt: log.createdAt,
    };
  });

  return {
    summary: {
      active: activeCount,
      inReview: inReviewCount,
      blocked: blockedCount,
      overdue: overdueCount,
      completedRecently: completedRecentlyCount,
      projectsAtRisk: projectsAtRiskCount,
      pendingProposals: pendingProposals.length,
    },
    attention: {
      blocked: attentionBlocked.slice(0, ATTENTION_LIST_CAP),
      reviewRequired: attentionReview.slice(0, ATTENTION_LIST_CAP),
      overdue: attentionOverdue.slice(0, ATTENTION_LIST_CAP),
      dueSoon: attentionDueSoon.slice(0, ATTENTION_LIST_CAP),
    },
    team,
    inProgress: inProgress.slice(0, DASHBOARD_LIST_CAP),
    reviewQueue: reviewQueue.slice(0, DASHBOARD_LIST_CAP),
    blocked: blockedItems.slice(0, DASHBOARD_LIST_CAP),
    overdue: overdueItems.slice(0, DASHBOARD_LIST_CAP),
    upcoming: upcomingItems.slice(0, DASHBOARD_LIST_CAP),
    projects: projectStatusList,
    recentlyCompleted: recentlyCompleted.slice(0, DASHBOARD_LIST_CAP),
    pendingProposals: pendingProposals
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, DASHBOARD_LIST_CAP),
    recentActivity,
    todaysTeamActivity,
    meta: {
      recentCompletedWindowDays: RECENT_COMPLETED_WINDOW_DAYS,
      upcomingWindowDays: UPCOMING_WINDOW_DAYS,
      dueSoonWindowDays: DUE_SOON_WINDOW_DAYS,
      generatedAt: new Date(),
    },
  };
}
