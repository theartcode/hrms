import mongoose from "mongoose";
import { env } from "../shared/config/env";
import { logger } from "../shared/utils/logger";
import { hashSecret } from "../shared/utils/password";
import { ROLES, Role } from "../shared/constants/roles";
import { UserModel, IUser } from "../modules/user/user.model";
import { DepartmentModel, IDepartment } from "../modules/department/department.model";
import { refreshDepartmentHeadsCache } from "../modules/department/department.cache";
import { ITProductModel } from "../modules/it-work-management/it-product.model";
import { ITProjectModel } from "../modules/it-work-management/it-project.model";
import { ITWorkItemModel } from "../modules/it-work-management/it-work-item.model";
import { ITWorkItemCommentModel } from "../modules/it-work-management/it-work-item-comment.model";
import { NotificationModel } from "../modules/notifications/notification.model";
import { ActivityLogModel } from "../modules/activity-log/activity-log.model";
import { grantReadOnlyAccess } from "../modules/it-work-management/it-work-management-settings.service";
import { createItProduct } from "../modules/it-work-management/it-product.service";
import { createProject, changeProjectStatus } from "../modules/it-work-management/it-project.service";
import {
  createWorkItem,
  changeWorkItemStatus,
  submitWorkItemForReview,
  reviewWorkItem,
} from "../modules/it-work-management/it-work-item.service";
import { addComment } from "../modules/it-work-management/it-work-item-comment.service";
import { IT_WORK_ITEM_STATUS, ITWorkItemStatus } from "../shared/constants/itWorkItemTypes";
import { IT_PROJECT_PRIORITY } from "../shared/constants/itProjectTypes";
import {
  IT_DEPARTMENT_NAME,
  RISK_TEST_PROJECT_KEYS,
  SAMPLE_COMMENTS,
  SAMPLE_PASSWORD,
  SAMPLE_PRODUCTS,
  SAMPLE_PROJECTS,
  SAMPLE_USERS,
  SAMPLE_WORK_ITEMS,
  SampleProductKey,
  SampleProjectKey,
  SampleUserKey,
  SampleUserSpec,
  SampleWorkItemSpec,
  SYNTHETIC_HEAD_SPEC,
} from "./it-work-management-sample-data";

// Sample-data seed for manually testing the IT Head / Team Member / CEO
// dashboards built in Phases 1E-A through 1E-C. Everything below either (a)
// looks up an existing record by a stable natural key and reuses it
// (idempotent — safe to re-run), or (b) creates it via the SAME service
// functions the real HTTP routes call, so every side effect (Activity Log
// entries, Notifications) is generated exactly as it would be for a real
// user action — nothing here writes a fake Activity Log or Notification
// document directly. See the accompanying report for exactly what this
// does and does not touch.

interface Actor {
  id: string;
  role: Role;
  employeeId: string;
}

function toActor(user: IUser): Actor {
  return { id: String(user._id), role: user.role, employeeId: user.employeeId };
}

async function ensureSampleUser(spec: SampleUserSpec): Promise<IUser> {
  const existing = await UserModel.findOne({ email: spec.email });
  if (existing) return existing;

  const passwordHash = await hashSecret(SAMPLE_PASSWORD);
  return UserModel.create({
    employeeId: spec.employeeId,
    email: spec.email,
    passwordHash,
    role: ROLES.EMPLOYEE,
    fullName: spec.fullName,
    phone: spec.phone,
    joiningDate: new Date("2026-01-05"),
    mustChangePassword: false,
  });
}

