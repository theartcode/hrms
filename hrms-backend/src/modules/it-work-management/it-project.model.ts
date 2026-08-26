import { Schema, model, Document, Types } from "mongoose";
import {
  IT_PROJECT_STATUS,
  IT_PROJECT_PRIORITY,
  ITProjectStatus,
  ITProjectPriority,
} from "../../shared/constants/itProjectTypes";

// IT Work Management — Phase 1B. A Project always belongs to exactly one
// Product (no orphan projects — enforced in it-project.service.ts, not just
// here, since creating into an inactive Product must also be rejected).
export interface IITProject extends Document {
  name: string;
  description: string | null;
  product: Types.ObjectId;
  status: ITProjectStatus;
  priority: ITProjectPriority;
  startDate: string | null;
  targetDate: string | null;
  owner: Types.ObjectId;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itProjectSchema = new Schema<IITProject>(
  {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    description: { type: String, default: null, trim: true, maxlength: 1000 },
    product: { type: Schema.Types.ObjectId, ref: "ITProduct", required: true },
    status: {
      type: String,
      enum: Object.values(IT_PROJECT_STATUS),
      required: true,
      default: IT_PROJECT_STATUS.PLANNED,
    },
    priority: {
      type: String,
      enum: Object.values(IT_PROJECT_PRIORITY),
      required: true,
      default: IT_PROJECT_PRIORITY.MEDIUM,
    },
    // Date-only strings (YYYY-MM-DD), same convention as Task.dueDate — no
    // time-of-day component is meaningful for a project date.
    startDate: { type: String, default: null },
    targetDate: { type: String, default: null },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Covers "projects for this product, optionally filtered by status" (the
// Product -> Project list view) as a prefix match too.
itProjectSchema.index({ product: 1, status: 1 });
itProjectSchema.index({ owner: 1 });
itProjectSchema.index({ priority: 1 });

export const ITProjectModel = model<IITProject>("ITProject", itProjectSchema);
