import { Router } from "express";
import { validate } from "../../shared/middleware/validate";
import { itAccess, itManage } from "./it-access";
import {
  createItProductSchema,
  listItProductsSchema,
  setItProductActiveSchema,
  updateItProductSchema,
} from "./it-product.validation";
import * as itProductController from "./it-product.controller";

const router = Router();

// authenticate is applied once by the parent it-work-management.routes.ts
// router. Phase 1C-C: reads use itAccess (manage/team/readonly can all
// view Products) — writes stay itManage-only.
router.get("/", itAccess, validate(listItProductsSchema), itProductController.list);
router.post("/", itManage, validate(createItProductSchema), itProductController.create);
router.patch("/:id", itManage, validate(updateItProductSchema), itProductController.update);
router.patch(
  "/:id/activate",
  itManage,
  validate(setItProductActiveSchema),
  itProductController.activate
);
router.patch(
  "/:id/deactivate",
  itManage,
  validate(setItProductActiveSchema),
  itProductController.deactivate
);

export default router;