// Part 4/7 of the brief: reuse a real, already-existing IT department head
// rather than ever creating a synthetic one — a real head's account and
// Department("IT").headEmployeeId are NEVER modified here. The synthetic
// sample head is only created (or reused on a re-run) as a fallback, when
// Department("IT") doesn't exist yet or currently has no head at all.
async function resolveItHead(): Promise<{ dept: IDepartment; headUser: IUser; isSyntheticHead: boolean }> {
  const dept = await DepartmentModel.findOne({ name: new RegExp(`^${IT_DEPARTMENT_NAME}$`, "i") });

  if (dept?.headEmployeeId) {
    const existingHead = await UserModel.findById(dept.headEmployeeId);
    if (existingHead) {
      logger.info(
        `Reusing the existing IT department head as the IT Head actor: ${existingHead.fullName} <${existingHead.email}> — this account is never modified.`
      );
      return { dept, headUser: existingHead, isSyntheticHead: false };
    }
  }

  const headUser = await ensureSampleUser(SYNTHETIC_HEAD_SPEC);
  if (!dept) {
    const created = await DepartmentModel.create({
      name: IT_DEPARTMENT_NAME,
      isActive: true,
      headEmployeeId: headUser._id,
    });
    logger.info(`Created Department "IT" with sample head ${headUser.email}`);
    return { dept: created, headUser, isSyntheticHead: true };
  }
  if (!dept.headEmployeeId) {
    dept.headEmployeeId = headUser._id;
    await dept.save();
    logger.info(`Set Department "IT" head to sample head ${headUser.email}`);
  }
  return { dept, headUser, isSyntheticHead: true };
}

async function ensureDepartmentMembership(user: IUser, departmentId: mongoose.Types.ObjectId) {
  if (!user.department || String(user.department) !== String(departmentId)) {
    user.department = departmentId as never;
    await user.save();
  }
}

type Users = Record<SampleUserKey, IUser>;
type Actors = Record<SampleUserKey, Actor>;

async function seedUsersAndDepartment(): Promise<{
  users: Users;
  actors: Actors;
  deptId: mongoose.Types.ObjectId;
  /** Whether the Head can legally be set as a Work Item's `reviewer` field via assertAssignable (requires being a member of their own department). Always true for the synthetic Head; for a REAL head, only true if their account already happened to have `department` set to IT — never set as a side effect of this seed. When false, `reviewer: "head"` specs fall back to no stored reviewer, though the Head can still always perform the actual review as the manage-tier fallback (see applyExtra). */
  headReviewerEligible: boolean;
}> {
  const { dept, headUser, isSyntheticHead } = await resolveItHead();
  const deptId = dept._id as mongoose.Types.ObjectId;

  const entries = await Promise.all(SAMPLE_USERS.map((spec) => ensureSampleUser(spec)));
  const users = {
    head: headUser,
    ...Object.fromEntries(SAMPLE_USERS.map((spec, i) => [spec.key, entries[i]])),
  } as Users;

  // Only the synthetic Head's own `department` is ever set here — a real
  // person's account is left exactly as it already was.
  if (isSyntheticHead) {
    await ensureDepartmentMembership(users.head, deptId);
  }
  await ensureDepartmentMembership(users.jr1, deptId);
  await ensureDepartmentMembership(users.jr2, deptId);
  await ensureDepartmentMembership(users.jr3, deptId);
  // exec deliberately NOT added to the IT department — they must resolve to
  // "readonly", not "team".

  // isItHead() reads an in-memory cache (department.cache.ts) that's
  // normally warmed at server boot / on login — this standalone script never
  // boots the server, so without this refresh every "manage" tier check
  // below would incorrectly resolve to false.
  await refreshDepartmentHeadsCache();

  const actors = {
    head: toActor(users.head),
    ...Object.fromEntries(SAMPLE_USERS.map((spec) => [spec.key, toActor(users[spec.key])])),
  } as Actors;

  const headReviewerEligible =
    isSyntheticHead || (!!users.head.department && String(users.head.department) === String(deptId));

  return { users, actors, deptId, headReviewerEligible };
}

async function seedReadOnlyAccess(actors: Actors, execUser: IUser): Promise<void> {
  const grantingActor =
    (await UserModel.findOne({ role: { $in: [ROLES.ADMIN, ROLES.SUPER_ADMIN] } }).select(
      "_id employeeId"
    )) ?? null;
  const actor: Actor = grantingActor
    ? { id: String(grantingActor._id), role: ROLES.ADMIN, employeeId: grantingActor.employeeId }
    : actors.head;
  await grantReadOnlyAccess(actor, String(execUser._id));
}

