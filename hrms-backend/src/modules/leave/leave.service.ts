import mongoose from "mongoose";
import { ApiError } from "../../shared/errors/ApiError";
import { env } from "../../shared/config/env";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { NOTIFICATION_TYPES } from "../../shared/constants/notificationTypes";
import { getLeavePolicy } from "../configuration/configuration.cache";
import {
  LEAVE_REQUEST_STATUS,
  LEAVE_TYPES,
  LeaveRequestStatus,
  LeaveType,
} from "../../shared/constants/leaveTypes";
import { EMPLOYEE_STATUS } from "../../shared/constants/employeeStatus";
import { EMPLOYMENT_TYPE, EmploymentType } from "../../shared/constants/employmentType";
import { toId } from "../../shared/utils/toId";
import { getISTDateString, daysBetweenDateStrings } from "../../shared/utils/istDate";
import { resolveViewableEmployeeId } from "../../shared/utils/resolveViewableEmployeeId";
import { recordActivity } from "../activity-log/activity-log.service";
import { notifyAdmins, notifyUser } from "../notifications/notifications.service";
import { UserModel } from "../user/user.model";
import { AttendanceModel } from "../attendance/attendance.model";
import { ILeaveBalance, LeaveBalanceModel } from "./leave-balance.model";
import { ILeaveRequest, LeaveRequestModel } from "./leave-request.model";
import { LeaveAllocationModel, ALLOCATION_PERIOD, AllocationPeriod } from "./leave-allocation.model";
import {
  ILeaveImportRecord,
  LeaveImportRecordModel,
  LEAVE_IMPORT_STATUS,
  LeaveImportSource,
  LeaveImportStatus,
} from "./leave-import-record.model";
import {
  LeaveBalanceAdjustmentModel,
  AdjustableBalanceField,
  LEAVE_BALANCE_ADJUSTMENT_SOURCE,
  LeaveBalanceAdjustmentSource,
} from "./leave-balance-adjustment.model";
import { computeLeaveWorkingDays, countEligibleAccrualMonths } from "./leave.util";

interface Actor {
  id: string;
  role: string;
  employeeId: string;
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  SICK: "Sick",
  CASUAL_PAID: "Casual",
  ANNUAL: "Annual",
  UNPAID: "Unpaid",
  COMP_OFF: "Comp Off",
};

const APPLY_ALLOWED_STATUSES: string[] = [
  EMPLOYEE_STATUS.ACTIVE,
  EMPLOYEE_STATUS.NOTICE_PERIOD,
];

/**
 * Jan-Jun = H1, Jul-Dec = H2, based on the leave request's own start date.
 * Shared by both Sick and Casual Paid Leave, the two half-year-split types.
 */
function leaveHalf(dateStr: string): "H1" | "H2" {
  return Number(dateStr.slice(5, 7)) <= 6 ? "H1" : "H2";
}

function toPublicLeave(leave: ILeaveRequest) {
  return {
    id: toId(leave),
    employee: leave.employee,
    leaveType: leave.leaveType,
    startDate: leave.startDate,
    endDate: leave.endDate,
    days: leave.days,
    isHalfDay: leave.isHalfDay,
    reason: leave.reason,
    status: leave.status,
    reviewedBy: leave.reviewedBy,
    reviewComment: leave.reviewComment,
    createdAt: leave.createdAt,
  };
}

// Used by the attendance engine (Phase 4) to mark days On Leave. Lives here
// rather than being computed by the caller so leave's definition of
// "approved leave covers this date" has exactly one implementation.
export async function getApprovedLeaveDateSet(
  employeeId: string,
  start: string,
  end: string
): Promise<Set<string>> {
  const overlapping = await LeaveRequestModel.find({
    employee: employeeId,
    status: LEAVE_REQUEST_STATUS.APPROVED,
    startDate: { $lte: end },
    endDate: { $gte: start },
  }).select("startDate endDate");

  const dates = new Set<string>();
  for (const leave of overlapping) {
    const rangeStart = leave.startDate > start ? leave.startDate : start;
    const rangeEnd = leave.endDate < end ? leave.endDate : end;
    const cursor = new Date(`${rangeStart}T00:00:00+05:30`);
    const endCursor = new Date(`${rangeEnd}T00:00:00+05:30`);
    while (cursor.getTime() <= endCursor.getTime()) {
      dates.add(getISTDateString(cursor));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return dates;
}

// Whether Jan-Jun of `year` has actually finished as of today (IST) — used
// to gate carry-forward below. A year fully in the past always counts as
// over; a year not yet reached never does.
function isFirstHalfOver(year: number): boolean {
  const today = getISTDateString();
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7));
  if (year < todayYear) return true;
  if (year > todayYear) return false;
  return todayMonth >= 7;
}

// Company policy treats each half as all-or-nothing, never prorated by
// exact join date within it (joining March still gets the full Jan-Jun
// quota) — so eligibility is just "did employment start on or before this
// half's last day."
function isEligibleForHalf(joiningDateStr: string, year: number, half: "H1" | "H2"): boolean {
  return joiningDateStr <= (half === "H1" ? `${year}-06-30` : `${year}-12-31`);
}

// Shared by Sick and Casual Paid Leave — both are split into two half-year
// buckets, with H2's quota including whatever H1 left unused (when
// carry-forward is on). Two things gate carry-forward, not just one:
//   1. H1 must have actually ended (`firstHalfOver`) — showing an inflated
//      H2 total months in advance would assume zero further H1 usage is
//      coming, misleading for anyone still mid-H1.
//   2. The employee must have actually been eligible for H1 at all
//      (`firstHalfEligible`) — someone who joined in Jul-Dec never had a
//      Jan-Jun entitlement, so there is nothing of theirs to carry forward,
//      no matter how far past June 30 today is.
// H1's own total is zero outright when the employee wasn't eligible for it
// (joined after June 30) — "Not Applicable," not a quota they can use.
function computeHalfYearBuckets(
  quotaPerHalf: number,
  extraH1: number,
  extraH2: number,
  usedH1: number,
  usedH2: number,
  pendingH1: number,
  pendingH2: number,
  carryForwardEnabled: boolean,
  firstHalfOver: boolean,
  firstHalfEligible: boolean,
  secondHalfEligible: boolean
) {
  const h1Total = firstHalfEligible ? quotaPerHalf + extraH1 : 0;
  const h1Remaining = Math.max(0, h1Total - usedH1 - pendingH1);

  const carryOver =
    carryForwardEnabled && firstHalfOver && firstHalfEligible ? Math.max(0, h1Total - usedH1) : 0;
  const h2Total = secondHalfEligible ? quotaPerHalf + extraH2 + carryOver : 0;
  const h2Remaining = Math.max(0, h2Total - usedH2 - pendingH2);

  return {
    half1: {
      used: usedH1,
      pending: pendingH1,
      total: h1Total,
      baseTotal: firstHalfEligible ? quotaPerHalf : 0,
      carriedForward: 0,
      extra: extraH1,
      remaining: h1Remaining,
    },
    half2: {
      used: usedH2,
      pending: pendingH2,
      total: h2Total,
      baseTotal: secondHalfEligible ? quotaPerHalf : 0,
      carriedForward: carryOver,
      extra: extraH2,
      remaining: h2Remaining,
    },
  };
}

// Annual Leave is credited flat +accrualPerMonth for every fully-completed
// calendar month the employee has been Permanent — no "zero leave taken"
// condition like Sick/Casual's quotas have, and Probation employees don't
// accrue at all. Mutates `balance` in place (annualAccrued/
// annualAccruedThroughMonth only) when new months have become eligible
// since it was last credited; never saves — callers already save balance
// for their own reasons.
function creditAnnualAccrual(
  balance: ILeaveBalance,
  employmentType: EmploymentType,
  permanentSince: Date | null,
  year: number,
  accrualPerMonth: number
): void {
  if (employmentType !== EMPLOYMENT_TYPE.PERMANENT) return;

  const eligibleMonths = countEligibleAccrualMonths(permanentSince, year, getISTDateString());
  if (eligibleMonths <= balance.annualAccruedThroughMonth) return;

  const newMonths = eligibleMonths - balance.annualAccruedThroughMonth;
  balance.annualAccrued = Math.round((balance.annualAccrued + newMonths * accrualPerMonth) * 100) / 100;
  balance.annualAccruedThroughMonth = eligibleMonths;
}

