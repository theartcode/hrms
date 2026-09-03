import { createApp } from "./app";
import { env } from "./shared/config/env";
import { logger } from "./shared/utils/logger";
import { connectDB } from "./shared/db/connectDB";
import { loadConfigCache } from "./modules/configuration/configuration.cache";
import { loadDepartmentHeadsCache } from "./modules/department/department.cache";
import { startScheduledJobs } from "./jobs/scheduler";
import { runProbationEndingCheck } from "./jobs/probation-ending.job";
import { runDailyTimesheetReminderCheck } from "./jobs/daily-timesheet-reminder.job";
import { runWorkScheduleReminderCheck } from "./jobs/work-schedule-reminder.job";

async function bootstrap(): Promise<void> {
  await connectDB();
  await loadConfigCache();
  await loadDepartmentHeadsCache();

  const app = createApp();

  app.listen(env.port, () => {
    logger.info(`HRMS API listening on port ${env.port} [${env.nodeEnv}]`);
  });

  startScheduledJobs();
  // Also run once immediately on boot — catches anything missed while the
  // server was down, and makes the job testable without waiting for the
  // next scheduled tick.
  runProbationEndingCheck().catch((err) => {
    logger.error({ err }, "Startup probation-ending check failed");
  });
  runDailyTimesheetReminderCheck().catch((err) => {
    logger.error({ err }, "Startup daily timesheet reminder check failed");
  });
  runWorkScheduleReminderCheck().catch((err) => {
    logger.error({ err }, "Startup work schedule reminder check failed");
  });
}

bootstrap();
