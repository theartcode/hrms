import mongoose from "mongoose";
import { ApiError } from "../../shared/errors/ApiError";
import { env } from "../../shared/config/env";
import { ROLES, Role } from "../../shared/constants/roles";
import {
  EMPLOYEE_STATUS,
  EmployeeStatus,
  LOGIN_ALLOWED_STATUSES,
} from "../../shared/constants/employeeStatus";
import { getISTDateString, daysBetweenDateStrings } from "../../shared/utils/istDate";
import { EMPLOYMENT_TYPE } from "../../shared/constants/employmentType";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { NOTIFICATION_TYPES } from "../../shared/constants/notificationTypes";
import { generateTempPassword, hashSecret } from "../../shared/utils/password";
import { toId } from "../../shared/utils/toId";
import { escapeRegex } from "../../shared/utils/regex";
import { recordActivity } from "../activity-log/activity-log.service";
import { notifyAdmins, notifyUser } from "../notifications/notifications.service";
import { NotificationModel } from "../notifications/notification.model";
import { DepartmentModel } from "../department/department.model";
import { DesignationModel } from "../designation/designation.model";
import { LocationModel } from "../location/location.model";
import { getOfficeSettings } from "../configuration/configuration.cache";
import { IUser, PAYMENT_INFO_REVIEW_STATUS, UserModel } from "../user/user.model";
import { CounterModel } from "../../shared/models/counter.model";
import { AttendanceModel } from "../attendance/attendance.model";
import { AttendanceCorrectionModel } from "../attendance-correction/attendance-correction.model";
import { LeaveRequestModel } from "../leave/leave-request.model";
import { LeaveBalanceModel } from "../leave/leave-balance.model";
import { purgeAllDocumentsForEmployee } from "../documents/document.service";

const EMPLOYEE_ID_PREFIX = "EMP-";
const EMPLOYEE_ID_PAD = 4;
const EMPLOYEE_ID_COUNTER = "employeeId";

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

interface Actor {
  id: string;
  role: Role;
  employeeId: string;
}

