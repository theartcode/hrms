import cron from "node-cron";
import { logger } from "../shared/utils/logger";
import { runProbationEndingCheck } from "./probation-ending.job";
import { runDailyTimesheetReminderCheck } from "./daily-timesheet-reminder.job";
import { runWorkScheduleReminderCheck } from "./work-schedule-reminder.job";

// This app's first scheduled job — no cron/scheduler infrastructure
// existed before this. Add future daily/periodic jobs here the same way:
// one cron.schedule() call, IST-pinned.
export function startScheduledJobs(): void {
  cron.schedule("0 9 * * *", () => {
    runProbationEndingCheck().catch((err) => {
      logger.error({ err }, "Scheduled probation-ending check failed");
    });
  }, { timezone: "Asia/Kolkata" });

  // Daily, end-of-day — gives the day's work a chance to actually happen
  // before nudging anyone who hasn't logged it yet.
  cron.schedule("30 17 * * *", () => {
    runDailyTimesheetReminderCheck().catch((err) => {
      logger.error({ err }, "Scheduled daily timesheet reminder failed");
    });
  }, { timezone: "Asia/Kolkata" });

  // Weekly, Saturday afternoon — the last working day of this company's
  // Mon-Sat week, so it prompts the team to plan next week's 5 working
  // days before their one day off (Sunday).
  cron.schedule("30 15 * * 6", () => {
    runWorkScheduleReminderCheck().catch((err) => {
      logger.error({ err }, "Scheduled work schedule reminder failed");
    });
  }, { timezone: "Asia/Kolkata" });

  logger.info("Scheduled jobs started");
}
