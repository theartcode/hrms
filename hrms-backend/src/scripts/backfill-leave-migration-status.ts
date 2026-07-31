// One-time deploy-time script — NOT wired into app boot. Run once when
// this feature ships, so every employee who already existed before the
// Leave Analysis & Migration gate went live isn't suddenly blocked from
// routine "grant extra leave" admin actions the next morning.
//
// leaveMigrationConfirmedBy is deliberately left null here — that's what
// forever distinguishes this backfill from a real admin review. Any
// employee genuinely needing an audited migration later (e.g. Razorpay
// history surfaces for them after the fact) can be reset via
// POST /leaves/migrations/:employeeId/reopen (super-admin only) and taken
// through the real Analysis & Confirm flow.
import mongoose from "mongoose";
import { env } from "../shared/config/env";
import { logger } from "../shared/utils/logger";
import { UserModel } from "../modules/user/user.model";

async function backfillLeaveMigrationStatus(): Promise<void> {
  await mongoose.connect(env.mongoUri);

  const result = await UserModel.updateMany(
    { leaveMigrationStatus: { $exists: false } },
    {
      $set: {
        leaveMigrationStatus: "CONFIRMED",
        leaveMigrationConfirmedBy: null,
        leaveMigrationConfirmedAt: new Date(),
        leaveMigrationConfirmedReason:
          "Pre-existing employee at HRMS launch — backfilled, no individual review performed",
      },
    }
  );

  logger.info(`Backfilled leaveMigrationStatus for ${result.modifiedCount} employee(s)`);
  await mongoose.disconnect();
}

backfillLeaveMigrationStatus()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error({ err }, "Failed to backfill leave migration status");
    process.exit(1);
  });
