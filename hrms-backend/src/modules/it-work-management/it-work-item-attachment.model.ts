import { Schema, model, Document, Types } from "mongoose";

// Mirrors TaskAttachment's shape field-for-field (task/task-attachment.model.ts)
// as its own independent collection — same reasoning that model documents
// for itself: touching a shared attachment model to add a second owner
// type would risk regressing Task attachments for a feature (IT Work
// Items) that shares nothing else with Task. Only the S3 client functions
// are genuinely shared infrastructure and are reused directly; this model
// and the service around it are not.
export const IT_WORK_ITEM_ATTACHMENT_STATUS = {
  ACTIVE: "ACTIVE",
  DELETED: "DELETED",
} as const;

export type ITWorkItemAttachmentStatus =
  (typeof IT_WORK_ITEM_ATTACHMENT_STATUS)[keyof typeof IT_WORK_ITEM_ATTACHMENT_STATUS];

export interface IITWorkItemAttachment extends Document {
  workItem: Types.ObjectId;
  originalFileName: string;
  s3Key: string;
  mimeType: string;
  fileSizeBytes: number;
  status: ITWorkItemAttachmentStatus;
  uploadedBy: Types.ObjectId;
  deletedBy: Types.ObjectId | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const itWorkItemAttachmentSchema = new Schema<IITWorkItemAttachment>(
  {
    workItem: { type: Schema.Types.ObjectId, ref: "ITWorkItem", required: true },
    originalFileName: { type: String, required: true, trim: true },
    s3Key: { type: String, required: true },
    mimeType: { type: String, required: true },
    fileSizeBytes: { type: Number, required: true },
    status: {
      type: String,
      enum: Object.values(IT_WORK_ITEM_ATTACHMENT_STATUS),
      required: true,
      default: IT_WORK_ITEM_ATTACHMENT_STATUS.ACTIVE,
    },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

itWorkItemAttachmentSchema.index({ workItem: 1, status: 1, createdAt: -1 });

export const ITWorkItemAttachmentModel = model<IITWorkItemAttachment>(
  "ITWorkItemAttachment",
  itWorkItemAttachmentSchema
);
