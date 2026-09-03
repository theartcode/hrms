import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const saveTodayTimesheetSchema = z.object({
  body: z.object({
    description: z.string().trim().max(2000).optional().default(""),
    workItems: z.array(objectId).max(20).optional().default([]),
  }),
});

export const myTimesheetHistorySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
  }),
});

export const teamTimesheetSchema = z.object({
  query: z.object({
    date: dateString.optional(),
    employee: objectId.optional(),
    status: z.enum(["DRAFT", "SUBMITTED", "NOT_STARTED"]).optional(),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const timesheetIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
