import { ITWorkItemModel, IITWorkItem } from "./it-work-item.model";
import { UserModel } from "../user/user.model";
import { ActivityLogModel } from "../activity-log/activity-log.model";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { isWorkItemOverdue } from "./it-work-item.util";
import { IT_WORK_ITEM_STATUS, ITWorkItemStatus, ITWorkType } from "../../shared/constants/itWorkItemTypes";
import { IT_PROJECT_PRIORITY, ITProjectPriority } from "../../shared/constants/itProjectTypes";
import { toId } from "../../shared/utils/toId";

// Phase 1E-B — the IT Team Member Dashboard. Execution-focused, scoped
// entirely to `assignedTo === actor.id` (never the broader team-tier
// visibility that also admits a named reviewer — Part 3/28 of the brief:
// derive scope from the authenticated actor, never widen it). One base
// Work Item query, every section sliced from that same array — same
// architecture as the Phase 1E-A IT Head dashboard, reapplied at this
// narrower scope. No write operations here — pure read/aggregate.

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
// "My Work" is everything not yet finished — including IN_REVIEW/BLOCKED —
// per Part 6's "do not hide lower-priority work."
const MY_WORK_STATUSES: ITWorkItemStatus[] = [
  ...ACTIVE_STATUSES,
  IT_WORK_ITEM_STATUS.IN_REVIEW,
  IT_WORK_ITEM_STATUS.BLOCKED,
];

const PRIORITY_RANK: Record<ITProjectPriority, number> = {
  [IT_PROJECT_PRIORITY.URGENT]: 0,
  [IT_PROJECT_PRIORITY.HIGH]: 1,
  [IT_PROJECT_PRIORITY.MEDIUM]: 2,
  [IT_PROJECT_PRIORITY.LOW]: 3,
};

// Explicit, documented windows — never hardcoded in the frontend.
const RECENT_COMPLETED_WINDOW_DAYS = 7;
const DUE_SOON_WINDOW_DAYS = 7;
const NEXT_UP_CAP = 5;
const DASHBOARD_LIST_CAP = 50; // scannable summaries, not full pagination — the full "My Work" filter/search view is the place for anything beyond this
const RECENT_ACTIVITY_LIMIT = 30;
const WORK_ITEM_SAFETY_LIMIT = 1000;

const WORK_ITEM_POPULATE = [
  { path: "product", select: "name isActive" },
  { path: "project", select: "name" },
  { path: "proposedBy", select: "fullName employeeId" },
  { path: "assignedTo", select: "fullName employeeId" },
  { path: "reviewer", select: "fullName employeeId" },
];

