import { ITWorkItemModel, IITWorkItem } from "./it-work-item.model";
import { ITProjectModel } from "./it-project.model";
import { ITProductModel } from "./it-product.model";
import { ActivityLogModel } from "../activity-log/activity-log.model";
import { ACTIVITY_ACTIONS, ActivityAction } from "../../shared/constants/activityActions";
import { isWorkItemOverdue } from "./it-work-item.util";
import { IT_WORK_ITEM_STATUS, ITWorkItemStatus, ITWorkType } from "../../shared/constants/itWorkItemTypes";
import { IT_PROJECT_STATUS, ITProjectPriority, ITProjectStatus } from "../../shared/constants/itProjectTypes";
import { toId } from "../../shared/utils/toId";

// Phase 1E-C — the CEO / Executive Dashboard. A business-delivery view:
// PRODUCT -> PROJECT -> DELIVERY -> RISK, never EMPLOYEE -> TASK -> COMMENT
// (Part 3 of the brief). Deliberately its own service, not a reshaping of
// the Phase 1E-A IT Head dashboard's output — several sections here don't
// exist there at all (full per-status breakdown, per-product rollup, a
// curated delivery-events-only activity feed spanning Projects as well as
// Work Items) and this dashboard must NEVER be able to leak per-employee
// workload data by construction, which is easiest to guarantee by never
// computing it here in the first place, rather than filtering someone
// else's output after the fact. Same architecture as 1E-A/1E-B though: one
// base Work Item fetch, one Project fetch, one Product fetch, everything
// else derived in one pass. No write operations — pure read/aggregate.

const ACTIVE_WORK_ITEM_STATUSES: ITWorkItemStatus[] = [
  IT_WORK_ITEM_STATUS.REQUESTED,
  IT_WORK_ITEM_STATUS.ANALYSIS,
  IT_WORK_ITEM_STATUS.PLANNED,
  IT_WORK_ITEM_STATUS.ASSIGNED,
  IT_WORK_ITEM_STATUS.IN_PROGRESS,
];
const TERMINAL_WORK_ITEM_STATUSES: ITWorkItemStatus[] = [
  IT_WORK_ITEM_STATUS.COMPLETED,
  IT_WORK_ITEM_STATUS.CANCELLED,
];
const TERMINAL_PROJECT_STATUSES: ITProjectStatus[] = [
  IT_PROJECT_STATUS.COMPLETED,
  IT_PROJECT_STATUS.CANCELLED,
];
const ALL_WORK_ITEM_STATUSES: ITWorkItemStatus[] = Object.values(IT_WORK_ITEM_STATUS);
const ALL_PROJECT_STATUSES: ITProjectStatus[] = Object.values(IT_PROJECT_STATUS);

// Explicit, documented windows.
const RECENT_COMPLETED_WINDOW_DAYS = 7; // matches the IT Head dashboard, per Part 14
const UPCOMING_WINDOW_DAYS = 7;
const DASHBOARD_LIST_CAP = 50; // scannable executive summaries, not full pagination
const RECENT_ACTIVITY_LIMIT = 20;
const WORK_ITEM_SAFETY_LIMIT = 2000;

// Part 18: significant delivery events only — comments and attachments
// must never dominate this feed. Deliberately narrower than every action
// this module logs.
const SIGNIFICANT_ACTIVITY_ACTIONS: ActivityAction[] = [
  ACTIVITY_ACTIONS.IT_PROJECT_CREATED,
  ACTIVITY_ACTIONS.IT_PROJECT_STATUS_CHANGED,
  ACTIVITY_ACTIONS.IT_WORK_ITEM_ASSIGNED,
  ACTIVITY_ACTIONS.IT_WORK_ITEM_REASSIGNED,
  ACTIVITY_ACTIONS.IT_WORK_ITEM_SUBMITTED_FOR_REVIEW,
  ACTIVITY_ACTIONS.IT_WORK_ITEM_REVIEW_APPROVED,
  ACTIVITY_ACTIONS.IT_WORK_ITEM_CHANGES_REQUESTED,
  ACTIVITY_ACTIONS.IT_WORK_ITEM_BLOCKED,
  ACTIVITY_ACTIONS.IT_WORK_ITEM_CANCELLED,
];

