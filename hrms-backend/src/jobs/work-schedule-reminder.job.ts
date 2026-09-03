import { getISTDateString } from "../shared/utils/istDate";
import { logger } from "../shared/utils/logger";
import { NOTIFICATION_TYPES } from "../shared/constants/notificationTypes";
import { notifyUser } from "../modules/notifications/notifications.service";
import { NotificationModel } from "../modules/notifications/notification.model";
import { listActiveItTeamMemberIds } from "../modules/it-work-management/it-access";

// A duplicate at most once every few days is a low-stakes outcome for a
// weekly nudge like this, so dedup uses a simple rolling window rather
// than computing an exact ISO week boundary.
const DEDUP_WINDOW_DAYS = 4;

// Runs weekly (see jobs/scheduler.ts) and once at server boot as a
// catch-up, same pattern as probation-ending.job.ts and the daily
// timesheet reminder. Dedup is via the Notification collection (has a
// WORK_SCHEDULE_REMINDER already gone out to this employee within the
// window) rather than a field on any schedule document — a team member
// with zero WorkSchedule entries for the coming week still needs the
// reminder, so there's no document to gate a field on in that case.
export async function runWorkScheduleReminderCheck(): Promise<void> {
  const teamIds = await listActiveItTeamMemberIds();
  if (teamIds.length === 0) return;

  const windowStart = new Date(`${getISTDateString()}T00:00:00+05:30`);
  windowStart.setUTCDate(windowStart.getUTCDate() - DEDUP_WINDOW_DAYS);

  const alreadyReminded = await NotificationModel.find({
    user: { $in: teamIds },
    type: NOTIFICATION_TYPES.WORK_SCHEDULE_REMINDER,
    createdAt: { $gte: windowStart },
  }).select("user");
  const excluded = new Set(alreadyReminded.map((n) => String(n.user)));

  const pending = teamIds.filter((id) => !excluded.has(id));
  if (pending.length === 0) return;

  logger.info(`Work schedule reminder: ${pending.length} employee(s) pending`);

  for (const employeeId of pending) {
    try {
      await notifyUser({
        user: employeeId,
        type: NOTIFICATION_TYPES.WORK_SCHEDULE_REMINDER,
        title: "Plan your next 6 working days",
        message: "Update your work schedule with what you're planning to work on next.",
        metadata: {},
      });
    } catch (err) {
      logger.error({ err, employeeId }, "Failed to send work schedule reminder");
    }
  }
}
