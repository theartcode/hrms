import { apiFetch } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/constants/api-endpoints";
import { WorkScheduleEntry, WorkScheduleTeamRow } from "@/types/it-work-management.types";

type ApiSuccess<T> = { success: true; message: string; data: T };

export interface AddScheduleEntryInput {
  date: string;
  workItem: string;
  note?: string;
}

export interface EmployeeScheduleResult {
  days: string[];
  entries: WorkScheduleEntry[];
}

export interface TeamScheduleResult {
  days: string[];
  team: WorkScheduleTeamRow[];
}

export const workScheduleService = {
  getMine() {
    return apiFetch<ApiSuccess<EmployeeScheduleResult>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.SCHEDULES.MINE
    ).then((res) => res.data);
  },
  addMine(input: AddScheduleEntryInput) {
    return apiFetch<ApiSuccess<{ entry: WorkScheduleEntry }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.SCHEDULES.MINE,
      { method: "POST", body: JSON.stringify(input) }
    ).then((res) => res.data.entry);
  },
  updateMyNote(id: string, note: string) {
    return apiFetch<ApiSuccess<{ entry: WorkScheduleEntry }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.SCHEDULES.MINE_DETAIL(id),
      { method: "PATCH", body: JSON.stringify({ note }) }
    ).then((res) => res.data.entry);
  },
  removeMine(id: string) {
    return apiFetch<ApiSuccess<Record<string, never>>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.SCHEDULES.MINE_DETAIL(id),
      { method: "DELETE" }
    );
  },
  getTeam() {
    return apiFetch<ApiSuccess<TeamScheduleResult>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.SCHEDULES.TEAM
    ).then((res) => res.data);
  },
  getForEmployee(employeeId: string) {
    return apiFetch<ApiSuccess<EmployeeScheduleResult>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.SCHEDULES.EMPLOYEE(employeeId)
    ).then((res) => res.data);
  },
  addForEmployee(employeeId: string, input: AddScheduleEntryInput) {
    return apiFetch<ApiSuccess<{ entry: WorkScheduleEntry }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.SCHEDULES.EMPLOYEE(employeeId),
      { method: "POST", body: JSON.stringify(input) }
    ).then((res) => res.data.entry);
  },
  removeForEmployee(employeeId: string, id: string) {
    return apiFetch<ApiSuccess<Record<string, never>>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.SCHEDULES.EMPLOYEE_DETAIL(employeeId, id),
      { method: "DELETE" }
    );
  },
};
