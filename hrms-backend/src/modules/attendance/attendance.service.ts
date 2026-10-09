import { Types } from "mongoose";
import { ApiError } from "../../shared/errors/ApiError";
import { ATTENDANCE_STATUS, AttendanceStatus } from "../../shared/constants/attendanceStatus";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { toId } from "../../shared/utils/toId";
import { exporters } from "../../shared/utils/csv";
import { Populated, NameRef } from "../../shared/types/populated";
import { enumerateISTDateStrings, getISTDateString } from "../../shared/utils/istDate";
import { recordActivity } from "../activity-log/activity-log.service";
import { HolidayModel } from "../holiday/holiday.model";
import { UserModel } from "../user/user.model";
import { LOGIN_ALLOWED_STATUSES } from "../../shared/constants/employeeStatus";
import { isConfiguredWeekend, getOfficeSettings } from "../configuration/configuration.cache";
import { resolveViewableEmployeeId as resolveViewableEmployeeIdShared } from "../../shared/utils/resolveViewableEmployeeId";
import { AttendanceModel, IAttendance } from "./attendance.model";
import { computeAttendanceStatus, deriveDisplayStatus } from "./attendance.util";
import { getApprovedLeaveDateSet } from "../leave/leave.service";

interface Actor {
  id: string;
  role: string;
  employeeId: string;
}

// The runtime shape of `record.employee` after the admin list/export
// queries' `.populate({ path: "employee", select: "employeeId fullName
// department designation", populate: [...] })` — see adminListAttendance
// and exportAttendanceCsv below. Mongoose doesn't track populate() in its
// static types, so this stands in for the `any` that would otherwise be
// needed to read it back.
type PopulatedAttendanceEmployeeBase = {
  _id: Types.ObjectId;
  employeeId: string;
  fullName: string;
  department: unknown;
  designation: unknown;
};
type PopulatedAttendanceEmployee = Populated<
  PopulatedAttendanceEmployeeBase,
  "department" | "designation",
  NameRef
>;

export interface PublicAttendanceRecord {
  id: string;
  date: string;
  checkIn: Date | null;
  checkOut: Date | null;
  workedHours: number | null;
  status: AttendanceStatus | null;
}

async function getGraceOverrideMinutes(employeeId: string): Promise<number | null> {
  const employee = await UserModel.findById(employeeId).select("gracePeriodOverrideMinutes");
  return employee?.gracePeriodOverrideMinutes ?? null;
}

function toPublicRecord(
  record: IAttendance,
  todayStr: string
): PublicAttendanceRecord {
  const displayStatus: AttendanceStatus = deriveDisplayStatus(record, todayStr);

  return {
    id: toId(record),
    date: record.date,
    checkIn: record.checkIn,
    checkOut: record.checkOut,
    workedHours: record.workedHours,
    status: displayStatus,
  };
}

export async function checkIn(actor: Actor): Promise<PublicAttendanceRecord> {
  const now = new Date();
  const todayStr = getISTDateString(now);

  const existing = await AttendanceModel.findOne({
    employee: actor.id,
    date: todayStr,
  });

  if (existing?.checkIn) {
    throw new ApiError(409, "You have already checked in today");
  }

  const graceOverride = await getGraceOverrideMinutes(actor.id);
  const { status } = computeAttendanceStatus(now, null, graceOverride);

  const record =
    existing ??
    new AttendanceModel({ employee: actor.id, date: todayStr, status });

  record.checkIn = now;
  record.status = status;
  await record.save();

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.CHECK_IN,
    targetType: "Attendance",
    targetId: toId(record),
    metadata: { date: todayStr, checkIn: now },
  });

  return toPublicRecord(record, todayStr);
}

export async function checkOut(actor: Actor): Promise<PublicAttendanceRecord> {
  const now = new Date();
  const todayStr = getISTDateString(now);

  const record = await AttendanceModel.findOne({
    employee: actor.id,
    date: todayStr,
  });

  if (!record?.checkIn) {
    throw new ApiError(400, "You must check in before checking out");
  }
  if (record.checkOut) {
    throw new ApiError(409, "You have already checked out today");
  }

  const graceOverride = await getGraceOverrideMinutes(actor.id);
  const { status, workedHours } = computeAttendanceStatus(record.checkIn, now, graceOverride);
  record.checkOut = now;
  record.status = status;
  record.workedHours = workedHours;
  await record.save();

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.CHECK_OUT,
    targetType: "Attendance",
    targetId: toId(record),
    metadata: { date: todayStr, checkOut: now, workedHours },
  });

  return toPublicRecord(record, todayStr);
}

