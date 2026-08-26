import { Router } from "express";
import { z } from "zod";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import { ROLES } from "../../shared/constants/roles";
import * as controller from "./it-work-management-settings.controller";

const router = Router();

// Deliberately Admin/Super Admin only — NOT itManage (which would also
// admit an IT Head). Deciding who counts as a read-only executive viewer
// of IT operations is a company-wide administrative call, not something
// scoped to the IT department itself; see the Phase 1C-C report. This also
// keeps the employee picker this pairs with on the frontend (GET
// /employees, itself Admin/Super Admin-only) correctly matched in scope.
const adminOnly = authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN);

const userIdParamSchema = z.object({
  params: z.object({ userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id") }),
});

router.get("/readonly-viewers", adminOnly, controller.list);
router.post(
  "/readonly-viewers/:userId",
  adminOnly,
  validate(userIdParamSchema),
  controller.grant
);
router.delete(
  "/readonly-viewers/:userId",
  adminOnly,
  validate(userIdParamSchema),
  controller.revoke
);

export default router;