interface ListQuery {
  page: number;
  limit: number;
  search?: string;
  department?: string;
  designation?: string;
  role?: string;
  status?: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

function toPublicEmployee(user: IUser) {
  return {
    id: toId(user),
    employeeId: user.employeeId,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    department: user.department,
    designation: user.designation,
    role: user.role,
    status: user.status,
    mustChangePassword: user.mustChangePassword,
    joiningDate: user.joiningDate,
    dateOfBirth: user.dateOfBirth,
    profilePhoto: user.profilePhoto,
    address: user.address,
    emergencyContact: user.emergencyContact,
    gracePeriodOverrideMinutes: user.gracePeriodOverrideMinutes,
    employmentType: user.employmentType,
    permanentSince: user.permanentSince,
    probationEndDate: user.probationEndDate,
    probationEndNotifiedAt: user.probationEndNotifiedAt,
    salary: user.salary ?? null,
    bloodGroup: user.bloodGroup ?? null,
    manager: user.manager,
    location: user.location,
    gender: user.gender ?? null,
    whatsappEnabled: user.whatsappEnabled,
    shiftStartTime: user.shiftStartTime ?? null,
    shiftEndTime: user.shiftEndTime ?? null,
    numberOfBonuses: user.numberOfBonuses ?? null,
    advanceSalaryBalance: user.advanceSalaryBalance ?? null,
    advanceSalaryEmi: user.advanceSalaryEmi ?? null,
    paymentInfo: user.paymentInfo ?? null,
    statutoryInfo: user.statutoryInfo ?? null,
    pendingPaymentInfo: user.pendingPaymentInfo ?? null,
    paymentInfoReviewStatus: user.paymentInfoReviewStatus ?? null,
    paymentInfoReviewedAt: user.paymentInfoReviewedAt ?? null,
    paymentInfoReviewComment: user.paymentInfoReviewComment ?? null,
    leaveMigrationStatus: user.leaveMigrationStatus,
    leaveMigrationConfirmedBy: user.leaveMigrationConfirmedBy,
    leaveMigrationConfirmedAt: user.leaveMigrationConfirmedAt,
    leaveMigrationConfirmedReason: user.leaveMigrationConfirmedReason,
    createdAt: user.createdAt,
  };
}

const POPULATE_FIELDS = [
  { path: "department", select: "name isActive" },
  { path: "designation", select: "name isActive" },
  { path: "manager", select: "fullName employeeId" },
  { path: "location", select: "name isActive" },
];

export async function listEmployees(query: ListQuery) {
  const filter: Record<string, unknown> = {};

  if (query.search) {
    const regex = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [
      { employeeId: regex },
      { fullName: regex },
      { email: regex },
      { phone: regex },
    ];
  }
  if (query.department) filter.department = query.department;
  if (query.designation) filter.designation = query.designation;
  if (query.role) filter.role = query.role;
  if (query.status) filter.status = query.status;

  const skip = (query.page - 1) * query.limit;
  const sort: Record<string, 1 | -1> = {
    [query.sortBy]: query.sortOrder === "asc" ? 1 : -1,
  };

  const [users, total] = await Promise.all([
    UserModel.find(filter)
      .populate(POPULATE_FIELDS)
      .sort(sort)
      .skip(skip)
      .limit(query.limit),
    UserModel.countDocuments(filter),
  ]);

  return {
    employees: users.map(toPublicEmployee),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

function toAssignableEmployee(user: IUser) {
  return {
    id: toId(user),
    employeeId: user.employeeId,
    fullName: user.fullName,
    department: user.department,
  };
}

// Minimal, purpose-built listing for populating a task "assignee" picker —
// deliberately not the same data/access shape as listEmployees (which
// returns full employee records and is Admin/Super Admin only). Any
// authenticated user may call this, but what they see is scoped to their
// actual assignment authority: Admin/Super Admin get everyone, a
// Department Head gets only their own department's employees (the same
// live headEmployeeId query task.service.ts's assertCanAssignInto uses,
// never the display-only department.cache.ts), and anyone else gets an
// empty list. Nothing sensitive to leak either way — the response never
// includes email/phone/role/status/etc.
export async function listAssignableEmployees(actor: Actor) {
  const filter: Record<string, unknown> = {};

  if (actor.role !== ROLES.ADMIN && actor.role !== ROLES.SUPER_ADMIN) {
    const headedDepartments = await DepartmentModel.find({ headEmployeeId: actor.id }).select(
      "_id"
    );
    if (headedDepartments.length === 0) return [];
    filter.department = { $in: headedDepartments.map((d) => d._id) };
  }

  const users = await UserModel.find(filter)
    .select("employeeId fullName department")
    .populate({ path: "department", select: "name" })
    .sort({ fullName: 1 });

  return users.map(toAssignableEmployee);
}

export interface UpcomingAnniversary {
  employeeId: string;
  fullName: string;
  date: string;
  years: number;
}

// Visible to any authenticated employee (not just admins) — nothing
// sensitive here, just who's coming up on a work anniversary. "Anniversary"
// means years of service, so someone who joined this calendar year is
// excluded until their first one actually arrives (years >= 1).
export async function listUpcomingWorkAnniversaries(withinDays = 30): Promise<UpcomingAnniversary[]> {
  const employees = await UserModel.find({ status: { $in: LOGIN_ALLOWED_STATUSES } }).select(
    "employeeId fullName joiningDate"
  );

  const todayStr = getISTDateString();
  const todayYear = Number(todayStr.slice(0, 4));

  const results: UpcomingAnniversary[] = [];
  for (const employee of employees) {
    const joiningStr = getISTDateString(employee.joiningDate);
    const monthDay = joiningStr.slice(5);
    const joiningYear = Number(joiningStr.slice(0, 4));

    let occurrenceYear = todayYear;
    let occurrence = `${occurrenceYear}-${monthDay}`;
    if (occurrence < todayStr) {
      occurrenceYear += 1;
      occurrence = `${occurrenceYear}-${monthDay}`;
    }

    const years = occurrenceYear - joiningYear;
    if (years < 1) continue;

    const daysUntil = daysBetweenDateStrings(todayStr, occurrence);
    if (daysUntil > withinDays) continue;

    results.push({
      employeeId: employee.employeeId,
      fullName: employee.fullName,
      date: occurrence,
      years,
    });
  }

  results.sort((a, b) => a.date.localeCompare(b.date));
  return results;
}

async function assertReferenceDataExists(departmentId: string, designationId: string) {
  const [department, designation] = await Promise.all([
    DepartmentModel.findById(departmentId),
    DesignationModel.findById(designationId),
  ]);
  if (!department) throw new ApiError(400, "Selected department does not exist");
  if (!designation) throw new ApiError(400, "Selected designation does not exist");
}

interface CreateEmployeeInput {
  employeeId?: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  designation: string;
  joiningDate: Date;
  dateOfBirth?: Date;
  role: Role;
  status: EmployeeStatus;
  salary?: number | null;
  bloodGroup?: string | null;
}

// Atomic (Mongo's standard findOneAndUpdate + $inc counter pattern), so
// concurrent employee creations can never race onto the same number. On
// first-ever use it bootstraps the counter from the highest existing
// "EMP-####" employeeId already in the database (seed/legacy data), via a
// $setOnInsert upsert that's a no-op if another request already created
// the counter first — so this stays correct under concurrency too.
async function getNextEmployeeId(): Promise<string> {
  const counterExists = await CounterModel.exists({ _id: EMPLOYEE_ID_COUNTER });
  if (!counterExists) {
    const existingIds = await UserModel.find({
      employeeId: { $regex: /^EMP-\d+$/ },
    }).select("employeeId");
    const maxSeq = existingIds.reduce((max, u) => {
      const n = Number(u.employeeId.slice(EMPLOYEE_ID_PREFIX.length));
      return Number.isFinite(n) && n > max ? n : max;
    }, 0);
    await CounterModel.updateOne(
      { _id: EMPLOYEE_ID_COUNTER },
      { $setOnInsert: { seq: maxSeq } },
      { upsert: true }
    );
  }

  const counter = await CounterModel.findByIdAndUpdate(
    EMPLOYEE_ID_COUNTER,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `${EMPLOYEE_ID_PREFIX}${String(counter!.seq).padStart(EMPLOYEE_ID_PAD, "0")}`;
}

export async function createEmployee(actor: Actor, input: CreateEmployeeInput) {
  if (actor.role === ROLES.ADMIN && input.role !== ROLES.EMPLOYEE) {
    throw new ApiError(403, "Admins can only create Employee accounts");
  }

  const existingByEmail = await UserModel.findOne({ email: input.email.toLowerCase() });
  if (existingByEmail) {
    throw new ApiError(409, `Email "${input.email}" is already in use`);
  }

  let employeeId: string;
  if (input.employeeId && input.employeeId.trim()) {
    employeeId = input.employeeId.trim();
    const existingByEmpId = await UserModel.findOne({ employeeId });
    if (existingByEmpId) {
      throw new ApiError(409, `Employee ID "${employeeId}" is already in use`);
    }
  } else {
    employeeId = await getNextEmployeeId();
  }

  await assertReferenceDataExists(input.department, input.designation);

  const tempPassword = generateTempPassword();
  const passwordHash = await hashSecret(tempPassword);

  // Every new employee starts on Probation (employmentType isn't even
  // settable via createEmployeeSchema) — auto-fill the end date from the
  // company default so admins never have to remember to set it manually;
  // it stays editable afterward via updateEmployee.
  const probationEndDate = addMonths(
    input.joiningDate,
    getOfficeSettings().defaultProbationMonths
  );

  let user: IUser;
  try {
    user = await UserModel.create({
      employeeId,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      department: input.department,
      designation: input.designation,
      joiningDate: input.joiningDate,
      dateOfBirth: input.dateOfBirth ?? null,
      role: input.role,
      status: input.status,
      salary: input.salary ?? null,
      bloodGroup: input.bloodGroup ?? null,
      probationEndDate,
      passwordHash,
      mustChangePassword: true,
    });
  } catch (err) {
    // Fallback for a race between the pre-check above and the insert.
    if (isDuplicateKeyError(err)) {
      throw new ApiError(409, "Employee ID or email is already in use");
    }
    throw err;
  }

  await user.populate(POPULATE_FIELDS);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.EMPLOYEE_CREATED,
    targetType: "User",
    targetId: toId(user),
    metadata: { employeeId: user.employeeId, role: user.role },
  });

  await notifyAdmins(actor.id, {
    type: NOTIFICATION_TYPES.EMPLOYEE_CREATED,
    title: "New employee added",
    message: `${user.fullName} (${user.employeeId}) was added to the system`,
    metadata: { employeeId: toId(user) },
  });

  // Welcome email doubles as the "temporary password" email — one email at
  // one event, rather than two near-identical messages landing at once.
  await notifyUser({
    user: toId(user),
    type: NOTIFICATION_TYPES.EMPLOYEE_CREATED,
    title: "Welcome to the team",
    message: `Your HRMS account has been created. Employee ID: ${user.employeeId}`,
    metadata: { employeeId: toId(user) },
    email: {
      template: "welcome",
      data: {
        fullName: user.fullName,
        employeeId: user.employeeId,
        email: user.email,
        tempPassword,
        loginUrl: `${env.clientOrigin}/login`,
      },
    },
  });

  return { employee: toPublicEmployee(user), tempPassword };
}

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

export async function getEmployeeById(actor: Actor, id: string) {
  if (actor.role === ROLES.EMPLOYEE && actor.id !== id) {
    throw new ApiError(403, "You can only view your own information");
  }

  const user = await UserModel.findById(id).populate(POPULATE_FIELDS);
  if (!user) {
    throw new ApiError(404, "Employee not found");
  }

  return toPublicEmployee(user);
}

interface UpdateEmployeeInput {
  employeeId?: string;
  fullName?: string;
  phone?: string;
  department?: string;
  designation?: string;
  joiningDate?: Date;
  probationEndDate?: Date | null;
  dateOfBirth?: Date;
  gracePeriodOverrideMinutes?: number | null;
  role?: Role;
  status?: EmployeeStatus;
  salary?: number | null;
  bloodGroup?: string | null;
  manager?: string | null;
  location?: string | null;
  gender?: string | null;
  whatsappEnabled?: boolean;
  shiftStartTime?: string | null;
  shiftEndTime?: string | null;
  numberOfBonuses?: number | null;
  advanceSalaryBalance?: number | null;
  advanceSalaryEmi?: number | null;
  paymentInfo?: IUser["paymentInfo"];
  statutoryInfo?: IUser["statutoryInfo"];
}

export async function updateEmployee(
  actor: Actor,
  id: string,
  input: UpdateEmployeeInput
) {
  const user = await UserModel.findById(id);
  if (!user) {
    throw new ApiError(404, "Employee not found");
  }

  if (input.role !== undefined && input.role !== user.role) {
    // Mirrors createEmployee's rule — only a Super Admin can grant/revoke
    // Admin access. A regular Admin managing a role change (even down to
    // Employee) is refused outright rather than silently ignored, so the
    // request fails loudly instead of applying every other field change
    // and leaving the admin to wonder why the role didn't take.
    if (actor.role !== ROLES.SUPER_ADMIN) {
      throw new ApiError(403, "Only a Super Admin can change an employee's role");
    }
    // Super Admin accounts aren't manageable through this generic edit
    // form — guards against accidentally demoting the only super admin.
    if (user.role === ROLES.SUPER_ADMIN) {
      throw new ApiError(403, "A Super Admin's role cannot be changed here");
    }
  }

  if (input.department || input.designation) {
    await assertReferenceDataExists(
      input.department ?? String(user.department),
      input.designation ?? String(user.designation)
    );
  }

  if (input.manager) {
    if (input.manager === id) {
      throw new ApiError(400, "An employee cannot be their own manager");
    }
    const manager = await UserModel.findById(input.manager);
    if (!manager) throw new ApiError(400, "Selected manager does not exist");
  }
  if (input.location) {
    const location = await LocationModel.findById(input.location);
    if (!location) throw new ApiError(400, "Selected location does not exist");
  }

  const previousStatus = user.status;

  if (input.employeeId !== undefined && input.employeeId !== user.employeeId) {
    const existing = await UserModel.findOne({ employeeId: input.employeeId });
    if (existing) {
      throw new ApiError(409, `Employee ID "${input.employeeId}" is already in use`);
    }
    user.employeeId = input.employeeId;
  }
  if (input.fullName !== undefined) user.fullName = input.fullName;
  if (input.phone !== undefined) user.phone = input.phone;
  if (input.department !== undefined) user.department = input.department as never;
  if (input.designation !== undefined) user.designation = input.designation as never;
  if (input.joiningDate !== undefined) user.joiningDate = input.joiningDate;
  if (input.probationEndDate !== undefined) {
    user.probationEndDate = input.probationEndDate;
    // A newly-set (or newly-cleared) date deserves its own notification
    // when it actually arrives — don't let a stale "already notified" flag
    // from a previous date suppress that.
    user.probationEndNotifiedAt = null;
  }
  if (input.dateOfBirth !== undefined) user.dateOfBirth = input.dateOfBirth;
  if (input.gracePeriodOverrideMinutes !== undefined) {
    user.gracePeriodOverrideMinutes = input.gracePeriodOverrideMinutes;
  }
  if (input.salary !== undefined) user.salary = input.salary;
  if (input.bloodGroup !== undefined) user.bloodGroup = input.bloodGroup;
  if (input.role !== undefined) user.role = input.role;
  if (input.status !== undefined) user.status = input.status;
  if (input.manager !== undefined) user.manager = input.manager as never;
  if (input.location !== undefined) user.location = input.location as never;
  if (input.gender !== undefined) user.gender = input.gender as never;
  if (input.whatsappEnabled !== undefined) user.whatsappEnabled = input.whatsappEnabled;
  if (input.shiftStartTime !== undefined) user.shiftStartTime = input.shiftStartTime;
  if (input.shiftEndTime !== undefined) user.shiftEndTime = input.shiftEndTime;
  if (input.numberOfBonuses !== undefined) user.numberOfBonuses = input.numberOfBonuses;
  if (input.advanceSalaryBalance !== undefined)
    user.advanceSalaryBalance = input.advanceSalaryBalance;
  if (input.advanceSalaryEmi !== undefined) user.advanceSalaryEmi = input.advanceSalaryEmi;
  if (input.paymentInfo !== undefined) {
    user.paymentInfo = input.paymentInfo;
    // An admin setting bank details directly supersedes any employee-
    // submitted proposal awaiting review — leaving it in place would let a
    // later approve/reject silently clobber what the admin just set.
    user.pendingPaymentInfo = null;
    user.paymentInfoReviewStatus = null;
    user.paymentInfoReviewedBy = null;
    user.paymentInfoReviewedAt = null;
    user.paymentInfoReviewComment = null;
  }
  if (input.statutoryInfo !== undefined) user.statutoryInfo = input.statutoryInfo;

  if (
    input.status &&
    input.status !== previousStatus &&
    !LOGIN_ALLOWED_STATUSES.includes(input.status)
  ) {
    user.refreshTokenHash = null;
  }

  await user.save();
  await user.populate(POPULATE_FIELDS);

  let action: (typeof ACTIVITY_ACTIONS)[keyof typeof ACTIVITY_ACTIONS] =
    ACTIVITY_ACTIONS.EMPLOYEE_UPDATED;
  if (input.status && input.status !== previousStatus) {
    if (input.status === EMPLOYEE_STATUS.ACTIVE) {
      action = ACTIVITY_ACTIONS.EMPLOYEE_ACTIVATED;
    } else if (input.status === EMPLOYEE_STATUS.INACTIVE) {
      action = ACTIVITY_ACTIONS.EMPLOYEE_DEACTIVATED;
    }
  }

  await recordActivity({
    actor,
    action,
    targetType: "User",
    targetId: toId(user),
    metadata: { changes: input },
  });

  await notifyAdmins(actor.id, {
    type: NOTIFICATION_TYPES.EMPLOYEE_UPDATED,
    title: "Employee record updated",
    message: `${user.fullName} (${user.employeeId}) was updated`,
    metadata: { employeeId: toId(user) },
  });

  return toPublicEmployee(user);
}

export async function setEmployeeActive(actor: Actor, id: string, isActive: boolean) {
  return updateEmployee(actor, id, {
    status: isActive ? EMPLOYEE_STATUS.ACTIVE : EMPLOYEE_STATUS.INACTIVE,
  });
}

// One-way: Probation -> Permanent only, no revert action. permanentSince
// is the reference point Annual Leave accrual counts eligible months from
// (see leave.service.ts's creditAnnualAccrual) — Probation employees don't
// accrue at all, so this is also the moment accrual starts for them.
export async function promoteToPermanent(actor: Actor, id: string) {
  const user = await UserModel.findById(id);
  if (!user) {
    throw new ApiError(404, "Employee not found");
  }
  if (user.employmentType === EMPLOYMENT_TYPE.PERMANENT) {
    throw new ApiError(409, "This employee is already Permanent");
  }

  user.employmentType = EMPLOYMENT_TYPE.PERMANENT;
  user.permanentSince = new Date();
  await user.save();
  await user.populate(POPULATE_FIELDS);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.EMPLOYEE_UPDATED,
    targetType: "User",
    targetId: toId(user),
    metadata: { employmentType: EMPLOYMENT_TYPE.PERMANENT },
  });