const COMP_OFF_EXPIRY_MONTHS = 1;

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

// Comp Off is grant-only (no recurring policy quota) and each grant expires
// COMP_OFF_EXPIRY_MONTHS after the date it was granted — unlike every other
// leave type here, it can't be modeled as a flat running counter once
// expiry matters, since "how much is left" depends on which specific grant
// a day came from. Consumption is FIFO (oldest grant first, same as real
// expiring-leave conventions): every LeaveAllocationModel COMP_OFF grant
// and every approved COMP_OFF LeaveRequestModel day are walked oldest-first
// together; whatever's left unconsumed in an already-expired grant is
// simply dropped — forfeited, per "once expired the employee can't use
// them." `hasAnyGrant` is for the frontend only, to hide the whole Comp Off
// row for employees who've never once been granted any.
async function computeCompOffBalance(
  employeeId: string
): Promise<{ granted: number; used: number; pending: number; remaining: number; hasAnyGrant: boolean }> {
  const today = getISTDateString();

  const [grants, usedRequests, pendingRequests] = await Promise.all([
    LeaveAllocationModel.find({ employee: employeeId, leaveType: LEAVE_TYPES.COMP_OFF }).sort({
      createdAt: 1,
    }),
    LeaveRequestModel.find({
      employee: employeeId,
      leaveType: LEAVE_TYPES.COMP_OFF,
      status: LEAVE_REQUEST_STATUS.APPROVED,
    }),
    LeaveRequestModel.find({
      employee: employeeId,
      leaveType: LEAVE_TYPES.COMP_OFF,
      status: LEAVE_REQUEST_STATUS.PENDING,
    }),
  ]);

  const totalUsed = usedRequests.reduce((sum, r) => sum + r.days, 0);
  const totalPending = pendingRequests.reduce((sum, r) => sum + r.days, 0);

  let toConsume = totalUsed;
  let validGranted = 0;
  let usedFromValidGrants = 0;

  for (const grant of grants) {
    const consumedFromThisGrant = Math.min(grant.days, toConsume);
    toConsume -= consumedFromThisGrant;

    const expiryDateStr = getISTDateString(addMonths(grant.createdAt, COMP_OFF_EXPIRY_MONTHS));
    const expired = expiryDateStr <= today;
    if (!expired) {
      validGranted += grant.days;
      usedFromValidGrants += consumedFromThisGrant;
    }
    // Expired grants are excluded entirely — their unused remainder is
    // forfeited, not carried anywhere.
  }

  return {
    granted: Math.round(validGranted * 100) / 100,
    used: Math.round(usedFromValidGrants * 100) / 100,
    pending: totalPending,
    remaining: Math.max(0, Math.round((validGranted - usedFromValidGrants - totalPending) * 100) / 100),
    hasAnyGrant: grants.length > 0,
  };
}

export async function getLeaveBalance(employeeId: string, year: number) {
  const employee = await UserModel.findById(employeeId).select(
    "employmentType permanentSince joiningDate"
  );
  if (!employee) throw new ApiError(404, "Employee not found");

  let balance = await LeaveBalanceModel.findOne({ employee: employeeId, year });
  if (!balance) {
    balance = new LeaveBalanceModel({ employee: employeeId, year });
  }

  const policy = getLeavePolicy();
  creditAnnualAccrual(
    balance,
    employee.employmentType,
    employee.permanentSince,
    year,
    policy.annualAccrualPerMonth
  );
  if (balance.isNew || balance.isModified()) {
    await balance.save();
  }

  const pendingRequests = await LeaveRequestModel.find({
    employee: employeeId,
    status: LEAVE_REQUEST_STATUS.PENDING,
    startDate: { $gte: `${year}-01-01`, $lte: `${queryYearEnd(year)}` },
  });

  let pendingSickH1 = 0, pendingSickH2 = 0;
  let pendingCasualH1 = 0, pendingCasualH2 = 0;
  let pendingAnnual = 0, pendingUnpaid = 0;

  for (const req of pendingRequests) {
    const half = leaveHalf(req.startDate);
    if (req.leaveType === LEAVE_TYPES.SICK) {
      if (half === "H1") pendingSickH1 += req.days;
      else pendingSickH2 += req.days;
    } else if (req.leaveType === LEAVE_TYPES.CASUAL_PAID) {
      if (half === "H1") pendingCasualH1 += req.days;
      else pendingCasualH2 += req.days;
    } else if (req.leaveType === LEAVE_TYPES.ANNUAL) {
      pendingAnnual += req.days;
    } else if (req.leaveType === LEAVE_TYPES.UNPAID) {
      pendingUnpaid += req.days;
    }
    // COMP_OFF pending is computed separately by computeCompOffBalance,
    // which isn't scoped to `year` — Comp Off doesn't reset yearly.
  }

  const compOff = await computeCompOffBalance(employeeId);
  const annualAccruedTotal = Math.round(balance.annualAccrued * 100) / 100;
  const annualExtra = balance.annualExtra || 0;
  const firstHalfOver = isFirstHalfOver(year);
  const joiningDateStr = getISTDateString(employee.joiningDate);
  const firstHalfEligible = isEligibleForHalf(joiningDateStr, year, "H1");
  const secondHalfEligible = isEligibleForHalf(joiningDateStr, year, "H2");

  return {
    year,
    // Lets the frontend hide/disable Annual Leave for Probation employees
    // instead of only rejecting it at submit time — see apply-leave-dialog.tsx
    // and leave-balance-card.tsx.
    employmentType: employee.employmentType,
    // Once H1 has ended, any of its unused days are already folded into
    // half2's total (see carryOver above) — the frontend uses this to stop
    // treating half1.remaining as separately usable/addable once true.
    firstHalfOver,
    sick: computeHalfYearBuckets(
      policy.sickQuotaPerHalf,
      balance.sickExtraH1 || 0,
      balance.sickExtraH2 || 0,
      balance.sickUsedH1,
      balance.sickUsedH2,
      pendingSickH1,
      pendingSickH2,
      getLeaveTypePolicy(LEAVE_TYPES.SICK, policy).carryForwardEnabled ?? policy.carryForwardEnabled,
      firstHalfOver,
      firstHalfEligible,
      secondHalfEligible
    ),
    casualPaid: computeHalfYearBuckets(
      policy.casualPaidQuotaPerHalf,
      balance.casualPaidExtraH1 || 0,
      balance.casualPaidExtraH2 || 0,
      balance.casualPaidUsedH1,
      balance.casualPaidUsedH2,
      pendingCasualH1,
      pendingCasualH2,
      getLeaveTypePolicy(LEAVE_TYPES.CASUAL_PAID, policy).carryForwardEnabled ??
        policy.carryForwardEnabled,
      firstHalfOver,
      firstHalfEligible,
      secondHalfEligible
    ),
    annual: {
      used: balance.annualUsed,
      pending: pendingAnnual,
      accrued: Math.round((annualAccruedTotal + annualExtra) * 100) / 100,
      baseAccrued: annualAccruedTotal,
      extra: annualExtra,
      remaining: Math.max(
        0,
        Math.round((annualAccruedTotal + annualExtra - balance.annualUsed - pendingAnnual) * 100) / 100
      ),
    },
    unpaid: { used: balance.unpaidUsed, pending: pendingUnpaid, total: null, remaining: null },
    compOff,
  };
}

