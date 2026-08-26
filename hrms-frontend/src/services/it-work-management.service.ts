import { apiFetch } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/constants/api-endpoints";
import {
  ItExecutiveDashboard,
  ItHeadDashboard,
  ItMyDashboard,
  ItProjectPriority,
  ItWorkItemStatus,
  ItWorkType,
} from "@/types/it-work-management.types";

type ApiSuccess<T> = { success: true; message: string; data: T };
export type ItAccessTier = "manage" | "team" | "readonly" | "none";

export interface ItReadOnlyViewer {
  id: string;
  fullName: string;
  employeeId: string;
}

export function myItAccess() {
  return apiFetch<ApiSuccess<{ tier: ItAccessTier }>>(API_ENDPOINTS.IT_WORK_MANAGEMENT.ACCESS_ME);
}

export interface ItHeadDashboardFilters {
  product?: string;
  project?: string;
  assignedTo?: string;
  priority?: ItProjectPriority;
  status?: ItWorkItemStatus;
}

// Phase 1E-A — itManage-gated on the backend (IT Head/Admin/Super Admin
// only); never called for a team/readonly-tier user (see it-head-dashboard.tsx).
// Filters narrow the same underlying Work Item set every dashboard section
// is derived from; Recent Activity / Today's Team Activity stay unfiltered.
export function getItHeadDashboard(filters: ItHeadDashboardFilters = {}) {
  const params = new URLSearchParams();
  if (filters.product) params.set("product", filters.product);
  if (filters.project) params.set("project", filters.project);
  if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return apiFetch<ApiSuccess<{ dashboard: ItHeadDashboard }>>(
    `${API_ENDPOINTS.IT_WORK_MANAGEMENT.DASHBOARD}${qs ? `?${qs}` : ""}`
  ).then((res) => res.data.dashboard);
}

export interface ItMyDashboardFilters {
  product?: string;
  project?: string;
  workType?: ItWorkType;
  priority?: ItProjectPriority;
  status?: ItWorkItemStatus;
  search?: string;
}

// Phase 1E-B — itTeamOnly-gated on the backend (exactly the "team" tier;
// never manage, never readonly). Scope is derived from authentication on
// the backend — there is deliberately no assignedTo/userId parameter here,
// since accepting one would let the caller widen their own scope.
export function getMyItDashboard(filters: ItMyDashboardFilters = {}) {
  const params = new URLSearchParams();
  if (filters.product) params.set("product", filters.product);
  if (filters.project) params.set("project", filters.project);
  if (filters.workType) params.set("workType", filters.workType);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return apiFetch<ApiSuccess<{ dashboard: ItMyDashboard }>>(
    `${API_ENDPOINTS.IT_WORK_MANAGEMENT.MY_DASHBOARD}${qs ? `?${qs}` : ""}`
  ).then((res) => res.data.dashboard);
}

export interface ItExecutiveDashboardFilters {
  product?: string;
  project?: string;
  assignedTo?: string;
  priority?: ItProjectPriority;
  status?: ItWorkItemStatus;
  workType?: ItWorkType;
  search?: string;
}

// Phase 1E-C — itReadOnlyOnly-gated on the backend (exactly the "readonly"
// tier; never manage, never team). Readonly access is an all-of-IT grant,
// not a per-user scope, so unlike getMyItDashboard there is no implicit
// "current user" scoping here — visibility is company-wide IT data.
export function getExecutiveItDashboard(filters: ItExecutiveDashboardFilters = {}) {
  const params = new URLSearchParams();
  if (filters.product) params.set("product", filters.product);
  if (filters.project) params.set("project", filters.project);
  if (filters.assignedTo) params.set("assignedTo", filters.assignedTo);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.status) params.set("status", filters.status);
  if (filters.workType) params.set("workType", filters.workType);
  if (filters.search) params.set("search", filters.search);
  const qs = params.toString();
  return apiFetch<ApiSuccess<{ dashboard: ItExecutiveDashboard }>>(
    `${API_ENDPOINTS.IT_WORK_MANAGEMENT.EXECUTIVE_DASHBOARD}${qs ? `?${qs}` : ""}`
  ).then((res) => res.data.dashboard);
}

// Admin/Super Admin only on the backend — the CEO read-only access grant
// list (Phase 1C-C). Not itManage-scoped: deciding who gets executive
// visibility into IT is a company-wide call, not an IT department one.
export const itReadOnlyAccessService = {
  list() {
    return apiFetch<ApiSuccess<{ viewers: ItReadOnlyViewer[] }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.READONLY_VIEWERS.LIST
    ).then((res) => res.data.viewers);
  },
  grant(userId: string) {
    return apiFetch<ApiSuccess<{ viewers: ItReadOnlyViewer[] }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.READONLY_VIEWERS.GRANT(userId),
      { method: "POST" }
    ).then((res) => res.data.viewers);
  },
  revoke(userId: string) {
    return apiFetch<ApiSuccess<{ viewers: ItReadOnlyViewer[] }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.READONLY_VIEWERS.REVOKE(userId),
      { method: "DELETE" }
    ).then((res) => res.data.viewers);
  },
};
