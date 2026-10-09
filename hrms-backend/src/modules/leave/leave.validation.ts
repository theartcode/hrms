import { z } from "zod";
import { LEAVE_REQUEST_STATUS, LEAVE_TYPES } from "../../shared/constants/leaveTypes";
import { LEAVE_IMPORT_SOURCE, LEAVE_IMPORT_STATUS } from "./leave-import-record.model";
import { ADJUSTABLE_BALANCE_FIELDS } from "./leave-balance-adjustment.model";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const applyLeaveSchema = z.object({
  body: z.object({
    leaveType: z.enum(Object.values(LEAVE_TYPES) as [string, ...string[]]),
    startDate: dateString,
    endDate: dateString,
    isHalfDay: z.coerce.boolean().optional(),
    reason: z.string().trim().min(5, "Please provide a reason (at least 5 characters)"),
  }),
});

export const listLeavesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(Object.values(LEAVE_REQUEST_STATUS) as [string, ...string[]]).optional(),
    leaveType: z.enum(Object.values(LEAVE_TYPES) as [string, ...string[]]).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
});

export const adminListLeavesSchema = z.object({
  query: listLeavesSchema.shape.query.extend({
    employeeId: objectId.optional(),
    department: objectId.optional(),
    designation: objectId.optional(),
  }),
});

export const balanceQuerySchema = z.object({
  query: z.object({
    employeeId: objectId.optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
});

export const leaveIdParamSchema = z.object({
  params: z.object({ id: objectId }),
});

export const markDayAsLeaveSchema = z.object({
  body: z.object({
    employeeId: objectId,
    date: dateString,
    leaveType: z.enum(Object.values(LEAVE_TYPES) as [string, ...string[]]),
    reason: z.string().trim().max(500).optional(),
  }),
});

export const reviewLeaveSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    comment: z.string().trim().max(500).optional(),
  }),
});

export const grantExtraLeaveSchema = z.object({
  body: z.object({
    employeeId: objectId,
    days: z.coerce.number().positive("Days must be greater than 0"),
    reason: z.string().trim().min(3, "Reason required"),
    leaveType: z.enum(Object.values(LEAVE_TYPES) as [string, ...string[]]).optional(),
    period: z.enum(["H1", "H2", "ANNUAL"]).optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
  }),
});

export const adjustBalanceSchema = z.object({
  params: z.object({ employeeId: objectId }),
  body: z.object({
    leaveType: z.enum(Object.values(LEAVE_TYPES) as [string, ...string[]]),
    period: z.enum(["H1", "H2", "ANNUAL"]).optional(),
    year: z.coerce.number().int().min(2000).max(2100),
    delta: z.coerce.number().refine((value) => value !== 0, "Change must not be zero"),
    reason: z.string().trim().min(3, "Reason required"),
  }),
});

export const updateAllocationSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    days: z.coerce.number().positive("Days must be greater than 0").optional(),
    reason: z.string().trim().min(3, "Reason required").optional(),
  }),
});

export const employeeIdParamSchema = z.object({
  params: z.object({ employeeId: objectId }),
});

const importRowSchema = z
  .object({
    leaveType: z.enum(Object.values(LEAVE_TYPES) as [string, ...string[]]),
    startDate: dateString,
    endDate: dateString,
    days: z.coerce.number().positive("Days must be greater than 0"),
    // PENDING is deliberately not accepted — a still-open row from a
    // retired system is a live business problem to resolve before import,
    // not migration data.
    status: z.enum(Object.values(LEAVE_IMPORT_STATUS) as [string, ...string[]]),
    reason: z.string().trim().max(500).optional(),
    externalReference: z.string().trim().max(200).optional(),
  })
  .refine((row) => row.endDate >= row.startDate, {
    message: "endDate must not be before startDate",
    path: ["endDate"],
  });

export const importLeaveHistorySchema = z.object({
  params: z.object({ employeeId: objectId }),
  body: z.object({
    source: z.enum(Object.values(LEAVE_IMPORT_SOURCE) as [string, ...string[]]),
    sourceFilename: z.string().trim().max(255).optional(),
    // Whole-batch validation: every row must pass before any row is
    // written — see importHistoricalLeave in leave.service.ts.
    rows: z.array(importRowSchema).min(1, "Provide at least one row to import"),
  }),
});

export const confirmLeaveMigrationSchema = z.object({
  params: z.object({ employeeId: objectId }),
  body: z.object({
    reason: z.string().trim().min(3, "Reason required"),
    adjustments: z
      .array(
        z.object({
          field: z.enum(ADJUSTABLE_BALANCE_FIELDS),
          newValue: z.coerce.number().min(0),
        })
      )
      .default([]),
  }),
});

export const deleteImportBatchSchema = z.object({
  params: z.object({ employeeId: objectId, batchId: z.string().min(1) }),
});