function queryYearEnd(year: number): string {
  return `${year}-12-31`;
}

interface ApplyLeaveInput {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  isHalfDay?: boolean;
  reason: string;
}

function getLeaveTypePolicy(leaveType: LeaveType, policy: ReturnType<typeof getLeavePolicy>) {
  const configured = policy.leaveTypeSettings?.[leaveType];
  if (configured) return configured;

  return {
    advanceNoticeDays:
      leaveType === LEAVE_TYPES.CASUAL_PAID
        ? policy.casualPaidNoticeDays
        : leaveType === LEAVE_TYPES.ANNUAL
          ? policy.annualNoticeDays
          : 0,
    minDurationDays: policy.minDurationDays,
    maxDurationDays: policy.maxDurationDays,
    includeWeekends: false,
  };
}

function validateAdvanceNotice(leaveType: LeaveType, startDate: string, policy: ReturnType<typeof getLeavePolicy>) {
  const noticeDays = getLeaveTypePolicy(leaveType, policy).advanceNoticeDays;
  const notice = daysBetweenDateStrings(getISTDateString(), startDate);
  if (notice < noticeDays) {
    const label = leaveType === LEAVE_TYPES.CASUAL_PAID ? "Casual" : leaveType === LEAVE_TYPES.ANNUAL ? "Annual" : leaveType === LEAVE_TYPES.COMP_OFF ? "Comp Off" : leaveType === LEAVE_TYPES.UNPAID ? "Unpaid" : "Sick";
    throw new ApiError(422, `${label} leave requires at least ${noticeDays} day(s) advance notice`);
  }
}

export async function applyLeave(actor: Actor, input: ApplyLeaveInput) {
  if (input.startDate > input.endDate) {
    throw new ApiError(400, "Start date must be before or equal to the end date");
  }
  if (input.isHalfDay && input.startDate !== input.endDate) {
    throw new ApiError(400, "A half-day leave request can only be for a single date");
  }

  const employee = await UserModel.findById(actor.id);
  if (!employee) throw new ApiError(404, "Employee not found");
  if (!APPLY_ALLOWED_STATUSES.includes(employee.status)) {
    throw new ApiError(403, "Your account is not eligible to apply for leave");
  }

  const joiningDateStr = getISTDateString(employee.joiningDate);
  if (input.startDate < joiningDateStr) {
    throw new ApiError(400, "Cannot apply for leave before your joining date");
  }

  const overlap = await LeaveRequestModel.findOne({
    employee: actor.id,
    status: { $in: [LEAVE_REQUEST_STATUS.PENDING, LEAVE_REQUEST_STATUS.APPROVED] },
    startDate: { $lte: input.endDate },
    endDate: { $gte: input.startDate },
  });
  if (overlap) {
    throw new ApiError(
      409,
      "You already have a pending or approved leave request that overlaps these dates"
    );
  }

  const policy = getLeavePolicy();

  if (input.leaveType === LEAVE_TYPES.UNPAID && !policy.unpaidAllowed) {
    throw new ApiError(403, "Unpaid leave is not permitted under the current leave policy");
  }

  validateAdvanceNotice(input.leaveType, input.startDate, policy);

  const typePolicy = getLeaveTypePolicy(input.leaveType, policy);
  let days = await computeLeaveWorkingDays(
    input.startDate,
    input.endDate,
    typePolicy.includeWeekends ?? false
  );
  if (days <= 0) {
    throw new ApiError(
      400,
      "The selected range doesn't include any working days (weekends/holidays only)"
    );
  }

  // A half day is a fixed, minimal unit of its own — not subject to the
  // type's min/max-working-days-per-request policy (that policy is about
  // how many whole days a request spans, which doesn't apply here).
  if (input.isHalfDay) {
    days = 0.5;
  } else {
    if (typePolicy.minDurationDays !== null && days < typePolicy.minDurationDays) {
      throw new ApiError(400, `Leave must be at least ${typePolicy.minDurationDays} working day(s)`);
    }
    if (days > typePolicy.maxDurationDays) {
      throw new ApiError(400, `Leave cannot exceed ${typePolicy.maxDurationDays} working day(s)`);
    }
  }

  // Rule: Paid leaves cannot exceed 2 working days. Requests > 2 days must be Unpaid Leave.
  if (days > 2 && input.leaveType !== LEAVE_TYPES.UNPAID) {
    throw new ApiError(
      400,
      "Leaves longer than 2 working days cannot be taken as paid leave. Please select Unpaid Leave."
    );
  }

  // Rule: Casual leave can only be taken once per calendar month.
  if (input.leaveType === LEAVE_TYPES.CASUAL_PAID) {
    const startMonthPrefix = input.startDate.slice(0, 7);
    const existingCasualInMonth = await LeaveRequestModel.findOne({
      employee: actor.id,
      leaveType: LEAVE_TYPES.CASUAL_PAID,
      status: { $in: [LEAVE_REQUEST_STATUS.PENDING, LEAVE_REQUEST_STATUS.APPROVED] },
      startDate: { $regex: `^${startMonthPrefix}` },
    });
    if (existingCasualInMonth) {
      throw new ApiError(
        400,
        "Casual leave can only be taken once per month. You have already applied for or taken casual leave this month."
      );
    }
  }

  if (input.leaveType !== LEAVE_TYPES.UNPAID) {
    const year = Number(input.startDate.slice(0, 4));
    const balance = await getLeaveBalance(actor.id, year);
    const half = leaveHalf(input.startDate) === "H1" ? "half1" : "half2";
    const relevant =
      input.leaveType === LEAVE_TYPES.SICK
        ? balance.sick[half]
        : input.leaveType === LEAVE_TYPES.CASUAL_PAID
          ? balance.casualPaid[half]
          : input.leaveType === LEAVE_TYPES.COMP_OFF
            ? balance.compOff
            : balance.annual;
    if (relevant.remaining !== null && days > relevant.remaining) {
      throw new ApiError(
        409,
        `Insufficient leave balance: ${relevant.remaining} day(s) available, ${days} requested`
      );
    }
  }

  const leave = await LeaveRequestModel.create({
    employee: actor.id,
    leaveType: input.leaveType,
    startDate: input.startDate,
    endDate: input.endDate,
    days,
    isHalfDay: input.isHalfDay ?? false,
    reason: input.reason,
    status: LEAVE_REQUEST_STATUS.PENDING,
  });

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.LEAVE_APPLIED,
    targetType: "LeaveRequest",
    targetId: toId(leave),
    metadata: { leaveType: input.leaveType, startDate: input.startDate, endDate: input.endDate, days },
  });

  await notifyAdmins(actor.id, {
    type: NOTIFICATION_TYPES.LEAVE_APPLIED,
    title: "New leave request",
    message: `${employee.fullName} (${employee.employeeId}) applied for ${LEAVE_TYPE_LABELS[input.leaveType]} leave`,
    metadata: { leaveId: toId(leave) },
    email: {
      template: "leave-applied",
      data: {
        employeeName: employee.fullName,
        employeeIdLabel: employee.employeeId,
        leaveType: LEAVE_TYPE_LABELS[input.leaveType],
        startDate: input.startDate,
        endDate: input.endDate,
        days,
        reason: input.reason,
        reviewUrl: `${env.clientOrigin}/leave/admin?requestId=${toId(leave)}`,
      },
    },
  });

  return toPublicLeave(leave);
}

/**
 * Admin shortcut for backfilling a single day as leave (e.g. while editing
 * an employee's attendance) — creates a same-day leave request and
 * immediately approves it via the normal approveLeave path, so quota
 * deduction and employee notification stay identical to a regular
 * apply-then-approve flow. Unlike applyLeave, this skips the advance-notice
 * check (the whole point is backfilling past/near-term days) but keeps
 * every other leave-policy rule (joining date, overlap, quota, once-a-month
 * casual leave, min duration). Any existing Attendance record for that date
 * is cleared afterward so the day reads as On Leave instead of whatever
 * check-in/out happened to be stored (see getMonthDayStatuses).
 */
