import { Schema, model, Document, Types } from "mongoose";

// IT Work Management — Phase 1A. A Product is a system/product the IT
// department is responsible for (e.g. "HRMS", "OTT"). Deliberately flat:
// no owner/department reference (the whole module is IT-scoped already —
// see it-access.ts) and no status beyond active/inactive.
export interface IITProduct extends Document {
  name: string;
  description: string | null;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const itProductSchema = new Schema<IITProduct>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: null, trim: true, maxlength: 500 },
    isActive: { type: Boolean, required: true, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export const ITProductModel = model<IITProduct>("ITProduct", itProductSchema);
