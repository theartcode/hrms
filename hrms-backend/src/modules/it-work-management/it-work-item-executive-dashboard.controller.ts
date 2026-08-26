import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import {
  ExecutiveDashboardFilters,
  getExecutiveDashboard,
} from "./it-work-item-executive-dashboard.service";

// No actor-scoping — readonly access is an all-of-IT grant (Part 43 of the
// brief), not a per-user scope. itReadOnlyOnly on the route already
// restricts this to exactly the readonly tier before this ever runs.
export async function getExecutiveDashboardHandler(req: Request, res: Response): Promise<void> {
  const filters = req.validated!.query as ExecutiveDashboardFilters;
  const dashboard = await getExecutiveDashboard(filters);
  sendSuccess(res, { dashboard });
}
