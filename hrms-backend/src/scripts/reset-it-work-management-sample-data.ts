import mongoose from "mongoose";
import { env } from "../shared/config/env";
import { logger } from "../shared/utils/logger";
import { UserModel } from "../modules/user/user.model";
import { DepartmentModel } from "../modules/department/department.model";
import { ITProductModel } from "../modules/it-work-management/it-product.model";
import { ITProjectModel } from "../modules/it-work-management/it-project.model";
import { ITWorkItemModel } from "../modules/it-work-management/it-work-item.model";
import { ITWorkItemCommentModel } from "../modules/it-work-management/it-work-item-comment.model";
import { ITWorkItemAttachmentModel } from "../modules/it-work-management/it-work-item-attachment.model";
import { ITWorkManagementSettingsModel } from "../modules/it-work-management/it-work-management-settings.model";
import { NotificationModel } from "../modules/notifications/notification.model";
import { ActivityLogModel } from "../modules/activity-log/activity-log.model";
import {
  IT_DEPARTMENT_NAME,
  SAMPLE_PRODUCTS,
  SAMPLE_PROJECTS,
  SAMPLE_USERS,
  SYNTHETIC_HEAD_SPEC,
} from "./it-work-management-sample-data";

// Removes ONLY the records the seed script identifies by the same stable
// natural keys it uses to create/reuse them (Part 3 of the sample-data
// brief: "clearly document how to reset/remove ONLY sample data"). This is
// a destructive script — it is never run automatically by anything else in
// this codebase, and should only be run deliberately, by a developer, who
// has confirmed MONGO_URI points at the database they intend to clean.
//
// What this does NOT do: delete the Department("IT") document itself (a
// real department named "IT" may legitimately want to keep existing after
// sample data is removed), or touch anything outside the natural-key sets
// below. It only clears Department("IT").headEmployeeId if it currently
// points at the sample IT Head — never a real head.

async function main(): Promise<void> {
  logger.info(`Connecting to ${env.mongoUri.replace(/\/\/[^@]+@/, "//<redacted>@")}`);
  await mongoose.connect(env.mongoUri);

  // The synthetic Head spec is only ever a real document if the seed's
  // resolveItHead() fallback created it (no real department head existed
  // at seed time) — this query finds it if so, and finds nothing if a real
  // person's account was reused as Head instead, which is exactly the
  // point: a real head is never touched by this reset.
  const sampleUserDocs = await UserModel.find({
    email: { $in: [...SAMPLE_USERS.map((u) => u.email), SYNTHETIC_HEAD_SPEC.email] },
  }).select("_id email fullName");
  const sampleUserIds = sampleUserDocs.map((u) => u._id);
  const syntheticHeadDoc = sampleUserDocs.find((u) => u.email === SYNTHETIC_HEAD_SPEC.email);

  const productDocs = await ITProductModel.find({
    name: { $in: SAMPLE_PRODUCTS.map((p) => p.name) },
  }).select("_id");
  const productIds = productDocs.map((p) => p._id);

  const projectDocs = await ITProjectModel.find({
    name: { $in: SAMPLE_PROJECTS.map((p) => p.name) },
    product: { $in: productIds },
  }).select("_id");
  const projectIds = projectDocs.map((p) => p._id);

  const workItemDocs = await ITWorkItemModel.find({ product: { $in: productIds } }).select("_id");
  const workItemIds = workItemDocs.map((w) => w._id);

  const settingsDoc = await ITWorkManagementSettingsModel.findOne({ key: "singleton" }).select("_id");

  const sampleEmployeeIds = [...SAMPLE_USERS.map((u) => u.employeeId), SYNTHETIC_HEAD_SPEC.employeeId];

  const [commentResult, attachmentResult, workItemResult, projectResult, productResult, activityResult, settingsActivityResult, notificationResult] =
    await Promise.all([
      ITWorkItemCommentModel.deleteMany({ workItem: { $in: workItemIds } }),
      ITWorkItemAttachmentModel.deleteMany({ workItem: { $in: workItemIds } }),
      ITWorkItemModel.deleteMany({ _id: { $in: workItemIds } }),
      ITProjectModel.deleteMany({ _id: { $in: projectIds } }),
      ITProductModel.deleteMany({ _id: { $in: productIds } }),
      ActivityLogModel.deleteMany({
        targetType: { $in: ["ITWorkItem", "ITProject", "ITProduct"] },
        targetId: { $in: [...workItemIds, ...projectIds, ...productIds] },
      }),
      // Scoped by metadata.targetEmployeeId rather than the shared settings
      // singleton's own id — that id is global, and blanket-deleting every
      // ITWorkManagementSettings activity entry would remove real grant/
      // revoke history for viewers this seed never touched.
      settingsDoc
        ? ActivityLogModel.deleteMany({
            targetType: "ITWorkManagementSettings",
            targetId: settingsDoc._id,
            "metadata.targetEmployeeId": { $in: sampleEmployeeIds },
          })
        : Promise.resolve({ deletedCount: 0 }),
      NotificationModel.deleteMany({ user: { $in: sampleUserIds } }),
    ]);

  // Remove the sample users from the read-only viewer grant list — never
  // deletes the settings singleton itself, only edits its array.
  await ITWorkManagementSettingsModel.updateOne(
    { key: "singleton" },
    { $pull: { readOnlyViewerIds: { $in: sampleUserIds } } }
  );

  // Only clear the IT department's head if it's still the SYNTHETIC sample
  // head — never touch it if a real person's account was reused as Head
  // (syntheticHeadDoc is undefined in that case, so this is skipped
  // entirely), and never delete the Department document itself.
  if (syntheticHeadDoc) {
    await DepartmentModel.updateOne(
      { name: new RegExp(`^${IT_DEPARTMENT_NAME}$`, "i"), headEmployeeId: syntheticHeadDoc._id },
      { $set: { headEmployeeId: null } }
    );
  }

  const userResult = await UserModel.deleteMany({ _id: { $in: sampleUserIds } });

  logger.info("---- IT Work Management sample data — reset ----");
  logger.info(`Comments removed: ${commentResult.deletedCount}`);
  logger.info(`Attachments removed: ${attachmentResult.deletedCount}`);
  logger.info(`Work Items removed: ${workItemResult.deletedCount}`);
  logger.info(`Projects removed: ${projectResult.deletedCount}`);
  logger.info(`Products removed: ${productResult.deletedCount}`);
  logger.info(`Activity Log entries removed: ${activityResult.deletedCount + settingsActivityResult.deletedCount}`);
  logger.info(`Notifications removed: ${notificationResult.deletedCount}`);
  logger.info(`Sample users removed: ${userResult.deletedCount}`);
  logger.info("Department \"IT\" itself was left in place (only its head link is cleared if it was the sample head).");
  logger.info("--------------------------------------------------------");

  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Failed to reset IT Work Management sample data");
    process.exit(1);
  });
