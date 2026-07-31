import { Schema, model, Document, Types } from "mongoose";
import { LEAVE_TYPES, LeaveType } from "../../shared/constants/leaveTypes";
import { ALLOCATION_PERIOD, AllocationPeriod } from "./leave-allocation.model";

// The real audit trail LeaveAllocationModel can't provide (it's purely
// additive/delta-based with no before/after snapshot) — one row per
// LeaveBalanceModel field touched, for every migration confirmation AND
// every manual grant/edit/delete going forward. Never updated or deleted;
// this collection is itself an append-only history.
export const LEAVE_BALANCE_ADJUSTMENT_SOURCE = {
  MIGRATION_CONFIRM: "MIGRATION_CONFIRM",
  MANUAL_GRANT: "MANUAL_GRANT",
  MANUAL_EDIT: "MANUAL_EDIT",
  MANUAL_DELETE: "MANUAL_DELETE",
} as const;
export type LeaveBalanceAdjustmentSource =
  (typeof LEAVE_BALANCE_ADJUSTMENT_SOURCE)[keyof typeof LEAVE_BALANCE_ADJUSTMENT_SOURCE];

// Closed set of adjustable LeaveBalanceModel fields — deliberately excludes
// annualAccruedThroughMonth, which is an internal accrual cursor (gates
// future monthly credit), not a balance value; exposing it here would let
// an admin accidentally cause double-crediting later.
export const ADJUSTABLE_BALANCE_FIELDS = [
  "sickUsedH1",
  "sickUsedH2",
  "sickExtraH1",
  "sickExtraH2",
  "casualPaidUsedH1",
  "casualPaidUsedH2",
  "casualPaidExtraH1",
  "casualPaidExtraH2",
  "annualAccrued",
  "annualExtra",
  "annualUsed",
  "unpaidUsed",
  "compOffGranted",
  "compOffUsed",
] as const;
export type AdjustableBalanceField = (typeof ADJUSTABLE_BALANCE_FIELDS)[number];

export interface ILeaveBalanceAdjustment extends Document {
  employee: Types.ObjectId;
  year: number;
  leaveType: LeaveType;
  period: AllocationPeriod | null;
  field: AdjustableBalanceField;
  previousValue: number;
  newValue: number;
  reason: string;
  source: LeaveBalanceAdjustmentSource;
  relatedAllocationId: Types.ObjectId | null;
  performedBy: Types.ObjectId;
  createdAt: Date;
}

const leaveBalanceAdjustmentSchema = new Schema<ILeaveBalanceAdjustment>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    year: { type: Number, required: true },
    leaveType: { type: String, enum: Object.values(LEAVE_TYPES), required: true },
    period: { type: String, enum: Object.values(ALLOCATION_PERIOD), default: null },
    field: { type: String, enum: ADJUSTABLE_BALANCE_FIELDS, required: true },
    previousValue: { type: Number, required: true },
    newValue: { type: Number, required: true },
    reason: { type: String, required: true, trim: true },
    source: {
      type: String,
      enum: Object.values(LEAVE_BALANCE_ADJUSTMENT_SOURCE),
      required: true,
    },
    relatedAllocationId: { type: Schema.Types.ObjectId, ref: "LeaveAllocation", default: null },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

leaveBalanceAdjustmentSchema.index({ employee: 1, createdAt: -1 });

export const LeaveBalanceAdjustmentModel = model<ILeaveBalanceAdjustment>(
  "LeaveBalanceAdjustment",
  leaveBalanceAdjustmentSchema
);
