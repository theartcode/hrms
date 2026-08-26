import { Router } from "express";
import { validate } from "../../shared/middleware/validate";
import { uploadDocument } from "../../shared/middleware/upload";
import { itAccess, itManage } from "./it-access";
import {
  approveProposalSchema,
  changeWorkItemStatusSchema,
  createWorkItemSchema,
  listWorkItemsSchema,
  proposeWorkItemSchema,
  rejectProposalSchema,
  requestProposalChangesSchema,
  reviewWorkItemSchema,
  submitForReviewSchema,
  updateProposalSchema,
  updateWorkItemAssignmentSchema,
  updateWorkItemSchema,
  workItemIdParamSchema,
} from "./it-work-item.validation";
import {
  addCommentSchema,
  commentIdParamSchema,
  editCommentSchema,
  listCommentsSchema,
} from "./it-work-item-comment.validation";
import {
  attachmentIdParamSchema,
  listAttachmentsSchema,
  uploadAttachmentSchema,
} from "./it-work-item-attachment.validation";
import * as itWorkItemController from "./it-work-item.controller";
import * as itWorkItemCommentController from "./it-work-item-comment.controller";
import * as itWorkItemAttachmentController from "./it-work-item-attachment.controller";

const router = Router();

// authenticate is applied once by the parent it-work-management.routes.ts
// router. Reads use itAccess (Admin/Super Admin/IT Head/IT team member —
// row-level scoping happens in the service); create/general-edit/
// assignment stay itManage-only. Status/submit-review/review use itAccess
// too — a team member can move their own item forward, and either tier
// can be the named reviewer of someone else's — with every permission
// nuance (ownership, reviewer identity, self-approval) enforced inside
// the service, same as Phase 1C-A's assignment split.
router.get("/", itAccess, validate(listWorkItemsSchema), itWorkItemController.list);
router.post("/", itManage, validate(createWorkItemSchema), itWorkItemController.create);
// A team member proposing work for themselves — itAccess at the route
// (broad gate), the actual "must be team tier" check lives in the service,
// same split as status/submit-review/review below.
router.post(
  "/propose",
  itAccess,
  validate(proposeWorkItemSchema),
  itWorkItemController.propose
);
router.get("/:id", itAccess, validate(workItemIdParamSchema), itWorkItemController.getById);
router.get(
  "/:id/activity",
  itAccess,
  validate(workItemIdParamSchema),
  itWorkItemController.listActivity
);
router.patch("/:id", itManage, validate(updateWorkItemSchema), itWorkItemController.update);
router.patch(
  "/:id/assignment",
  itManage,
  validate(updateWorkItemAssignmentSchema),
  itWorkItemController.updateAssignment
);
router.patch(
  "/:id/status",
  itAccess,
  validate(changeWorkItemStatusSchema),
  itWorkItemController.changeStatus
);
router.post(
  "/:id/submit-review",
  itAccess,
  validate(submitForReviewSchema),
  itWorkItemController.submitForReview
);
router.post(
  "/:id/review",
  itAccess,
  validate(reviewWorkItemSchema),
  itWorkItemController.review
);
// Approve/reject a pending proposal — itManage-only at the route itself
// (unlike propose above, there's no broader tier that legitimately needs
// to reach these).
router.post(
  "/:id/approve-proposal",
  itManage,
  validate(approveProposalSchema),
  itWorkItemController.approveProposal
);
router.post(
  "/:id/reject-proposal",
  itManage,
  validate(rejectProposalSchema),
  itWorkItemController.rejectProposal
);
// A middle ground between approve/reject — itManage-only, same as those two.
router.post(
  "/:id/request-proposal-changes",
  itManage,
  validate(requestProposalChangesSchema),
  itWorkItemController.requestProposalChanges
);
// The proposer revising their own pending proposal — itAccess at the route
// (broad gate), "must be the original proposer, and still PENDING" is
// enforced in the service, same split as propose above.
router.patch(
  "/:id/proposal",
  itAccess,
  validate(updateProposalSchema),
  itWorkItemController.updateProposal
);

// Comments — itAccess at the route layer (manage/team/readonly all reach
// these), with per-action rules enforced inside the service: readonly can
// list but never post (addComment rejects it explicitly), and edit/delete
// are author-only for every tier, management included — see the
// Phase 1D-A report.
router.get(
  "/:id/comments",
  itAccess,
  validate(listCommentsSchema),
  itWorkItemCommentController.list
);
router.post(
  "/:id/comments",
  itAccess,
  validate(addCommentSchema),
  itWorkItemCommentController.create
);
router.patch(
  "/:id/comments/:commentId",
  itAccess,
  validate(editCommentSchema),
  itWorkItemCommentController.update
);
router.delete(
  "/:id/comments/:commentId",
  itAccess,
  validate(commentIdParamSchema),
  itWorkItemCommentController.remove
);

// Attachments — same itAccess-at-the-route/finer-rules-in-the-service
// split as comments. uploadDocument is the existing shared multer
// instance (10MB, PDF/JPEG/PNG/DOCX — see the Phase 1D-B report for why
// this wasn't widened) reused as-is, not duplicated.
router.get(
  "/:id/attachments",
  itAccess,
  validate(listAttachmentsSchema),
  itWorkItemAttachmentController.list
);
router.post(
  "/:id/attachments",
  itAccess,
  uploadDocument,
  validate(uploadAttachmentSchema),
  itWorkItemAttachmentController.upload
);
router.get(
  "/:id/attachments/:attachmentId/download",
  itAccess,
  validate(attachmentIdParamSchema),
  itWorkItemAttachmentController.getDownloadUrl
);
router.delete(
  "/:id/attachments/:attachmentId",
  itAccess,
  validate(attachmentIdParamSchema),
  itWorkItemAttachmentController.remove
);

export default router;
