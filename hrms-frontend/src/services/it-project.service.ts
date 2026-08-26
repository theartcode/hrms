import { apiFetch } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/constants/api-endpoints";
import { ItProject, ItProjectPriority, ItProjectStatus } from "@/types/it-work-management.types";

type ApiSuccess<T> = { success: true; message: string; data: T };

export interface ItProjectFilters {
  product?: string;
  status?: ItProjectStatus;
  priority?: ItProjectPriority;
  owner?: string;
}

export interface ItProjectInput {
  name: string;
  description?: string;
  product: string;
  owner: string;
  priority: ItProjectPriority;
  startDate: string | null;
  targetDate: string | null;
}

function buildQuery(filters: ItProjectFilters): string {
  const params = new URLSearchParams();
  if (filters.product) params.set("product", filters.product);
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.owner) params.set("owner", filters.owner);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export const itProjectService = {
  list(filters: ItProjectFilters = {}) {
    return apiFetch<ApiSuccess<{ projects: ItProject[] }>>(
      `${API_ENDPOINTS.IT_WORK_MANAGEMENT.PROJECTS.LIST}${buildQuery(filters)}`
    ).then((res) => res.data.projects);
  },
  get(id: string) {
    return apiFetch<ApiSuccess<{ project: ItProject }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.PROJECTS.DETAIL(id)
    ).then((res) => res.data.project);
  },
  create(input: ItProjectInput & { status: ItProjectStatus }) {
    return apiFetch<ApiSuccess<{ project: ItProject }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.PROJECTS.CREATE,
      { method: "POST", body: JSON.stringify(input) }
    ).then((res) => res.data.project);
  },
  update(id: string, input: ItProjectInput) {
    return apiFetch<ApiSuccess<{ project: ItProject }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.PROJECTS.UPDATE(id),
      { method: "PATCH", body: JSON.stringify(input) }
    ).then((res) => res.data.project);
  },
  changeStatus(id: string, status: ItProjectStatus) {
    return apiFetch<ApiSuccess<{ project: ItProject }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.PROJECTS.STATUS(id),
      { method: "PATCH", body: JSON.stringify({ status }) }
    ).then((res) => res.data.project);
  },
  // Any Work Item still linked to this project is unlinked (project set to
  // null, shown as "No Project") by the backend before deletion — the Work
  // Items themselves are never deleted.
  remove(id: string) {
    return apiFetch<ApiSuccess<Record<string, never>>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.PROJECTS.DETAIL(id),
      { method: "DELETE" }
    );
  },
};
