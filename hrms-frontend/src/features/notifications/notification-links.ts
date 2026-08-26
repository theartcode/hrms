import { ROUTES } from "@/constants/routes";
import { Notification } from "@/types/notification.types";

function str(metadata: Record<string, unknown> | null, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

// The one place that knows how a notification type maps to a page — every
// notification-rendering surface (bell dropdown, dashboard widget, future
// toasts) calls this instead of embedding its own routing logic. Returns
// null for types with no sensible destination (e.g. SYSTEM), which callers
// use to skip the click affordance entirely rather than navigate nowhere.
export function getNotificationUrl(notification: Notification): string | null {
  const { type, metadata } = notification;

  switch (type) {
    case "LEAVE_APPLIED":
    case "LEAVE_APPROVED":
    case "LEAVE_REJECTED": {
      const leaveId = str(metadata, "leaveId");
      return leaveId ? `${ROUTES.LEAVE_ADMIN}?requestId=${leaveId}` : ROUTES.LEAVE_ADMIN;
    }

    case "ATTENDANCE_CORRECTION_REQUESTED":
    case "ATTENDANCE_CORRECTION_APPROVED":
    case "ATTENDANCE_CORRECTION_REJECTED": {
      const correctionId = str(metadata, "correctionId");
      return correctionId
        ? `${ROUTES.ATTENDANCE_TEAM}?correctionId=${correctionId}`
        : ROUTES.ATTENDANCE_TEAM;
    }

    case "DOCUMENT_UPLOADED":
    case "DOCUMENT_APPROVED":
    case "DOCUMENT_REJECTED": {
      const employeeId = str(metadata, "employeeId");
      return employeeId ? `${ROUTES.EMPLOYEE_DETAIL(employeeId)}?tab=documents` : null;
    }

    case "EMPLOYEE_CREATED":
    case "EMPLOYEE_UPDATED":
    case "PROBATION_ENDING":
    case "PAYMENT_INFO_SUBMITTED": {
      const employeeId = str(metadata, "employeeId");
      return employeeId ? ROUTES.EMPLOYEE_DETAIL(employeeId) : null;
    }

    // Sent directly to the affected employee with no employeeId in the
    // metadata — the destination is always "your own profile," never
    // something built from the payload.
    case "PAYMENT_INFO_APPROVED":
    case "PAYMENT_INFO_REJECTED":
      return ROUTES.PROFILE;

    // The employee record is already gone by the time this fires, and its
    // metadata only carries the (now meaningless) human-readable employee
    // code, not a linkable id.
    case "EMPLOYEE_DELETED":
      return ROUTES.EMPLOYEES;

    case "ANNOUNCEMENT_PUBLISHED": {
      const announcementId = str(metadata, "announcementId");
      return announcementId ? ROUTES.ANNOUNCEMENT_DETAIL(announcementId) : ROUTES.ANNOUNCEMENTS;
    }

    case "TASK_ASSIGNED":
    case "TASK_REASSIGNED": {
      const taskId = str(metadata, "taskId");
      return taskId ? `${ROUTES.TASKS}?taskId=${taskId}` : ROUTES.TASKS;
    }

    case "TASK_SUBMITTED_FOR_REVIEW": {
      const taskId = str(metadata, "taskId");
      return taskId ? `${ROUTES.TASKS_ADMIN}?taskId=${taskId}` : ROUTES.TASKS_ADMIN;
    }

    case "IT_WORK_ITEM_ASSIGNED":
    case "IT_WORK_ITEM_REASSIGNED":
    case "IT_WORK_ITEM_SUBMITTED_FOR_REVIEW":
    case "IT_WORK_ITEM_CHANGES_REQUESTED":
    case "IT_WORK_ITEM_REVIEW_APPROVED":
    case "IT_WORK_ITEM_BLOCKED":
    case "IT_WORK_ITEM_UNBLOCKED":
    case "IT_WORK_ITEM_COMMENTED":
    case "IT_WORK_ITEM_PROPOSED":
    case "IT_WORK_ITEM_PROPOSAL_APPROVED":
    case "IT_WORK_ITEM_PROPOSAL_REJECTED":
    case "IT_WORK_ITEM_PROPOSAL_CHANGES_REQUESTED": {
      const workItemId = str(metadata, "workItemId");
      return workItemId ? ROUTES.IT_WORK_MANAGEMENT_WORK_ITEM_DETAIL(workItemId) : null;
    }

    case "HOLIDAY_ADDED":
      return ROUTES.ADMINISTRATION_HOLIDAYS;

    // No metadata, or no destination that means anything ("check your
    // email," a completed report export with nothing to browse to) — stays
    // non-clickable, same as before this feature existed.
    case "REVIEW_PUBLISHED":
    case "BIRTHDAY":
    case "WORK_ANNIVERSARY":
    case "SYSTEM":
    case "PASSWORD_RESET":
    case "PASSWORD_CHANGED":
    default:
      return null;
  }
}
