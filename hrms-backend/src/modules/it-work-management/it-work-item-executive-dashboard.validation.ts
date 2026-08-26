import { z } from "zod";
import { IT_WORK_TYPE, IT_WORK_ITEM_STATUS } from "../../shared/constants/itWorkItemTypes";
import { IT_PROJECT_PRIORITY } from "../../shared/constants/itProjectTypes";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const workType = z.enum([
  IT_WORK_TYPE.NEW_WEBSITE,
  IT_WORK_TYPE.EXISTING_WEBSITE_CHANGE,
  IT_WORK_TYPE.HRMS_DEVELOPMENT,
  IT_WORK_TYPE.BUG_FIX,
  IT_WORK_TYPE.CLIENT_REQUEST,
  IT_WORK_TYPE.INTERNAL_IT_SUPPORT,
  IT_WORK_TYPE.SERVER_DEPLOYMENT,
  IT_WORK_TYPE.UI_UX,
  IT_WORK_TYPE.RESEARCH,
  IT_WORK_TYPE.MAINTENANCE,
]);

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

export const getExecutiveDashboardSchema = z.object({
  query: z.object({
    product: objectId.optional(),
    project: objectId.optional(),
    assignedTo: objectId.optional(),
    priority: priority.optional(),
    status: status.optional(),
    workType: workType.optional(),
    search: z.string().trim().max(100).optional(),
  }),
});
