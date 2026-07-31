export const LEAVE_TYPES = {
  SICK: "SICK",
  CASUAL_PAID: "CASUAL_PAID",
  ANNUAL: "ANNUAL",
  UNPAID: "UNPAID",
  COMP_OFF: "COMP_OFF",
} as const;

export type LeaveType = (typeof LEAVE_TYPES)[keyof typeof LEAVE_TYPES];

export const LEAVE_REQUEST_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;

export type LeaveRequestStatus =
  (typeof LEAVE_REQUEST_STATUS)[keyof typeof LEAVE_REQUEST_STATUS];

// Deliberately excludes PENDING — a still-open row from a retired system
// is a live business problem to resolve before import, not migration data.
export const LEAVE_IMPORT_STATUS = {
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
} as const;
export type LeaveImportStatus = (typeof LEAVE_IMPORT_STATUS)[keyof typeof LEAVE_IMPORT_STATUS];
