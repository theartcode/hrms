import { apiFetch } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/constants/api-endpoints";
import {
  ItProjectPriority,
  ItWorkItem,
  ItWorkItemActivityEntry,
  ItWorkItemReviewDecision,
  ItWorkItemStatus,
  ItWorkType,
} from "@/types/it-work-management.types";

type ApiSuccess<T> = { success: true; message: string; data: T };

export interface ItWorkItemFilters {
  product?: string;
  project?: string;
  workType?: ItWorkType;
  priority?: ItProjectPriority;
  status?: ItWorkItemStatus;
  assignedTo?: string;
}

export interface ItWorkItemCreateInput {
  title: string;
  description?: string;
  product: string;
  project: string | null;
  workType: ItWorkType;
  assignedTo: string | null;
  reviewer: string | null;
  priority: ItProjectPriority;
  startDate: string | null;
  dueDate: string | null;
}

export interface ItWorkItemEditInput {
  title: string;
  description?: string;
  product: string;
  project: string | null;
  workType: ItWorkType;
}

export interface ItWorkItemAssignmentInput {
  assignedTo: string | null;
  reviewer: string | null;
  priority: ItProjectPriority;
  startDate: string | null;
  dueDate: string | null;
}

// A team member proposing work for themselves — no assignedTo/reviewer
// fields, unlike ItWorkItemCreateInput above (always self-assigned, never
// reviewed until approved).
export interface ItWorkItemProposeInput {
  title: string;
  description?: string;
  product: string;
  project: string | null;
  workType: ItWorkType;
  priority: ItProjectPriority;
  startDate: string | null;
  dueDate: string | null;
}

function buildQuery(filters: ItWorkItemFilters): string {
  const params = new URLSearchParams();
  if (filters.product) params.set("product", filters.product);
  if (filters.project) params.set("project", filters.project);
  if (filters.workType) params.set("workType", filters.workType);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.status) params.set("status", filters.status);
  if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const itWorkItemService = {
  list(filters: ItWorkItemFilters = {}) {
    return apiFetch<ApiSuccess<{ workItems: ItWorkItem[] }>>(
      `${API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.LIST}${buildQuery(filters)}`
    ).then((res) => res.data.workItems);
  },
  get(id: string) {
    return apiFetch<ApiSuccess<{ workItem: ItWorkItem }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.DETAIL(id)
    ).then((res) => res.data.workItem);
  },
  create(input: ItWorkItemCreateInput) {
    return apiFetch<ApiSuccess<{ workItem: ItWorkItem }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.CREATE,
      { method: "POST", body: JSON.stringify(input) }
    ).then((res) => res.data.workItem);
  },
  update(id: string, input: ItWorkItemEditInput) {
    return apiFetch<ApiSuccess<{ workItem: ItWorkItem }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.UPDATE(id),
      { method: "PATCH", body: JSON.stringify(input) }
    ).then((res) => res.data.workItem);
  },
  updateAssignment(id: string, input: ItWorkItemAssignmentInput) {
    return apiFetch<ApiSuccess<{ workItem: ItWorkItem }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.ASSIGNMENT(id),
      { method: "PATCH", body: JSON.stringify(input) }
    ).then((res) => res.data.workItem);
  },
  // Generic status endpoint — cannot target IN_REVIEW/COMPLETED (the
  // backend rejects those; use submitForReview/review below instead).
  // `reason` is required by the backend when status is BLOCKED or CANCELLED.
  changeStatus(id: string, status: ItWorkItemStatus, reason?: string) {
    return apiFetch<ApiSuccess<{ workItem: ItWorkItem }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.STATUS(id),
      { method: "PATCH", body: JSON.stringify({ status, reason }) }
    ).then((res) => res.data.workItem);
  },
  submitForReview(id: string) {
    return apiFetch<ApiSuccess<{ workItem: ItWorkItem }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.SUBMIT_REVIEW(id),
      { method: "POST" }
    ).then((res) => res.data.workItem);
  },
  review(id: string, decision: ItWorkItemReviewDecision, reason?: string) {
    return apiFetch<ApiSuccess<{ workItem: ItWorkItem }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.REVIEW(id),
      { method: "POST", body: JSON.stringify({ decision, reason }) }
    ).then((res) => res.data.workItem);
  },
  activity(id: string) {
    return apiFetch<ApiSuccess<{ activity: ItWorkItemActivityEntry[] }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.ACTIVITY(id)
    ).then((res) => res.data.activity);
  },
  propose(input: ItWorkItemProposeInput) {
    return apiFetch<ApiSuccess<{ workItem: ItWorkItem }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.PROPOSE,
      { method: "POST", body: JSON.stringify(input) }
    ).then((res) => res.data.workItem);
  },
  approveProposal(id: string) {
    return apiFetch<ApiSuccess<{ workItem: ItWorkItem }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.APPROVE_PROPOSAL(id),
      { method: "POST" }
    ).then((res) => res.data.workItem);
  },
  rejectProposal(id: string, reason: string) {
    return apiFetch<ApiSuccess<{ workItem: ItWorkItem }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.REJECT_PROPOSAL(id),
      { method: "POST", body: JSON.stringify({ reason }) }
    ).then((res) => res.data.workItem);
  },
  requestProposalChanges(id: string, note: string) {
    return apiFetch<ApiSuccess<{ workItem: ItWorkItem }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.REQUEST_PROPOSAL_CHANGES(id),
      { method: "POST", body: JSON.stringify({ note }) }
    ).then((res) => res.data.workItem);
  },
  // The proposer revising their own still-pending proposal — same body
  // shape as propose() above.
  updateProposal(id: string, input: ItWorkItemProposeInput) {
    return apiFetch<ApiSuccess<{ workItem: ItWorkItem }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.UPDATE_PROPOSAL(id),
      { method: "PATCH", body: JSON.stringify(input) }
    ).then((res) => res.data.workItem);
  },
};