export async function adminMarkDayAsLeave(
  admin: Actor,
  employeeId: string,
  date: string,
  leaveType: LeaveType,
  reason?: string
) {
  const employee = await UserModel.findById(employeeId);
  if (!employee) throw new ApiError(404, "Employee not found");
  if (!APPLY_ALLOWED_STATUSES.includes(employee.status)) {
    throw new ApiError(403, "This employee's account is not eligible for leave");
  }

  const joiningDateStr = getISTDateString(employee.joiningDate);
  if (date < joiningDateStr) {
    throw new ApiError(400, "Cannot mark leave before the employee's joining date");
  }

  const overlap = await LeaveRequestModel.findOne({
    employee: employeeId,
    status: { $in: [LEAVE_REQUEST_STATUS.PENDING, LEAVE_REQUEST_STATUS.APPROVED] },
    startDate: { $lte: date },
    endDate: { $gte: date },
  });
  if (overlap) {
    throw new ApiError(
      409,
      "This employee already has a pending or approved leave request covering this date"
    );
  }

  const policy = getLeavePolicy();
  if (leaveType === LEAVE_TYPES.UNPAID && !policy.unpaidAllowed) {
    throw new ApiError(403, "Unpaid leave is not permitted under the current leave policy");
  }

  const typePolicy = getLeaveTypePolicy(leaveType, policy);
  const days = await computeLeaveWorkingDays(date, date, typePolicy.includeWeekends ?? false);
  if (days <= 0) {
    throw new ApiError(400, "This date is a weekend or holiday — it doesn't need to be marked as leave");
  }

  if (typePolicy.minDurationDays !== null && days < typePolicy.minDurationDays) {
    throw new ApiError(
      400,
      `${LEAVE_TYPE_LABELS[leaveType]} leave must be at least ${typePolicy.minDurationDays} working day(s)`
    );
  }

  if (leaveType === LEAVE_TYPES.CASUAL_PAID) {
    const monthPrefix = date.slice(0, 7);
    const existingCasualInMonth = await LeaveRequestModel.findOne({
      employee: employeeId,
      leaveType: LEAVE_TYPES.CASUAL_PAID,
      status: { $in: [LEAVE_REQUEST_STATUS.PENDING, LEAVE_REQUEST_STATUS.APPROVED] },
      startDate: { $regex: `^${monthPrefix}` },
    });
    if (existingCasualInMonth) {
      throw new ApiError(400, "This employee has already taken casual leave this month");
    }
  }

  const leave = await LeaveRequestModel.create({
    employee: employeeId,
    leaveType,
    startDate: date,
    endDate: date,
    days,
    reason: reason?.trim() || "Marked by admin",
    status: LEAVE_REQUEST_STATUS.PENDING,
  });

  await recordActivity({
    actor: admin,
    action: ACTIVITY_ACTIONS.LEAVE_MARKED_BY_ADMIN,
    targetType: "LeaveRequest",
    targetId: toId(leave),
    metadata: { employeeId, leaveType, date },
  });

  let approved;
  try {
    approved = await approveLeave(admin, toId(leave));
  } catch (err) {
    await LeaveRequestModel.deleteOne({ _id: leave._id });
    throw err;
  }

  await AttendanceModel.deleteOne({ employee: employeeId, date });

  return approved;
}

interface ListQuery {
  page: number;
  limit: number;
  status?: LeaveRequestStatus;
  leaveType?: LeaveType;
  year?: number;
}

export async function listMyLeaves(employeeId: string, query: ListQuery) {
  const filter: Record<string, unknown> = { employee: employeeId };
  if (query.status) filter.status = query.status;
  if (query.leaveType) filter.leaveType = query.leaveType;
  if (query.year) {
    filter.startDate = { $gte: `${query.year}-01-01`, $lte: `${query.year}-12-31` };
  }

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    LeaveRequestModel.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit),
    LeaveRequestModel.countDocuments(filter),
  ]);

  return {
    leaves: items.map(toPublicLeave),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

interface AdminListQuery extends ListQuery {
  employeeId?: string;
  department?: string;
  designation?: string;
}

export async function adminListLeaves(query: AdminListQuery) {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;
  if (query.leaveType) filter.leaveType = query.leaveType;
  if (query.year) {
    filter.startDate = { $gte: `${query.year}-01-01`, $lte: `${query.year}-12-31` };
  }

  if (query.employeeId) {
    filter.employee = query.employeeId;
  } else if (query.department || query.designation) {
    const userFilter: Record<string, unknown> = {};
    if (query.department) userFilter.department = query.department;
    if (query.designation) userFilter.designation = query.designation;
    const matchingUsers = await UserModel.find(userFilter).select("_id");
    filter.employee = { $in: matchingUsers.map((u) => u._id) };
  }

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    LeaveRequestModel.find(filter)
      .populate({
        path: "employee",
        select: "employeeId fullName department designation",
        populate: [
          { path: "department", select: "name" },
          { path: "designation", select: "name" },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit),
    LeaveRequestModel.countDocuments(filter),
  ]);

  return {
    leaves: items.map((leave) => ({ ...toPublicLeave(leave), employee: leave.employee })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function cancelLeave(actor: Actor, leaveId: string) {
  const leave = await LeaveRequestModel.findById(leaveId);
  if (!leave) throw new ApiError(404, "Leave request not found");
  if (String(leave.employee) !== actor.id) {
    throw new ApiError(403, "You can only cancel your own leave requests");
  }
  if (leave.status !== LEAVE_REQUEST_STATUS.PENDING) {
    throw new ApiError(409, "Only pending leave requests can be cancelled");
  }

  leave.status = LEAVE_REQUEST_STATUS.CANCELLED;
  await leave.save();

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.LEAVE_CANCELLED,
    targetType: "LeaveRequest",
    targetId: toId(leave),
    metadata: { startDate: leave.startDate, endDate: leave.endDate },
  });

  return toPublicLeave(leave);
}

export async function approveLeave(actor: Actor, leaveId: string, comment?: string) {
  const session = await mongoose.startSession();
  let result: ILeaveRequest | null = null;

  try {
    await session.withTransaction(async () => {
      const leave = await LeaveRequestModel.findById(leaveId).session(session);
      if (!leave) throw new ApiError(404, "Leave request not found");
      if (leave.status !== LEAVE_REQUEST_STATUS.PENDING) {
        throw new ApiError(409, "This request has already been reviewed");
      }

      const year = Number(leave.startDate.slice(0, 4));
      const policy = getLeavePolicy();

      let balance = await LeaveBalanceModel.findOne({
        employee: leave.employee,
        year,
      }).session(session);
      if (!balance) {
        balance = new LeaveBalanceModel({ employee: leave.employee, year });
      }

      let field:
        | "sickUsedH1"
        | "sickUsedH2"
        | "casualPaidUsedH1"
        | "casualPaidUsedH2"
        | "annualUsed"
        | "unpaidUsed"
        | "compOffUsed";
      // null means "unlimited, no capacity check" (Unpaid Leave only).
      let quota: number | null = null;

      if (leave.leaveType === LEAVE_TYPES.SICK) {
        if (leaveHalf(leave.startDate) === "H1") {
          field = "sickUsedH1";
          quota = policy.sickQuotaPerHalf;
        } else {
          field = "sickUsedH2";
          const sickCarryForward =
            getLeaveTypePolicy(LEAVE_TYPES.SICK, policy).carryForwardEnabled ??
            policy.carryForwardEnabled;
          const h1Remaining = policy.sickQuotaPerHalf - balance.sickUsedH1;
          quota = policy.sickQuotaPerHalf + (sickCarryForward ? Math.max(0, h1Remaining) : 0);
        }
      } else if (leave.leaveType === LEAVE_TYPES.CASUAL_PAID) {
        if (leaveHalf(leave.startDate) === "H1") {
          field = "casualPaidUsedH1";
          quota = policy.casualPaidQuotaPerHalf;
        } else {
          field = "casualPaidUsedH2";
          const casualCarryForward =
            getLeaveTypePolicy(LEAVE_TYPES.CASUAL_PAID, policy).carryForwardEnabled ??
            policy.carryForwardEnabled;
          const h1Remaining = policy.casualPaidQuotaPerHalf - balance.casualPaidUsedH1;
          quota =
            policy.casualPaidQuotaPerHalf + (casualCarryForward ? Math.max(0, h1Remaining) : 0);
        }
      } else if (leave.leaveType === LEAVE_TYPES.ANNUAL) {
        field = "annualUsed";
        const employee = await UserModel.findById(leave.employee)
          .select("employmentType permanentSince")
          .session(session);
        if (employee) {
          creditAnnualAccrual(
            balance,
            employee.employmentType,
            employee.permanentSince,
            year,
            policy.annualAccrualPerMonth
          );
        }
        quota = balance.annualAccrued;
      } else if (leave.leaveType === LEAVE_TYPES.COMP_OFF) {
        field = "compOffUsed";
        quota = balance.compOffGranted;
      } else {
        field = "unpaidUsed";
      }

      if (quota !== null && balance[field] + leave.days > quota) {
        throw new ApiError(409, "Insufficient leave balance remaining to approve this request");
      }

      balance[field] += leave.days;
      await balance.save({ session });

      leave.status = LEAVE_REQUEST_STATUS.APPROVED;
      leave.reviewedBy = actor.id as never;
      leave.reviewComment = comment ?? null;
      await leave.save({ session });

      result = leave;
    });
  } finally {
    await session.endSession();
  }

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.LEAVE_APPROVED,
    targetType: "LeaveRequest",
    targetId: leaveId,
    metadata: { comment },
  });

  const approvedEmployee = await UserModel.findById(result!.employee).select("fullName");

  await notifyUser({
    user: String(result!.employee),
    type: NOTIFICATION_TYPES.LEAVE_APPROVED,
    title: "Leave request approved",
    message: `Your ${result!.leaveType} leave from ${result!.startDate} to ${result!.endDate} was approved`,
    metadata: { leaveId },
    email: {
      template: "leave-approved",
      data: {
        employeeName: approvedEmployee?.fullName ?? "there",
        leaveType: LEAVE_TYPE_LABELS[result!.leaveType],
        startDate: result!.startDate,
        endDate: result!.endDate,
        days: result!.days,
        comment: comment ?? null,
      },
    },
  });

  return toPublicLeave(result!);
}

