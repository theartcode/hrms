import { Schema, model, Document, Types } from "mongoose";
import { LEAVE_TYPES, LeaveType } from "../../shared/constants/leaveTypes";

// One row = one historical leave taken, imported from Razorpay (or another
// prior system) via CSV before this employee's migration is confirmed.
// Immutable once created: no update route exists at all, and delete is only
// ever permitted pre-confirmation (undo a bad upload by removing its whole
// batch — see deleteImportBatch in leave.service.ts). Once the owning
// employee's leaveMigrationStatus flips to CONFIRMED, nothing may touch
// these rows again, enforced in the service layer, not just by convention.
export const LEAVE_IMPORT_SOURCE = {
  RAZORPAY: "RAZORPAY",
  OTHER: "OTHER",
} as const;
export type LeaveImportSource = (typeof LEAVE_IMPORT_SOURCE)[keyof typeof LEAVE_IMPORT_SOURCE];

// Deliberately excludes PENDING — a "still open" row from a retired system
// is a live business problem to resolve before import, not migration data.
export const LEAVE_IMPORT_STATUS = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type LeaveImportStatus = (typeof LEAVE_IMPORT_STATUS)[keyof typeof LEAVE_IMPORT_STATUS];

export interface ILeaveImportRecord extends Document {
  employee: Types.ObjectId;
  source: LeaveImportSource;
  leaveType: LeaveType;
  startDate: string; // "YYYY-MM-DD", same convention as LeaveRequestModel
  endDate: string;
  days: number; // trusted as-is from the source system, never recomputed
  status: LeaveImportStatus;
  reason: string | null;
  externalReference: string | null; // the source system's own record id, if any
  sourceFilename: string | null;
  importBatchId: string; // shared by every row from one CSV upload
  importedBy: Types.ObjectId;
  createdAt: Date;
}

const leaveImportRecordSchema = new Schema<ILeaveImportRecord>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    source: { type: String, enum: Object.values(LEAVE_IMPORT_SOURCE), required: true },
    leaveType: { type: String, enum: Object.values(LEAVE_TYPES), required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    days: { type: Number, required: true, min: 0.5 },
    status: { type: String, enum: Object.values(LEAVE_IMPORT_STATUS), required: true },
    reason: { type: String, default: null, trim: true },
    externalReference: { type: String, default: null, trim: true },
    sourceFilename: { type: String, default: null },
    importBatchId: { type: String, required: true },
    importedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

leaveImportRecordSchema.index({ employee: 1, importBatchId: 1 });
leaveImportRecordSchema.index({ employee: 1, startDate: 1 });

export const LeaveImportRecordModel = model<ILeaveImportRecord>(
  "LeaveImportRecord",
  leaveImportRecordSchema
);
