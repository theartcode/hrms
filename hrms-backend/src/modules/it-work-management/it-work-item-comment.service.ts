import { ApiError } from "../../shared/errors/ApiError";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { recordActivity } from "../activity-log/activity-log.service";
import { Role } from "../../shared/constants/roles";
import { getWorkItemForActor } from "./it-work-item.service";
import { ITWorkItemModel } from "./it-work-item.model";
import { getItAccessTier } from "./it-access";
import { notifyCommented } from "./it-work-item-notifications";
import {
  ITWorkItemCommentModel,
  IITWorkItemComment,
  IT_WORK_ITEM_COMMENT_STATUS,
} from "./it-work-item-comment.model";

interface Actor {
  id: string;
  role: Role;
  employeeId: string;
}

const POPULATE = { path: "author", select: "fullName employeeId" };
const LABEL = "Comment";
// Generous safety cap, not real pagination — Part 12 of the brief asked to
// avoid inventing pagination for this version while still not loading an
// unbounded list. A work item's conversation is expected to stay well
// under this for the team size this module was built for.
const LIST_LIMIT = 500;

// Comments never expose themselves independently of Work Item
// authorization — every function here calls getWorkItemForActor first,
// the exact same visibility check the Work Item detail page itself uses
// (403 for a team member outside their scope, "none" tier rejected
// entirely), per §5 of the Phase 1D-A brief.
export async function listComments(
  actor: Actor,
  workItemId: string
): Promise<IITWorkItemComment[]> {
  await getWorkItemForActor(actor, workItemId);
  return ITWorkItemCommentModel.find({
    workItem: workItemId,
    status: IT_WORK_ITEM_COMMENT_STATUS.ACTIVE,
  })
    .sort({ createdAt: 1 })
    .limit(LIST_LIMIT)
    .populate(POPULATE);
}

export async function addComment(
  actor: Actor,
  workItemId: string,
  body: string
): Promise<IITWorkItemComment> {
  const workItem = await getWorkItemForActor(actor, workItemId);

  // getWorkItemForActor already rejected "none" tier; the only tier it
  // admits that must NOT be able to post is "readonly" (the CEO tier).
  const tier = await getItAccessTier(actor);
  if (tier === "readonly") {
    throw new ApiError(403, "Read-only access does not include posting comments");
  }

  const comment = await ITWorkItemCommentModel.create({
    workItem: workItemId,
    author: actor.id,
    body,
  });
  await comment.populate(POPULATE);

  // targetType/targetId point at the Work Item itself (not the comment) so
  // this shows up in the existing per-item activity timeline
  // (listWorkItemActivity in it-work-item.service.ts) alongside status
  // changes — no changes needed there for comments to appear in it.
  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_WORK_ITEM_COMMENTED,
    targetType: "ITWorkItem",
    targetId: workItemId,
    metadata: {},
  });

  // getWorkItemForActor's return value has assignedTo/reviewer already
  // populated (needed for its own visibility check and for display), so a
  // second minimal raw fetch here is simpler and cleaner than unpicking
  // populated subdocuments back down to plain ids.
  const participants = await ITWorkItemModel.findById(workItemId).select("assignedTo reviewer");
  await notifyCommented(
    actor.id,
    workItem,
    participants?.assignedTo ? String(participants.assignedTo) : null,
    participants?.reviewer ? String(participants.reviewer) : null
  );

  return comment;
}

// Author-only, no management override — per §7 of the brief, an IT Head/
// Admin/Super Admin editing someone else's comment is explicitly NOT
// wanted for this version.
export async function editComment(
  actor: Actor,
  workItemId: string,
  commentId: string,
  body: string
): Promise<IITWorkItemComment> {
  await getWorkItemForActor(actor, workItemId);

  const comment = await ITWorkItemCommentModel.findOne({
    _id: commentId,
    workItem: workItemId,
    status: IT_WORK_ITEM_COMMENT_STATUS.ACTIVE,
  });
  if (!comment) {
    throw new ApiError(404, `${LABEL} not found`);
  }
  if (String(comment.author) !== actor.id) {
    throw new ApiError(403, "You can only edit your own comment");
  }

  comment.body = body;
  await comment.save();
  await comment.populate(POPULATE);
  return comment;
}

// Same author-only rule as edit. Soft delete only — the row stays for
// audit purposes (deletedBy/deletedAt), it just stops appearing in
// listComments and the work item's comment count.
export async function deleteComment(
  actor: Actor,
  workItemId: string,
  commentId: string
): Promise<void> {
  await getWorkItemForActor(actor, workItemId);

  const comment = await ITWorkItemCommentModel.findOne({
    _id: commentId,
    workItem: workItemId,
    status: IT_WORK_ITEM_COMMENT_STATUS.ACTIVE,
  });
  if (!comment) {
    throw new ApiError(404, `${LABEL} not found`);
  }
  if (String(comment.author) !== actor.id) {
    throw new ApiError(403, "You can only delete your own comment");
  }

  comment.status = IT_WORK_ITEM_COMMENT_STATUS.DELETED;
  comment.deletedBy = actor.id as never;
  comment.deletedAt = new Date();
  await comment.save();
}