export async function rejectLeave(actor: Actor, leaveId: string, comment?: string) {
  const leave = await LeaveRequestModel.findById(leaveId);
  if (!leave) throw new ApiError(404, "Leave request not found");
  if (leave.status !== LEAVE_REQUEST_STATUS.PENDING) {
    throw new ApiError(409, "This request has already been reviewed");
  }

  leave.status = LEAVE_REQUEST_STATUS.REJECTED;
  leave.reviewedBy = actor.id as never;
  leave.reviewComment = comment ?? null;
  await leave.save();

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.LEAVE_REJECTED,
    targetType: "LeaveRequest",
    targetId: toId(leave),
    metadata: { comment },
  });

  const rejectedEmployee = await UserModel.findById(leave.employee).select("fullName");

  await notifyUser({
    user: String(leave.employee),
    type: NOTIFICATION_TYPES.LEAVE_REJECTED,
    title: "Leave request rejected",
    message: `Your ${leave.leaveType} leave from ${leave.startDate} to ${leave.endDate} was rejected`,
    metadata: { leaveId: toId(leave) },
    email: {
      template: "leave-rejected",
      data: {
        employeeName: rejectedEmployee?.fullName ?? "there",
        leaveType: LEAVE_TYPE_LABELS[leave.leaveType],
        startDate: leave.startDate,
        endDate: leave.endDate,
        days: leave.days,
        comment: comment ?? null,
      },
    },
  });

  return toPublicLeave(leave);
}

// Gates the manual allocation trio below — never applyLeave/approveLeave/
// rejectLeave/cancelLeave, which are core day-to-day operations that must
// keep working for every employee regardless of migration status.
function assertLeaveMigrationConfirmed(employee: { leaveMigrationStatus: string }): void {
  if (employee.leaveMigrationStatus !== "CONFIRMED") {
    throw new ApiError(
      409,
      "Complete Leave Analysis & Migration confirmation before adjusting this employee's balance"
    );
  }
}

// The four leave types a manual grant/edit/delete can actually affect, and
// which "extra"/"granted" field each (type, period) pair maps to. Mirrors
// the branching already in grantExtraLeave/updateLeaveAllocation/
// deleteLeaveAllocation exactly — returns null for anything else (e.g.
// UNPAID, which those functions already silently no-op for) so callers
// know not to write a misleading audit row.
function resolveExtraField(
  leaveType: LeaveType,
  period: AllocationPeriod
): AdjustableBalanceField | null {
  if (leaveType === LEAVE_TYPES.COMP_OFF) return "compOffGranted";
  if (leaveType === LEAVE_TYPES.SICK) {
    return period === ALLOCATION_PERIOD.H1 ? "sickExtraH1" : "sickExtraH2";
  }
  if (leaveType === LEAVE_TYPES.CASUAL_PAID) {
    return period === ALLOCATION_PERIOD.H1 ? "casualPaidExtraH1" : "casualPaidExtraH2";
  }
  if (leaveType === LEAVE_TYPES.ANNUAL) return "annualExtra";
  return null;
}

async function recordBalanceAdjustment(params: {
  actor: Actor;
  employeeId: string;
  year: number;
  leaveType: LeaveType;
  period: AllocationPeriod | null;
  field: AdjustableBalanceField;
  previousValue: number;
  newValue: number;
  reason: string;
  source: LeaveBalanceAdjustmentSource;
  relatedAllocationId?: string | null;
}): Promise<void> {
  const adjustment = await LeaveBalanceAdjustmentModel.create({
    employee: params.employeeId,
    year: params.year,
    leaveType: params.leaveType,
    period: params.period,
    field: params.field,
    previousValue: params.previousValue,
    newValue: params.newValue,
    reason: params.reason,
    source: params.source,
    relatedAllocationId: params.relatedAllocationId ?? null,
    performedBy: params.actor.id,
  });

  await recordActivity({
    actor: params.actor,
    action: ACTIVITY_ACTIONS.LEAVE_BALANCE_ADJUSTED,
    targetType: "LeaveBalanceAdjustment",
    targetId: toId(adjustment),
    metadata: {
      employeeId: params.employeeId,
      field: params.field,
      previousValue: params.previousValue,
      newValue: params.newValue,
      source: params.source,
    },
  });
}

export interface GrantExtraLeaveInput {
  employeeId: string;
  days: number;
  reason: string;
  leaveType?: LeaveType;
  period?: AllocationPeriod;
  year?: number;
}

