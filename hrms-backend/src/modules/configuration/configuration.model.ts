import { Schema, model, Document, Types } from "mongoose";

export const EMAIL_PROVIDER = {
  SMTP: "SMTP",
  SES: "SES",
} as const;
export type EmailProvider = (typeof EMAIL_PROVIDER)[keyof typeof EMAIL_PROVIDER];

export interface ICompanyProfile {
  name: string;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  timezone: string;
}

export interface IOfficeSettings {
  startTime: string; // "HH:mm", 24h, IST
  endTime: string;
  gracePeriodMinutes: number;
  workingDays: number[]; // 0=Sun..6=Sat
  weekendDays: number[]; // 0=Sun..6=Sat
  geofenceEnabled: boolean;
  latitude: number | null;
  longitude: number | null;
  allowedRadiusMeters: number;
  // Auto-fills a new employee's probationEndDate (joiningDate + this many
  // months) at creation — editable per-employee afterward.
  defaultProbationMonths: number;
}

export interface ILeavePolicy {
  // Sick and Casual Paid Leave are both split into two half-year buckets
  // (Jan-Jun, Jul-Dec) rather than one flat annual quota — these are the
  // per-half amounts, so each type's effective yearly total is 2x this
  // value. See leave.service.ts's getLeaveBalance for how unused H1 days
  // carry into H2 (shared carryForwardEnabled toggle below, applies to both).
  sickQuotaPerHalf: number;
  casualPaidQuotaPerHalf: number;
  casualPaidNoticeDays: number;
  // Earned-leave accrual rate for Annual Leave: credited once per fully
  // completed calendar month in which the employee took no leave of any
  // kind. Computed on demand in leave.util.ts, never stored as a running
  // total, so it's always correct even if past requests are edited later.
  annualAccrualPerMonth: number;
  annualNoticeDays: number;
  unpaidAllowed: boolean;
  carryForwardEnabled: boolean;
  minDurationDays: number;
  maxDurationDays: number;
}

export interface INotificationEventToggles {
  LEAVE_APPLIED: boolean;
  LEAVE_APPROVED: boolean;
  LEAVE_REJECTED: boolean;
  ATTENDANCE_CORRECTION: boolean;
  HOLIDAY_ADDED: boolean;
  ANNOUNCEMENT_PUBLISHED: boolean;
  EMPLOYEE_CREATED: boolean;
  BIRTHDAY: boolean;
  WORK_ANNIVERSARY: boolean;
  PROBATION_ENDING: boolean;
}

export interface INotificationSettings {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  events: INotificationEventToggles;
}

export interface ISmtpConfig {
  host: string | null;
  port: number | null;
  username: string | null;
  passwordEncrypted: string | null;
  fromName: string | null;
  fromEmail: string | null;
}

export interface ISesConfig {
  region: string | null;
  accessKeyEncrypted: string | null;
  secretKeyEncrypted: string | null;
  verifiedSender: string | null;
}

export interface IEmailSettings {
  provider: EmailProvider;
  smtp: ISmtpConfig;
  ses: ISesConfig;
}

export interface ISecuritySettings {
  minPasswordLength: number;
  passwordComplexity: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
  accessTokenLifetimeMinutes: number;
  refreshTokenLifetimeDays: number;
}

export interface IGeneralSettings {
  dateFormat: string;
  timeFormat: string;
  currency: string;
  defaultTimezone: string;
}

