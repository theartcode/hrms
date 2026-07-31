import {
  createReferenceData,
  listReferenceData,
  setReferenceDataActive,
  updateReferenceData,
} from "../../shared/services/referenceData.service";
import { ACTIVITY_ACTIONS } from "../../shared/constants/activityActions";
import { recordActivity } from "../activity-log/activity-log.service";
import { toId } from "../../shared/utils/toId";
import { LocationModel, ILocation } from "./location.model";

const LABEL = "Location";

export function listLocations(includeInactive: boolean): Promise<ILocation[]> {
  return listReferenceData(LocationModel, includeInactive);
}

export async function createLocation(
  actor: { id: string; employeeId: string },
  name: string
): Promise<ILocation> {
  const location = await createReferenceData(LocationModel, name, LABEL);
  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.LOCATION_CREATED,
    targetType: "Location",
    targetId: toId(location),
    metadata: { name },
  });
  return location;
}

export async function updateLocation(
  actor: { id: string; employeeId: string },
  id: string,
  name: string
): Promise<ILocation> {
  const location = await updateReferenceData(LocationModel, id, name, LABEL);
  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.LOCATION_UPDATED,
    targetType: "Location",
    targetId: toId(location),
    metadata: { name },
  });
  return location;
}

export async function setLocationActive(
  actor: { id: string; employeeId: string },
  id: string,
  isActive: boolean
): Promise<ILocation> {
  const location = await setReferenceDataActive(LocationModel, id, isActive, LABEL);
  await recordActivity({
    actor,
    action: ACTIVITY_ACTIONS.LOCATION_UPDATED,
    targetType: "Location",
    targetId: toId(location),
    metadata: { isActive },
  });
  return location;
}
