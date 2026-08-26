import { ApiError } from "../../shared/errors/ApiError";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { recordActivity } from "../activity-log/activity-log.service";
import { toId } from "../../shared/utils/toId";
import { CounterModel } from "../../shared/models/counter.model";
import { Role } from "../../shared/constants/roles";
import { listAssignableEmployees } from "../employee/employee.service";
import { ITProductModel } from "./it-product.model";
import { ITProjectModel } from "./it-project.model";
import { ITWorkItemModel, IITWorkItem } from "./it-work-item.model";
import { getItAccessTier } from "./it-access";
import { getGenericStatusTransitions } from "./it-work-item.util";
import { IT_WORK_ITEM_STATUS, ITWorkItemStatus, ITWorkType } from "../../shared/constants/itWorkItemTypes";
import { ITProjectPriority } from "../../shared/constants/itProjectTypes";
import { ActivityLogModel } from "../activity-log/activity-log.model";
import {
  notifyBlocked,
  notifyProposalApproved,
  notifyProposalChangesRequested,
  notifyProposalRejected,
  notifyReviewDecision,
  notifySubmittedForReview,
  notifyUnblocked,
  notifyWorkItemAssigned,
  notifyWorkItemProposed,
} from "./it-work-item-notifications";

const LABEL = "Work item";

interface Actor {
  id: string;
  role: Role;
  employeeId: string;
}

const WORK_ITEM_ID_PREFIX = "ITW-";
const WORK_ITEM_ID_PAD = 4;
const WORK_ITEM_ID_COUNTER = "itWorkItemId";

