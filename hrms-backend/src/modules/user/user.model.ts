import { Schema, model, Document, Types } from "mongoose";
import { ROLES, Role } from "../../shared/constants/roles";
import { EMPLOYEE_STATUS, EmployeeStatus } from "../../shared/constants/employeeStatus";
import { EMPLOYMENT_TYPE, EmploymentType } from "../../shared/constants/employmentType";
import { GENDER, Gender } from "../../shared/constants/gender";
import { STATUTORY_STATUS, StatutoryStatus } from "../../shared/constants/statutoryStatus";

export interface IEmergencyContact {
  name: string;
  phone: string;
}

export interface IPaymentInfo {
  ifscCode: string;
  accountNumber: string;
  accountHolderName: string;
}

export interface IStatutoryInfo {
  pan: string | null;
  pfStatus: StatutoryStatus;
  pfUan: string | null;
  professionalTaxStatus: StatutoryStatus;
  lwfStatus: StatutoryStatus;
  esicStatus: StatutoryStatus;
  esicIpNumber: string | null;
}

// A self-submitted bank details change never lands directly on
// `paymentInfo` — it sits here as a proposal until an admin approves it.
// This is the only self-service field with this two-step shape, because a
// wrong bank account is a payroll-misdirection risk in a way phone/address
// edits aren't.
export const PAYMENT_INFO_REVIEW_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type PaymentInfoReviewStatus =
  (typeof PAYMENT_INFO_REVIEW_STATUS)[keyof typeof PAYMENT_INFO_REVIEW_STATUS];

export interface IUser extends Document {
  employeeId: string;
  email: string;
  passwordHash: string;
  role: Role;
  status: EmployeeStatus;
  mustChangePassword: boolean;
  refreshTokenHash: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  // Forgot-password link flow: a sha256 digest of the raw token embedded
  // in the emailed reset URL (the raw token itself is never stored, same
  // principle as passwordHash) plus its expiry. Both null once unused or
  // already consumed.
  passwordResetTokenHash: string | null;
  passwordResetExpiresAt: Date | null;

  fullName: string;
  phone: string;
  department: Types.ObjectId | null;
  designation: Types.ObjectId | null;
  joiningDate: Date;
  dateOfBirth: Date | null;
  profilePhoto: string | null;
  address: string | null;
  emergencyContact: IEmergencyContact | null;
  // Per-employee attendance grace period, in minutes. null (the default)
  // means "use Configuration.officeSettings.gracePeriodMinutes" — this
  // only overrides the company-wide value for this one employee.
  gracePeriodOverrideMinutes: number | null;
  // Everyone starts on Probation; permanentSince is set the moment an
  // admin promotes them and is the reference point Annual Leave accrual
  // counts eligible months from (see leave.service.ts) — Probation
  // employees don't accrue Annual Leave at all.
  employmentType: EmploymentType;
  permanentSince: Date | null;
  // Auto-computed at creation (joiningDate + Configuration.officeSettings.
  // defaultProbationMonths), editable afterward — the reference date the
  // probation-ending job (jobs/probation-ending.job.ts) checks against.
  // Irrelevant once employmentType is PERMANENT (left as historical record,
  // never cleared by promoteToPermanent).
  probationEndDate: Date | null;
  // Set once the "probation ended" admin notification has fired for the
  // CURRENT probationEndDate, so the daily job never re-notifies for the
  // same date. Reset to null whenever probationEndDate is edited — a newly
  // set date deserves its own notification when it arrives.
  probationEndNotifiedAt: Date | null;
  salary?: number | null;
  bloodGroup?: string | null;

  manager: Types.ObjectId | null;
  location: Types.ObjectId | null;
  gender: Gender | null;
  whatsappEnabled: boolean;
  // "HH:mm" strings, e.g. "10:00" / "19:00" — not Date, there's no
  // associated calendar day, just a daily start/end time.
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  numberOfBonuses: number | null;
  advanceSalaryBalance: number | null;
  advanceSalaryEmi: number | null;
  paymentInfo: IPaymentInfo | null;
  statutoryInfo: IStatutoryInfo | null;
  pendingPaymentInfo: IPaymentInfo | null;
  paymentInfoReviewStatus: PaymentInfoReviewStatus | null;
  paymentInfoReviewedBy: Types.ObjectId | null;
  paymentInfoReviewedAt: Date | null;
  paymentInfoReviewComment: string | null;

