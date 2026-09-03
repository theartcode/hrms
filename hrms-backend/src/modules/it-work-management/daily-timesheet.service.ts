import { ApiError } from "../../shared/errors/ApiError";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { recordActivity } from "../activity-log/activity-log.service";
import { toId } from "../../shared/utils/toId";
import { getISTDateString } from "../../shared/utils/istDate";
import { Role } from "../../shared/constants/roles";
import { UserModel } from "../user/user.model";
import { ITWorkItemModel } from "./it-work-item.model";
import { getItAccessTier, listActiveItTeamMemberIds } from "./it-access";
import {
  DAILY_TIMESHEET_STATUS,
  DailyTimesheetModel,
  IDailyTimesheet,
} from "./daily-timesheet.model";

interface Actor {
  id: string;
  role: Role;
  employeeId: string;
}

const LABEL = "Timesheet entry";

const WORK_ITEM_POPULATE = { path: "workItems", select: "workItemId title status" };
const EMPLOYEE_POPULATE = { path: "employee", select: "fullName employeeId" };

function toPublicTimesheet(entry: IDailyTimesheet) {
  return {
    id: toId(entry),
    employee: entry.employee,
    workDate: entry.workDate,
    description: entry.description,
    workItems: entry.workItems,
    status: entry.status,
    submittedAt: entry.submittedAt,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

// A team member may only ever log work items they can actually see (their
// own assignments, or items they're the named reviewer for) — manage tier
// (Admin/Super Admin/IT Head) has no such restriction, mirroring
// it-work-item.service.ts's own tier split.
async function assertWorkItemsVisibleToActor(actor: Actor, workItemIds: string[]): Promise<void> {
  if (workItemIds.length === 0) return;

  const uniqueIds = Array.from(new Set(workItemIds));
  const items = await ITWorkItemModel.find({ _id: { $in: uniqueIds } }).select(
    "assignedTo reviewer"
  );
  if (items.length !== uniqueIds.length) {
    throw new ApiError(404, "One or more selected work items were not found");
  }

  const tier = await getItAccessTier(actor);
  if (tier === "manage") return;

  const hasInvalid = items.some((item) => {
    const isAssignee = !!item.assignedTo && String(item.assignedTo) === actor.id;
    const isReviewer = !!item.reviewer && String(item.reviewer) === actor.id;
    return !isAssignee && !isReviewer;
  });
  if (hasInvalid) {
    throw new ApiError(422, "You can only log work items assigned or visible to you");
  }
}

export async function getTodayTimesheet(actor: Actor) {
  const workDate = getISTDateString();
  const entry = await DailyTimesheetModel.findOne({
    employee: actor.id,
    workDate,
  }).populate(WORK_ITEM_POPULATE);

  if (!entry) {
    return {
      id: null,
      employee: actor.id,
      workDate,
      description: "",
      workItems: [],
      status: "NOT_STARTED" as const,
      submittedAt: null,
    };
  }

  return toPublicTimesheet(entry);
}

interface SaveTodayInput {
  description: string;
  workItems: string[];
}

// Upsert of the DRAFT for today only — an already-SUBMITTED entry is
// locked (per the brief, submit is a one-way action for the day; there's
// no "unsubmit"). Re-running this after submission is a 409, not a silent
// no-op, so the UI can tell the user why their edit didn't take.
export async function saveTodayDraft(actor: Actor, input: SaveTodayInput) {
  await assertWorkItemsVisibleToActor(actor, input.workItems);

  const workDate = getISTDateString();
  const existing = await DailyTimesheetModel.findOne({ employee: actor.id, workDate });

  if (existing && existing.status === DAILY_TIMESHEET_STATUS.SUBMITTED) {
    throw new ApiError(409, "Today's timesheet has already been submitted and can no longer be edited");
  }

  const entry = await DailyTimesheetModel.findOneAndUpdate(
    { employee: actor.id, workDate },
    {
      $set: { description: input.description, workItems: input.workItems },
      $setOnInsert: { employee: actor.id, workDate, status: DAILY_TIMESHEET_STATUS.DRAFT },
    },
    { new: true, upsert: true }
  ).populate(WORK_ITEM_POPULATE);

  return toPublicTimesheet(entry!);
}

export async function submitTodayTimesheet(actor: Actor) {
  const workDate = getISTDateString();
  const existing = await DailyTimesheetModel.findOne({ employee: actor.id, workDate });

  if (!existing) {
    throw new ApiError(404, "Save today's entry before submitting it");
  }
  if (existing.status === DAILY_TIMESHEET_STATUS.SUBMITTED) {
    throw new ApiError(409, "Today's timesheet has already been submitted");
  }
  if (!existing.description.trim()) {
    throw new ApiError(422, "Add a description of today's work before submitting");
  }

  existing.status = DAILY_TIMESHEET_STATUS.SUBMITTED;
  existing.submittedAt = new Date();
  await existing.save();
  await existing.populate(WORK_ITEM_POPULATE);

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.DAILY_TIMESHEET_SUBMITTED,
    targetType: "DailyTimesheet",
    targetId: toId(existing),
    metadata: { workDate },
  });

  return toPublicTimesheet(existing);
}