async function seedProducts(actor: Actor): Promise<Record<SampleProductKey, string>> {
  const ids = {} as Record<SampleProductKey, string>;
  for (const spec of SAMPLE_PRODUCTS) {
    const existing = await ITProductModel.findOne({ name: spec.name });
    const id = existing ? existing._id : (await createItProduct(actor, spec.name, spec.description))._id;
    ids[spec.key] = String(id);
  }
  return ids;
}

async function seedProjects(
  actor: Actor,
  actors: Actors,
  productIds: Record<SampleProductKey, string>
): Promise<Record<SampleProjectKey, string>> {
  const ids = {} as Record<SampleProjectKey, string>;
  for (const spec of SAMPLE_PROJECTS) {
    const productId = productIds[spec.product];
    const existing = await ITProjectModel.findOne({ name: spec.name, product: productId });

    if (existing) {
      ids[spec.key] = String(existing._id);
      continue;
    }

    const created = await createProject(actor, {
      name: spec.name,
      description: spec.description,
      product: productId,
      owner: String(actors[spec.owner].id),
      priority: spec.priority,
      status: spec.status,
      startDate: spec.startDate,
      targetDate: spec.targetDate,
    });
    // Only walk the today-transition on first creation — a re-run must not
    // re-fire IT_PROJECT_STATUS_CHANGED / duplicate "today's activity".
    if (spec.transitionToday) {
      await changeProjectStatus(actor, String(created._id), spec.transitionToday);
    }
    ids[spec.key] = String(created._id);
  }
  return ids;
}

const GENERIC_PATH: ITWorkItemStatus[] = [
  IT_WORK_ITEM_STATUS.ANALYSIS,
  IT_WORK_ITEM_STATUS.PLANNED,
  IT_WORK_ITEM_STATUS.ASSIGNED,
  IT_WORK_ITEM_STATUS.IN_PROGRESS,
];

async function walkGenericPath(headActor: Actor, workItemId: string, stopAt: ITWorkItemStatus): Promise<void> {
  const stopIndex = GENERIC_PATH.indexOf(stopAt);
  if (stopIndex === -1) return; // stopAt is REQUESTED — no movement
  for (let i = 0; i <= stopIndex; i++) {
    await changeWorkItemStatus(headActor, workItemId, GENERIC_PATH[i]);
  }
}

async function applyExtra(spec: SampleWorkItemSpec, workItemId: string, actors: Actors): Promise<void> {
  const assigneeActor = spec.assignee ? actors[spec.assignee] : null;
  const reviewerActor = spec.reviewer ? actors[spec.reviewer] : null;

  switch (spec.extra) {
    case "none":
      return;
    case "blocked":
      await changeWorkItemStatus(
        assigneeActor ?? actors.head,
        workItemId,
        IT_WORK_ITEM_STATUS.BLOCKED,
        spec.extraReason
      );
      return;
    case "cancelled":
      await changeWorkItemStatus(actors.head, workItemId, IT_WORK_ITEM_STATUS.CANCELLED, spec.extraReason);
      return;
    case "inReview":
      await submitWorkItemForReview(assigneeActor ?? actors.head, workItemId);
      return;
    case "reviewRequestChanges":
      await submitWorkItemForReview(assigneeActor ?? actors.head, workItemId);
      await reviewWorkItem(reviewerActor ?? actors.head, workItemId, "REQUEST_CHANGES", spec.extraReason);
      return;
    case "review":
      await submitWorkItemForReview(assigneeActor ?? actors.head, workItemId);
      await reviewWorkItem(reviewerActor ?? actors.head, workItemId, "APPROVE");
      if (spec.backdateCompletedDays) {
        const backdate = new Date();
        backdate.setDate(backdate.getDate() - spec.backdateCompletedDays);
        // The only direct-write in this whole seed: reviewWorkItem() always
        // stamps completedAt with "now" (correctly — that's real behavior).
        // To get a realistic OLD completed item for the dashboards' 7-day
        // window test (Part 17/21 of the brief), completedAt is backdated
        // here, after the real approval already ran through the full
        // workflow. This changes no business logic — it only makes one
        // already-correct field's value look older, the way it would in a
        // system that had actually been running for weeks.
        await ITWorkItemModel.findByIdAndUpdate(workItemId, { completedAt: backdate });
      }
      return;
  }
}