export async function grantExtraLeave(
  actor: Actor,
  input: GrantExtraLeaveInput,
  options?: { skipMigrationCheck?: boolean }
) {
  const employee = await UserModel.findById(input.employeeId);
  if (!employee) throw new ApiError(404, "Employee not found");
  if (!options?.skipMigrationCheck) assertLeaveMigrationConfirmed(employee);

  const year = input.year ?? new Date().getFullYear();

  let balance = await LeaveBalanceModel.findOne({ employee: input.employeeId, year });
  if (!balance) {
    balance = new LeaveBalanceModel({ employee: input.employeeId, year });
  }

  const leaveType = input.leaveType ?? LEAVE_TYPES.COMP_OFF;
  const period = input.period ?? ALLOCATION_PERIOD.ANNUAL;
  const field = resolveExtraField(leaveType, period);
  const previousValue = field ? balance[field] || 0 : 0;

  if (leaveType === LEAVE_TYPES.COMP_OFF) {
    balance.compOffGranted = (balance.compOffGranted || 0) + input.days;
  } else if (leaveType === LEAVE_TYPES.SICK) {
    if (period === ALLOCATION_PERIOD.H1) balance.sickExtraH1 += input.days;
    else balance.sickExtraH2 += input.days;
  } else if (leaveType === LEAVE_TYPES.CASUAL_PAID) {
    if (period === ALLOCATION_PERIOD.H1) balance.casualPaidExtraH1 += input.days;
    else balance.casualPaidExtraH2 += input.days;
  } else if (leaveType === LEAVE_TYPES.ANNUAL) {
    balance.annualExtra += input.days;
  }

  await balance.save();

  const allocation = await LeaveAllocationModel.create({
    employee: input.employeeId,
    leaveType,
    period,
    year,
    days: input.days,
    reason: input.reason,
    grantedBy: actor.id,
  });

  if (field) {
    await recordBalanceAdjustment({
      actor,
      employeeId: input.employeeId,
      year,
      leaveType,
      period,
      field,
      previousValue,
      newValue: balance[field] || 0,
      reason: input.reason,
      source: LEAVE_BALANCE_ADJUSTMENT_SOURCE.MANUAL_GRANT,
      relatedAllocationId: toId(allocation),
    });
  }

  await recordActivity({
    actor,
    action: "LEAVE_EXTRA_GRANTED",
    targetType: "LeaveAllocation",
    targetId: toId(allocation),
    metadata: {
      employeeId: input.employeeId,
      leaveType: input.leaveType,
      days: input.days,
      reason: input.reason,
    },
  });

  return allocation;
}

export async function adjustLeaveBalance(
  actor: Actor,
  employeeId: string,
  input: { leaveType: LeaveType; period?: AllocationPeriod; year: number; delta: number; reason: string }
) {
  const employee = await UserModel.findById(employeeId);
  if (!employee) throw new ApiError(404, "Employee not found");
  if (input.leaveType === LEAVE_TYPES.UNPAID) {
    throw new ApiError(400, "Unpaid Leave has no balance to manage");
  }

  const period = input.period ?? ALLOCATION_PERIOD.ANNUAL;
  if ((input.leaveType === LEAVE_TYPES.SICK || input.leaveType === LEAVE_TYPES.CASUAL_PAID) && period === ALLOCATION_PERIOD.ANNUAL) {
    throw new ApiError(400, "Select H1 or H2 for this leave type");
  }

  if (input.delta > 0) {
    await grantExtraLeave(actor, {
      employeeId,
      days: input.delta,
      reason: input.reason,
      leaveType: input.leaveType,
      period,
      year: input.year,
    }, { skipMigrationCheck: true });
    return { adjusted: true };
  }

  const amount = Math.abs(input.delta);
  if (input.leaveType === LEAVE_TYPES.COMP_OFF) {
    const current = await computeCompOffBalance(employeeId);
    if (amount > current.remaining) {
      throw new ApiError(409, "Cannot remove more Comp Off than the employee currently has remaining");
    }
    let remaining = amount;
    const allocations = await LeaveAllocationModel.find({
      employee: employeeId,
      leaveType: LEAVE_TYPES.COMP_OFF,
      days: { $gt: 0 },
    }).sort({ createdAt: -1 });
    for (const allocation of allocations) {
      if (remaining <= 0) break;
      const reduction = Math.min(allocation.days, remaining);
      allocation.days -= reduction;
      remaining -= reduction;
      if (allocation.days < 0.5) await allocation.deleteOne();
      else await allocation.save();
    }
    if (remaining > 0) throw new ApiError(409, "Cannot reduce Comp Off below its granted balance");
    await recordBalanceAdjustment({
      actor, employeeId, year: input.year, leaveType: input.leaveType, period: null,
      field: "compOffGranted", previousValue: current.granted, newValue: current.granted - amount,
      reason: input.reason, source: LEAVE_BALANCE_ADJUSTMENT_SOURCE.MANUAL_EDIT,
    });
    return { adjusted: true };
  }

  const balance = await LeaveBalanceModel.findOne({ employee: employeeId, year: input.year });
  if (!balance) throw new ApiError(409, "This employee has no adjustable balance for the selected year");
  const field = resolveExtraField(input.leaveType, period);
  if (!field) throw new ApiError(400, "This leave type cannot be adjusted");
  const previousValue = balance[field] || 0;
  const newValue = previousValue - amount;
  if (newValue < 0) throw new ApiError(409, "Cannot reduce below the manually granted balance");
  balance[field] = newValue;
  await balance.save();
  await recordBalanceAdjustment({
    actor, employeeId, year: input.year, leaveType: input.leaveType,
    period: input.leaveType === LEAVE_TYPES.ANNUAL ? null : period,
    field, previousValue, newValue, reason: input.reason,
    source: LEAVE_BALANCE_ADJUSTMENT_SOURCE.MANUAL_EDIT,
  });
  return { adjusted: true };
}

export async function listLeaveAllocations(query?: { employeeId?: string; year?: number }) {
  const filter: Record<string, unknown> = {};
  if (query?.employeeId) filter.employee = query.employeeId;
  if (query?.year) filter.year = query.year;

  const allocations = await LeaveAllocationModel.find(filter)
    .populate("employee", "employeeId fullName profilePhoto department designation")
    .populate("grantedBy", "fullName")
    .sort({ createdAt: -1 });

  return allocations.map((a) => {
    const emp = a.employee as unknown as { _id: unknown; employeeId: string; fullName: string; profilePhoto?: string };
    const admin = a.grantedBy as unknown as { fullName: string };
    return {
      id: toId(a),
      employee: {
        id: String(emp._id),
        employeeId: emp.employeeId,
        fullName: emp.fullName,
        profilePhoto: emp.profilePhoto ?? null,
      },
      leaveType: a.leaveType,
      period: a.period,
      year: a.year,
      days: a.days,
      reason: a.reason,
      grantedBy: admin?.fullName ?? "System Admin",
      createdAt: a.createdAt,
    };
  });
}

export async function updateLeaveAllocation(
  actor: Actor,
  id: string,
  input: { days?: number; reason?: string }
) {
  const allocation = await LeaveAllocationModel.findById(id);
  if (!allocation) throw new ApiError(404, "Leave allocation not found");

  const employee = await UserModel.findById(allocation.employee);
  if (!employee) throw new ApiError(404, "Employee not found");

  if (input.days !== undefined && input.days !== allocation.days) {
    const diff = input.days - allocation.days;
    const balance = await LeaveBalanceModel.findOne({
      employee: allocation.employee,
      year: allocation.year,
    });
    if (balance) {
      const field = resolveExtraField(allocation.leaveType, allocation.period);
      const previousValue = field ? balance[field] || 0 : 0;

      if (allocation.leaveType === LEAVE_TYPES.COMP_OFF) {
        balance.compOffGranted = Math.max(0, (balance.compOffGranted || 0) + diff);
      } else if (allocation.leaveType === LEAVE_TYPES.SICK) {
        if (allocation.period === ALLOCATION_PERIOD.H1) balance.sickExtraH1 = Math.max(0, balance.sickExtraH1 + diff);
        else balance.sickExtraH2 = Math.max(0, balance.sickExtraH2 + diff);
      } else if (allocation.leaveType === LEAVE_TYPES.CASUAL_PAID) {
        if (allocation.period === ALLOCATION_PERIOD.H1) balance.casualPaidExtraH1 = Math.max(0, balance.casualPaidExtraH1 + diff);
        else balance.casualPaidExtraH2 = Math.max(0, balance.casualPaidExtraH2 + diff);
      } else if (allocation.leaveType === LEAVE_TYPES.ANNUAL) {
        balance.annualExtra = Math.max(0, balance.annualExtra + diff);
      }
      await balance.save();

      if (field) {
        await recordBalanceAdjustment({
          actor,
          employeeId: String(allocation.employee),
          year: allocation.year,
          leaveType: allocation.leaveType,
          period: allocation.period,
          field,
          previousValue,
          newValue: balance[field] || 0,
          reason: input.reason ?? allocation.reason,
          source: LEAVE_BALANCE_ADJUSTMENT_SOURCE.MANUAL_EDIT,
          relatedAllocationId: id,
        });
      }
    }
    allocation.days = input.days;
  }

  if (input.reason !== undefined) {
    allocation.reason = input.reason;
  }

  await allocation.save();
  return allocation;
}

