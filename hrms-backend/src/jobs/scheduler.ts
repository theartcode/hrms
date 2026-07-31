import cron from "node-cron";
import { logger } from "../shared/utils/logger";
import { runProbationEndingCheck } from "./probation-ending.job";

// This app's first scheduled job — no cron/scheduler infrastructure
// existed before this. Add future daily/periodic jobs here the same way:
// one cron.schedule() call, IST-pinned.
export function startScheduledJobs(): void {
  cron.schedule("0 9 * * *", () => {
    runProbationEndingCheck().catch((err) => {
      logger.error({ err }, "Scheduled probation-ending check failed");
    });
  }, { timezone: "Asia/Kolkata" });

  logger.info("Scheduled jobs started");
}
