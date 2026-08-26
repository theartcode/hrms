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

// Used both as a list filter and, from Phase 1C-B, as the body of
// changeWorkItemStatusSchema below.
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

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD").nullable();

export const listWorkItemsSchema = z.object({
  query: z.object({
    product: objectId.optional(),
    project: objectId.optional(),
    workType: workType.optional(),
    priority: priority.optional(),
    status: status.optional(),
    assignedTo: objectId.optional(),
  }),
});

export const workItemIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

const dateOrderRefinement = (data: { startDate?: string | null; dueDate?: string | null }) =>
  !data.startDate || !data.dueDate || data.startDate <= data.dueDate;

export const createWorkItemSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
      description: z.string().trim().max(2000).optional(),
      product: objectId,
      project: objectId.nullable().optional(),
      workType,
      assignedTo: objectId.nullable().optional(),
      reviewer: objectId.nullable().optional(),
      priority: priority.optional().default(IT_PROJECT_PRIORITY.MEDIUM),
      startDate: dateString.optional().default(null),
      dueDate: dateString.optional().default(null),
    })
    .refine(dateOrderRefinement, {
      message: "Start date must not be after due date",
      path: ["dueDate"],
    }),
});

// General edit: title/description/product/project/workType only — never
// assignedTo/reviewer/priority/dates (those go through the dedicated
// /assignment endpoint below) and never status (Phase 1C-B). Same
// separation principle as Phase 1B's updateProjectSchema excluding status.
export const updateWorkItemSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
    description: z.string().trim().max(2000).optional(),
    product: objectId,
    project: objectId.nullable().optional(),
    workType,
  }),
});

export const updateWorkItemAssignmentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      assignedTo: objectId.nullable().optional(),
      reviewer: objectId.nullable().optional(),
      priority: priority.optional().default(IT_PROJECT_PRIORITY.MEDIUM),
      startDate: dateString.optional().default(null),
      dueDate: dateString.optional().default(null),
    })
    .refine(dateOrderRefinement, {
      message: "Start date must not be after due date",
      path: ["dueDate"],
    }),
});

// Generic status endpoint — deliberately cannot target IN_REVIEW or
// COMPLETED (it-work-item.util.ts's getGenericStatusTransitions excludes
// both for every tier); a reason is required only when the target is
// BLOCKED or CANCELLED, matching §12/§13 of the brief.
export const changeWorkItemStatusSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      status,
      reason: z.string().trim().max(1000).optional(),
    })
    .refine((data) => (data.status !== "BLOCKED" && data.status !== "CANCELLED") || !!data.reason, {
      message: "A reason is required for this status",
      path: ["reason"],
    }),
});

export const submitForReviewSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

const reviewDecision = z.enum(["APPROVE", "REQUEST_CHANGES"]);

export const reviewWorkItemSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      decision: reviewDecision,
      reason: z.string().trim().max(1000).optional(),
    })
    .refine((data) => data.decision !== "REQUEST_CHANGES" || !!data.reason, {
      message: "A reason is required to request changes",
      path: ["reason"],
    }),
});

// A team member proposing work for themselves — deliberately no
// assignedTo/reviewer fields (always self-assigned, never reviewed until
// approved) unlike createWorkItemSchema above.
export const proposeWorkItemSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
      description: z.string().trim().max(2000).optional(),
      product: objectId,
      project: objectId.nullable().optional(),
      workType,
      priority: priority.optional().default(IT_PROJECT_PRIORITY.MEDIUM),
      startDate: dateString.optional().default(null),
      dueDate: dateString.optional().default(null),
    })
    .refine(dateOrderRefinement, {
      message: "Start date must not be after due date",
      path: ["dueDate"],
    }),
});

export const approveProposalSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const rejectProposalSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    reason: z.string().trim().min(1, "A reason is required").max(1000),
  }),
});

export const requestProposalChangesSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    note: z.string().trim().min(1, "A note is required").max(1000),
  }),
});

// The proposer revising their own pending proposal — same body shape as
// proposeWorkItemSchema above (everything a proposal can carry).
export const updateProposalSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
      description: z.string().trim().max(2000).optional(),
      product: objectId,
      project: objectId.nullable().optional(),
      workType,
      priority: priority.optional().default(IT_PROJECT_PRIORITY.MEDIUM),
      startDate: dateString.optional().default(null),
      dueDate: dateString.optional().default(null),
    })
    .refine(dateOrderRefinement, {
      message: "Start date must not be after due date",
      path: ["dueDate"],
    }),
});
