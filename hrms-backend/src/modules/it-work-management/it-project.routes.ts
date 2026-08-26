import { Router } from "express";
import { validate } from "../../shared/middleware/validate";
import { itAccess, itManage } from "./it-access";
import {
  createProjectSchema,
  listProjectsSchema,
  projectIdParamSchema,
  updateProjectSchema,
  changeProjectStatusSchema,
} from "./it-project.validation";
import * as itProjectController from "./it-project.controller";

const router = Router();

// authenticate is applied once by the parent it-work-management.routes.ts
// router. Phase 1C-C: reads use itAccess (manage/team/readonly can all
// view Projects) — writes stay itManage-only.
router.get("/", itAccess, validate(listProjectsSchema), itProjectController.list);
router.post("/", itManage, validate(createProjectSchema), itProjectController.create);
router.get("/:id", itAccess, validate(projectIdParamSchema), itProjectController.getById);
router.patch("/:id", itManage, validate(updateProjectSchema), itProjectController.update);
router.patch(
  "/:id/status",
  itManage,
  validate(changeProjectStatusSchema),
  itProjectController.changeStatus
);
router.delete(
  "/:id",
  itManage,
  validate(projectIdParamSchema),
  itProjectController.remove
);

export default router;
