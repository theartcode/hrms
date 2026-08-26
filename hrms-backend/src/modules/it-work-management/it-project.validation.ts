import { z } from "zod";
import { IT_PROJECT_STATUS, IT_PROJECT_PRIORITY } from "../../shared/constants/itProjectTypes";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const projectStatus = z.enum([
  IT_PROJECT_STATUS.PLANNED,
  IT_PROJECT_STATUS.ACTIVE,
  IT_PROJECT_STATUS.ON_HOLD,
  IT_PROJECT_STATUS.COMPLETED,
  IT_PROJECT_STATUS.CANCELLED,
]);

const projectPriority = z.enum([
  IT_PROJECT_PRIORITY.URGENT,
  IT_PROJECT_PRIORITY.HIGH,
  IT_PROJECT_PRIORITY.MEDIUM,
  IT_PROJECT_PRIORITY.LOW,
]);

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").nullable();

export const listProjectsSchema = z.object({
  query: z.object({
    product: objectId.optional(),
    status: projectStatus.optional(),
    priority: projectPriority.optional(),
    owner: objectId.optional(),
  }),
});

export const projectIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

// Status is deliberately absent from the update body — same separation as
// the existing Task module (updateTaskSchema never accepts `status` either):
// status changes always go through the dedicated, transition-checked
// /status endpoint, never the general edit endpoint.
const projectEditableFields = {
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(150),
  description: z.string().trim().max(1000).optional(),
  product: objectId,
  owner: objectId,
  priority: projectPriority.optional().default(IT_PROJECT_PRIORITY.MEDIUM),
  startDate: dateString.optional().default(null),
  targetDate: dateString.optional().default(null),
};

const dateOrderRefinement = (data: { startDate?: string | null; targetDate?: string | null }) =>
  !data.startDate || !data.targetDate || data.startDate <= data.targetDate;

export const createProjectSchema = z.object({
  body: z
    .object({
      ...projectEditableFields,
      status: projectStatus.optional().default(IT_PROJECT_STATUS.PLANNED),
    })
    .refine(dateOrderRefinement, {
      message: "Start date must not be after target date",
      path: ["targetDate"],
    }),
});

export const updateProjectSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object(projectEditableFields).refine(dateOrderRefinement, {
    message: "Start date must not be after target date",
    path: ["targetDate"],
  }),
});

export const changeProjectStatusSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    status: projectStatus,
  }),
});