export interface PlainWorkItem extends Record<string, unknown> {
  _id: unknown;
  workItemId: string;
  title: string;
  status: ITWorkItemStatus;
  priority: ITProjectPriority;
  dueDate: string | null;
  completedAt: Date | null;
  reviewNote: string | null;
  updatedAt: Date;
  createdAt: Date;
  overdue: boolean;
  blockedSince?: Date | null;
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

// Priority-first, overdue-and-due-date as tiebreaker within each priority —
// the "My Work" ordering from Part 6 (URGENT, then HIGH, then overdue/due
// soon within the rest). A plain multi-key sort over existing fields, not a
// new scoring algorithm. Exported for unit testing (see
// it-work-item-my-dashboard.service.test.ts) — these two comparators are the
// only DB-independent logic in this file, so they're what's covered by a
// fast pure test rather than a new integration-test harness this codebase
// has never used (see the Phase 1E-B report's Testing section).
export function sortByPriorityThenUrgency(a: PlainWorkItem, b: PlainWorkItem): number {
  const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (rankDiff !== 0) return rankDiff;
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  return (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
}

// Overdue-first ordering for "Next Up" (Part 7: overdue, then urgent, then
// high, then due soon, then the rest) — deliberately a different priority
// than sortByPriorityThenUrgency above, matching the brief's own two
// distinct suggested orderings for two distinct sections.
export function sortByUrgencyThenPriority(a: PlainWorkItem, b: PlainWorkItem): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  const rankDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (rankDiff !== 0) return rankDiff;
  return (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99");
}

interface Actor {
  id: string;
  employeeId: string;
}

export interface MyDashboardFilters {
  product?: string;
  project?: string;
  workType?: ITWorkType;
  priority?: ITProjectPriority;
  status?: ITWorkItemStatus;
  search?: string;
}

// The one and only scoping rule: assignedTo === actor.id. Filters narrow
// this same set further; they never widen it and there is no assignedTo
// filter to override it (Part 21: never let a team member browse someone
// else's work through this endpoint).
export async function getMyDashboard(actor: Actor, filters: MyDashboardFilters = {}) {
  const workItemQuery: Record<string, unknown> = { assignedTo: actor.id };
  if (filters.product) workItemQuery.product = filters.product;
  if (filters.project) workItemQuery.project = filters.project;
  if (filters.workType) workItemQuery.workType = filters.workType;
  if (filters.priority) workItemQuery.priority = filters.priority;
  if (filters.status) workItemQuery.status = filters.status;
  if (filters.search) {
    const term = filters.search.trim();
    if (term) {
      const pattern = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      workItemQuery.$or = [{ workItemId: pattern }, { title: pattern }];
    }
  }

  const workItemDocs = await ITWorkItemModel.find(workItemQuery)
    .sort({ createdAt: -1 })
    .limit(WORK_ITEM_SAFETY_LIMIT)
    .populate(WORK_ITEM_POPULATE);
  const workItems = workItemDocs.map(toPlainWorkItem);

  let inReviewCount = 0;
  let blockedCount = 0;
  let overdueCount = 0;
  let dueSoonCount = 0;
  let completedRecentlyCount = 0;

  const myWork: PlainWorkItem[] = [];
  // My own proposals still awaiting the IT Head's approve/reject decision —
  // excluded from every other section below (not yet part of the tracked
  // backlog) and shown only here until resolved.
  const pendingProposals: PlainWorkItem[] = [];
  const inProgress: PlainWorkItem[] = [];
  const waitingForReview: PlainWorkItem[] = [];
  const changesRequested: PlainWorkItem[] = [];
  const blockedItems: PlainWorkItem[] = [];
  const overdueItems: PlainWorkItem[] = [];
  const dueSoonItems: PlainWorkItem[] = [];
  const recentlyCompleted: PlainWorkItem[] = [];

  const recentCompletedCutoff = daysAgo(RECENT_COMPLETED_WINDOW_DAYS);
  const dueSoonCutoff = daysFromNowDateOnly(DUE_SOON_WINDOW_DAYS);
  const todayStr = toDateOnly(startOfToday());

  for (const item of workItems) {
    if (item.approvalStatus === "PENDING") {
      pendingProposals.push(item);
      continue;
    }
    if (MY_WORK_STATUSES.includes(item.status)) myWork.push(item);
    if (item.status === IT_WORK_ITEM_STATUS.IN_PROGRESS) inProgress.push(item);
    if (item.status === IT_WORK_ITEM_STATUS.IN_REVIEW) {
      inReviewCount += 1;
      waitingForReview.push(item);
    }
    if (item.status === IT_WORK_ITEM_STATUS.BLOCKED) {
      blockedCount += 1;
      blockedItems.push(item);
    }
    if (item.overdue) overdueCount += 1;
    if (item.overdue) overdueItems.push(item);
    // "Changes requested" is derivable directly from the live reviewNote
    // field (set only by REQUEST_CHANGES, cleared on resubmit/approve — see
    // reviewWorkItem/submitWorkItemForReview in it-work-item.service.ts),
    // no Activity Log lookup needed.
    if (item.reviewNote) changesRequested.push(item);
    if (
      !item.overdue &&
      !TERMINAL_STATUSES.includes(item.status) &&
      item.dueDate &&
      item.dueDate >= todayStr &&
      item.dueDate <= dueSoonCutoff
    ) {
      dueSoonCount += 1;
      dueSoonItems.push(item);
    }
    if (
      item.status === IT_WORK_ITEM_STATUS.COMPLETED &&
      item.completedAt &&
      new Date(item.completedAt) >= recentCompletedCutoff
    ) {
      completedRecentlyCount += 1;
      recentlyCompleted.push(item);
    }
  }

  // "Submitted at" for the review queue — same reasoning as the IT Head
  // dashboard: updatedAt is unreliable (a general edit could bump it
  // without a status change), so the precise submit timestamp comes from
  // the Activity Log entry the submit action itself already recorded.
  const reviewIds = waitingForReview.map((i) => String(i._id));
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
    if (!submittedAtMap.has(key)) submittedAtMap.set(key, log.createdAt); // sorted desc — first seen per id is the most recent
  }
  for (const item of waitingForReview) {
    item.submittedAt = submittedAtMap.get(String(item._id)) ?? item.updatedAt;
  }

  // "Blocked since" — same technique, reading the most recent BLOCKED
  // transition per item from the Activity Log rather than inventing a
  // schema field.
  const blockedIds = blockedItems.map((i) => String(i._id));
  const blockedActivity = blockedIds.length
    ? await ActivityLogModel.find({
        targetType: "ITWorkItem",
        targetId: { $in: blockedIds },
        action: ACTIVITY_ACTIONS.IT_WORK_ITEM_BLOCKED,
      }).sort({ createdAt: -1 })
    : [];
  const blockedSinceMap = new Map<string, Date>();
  for (const log of blockedActivity) {
    const key = String(log.targetId);
    if (!blockedSinceMap.has(key)) blockedSinceMap.set(key, log.createdAt);
  }
  for (const item of blockedItems) {
    item.blockedSince = blockedSinceMap.get(String(item._id)) ?? null;
  }

  myWork.sort(sortByPriorityThenUrgency);
  const nextUp = [...myWork].sort(sortByUrgencyThenPriority).slice(0, NEXT_UP_CAP);
  inProgress.sort(sortByPriorityThenUrgency);
  waitingForReview.sort(
    (a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime()
  );
  changesRequested.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  blockedItems.sort(
    (a, b) =>
      new Date(a.blockedSince ?? a.updatedAt).getTime() -
      new Date(b.blockedSince ?? b.updatedAt).getTime()
  );
  overdueItems.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  dueSoonItems.sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""));
  recentlyCompleted.sort(
    (a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
  );

  // Activity — scoped to targetId IN (my currently-fetched work items), not
  // to who performed the action, per Part 15: "activity related to the
  // current employee's Work Items" includes a reviewer approving or
  // requesting changes on work assigned to this employee, not just actions
  // this employee personally took. Work item labels come straight from the
  // `workItems` array already in memory — no extra lookup query needed,
  // since every possible targetId here is already one of the employee's
  // own fetched items.
  const myWorkItemIds = workItems.map((i) => String(i._id));
  const labelMap = new Map(workItems.map((i) => [String(i._id), { workItemId: i.workItemId, title: i.title }]));

  const [recentActivityLogs, todayLogs] = myWorkItemIds.length
    ? await Promise.all([
        ActivityLogModel.find({ targetType: "ITWorkItem", targetId: { $in: myWorkItemIds } })
          .sort({ createdAt: -1 })
          .limit(RECENT_ACTIVITY_LIMIT),
        ActivityLogModel.find({
          targetType: "ITWorkItem",
          targetId: { $in: myWorkItemIds },
          createdAt: { $gte: startOfToday() },
        }).sort({ createdAt: -1 }),
      ])
    : [[], []];

  const actorIds = Array.from(new Set(todayLogs.map((l) => String(l.actorId))));
  const actors = actorIds.length
    ? await UserModel.find({ _id: { $in: actorIds } }).select("fullName")
    : [];
  const actorNameMap = new Map(actors.map((a) => [String(a._id), a.fullName]));

  const recentActivity = recentActivityLogs.map((log) => {
    const wi = labelMap.get(String(log.targetId));
    return {
      id: toId(log),
      action: log.action,
      actorEmployeeId: log.actorEmployeeId,
      workItemId: String(log.targetId),
      workItemDisplayId: wi?.workItemId ?? null,
      workItemTitle: wi?.title ?? null,
      createdAt: log.createdAt,
    };
  });

  const todayActivity = todayLogs.map((log) => {
    const wi = labelMap.get(String(log.targetId));
    return {
      id: toId(log),
      actorFullName: actorNameMap.get(String(log.actorId)) ?? log.actorEmployeeId,
      action: log.action,
      workItemId: String(log.targetId),
      workItemDisplayId: wi?.workItemId ?? null,
      workItemTitle: wi?.title ?? null,
      createdAt: log.createdAt,
    };
  });

  // Today's Summary — activity counts, never a score. Derived from the same
  // date-bounded log rows already fetched above; "started" reads the
  // status-change metadata (`to: "IN_PROGRESS"`) recorded by
  // changeWorkItemStatus, not a guess.
  let startedToday = 0;
  let submittedForReviewToday = 0;
  let completedToday = 0;
  let commentsToday = 0;
  let attachmentsToday = 0;
  for (const log of todayLogs) {
    if (
      log.action === ACTIVITY_ACTIONS.IT_WORK_ITEM_STATUS_CHANGED &&
      (log.metadata as { to?: string } | undefined)?.to === IT_WORK_ITEM_STATUS.IN_PROGRESS
    ) {
      startedToday += 1;
    } else if (log.action === ACTIVITY_ACTIONS.IT_WORK_ITEM_SUBMITTED_FOR_REVIEW) {
      submittedForReviewToday += 1;
    } else if (log.action === ACTIVITY_ACTIONS.IT_WORK_ITEM_REVIEW_APPROVED) {
      completedToday += 1;
    } else if (log.action === ACTIVITY_ACTIONS.IT_WORK_ITEM_COMMENTED) {
      commentsToday += 1;
    } else if (log.action === ACTIVITY_ACTIONS.IT_WORK_ITEM_ATTACHMENT_UPLOADED) {
      attachmentsToday += 1;
    }
  }

  return {
    summary: {
      myActive: myWork.length,
      inReview: inReviewCount,
      blocked: blockedCount,
      overdue: overdueCount,
      dueSoon: dueSoonCount,
      completedRecently: completedRecentlyCount,
      pendingProposals: pendingProposals.length,
    },
    myWork: myWork.slice(0, DASHBOARD_LIST_CAP),
    pendingProposals: pendingProposals
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, DASHBOARD_LIST_CAP),
    nextUp,
    inProgress: inProgress.slice(0, DASHBOARD_LIST_CAP),
    waitingForReview: waitingForReview.slice(0, DASHBOARD_LIST_CAP),
    changesRequested: changesRequested.slice(0, DASHBOARD_LIST_CAP),
    blocked: blockedItems.slice(0, DASHBOARD_LIST_CAP),
    overdue: overdueItems.slice(0, DASHBOARD_LIST_CAP),
    dueSoon: dueSoonItems.slice(0, DASHBOARD_LIST_CAP),
    recentlyCompleted: recentlyCompleted.slice(0, DASHBOARD_LIST_CAP),
    recentActivity,
    today: {
      summary: {
        startedToday,
        submittedForReviewToday,
        completedToday,
        commentsToday,
        attachmentsToday,
      },
      activity: todayActivity,
    },
    meta: {
      recentCompletedWindowDays: RECENT_COMPLETED_WINDOW_DAYS,
      dueSoonWindowDays: DUE_SOON_WINDOW_DAYS,
      generatedAt: new Date(),
    },
  };
}
