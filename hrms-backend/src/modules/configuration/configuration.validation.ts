import { z } from "zod";
import { EMAIL_PROVIDER } from "./configuration.model";

export const sendTestEmailSchema = z.object({
  body: z.object({
    to: z.string().trim().email().optional(),
  }),
});

export const updateCompanyProfileSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1).max(200).optional(),
    // Set only by the logo upload endpoint now (an internal, app-relative
    // path like "/public/company-logo"), never typed in by a user — so
    // this no longer validates as an absolute URL, just a non-empty path.
    logoUrl: z.string().trim().min(1).nullable().optional(),
    email: z.string().trim().email().nullable().optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    website: z.string().trim().url().nullable().optional(),
    address: z.string().trim().max(500).nullable().optional(),
    timezone: z.string().trim().min(1).optional(),
  }),
});

const timeString = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:mm (24h)");
const weekday = z.number().int().min(0).max(6);

export const updateOfficeSettingsSchema = z.object({
  body: z.object({
    startTime: timeString.optional(),
    endTime: timeString.optional(),
    gracePeriodMinutes: z.coerce.number().int().min(0).max(120).optional(),
    workingDays: z.array(weekday).min(1).max(7).optional(),
    weekendDays: z.array(weekday).min(0).max(7).optional(),
    geofenceEnabled: z.coerce.boolean().optional(),
    latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
    longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
    allowedRadiusMeters: z.coerce.number().min(10).max(10000).optional(),
    defaultProbationMonths: z.coerce.number().int().min(0).max(24).optional(),
  }),
});

const leaveTypePolicyShape = z.object({
  advanceNoticeDays: z.coerce.number().int().min(0).max(365),
  // null means "no minimum" — explicitly listed first so JSON null isn't
  // coerced to 0 by the number branch (same pattern as
  // employee.validation.ts's optionalGraceMinutes).
  minDurationDays: z.union([z.null(), z.coerce.number().int().min(1).max(365)]),
  maxDurationDays: z.coerce.number().int().min(1).max(365),
  includeWeekends: z.coerce.boolean().optional(),
  carryForwardEnabled: z.coerce.boolean().optional(),
});

export const updateLeavePolicySchema = z.object({
  body: z.object({
    sickQuotaPerHalf: z.coerce.number().int().min(0).max(365).optional(),
    casualPaidQuotaPerHalf: z.coerce.number().int().min(0).max(365).optional(),
    casualPaidNoticeDays: z.coerce.number().int().min(0).max(365).optional(),
    annualAccrualPerMonth: z.coerce.number().min(0).max(31).optional(),
    annualNoticeDays: z.coerce.number().int().min(0).max(365).optional(),
    leaveTypeSettings: z
      .object({
        SICK: leaveTypePolicyShape.optional(),
        CASUAL_PAID: leaveTypePolicyShape.optional(),
        ANNUAL: leaveTypePolicyShape.optional(),
        UNPAID: leaveTypePolicyShape.optional(),
        COMP_OFF: leaveTypePolicyShape.optional(),
      })
      .optional(),
    unpaidAllowed: z.coerce.boolean().optional(),
    carryForwardEnabled: z.coerce.boolean().optional(),
    minDurationDays: z.coerce.number().int().min(1).max(365).optional(),
    maxDurationDays: z.coerce.number().int().min(1).max(365).optional(),
  }),
});

const notificationEventTogglesSchema = z.object({
  LEAVE_APPROVED: z.coerce.boolean().optional(),
  LEAVE_REJECTED: z.coerce.boolean().optional(),
  ATTENDANCE_CORRECTION: z.coerce.boolean().optional(),
  HOLIDAY_ADDED: z.coerce.boolean().optional(),
  ANNOUNCEMENT_PUBLISHED: z.coerce.boolean().optional(),
  EMPLOYEE_CREATED: z.coerce.boolean().optional(),
});

export const updateNotificationSettingsSchema = z.object({
  body: z.object({
    inAppEnabled: z.coerce.boolean().optional(),
    emailEnabled: z.coerce.boolean().optional(),
    events: notificationEventTogglesSchema.optional(),
  }),
});

export const updateEmailSettingsSchema = z.object({
  body: z.object({
    provider: z.enum([EMAIL_PROVIDER.SMTP, EMAIL_PROVIDER.SES]).optional(),
    smtp: z
      .object({
        host: z.string().trim().max(255).optional(),
        port: z.coerce.number().int().min(1).max(65535).optional(),
        username: z.string().trim().max(255).optional(),
        password: z.string().max(500).optional(),
        fromName: z.string().trim().max(200).optional(),
        fromEmail: z.string().trim().email().optional(),
      })
      .optional(),
    ses: z
      .object({
        region: z.string().trim().max(50).optional(),
        accessKey: z.string().max(500).optional(),
        secretKey: z.string().max(500).optional(),
        verifiedSender: z.string().trim().email().optional(),
      })
      .optional(),
  }),
});

export const updateSecuritySettingsSchema = z.object({
  body: z.object({
    minPasswordLength: z.coerce.number().int().min(6).max(128).optional(),
    passwordComplexity: z.coerce.boolean().optional(),
    maxLoginAttempts: z.coerce.number().int().min(3).max(20).optional(),
    lockoutDurationMinutes: z.coerce.number().int().min(1).max(1440).optional(),
    sessionTimeoutMinutes: z.coerce.number().int().min(5).max(43200).optional(),
    accessTokenLifetimeMinutes: z.coerce.number().int().min(1).max(1440).optional(),
    refreshTokenLifetimeDays: z.coerce.number().int().min(1).max(90).optional(),
  }),
});

export const updateGeneralSettingsSchema = z.object({
  body: z.object({
    dateFormat: z.string().trim().min(1).max(20).optional(),
    timeFormat: z.enum(["12h", "24h"]).optional(),
    currency: z.string().trim().min(1).max(10).optional(),
    defaultTimezone: z.string().trim().min(1).optional(),
  }),
});
