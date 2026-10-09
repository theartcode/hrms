import { apiFetch } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/constants/api-endpoints";
import {
  AdjustableBalanceField,
  ImportLeaveHistoryRow,
  LeaveBalance,
  LeaveImportSource,
  LeaveMigrationAnalysis,
  LeaveRequest,
  PaginationInfo,
} from "@/types/leave.types";

type ApiSuccess<T> = { success: true; message: string; data: T };

function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export interface ApplyLeaveInput {
  leaveType: string;
  startDate: string;
  endDate: string;
  isHalfDay?: boolean;
  reason: string;
}

export function applyLeave(input: ApplyLeaveInput) {
  return apiFetch<ApiSuccess<{ leave: LeaveRequest }>>(API_ENDPOINTS.LEAVES.APPLY, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface AdminMarkDayAsLeaveInput {
  employeeId: string;
  date: string;
  leaveType: string;
  reason?: string;
}

export function adminMarkDayAsLeave(input: AdminMarkDayAsLeaveInput) {
  return apiFetch<ApiSuccess<{ leave: LeaveRequest }>>(API_ENDPOINTS.LEAVES.ADMIN_MARK_DAY, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface ListLeavesParams {
  page?: number;
  limit?: number;
  status?: string;
  leaveType?: string;
  year?: number;
}

export function myLeaves(params: ListLeavesParams) {
  return apiFetch<ApiSuccess<{ leaves: LeaveRequest[]; pagination: PaginationInfo }>>(
    `${API_ENDPOINTS.LEAVES.MINE}${toQueryString({ ...params })}`
  );
}

export interface AdminListLeavesParams extends ListLeavesParams {
  employeeId?: string;
  department?: string;
  designation?: string;
}

export function adminListLeaves(params: AdminListLeavesParams) {
  return apiFetch<ApiSuccess<{ leaves: LeaveRequest[]; pagination: PaginationInfo }>>(
    `${API_ENDPOINTS.LEAVES.ADMIN_LIST}${toQueryString({ ...params })}`
  );
}

export function getBalance(params: { employeeId?: string; year?: number } = {}) {
  return apiFetch<ApiSuccess<LeaveBalance>>(
    `${API_ENDPOINTS.LEAVES.BALANCE}${toQueryString({ ...params })}`
  );
}

export interface AdjustLeaveBalanceInput {
  leaveType: string;
  period?: string;
  year: number;
  delta: number;
  reason: string;
}

export function adjustLeaveBalance(employeeId: string, input: AdjustLeaveBalanceInput) {
  return apiFetch<ApiSuccess<{ adjusted: boolean }>>(API_ENDPOINTS.LEAVES.ADJUST_BALANCE(employeeId), {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function cancelLeave(id: string) {
  return apiFetch<ApiSuccess<{ leave: LeaveRequest }>>(API_ENDPOINTS.LEAVES.CANCEL(id), {
    method: "PATCH",
  });
}

export function approveLeave(id: string, comment?: string) {
  return apiFetch<ApiSuccess<{ leave: LeaveRequest }>>(API_ENDPOINTS.LEAVES.APPROVE(id), {
    method: "PATCH",
    body: JSON.stringify({ comment }),
  });
}

export function rejectLeave(id: string, comment?: string) {
  return apiFetch<ApiSuccess<{ leave: LeaveRequest }>>(API_ENDPOINTS.LEAVES.REJECT(id), {
    method: "PATCH",
    body: JSON.stringify({ comment }),
  });
}

export interface GrantExtraLeaveInput {
  employeeId: string;
  days: number;
  reason: string;
  leaveType?: string;
  period?: string;
  year?: number;
}

export interface LeaveAllocationItem {
  id: string;
  employee: {
    id: string;
    employeeId: string;
    fullName: string;
    profilePhoto: string | null;
  };
  leaveType: string;
  period: string;
  year: number;
  days: number;
  reason: string;
  grantedBy: string;
  createdAt: string;
}

export function grantExtraLeave(input: GrantExtraLeaveInput) {
  return apiFetch<ApiSuccess<{ allocation: LeaveAllocationItem }>>(
    API_ENDPOINTS.LEAVES.ALLOCATIONS,
    {
      method: "POST",
      body: JSON.stringify(input),
    }
  );
}

export function listLeaveAllocations(params: { employeeId?: string; year?: number } = {}) {
  return apiFetch<ApiSuccess<{ allocations: LeaveAllocationItem[] }>>(
    `${API_ENDPOINTS.LEAVES.ALLOCATIONS}${toQueryString({ ...params })}`
  );
}

export function updateLeaveAllocation(
  id: string,
  input: { days?: number; reason?: string }
) {
  return apiFetch<ApiSuccess<{ allocation: LeaveAllocationItem }>>(
    `${API_ENDPOINTS.LEAVES.ALLOCATIONS}/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(input),
    }
  );
}

export function deleteLeaveAllocation(id: string) {
  return apiFetch<ApiSuccess<{ id: string }>>(
    `${API_ENDPOINTS.LEAVES.ALLOCATIONS}/${id}`,
    {
      method: "DELETE",
    }
  );
}

export function importLeaveHistory(
  employeeId: string,
  input: { source: LeaveImportSource; sourceFilename?: string; rows: ImportLeaveHistoryRow[] }
) {
  return apiFetch<ApiSuccess<{ importBatchId: string; importedCount: number }>>(
    API_ENDPOINTS.LEAVES.MIGRATION_IMPORT(employeeId),
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function deleteImportBatch(employeeId: string, batchId: string) {
  return apiFetch<ApiSuccess<{ deletedCount: number }>>(
    API_ENDPOINTS.LEAVES.MIGRATION_DELETE_BATCH(employeeId, batchId),
    { method: "DELETE" }
  );
}

export function getLeaveMigrationAnalysis(employeeId: string) {
  return apiFetch<ApiSuccess<LeaveMigrationAnalysis>>(
    API_ENDPOINTS.LEAVES.MIGRATION_ANALYSIS(employeeId)
  );
}

export function confirmLeaveMigration(
  employeeId: string,
  input: { reason: string; adjustments: { field: AdjustableBalanceField; newValue: number }[] }
) {
  return apiFetch<ApiSuccess<{ employeeId: string; leaveMigrationStatus: string }>>(
    API_ENDPOINTS.LEAVES.MIGRATION_CONFIRM(employeeId),
    { method: "POST", body: JSON.stringify(input) }
  );
}

export function reopenLeaveMigration(employeeId: string) {
  return apiFetch<ApiSuccess<{ employeeId: string; leaveMigrationStatus: string }>>(
    API_ENDPOINTS.LEAVES.MIGRATION_REOPEN(employeeId),
    { method: "POST" }
  );
}
