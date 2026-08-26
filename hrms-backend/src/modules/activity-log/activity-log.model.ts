import { Schema, model, Document, Types } from "mongoose";
import { ACTIVITY_ACTIONS, ActivityAction } from "../../shared/constants/activityActions";

export interface IActivityLog extends Document {
  actorId: Types.ObjectId;
  actorEmployeeId: string;
  action: ActivityAction;
  targetType:
    | "User"
    | "Department"
    | "Designation"
    | "Location"
    | "Attendance"
    | "AttendanceCorrection"
    | "LeaveRequest"
    | "LeaveAllocation"
    | "LeaveBalanceAdjustment"
    | "LeaveImportRecord"
    | "Holiday"
    | "Report"
    | "Announcement"
    | "EmployeeDocument"
    | "Task"
    | "AdobeLicenseSheet"
    | "ITProduct"
    | "ITProject"
    | "ITWorkItem"
    | "ITWorkManagementSettings";
  targetId: Types.ObjectId;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorEmployeeId: { type: String, required: true },
    action: { type: String, enum: Object.values(ACTIVITY_ACTIONS), required: true },
    targetType: {
      type: String,
      enum: [
        "User",
        "Department",
        "Designation",
        "Location",
        "Attendance",
        "AttendanceCorrection",
        "LeaveRequest",
        "LeaveAllocation",
        "LeaveBalanceAdjustment",
        "LeaveImportRecord",
        "Holiday",
        "Report",
        "Announcement",
        "EmployeeDocument",
        "Task",
        "AdobeLicenseSheet",
        "ITProduct",
        "ITProject",
        "ITWorkItem",
        "ITWorkManagementSettings",
      ],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

activityLogSchema.index({ createdAt: -1 });
// Phase 1E-A: the IT Head Dashboard is the first caller to query activity
// globally scoped by targetType (recent activity + today's team activity,
// across every ITWorkItem rather than one at a time) — additive only, does
// not change any existing query's behavior.
activityLogSchema.index({ targetType: 1, createdAt: -1 });

export const ActivityLogModel = model<IActivityLog>(
  "ActivityLog",
  activityLogSchema
);
