import { z } from "zod";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

const addScheduleEntryBody = z.object({
  date: dateString,
  workItem: objectId,
  note: z.string().trim().max(500).optional(),
});

export const addMyScheduleEntrySchema = z.object({
  body: addScheduleEntryBody,
});

export const addEmployeeScheduleEntrySchema = z.object({
  params: z.object({ employeeId: objectId }),
  body: addScheduleEntryBody,
});

export const updateMyScheduleEntrySchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    note: z.string().trim().max(500).optional().default(""),
  }),
});

export const scheduleEntryIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const employeeIdParamSchema = z.object({
  params: z.object({ employeeId: objectId }),
});

export const employeeScheduleEntryIdParamSchema = z.object({
  params: z.object({ employeeId: objectId, id: z.string().min(1) }),
});
