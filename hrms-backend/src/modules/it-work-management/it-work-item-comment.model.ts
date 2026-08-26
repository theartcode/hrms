import { Schema, model, Document, Types } from "mongoose";

// Soft-delete via status, mirroring the exact convention Task's own
// TaskAttachment already uses (status ACTIVE/DELETED + deletedBy/deletedAt)
// — not a new pattern, reusing one already established twice in this
// codebase (Documents, Task Attachments). Independent of Task's own
// TaskComment model (which is immutable — no edit/delete at all); IT Work
// Item comments needed edit, so this couldn't just reuse that shape either
// way, per the Phase 1D-A brief's explicit "no Task comment code reuse."
export const IT_WORK_ITEM_COMMENT_STATUS = {
  ACTIVE: "ACTIVE",
  DELETED: "DELETED",
} as const;

export type ITWorkItemCommentStatus =
  (typeof IT_WORK_ITEM_COMMENT_STATUS)[keyof typeof IT_WORK_ITEM_COMMENT_STATUS];

export interface IITWorkItemComment extends Document {
  workItem: Types.ObjectId;
  author: Types.ObjectId;
  body: string;
  status: ITWorkItemCommentStatus;
  deletedBy: Types.ObjectId | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const itWorkItemCommentSchema = new Schema<IITWorkItemComment>(
  {
    workItem: { type: Schema.Types.ObjectId, ref: "ITWorkItem", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: Object.values(IT_WORK_ITEM_COMMENT_STATUS),
      required: true,
      default: IT_WORK_ITEM_COMMENT_STATUS.ACTIVE,
    },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Ascending on createdAt (not Task's descending) — the list query below
// reads oldest-first directly, matching how a conversation is naturally
// read, rather than fetching newest-first and reversing for display.
itWorkItemCommentSchema.index({ workItem: 1, createdAt: 1 });

export const ITWorkItemCommentModel = model<IITWorkItemComment>(
  "ITWorkItemComment",
  itWorkItemCommentSchema
);
