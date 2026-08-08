import { LeaveType, LeaveRequestStatus } from "@/constants/leave-types";

export interface LeaveBalanceBucket {
  used: number;
  total: number | null;
  baseTotal?: number | null;
  remaining: number | null;
  extra?: number;
}

export interface AnnualLeaveBalanceBucket {
  used: number;
  accrued: number;
  baseAccrued?: number;
  remaining: number;
  extra?: number;
}

export interface LeaveBalance {
  year: number;
  employmentType: "PROBATION" | "PERMANENT";
  sick: {
    half1: LeaveBalanceBucket;
    half2: LeaveBalanceBucket;
  };
  casualPaid: {
    half1: LeaveBalanceBucket;
    half2: LeaveBalanceBucket;
  };
  annual: AnnualLeaveBalanceBucket;
  unpaid: LeaveBalanceBucket;
  compOff?: {
    granted: number;
    used: number;
    pending: number;
    remaining: number;
    // False when the employee has never been granted any Comp Off (ever,
    // including expired grants) — the frontend uses this to hide the row
    // entirely rather than show a permanent "0 / 0".
    hasAnyGrant: boolean;
  };
}

export interface LeaveEmployeeRef {
  _id: string;
  employeeId: string;
  fullName: string;
  department?: { _id: string; name: string } | null;
  designation?: { _id: string; name: string } | null;
}

export interface LeaveRequest {
  id: string;
  employee: string | LeaveEmployeeRef;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveRequestStatus;
  reviewedBy: string | null;
  reviewComment: string | null;
  createdAt: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type HolidayType = "NATIONAL" | "COMPANY" | "OPTIONAL";

export type LeaveMigrationStatus = "NOT_STARTED" | "CONFIRMED";

// Mirrors ADJUSTABLE_BALANCE_FIELDS in
// hrms-backend/src/modules/leave/leave-balance-adjustment.model.ts —
// deliberately excludes annualAccruedThroughMonth (an internal accrual
// cursor, never a value an admin should set directly).
export type AdjustableBalanceField =
  | "sickUsedH1"
  | "sickUsedH2"
  | "sickExtraH1"
  | "sickExtraH2"
  | "casualPaidUsedH1"
  | "casualPaidUsedH2"
  | "casualPaidExtraH1"
  | "casualPaidExtraH2"
  | "annualAccrued"
  | "annualExtra"
  | "annualUsed"
  | "unpaidUsed"
  | "compOffGranted"
  | "compOffUsed";

export type LeaveImportSource = "RAZORPAY" | "OTHER" | "MANUAL";
export type LeaveImportStatus = "APPROVED" | "REJECTED" | "CANCELLED";

// One row of the merged history the Analysis screen shows — either a
// native LeaveRequest ("NATIVE") or an imported historical row (any other
// source), which the UI badges as "Imported Data".
export interface LeaveHistoryItem {
  id: string;
  source: "NATIVE" | LeaveImportSource;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  reason: string | null;
  createdAt: string;
  importBatchId?: string;
}

export interface LeaveImportBatch {
  batchId: string;
  source: LeaveImportSource;
  sourceFilename: string | null;
  importedAt: string;
  rowCount: number;
}

export interface ProposedLeaveAdjustment {
  field: AdjustableBalanceField;
  leaveType: LeaveType;
  period: "H1" | "H2" | "ANNUAL" | null;
  currentValue: number;
  proposedValue: number;
}

export interface LeaveMigrationAnalysis {
  employee: { id: string; fullName: string; employeeId: string };
  migrationStatus: LeaveMigrationStatus;
  migrationConfirmedBy: { _id: string; fullName: string } | null;
  migrationConfirmedAt: string | null;
  migrationConfirmedReason: string | null;
  balance: LeaveBalance;
  pendingRequests: LeaveRequest[];
  history: LeaveHistoryItem[];
  importBatches: LeaveImportBatch[];
  proposedAdjustments: ProposedLeaveAdjustment[];
}

export interface ImportLeaveHistoryRow {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveImportStatus;
  reason?: string;
  externalReference?: string;
}

export interface Holiday {
  _id: string;
  date: string;
  name: string;
  description: string | null;
  type: HolidayType;
  isActive: boolean;
}
