import { Router } from "express";
import { validate } from "../../shared/middleware/validate";
import { itAccess, itManage } from "./it-access";
import {
  addEmployeeScheduleEntrySchema,
  addMyScheduleEntrySchema,
  employeeIdParamSchema,
  employeeScheduleEntryIdParamSchema,
  scheduleEntryIdParamSchema,
  updateMyScheduleEntrySchema,
} from "./work-schedule.validation";
import * as scheduleController from "./work-schedule.controller";

const router = Router();

// authenticate is applied once by the parent it-work-management.routes.ts
// router. Self-service (/me/...) uses itAccess — any tier with IT access
// may plan their own next 5 working days. Team-wide and on-behalf-of
// routes (/team, /employee/:employeeId/...) are itManage-only; literal
// paths are registered before the params-based /employee/:employeeId/...
// routes, same ordering rule as it-work-item.routes.ts and task.routes.ts.
router.get("/me", itAccess, scheduleController.getMine);
router.post("/me", itAccess, validate(addMyScheduleEntrySchema), scheduleController.addMine);
router.patch(
  "/me/:id",
  itAccess,
  validate(updateMyScheduleEntrySchema),
  scheduleController.updateMine
);
router.delete(
  "/me/:id",
  itAccess,
  validate(scheduleEntryIdParamSchema),
  scheduleController.removeMine
);

router.get("/team", itManage, scheduleController.getTeam);

router.get(
  "/employee/:employeeId",
  itManage,
  validate(employeeIdParamSchema),
  scheduleController.getForEmployee
);
router.post(
  "/employee/:employeeId",
  itManage,
  validate(addEmployeeScheduleEntrySchema),
  scheduleController.addForEmployee
);
router.delete(
  "/employee/:employeeId/:id",
  itManage,
  validate(employeeScheduleEntryIdParamSchema),
  scheduleController.removeForEmployee
);

export default router;
