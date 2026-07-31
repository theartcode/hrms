import { RecentActivityEntry } from "@/types/dashboard.types";

const ACTION_LABELS: Record<string, string> = {
  EMPLOYEE_CREATED: "created employee",
  EMPLOYEE_UPDATED: "updated employee",
  EMPLOYEE_ACTIVATED: "activated employee",
  EMPLOYEE_DEACTIVATED: "deactivated employee",
  DEPARTMENT_CREATED: "created department",
  DEPARTMENT_UPDATED: "updated department",
  DESIGNATION_CREATED: "created designation",
  DESIGNATION_UPDATED: "updated designation",
  LOCATION_CREATED: "created location",
  LOCATION_UPDATED: "updated location",
  PAYMENT_INFO_SUBMITTED: "submitted bank details for approval",
  PAYMENT_INFO_APPROVED: "approved bank details",
  PAYMENT_INFO_REJECTED: "rejected bank details",
  LEAVE_HISTORY_IMPORTED: "imported historical leave records",
  LEAVE_IMPORT_BATCH_DELETED: "deleted an imported leave batch",
  LEAVE_MIGRATION_CONFIRMED: "confirmed leave migration",
  LEAVE_MIGRATION_REOPENED: "reopened leave migration",
  LEAVE_BALANCE_ADJUSTED: "adjusted leave balance",
  PROBATION_ENDING_DETECTED: "flagged probation period ended",
  CHECK_IN: "checked in",
  CHECK_OUT: "checked out",
  ATTENDANCE_CORRECTION_REQUESTED: "requested an attendance correction",
  ATTENDANCE_CORRECTION_APPROVED: "approved an attendance correction",
  ATTENDANCE_CORRECTION_REJECTED: "rejected an attendance correction",
  LEAVE_APPLIED: "applied for leave",
  LEAVE_APPROVED: "approved a leave request",
  LEAVE_REJECTED: "rejected a leave request",
  LEAVE_CANCELLED: "cancelled a leave request",
  HOLIDAY_CREATED: "added a holiday",
  HOLIDAY_UPDATED: "updated a holiday",
  HOLIDAY_ACTIVATED: "activated a holiday",
  HOLIDAY_DEACTIVATED: "deactivated a holiday",
  REPORT_EXPORTED: "exported a report",
  REPORT_PRINTED: "printed a report",
  ANNOUNCEMENT_CREATED: "created an announcement",
  ANNOUNCEMENT_UPDATED: "updated an announcement",
  ANNOUNCEMENT_PUBLISHED: "published an announcement",
  ANNOUNCEMENT_ARCHIVED: "archived an announcement",
  ADOBE_LICENSE_SHEET_UPDATED: "updated the Adobe License sheet",
  ADOBE_LICENSE_ACCESS_GRANTED: "granted Adobe License access",
  ADOBE_LICENSE_ACCESS_REVOKED: "revoked Adobe License access",
};

export function formatActivityLabel(entry: RecentActivityEntry): string {
  const verb = ACTION_LABELS[entry.action] ?? entry.action.toLowerCase().replace(/_/g, " ");
  const name = (entry.metadata?.name ?? entry.metadata?.title) as string | undefined;
  const suffix = name ? ` "${name}"` : "";
  return `${entry.actorEmployeeId} ${verb}${suffix}`;
}