  await notifyAdmins(actor.id, {
    type: NOTIFICATION_TYPES.EMPLOYEE_UPDATED,
    title: "Employee marked Permanent",
    message: `${user.fullName} (${user.employeeId}) was marked as a Permanent employee`,
    metadata: { employeeId: toId(user) },
  });

  return toPublicEmployee(user);
}

// Unconditional hard delete — removes the employee and cascades to every
// record that belongs to them (attendance, leave requests, leave balances,
// attendance corrections), so nothing is left pointing at a deleted user.
// This is irreversible and destroys history; there is no confirmation
// beyond the confirm dialog the caller already showed. Deactivating or
// marking someone Resigned/Terminated is the alternative when the history
// needs to be kept.
export async function deleteEmployee(actor: Actor, id: string): Promise<void> {
  const user = await UserModel.findById(id);
  if (!user) {
    throw new ApiError(404, "Employee not found");
  }

  if (actor.id === id) {
    throw new ApiError(403, "You cannot delete your own account");
  }
  if (user.role === ROLES.SUPER_ADMIN) {
    throw new ApiError(403, "A Super Admin account cannot be deleted");
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Everything that belongs TO this employee goes with them.
      await AttendanceModel.deleteMany({ employee: id }).session(session);
      await LeaveRequestModel.deleteMany({ employee: id }).session(session);
      await LeaveBalanceModel.deleteMany({ employee: id }).session(session);
      await AttendanceCorrectionModel.deleteMany({ employee: id }).session(session);
      await NotificationModel.deleteMany({ user: id }).session(session);
      // Requests that belong to someone else but this employee reviewed —
      // not deleted (that history isn't theirs to lose), just detached so
      // the reference doesn't dangle.
      await LeaveRequestModel.updateMany(
        { reviewedBy: id },
        { $set: { reviewedBy: null } }
      ).session(session);
      await AttendanceCorrectionModel.updateMany(
        { reviewedBy: id },
        { $set: { reviewedBy: null } }
      ).session(session);
      await UserModel.findByIdAndDelete(id).session(session);
    });
  } finally {
    await session.endSession();
  }

  // S3 isn't part of the Mongo transaction above — this runs after it
  // commits, same best-effort spirit as deleteObject itself (a stray S3
  // object left behind is a minor cleanup issue, not a reason to fail an
  // otherwise-successful employee deletion).
  await purgeAllDocumentsForEmployee(id);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.EMPLOYEE_DELETED,
    targetType: "User",
    targetId: id,
    metadata: { employeeId: user.employeeId, fullName: user.fullName },
  });

  await notifyAdmins(actor.id, {
    type: NOTIFICATION_TYPES.EMPLOYEE_DELETED,
    title: "Employee deleted",
    message: `${user.fullName} (${user.employeeId}) was permanently deleted`,
    metadata: { employeeId: user.employeeId },
  });
}

