import { z } from "zod";
import { IT_WORK_ITEM_STATUS } from "../../shared/constants/itWorkItemTypes";
import { IT_PROJECT_PRIORITY } from "../../shared/constants/itProjectTypes";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const priority = z.enum([
  IT_PROJECT_PRIORITY.URGENT,
  IT_PROJECT_PRIORITY.HIGH,
  IT_PROJECT_PRIORITY.MEDIUM,
  IT_PROJECT_PRIORITY.LOW,
]);

const status = z.enum([
  IT_WORK_ITEM_STATUS.REQUESTED,
  IT_WORK_ITEM_STATUS.ANALYSIS,
  IT_WORK_ITEM_STATUS.PLANNED,
  IT_WORK_ITEM_STATUS.ASSIGNED,
  IT_WORK_ITEM_STATUS.IN_PROGRESS,
  IT_WORK_ITEM_STATUS.IN_REVIEW,
  IT_WORK_ITEM_STATUS.COMPLETED,
  IT_WORK_ITEM_STATUS.BLOCKED,
  IT_WORK_ITEM_STATUS.CANCELLED,
]);

export const getDashboardSchema = z.object({
  query: z.object({
    product: objectId.optional(),
    project: objectId.optional(),
    assignedTo: objectId.optional(),
    priority: priority.optional(),
    status: status.optional(),
  }),
});
