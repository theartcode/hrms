import { apiFetch } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/constants/api-endpoints";
import {
  DailyTimesheetEntry,
  DailyTimesheetPagination,
  DailyTimesheetStatus,
} from "@/types/it-work-management.types";

type ApiSuccess<T> = { success: true; message: string; data: T };

export interface SaveTodayTimesheetInput {
  description: string;
  workItems: string[];
}

export interface MyTimesheetHistoryFilters {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface TeamTimesheetFilters {
  date?: string;
  employee?: string;
  status?: DailyTimesheetStatus;
  page?: number;
  limit?: number;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const dailyTimesheetService = {
  getToday() {
    return apiFetch<ApiSuccess<{ timesheet: DailyTimesheetEntry }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.TIMESHEETS.TODAY
    ).then((res) => res.data.timesheet);
  },
  saveToday(input: SaveTodayTimesheetInput) {
    return apiFetch<ApiSuccess<{ timesheet: DailyTimesheetEntry }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.TIMESHEETS.TODAY,
      { method: "PUT", body: JSON.stringify(input) }
    ).then((res) => res.data.timesheet);
  },
  submitToday() {
    return apiFetch<ApiSuccess<{ timesheet: DailyTimesheetEntry }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.TIMESHEETS.SUBMIT_TODAY,
      { method: "POST" }
    ).then((res) => res.data.timesheet);
  },
  myHistory(filters: MyTimesheetHistoryFilters = {}) {
    const qs = buildQuery({ ...filters });
    return apiFetch<
      ApiSuccess<{ entries: DailyTimesheetEntry[]; pagination: DailyTimesheetPagination }>
    >(`${API_ENDPOINTS.IT_WORK_MANAGEMENT.TIMESHEETS.MY_HISTORY}${qs}`).then((res) => res.data);
  },
  team(filters: TeamTimesheetFilters = {}) {
    const qs = buildQuery({ ...filters });
    return apiFetch<
      ApiSuccess<{
        workDate: string;
        entries: DailyTimesheetEntry[];
        pagination: DailyTimesheetPagination;
      }>
    >(`${API_ENDPOINTS.IT_WORK_MANAGEMENT.TIMESHEETS.TEAM}${qs}`).then((res) => res.data);
  },
  get(id: string) {
    return apiFetch<ApiSuccess<{ timesheet: DailyTimesheetEntry }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.TIMESHEETS.DETAIL(id)
    ).then((res) => res.data.timesheet);
  },
};
