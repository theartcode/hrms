import { z } from "zod";
import { ATTENDANCE_STATUS } from "../../shared/constants/attendanceStatus";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

export const monthQuerySchema = z.object({
  query: z.object({
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    employeeId: objectId.optional(),
  }),
});

export const adminListQuerySchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    date: dateString.optional(),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    month: z.coerce.number().int().min(1).max(12).optional(),
    department: objectId.optional(),
    designation: objectId.optional(),
    employeeId: objectId.optional(),
    status: z.enum(Object.values(ATTENDANCE_STATUS) as [string, ...string[]]).optional(),
  }),
});

export const notCheckedInQuerySchema = z.object({
  query: z.object({
    date: dateString.optional(),
  }),
});

export const exportQuerySchema = z.object({
  query: adminListQuerySchema.shape.query.omit({ page: true, limit: true }),
});

export const checkInSchema = z.object({
  body: z.object({
    latitude: z.coerce.number().min(-90).max(90).optional(),
    longitude: z.coerce.number().min(-180).max(180).optional(),
  }).optional(),
});

export const checkOutSchema = checkInSchema;

const nullableDateTime = z.union([z.null(), z.coerce.date()]);

export const adminSetAttendanceSchema = z.object({
  params: z.object({
    employeeId: objectId,
    date: dateString,
  }),
  body: z.object({
    checkIn: nullableDateTime,
    checkOut: nullableDateTime,
  }),
});
