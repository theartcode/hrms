import { Schema, model, Document, Types } from "mongoose";

export const DAILY_TIMESHEET_STATUS = {
  DRAFT: "DRAFT",
  SUBMITTED: "SUBMITTED",
} as const;
export type DailyTimesheetStatus =
  (typeof DAILY_TIMESHEET_STATUS)[keyof typeof DAILY_TIMESHEET_STATUS];

// A lightweight daily work log — deliberately NOT an hours-tracking system
// (no start/end time, no clock-in/out, no break tracking). One entry per
// employee per workDate; the unique index below is the actual guarantee,
// not just application-level validation.
export interface IDailyTimesheet extends Document {
  employee: Types.ObjectId;
  workDate: string; // "YYYY-MM-DD", IST
  description: string;
  workItems: Types.ObjectId[];
  status: DailyTimesheetStatus;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const dailyTimesheetSchema = new Schema<IDailyTimesheet>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    workDate: { type: String, required: true },
    description: { type: String, required: true, trim: true, maxlength: 2000, default: "" },
    workItems: [{ type: Schema.Types.ObjectId, ref: "ITWorkItem" }],
    status: {
      type: String,
      enum: Object.values(DAILY_TIMESHEET_STATUS),
      required: true,
      default: DAILY_TIMESHEET_STATUS.DRAFT,
    },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

dailyTimesheetSchema.index({ employee: 1, workDate: 1 }, { unique: true });
// Powers the manager "team status for a given date" view.
dailyTimesheetSchema.index({ workDate: 1, status: 1 });

export const DailyTimesheetModel = model<IDailyTimesheet>(
  "DailyTimesheet",
  dailyTimesheetSchema
);