export async function deleteLeaveAllocation(actor: Actor, id: string) {
  const allocation = await LeaveAllocationModel.findById(id);
  if (!allocation) throw new ApiError(404, "Leave allocation not found");

  const employee = await UserModel.findById(allocation.employee);
  if (!employee) throw new ApiError(404, "Employee not found");

  const balance = await LeaveBalanceModel.findOne({
    employee: allocation.employee,
    year: allocation.year,
  });

  if (balance) {
    const field = resolveExtraField(allocation.leaveType, allocation.period);
    const previousValue = field ? balance[field] || 0 : 0;

    if (allocation.leaveType === LEAVE_TYPES.COMP_OFF) {
      balance.compOffGranted = Math.max(0, (balance.compOffGranted || 0) - allocation.days);
    } else if (allocation.leaveType === LEAVE_TYPES.SICK) {
      if (allocation.period === ALLOCATION_PERIOD.H1) balance.sickExtraH1 = Math.max(0, balance.sickExtraH1 - allocation.days);
      else balance.sickExtraH2 = Math.max(0, balance.sickExtraH2 - allocation.days);
    } else if (allocation.leaveType === LEAVE_TYPES.CASUAL_PAID) {
      if (allocation.period === ALLOCATION_PERIOD.H1) balance.casualPaidExtraH1 = Math.max(0, balance.casualPaidExtraH1 - allocation.days);
      else balance.casualPaidExtraH2 = Math.max(0, balance.casualPaidExtraH2 - allocation.days);
    } else if (allocation.leaveType === LEAVE_TYPES.ANNUAL) {
      balance.annualExtra = Math.max(0, balance.annualExtra - allocation.days);
    }
    await balance.save();

    if (field) {
      await recordBalanceAdjustment({
        actor,
        employeeId: String(allocation.employee),
        year: allocation.year,
        leaveType: allocation.leaveType,
        period: allocation.period,
        field,
        previousValue,
        newValue: balance[field] || 0,
        reason: `Deleted allocation: ${allocation.reason}`,
        source: LEAVE_BALANCE_ADJUSTMENT_SOURCE.MANUAL_DELETE,
        relatedAllocationId: id,
      });
    }
  }

  await allocation.deleteOne();
  return { id };
}

const ADJUSTABLE_FIELD_META: Record<
  AdjustableBalanceField,
  { leaveType: LeaveType; period: AllocationPeriod | null }
> = {
  sickUsedH1: { leaveType: LEAVE_TYPES.SICK, period: ALLOCATION_PERIOD.H1 },
  sickUsedH2: { leaveType: LEAVE_TYPES.SICK, period: ALLOCATION_PERIOD.H2 },
  sickExtraH1: { leaveType: LEAVE_TYPES.SICK, period: ALLOCATION_PERIOD.H1 },
  sickExtraH2: { leaveType: LEAVE_TYPES.SICK, period: ALLOCATION_PERIOD.H2 },
  casualPaidUsedH1: { leaveType: LEAVE_TYPES.CASUAL_PAID, period: ALLOCATION_PERIOD.H1 },
  casualPaidUsedH2: { leaveType: LEAVE_TYPES.CASUAL_PAID, period: ALLOCATION_PERIOD.H2 },
  casualPaidExtraH1: { leaveType: LEAVE_TYPES.CASUAL_PAID, period: ALLOCATION_PERIOD.H1 },
  casualPaidExtraH2: { leaveType: LEAVE_TYPES.CASUAL_PAID, period: ALLOCATION_PERIOD.H2 },
  annualAccrued: { leaveType: LEAVE_TYPES.ANNUAL, period: null },
  annualExtra: { leaveType: LEAVE_TYPES.ANNUAL, period: null },
  annualUsed: { leaveType: LEAVE_TYPES.ANNUAL, period: null },
  unpaidUsed: { leaveType: LEAVE_TYPES.UNPAID, period: null },
  compOffGranted: { leaveType: LEAVE_TYPES.COMP_OFF, period: null },
  compOffUsed: { leaveType: LEAVE_TYPES.COMP_OFF, period: null },
};

export interface ImportLeaveRow {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  days: number;
  status: LeaveImportStatus;
  reason?: string;
  externalReference?: string;
}

// Whole-batch validation already happened at the route layer (the Zod
// array schema rejects the entire request if any row is invalid) — by the
// time this runs, every row is known-good, so this is a plain bulk insert,
// never partial.
export async function importHistoricalLeave(
  actor: Actor,
  employeeId: string,
  input: { source: LeaveImportSource; sourceFilename?: string; rows: ImportLeaveRow[] }
) {
  const employee = await UserModel.findById(employeeId);
  if (!employee) throw new ApiError(404, "Employee not found");
  if (employee.leaveMigrationStatus === "CONFIRMED") {
    throw new ApiError(
      409,
      "This employee's leave migration is already confirmed — reopen it before importing more history"
    );
  }

  const importBatchId = new mongoose.Types.ObjectId().toString();

  const docs = input.rows.map((row) => ({
    employee: employeeId,
    source: input.source,
    leaveType: row.leaveType,
    startDate: row.startDate,
    endDate: row.endDate,
    days: row.days,
    status: row.status,
    reason: row.reason ?? null,
    externalReference: row.externalReference ?? null,
    sourceFilename: input.sourceFilename ?? null,
    importBatchId,
    importedBy: actor.id,
  }));

  const created = await LeaveImportRecordModel.insertMany(docs);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.LEAVE_HISTORY_IMPORTED,
    targetType: "LeaveImportRecord",
    targetId: importBatchId,
    metadata: { employeeId, importBatchId, rowCount: created.length, source: input.source },
  });

  return { importBatchId, importedCount: created.length };
}

export async function deleteImportBatch(actor: Actor, employeeId: string, batchId: string) {
  const employee = await UserModel.findById(employeeId);
  if (!employee) throw new ApiError(404, "Employee not found");
  if (employee.leaveMigrationStatus === "CONFIRMED") {
    throw new ApiError(
      409,
      "This employee's leave migration is already confirmed — historical records are locked"
    );
  }

  const result = await LeaveImportRecordModel.deleteMany({
    employee: employeeId,
    importBatchId: batchId,
  });
  if (result.deletedCount === 0) {
    throw new ApiError(404, "Import batch not found");
  }

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.LEAVE_IMPORT_BATCH_DELETED,
    targetType: "LeaveImportRecord",
    targetId: batchId,
    metadata: { employeeId, importBatchId: batchId, deletedCount: result.deletedCount },
  });

  return { deletedCount: result.deletedCount };
}

function toPublicImportRecord(record: ILeaveImportRecord) {
  return {
    id: toId(record),
    source: record.source,
    leaveType: record.leaveType,
    startDate: record.startDate,
    endDate: record.endDate,
    days: record.days,
    status: record.status,
    reason: record.reason,
    externalReference: record.externalReference,
    importBatchId: record.importBatchId,
    createdAt: record.createdAt,
  };
}

