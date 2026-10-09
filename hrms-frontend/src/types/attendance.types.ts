import { AttendanceStatus } from "@/constants/attendance-status";

export interface AttendanceRecord {
  id: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number | null;
  status: AttendanceStatus | null;
}

export interface OfficeHours {
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
}

export interface DayStatusEntry {
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number | null;
  status: AttendanceStatus | null;
  // Set only when status is HOLIDAY — which named holiday it is.
  holidayName?: string | null;
}

export interface MonthSummary {
  onTime: number;
  late: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  holiday: number;
  weekend: number;
  missedCheckout: number;
  totalWorkedHours: number;
}

export interface AdminAttendanceRow {
  id: string;
  employee: { id: string; employeeId: string; fullName: string };
  department: string | null;
  designation: string | null;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number | null;
  status: AttendanceStatus;
}

export interface NotCheckedInEmployee {
  id: string;
  employeeId: string;
  fullName: string;
  department: string | null;
  designation: string | null;
}

export type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface AttendanceCorrection {
  id: string;
  employee: string | { id: string; employeeId: string; fullName: string };
  date: string;
  requestedCheckIn: string | null;
  requestedCheckOut: string | null;
  reason: string;
  status: CorrectionStatus;
  reviewedBy: string | null;
  reviewComment: string | null;
  originalCheckIn: string | null;
  originalCheckOut: string | null;
  createdAt: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