interface MyHistoryQuery {
  page: number;
  limit: number;
  startDate?: string;
  endDate?: string;
}

export async function listMyTimesheetHistory(actor: Actor, query: MyHistoryQuery) {
  const filter: Record<string, unknown> = { employee: actor.id };
  if (query.startDate || query.endDate) {
    const range: Record<string, string> = {};
    if (query.startDate) range.$gte = query.startDate;
    if (query.endDate) range.$lte = query.endDate;
    filter.workDate = range;
  }

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    DailyTimesheetModel.find(filter)
      .populate(WORK_ITEM_POPULATE)
      .sort({ workDate: -1 })
      .skip(skip)
      .limit(query.limit),
    DailyTimesheetModel.countDocuments(filter),
  ]);

  return {
    entries: items.map(toPublicTimesheet),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

interface TeamQuery {
  date?: string;
  employee?: string;
  status?: "DRAFT" | "SUBMITTED" | "NOT_STARTED";
  page: number;
  limit: number;
}

// itManage-gated at the route — merges the IT team roster with whatever
// DailyTimesheet rows exist for the day, synthesizing NOT_STARTED for
// anyone with no row yet, so "who hasn't submitted" is visible without the
// caller having to diff two lists themselves.
export async function getTeamTimesheets(query: TeamQuery) {
  const workDate = query.date ?? getISTDateString();
  const teamIds = await listActiveItTeamMemberIds();
  const scopedIds = query.employee
    ? teamIds.filter((id) => id === query.employee)
    : teamIds;

  const entries = await DailyTimesheetModel.find({
    employee: { $in: scopedIds },
    workDate,
  })
    .populate(EMPLOYEE_POPULATE)
    .populate(WORK_ITEM_POPULATE);

  const byEmployeeId = new Map(entries.map((e) => [String(e.employee._id ?? e.employee), e]));

  const employeeDocs = await UserModel.find({ _id: { $in: scopedIds } })
    .select("fullName employeeId")
    .sort({ fullName: 1 });

  const merged = employeeDocs.map((employee) => {
    const entry = byEmployeeId.get(String(employee._id));
    if (entry) {
      return { ...toPublicTimesheet(entry), employee: { _id: employee._id, fullName: employee.fullName, employeeId: employee.employeeId } };
    }
    return {
      id: null,
      employee: { _id: employee._id, fullName: employee.fullName, employeeId: employee.employeeId },
      workDate,
      description: "",
      workItems: [],
      status: "NOT_STARTED" as const,
      submittedAt: null,
    };
  });

  const filtered = query.status ? merged.filter((m) => m.status === query.status) : merged;

  const total = filtered.length;
  const skip = (query.page - 1) * query.limit;
  const page = filtered.slice(skip, skip + query.limit);

  return {
    workDate,
    entries: page,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

// Detail view — owner or manage tier only, same visibility split as
// it-work-item.service.ts's getWorkItemForActor.
export async function getTimesheetById(actor: Actor, id: string) {
  const entry = await DailyTimesheetModel.findById(id)
    .populate(EMPLOYEE_POPULATE)
    .populate(WORK_ITEM_POPULATE);
  if (!entry) {
    throw new ApiError(404, `${LABEL} not found`);
  }

  const isOwner = String(entry.employee._id ?? entry.employee) === actor.id;
  if (!isOwner) {
    const tier = await getItAccessTier(actor);
    if (tier !== "manage") {
      throw new ApiError(403, "You do not have permission to view this timesheet entry");
    }
  }

  return toPublicTimesheet(entry);
}