  // Gates the manual leave-allocation grant/edit/delete panel — an admin
  // cannot touch this employee's balance by hand until it's CONFIRMED.
  // Pre-existing employees at HRMS launch are backfilled to CONFIRMED with
  // leaveMigrationConfirmedBy left null (see scripts/backfill-leave-
  // migration-status.ts) — that null is what forever distinguishes a
  // backfilled confirmation from a real admin review.
  leaveMigrationStatus: "NOT_STARTED" | "CONFIRMED";
  leaveMigrationConfirmedBy: Types.ObjectId | null;
  leaveMigrationConfirmedAt: Date | null;
  leaveMigrationConfirmedReason: string | null;

  createdAt: Date;
  updatedAt: Date;
}

const emergencyContactSchema = new Schema<IEmergencyContact>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const paymentInfoSchema = new Schema<IPaymentInfo>(
  {
    ifscCode: { type: String, required: true, trim: true, uppercase: true },
    accountNumber: { type: String, required: true, trim: true },
    accountHolderName: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const statutoryInfoSchema = new Schema<IStatutoryInfo>(
  {
    pan: { type: String, default: null, trim: true, uppercase: true },
    pfStatus: {
      type: String,
      enum: Object.values(STATUTORY_STATUS),
      required: true,
      default: STATUTORY_STATUS.DISABLED,
    },
    pfUan: { type: String, default: null, trim: true },
    professionalTaxStatus: {
      type: String,
      enum: Object.values(STATUTORY_STATUS),
      required: true,
      default: STATUTORY_STATUS.DISABLED,
    },
    lwfStatus: {
      type: String,
      enum: Object.values(STATUTORY_STATUS),
      required: true,
      default: STATUTORY_STATUS.DISABLED,
    },
    esicStatus: {
      type: String,
      enum: Object.values(STATUTORY_STATUS),
      required: true,
      default: STATUTORY_STATUS.DISABLED,
    },
    esicIpNumber: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const userSchema = new Schema<IUser>(
  {
    employeeId: { type: String, required: true, unique: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      default: ROLES.EMPLOYEE,
    },
    status: {
      type: String,
      enum: Object.values(EMPLOYEE_STATUS),
      required: true,
      default: EMPLOYEE_STATUS.ACTIVE,
    },
    mustChangePassword: { type: Boolean, required: true, default: true },
    refreshTokenHash: { type: String, default: null, select: false },
    // Login-lockout bookkeeping (Phase 9 Security Settings) — kept off
    // default selects like the other auth-internal fields above.
    failedLoginAttempts: { type: Number, required: true, default: 0, select: false },
    lockedUntil: { type: Date, default: null, select: false },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetExpiresAt: { type: Date, default: null, select: false },

    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    designation: { type: Schema.Types.ObjectId, ref: "Designation", default: null },
    joiningDate: { type: Date, required: true },
    dateOfBirth: { type: Date, default: null },
    profilePhoto: { type: String, default: null },
    address: { type: String, default: null, trim: true },
    emergencyContact: { type: emergencyContactSchema, default: null },
    gracePeriodOverrideMinutes: { type: Number, default: null },
    employmentType: {
      type: String,
      enum: Object.values(EMPLOYMENT_TYPE),
      required: true,
      default: EMPLOYMENT_TYPE.PROBATION,
    },
    permanentSince: { type: Date, default: null },
    probationEndDate: { type: Date, default: null },
    probationEndNotifiedAt: { type: Date, default: null },
    salary: { type: Number, default: null },
    bloodGroup: { type: String, default: null, trim: true },

    manager: { type: Schema.Types.ObjectId, ref: "User", default: null },
    location: { type: Schema.Types.ObjectId, ref: "Location", default: null },
    gender: { type: String, enum: Object.values(GENDER), default: null },
    whatsappEnabled: { type: Boolean, required: true, default: false },
    shiftStartTime: { type: String, default: null },
    shiftEndTime: { type: String, default: null },
    numberOfBonuses: { type: Number, default: null },
    advanceSalaryBalance: { type: Number, default: null },
    advanceSalaryEmi: { type: Number, default: null },
    paymentInfo: { type: paymentInfoSchema, default: null },
    statutoryInfo: { type: statutoryInfoSchema, default: null },
    pendingPaymentInfo: { type: paymentInfoSchema, default: null },
    paymentInfoReviewStatus: {
      type: String,
      enum: Object.values(PAYMENT_INFO_REVIEW_STATUS),
      default: null,
    },
    paymentInfoReviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    paymentInfoReviewedAt: { type: Date, default: null },
    paymentInfoReviewComment: { type: String, default: null },

    leaveMigrationStatus: {
      type: String,
      enum: ["NOT_STARTED", "CONFIRMED"],
      required: true,
      default: "NOT_STARTED",
    },
    leaveMigrationConfirmedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    leaveMigrationConfirmedAt: { type: Date, default: null },
    leaveMigrationConfirmedReason: { type: String, default: null },
  },
  { timestamps: true }
);

export const UserModel = model<IUser>("User", userSchema);