export async function getToday(employeeId: string): Promise<PublicAttendanceRecord | null> {
  const todayStr = getISTDateString(new Date());
  const record = await AttendanceModel.findOne({ employee: employeeId, date: todayStr });
  return record ? toPublicRecord(record, todayStr) : null;
}

/** Configured office hours, safe for any authenticated employee (not just admins) to read. */
export function getOfficeHours(): { startTime: string; endTime: string; gracePeriodMinutes: number } {
  const { startTime, endTime, gracePeriodMinutes } = getOfficeSettings();
  return { startTime, endTime, gracePeriodMinutes };
}

/**
 * Admin-only direct edit of a specific employee's attendance for a specific
 * date — distinct from the employee-submitted correction-request/approval
 * flow, this lets an admin set the record outright (e.g. backfilling a day
 * that was never checked in, fixing a bad timestamp). Passing both
 * checkIn/checkOut as null deletes the record entirely, reverting that date
 * to whatever getMonthDayStatuses synthesizes (Absent/Weekend/Holiday/On
 * Leave) — there is no stored "manually cleared" state to track separately.
 */
export async function adminSetAttendance(
  admin: Actor,
  employeeId: string,
  date: string,
  input: { checkIn: Date | null; checkOut: Date | null }
): Promise<PublicAttendanceRecord | null> {
  const employee = await UserModel.findById(employeeId).select("gracePeriodOverrideMinutes");
  if (!employee) throw new ApiError(404, "Employee not found");

  if (input.checkOut && !input.checkIn) {
    throw new ApiError(422, "Check-out requires a check-in time");
  }

  const existing = await AttendanceModel.findOne({ employee: employeeId, date });

  if (!input.checkIn && !input.checkOut) {
    if (existing) {
      const targetId = toId(existing);
      await existing.deleteOne();
      await recordActivity({
        actor: admin,
        action: ACTIVITY_ACTIONS.ATTENDANCE_ADMIN_CLEARED,
        targetType: "Attendance",
        targetId,
        metadata: { employeeId, date },
      });
    }
    return null;
  }

  const { status, workedHours } = computeAttendanceStatus(
    input.checkIn!,
    input.checkOut,
    employee.gracePeriodOverrideMinutes ?? null
  );

  const record = existing ?? new AttendanceModel({ employee: employeeId, date, status });
  record.checkIn = input.checkIn;
  record.checkOut = input.checkOut;
  record.status = status;
  record.workedHours = workedHours;
  await record.save();

  await recordActivity({
    actor: admin,
    action: ACTIVITY_ACTIONS.ATTENDANCE_ADMIN_EDITED,
    targetType: "Attendance",
    targetId: toId(record),
    metadata: { employeeId, date, checkIn: input.checkIn, checkOut: input.checkOut },
  });

  return toPublicRecord(record, getISTDateString(new Date()));
}

export interface DayStatusEntry {
  date: string;
  checkIn: Date | null;
  checkOut: Date | null;
  workedHours: number | null;
  status: AttendanceStatus | null;
  // Set only when status is HOLIDAY — which named holiday it is.
  holidayName?: string | null;
}

/**
 * The single source of truth for "what happened on day X" — used by both
 * the history table and the calendar view so they can never disagree.
 * Days with a real record use its (possibly Missed Checkout-adjusted)
 * status; days without one are synthesized per the automatic attendance
 * rules. Today (if nothing recorded yet) and future days return a null
 * status rather than guessing — see Phase 4 completion notes.
 */
