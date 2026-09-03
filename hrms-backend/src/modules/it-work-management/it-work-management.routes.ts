import { Request, Response, Router } from "express";
import { authenticate } from "../../shared/middleware/authenticate";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { validate } from "../../shared/middleware/validate";
import { getItAccessTier, itManage, itTeamOnly, itReadOnlyOnly } from "./it-access";
import itProductRoutes from "./it-product.routes";
import itProjectRoutes from "./it-project.routes";
import itWorkItemRoutes from "./it-work-item.routes";
import itWorkManagementSettingsRoutes from "./it-work-management-settings.routes";
import dailyTimesheetRoutes from "./daily-timesheet.routes";
import workScheduleRoutes from "./work-schedule.routes";
import { getDashboard } from "./it-work-item-dashboard.controller";
import { getDashboardSchema } from "./it-work-item-dashboard.validation";
import { getMyDashboardHandler } from "./it-work-item-my-dashboard.controller";
import { getMyDashboardSchema } from "./it-work-item-my-dashboard.validation";
import { getExecutiveDashboardHandler } from "./it-work-item-executive-dashboard.controller";
import { getExecutiveDashboardSchema } from "./it-work-item-executive-dashboard.validation";

const router = Router();

router.use(authenticate);

// Mirrors adobe-license's GET /access/me exactly: the frontend auth payload
// only ever carried departmentHeadOf (departments a user HEADS), never
// their own plain department membership, so there was no client-side way
// to know "is this user an IT team member" until now — Phase 1C-A's team
// tier needs exactly that. This one small endpoint answers it without
// adding a new field to the global auth payload.
router.get("/access/me", async (req: Request, res: Response): Promise<void> => {
  const tier = await getItAccessTier(req.user!);
  sendSuccess(res, { tier });
});

// Phase 1E-A: IT Head/Admin/Super Admin only — team members and read-only
// viewers never reach this, matching every other itManage-gated route.
router.get("/dashboard", itManage, validate(getDashboardSchema), getDashboard);

// Phase 1E-B: exactly the team tier — never manage, never readonly (see
// itTeamOnly in it-access.ts).
router.get("/my-dashboard", itTeamOnly, validate(getMyDashboardSchema), getMyDashboardHandler);

// Phase 1E-C: exactly the readonly tier — never manage, never team (see
// itReadOnlyOnly in it-access.ts).
router.get(
  "/executive-dashboard",
  itReadOnlyOnly,
  validate(getExecutiveDashboardSchema),
  getExecutiveDashboardHandler
);

router.use("/products", itProductRoutes);
router.use("/projects", itProjectRoutes);
router.use("/work-items", itWorkItemRoutes);
router.use("/settings", itWorkManagementSettingsRoutes);
// Daily Timesheet + Work Schedule — additive sibling feature areas, same
// nested-sub-router shape as Products/Projects/Work Items above.
router.use("/timesheets", dailyTimesheetRoutes);
router.use("/schedules", workScheduleRoutes);
// Later phases mount /activity, /reports here.

export default router;