export async function getMyProfile(userId: string) {
  const user = await UserModel.findById(userId).populate(POPULATE_FIELDS);
  if (!user) {
    throw new ApiError(404, "Employee not found");
  }
  return toPublicEmployee(user);
}

interface UpdateProfileInput {
  phone?: string;
  dateOfBirth?: Date;
  address?: string;
  profilePhoto?: string;
  emergencyContact?: { name: string; phone: string };
}

export async function updateMyProfile(userId: string, input: UpdateProfileInput) {
  const user = await UserModel.findById(userId);
  if (!user) {
    throw new ApiError(404, "Employee not found");
  }

  if (input.phone !== undefined) user.phone = input.phone;
  if (input.dateOfBirth !== undefined) user.dateOfBirth = input.dateOfBirth;
  if (input.address !== undefined) user.address = input.address;
  if (input.profilePhoto !== undefined) user.profilePhoto = input.profilePhoto;
  if (input.emergencyContact !== undefined) {
    user.emergencyContact = input.emergencyContact;
  }

  await user.save();
  await user.populate(POPULATE_FIELDS);
  return toPublicEmployee(user);
}

interface PaymentInfoInput {
  ifscCode: string;
  accountNumber: string;
  accountHolderName: string;
}

// Self-service only — an admin changes bank details directly through
// updateEmployee instead (see the pending-state reset there). The proposal
// replaces whatever was previously pending; it never touches the live
// `paymentInfo` used for payroll until an admin approves it below.
export async function submitPaymentInfoChange(actor: Actor, input: PaymentInfoInput) {
  const user = await UserModel.findById(actor.id);
  if (!user) {
    throw new ApiError(404, "Employee not found");
  }

  user.pendingPaymentInfo = input as never;
  user.paymentInfoReviewStatus = PAYMENT_INFO_REVIEW_STATUS.PENDING;
  user.paymentInfoReviewedBy = null;
  user.paymentInfoReviewedAt = null;
  user.paymentInfoReviewComment = null;
  await user.save();
  await user.populate(POPULATE_FIELDS);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.PAYMENT_INFO_SUBMITTED,
    targetType: "User",
    targetId: toId(user),
    metadata: {},
  });

  await notifyAdmins(actor.id, {
    type: NOTIFICATION_TYPES.PAYMENT_INFO_SUBMITTED,
    title: "Bank details change awaiting approval",
    message: `${user.fullName} (${user.employeeId}) submitted new bank details for approval`,
    metadata: { employeeId: toId(user) },
  });

  return toPublicEmployee(user);
}