const WORK_ITEM_POPULATE = [
  { path: "product", select: "name isActive" },
  { path: "project", select: "name" },
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
  product: { _id: unknown } | null;
  project: { _id: unknown } | null;
  overdue: boolean;
  submittedAt?: Date;
  approvalStatus: "PENDING" | null;
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

// The exact Phase 1E-A "At Risk" rule, reapplied verbatim (Part 8 of the
// brief: not a second algorithm) — a project is at risk if it has >=1
// overdue Work Item, OR >=1 blocked Work Item, OR its target date has
// passed while the project isn't Completed/Cancelled (terminal projects
// are filtered out by the caller before this runs, so that third check
// only ever needs the date comparison). Exported for unit testing — see
// it-work-item-executive-dashboard.service.test.ts.
export function computeProjectRiskReasons(
  tally: { overdue: number; blocked: number },
  targetDate: string | null,
  todayStr: string
): string[] {
  const reasons: string[] = [];
  if (tally.overdue > 0) {
    reasons.push(`${tally.overdue} overdue Work Item${tally.overdue === 1 ? "" : "s"}`);
  }
  if (tally.blocked > 0) {
    reasons.push(`${tally.blocked} blocked Work Item${tally.blocked === 1 ? "" : "s"}`);
  }
  if (targetDate && targetDate < todayStr) {
    reasons.push("Target date passed");
  }
  return reasons;
}

export interface ExecutiveDashboardFilters {
  product?: string;
  project?: string;
  assignedTo?: string;
  priority?: ITProjectPriority;
  status?: ITWorkItemStatus;
  workType?: ITWorkType;
  search?: string;
}

// No userId/employeeId parameter determines visibility here — readonly
// access is an all-of-IT grant (see it-work-management-settings.service.ts
// / getItAccessTier), not a per-user scope, so this dashboard is
// deliberately unscoped by actor, gated only by the itReadOnlyOnly route
// middleware (Part 43 of the brief).
export async function getExecutiveDashboard(filters: ExecutiveDashboardFilters = {}) {
  const workItemQuery: Record<string, unknown> = {};
  if (filters.product) workItemQuery.product = filters.product;
  if (filters.project) workItemQuery.project = filters.project;
  if (filters.assignedTo) workItemQuery.assignedTo = filters.assignedTo;
  if (filters.priority) workItemQuery.priority = filters.priority;
  if (filters.status) workItemQuery.status = filters.status;
  if (filters.workType) workItemQuery.workType = filters.workType;
  if (filters.search) {
    const term = filters.search.trim();
    if (term) {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      workItemQuery.$or = [{ workItemId: pattern }, { title: pattern }];
    }
  }

  const [workItemDocs, projects, products] = await Promise.all([
    ITWorkItemModel.find(workItemQuery)
      .sort({ createdAt: -1 })
      .limit(WORK_ITEM_SAFETY_LIMIT)
      .populate(WORK_ITEM_POPULATE),
    ITProjectModel.find({}).sort({ createdAt: -1 }).populate(PROJECT_POPULATE),
    ITProductModel.find({ isActive: true }).select("name"),
  ]);
  const workItems = workItemDocs.map(toPlainWorkItem);

  const projectTally = new Map(
    projects.map((p) => [
      String(p._id),
      { total: 0, active: 0, review: 0, blocked: 0, completed: 0, overdue: 0 },
    ])
  );
  const productTally = new Map(
    products.map((p) => [
      String(p._id),
      { activeWorkItems: 0, blocked: 0, overdue: 0, inReview: 0, completedRecently: 0 },
    ])
  );
  const workItemStatusCounts = Object.fromEntries(
    ALL_WORK_ITEM_STATUSES.map((s) => [s, 0])
  ) as Record<ITWorkItemStatus, number>;

  let activeWorkItemsCount = 0;
  let inReviewCount = 0;
  let blockedCount = 0;
  let overdueCount = 0;
  let completedRecentlyCount = 0;

  const reviewQueue: PlainWorkItem[] = [];
  const blockedItems: PlainWorkItem[] = [];
  const overdueItems: PlainWorkItem[] = [];
  const upcomingItems: PlainWorkItem[] = [];
  const recentlyCompleted: PlainWorkItem[] = [];

  const recentCompletedCutoff = daysAgo(RECENT_COMPLETED_WINDOW_DAYS);
  const upcomingCutoff = daysFromNowDateOnly(UPCOMING_WINDOW_DAYS);
  const todayStr = toDateOnly(startOfToday());

  for (const item of workItems) {
    // Not yet part of the tracked backlog — a team-proposed item awaiting
    // the IT Head's approve/reject decision is excluded from every
    // executive count until resolved, same as the IT Head/Team dashboards.
    if (item.approvalStatus === "PENDING") continue;

    workItemStatusCounts[item.status] += 1;

    const projectId = item.project ? String(item.project._id) : null;
    if (projectId && projectTally.has(projectId)) {
      const t = projectTally.get(projectId)!;
      t.total += 1;
      if (ACTIVE_WORK_ITEM_STATUSES.includes(item.status)) t.active += 1;
      else if (item.status === IT_WORK_ITEM_STATUS.IN_REVIEW) t.review += 1;
      else if (item.status === IT_WORK_ITEM_STATUS.BLOCKED) t.blocked += 1;
      else if (item.status === IT_WORK_ITEM_STATUS.COMPLETED) t.completed += 1;
      if (item.overdue) t.overdue += 1;
    }

    const productId = item.product ? String(item.product._id) : null;
    const isRecentlyCompletedItem =
      item.status === IT_WORK_ITEM_STATUS.COMPLETED &&
      !!item.completedAt &&
      new Date(item.completedAt) >= recentCompletedCutoff;
    if (productId && productTally.has(productId)) {
      const t = productTally.get(productId)!;
      if (ACTIVE_WORK_ITEM_STATUSES.includes(item.status)) t.activeWorkItems += 1;
      if (item.status === IT_WORK_ITEM_STATUS.BLOCKED) t.blocked += 1;
      if (item.overdue) t.overdue += 1;
      if (item.status === IT_WORK_ITEM_STATUS.IN_REVIEW) t.inReview += 1;
      if (isRecentlyCompletedItem) t.completedRecently += 1;
    }

    if (ACTIVE_WORK_ITEM_STATUSES.includes(item.status)) activeWorkItemsCount += 1;
    if (item.status === IT_WORK_ITEM_STATUS.IN_REVIEW) {
      inReviewCount += 1;
      reviewQueue.push(item);
    }
    if (item.status === IT_WORK_ITEM_STATUS.BLOCKED) {
      blockedCount += 1;
      blockedItems.push(item);
    }
    if (item.overdue) {
      overdueCount += 1;
      overdueItems.push(item);
    }
    if (isRecentlyCompletedItem) {
      completedRecentlyCount += 1;
      recentlyCompleted.push(item);
    }
    if (
      !item.overdue &&
      !TERMINAL_WORK_ITEM_STATUSES.includes(item.status) &&
      item.dueDate &&
      item.dueDate >= todayStr &&
      item.dueDate <= upcomingCutoff
    ) {
      upcomingItems.push(item);
    }
  }

  // "Submitted at" for the review queue — same reasoning as 1E-A/1E-B: the
  // Activity Log's own SUBMITTED_FOR_REVIEW entry is the precise source,
  // updatedAt is not reliable (a general edit can bump it without a status
  // change).
  const reviewIds = reviewQueue.map((i) => String(i._id));
  const reviewActivity = reviewIds.length
    ? await ActivityLogModel.find({
        targetType: "ITWorkItem",
        targetId: { $in: reviewIds },
        action: ACTIVITY_ACTIONS.IT_WORK_ITEM_SUBMITTED_FOR_REVIEW,
      }).sort({ createdAt: -1 })
    : [];
  const submittedAtMap = new Map<string, Date>();
  for (const log of reviewActivity) {
    const key = String(log.targetId);
    if (!submittedAtMap.has(key)) submittedAtMap.set(key, log.createdAt);
  }
  for (const item of reviewQueue) {
    item.submittedAt = submittedAtMap.get(String(item._id)) ?? item.updatedAt;
  }

  reviewQueue.sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime());
  blockedItems.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  overdueItems.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  upcomingItems.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  recentlyCompleted.sort(
    (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
  );

  // Project Portfolio + the documented "At Risk" rule — the EXACT Phase
  // 1E-A rule, reapplied (not a second algorithm): overdue Work Items, OR
  // blocked Work Items, OR a passed target date while the project itself
  // isn't Completed/Cancelled. Only non-terminal projects are listed — the
  // same convention 1E-A's own Project Status section uses.
  const projectStatusCounts = Object.fromEntries(
    ALL_PROJECT_STATUSES.map((s) => [s, 0])
  ) as Record<ITProjectStatus, number>;
  const portfolio: Array<{
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
    status: ITProjectStatus;
    priority: ITProjectPriority;
    targetDate: string | null;
    counts: { total: number; active: number; review: number; blocked: number; completed: number; overdue: number };
    atRisk: boolean;
    riskReasons: string[];
  }> = [];
  let activeProjectsCount = 0;
  let projectsAtRiskCount = 0;

  for (const project of projects) {
    projectStatusCounts[project.status] += 1;
    if (project.status === IT_PROJECT_STATUS.ACTIVE) activeProjectsCount += 1;
    if (TERMINAL_PROJECT_STATUSES.includes(project.status)) continue;

    const tally = projectTally.get(String(project._id))!;
    const product = project.product as unknown as { _id: unknown; name: string } | null;
    const owner = project.owner as unknown as { _id: unknown; fullName: string; employeeId: string } | null;

    const reasons = computeProjectRiskReasons(tally, project.targetDate, todayStr);
    if (reasons.length > 0) projectsAtRiskCount += 1;

    portfolio.push({
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

  // Product Overview (Part 16) — active projects per product computed from
  // the same project list, work-item counts from productTally above. Every
  // active Product appears even with zero current work, so a new Product
  // shows up automatically with no code change (Part 16's own requirement).
  const activeProjectsByProduct = new Map<string, number>();
  for (const project of projects) {
    if (TERMINAL_PROJECT_STATUSES.includes(project.status)) continue;
    const projectProduct = project.product as unknown as { _id: unknown } | null;
    if (!projectProduct) continue; // dangling product reference — excluded from every product's tally, not just one
    const productId = String(projectProduct._id);
    activeProjectsByProduct.set(productId, (activeProjectsByProduct.get(productId) ?? 0) + 1);
  }
  const productOverview = products.map((p) => {
    const id = String(p._id);
    const tally = productTally.get(id)!;
    return {
      id,
      name: p.name,
      activeProjects: activeProjectsByProduct.get(id) ?? 0,
      ...tally,
    };
  });

  // Recent Activity — curated to significant delivery events only (Part
  // 18), spanning both Projects and Work Items, unlike 1E-A/1E-B which are
  // Work-Item-only. Labels come from the work items/projects already fully
  // in memory (unfiltered fetch above) — no extra lookup query.
  const workItemLabelMap = new Map(
    workItems.map((i) => [String(i._id), { displayId: (i as { workItemId?: string }).workItemId ?? null, title: (i as { title?: string }).title ?? null }])
  );
  const projectLabelMap = new Map(projects.map((p) => [String(p._id), p.name]));

  const [recentActivityLogs, todayLogs] = await Promise.all([
    ActivityLogModel.find({
      targetType: { $in: ["ITWorkItem", "ITProject"] },
      action: { $in: SIGNIFICANT_ACTIVITY_ACTIONS },
    })
      .sort({ createdAt: -1 })
      .limit(RECENT_ACTIVITY_LIMIT),
    ActivityLogModel.find({
      targetType: { $in: ["ITWorkItem", "ITProject"] },
      createdAt: { $gte: startOfToday() },
    }).sort({ createdAt: -1 }),
  ]);

  const recentActivity = recentActivityLogs.map((log) => {
    const isProject = log.targetType === "ITProject";
    const wi = isProject ? null : workItemLabelMap.get(String(log.targetId));
    return {
      id: toId(log),
      action: log.action,
      targetType: log.targetType as "ITWorkItem" | "ITProject",
      targetId: String(log.targetId),
      label: isProject
        ? projectLabelMap.get(String(log.targetId)) ?? null
        : (wi?.displayId ?? null),
      title: isProject ? null : (wi?.title ?? null),
      createdAt: log.createdAt,
    };
  });

  // Today's Activity — a summary, deliberately NOT the Team dashboard's
  // per-junior event list (Part 19 explicitly rules that out for this
  // audience). Counts only, from the same delivery-relevant actions.
  let completedToday = 0;
  let submittedForReviewToday = 0;
  let blockedToday = 0;
  let projectsActivatedToday = 0;
  for (const log of todayLogs) {
    if (log.action === ACTIVITY_ACTIONS.IT_WORK_ITEM_REVIEW_APPROVED) completedToday += 1;
    else if (log.action === ACTIVITY_ACTIONS.IT_WORK_ITEM_SUBMITTED_FOR_REVIEW) submittedForReviewToday += 1;
    else if (log.action === ACTIVITY_ACTIONS.IT_WORK_ITEM_BLOCKED) blockedToday += 1;
    else if (
      log.action === ACTIVITY_ACTIONS.IT_PROJECT_STATUS_CHANGED &&
      (log.metadata as { to?: string } | undefined)?.to === IT_PROJECT_STATUS.ACTIVE
    ) {
      projectsActivatedToday += 1;
    }
  }

  return {
    summary: {
      activeProjects: activeProjectsCount,
      activeWorkItems: activeWorkItemsCount,
      inReview: inReviewCount,
      blocked: blockedCount,
      overdue: overdueCount,
      completedRecently: completedRecentlyCount,
      projectsAtRisk: projectsAtRiskCount,
    },
    projectStatusCounts,
    workItemStatusCounts,
    projects: portfolio,
    products: productOverview,
    blocked: blockedItems.slice(0, DASHBOARD_LIST_CAP),
    overdue: overdueItems.slice(0, DASHBOARD_LIST_CAP),
    reviewQueue: reviewQueue.slice(0, DASHBOARD_LIST_CAP),
    upcoming: upcomingItems.slice(0, DASHBOARD_LIST_CAP),
    recentlyCompleted: recentlyCompleted.slice(0, DASHBOARD_LIST_CAP),
    recentActivity,
    today: {
      completed: completedToday,
      submittedForReview: submittedForReviewToday,
      blocked: blockedToday,
      projectsActivated: projectsActivatedToday,
    },
    meta: {
      recentCompletedWindowDays: RECENT_COMPLETED_WINDOW_DAYS,
      upcomingWindowDays: UPCOMING_WINDOW_DAYS,
      generatedAt: new Date(),
    },
  };
}
