import { Router } from "express";
import { authenticate } from "../../shared/middleware/authenticate";
import { authorize } from "../../shared/middleware/authorize";
import { validate } from "../../shared/middleware/validate";
import { ROLES } from "../../shared/constants/roles";
import {
  createLocationSchema,
  listLocationsSchema,
  setLocationActiveSchema,
  updateLocationSchema,
} from "./location.validation";
import * as locationController from "./location.controller";

const router = Router();
const manage = authorize(ROLES.ADMIN, ROLES.SUPER_ADMIN);

router.use(authenticate);

router.get("/", validate(listLocationsSchema), locationController.list);
router.post("/", manage, validate(createLocationSchema), locationController.create);
router.patch("/:id", manage, validate(updateLocationSchema), locationController.update);
router.patch(
  "/:id/activate",
  manage,
  validate(setLocationActiveSchema),
  locationController.activate
);
router.patch(
  "/:id/deactivate",
  manage,
  validate(setLocationActiveSchema),
  locationController.deactivate
);

export default router;
