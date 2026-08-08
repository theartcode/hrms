import { apiFetch, apiFetchBlob } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/constants/api-endpoints";
import {
  AdminAttendanceRow,
  AttendanceRecord,
  DayStatusEntry,
  MonthSummary,
  NotCheckedInEmployee,
  PaginationInfo,
} from "@/types/attendance.types";

type ApiSuccess<T> = { success: true; message: string; data: T };

function toQueryString(params: Record<string, unknown>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function checkIn() {
  return apiFetch<ApiSuccess<{ attendance: AttendanceRecord }>>(
    API_ENDPOINTS.ATTENDANCE.CHECK_IN,
    { method: "POST" }
  );
}

export function checkOut() {
  return apiFetch<ApiSuccess<{ attendance: AttendanceRecord }>>(
    API_ENDPOINTS.ATTENDANCE.CHECK_OUT,
    { method: "POST" }
  );
}

export function getToday() {
  return apiFetch<ApiSuccess<{ attendance: AttendanceRecord | null }>>(
    API_ENDPOINTS.ATTENDANCE.TODAY
  );
}

export interface MonthParams {
  year?: number;
  month?: number;
  employeeId?: string;
}

export function getHistory(params: MonthParams) {
  return apiFetch<ApiSuccess<{ year: number; month: number; days: DayStatusEntry[] }>>(
    `${API_ENDPOINTS.ATTENDANCE.HISTORY}${toQueryString({ ...params })}`
  );
}

export async function exportHistoryCsv(
  params: MonthParams,
  filename = "attendance-history.csv"
): Promise<void> {
  const blob = await apiFetchBlob(
    `${API_ENDPOINTS.ATTENDANCE.HISTORY_EXPORT}${toQueryString({ ...params })}`
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getCalendar(params: MonthParams) {
  return apiFetch<ApiSuccess<{ year: number; month: number; days: DayStatusEntry[] }>>(
    `${API_ENDPOINTS.ATTENDANCE.CALENDAR}${toQueryString({ ...params })}`
  );
}

export function getSummary(params: MonthParams) {
  return apiFetch<ApiSuccess<{ year: number; month: number; summary: MonthSummary }>>(
    `${API_ENDPOINTS.ATTENDANCE.SUMMARY}${toQueryString({ ...params })}`
  );
}

export interface AdminListParams {
  page?: number;
  limit?: number;
  date?: string;
  year?: number;
  month?: number;
  department?: string;
  designation?: string;
  employeeId?: string;
  status?: string;
}

export function adminList(params: AdminListParams) {
  return apiFetch<
    ApiSuccess<{ records: AdminAttendanceRow[]; pagination: PaginationInfo }>
  >(`${API_ENDPOINTS.ATTENDANCE.ADMIN_LIST}${toQueryString({ ...params })}`);
}

export function notCheckedInToday(date?: string) {
  return apiFetch<ApiSuccess<{ employees: NotCheckedInEmployee[] }>>(
    `${API_ENDPOINTS.ATTENDANCE.ADMIN_NOT_CHECKED_IN}${toQueryString({ date })}`
  );
}

export async function exportCsv(
  params: Omit<AdminListParams, "page" | "limit">
): Promise<void> {
  const blob = await apiFetchBlob(
    `${API_ENDPOINTS.ATTENDANCE.ADMIN_EXPORT}${toQueryString({ ...params })}`
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "attendance-export.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
