import { Router } from "express";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import { ROLES } from "../../shared/constants/roles";
import {
  adminListLeavesSchema,
  adjustBalanceSchema,
  applyLeaveSchema,
  balanceQuerySchema,
  confirmLeaveMigrationSchema,
  deleteImportBatchSchema,
  employeeIdParamSchema,
  grantExtraLeaveSchema,
  importLeaveHistorySchema,
  leaveIdParamSchema,
  listLeavesSchema,
  markDayAsLeaveSchema,
  reviewLeaveSchema,
  updateAllocationSchema,
} from "./leave.validation";
import * as leaveController from "./leave.controller";

const router = Router();
const manage = authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN);
const superAdminOnly = authorize(ROLES.SUPER_ADMIN);

router.use(authenticate);

router.post("/", validate(applyLeaveSchema), leaveController.apply);
router.get("/me", validate(listLeavesSchema), leaveController.mine);
router.get("/balance", validate(balanceQuerySchema), leaveController.balance);
router.patch(
  "/:id/cancel",
  validate(leaveIdParamSchema),
  leaveController.cancel
);

router.get("/", manage, validate(adminListLeavesSchema), leaveController.adminList);
router.post("/admin/mark-day", manage, validate(markDayAsLeaveSchema), leaveController.markDay);
router.post("/allocations", manage, validate(grantExtraLeaveSchema), leaveController.grantExtra);
router.get("/allocations", manage, leaveController.listAllocations);
router.patch(
  "/balance/:employeeId",
  manage,
  validate(adjustBalanceSchema),
  leaveController.adjustBalance
);
router.put(
  "/allocations/:id",
  manage,
  validate(updateAllocationSchema),
  leaveController.updateAllocation
);
router.delete(
  "/allocations/:id",
  manage,
  validate(leaveIdParamSchema),
  leaveController.deleteAllocation
);
router.patch(
  "/:id/approve",
  manage,
  validate(reviewLeaveSchema),
  leaveController.approve
);
router.patch(
  "/:id/reject",
  manage,
  validate(reviewLeaveSchema),
  leaveController.reject
);

// Leave Analysis & Migration — gates the allocation routes above (see the
// leaveMigrationStatus guard inside grantExtraLeave/updateLeaveAllocation/
// deleteLeaveAllocation in leave.service.ts), never the day-to-day
// apply/approve/reject/cancel routes above.
router.post(
  "/migrations/:employeeId/import",
  manage,
  validate(importLeaveHistorySchema),
  leaveController.importHistory
);
router.delete(
  "/migrations/:employeeId/import-batches/:batchId",
  manage,
  validate(deleteImportBatchSchema),
  leaveController.deleteImportBatch
);
router.get(
  "/migrations/:employeeId/analysis",
  manage,
  validate(employeeIdParamSchema),
  leaveController.migrationAnalysis
);
router.post(
  "/migrations/:employeeId/confirm",
  manage,
  validate(confirmLeaveMigrationSchema),
  leaveController.confirmMigration
);
router.post(
  "/migrations/:employeeId/reopen",
  superAdminOnly,
  validate(employeeIdParamSchema),
  leaveController.reopenMigration
);

export default router;
