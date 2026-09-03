import { ApiError } from "../../shared/errors/ApiError";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { recordActivity } from "../activity-log/activity-log.service";
import { toId } from "../../shared/utils/toId";
import { getNextWorkingDays } from "../../shared/utils/workingDays";
import { Role } from "../../shared/constants/roles";
import { IT_WORK_ITEM_STATUS } from "../../shared/constants/itWorkItemTypes";
import { UserModel } from "../user/user.model";
import { ITWorkItemModel } from "./it-work-item.model";
import { getItAccessTier, listActiveItTeamMemberIds } from "./it-access";
import { IWorkSchedule, WorkScheduleModel } from "./work-schedule.model";

interface Actor {
  id: string;
  role: Role;
  employeeId: string;
}

// How many working days ahead the planning window covers — the one place
// this is defined, so widening it later is a one-line change. 6, not 5:
// this company's work week is Monday-Saturday, so the window covers a full
// week of working days.
const SCHEDULE_WINDOW_DAYS = 6;

const WORK_ITEM_POPULATE = { path: "workItem", select: "workItemId title status" };

function isDuplicateKeyError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: number }).code === 11000
  );
}

function toPublicEntry(entry: IWorkSchedule) {
  return {
    id: toId(entry),
    date: entry.date,
    workItem: entry.workItem,
    note: entry.note,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

// Self-management is always allowed; managing someone else's schedule
// requires manage tier (Admin/Super Admin/IT Head) — mirrors
// it-work-item.service.ts's own actor-vs-tier checks.
async function assertCanManageScheduleFor(actor: Actor, targetEmployeeId: string): Promise<void> {
  if (actor.id === targetEmployeeId) return;
  const tier = await getItAccessTier(actor);
  if (tier !== "manage") {
    throw new ApiError(403, "You do not have permission to manage this employee's schedule");
  }
}

async function assertValidWorkingDate(date: string): Promise<void> {
  const validDays = await getNextWorkingDays(SCHEDULE_WINDOW_DAYS);
  if (!validDays.includes(date)) {
    throw new ApiError(422, "Date must be one of the next 6 working days");
  }
}

// A Work Item may only be scheduled onto the day of the person it's
// actually assigned to — never an unrelated employee's calendar, and never
// once it's Cancelled (an active, explicit choice; there's no "unless
// explicitly permitted" override in this app today).
async function assertWorkItemSchedulable(workItemId: string, targetEmployeeId: string): Promise<void> {
  const workItem = await ITWorkItemModel.findById(workItemId).select("assignedTo status");
  if (!workItem) {
    throw new ApiError(404, "Work item not found");
  }
  if (workItem.status === IT_WORK_ITEM_STATUS.CANCELLED) {
    throw new ApiError(422, "A cancelled work item cannot be scheduled");
  }
  if (!workItem.assignedTo || String(workItem.assignedTo) !== targetEmployeeId) {
    throw new ApiError(422, "This work item is not assigned to this employee");
  }
}

export async function getEmployeeSchedule(targetEmployeeId: string) {
  const days = await getNextWorkingDays(SCHEDULE_WINDOW_DAYS);
  const entries = await WorkScheduleModel.find({
    employee: targetEmployeeId,
    date: { $in: days },
  })
    .populate(WORK_ITEM_POPULATE)
    .sort({ date: 1 });

  return { days, entries: entries.map(toPublicEntry) };
}

// itManage-gated at the route — the whole IT team's next 6 working days in
// one grid. Every active team member appears even with zero entries, so an
// unplanned employee is visible as an empty row rather than absent.
export async function getTeamSchedule() {
  const days = await getNextWorkingDays(SCHEDULE_WINDOW_DAYS);
  const teamIds = await listActiveItTeamMemberIds();

  const [entries, employees] = await Promise.all([
    WorkScheduleModel.find({ employee: { $in: teamIds }, date: { $in: days } })
      .populate(WORK_ITEM_POPULATE)
      .sort({ date: 1 }),
    UserModel.find({ _id: { $in: teamIds } }).select("fullName employeeId").sort({ fullName: 1 }),
  ]);

  const entriesByEmployee = new Map<string, IWorkSchedule[]>();
  for (const entry of entries) {
    const key = String(entry.employee);
    const bucket = entriesByEmployee.get(key) ?? [];
    bucket.push(entry);
    entriesByEmployee.set(key, bucket);
  }

  const team = employees.map((employee) => ({
    employee: {
      _id: employee._id,
      fullName: employee.fullName,
      employeeId: employee.employeeId,
    },
    entries: (entriesByEmployee.get(String(employee._id)) ?? []).map(toPublicEntry),
  }));

  return { days, team };
}

interface AddScheduleEntryInput {
  date: string;
  workItem: string;
  note?: string;
}

export async function addScheduleEntry(
  actor: Actor,
  targetEmployeeId: string,
  input: AddScheduleEntryInput
) {
  await assertCanManageScheduleFor(actor, targetEmployeeId);
  await assertValidWorkingDate(input.date);
  await assertWorkItemSchedulable(input.workItem, targetEmployeeId);

  let entry: IWorkSchedule;
  try {
    entry = await WorkScheduleModel.create({
      employee: targetEmployeeId,
      date: input.date,
      workItem: input.workItem,
      note: input.note ?? null,
      createdBy: actor.id,
      updatedBy: actor.id,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new ApiError(409, "This work item is already scheduled for this day");
    }
    throw err;
  }
  await entry.populate(WORK_ITEM_POPULATE);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.WORK_SCHEDULE_ENTRY_ADDED,
    targetType: "WorkSchedule",
    targetId: toId(entry),
    metadata: { employee: targetEmployeeId, date: input.date, workItem: input.workItem },
  });

  return toPublicEntry(entry);
}

// Note editing is self-service only, per the brief (the Employee section
// lists it; the Manager section's own scope is add/remove only) — a
// manage-tier actor rearranging someone else's schedule adds/removes
// entries but does not rewrite their personal note text.
export async function updateMyScheduleEntryNote(actor: Actor, id: string, note: string) {
  const entry = await WorkScheduleModel.findOne({ _id: id, employee: actor.id });
  if (!entry) {
    throw new ApiError(404, "Schedule entry not found");
  }

  entry.note = note || null;
  entry.updatedBy = actor.id as never;
  await entry.save();
  await entry.populate(WORK_ITEM_POPULATE);

  return toPublicEntry(entry);
}

export async function removeScheduleEntry(
  actor: Actor,
  targetEmployeeId: string,
  id: string
): Promise<void> {
  await assertCanManageScheduleFor(actor, targetEmployeeId);

  const entry = await WorkScheduleModel.findOne({ _id: id, employee: targetEmployeeId });
  if (!entry) {
    throw new ApiError(404, "Schedule entry not found");
  }

  const metadata = { employee: targetEmployeeId, date: entry.date, workItem: String(entry.workItem) };
  await entry.deleteOne();

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.WORK_SCHEDULE_ENTRY_REMOVED,
    targetType: "WorkSchedule",
    targetId: id,
    metadata,
  });
}