export interface IConfiguration extends Document {
  key: string;
  companyProfile: ICompanyProfile;
  officeSettings: IOfficeSettings;
  leavePolicy: ILeavePolicy;
  notificationSettings: INotificationSettings;
  emailSettings: IEmailSettings;
  securitySettings: ISecuritySettings;
  generalSettings: IGeneralSettings;
  updatedBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const companyProfileSchema = new Schema<ICompanyProfile>(
  {
    name: { type: String, required: true, trim: true, default: "My Company" },
    logoUrl: { type: String, default: null },
    email: { type: String, default: null, trim: true },
    phone: { type: String, default: null, trim: true },
    website: { type: String, default: null, trim: true },
    address: { type: String, default: null, trim: true },
    timezone: { type: String, required: true, default: "Asia/Kolkata" },
  },
  { _id: false }
);

const officeSettingsSchema = new Schema<IOfficeSettings>(
  {
    startTime: { type: String, required: true, default: "10:00" },
    endTime: { type: String, required: true, default: "19:00" },
    gracePeriodMinutes: { type: Number, required: true, default: 15 },
    workingDays: { type: [Number], required: true, default: [1, 2, 3, 4, 5, 6] },
    weekendDays: { type: [Number], required: true, default: [0] },
    geofenceEnabled: { type: Boolean, required: true, default: true },
    latitude: { type: Number, default: 17.4502143 },
    longitude: { type: Number, default: 78.3911328 },
    allowedRadiusMeters: { type: Number, required: true, default: 100 },
    defaultProbationMonths: { type: Number, required: true, default: 3 },
  },
  { _id: false }
);

const leavePolicySchema = new Schema<ILeavePolicy>(
  {
    sickQuotaPerHalf: { type: Number, required: true, default: 3 },
    casualPaidQuotaPerHalf: { type: Number, required: true, default: 3 },
    casualPaidNoticeDays: { type: Number, required: true, default: 4 },
    annualAccrualPerMonth: { type: Number, required: true, default: 1.25 },
    annualNoticeDays: { type: Number, required: true, default: 7 },
    unpaidAllowed: { type: Boolean, required: true, default: true },
    carryForwardEnabled: { type: Boolean, required: true, default: true },
    minDurationDays: { type: Number, required: true, default: 1 },
    maxDurationDays: { type: Number, required: true, default: 30 },
  },
  { _id: false }
);

const notificationEventTogglesSchema = new Schema<INotificationEventToggles>(
  {
    LEAVE_APPLIED: { type: Boolean, required: true, default: true },
    LEAVE_APPROVED: { type: Boolean, required: true, default: true },
    LEAVE_REJECTED: { type: Boolean, required: true, default: true },
    ATTENDANCE_CORRECTION: { type: Boolean, required: true, default: true },
    HOLIDAY_ADDED: { type: Boolean, required: true, default: true },
    ANNOUNCEMENT_PUBLISHED: { type: Boolean, required: true, default: true },
    EMPLOYEE_CREATED: { type: Boolean, required: true, default: true },
    BIRTHDAY: { type: Boolean, required: true, default: true },
    WORK_ANNIVERSARY: { type: Boolean, required: true, default: true },
    PROBATION_ENDING: { type: Boolean, required: true, default: true },
  },
  { _id: false }
);

const notificationSettingsSchema = new Schema<INotificationSettings>(
  {
    inAppEnabled: { type: Boolean, required: true, default: true },
    emailEnabled: { type: Boolean, required: true, default: false },
    events: { type: notificationEventTogglesSchema, required: true, default: () => ({}) },
  },
  { _id: false }
);

const smtpConfigSchema = new Schema<ISmtpConfig>(
  {
    host: { type: String, default: null },
    port: { type: Number, default: null },
    username: { type: String, default: null },
    passwordEncrypted: { type: String, default: null, select: false },
    fromName: { type: String, default: null },
    fromEmail: { type: String, default: null },
  },
  { _id: false }
);

const sesConfigSchema = new Schema<ISesConfig>(
  {
    region: { type: String, default: null },
    accessKeyEncrypted: { type: String, default: null, select: false },
    secretKeyEncrypted: { type: String, default: null, select: false },
    verifiedSender: { type: String, default: null },
  },
  { _id: false }
);

const emailSettingsSchema = new Schema<IEmailSettings>(
  {
    provider: { type: String, enum: Object.values(EMAIL_PROVIDER), required: true, default: EMAIL_PROVIDER.SMTP },
    smtp: { type: smtpConfigSchema, required: true, default: () => ({}) },
    ses: { type: sesConfigSchema, required: true, default: () => ({}) },
  },
  { _id: false }
);

const securitySettingsSchema = new Schema<ISecuritySettings>(
  {
    minPasswordLength: { type: Number, required: true, default: 8 },
    passwordComplexity: { type: Boolean, required: true, default: false },
    maxLoginAttempts: { type: Number, required: true, default: 5 },
    lockoutDurationMinutes: { type: Number, required: true, default: 15 },
    sessionTimeoutMinutes: { type: Number, required: true, default: 10080 }, // 7 days
    accessTokenLifetimeMinutes: { type: Number, required: true, default: 15 },
    refreshTokenLifetimeDays: { type: Number, required: true, default: 7 },
  },
  { _id: false }
);

const generalSettingsSchema = new Schema<IGeneralSettings>(
  {
    dateFormat: { type: String, required: true, default: "DD/MM/YYYY" },
    timeFormat: { type: String, required: true, default: "12h" },
    currency: { type: String, required: true, default: "INR" },
    defaultTimezone: { type: String, required: true, default: "Asia/Kolkata" },
  },
  { _id: false }
);

const configurationSchema = new Schema<IConfiguration>(
  {
    // Fixed, unique value — guarantees at most one Configuration document
    // ever exists (a true singleton), enforced at the database level.
    key: { type: String, required: true, unique: true, default: "singleton" },
    companyProfile: { type: companyProfileSchema, required: true, default: () => ({}) },
    officeSettings: { type: officeSettingsSchema, required: true, default: () => ({}) },
    leavePolicy: { type: leavePolicySchema, required: true, default: () => ({}) },
    notificationSettings: { type: notificationSettingsSchema, required: true, default: () => ({}) },
    emailSettings: { type: emailSettingsSchema, required: true, default: () => ({}) },
    securitySettings: { type: securitySettingsSchema, required: true, default: () => ({}) },
    generalSettings: { type: generalSettingsSchema, required: true, default: () => ({}) },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

export const ConfigurationModel = model<IConfiguration>("Configuration", configurationSchema);
