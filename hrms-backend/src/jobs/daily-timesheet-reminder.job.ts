import { getISTDateString } from "../shared/utils/istDate";
import { logger } from "../shared/utils/logger";
import { NOTIFICATION_TYPES } from "../shared/constants/notificationTypes";
import { notifyUser } from "../modules/notifications/notifications.service";
import { NotificationModel } from "../modules/notifications/notification.model";
import { listActiveItTeamMemberIds } from "../modules/it-work-management/it-access";
import {
  DAILY_TIMESHEET_STATUS,
  DailyTimesheetModel,
} from "../modules/it-work-management/daily-timesheet.model";

// Runs daily (see jobs/scheduler.ts) and once at server boot as a
// catch-up, same pattern as probation-ending.job.ts. Dedup is via the
// Notification collection itself (has a DAILY_TIMESHEET_REMINDER already
// been created for this employee since today started, IST) rather than a
// field on DailyTimesheet — unlike probation's one-off-per-date event this
// fires every working day, so there's no single long-lived document to
// gate a nullable field against; a team member may not even have a
// DailyTimesheet row yet for today.
export async function runDailyTimesheetReminderCheck(): Promise<void> {
  const today = getISTDateString();
  const dayStart = new Date(`${today}T00:00:00+05:30`);

  const teamIds = await listActiveItTeamMemberIds();
  if (teamIds.length === 0) return;

  const [submitted, alreadyReminded] = await Promise.all([
    DailyTimesheetModel.find({
      employee: { $in: teamIds },
      workDate: today,
      status: DAILY_TIMESHEET_STATUS.SUBMITTED,
    }).select("employee"),
    NotificationModel.find({
      user: { $in: teamIds },
      type: NOTIFICATION_TYPES.DAILY_TIMESHEET_REMINDER,
      createdAt: { $gte: dayStart },
    }).select("user"),
  ]);

  const excluded = new Set<string>([
    ...submitted.map((s) => String(s.employee)),
    ...alreadyReminded.map((n) => String(n.user)),
  ]);

  const pending = teamIds.filter((id) => !excluded.has(id));
  if (pending.length === 0) return;

  logger.info(`Daily timesheet reminder: ${pending.length} employee(s) pending`);

  for (const employeeId of pending) {
    try {
      await notifyUser({
        user: employeeId,
        type: NOTIFICATION_TYPES.DAILY_TIMESHEET_REMINDER,
        title: "Daily timesheet reminder",
        message: "Don't forget to fill in and submit today's work log before you wrap up.",
        metadata: { workDate: today },
      });
    } catch (err) {
      // One employee's failure must never block the rest of the batch.
      logger.error({ err, employeeId }, "Failed to send daily timesheet reminder");
    }
  }
}
