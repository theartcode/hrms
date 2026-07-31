import { LeaveRequestStatus } from "@/constants/leave-types";
import { AdjustableBalanceField } from "@/types/leave.types";

export const LEAVE_STATUS_LABELS: Record<LeaveRequestStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const LEAVE_STATUS_BADGE: Record<LeaveRequestStatus, string> = {
  PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-transparent",
  APPROVED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent",
  REJECTED: "bg-red-500/10 text-red-600 dark:text-red-400 border-transparent",
  CANCELLED: "bg-muted text-muted-foreground border-transparent",
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  SICK: "Sick Leave",
  CASUAL_PAID: "Casual/Paid Leave",
  ANNUAL: "Annual Leave",
  UNPAID: "Unpaid Leave",
  COMP_OFF: "Comp Off Leave",
};

export const ADJUSTABLE_FIELD_LABELS: Record<AdjustableBalanceField, string> = {
  sickUsedH1: "Sick Leave Used (Jan–Jun)",
  sickUsedH2: "Sick Leave Used (Jul–Dec)",
  sickExtraH1: "Sick Leave Extra (Jan–Jun)",
  sickExtraH2: "Sick Leave Extra (Jul–Dec)",
  casualPaidUsedH1: "Casual Leave Used (Jan–Jun)",
  casualPaidUsedH2: "Casual Leave Used (Jul–Dec)",
  casualPaidExtraH1: "Casual Leave Extra (Jan–Jun)",
  casualPaidExtraH2: "Casual Leave Extra (Jul–Dec)",
  annualAccrued: "Annual Leave Accrued",
  annualExtra: "Annual Leave Extra",
  annualUsed: "Annual Leave Used",
  unpaidUsed: "Unpaid Leave Used",
  compOffGranted: "Comp Off Granted",
  compOffUsed: "Comp Off Used",
};
