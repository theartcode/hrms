import { IT_PROJECT_STATUS, ITProjectStatus } from "../../shared/constants/itProjectTypes";

// PLANNED    -> ACTIVE, CANCELLED
// ACTIVE     -> ON_HOLD, COMPLETED, CANCELLED
// ON_HOLD    -> ACTIVE, CANCELLED
// COMPLETED  -> (terminal)
// CANCELLED  -> (terminal)
const TRANSITIONS: Record<ITProjectStatus, ITProjectStatus[]> = {
  [IT_PROJECT_STATUS.PLANNED]: [IT_PROJECT_STATUS.ACTIVE, IT_PROJECT_STATUS.CANCELLED],
  [IT_PROJECT_STATUS.ACTIVE]: [
    IT_PROJECT_STATUS.ON_HOLD,
    IT_PROJECT_STATUS.COMPLETED,
    IT_PROJECT_STATUS.CANCELLED,
  ],
  [IT_PROJECT_STATUS.ON_HOLD]: [IT_PROJECT_STATUS.ACTIVE, IT_PROJECT_STATUS.CANCELLED],
  [IT_PROJECT_STATUS.COMPLETED]: [],
  [IT_PROJECT_STATUS.CANCELLED]: [],
};

export function isValidProjectStatusTransition(
  from: ITProjectStatus,
  to: ITProjectStatus
): boolean {
  return TRANSITIONS[from].includes(to);
}