export async function getLeaveMigrationAnalysis(employeeId: string) {
  const employee = await UserModel.findById(employeeId)
    .select(
      "fullName employeeId leaveMigrationStatus leaveMigrationConfirmedBy leaveMigrationConfirmedAt leaveMigrationConfirmedReason"
    )
    .populate("leaveMigrationConfirmedBy", "fullName");
  if (!employee) throw new ApiError(404, "Employee not found");

  const year = new Date().getFullYear();
  const [balanceSummary, pendingRequests, nativeHistory, importedHistory] = await Promise.all([
    getLeaveBalance(employeeId, year),
    LeaveRequestModel.find({ employee: employeeId, status: LEAVE_REQUEST_STATUS.PENDING }).sort({
      startDate: -1,
    }),
    LeaveRequestModel.find({ employee: employeeId }).sort({ startDate: -1 }),
    LeaveImportRecordModel.find({ employee: employeeId }).sort({ startDate: -1 }),
  ]);

  const history = [
    ...nativeHistory.map((r) => ({ ...toPublicLeave(r), source: "NATIVE" as const })),
    ...importedHistory.map((r) => ({ ...toPublicImportRecord(r), source: r.source })),
  ].sort((a, b) => (a.startDate < b.startDate ? 1 : -1));

  const importBatchMap = new Map<
    string,
    { batchId: string; source: LeaveImportSource; sourceFilename: string | null; importedAt: Date; rowCount: number }
  >();
  for (const r of importedHistory) {
    const existing = importBatchMap.get(r.importBatchId);
    if (existing) {
      existing.rowCount += 1;
    } else {
      importBatchMap.set(r.importBatchId, {
        batchId: r.importBatchId,
        source: r.source,
        sourceFilename: r.sourceFilename,
        importedAt: r.createdAt,
        rowCount: 1,
      });
    }
  }

  // Proposed balance: sum APPROVED imported rows dated in the current year
  // into the matching "used" bucket. Prior-year imports still show up in
  // history above but don't auto-feed this year's math — carry-forward is
  // policy-dependent, so the admin adds it manually if needed instead of
  // the system silently guessing.
  const currentBalance = await LeaveBalanceModel.findOne({ employee: employeeId, year });
  const currentOf = (field: AdjustableBalanceField) => (currentBalance ? currentBalance[field] || 0 : 0);

  const proposalTotals = new Map<AdjustableBalanceField, number>();
  for (const r of importedHistory) {
    if (r.status !== LEAVE_IMPORT_STATUS.APPROVED) continue;
    if (r.startDate.slice(0, 4) !== String(year)) continue;

    let field: AdjustableBalanceField | null = null;
    if (r.leaveType === LEAVE_TYPES.SICK) field = leaveHalf(r.startDate) === "H1" ? "sickUsedH1" : "sickUsedH2";
    else if (r.leaveType === LEAVE_TYPES.CASUAL_PAID) field = leaveHalf(r.startDate) === "H1" ? "casualPaidUsedH1" : "casualPaidUsedH2";
    else if (r.leaveType === LEAVE_TYPES.ANNUAL) field = "annualUsed";
    else if (r.leaveType === LEAVE_TYPES.COMP_OFF) field = "compOffUsed";
    else if (r.leaveType === LEAVE_TYPES.UNPAID) field = "unpaidUsed";
    if (!field) continue;

    proposalTotals.set(field, (proposalTotals.get(field) ?? 0) + r.days);
  }

  const proposedAdjustments = Array.from(proposalTotals.entries()).map(([field, importedDays]) => ({
    field,
    leaveType: ADJUSTABLE_FIELD_META[field].leaveType,
    period: ADJUSTABLE_FIELD_META[field].period,
    currentValue: currentOf(field),
    proposedValue: Math.round((currentOf(field) + importedDays) * 100) / 100,
  }));

  return {
    employee: { id: toId(employee), fullName: employee.fullName, employeeId: employee.employeeId },
    migrationStatus: employee.leaveMigrationStatus,
    migrationConfirmedBy: employee.leaveMigrationConfirmedBy,
    migrationConfirmedAt: employee.leaveMigrationConfirmedAt,
    migrationConfirmedReason: employee.leaveMigrationConfirmedReason,
    balance: balanceSummary,
    pendingRequests: pendingRequests.map(toPublicLeave),
    history,
    importBatches: Array.from(importBatchMap.values()),
    proposedAdjustments,
  };
}

export interface ConfirmLeaveMigrationInput {
  reason: string;
  adjustments: { field: AdjustableBalanceField; newValue: number }[];
}

export async function confirmLeaveMigration(
  actor: Actor,
  employeeId: string,
  input: ConfirmLeaveMigrationInput
) {
  const employee = await UserModel.findById(employeeId);
  if (!employee) throw new ApiError(404, "Employee not found");
  if (employee.leaveMigrationStatus === "CONFIRMED") {
    throw new ApiError(409, "This employee's leave migration is already confirmed");
  }

  const year = new Date().getFullYear();
  let balance = await LeaveBalanceModel.findOne({ employee: employeeId, year });
  if (!balance) {
    balance = new LeaveBalanceModel({ employee: employeeId, year });
  }

  for (const adj of input.adjustments) {
    const previousValue = balance[adj.field] || 0;
    if (previousValue === adj.newValue) continue;

    balance[adj.field] = adj.newValue;

    // Comp Off balance is otherwise computed purely from LeaveAllocationModel
    // grants (see computeCompOffBalance) so each one can expire a month
    // after it was granted — a migration-set opening balance needs its own
    // ledger entry too, or it would be invisible to that calculation and
    // never show up (or expire) at all. Dated now, so it gets a full fresh
    // expiry window starting at confirmation, not backdated to whenever the
    // historical days were actually earned under Razorpay.
    if (adj.field === "compOffGranted" && adj.newValue > previousValue) {
      await LeaveAllocationModel.create({
        employee: employeeId,
        leaveType: LEAVE_TYPES.COMP_OFF,
        period: ALLOCATION_PERIOD.ANNUAL,
        year,
        days: adj.newValue - previousValue,
        reason: `Migration opening balance: ${input.reason}`,
        grantedBy: actor.id,
      });
    }

    const meta = ADJUSTABLE_FIELD_META[adj.field];
    await recordBalanceAdjustment({
      actor,
      employeeId,
      year,
      leaveType: meta.leaveType,
      period: meta.period,
      field: adj.field,
      previousValue,
      newValue: adj.newValue,
      reason: input.reason,
      source: LEAVE_BALANCE_ADJUSTMENT_SOURCE.MIGRATION_CONFIRM,
    });
  }
  await balance.save();

  employee.leaveMigrationStatus = "CONFIRMED";
  employee.leaveMigrationConfirmedBy = actor.id as never;
  employee.leaveMigrationConfirmedAt = new Date();
  employee.leaveMigrationConfirmedReason = input.reason;
  await employee.save();

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.LEAVE_MIGRATION_CONFIRMED,
    targetType: "User",
    targetId: employeeId,
    metadata: { reason: input.reason, adjustmentCount: input.adjustments.length },
  });

  return { employeeId, leaveMigrationStatus: employee.leaveMigrationStatus };
}

export async function reopenLeaveMigration(actor: Actor, employeeId: string) {
  const employee = await UserModel.findById(employeeId);
  if (!employee) throw new ApiError(404, "Employee not found");
  if (employee.leaveMigrationStatus !== "CONFIRMED") {
    throw new ApiError(409, "This employee's leave migration hasn't been confirmed yet");
  }

  employee.leaveMigrationStatus = "NOT_STARTED";
  employee.leaveMigrationConfirmedBy = null;
  employee.leaveMigrationConfirmedAt = null;
  employee.leaveMigrationConfirmedReason = null;
  await employee.save();

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.LEAVE_MIGRATION_REOPENED,
    targetType: "User",
    targetId: employeeId,
    metadata: {},
  });

  return { employeeId, leaveMigrationStatus: employee.leaveMigrationStatus };
}

export { resolveViewableEmployeeId };
