import { Schema, model, Document, Types } from "mongoose";

// A planning record — "I intend to work on this Work Item on this day" —
// deliberately separate from ITWorkItem.dueDate/startDate (when the work
// should be done) and never written back onto the Work Item itself. One
// Work Item may have several WorkSchedule entries across several days
// (spans multiple days); one day may have several entries (several Work
// Items planned the same day).
export interface IWorkSchedule extends Document {
  employee: Types.ObjectId;
  date: string; // "YYYY-MM-DD", IST — always a working day, see workingDays.ts
  workItem: Types.ObjectId;
  note: string | null;
  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const workScheduleSchema = new Schema<IWorkSchedule>(
  {
    employee: { type: Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    workItem: { type: Schema.Types.ObjectId, ref: "ITWorkItem", required: true },
    note: { type: String, default: null, trim: true, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Prevents the same Work Item being scheduled twice onto the same day for
// the same employee — the actual guarantee, not just a query optimization.
workScheduleSchema.index({ employee: 1, date: 1, workItem: 1 }, { unique: true });
// Powers the team-wide "grid for these 5 days" query.
workScheduleSchema.index({ date: 1 });

export const WorkScheduleModel = model<IWorkSchedule>("WorkSchedule", workScheduleSchema);