export async function getMonthDayStatuses(
  employeeId: string,
  year: number,
  month: number // 1-12
): Promise<DayStatusEntry[]> {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const todayStr = getISTDateString(new Date());

  const [records, holidays, leaveDates] = await Promise.all([
    AttendanceModel.find({ employee: employeeId, date: { $gte: start, $lte: end } }),
    HolidayModel.find({ isActive: true, date: { $gte: start, $lte: end } }),
    getApprovedLeaveDateSet(employeeId, start, end),
  ]);

  const recordsByDate = new Map(records.map((r) => [r.date, r]));
  const holidayDates = new Set(holidays.map((h) => h.date));
  const holidayNameByDate = new Map(holidays.map((h) => [h.date, h.name]));

  return enumerateISTDateStrings(start, end).map((dateStr) => {
    const record = recordsByDate.get(dateStr);
    if (record) {
      const publicRecord = toPublicRecord(record, todayStr);
      return {
        date: dateStr,
        checkIn: publicRecord.checkIn,
        checkOut: publicRecord.checkOut,
        workedHours: publicRecord.workedHours,
        status: publicRecord.status,
      };
    }

    // Weekend/Holiday/Leave are scheduled facts, known regardless of
    // whether the date is in the past or future — only "no data, no
    // schedule" is genuinely undetermined (null for today/future, Absent
    // once the day has passed without a record).
    let status: AttendanceStatus | null;
    if (isConfiguredWeekend(new Date(`${dateStr}T12:00:00+05:30`))) {
      status = ATTENDANCE_STATUS.WEEKEND;
    } else if (holidayDates.has(dateStr)) {
      status = ATTENDANCE_STATUS.HOLIDAY;
    } else if (leaveDates.has(dateStr)) {
      status = ATTENDANCE_STATUS.ON_LEAVE;
    } else if (dateStr >= todayStr) {
      status = null; // today (still in progress) or a future working day
    } else {
      status = ATTENDANCE_STATUS.ABSENT;
    }

    return {
      date: dateStr,
      checkIn: null,
      checkOut: null,
      workedHours: null,
      status,
      holidayName: status === ATTENDANCE_STATUS.HOLIDAY ? holidayNameByDate.get(dateStr) : null,
    };
  });
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

export async function getMonthSummary(
  employeeId: string,
  year: number,
  month: number
): Promise<MonthSummary> {
  const days = await getMonthDayStatuses(employeeId, year, month);

  const summary: MonthSummary = {
    onTime: 0,
    late: 0,
    halfDay: 0,
    absent: 0,
    onLeave: 0,
    holiday: 0,
    weekend: 0,
    missedCheckout: 0,
    totalWorkedHours: 0,
  };

  for (const day of days) {
    if (day.workedHours) summary.totalWorkedHours += day.workedHours;
    switch (day.status) {
      case ATTENDANCE_STATUS.ON_TIME:
        summary.onTime += 1;
        break;
      case ATTENDANCE_STATUS.LATE:
        summary.late += 1;
        break;
      case ATTENDANCE_STATUS.HALF_DAY:
        summary.halfDay += 1;
        break;
      case ATTENDANCE_STATUS.ABSENT:
        summary.absent += 1;
        break;
      case ATTENDANCE_STATUS.ON_LEAVE:
        summary.onLeave += 1;
        break;
      case ATTENDANCE_STATUS.HOLIDAY:
        summary.holiday += 1;
        break;
      case ATTENDANCE_STATUS.WEEKEND:
        summary.weekend += 1;
        break;
      case ATTENDANCE_STATUS.MISSED_CHECKOUT:
        summary.missedCheckout += 1;
        break;
      default:
        break;
    }
  }

  summary.totalWorkedHours = Math.round(summary.totalWorkedHours * 100) / 100;
  return summary;
}

export async function exportMonthDayStatusesCsv(
  employeeId: string,
  year: number,
  month: number
): Promise<string> {
  const days = await getMonthDayStatuses(employeeId, year, month);

  const header = ["Date", "Check In", "Check Out", "Worked Hours", "Status"];
  const rows = days.map((d) => [
    d.date,
    d.checkIn ? d.checkIn.toISOString() : "",
    d.checkOut ? d.checkOut.toISOString() : "",
    d.workedHours?.toString() ?? "",
    d.status ?? "",
  ]);

  return exporters.csv(header, rows).content;
}

export function resolveViewableEmployeeId(
  actor: Actor,
  requestedEmployeeId: string | undefined
): Promise<string> {
  return resolveViewableEmployeeIdShared(
    actor,
    requestedEmployeeId,
    "You can only view your own attendance"
  );
}

interface AttendanceFilterQuery {
  date?: string;
  month?: number;
  year?: number;
  department?: string;
  designation?: string;
  employeeId?: string;
  status?: AttendanceStatus;
}

interface AdminListQuery extends AttendanceFilterQuery {
  page: number;
  limit: number;
}

export interface AdminAttendanceRow {
  id: string;
  employee: { id: string; employeeId: string; fullName: string };
  department: string | null;
  designation: string | null;
  date: string;
  checkIn: Date | null;
  checkOut: Date | null;
  workedHours: number | null;
  status: AttendanceStatus;
}

async function buildAdminFilter(query: AttendanceFilterQuery) {
  const filter: Record<string, unknown> = {};

  if (query.date) {
    filter.date = query.date;
  } else {
    const year = query.year ?? new Date().getFullYear();
    const month = query.month ?? new Date().getMonth() + 1;
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    filter.date = { $gte: start, $lte: end };
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

  if (query.status && query.status !== ATTENDANCE_STATUS.MISSED_CHECKOUT) {
    filter.status = query.status;
  }

  return filter;
}

export async function adminListAttendance(query: AdminListQuery) {
  const filter = await buildAdminFilter(query);
  const todayStr = getISTDateString(new Date());
  const skip = (query.page - 1) * query.limit;

  const mongoQuery = AttendanceModel.find(filter)
    .populate({
      path: "employee",
      select: "employeeId fullName department designation",
      populate: [
        { path: "department", select: "name" },
        { path: "designation", select: "name" },
      ],
    })
    .sort({ date: -1 })
    .skip(skip)
    .limit(query.limit);

  const [records, total] = await Promise.all([
    mongoQuery,
    AttendanceModel.countDocuments(filter),
  ]);

  let rows: AdminAttendanceRow[] = records.map((r) => {
    const emp = r.employee as unknown as PopulatedAttendanceEmployee;
    const publicRecord = toPublicRecord(r, todayStr);
    return {
      id: publicRecord.id,
      employee: { id: String(emp._id), employeeId: emp.employeeId, fullName: emp.fullName },
      department: emp.department?.name ?? null,
      designation: emp.designation?.name ?? null,
      date: publicRecord.date,
      checkIn: publicRecord.checkIn,
      checkOut: publicRecord.checkOut,
      workedHours: publicRecord.workedHours,
      status: publicRecord.status as AttendanceStatus,
    };
  });

  if (query.status === ATTENDANCE_STATUS.MISSED_CHECKOUT) {
    rows = rows.filter((r) => r.status === ATTENDANCE_STATUS.MISSED_CHECKOUT);
  }

  return {
    records: rows,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export interface NotCheckedInEmployee {
  id: string;
  employeeId: string;
  fullName: string;
  department: string | null;
  designation: string | null;
}

export async function getNotCheckedInToday(date?: string): Promise<NotCheckedInEmployee[]> {
  const dateStr = date ?? getISTDateString(new Date());

  const [employees, checkedInEmployeeIds] = await Promise.all([
    UserModel.find({ status: { $in: LOGIN_ALLOWED_STATUSES } })
      .select("employeeId fullName department designation")
      .populate([
        { path: "department", select: "name" },
        { path: "designation", select: "name" },
      ]),
    AttendanceModel.find({ date: dateStr, checkIn: { $ne: null } }).distinct("employee"),
  ]);

  const checkedInSet = new Set(checkedInEmployeeIds.map((id) => String(id)));

  return employees
    .filter((e) => !checkedInSet.has(String(e._id)))
    .map((e) => {
      const emp = e as unknown as PopulatedAttendanceEmployee;
      return {
        id: String(emp._id),
        employeeId: emp.employeeId,
        fullName: emp.fullName,
        department: emp.department?.name ?? null,
        designation: emp.designation?.name ?? null,
      };
    });
}

export async function exportAttendanceCsv(
  query: AttendanceFilterQuery
): Promise<string> {
  const filter = await buildAdminFilter(query);
  const todayStr = getISTDateString(new Date());

  const records = await AttendanceModel.find(filter)
    .populate({
      path: "employee",
      select: "employeeId fullName department designation",
      populate: [
        { path: "department", select: "name" },
        { path: "designation", select: "name" },
      ],
    })
    .sort({ date: -1 });

  const header = [
    "Employee ID",
    "Full Name",
    "Department",
    "Designation",
    "Date",
    "Check In",
    "Check Out",
    "Worked Hours",
    "Status",
  ];

  const rows = records.map((r) => {
    const emp = r.employee as unknown as PopulatedAttendanceEmployee;
    const publicRecord = toPublicRecord(r, todayStr);
    return [
      emp.employeeId,
      emp.fullName,
      emp.department?.name ?? "",
      emp.designation?.name ?? "",
      publicRecord.date,
      publicRecord.checkIn ? publicRecord.checkIn.toISOString() : "",
      publicRecord.checkOut ? publicRecord.checkOut.toISOString() : "",
      publicRecord.workedHours?.toString() ?? "",
      publicRecord.status ?? "",
    ];
  });

  return exporters.csv(header, rows).content;
}