async function getPendingPaymentInfoForReview(id: string): Promise<IUser> {
  const user = await UserModel.findById(id);
  if (!user) {
    throw new ApiError(404, "Employee not found");
  }
  if (user.paymentInfoReviewStatus !== PAYMENT_INFO_REVIEW_STATUS.PENDING || !user.pendingPaymentInfo) {
    throw new ApiError(409, "There is no pending bank details change to review");
  }
  return user;
}

export async function approvePaymentInfoChange(actor: Actor, id: string) {
  const user = await getPendingPaymentInfoForReview(id);

  user.paymentInfo = user.pendingPaymentInfo;
  user.pendingPaymentInfo = null;
  user.paymentInfoReviewStatus = PAYMENT_INFO_REVIEW_STATUS.APPROVED;
  user.paymentInfoReviewedBy = actor.id as never;
  user.paymentInfoReviewedAt = new Date();
  user.paymentInfoReviewComment = null;
  await user.save();
  await user.populate(POPULATE_FIELDS);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.PAYMENT_INFO_APPROVED,
    targetType: "User",
    targetId: toId(user),
    metadata: {},
  });

  await notifyUser({
    user: toId(user),
    type: NOTIFICATION_TYPES.PAYMENT_INFO_APPROVED,
    title: "Bank details approved",
    message: "Your updated bank details were approved and are now active.",
    metadata: {},
  });

  return toPublicEmployee(user);
}

export async function rejectPaymentInfoChange(actor: Actor, id: string, comment?: string) {
  const user = await getPendingPaymentInfoForReview(id);

  user.pendingPaymentInfo = null;
  user.paymentInfoReviewStatus = PAYMENT_INFO_REVIEW_STATUS.REJECTED;
  user.paymentInfoReviewedBy = actor.id as never;
  user.paymentInfoReviewedAt = new Date();
  user.paymentInfoReviewComment = comment ?? null;
  await user.save();
  await user.populate(POPULATE_FIELDS);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.PAYMENT_INFO_REJECTED,
    targetType: "User",
    targetId: toId(user),
    metadata: { comment },
  });

  await notifyUser({
    user: toId(user),
    type: NOTIFICATION_TYPES.PAYMENT_INFO_REJECTED,
    title: "Bank details change rejected",
    message: comment
      ? `Your bank details change was rejected: ${comment}`
      : "Your bank details change was rejected.",
    metadata: {},
  });

  return toPublicEmployee(user);
}