// Same atomic $inc counter mechanism as task.service.ts's getNextTaskId —
// a brand-new collection, so no pre-existing "ITW-####" data to reconcile.
async function getNextWorkItemId(): Promise<string> {
  const counter = await CounterModel.findByIdAndUpdate(
    WORK_ITEM_ID_COUNTER,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${WORK_ITEM_ID_PREFIX}${String(counter!.seq).padStart(WORK_ITEM_ID_PAD, "0")}`;
}

const POPULATE = [
  { path: "product", select: "name isActive" },
  { path: "project", select: "name" },
  { path: "proposedBy", select: "fullName employeeId" },
  { path: "assignedTo", select: "fullName employeeId" },
  { path: "reviewer", select: "fullName employeeId" },
];

// Duplicated in spirit from it-project.service.ts's own assertProductUsable
// rather than imported from it, deliberately — keeps this already-verified
// Phase 1B file untouched rather than refactoring it mid-phase. See the
// Phase 1C-A report.
async function assertProductUsable(productId: string): Promise<void> {
  const product = await ITProductModel.findById(productId).select("isActive");
  if (!product) {
    throw new ApiError(404, "Product not found");
  }
  if (!product.isActive) {
    throw new ApiError(422, "Cannot create or move a work item into an inactive product");
  }
}

async function assertProjectBelongsToProduct(projectId: string, productId: string): Promise<void> {
  const project = await ITProjectModel.findById(projectId).select("product");
  if (!project) {
    throw new ApiError(404, "Project not found");
  }
  if (String(project.product) !== productId) {
    throw new ApiError(422, "Selected project does not belong to the selected product");
  }
}

// The assignee/reviewer must be someone the actor is actually allowed to
// hand IT work to — reuses GET /employees/assignable's own scoping
// (Admin/Super Admin: anyone; a Department Head: their department's
// members only) rather than reimplementing it. For an IT Head this
// naturally resolves to "IT department members" since that's the
// department they head — no IT-specific duplication needed.
async function assertAssignable(actor: Actor, userId: string, label: string): Promise<void> {
  const assignable = await listAssignableEmployees(actor);
  if (!assignable.some((e) => e.id === userId)) {
    throw new ApiError(422, `${label} is not a valid choice for this actor`);
  }
}

interface WorkItemFilters {
  product?: string;
  project?: string;
  workType?: ITWorkType;
  priority?: ITProjectPriority;
  status?: string;
  assignedTo?: string;
}

export async function listWorkItems(actor: Actor, filters: WorkItemFilters) {
  const tier = await getItAccessTier(actor);
  const query: Record<string, unknown> = {};
  if (filters.product) query.product = filters.product;
  if (filters.project) query.project = filters.project;
  if (filters.workType) query.workType = filters.workType;
  if (filters.priority) query.priority = filters.priority;
  if (filters.status) query.status = filters.status;
  if (filters.assignedTo) query.assignedTo = filters.assignedTo;

  // A team member only ever sees work items where they're the assignee OR
  // the named reviewer — Phase 1C-B's review workflow means a team member
  // can be asked to review someone else's item (see assertCanReview),
  // which needs read access too, not just execution access. This
  // overrides (not merges with) any assignedTo filter they pass, so query
  // manipulation can't be used to browse someone else's unrelated work.
  if (tier === "team") {
    query.$or = [{ assignedTo: actor.id }, { reviewer: actor.id }];
    delete query.assignedTo;
  }

  return ITWorkItemModel.find(query).sort({ createdAt: -1 }).populate(POPULATE);
}

function isWorkItemVisibleToTeamMember(workItem: IITWorkItem, actorId: string): boolean {
  const isAssignee = !!workItem.assignedTo && String(workItem.assignedTo) === actorId;
  const isReviewer = !!workItem.reviewer && String(workItem.reviewer) === actorId;
  return isAssignee || isReviewer;
}

export async function getWorkItemForActor(actor: Actor, id: string): Promise<IITWorkItem> {
  // Tier/ownership checked BEFORE populate — populate() replaces
  // assignedTo's runtime value with a populated User doc while its static
  // type stays Types.ObjectId, so the raw-id comparison below has to
  // happen first.
  const workItem = await ITWorkItemModel.findById(id);
  if (!workItem) {
    throw new ApiError(404, `${LABEL} not found`);
  }

  const tier = await getItAccessTier(actor);
  if (tier === "team" && !isWorkItemVisibleToTeamMember(workItem, actor.id)) {
    // Same ordering as the existing Task module's own view check (per its
    // documented reasoning): a viewer outside scope gets 403, not a 404
    // that would also mask "does this even exist" — independently
    // reapplied here, not imported.
    throw new ApiError(403, "You do not have permission to view this work item");
  }

  await workItem.populate(POPULATE);
  return workItem;
}

// A lightweight, per-work-item read of the existing Activity Log — not a
// new logging system, just a differently-scoped read path. The existing
// GET /activity endpoint is Admin/Super Admin-only (activity-log.routes.ts),
// which doesn't fit here: an IT Head who's a plain EMPLOYEE role, or a team
// member viewing their own item's history, both need this and neither
// would pass that gate.
export async function listWorkItemActivity(actor: Actor, id: string) {
  await getWorkItemForActor(actor, id); // reuses the same visibility check
  const logs = await ActivityLogModel.find({ targetType: "ITWorkItem", targetId: id }).sort({
    createdAt: -1,
  });
  return logs.map((log) => ({
    id: toId(log),
    action: log.action,
    actorEmployeeId: log.actorEmployeeId,
    metadata: log.metadata ?? null,
    createdAt: log.createdAt,
  }));
}

interface CreateWorkItemInput {
  title: string;
  description?: string;
  product: string;
  project?: string | null;
  workType: ITWorkType;
  assignedTo?: string | null;
  reviewer?: string | null;
  priority: ITProjectPriority;
  startDate: string | null;
  dueDate: string | null;
}

export async function createWorkItem(
  actor: Actor,
  input: CreateWorkItemInput
): Promise<IITWorkItem> {
  await assertProductUsable(input.product);

  const projectId = input.project || null;
  if (projectId) {
    await assertProjectBelongsToProduct(projectId, input.product);
  }
  if (input.assignedTo) {
    await assertAssignable(actor, input.assignedTo, "Assignee");
  }
  if (input.reviewer) {
    await assertAssignable(actor, input.reviewer, "Reviewer");
  }

  const workItemId = await getNextWorkItemId();
  const workItem = await ITWorkItemModel.create({
    workItemId,
    title: input.title,
    description: input.description ?? null,
    product: input.product,
    project: projectId,
    workType: input.workType,
    priority: input.priority,
    status: IT_WORK_ITEM_STATUS.REQUESTED,
    assignedTo: input.assignedTo || null,
    reviewer: input.reviewer || null,
    startDate: input.startDate,
    dueDate: input.dueDate,
    createdBy: actor.id,
  });
  const assignedToId = workItem.assignedTo ? String(workItem.assignedTo) : null;
  await workItem.populate(POPULATE);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_WORK_ITEM_CREATED,
    targetType: "ITWorkItem",
    targetId: toId(workItem),
    metadata: { title: input.title, product: input.product },
  });

  if (assignedToId) {
    await recordActivity({
      actor,
      action: ACTIVITY_ACTIONS.IT_WORK_ITEM_ASSIGNED,
      targetType: "ITWorkItem",
      targetId: toId(workItem),
      metadata: { assignedTo: assignedToId },
    });
    await notifyWorkItemAssigned(actor.id, workItem, assignedToId, false);
  }

  return workItem;
}

interface UpdateWorkItemInput {
  title: string;
  description?: string;
  product: string;
  project?: string | null;
  workType: ITWorkType;
}

// General edit only — title/description/product/project/workType. Never
// touches assignedTo/reviewer/priority/dates (updateWorkItemAssignment
// below) or status (Phase 1C-B) — see it-work-item.validation.ts.
export async function updateWorkItem(
  actor: Actor,
  id: string,
  input: UpdateWorkItemInput
): Promise<IITWorkItem> {
  const workItem = await ITWorkItemModel.findById(id);
  if (!workItem) {
    throw new ApiError(404, `${LABEL} not found`);
  }

  const previousProduct = String(workItem.product);
  if (previousProduct !== input.product) {
    await assertProductUsable(input.product);
  }
  const projectId = input.project || null;
  if (projectId) {
    await assertProjectBelongsToProduct(projectId, input.product);
  }

  workItem.title = input.title;
  workItem.description = input.description ?? null;
  workItem.product = input.product as never;
  workItem.project = projectId as never;
  workItem.workType = input.workType;
  await workItem.save();
  await workItem.populate(POPULATE);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_WORK_ITEM_UPDATED,
    targetType: "ITWorkItem",
    targetId: toId(workItem),
    metadata: { title: input.title },
  });

  return workItem;
}

interface UpdateWorkItemAssignmentInput {
  assignedTo: string | null;
  reviewer: string | null;
  priority: ITProjectPriority;
  startDate: string | null;
  dueDate: string | null;
}

// The management-fields endpoint: assignee, reviewer, priority, dates.
// Route-gated to itManage only (see it-work-item.routes.ts), so "a team
// member cannot assign themselves as reviewer" is satisfied simply by them
// never being able to reach this endpoint at all — no extra field check
// needed.
export async function updateWorkItemAssignment(
  actor: Actor,
  id: string,
  input: UpdateWorkItemAssignmentInput
): Promise<IITWorkItem> {
  const workItem = await ITWorkItemModel.findById(id);
  if (!workItem) {
    throw new ApiError(404, `${LABEL} not found`);
  }

  if (input.assignedTo) {
    await assertAssignable(actor, input.assignedTo, "Assignee");
  }
  if (input.reviewer) {
    await assertAssignable(actor, input.reviewer, "Reviewer");
  }

  const previousAssignedTo = workItem.assignedTo ? String(workItem.assignedTo) : null;
  const newAssignedTo = input.assignedTo || null;

  workItem.assignedTo = newAssignedTo as never;
  workItem.reviewer = input.reviewer as never;
  workItem.priority = input.priority;
  workItem.startDate = input.startDate;
  workItem.dueDate = input.dueDate;
  await workItem.save();
  await workItem.populate(POPULATE);

  if (previousAssignedTo !== newAssignedTo) {
    await recordActivity({
      actor,
      action:
        previousAssignedTo === null
          ? ACTIVITY_ACTIONS.IT_WORK_ITEM_ASSIGNED
          : ACTIVITY_ACTIONS.IT_WORK_ITEM_REASSIGNED,
      targetType: "ITWorkItem",
      targetId: toId(workItem),
      metadata: { from: previousAssignedTo, to: newAssignedTo },
    });
    if (newAssignedTo) {
      await notifyWorkItemAssigned(actor.id, workItem, newAssignedTo, previousAssignedTo !== null);
    }
  } else {
    await recordActivity({
      actor,
      action: ACTIVITY_ACTIONS.IT_WORK_ITEM_UPDATED,
      targetType: "ITWorkItem",
      targetId: toId(workItem),
      metadata: { priority: input.priority },
    });
  }

  return workItem;
}

const CONFLICT_MESSAGE = "This work item's status has already changed — refresh and try again.";

// A team-proposed work item sits at REQUESTED with approvalStatus PENDING
// until the IT Head explicitly approves or rejects it (see proposeWorkItem
// below) — every status-changing entry point is blocked until then, for
// everyone, manage tier included, so approval is always a deliberate,
// visible action rather than something an ordinary status move could
// bypass by accident.
function assertNotPendingApproval(workItem: IITWorkItem): void {
  if (workItem.approvalStatus === "PENDING") {
    throw new ApiError(409, "This work item is awaiting proposal approval and cannot be updated yet");
  }
}

// The generic status endpoint — deliberately cannot reach IN_REVIEW or
// COMPLETED for anyone, itManage actors included (see it-work-item.util.ts's
// getGenericStatusTransitions and the Phase 1C-B report's "management
// override" section). A team member may only move their own assigned item,
// and only through the narrower team-tier subset of the same graph.
export async function changeWorkItemStatus(
  actor: Actor,
  id: string,
  status: ITWorkItemStatus,
  reason?: string
): Promise<IITWorkItem> {
  const current = await ITWorkItemModel.findById(id);
  if (!current) {
    throw new ApiError(404, `${LABEL} not found`);
  }
  assertNotPendingApproval(current);

  const tier = await getItAccessTier(actor);
  const isOwnItem = !!current.assignedTo && String(current.assignedTo) === actor.id;
  if (tier !== "manage" && !(tier === "team" && isOwnItem)) {
    throw new ApiError(403, "You do not have permission to change this work item's status");
  }

  const allowed = getGenericStatusTransitions(tier === "manage" ? "manage" : "team", current.status);
  if (!allowed.includes(status)) {
    throw new ApiError(409, `Cannot move a work item from ${current.status} to ${status}`);
  }

  const update: Record<string, unknown> = { status };
  if (status === IT_WORK_ITEM_STATUS.BLOCKED) {
    update.blockedReason = reason;
  } else if (
    current.status === IT_WORK_ITEM_STATUS.BLOCKED &&
    status === IT_WORK_ITEM_STATUS.IN_PROGRESS
  ) {
    // Resuming clears the live field — the permanent record of why it was
    // blocked stays in the Activity Log entry recorded when it was blocked.
    update.blockedReason = null;
  }
  if (status === IT_WORK_ITEM_STATUS.CANCELLED) {
    update.cancelReason = reason;
  }

  // Optimistic concurrency: only matches if status is still what was just
  // read. A concurrent change (e.g. someone cancels it in another tab
  // while this request is in flight) makes this a no-match — a clean 409,
  // not a silent clobber of whatever the other request did. No locking
  // needed for this; MongoDB's atomic findOneAndUpdate is sufficient.
  const workItem = await ITWorkItemModel.findOneAndUpdate(
    { _id: id, status: current.status },
    update,
    { new: true }
  ).populate(POPULATE);

  if (!workItem) {
    throw new ApiError(409, CONFLICT_MESSAGE);
  }

  const action =
    status === IT_WORK_ITEM_STATUS.BLOCKED
      ? ACTIVITY_ACTIONS.IT_WORK_ITEM_BLOCKED
      : status === IT_WORK_ITEM_STATUS.CANCELLED
        ? ACTIVITY_ACTIONS.IT_WORK_ITEM_CANCELLED
        : ACTIVITY_ACTIONS.IT_WORK_ITEM_STATUS_CHANGED;

  await recordActivity({
    actor,
    action,
    targetType: "ITWorkItem",
    targetId: id,
    metadata: { from: current.status, to: status, reason: reason ?? null },
  });

  const reviewerId = current.reviewer ? String(current.reviewer) : null;
  const assigneeId = current.assignedTo ? String(current.assignedTo) : null;
  if (status === IT_WORK_ITEM_STATUS.BLOCKED) {
    await notifyBlocked(actor.id, workItem, reviewerId, reason ?? "");
  } else if (current.status === IT_WORK_ITEM_STATUS.BLOCKED && status === IT_WORK_ITEM_STATUS.IN_PROGRESS) {
    await notifyUnblocked(actor.id, workItem, assigneeId);
  }

  return workItem;
}

// Assignee submits their own work, OR management submits on someone's
// behalf — per §6 of the brief ("actor is the assigned employee OR
// authorized management user"). Deliberately does NOT require
// workItem.reviewer to be set: Admin/Super Admin/IT Head can always review
// as a fallback (see assertCanReview below), so a hard requirement here
// would block real usage without closing any actual gap.
export async function submitWorkItemForReview(actor: Actor, id: string): Promise<IITWorkItem> {
  const current = await ITWorkItemModel.findById(id);
  if (!current) {
    throw new ApiError(404, `${LABEL} not found`);
  }
  assertNotPendingApproval(current);

  const tier = await getItAccessTier(actor);
  const isOwnItem = !!current.assignedTo && String(current.assignedTo) === actor.id;
  if (tier !== "manage" && !(tier === "team" && isOwnItem)) {
    throw new ApiError(403, "You do not have permission to submit this work item for review");
  }

  if (current.status !== IT_WORK_ITEM_STATUS.IN_PROGRESS) {
    throw new ApiError(409, "Only a work item that is In Progress can be submitted for review");
  }

  const workItem = await ITWorkItemModel.findOneAndUpdate(
    { _id: id, status: IT_WORK_ITEM_STATUS.IN_PROGRESS },
    { status: IT_WORK_ITEM_STATUS.IN_REVIEW, reviewNote: null },
    { new: true }
  ).populate(POPULATE);

  if (!workItem) {
    throw new ApiError(409, CONFLICT_MESSAGE);
  }

  const reviewerId = current.reviewer ? String(current.reviewer) : null;
  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_WORK_ITEM_SUBMITTED_FOR_REVIEW,
    targetType: "ITWorkItem",
    targetId: id,
    metadata: { reviewer: reviewerId },
  });
  await notifySubmittedForReview(actor.id, workItem, reviewerId);

  return workItem;
}

type ReviewDecision = "APPROVE" | "REQUEST_CHANGES";

// Self-approval prevention (§11) is absolute: checked before — and
// independent of — whether the actor is also the named reviewer or an
// itManage-tier actor. Being both assignee and reviewer does not create an
// exception.
export async function reviewWorkItem(
  actor: Actor,
  id: string,
  decision: ReviewDecision,
  reason?: string
): Promise<IITWorkItem> {
  const current = await ITWorkItemModel.findById(id);
  if (!current) {
    throw new ApiError(404, `${LABEL} not found`);
  }

  if (current.status !== IT_WORK_ITEM_STATUS.IN_REVIEW) {
    throw new ApiError(409, "Only a work item that is In Review can be reviewed");
  }

  const isAssignee = !!current.assignedTo && String(current.assignedTo) === actor.id;
  if (isAssignee) {
    throw new ApiError(403, "You cannot review a work item assigned to yourself");
  }

  // Deliberately tier-gated, not just identity-gated: a readonly viewer
  // (Phase 1C-C's CEO tier) must never be able to review, even in the
  // edge case where they were assigned as the named reviewer (possible
  // today because an Admin's assignment scope is company-wide, unlike an
  // IT Head's — see the Phase 1C-C report). "manage" is always allowed;
  // "team" is allowed only when they're the named reviewer; every other
  // tier, "readonly" included, is rejected regardless of the reviewer
  // field's raw value.
  const tier = await getItAccessTier(actor);
  const isNamedReviewer = !!current.reviewer && String(current.reviewer) === actor.id;
  if (tier !== "manage" && !(tier === "team" && isNamedReviewer)) {
    throw new ApiError(403, "You are not authorized to review this work item");
  }

  const nextStatus =
    decision === "APPROVE" ? IT_WORK_ITEM_STATUS.COMPLETED : IT_WORK_ITEM_STATUS.IN_PROGRESS;

  const update: Record<string, unknown> = { status: nextStatus };
  if (decision === "APPROVE") {
    update.completedAt = new Date();
    update.reviewNote = null;
  } else {
    update.reviewNote = reason;
  }

  const workItem = await ITWorkItemModel.findOneAndUpdate(
    { _id: id, status: IT_WORK_ITEM_STATUS.IN_REVIEW },
    update,
    { new: true }
  ).populate(POPULATE);

  if (!workItem) {
    throw new ApiError(409, CONFLICT_MESSAGE);
  }

  await recordActivity({
    actor,
    action:
      decision === "APPROVE"
        ? ACTIVITY_ACTIONS.IT_WORK_ITEM_REVIEW_APPROVED
        : ACTIVITY_ACTIONS.IT_WORK_ITEM_CHANGES_REQUESTED,
    targetType: "ITWorkItem",
    targetId: id,
    metadata: decision === "APPROVE" ? {} : { reason },
  });

  const assigneeId = current.assignedTo ? String(current.assignedTo) : null;
  await notifyReviewDecision(
    actor.id,
    workItem,
    assigneeId,
    decision,
    decision === "REQUEST_CHANGES" ? reason : undefined
  );

  return workItem;
}

interface ProposeWorkItemInput {
  title: string;
  description?: string;
  product: string;
  project?: string | null;
  workType: ITWorkType;
  priority: ITProjectPriority;
  startDate: string | null;
  dueDate: string | null;
}

// A team member proposing work for themselves — e.g. "planned for next
// week" — without needing itManage. Always self-assigned (there is no
// "propose work for someone else"; that's just ordinary itManage creation)
// and always starts with no reviewer and approvalStatus PENDING, so it sits
// visibly outside the normal tracked pipeline (every status-changing action
// is blocked — see assertNotPendingApproval) until the IT Head explicitly
// approves or rejects it below.
export async function proposeWorkItem(
  actor: Actor,
  input: ProposeWorkItemInput
): Promise<IITWorkItem> {
  const tier = await getItAccessTier(actor);
  if (tier !== "team") {
    throw new ApiError(403, "Only IT team members can propose work items for themselves");
  }

  await assertProductUsable(input.product);
  const projectId = input.project || null;
  if (projectId) {
    await assertProjectBelongsToProduct(projectId, input.product);
  }

  const workItemId = await getNextWorkItemId();
  const workItem = await ITWorkItemModel.create({
    workItemId,
    title: input.title,
    description: input.description ?? null,
    product: input.product,
    project: projectId,
    workType: input.workType,
    priority: input.priority,
    status: IT_WORK_ITEM_STATUS.REQUESTED,
    assignedTo: actor.id,
    reviewer: null,
    startDate: input.startDate,
    dueDate: input.dueDate,
    createdBy: actor.id,
    proposedBy: actor.id,
    approvalStatus: "PENDING",
  });
  await workItem.populate(POPULATE);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_WORK_ITEM_PROPOSED,
    targetType: "ITWorkItem",
    targetId: toId(workItem),
    metadata: { title: input.title, product: input.product },
  });
  await notifyWorkItemProposed(actor.id, workItem);

  return workItem;
}

async function assertManageAndPending(actor: Actor, id: string): Promise<IITWorkItem> {
  const current = await ITWorkItemModel.findById(id);
  if (!current) {
    throw new ApiError(404, `${LABEL} not found`);
  }
  const tier = await getItAccessTier(actor);
  if (tier !== "manage") {
    throw new ApiError(403, "You do not have permission to decide on this proposal");
  }
  if (current.approvalStatus !== "PENDING") {
    throw new ApiError(409, "This work item is not awaiting approval");
  }
  return current;
}

// Clears the PENDING flag and leaves status exactly where it was
// (REQUESTED) — the IT Head then moves it through the ordinary status
// control just like any Head-created item. "Approve" is deliberately not
// also a status jump: it only ever means "this is now part of the tracked
// backlog," matching how every other status transition in this module
// already has its own single, explicit meaning.
export async function approveWorkItemProposal(actor: Actor, id: string): Promise<IITWorkItem> {
  const current = await assertManageAndPending(actor, id);

  const workItem = await ITWorkItemModel.findOneAndUpdate(
    { _id: id, approvalStatus: "PENDING" },
    { approvalStatus: null },
    { new: true }
  ).populate(POPULATE);
  if (!workItem) {
    throw new ApiError(409, CONFLICT_MESSAGE);
  }

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_WORK_ITEM_PROPOSAL_APPROVED,
    targetType: "ITWorkItem",
    targetId: id,
    metadata: {},
  });
  if (current.proposedBy) {
    await notifyProposalApproved(actor.id, workItem, String(current.proposedBy));
  }

  return workItem;
}

// Rejecting moves the item straight to CANCELLED (a proposal is always at
// REQUESTED while PENDING, and REQUESTED -> CANCELLED is already a valid
// manage-tier transition — no new transition rule needed) and clears the
// PENDING flag in the same atomic update.
export async function rejectWorkItemProposal(
  actor: Actor,
  id: string,
  reason: string
): Promise<IITWorkItem> {
  const current = await assertManageAndPending(actor, id);

  const workItem = await ITWorkItemModel.findOneAndUpdate(
    { _id: id, approvalStatus: "PENDING" },
    { approvalStatus: null, status: IT_WORK_ITEM_STATUS.CANCELLED, cancelReason: reason },
    { new: true }
  ).populate(POPULATE);
  if (!workItem) {
    throw new ApiError(409, CONFLICT_MESSAGE);
  }

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_WORK_ITEM_PROPOSAL_REJECTED,
    targetType: "ITWorkItem",
    targetId: id,
    metadata: { reason },
  });
  if (current.proposedBy) {
    await notifyProposalRejected(actor.id, workItem, String(current.proposedBy), reason);
  }

  return workItem;
}

// The middle ground between approve and reject — the proposal stays
// PENDING (status/approvalStatus both untouched), so the Head still has a
// decision to make once it's revised. The note lands in the same
// reviewNote field the post-approval review workflow already uses for
// "live outstanding feedback" — updateProposal below clears it the same
// way submitWorkItemForReview already clears it on a normal resubmission.
export async function requestProposalChanges(
  actor: Actor,
  id: string,
  note: string
): Promise<IITWorkItem> {
  const current = await assertManageAndPending(actor, id);

  const workItem = await ITWorkItemModel.findOneAndUpdate(
    { _id: id, approvalStatus: "PENDING" },
    { reviewNote: note },
    { new: true }
  ).populate(POPULATE);
  if (!workItem) {
    throw new ApiError(409, CONFLICT_MESSAGE);
  }

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_WORK_ITEM_PROPOSAL_CHANGES_REQUESTED,
    targetType: "ITWorkItem",
    targetId: id,
    metadata: { note },
  });
  if (current.proposedBy) {
    await notifyProposalChangesRequested(actor.id, workItem, String(current.proposedBy), note);
  }

  return workItem;
}

interface UpdateProposalInput {
  title: string;
  description?: string;
  product: string;
  project?: string | null;
  workType: ITWorkType;
  priority: ITProjectPriority;
  startDate: string | null;
  dueDate: string | null;
}

// The proposer revising their own still-pending proposal — e.g. after the
// Head used requestProposalChanges above. Deliberately narrower than the
// itManage-only updateWorkItem/updateWorkItemAssignment: only the original
// proposer, and only while it's still PENDING (never once approved — at
// that point it's a normal tracked item and only itManage can edit it,
// same as everything else in this module). Saving clears reviewNote,
// signalling "this addresses the feedback" without requiring a separate
// resubmit action — a proposal has no submit/review step of its own to
// resubmit through.
export async function updateProposal(
  actor: Actor,
  id: string,
  input: UpdateProposalInput
): Promise<IITWorkItem> {
  const current = await ITWorkItemModel.findById(id);
  if (!current) {
    throw new ApiError(404, `${LABEL} not found`);
  }
  if (current.approvalStatus !== "PENDING") {
    throw new ApiError(409, "This work item is not awaiting approval");
  }
  if (!current.proposedBy || String(current.proposedBy) !== actor.id) {
    throw new ApiError(403, "You can only edit your own proposal");
  }

  await assertProductUsable(input.product);
  const projectId = input.project || null;
  if (projectId) {
    await assertProjectBelongsToProduct(projectId, input.product);
  }

  const workItem = await ITWorkItemModel.findOneAndUpdate(
    { _id: id, approvalStatus: "PENDING" },
    {
      title: input.title,
      description: input.description ?? null,
      product: input.product,
      project: projectId,
      workType: input.workType,
      priority: input.priority,
      startDate: input.startDate,
      dueDate: input.dueDate,
      reviewNote: null,
    },
    { new: true }
  ).populate(POPULATE);
  if (!workItem) {
    throw new ApiError(409, CONFLICT_MESSAGE);
  }

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_WORK_ITEM_PROPOSAL_UPDATED,
    targetType: "ITWorkItem",
    targetId: id,
    metadata: { title: input.title },
  });

  return workItem;
}
