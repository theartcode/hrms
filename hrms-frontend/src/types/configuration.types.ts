export interface CompanyProfile {
  name: string;
  logoUrl: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  timezone: string;
}

export interface OfficeSettings {
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
  workingDays: number[];
  weekendDays: number[];
  defaultProbationMonths: number;
}

export interface LeavePolicy {
  sickQuotaPerHalf: number;
  casualPaidQuotaPerHalf: number;
  casualPaidNoticeDays: number;
  annualAccrualPerMonth: number;
  annualNoticeDays: number;
  leaveTypeSettings?: Partial<Record<"SICK" | "CASUAL_PAID" | "ANNUAL" | "UNPAID" | "COMP_OFF", LeaveTypePolicy>>;
  unpaidAllowed: boolean;
  carryForwardEnabled: boolean;
  minDurationDays: number;
  maxDurationDays: number;
}

export interface LeaveTypePolicy {
  advanceNoticeDays: number;
  // null means "no minimum" — only Max Duration is enforced for this type.
  minDurationDays: number | null;
  maxDurationDays: number;
  includeWeekends?: boolean;
  carryForwardEnabled?: boolean;
}

export interface NotificationEventToggles {
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

export interface NotificationSettings {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  events: NotificationEventToggles;
}

export type EmailProvider = "SMTP" | "SES";

export interface SmtpSettingsPublic {
  host: string | null;
  port: number | null;
  username: string | null;
  hasPassword: boolean;
  fromName: string | null;
  fromEmail: string | null;
}

export interface SesSettingsPublic {
  region: string | null;
  hasAccessKey: boolean;
  hasSecretKey: boolean;
  verifiedSender: string | null;
}

export interface EmailSettingsPublic {
  provider: EmailProvider;
  smtp: SmtpSettingsPublic;
  ses: SesSettingsPublic;
}

export interface SecuritySettings {
  minPasswordLength: number;
  passwordComplexity: boolean;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  sessionTimeoutMinutes: number;
  accessTokenLifetimeMinutes: number;
  refreshTokenLifetimeDays: number;
}

export interface GeneralSettings {
  dateFormat: string;
  timeFormat: "12h" | "24h";
  currency: string;
  defaultTimezone: string;
}

export interface Configuration {
  id: string;
  companyProfile: CompanyProfile;
  officeSettings: OfficeSettings;
  leavePolicy: LeavePolicy;
  notificationSettings: NotificationSettings;
  emailSettings: EmailSettingsPublic;
  securitySettings: SecuritySettings;
  generalSettings: GeneralSettings;
  updatedBy: string | null;
  updatedAt: string;
}
