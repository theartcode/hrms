import crypto from "node:crypto";
import { ApiError } from "../../shared/errors/ApiError";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { recordActivity } from "../activity-log/activity-log.service";
import { toId } from "../../shared/utils/toId";
import { uploadObject, deleteObject, getSignedDownloadUrl } from "../../shared/services/s3.client";
import { Role } from "../../shared/constants/roles";
import { getWorkItemForActor } from "./it-work-item.service";
import { getItAccessTier } from "./it-access";
import {
  ITWorkItemAttachmentModel,
  IITWorkItemAttachment,
  IT_WORK_ITEM_ATTACHMENT_STATUS,
} from "./it-work-item-attachment.model";

interface Actor {
  id: string;
  role: Role;
  employeeId: string;
}

const POPULATE = { path: "uploadedBy", select: "fullName employeeId" };
const LABEL = "Attachment";

// Same filename-sanitization + random-prefix pattern as the existing Task
// attachment service (task.service.ts) — genuine shared convention, kept
// in this module's own file rather than imported, since it's a few lines
// of pure logic, not shared infrastructure like the S3 client itself.
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-100);
}

// Namespaced under it-work-management/, distinct from tasks/ — no
// collision with existing Task attachment storage. Uses the human-
// readable workItemId (ITW-0001) for the path, matching Task's own
// convention of using its display id rather than the raw ObjectId; the
// random UUID prefix is what actually guarantees uniqueness, so even a
// fully attacker-controlled original filename can never produce a path-
// traversal or overwrite risk.
function buildAttachmentS3Key(workItemDisplayId: string, fileName: string): string {
  const unique = crypto.randomUUID();
  return `it-work-management/work-items/${workItemDisplayId}/attachments/${unique}-${sanitizeFileName(fileName)}`;
}

// Comments (Phase 1D-A) never expose themselves independently of Work Item
// authorization; attachments follow the identical rule — every function
// below calls getWorkItemForActor first.
export async function listAttachments(
  actor: Actor,
  workItemId: string
): Promise<IITWorkItemAttachment[]> {
  await getWorkItemForActor(actor, workItemId);
  return ITWorkItemAttachmentModel.find({
    workItem: workItemId,
    status: IT_WORK_ITEM_ATTACHMENT_STATUS.ACTIVE,
  })
    .sort({ createdAt: -1 })
    .populate(POPULATE);
}

// Team-tier upload scope matches comments' scope exactly (Phase 1D-A):
// anyone who can view the item — assignee or reviewer — not narrowed
// further to "assignee only", since a reviewer legitimately attaching
// evidence when requesting changes is the same kind of participation as
// commenting.
export async function uploadAttachment(
  actor: Actor,
  workItemId: string,
  file: Express.Multer.File
): Promise<IITWorkItemAttachment> {
  const workItem = await getWorkItemForActor(actor, workItemId);

  const tier = await getItAccessTier(actor);
  if (tier === "readonly") {
    throw new ApiError(403, "Read-only access does not include uploading attachments");
  }

  const s3Key = buildAttachmentS3Key(workItem.workItemId, file.originalname);
  // Storage happens before the DB write — if uploadObject throws, nothing
  // below runs, so there is never a dangling ACTIVE record pointing at a
  // file that was never actually stored.
  await uploadObject(s3Key, file.buffer, file.mimetype);

  const attachment = await ITWorkItemAttachmentModel.create({
    workItem: workItemId,
    originalFileName: file.originalname,
    s3Key,
    mimeType: file.mimetype,
    fileSizeBytes: file.size,
    uploadedBy: actor.id,
  });
  await attachment.populate(POPULATE);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_WORK_ITEM_ATTACHMENT_UPLOADED,
    targetType: "ITWorkItem",
    targetId: workItemId,
    metadata: { attachmentId: toId(attachment), fileName: file.originalname },
  });

  return attachment;
}

async function getAttachmentInWorkItem(
  actor: Actor,
  workItemId: string,
  attachmentId: string
): Promise<IITWorkItemAttachment> {
  // Confirms Work Item existence + visibility first, then requires the
  // attachment to belong to THIS work item — an attachmentId that's real
  // but belongs to a different work item (one the actor may or may not be
  // able to see) resolves to 404 either way, never a cross-item leak.
  await getWorkItemForActor(actor, workItemId);
  const attachment = await ITWorkItemAttachmentModel.findOne({
    _id: attachmentId,
    workItem: workItemId,
  });
  if (!attachment) {
    throw new ApiError(404, `${LABEL} not found`);
  }
  return attachment;
}

export async function getAttachmentDownloadUrl(
  actor: Actor,
  workItemId: string,
  attachmentId: string
): Promise<string> {
  const attachment = await getAttachmentInWorkItem(actor, workItemId, attachmentId);
  if (attachment.status !== IT_WORK_ITEM_ATTACHMENT_STATUS.ACTIVE) {
    throw new ApiError(409, "This attachment has been deleted");
  }
  // Short-lived (5 min default), never a permanent/public URL — same
  // shared s3.client.ts function and default expiry as everywhere else in
  // the app that signs a download link.
  return getSignedDownloadUrl(attachment.s3Key);
}

export async function deleteAttachment(
  actor: Actor,
  workItemId: string,
  attachmentId: string
): Promise<void> {
  const attachment = await getAttachmentInWorkItem(actor, workItemId, attachmentId);
  if (attachment.status === IT_WORK_ITEM_ATTACHMENT_STATUS.DELETED) {
    throw new ApiError(409, "This attachment is already deleted");
  }

  const tier = await getItAccessTier(actor);
  const isUploader = String(attachment.uploadedBy) === actor.id;
  // Manage tier may delete anyone's attachment (a documented management
  // action); every other tier — team included — only their own. A
  // readonly viewer can never satisfy either branch, since they can never
  // be an uploader.
  if (tier !== "manage" && !isUploader) {
    throw new ApiError(403, "You can only delete your own attachment");
  }

  attachment.status = IT_WORK_ITEM_ATTACHMENT_STATUS.DELETED;
  attachment.deletedBy = actor.id as never;
  attachment.deletedAt = new Date();
  await attachment.save();
  // Same convention as Task attachments: the S3 object is deleted
  // immediately, not just soft-deleted in the DB — there is no restore
  // endpoint here either, so leaving the object in storage after this
  // point would just be permanently orphaned. DELETED + deletedBy/
  // deletedAt is kept purely as an audit trail, not a "might come back"
  // signal.
  await deleteObject(attachment.s3Key);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_WORK_ITEM_ATTACHMENT_DELETED,
    targetType: "ITWorkItem",
    targetId: workItemId,
    metadata: { attachmentId: toId(attachment), fileName: attachment.originalFileName },
  });
}
