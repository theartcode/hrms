import { z } from "zod";
import { ROLES } from "../../shared/constants/roles";
import { EMPLOYEE_STATUS } from "../../shared/constants/employeeStatus";
import { GENDER } from "../../shared/constants/gender";
import { STATUTORY_STATUS } from "../../shared/constants/statutoryStatus";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9\s-]{6,18}$/, "Enter a valid phone number");
// An optional date field whose client-side counterpart is a plain
// <input type="date">: an unset value arrives as "", which z.coerce.date()
// would otherwise turn into an Invalid Date and reject outright rather
// than treating as "not provided." Treated as undefined instead.
const optionalDate = z
  .union([z.literal(""), z.coerce.date()])
  .optional()
  .transform((v) => (v === "" ? undefined : v));
// Unlike optionalDate, an empty value here is meaningful — it means
// "clear the override, go back to the company default" — so it maps to
// null (an explicit value to save), not undefined (field left untouched).
// z.null() has to be listed explicitly, not just z.literal("") — without it,
// a literal JSON `null` falls through to z.coerce.number(), and
// Number(null) === 0, silently saving "0 minutes grace" instead of clearing
// the override.
const optionalGraceMinutes = z
  .union([z.literal(""), z.null(), z.coerce.number().int().min(0).max(480)])
  .optional()
  .transform((v) => (v === "" || v === null ? null : v));
// Same "explicit clear vs. don't touch" shape as optionalGraceMinutes,
// for an ObjectId reference field (manager, location) that can be unset.
const optionalObjectIdOrNull = z
  .union([z.literal(""), z.null(), objectId])
  .optional()
  .transform((v) => (v === "" ? null : v));
const optionalTime = z
  .union([z.literal(""), z.null(), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm")])
  .optional()
  .transform((v) => (v === "" ? null : v));
// Same "explicit clear vs. don't touch" shape as optionalGraceMinutes, for
// a date field that (unlike joiningDate) is legitimately clearable — e.g.
// correcting a mistaken auto-filled probation end date back to "not tracked."
const optionalDateOrNull = z
  .union([z.literal(""), z.null(), z.coerce.date()])
  .optional()
  .transform((v) => (v === "" || v === null ? null : v));
const paymentInfoInput = z
  .object({
    ifscCode: z.string().trim().min(1),
    accountNumber: z.string().trim().min(1),
    accountHolderName: z.string().trim().min(1),
  })
  .optional()
  .nullable();
const statutoryStatusEnum = z.enum(
  Object.values(STATUTORY_STATUS) as [string, ...string[]]
);
const statutoryInfoInput = z
  .object({
    pan: z.string().trim().optional().nullable(),
    pfStatus: statutoryStatusEnum.optional(),
    pfUan: z.string().trim().optional().nullable(),
    professionalTaxStatus: statutoryStatusEnum.optional(),
    lwfStatus: statutoryStatusEnum.optional(),
    esicStatus: statutoryStatusEnum.optional(),
    esicIpNumber: z.string().trim().optional().nullable(),
  })
  .optional()
  .nullable();

export const listEmployeesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10),
    search: z.string().trim().optional(),
    department: objectId.optional(),
    designation: objectId.optional(),
    role: z.enum(Object.values(ROLES) as [string, ...string[]]).optional(),
    status: z
      .enum(Object.values(EMPLOYEE_STATUS) as [string, ...string[]])
      .optional(),
    sortBy: z
      .enum(["fullName", "employeeId", "joiningDate", "createdAt"])
      .optional()
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  }),
});

export const createEmployeeSchema = z.object({
  body: z.object({
    employeeId: z.string().trim().optional(),
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
    email: z.string().trim().email("Enter a valid email address"),
    phone,
    department: objectId,
    designation: objectId,
    joiningDate: z.coerce.date(),
    dateOfBirth: optionalDate,
    role: z.enum([ROLES.EMPLOYEE, ROLES.ADMIN]),
    salary: z.coerce.number().min(0).optional().nullable(),
    bloodGroup: z.string().trim().max(10).optional().nullable(),
    status: z
      .enum(Object.values(EMPLOYEE_STATUS) as [string, ...string[]])
      .optional()
      .default(EMPLOYEE_STATUS.ACTIVE),
  }),
});

export const updateEmployeeSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    employeeId: z.string().trim().min(1).optional(),
    fullName: z.string().trim().min(2).optional(),
    phone: phone.optional(),
    department: objectId.optional(),
    designation: objectId.optional(),
    // Unlike dateOfBirth, joiningDate can never be cleared to "no value" on
    // the model (it's required, not nullable) — only ever corrected to
    // another real date, so this has no "" -> undefined transform to make.
    joiningDate: z.coerce.date().optional(),
    probationEndDate: optionalDateOrNull,
    dateOfBirth: optionalDate,
    gracePeriodOverrideMinutes: optionalGraceMinutes,
    salary: z.coerce.number().min(0).optional().nullable(),
    bloodGroup: z.string().trim().max(10).optional().nullable(),
    profilePhoto: z.string().trim().optional().nullable(),
    // SUPER_ADMIN not assignable here, same restriction as creation.
    role: z.enum([ROLES.EMPLOYEE, ROLES.ADMIN]).optional(),
    status: z
      .enum(Object.values(EMPLOYEE_STATUS) as [string, ...string[]])
      .optional(),
    manager: optionalObjectIdOrNull,
    location: optionalObjectIdOrNull,
    gender: z
      .enum(Object.values(GENDER) as [string, ...string[]])
      .optional()
      .nullable(),
    whatsappEnabled: z.boolean().optional(),
    shiftStartTime: optionalTime,
    shiftEndTime: optionalTime,
    numberOfBonuses: z.coerce.number().int().min(0).optional().nullable(),
    advanceSalaryBalance: z.coerce.number().min(0).optional().nullable(),
    advanceSalaryEmi: z.coerce.number().min(0).optional().nullable(),
    paymentInfo: paymentInfoInput,
    statutoryInfo: statutoryInfoInput,
  }),
});

export const getEmployeeSchema = z.object({
  params: z.object({ id: objectId }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    phone: phone.optional(),
    dateOfBirth: optionalDate,
    address: z.string().trim().max(500).optional(),
    profilePhoto: z.string().trim().optional().nullable(),
    emergencyContact: z
      .object({
        name: z.string().trim().min(2),
        phone,
      })
      .optional(),
  }),
});

// Self-service bank details submission — always all three fields (this
// never partially updates paymentInfo directly; it replaces whatever
// pending proposal exists), unlike updateEmployeeSchema's admin-only
// paymentInfo which can also be cleared to null.
export const submitPaymentInfoSchema = z.object({
  body: z.object({
    ifscCode: z.string().trim().min(1, "IFSC code is required"),
    accountNumber: z.string().trim().min(1, "Account number is required"),
    accountHolderName: z.string().trim().min(1, "Account holder name is required"),
  }),
});

export const reviewPaymentInfoSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    comment: z.string().trim().max(500).optional(),
  }),
});
