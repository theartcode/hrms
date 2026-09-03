import { NextFunction, Request, Response } from "express";
import { ApiError } from "../../shared/errors/ApiError";
import { ROLES, Role } from "../../shared/constants/roles";
import { LOGIN_ALLOWED_STATUSES } from "../../shared/constants/employeeStatus";
import { getDepartmentsHeadedBy } from "../department/department.cache";
import { DepartmentModel } from "../department/department.model";
import { UserModel } from "../user/user.model";
import { isItReadOnlyViewer } from "./it-work-management-settings.service";

// Phase 1A simplifying assumption (called out explicitly in the Phase 1A
// report): per the brief's own instruction to reuse Department.headEmployeeId
// rather than invent a new role, "the IT Head" is whoever heads a Department
// literally named "IT" (case-insensitive) — zero new schema, reuses the
// existing department-heads cache that auth.service.ts already populates on
// every login/refresh. If the department is ever named something else, this
// constant is the one place to change.
const IT_DEPARTMENT_NAME = "IT";

export function isItHead(employeeId: string): boolean {
  return getDepartmentsHeadedBy(employeeId).some(
    (dept) => dept.name.trim().toUpperCase() === IT_DEPARTMENT_NAME
  );
}

// The manage/write tier: Admin, Super Admin, or the IT Head. Used to gate
// every create/edit/assign/status-change route across Products, Projects,
// and Work Items — never broadened, including for the "readonly" tier
// below, which is exactly the point of that tier existing.
export function itManage(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new ApiError(401, "Authentication required"));
    return;
  }
  const { role, id } = req.user;
  if (role === ROLES.ADMIN || role === ROLES.SUPER_ADMIN || isItHead(id)) {
    next();
    return;
  }
  next(new ApiError(403, "You do not have permission to perform this action"));
}

// Phase 1C-A: Work Items need a broader view tier than Products/Projects
// (itManage above) — a plain IT team member must be able to see their own
// assigned work, not just Admin/Super Admin/IT Head. Per the Phase 1C-A
// brief's own instruction (no separate Team model): "a user is an IT team
// member if they belong to the IT department and are not its head."
export async function isItDepartmentMember(employeeId: string): Promise<boolean> {
  const itDepartment = await DepartmentModel.findOne({
    name: new RegExp(`^${IT_DEPARTMENT_NAME}$`, "i"),
  }).select("_id");
  if (!itDepartment) return false;
  const user = await UserModel.findById(employeeId).select("department");
  return !!user && !!user.department && String(user.department) === String(itDepartment._id);
}

export async function isItTeamMember(employeeId: string): Promise<boolean> {
  if (isItHead(employeeId)) return false;
  return isItDepartmentMember(employeeId);
}

// Daily Timesheet / Work Schedule: both features are scoped to exactly the
// "team" tier (active IT department members, excluding the head) — the
// same population isItTeamMember checks one id at a time, listed in bulk
// for the reminder jobs and the manager's team-wide views. Deliberately
// excludes the IT Head (matches isItTeamMember) and anyone outside
// LOGIN_ALLOWED_STATUSES (a deactivated/resigned employee has nothing to
// remind or display).
export async function listActiveItTeamMemberIds(): Promise<string[]> {
  const itDepartment = await DepartmentModel.findOne({
    name: new RegExp(`^${IT_DEPARTMENT_NAME}$`, "i"),
  }).select("_id headEmployeeId");
  if (!itDepartment) return [];

  const headId = itDepartment.headEmployeeId ? String(itDepartment.headEmployeeId) : null;
  const members = await UserModel.find({
    department: itDepartment._id,
    status: { $in: LOGIN_ALLOWED_STATUSES },
  }).select("_id");

  return members.map((m) => String(m._id)).filter((id) => id !== headId);
}

// Phase 1C-C adds "readonly" — the CEO tier. Deliberately a fourth,
// distinct value rather than folding it into "team": a readonly viewer
// needs Work Item visibility as broad as "manage" (everything, not just
// their own) while having zero write power at all — see
// it-work-item.service.ts, where only "team" gets row-level scoping and
// every write check only ever admits "manage".
export type ItAccessTier = "manage" | "team" | "readonly" | "none";

export async function getItAccessTier(actor: { id: string; role: Role }): Promise<ItAccessTier> {
  if (actor.role === ROLES.ADMIN || actor.role === ROLES.SUPER_ADMIN || isItHead(actor.id)) {
    return "manage";
  }
  if (await isItDepartmentMember(actor.id)) {
    return "team";
  }
  if (await isItReadOnlyViewer(actor.id)) {
    return "readonly";
  }
  return "none";
}

// Broader than itManage — lets IT team members AND readonly viewers (CEO)
// reach GET routes. This only decides whether the actor gets in the door;
// row-level scoping happens in each resource's service layer — Products/
// Projects show everything to any tier that gets past this gate (no
// scoping needed, per Phase 1C-C), while Work Items still scope "team" to
// their own assigned/reviewed items only ("readonly" sees everything, same
// breadth as "manage", just with no write route ever admitting it).
export async function itAccess(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next(new ApiError(401, "Authentication required"));
    return;
  }
  const tier = await getItAccessTier(req.user);
  if (tier === "none") {
    next(new ApiError(403, "You do not have permission to perform this action"));
    return;
  }
  next();
}

// Phase 1E-B: the Team Member Dashboard is deliberately narrower than
// itAccess — exactly the "team" tier. Manage tier already has its own
// dashboard (Phase 1E-A) and must not silently inherit this one; readonly's
// dashboard is a later phase (1E-C) and must not receive this one either
// (see the Phase 1E-B report's access matrix).
export async function itTeamOnly(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next(new ApiError(401, "Authentication required"));
    return;
  }
  const tier = await getItAccessTier(req.user);
  if (tier !== "team") {
    next(new ApiError(403, "You do not have permission to perform this action"));
    return;
  }
  next();
}

// Phase 1E-C: the CEO / Executive Dashboard is exactly the "readonly" tier
// — never manage (already has its own dashboard) and never team (has its
// own). Mirrors itTeamOnly's shape exactly for the same reason: the
// dashboard's own route gate, not just frontend routing, decides who gets
// this data (see the Phase 1E-C report's access matrix).
export async function itReadOnlyOnly(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    next(new ApiError(401, "Authentication required"));
    return;
  }
  const tier = await getItAccessTier(req.user);
  if (tier !== "readonly") {
    next(new ApiError(403, "You do not have permission to perform this action"));
    return;
  }
  next();
}
