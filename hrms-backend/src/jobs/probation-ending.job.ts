import mongoose from "mongoose";
import { env } from "../shared/config/env";
import { logger } from "../shared/utils/logger";
import { toId } from "../shared/utils/toId";
import { getISTDateString } from "../shared/utils/istDate";
import { EMPLOYEE_STATUS } from "../shared/constants/employeeStatus";
import { EMPLOYMENT_TYPE } from "../shared/constants/employmentType";
import { ACTIVITY_ACTIONS } from "../shared/constants/activityActions";
import { NOTIFICATION_TYPES } from "../shared/constants/notificationTypes";
import { recordActivity } from "../modules/activity-log/activity-log.service";
import { notifyAdmins } from "../modules/notifications/notifications.service";
import { UserModel } from "../modules/user/user.model";

// Runs once at server boot (catches anything missed while the server was
// down) and once daily on a schedule (see jobs/scheduler.ts). Every
// Probation employee whose probationEndDate has passed and who hasn't
// already been notified for that date gets one admin notification + email
// — never a repeat for the same date (probationEndNotifiedAt gates that;
// employee.service.ts's updateEmployee resets it to null whenever the date
// itself is edited, so a newly-set date always gets its own notification).
export async function runProbationEndingCheck(): Promise<void> {
  const today = getISTDateString();

  const overdue = await UserModel.find({
    employmentType: EMPLOYMENT_TYPE.PROBATION,
    probationEndDate: { $ne: null, $lte: new Date(`${today}T23:59:59+05:30`) },
    probationEndNotifiedAt: null,
    status: { $in: [EMPLOYEE_STATUS.ACTIVE, EMPLOYEE_STATUS.NOTICE_PERIOD] },
  });

  if (overdue.length === 0) return;

  logger.info(`Probation ending check: ${overdue.length} employee(s) overdue`);

  for (const employee of overdue) {
    try {
      const endDateStr = employee.probationEndDate
        ? getISTDateString(employee.probationEndDate)
        : "—";

      // System-triggered, not tied to any acting admin — a throwaway id
      // that matches nobody means notifyAdmins excludes no one.
      const systemActorId = new mongoose.Types.ObjectId().toString();

      await notifyAdmins(systemActorId, {
        type: NOTIFICATION_TYPES.PROBATION_ENDING,
        title: "Probation period ended",
        message: `${employee.fullName} (${employee.employeeId})'s probation ended on ${endDateStr} — mark them Permanent or extend their probation.`,
        metadata: { employeeId: toId(employee) },
        email: {
          template: "probation-ending",
          data: {
            employeeName: employee.fullName,
            employeeIdLabel: employee.employeeId,
            probationEndDate: endDateStr,
            profileUrl: `${env.clientOrigin}/employees/${toId(employee)}`,
          },
        },
      });

      employee.probationEndNotifiedAt = new Date();
      await employee.save();

      await recordActivity({
        actor: { id: systemActorId, employeeId: "SYSTEM" },
        action: ACTIVITY_ACTIONS.PROBATION_ENDING_DETECTED,
        targetType: "User",
        targetId: toId(employee),
        metadata: { probationEndDate: endDateStr },
      });
    } catch (err) {
      // One employee's failure must never block the rest of the batch.
      logger.error({ err, employeeId: toId(employee) }, "Failed to process probation-ending check");
    }
  }
}
