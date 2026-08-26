import { ApiError } from "../../shared/errors/ApiError";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { recordActivity } from "../activity-log/activity-log.service";
import { toId } from "../../shared/utils/toId";
import { UserModel } from "../user/user.model";
import { ITProductModel } from "./it-product.model";
import { ITProjectModel, IITProject } from "./it-project.model";
import { ITWorkItemModel } from "./it-work-item.model";
import { isValidProjectStatusTransition } from "./it-project.util";
import { ITProjectStatus, ITProjectPriority } from "../../shared/constants/itProjectTypes";

const LABEL = "Project";

interface Actor {
  id: string;
  employeeId: string;
}

interface ProjectFilters {
  product?: string;
  status?: ITProjectStatus;
  priority?: ITProjectPriority;
  owner?: string;
}

interface ProjectFieldsInput {
  name: string;
  description?: string;
  product: string;
  owner: string;
  priority: ITProjectPriority;
  startDate: string | null;
  targetDate: string | null;
}

const POPULATE = [
  { path: "product", select: "name isActive" },
  { path: "owner", select: "fullName employeeId" },
];

export function listProjects(filters: ProjectFilters) {
  const query: Record<string, unknown> = {};
  if (filters.product) query.product = filters.product;
  if (filters.status) query.status = filters.status;
  if (filters.priority) query.priority = filters.priority;
  if (filters.owner) query.owner = filters.owner;

  return ITProjectModel.find(query).sort({ createdAt: -1 }).populate(POPULATE);
}

export async function assertProjectExists(id: string): Promise<IITProject> {
  const project = await ITProjectModel.findById(id).populate(POPULATE);
  if (!project) {
    throw new ApiError(404, `${LABEL} not found`);
  }
  return project;
}

// A Project may never be created into (or moved into) a Product that
// doesn't exist or is inactive — existing Projects under a since-deactivated
// Product are left untouched and stay visible, per the Phase 1B brief.
async function assertProductUsable(productId: string): Promise<void> {
  const product = await ITProductModel.findById(productId).select("isActive");
  if (!product) {
    throw new ApiError(404, "Product not found");
  }
  if (!product.isActive) {
    throw new ApiError(422, "Cannot create or move a project into an inactive product");
  }
}

async function assertOwnerExists(ownerId: string): Promise<void> {
  const owner = await UserModel.findById(ownerId).select("_id");
  if (!owner) {
    throw new ApiError(404, "Owner not found");
  }
}

export async function createProject(
  actor: Actor,
  input: ProjectFieldsInput & { status: ITProjectStatus }
): Promise<IITProject> {
  await assertProductUsable(input.product);
  await assertOwnerExists(input.owner);

  const project = await ITProjectModel.create({
    name: input.name,
    description: input.description ?? null,
    product: input.product,
    owner: input.owner,
    priority: input.priority,
    status: input.status,
    startDate: input.startDate,
    targetDate: input.targetDate,
    createdBy: actor.id,
  });
  await project.populate(POPULATE);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_PROJECT_CREATED,
    targetType: "ITProject",
    targetId: toId(project),
    metadata: { name: input.name, product: input.product },
  });

  return project;
}

// Status is intentionally not accepted here (see it-project.validation.ts)
// — status only ever moves through changeProjectStatus below, where every
// transition is checked against it-project.util.ts's transition table.
export async function updateProject(
  actor: Actor,
  id: string,
  input: ProjectFieldsInput
): Promise<IITProject> {
  const project = await ITProjectModel.findById(id);
  if (!project) {
    throw new ApiError(404, `${LABEL} not found`);
  }

  const previous = {
    name: project.name,
    description: project.description,
    product: String(project.product),
    owner: String(project.owner),
    priority: project.priority,
    startDate: project.startDate,
    targetDate: project.targetDate,
  };

  if (previous.product !== input.product) {
    await assertProductUsable(input.product);
  }
  if (previous.owner !== input.owner) {
    await assertOwnerExists(input.owner);
  }

  project.name = input.name;
  project.description = input.description ?? null;
  project.product = input.product as never;
  project.owner = input.owner as never;
  project.priority = input.priority;
  project.startDate = input.startDate;
  project.targetDate = input.targetDate;
  await project.save();
  await project.populate(POPULATE);

  // Precise auditing: priority/owner changes get their own action so the
  // activity log reads as "priority changed X -> Y" rather than a generic
  // "updated" for the two fields management most cares about tracking.
  if (previous.priority !== input.priority) {
    await recordActivity({
      actor,
      action: ACTIVITY_ACTIONS.IT_PROJECT_PRIORITY_CHANGED,
      targetType: "ITProject",
      targetId: toId(project),
      metadata: { from: previous.priority, to: input.priority },
    });
  }
  if (previous.owner !== input.owner) {
    await recordActivity({
      actor,
      action: ACTIVITY_ACTIONS.IT_PROJECT_OWNER_CHANGED,
      targetType: "ITProject",
      targetId: toId(project),
      metadata: { from: previous.owner, to: input.owner },
    });
  }
  const otherFieldsChanged =
    previous.name !== input.name ||
    previous.description !== (input.description ?? null) ||
    previous.product !== input.product ||
    previous.startDate !== input.startDate ||
    previous.targetDate !== input.targetDate;
  if (otherFieldsChanged) {
    await recordActivity({
      actor,
      action: ACTIVITY_ACTIONS.IT_PROJECT_UPDATED,
      targetType: "ITProject",
      targetId: toId(project),
      metadata: { name: input.name },
    });
  }

  return project;
}

export async function changeProjectStatus(
  actor: Actor,
  id: string,
  status: ITProjectStatus
): Promise<IITProject> {
  const project = await ITProjectModel.findById(id);
  if (!project) {
    throw new ApiError(404, `${LABEL} not found`);
  }

  if (!isValidProjectStatusTransition(project.status, status)) {
    throw new ApiError(
      409,
      `Cannot move a project from ${project.status} to ${status}`
    );
  }

  const previousStatus = project.status;
  project.status = status;
  await project.save();
  await project.populate(POPULATE);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_PROJECT_STATUS_CHANGED,
    targetType: "ITProject",
    targetId: toId(project),
    metadata: { from: previousStatus, to: status },
  });

  return project;
}

// Genuine hard delete, itManage-only (see it-project.routes.ts) — Projects
// carry no compliance-sensitive data the way Employee records do, so unlike
// Products (activate/deactivate only) a real delete is offered here. Any
// Work Item still pointing at this Project is unlinked first (set to
// project: null), never left dangling — `project: null` is already a
// fully-supported "No Project" state everywhere in the UI, so this can
// never reproduce the crash class the null Product/owner references
// caused. The Work Items themselves are NOT deleted.
export async function deleteProject(actor: Actor, id: string): Promise<void> {
  const project = await ITProjectModel.findById(id);
  if (!project) {
    throw new ApiError(404, `${LABEL} not found`);
  }

  await ITWorkItemModel.updateMany({ project: id }, { project: null });
  await project.deleteOne();

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_PROJECT_DELETED,
    targetType: "ITProject",
    targetId: id,
    metadata: { name: project.name },
  });
}
