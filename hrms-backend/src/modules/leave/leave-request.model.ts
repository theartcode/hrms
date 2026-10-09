import { Schema, model, Document, Types } from "mongoose";
import { LEAVE_TYPES, LEAVE_REQUEST_STATUS, LeaveType, LeaveRequestStatus } from "../../shared/constants/leaveTypes";

export interface ILeaveRequest extends Document {
  employee: Types.ObjectId;
  leaveType: LeaveType;
  startDate: string; // "YYYY-MM-DD" IST, inclusive
  endDate: string; // "YYYY-MM-DD" IST, inclusive
  days: number; // working days within the range (excludes Sundays + active holidays); 0.5 for a half-day request
  isHalfDay: boolean; // single-day request for half of that day instead of the whole day
  reason: string;
  status: LeaveRequestStatus;
  reviewedBy: Types.ObjectId | null;
  reviewComment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    leaveType: { type: String, enum: Object.values(LEAVE_TYPES), required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    days: { type: Number, required: true },
    isHalfDay: { type: Boolean, required: true, default: false },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: Object.values(LEAVE_REQUEST_STATUS),
      required: true,
      default: LEAVE_REQUEST_STATUS.PENDING,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewComment: { type: String, default: null },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ employee: 1, startDate: 1, endDate: 1 });
leaveRequestSchema.index({ status: 1 });

export const LeaveRequestModel = model<ILeaveRequest>(
  "LeaveRequest",
  leaveRequestSchema
);
