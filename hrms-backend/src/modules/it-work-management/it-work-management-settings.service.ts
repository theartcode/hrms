import { ApiError } from "../../shared/errors/ApiError";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { recordActivity } from "../activity-log/activity-log.service";
import { toId } from "../../shared/utils/toId";
import { UserModel } from "../user/user.model";
import { ITWorkManagementSettingsModel, IITWorkManagementSettings } from "./it-work-management-settings.model";

interface Actor {
  id: string;
  employeeId: string;
}

async function getOrCreateSettings(): Promise<IITWorkManagementSettings> {
  let settings = await ITWorkManagementSettingsModel.findOne({ key: "singleton" });
  if (!settings) {
    settings = await ITWorkManagementSettingsModel.create({
      key: "singleton",
      readOnlyViewerIds: [],
    });
  }
  return settings;
}

export async function listReadOnlyViewers() {
  const settings = await getOrCreateSettings();
  const users = await UserModel.find({ _id: { $in: settings.readOnlyViewerIds } })
    .select("fullName employeeId")
    .sort({ fullName: 1 });
  return users.map((u) => ({ id: toId(u), fullName: u.fullName, employeeId: u.employeeId }));
}

// Direct query, deliberately not cached like department.cache.ts — this is
// checked on IT Work Management view requests only, not on every
// authenticated request the way the department-heads cache is, and the
// list itself is expected to stay tiny. The added complexity of a boot-
// time-loaded cache (plus a server.ts change to load it) isn't justified
// at this scale; see the Phase 1C-C report.
export async function isItReadOnlyViewer(userId: string): Promise<boolean> {
  const settings = await ITWorkManagementSettingsModel.findOne({ key: "singleton" }).select(
    "readOnlyViewerIds"
  );
  if (!settings) return false;
  return settings.readOnlyViewerIds.some((id) => String(id) === userId);
}

export async function grantReadOnlyAccess(actor: Actor, userId: string) {
  const target = await UserModel.findById(userId).select("fullName employeeId");
  if (!target) {
    throw new ApiError(404, "User not found");
  }

  const settings = await getOrCreateSettings();
  if (!settings.readOnlyViewerIds.some((id) => String(id) === userId)) {
    settings.readOnlyViewerIds.push(target._id);
    await settings.save();
  }

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_READONLY_ACCESS_GRANTED,
    targetType: "ITWorkManagementSettings",
    targetId: toId(settings),
    metadata: { name: target.fullName, targetEmployeeId: target.employeeId },
  });

  return listReadOnlyViewers();
}

export async function revokeReadOnlyAccess(actor: Actor, userId: string) {
  const target = await UserModel.findById(userId).select("fullName employeeId");
  const settings = await getOrCreateSettings();
  settings.readOnlyViewerIds = settings.readOnlyViewerIds.filter(
    (id) => String(id) !== userId
  ) as IITWorkManagementSettings["readOnlyViewerIds"];
  await settings.save();

  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.IT_READONLY_ACCESS_REVOKED,
    targetType: "ITWorkManagementSettings",
    targetId: toId(settings),
    metadata: { name: target?.fullName ?? null, targetEmployeeId: target?.employeeId ?? userId },
  });

  return listReadOnlyViewers();
}
