import { Router } from "express";
import { validate } from "../../shared/middleware/validate";
import { itAccess, itManage } from "./it-access";
import {
  myTimesheetHistorySchema,
  saveTodayTimesheetSchema,
  teamTimesheetSchema,
  timesheetIdParamSchema,
} from "./daily-timesheet.validation";
import * as timesheetController from "./daily-timesheet.controller";

const router = Router();

// authenticate is applied once by the parent it-work-management.routes.ts
// router, same as every other sub-router mounted there. Self-service
// routes use itAccess (any tier with IT access — manage or team — may
// maintain their own daily entry); /team is itManage-only. Literal paths
// are registered before /:id, same ordering rule as it-work-item.routes.ts
// and task.routes.ts.
router.get("/me/today", itAccess, timesheetController.getToday);
router.put(
  "/me/today",
  itAccess,
  validate(saveTodayTimesheetSchema),
  timesheetController.saveToday
);
router.post("/me/today/submit", itAccess, timesheetController.submitToday);
router.get(
  "/me/history",
  itAccess,
  validate(myTimesheetHistorySchema),
  timesheetController.myHistory
);

router.get("/team", itManage, validate(teamTimesheetSchema), timesheetController.team);

router.get("/:id", itAccess, validate(timesheetIdParamSchema), timesheetController.getById);

export default router;
