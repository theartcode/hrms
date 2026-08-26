import { Schema, model, Document, Types } from "mongoose";
import { IT_WORK_TYPE, IT_WORK_ITEM_STATUS, ITWorkType, ITWorkItemStatus } from "../../shared/constants/itWorkItemTypes";
import { IT_PROJECT_PRIORITY, ITProjectPriority } from "../../shared/constants/itProjectTypes";

// IT Work Management — Phase 1C-A. A Work Item always belongs to exactly
// one Product; Project is optional (a Work Item can exist during planning
// before it's grouped under a Project) but when present must belong to the
// same Product — enforced in it-work-item.service.ts, not just here.
export interface IITWorkItem extends Document {
  workItemId: string;
  title: string;
  description: string | null;
  product: Types.ObjectId;
  project: Types.ObjectId | null;
  workType: ITWorkType;
  priority: ITProjectPriority;
  status: ITWorkItemStatus;
  assignedTo: Types.ObjectId | null;
  reviewer: Types.ObjectId | null;
  startDate: string | null;
  dueDate: string | null;
  // Phase 1C-B workflow fields. blockedReason/reviewNote reflect the
  // CURRENT outstanding reason only — cleared when the item leaves that
  // state (resumed from Blocked, resubmitted after changes requested).
  // The permanent record of every past reason lives in the Activity Log
  // (append-only, never cleared) — see it-work-item.service.ts.
  blockedReason: string | null;
  cancelReason: string | null;
  reviewNote: string | null;
  completedAt: Date | null;
  createdBy: Types.ObjectId;
  // Set only when a team member proposes this item for themselves (a new
  // capability alongside the existing itManage-only creation path) —
  // permanent historical marker, never cleared, distinct from createdBy
  // because a manage-tier actor's approve/reject action never becomes the
  // "creator" of someone else's proposal.
  proposedBy: Types.ObjectId | null;
  // "PENDING" between proposal and the IT Head's first approve/reject
  // action; null once resolved (approved -> normal status control takes
  // over; rejected -> status becomes CANCELLED). While PENDING, every
  // status-changing action (status change, submit for review, review) is
  // blocked for everyone — see it-work-item.service.ts.
  approvalStatus: "PENDING" | null;
  createdAt: Date;
  updatedAt: Date;
}

const itWorkItemSchema = new Schema<IITWorkItem>(
  {
    workItemId: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, trim: true, maxlength: 2000 },
    product: { type: Schema.Types.ObjectId, ref: "ITProduct", required: true },
    project: { type: Schema.Types.ObjectId, ref: "ITProject", default: null },
    workType: { type: String, enum: Object.values(IT_WORK_TYPE), required: true },
    priority: {
      type: String,
      enum: Object.values(IT_PROJECT_PRIORITY),
      required: true,
      default: IT_PROJECT_PRIORITY.MEDIUM,
    },
    status: {
      type: String,
      enum: Object.values(IT_WORK_ITEM_STATUS),
      required: true,
      default: IT_WORK_ITEM_STATUS.REQUESTED,
    },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewer: { type: Schema.Types.ObjectId, ref: "User", default: null },
    // Date-only strings (YYYY-MM-DD), same convention as ITProject.
    startDate: { type: String, default: null },
    dueDate: { type: String, default: null },
    blockedReason: { type: String, default: null, trim: true, maxlength: 1000 },
    cancelReason: { type: String, default: null, trim: true, maxlength: 1000 },
    reviewNote: { type: String, default: null, trim: true, maxlength: 1000 },
    completedAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    proposedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvalStatus: { type: String, enum: ["PENDING"], default: null },
  },
  { timestamps: true }
);

itWorkItemSchema.index({ product: 1, project: 1 });
itWorkItemSchema.index({ assignedTo: 1, status: 1 });
itWorkItemSchema.index({ priority: 1 });
itWorkItemSchema.index({ dueDate: 1 });
// Powers both the IT Head dashboard's pending-proposals list and the
// itAccess-layer guard that blocks status changes while a proposal is
// still awaiting approval.
itWorkItemSchema.index({ approvalStatus: 1 });

export const ITWorkItemModel = model<IITWorkItem>("ITWorkItem", itWorkItemSchema);