// input.reviewer must pass assertAssignable (the reviewer has to be a
// member of the Head's own department) — always true for the synthetic
// Head, only sometimes true for a reused real Head (see
// headReviewerEligible). When ineligible, the stored `reviewer` field
// falls back to null for that item; the Head can still always perform the
// actual review via the manage-tier fallback in reviewWorkItem() (see
// applyExtra), so the workflow itself is unaffected either way.
function resolveReviewerId(spec: SampleWorkItemSpec, actors: Actors, headReviewerEligible: boolean): string | null {
  if (!spec.reviewer) return null;
  if (spec.reviewer === "head" && !headReviewerEligible) return null;
  return actors[spec.reviewer].id;
}

async function seedWorkItems(
  actors: Actors,
  productIds: Record<SampleProductKey, string>,
  projectIds: Record<SampleProjectKey, string>,
  headReviewerEligible: boolean
): Promise<{ created: number; reused: number }> {
  let created = 0;
  let reused = 0;

  for (const spec of SAMPLE_WORK_ITEMS) {
    const productId = productIds[spec.product];
    const existing = await ITWorkItemModel.findOne({ title: spec.title, product: productId });
    if (existing) {
      reused += 1;
      continue;
    }

    const workItem = await createWorkItem(actors.head, {
      title: spec.title,
      description: spec.description,
      product: productId,
      project: spec.project ? projectIds[spec.project] : null,
      workType: spec.workType,
      assignedTo: spec.assignee ? actors[spec.assignee].id : null,
      reviewer: resolveReviewerId(spec, actors, headReviewerEligible),
      priority: spec.priority,
      startDate: null,
      dueDate: spec.dueDate,
    });

    await walkGenericPath(actors.head, String(workItem._id), spec.stopAt);
    await applyExtra(spec, String(workItem._id), actors);
    created += 1;
  }

  return { created, reused };
}

async function seedComments(
  actors: Actors,
  productIds: Record<SampleProductKey, string>
): Promise<{ created: number; reused: number }> {
  let created = 0;
  let reused = 0;

  for (const spec of SAMPLE_COMMENTS) {
    const workItemSpec = SAMPLE_WORK_ITEMS.find((w) => w.key === spec.workItemKey);
    if (!workItemSpec) continue;
    const productId = productIds[workItemSpec.product];
    const workItem = await ITWorkItemModel.findOne({ title: workItemSpec.title, product: productId });
    if (!workItem) continue;

    const existing = await ITWorkItemCommentModel.findOne({
      workItem: workItem._id,
      author: actors[spec.author].id,
      body: spec.body,
    });
    if (existing) {
      reused += 1;
      continue;
    }

    await addComment(actors[spec.author], String(workItem._id), spec.body);
    created += 1;
  }

  return { created, reused };
}

