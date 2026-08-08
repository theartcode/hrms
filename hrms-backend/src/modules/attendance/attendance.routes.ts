import { Router } from "express";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import { ROLES } from "../../shared/constants/roles";
import {
  adminListQuerySchema,
  exportQuerySchema,
  monthQuerySchema,
  notCheckedInQuerySchema,
} from "./attendance.validation";
import * as attendanceController from "./attendance.controller";

const router = Router();
const manage = authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN);

router.use(authenticate);

router.post("/check-in", attendanceController.doCheckIn);
router.post("/check-out", attendanceController.doCheckOut);
router.get("/today", attendanceController.today);

router.get("/history", validate(monthQuerySchema), attendanceController.history);
router.get(
  "/history/export",
  validate(monthQuerySchema),
  attendanceController.exportHistory
);
router.get("/calendar", validate(monthQuerySchema), attendanceController.calendar);
router.get("/summary", validate(monthQuerySchema), attendanceController.summary);

router.get(
  "/admin",
  manage,
  validate(adminListQuerySchema),
  attendanceController.adminList
);
router.get(
  "/admin/export",
  manage,
  validate(exportQuerySchema),
  attendanceController.adminExport
);
router.get(
  "/admin/not-checked-in",
  manage,
  validate(notCheckedInQuerySchema),
  attendanceController.notCheckedIn
);

export default router;
