import { z } from "zod";

export const listLocationsSchema = z.object({
  query: z.object({
    includeInactive: z.coerce.boolean().optional().default(false),
  }),
});

export const createLocationSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
  }),
});

export const updateLocationSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    name: z.string().trim().min(2, "Name must be at least 2 characters"),
  }),
});

export const setLocationActiveSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});