async function printVerificationReport(users: Users): Promise<void> {
  const productDocs = await ITProductModel.find({
    name: { $in: SAMPLE_PRODUCTS.map((p) => p.name) },
  }).select("_id");
  const workItemFilter = { product: { $in: productDocs.map((p) => p._id) } };

  const [productCount, projectCount, workItemDocs, activityCount] = await Promise.all([
    ITProductModel.countDocuments({ name: { $in: SAMPLE_PRODUCTS.map((p) => p.name) } }),
    ITProjectModel.countDocuments({ name: { $in: SAMPLE_PROJECTS.map((p) => p.name) } }),
    ITWorkItemModel.find(workItemFilter).select("_id"),
    ActivityLogModel.countDocuments({ targetType: { $in: ["ITWorkItem", "ITProject"] } }),
  ]);

  const commentCount = await ITWorkItemCommentModel.countDocuments({
    workItem: { $in: workItemDocs.map((w) => w._id) },
  });

  const sampleUserIds = Object.values(users).map((u) => u._id);
  const notificationCount = await NotificationModel.countDocuments({ user: { $in: sampleUserIds } });

  const statusCounts = await ITWorkItemModel.aggregate<{ _id: string; count: number }>([
    { $match: workItemFilter },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);
  const priorityCounts = await ITWorkItemModel.aggregate<{ _id: string; count: number }>([
    { $match: workItemFilter },
    { $group: { _id: "$priority", count: { $sum: 1 } } },
  ]);

  logger.info("---- IT Work Management sample data — verification ----");
  logger.info(`Products: ${productCount} (expected 7)`);
  logger.info(`Projects: ${projectCount} (expected 10)`);
  logger.info(`Work Items: ${workItemDocs.length} (expected 35)`);
  logger.info(`Comments on sample Work Items: ${commentCount} (expected ~13)`);
  logger.info(`Notifications delivered to the IT Head + 4 sample users: ${notificationCount}`);
  logger.info(`Activity Log entries (IT Work Item + IT Project): ${activityCount}`);
  logger.info("Status distribution:");
  for (const status of Object.values(IT_WORK_ITEM_STATUS)) {
    const row = statusCounts.find((r) => r._id === status);
    logger.info(`  ${status} = ${row?.count ?? 0}`);
  }
  logger.info("Priority distribution:");
  for (const priority of Object.values(IT_PROJECT_PRIORITY)) {
    const row = priorityCounts.find((r) => r._id === priority);
    logger.info(`  ${priority} = ${row?.count ?? 0}`);
  }
  logger.info(
    `Risk test projects — overdue: ${RISK_TEST_PROJECT_KEYS.overdue}, blocked: ${RISK_TEST_PROJECT_KEYS.blocked}, ` +
      `target date passed: ${RISK_TEST_PROJECT_KEYS.targetDatePassed}, healthy: ${RISK_TEST_PROJECT_KEYS.healthy}`
  );
  logger.info("--------------------------------------------------------");
}

async function main(): Promise<void> {
  logger.info(`Connecting to ${env.mongoUri.replace(/\/\/[^@]+@/, "//<redacted>@")}`);
  await mongoose.connect(env.mongoUri);

  const { users, actors, headReviewerEligible } = await seedUsersAndDepartment();
  await seedReadOnlyAccess(actors, users.exec);

  const productIds = await seedProducts(actors.head);
  const projectIds = await seedProjects(actors.head, actors, productIds);
  const workItemResult = await seedWorkItems(actors, productIds, projectIds, headReviewerEligible);
  const commentResult = await seedComments(actors, productIds);

  logger.info(`Work Items: ${workItemResult.created} created, ${workItemResult.reused} already existed (reused)`);
  logger.info(`Comments: ${commentResult.created} created, ${commentResult.reused} already existed (reused)`);
  if (!headReviewerEligible) {
    logger.info(
      "Note: the IT Head's account isn't a member of its own department, so Work Items that " +
        "would have had the Head as their stored `reviewer` were created with no reviewer set instead " +
        "(the Head still performed every review action itself, via the manage-tier fallback — nothing was skipped)."
    );
  }

  logger.info("Sample users created for this seed (password for all: " + SAMPLE_PASSWORD + "):");
  for (const spec of SAMPLE_USERS) {
    logger.info(`  ${spec.fullName} — ${spec.email}`);
  }
  logger.info(`IT Head used: ${users.head.fullName} <${users.head.email}>`);

  await printVerificationReport(users);

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Failed to seed IT Work Management sample data");
    process.exit(1);
  });
