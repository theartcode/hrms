import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { DashboardFilters, getItHeadDashboard } from "./it-work-item-dashboard.service";

// No actor-scoping — the itManage route gate (IT Head/Admin/Super Admin
// only) already means every caller who reaches this sees everything, same
// breadth as the unscoped branch of listWorkItems. Filters are optional and
// narrow the same underlying set every section is derived from.
export async function getDashboard(req: Request, res: Response): Promise<void> {
  const filters = req.validated!.query as DashboardFilters;
  const dashboard = await getItHeadDashboard(filters);
  sendSuccess(res, { dashboard });
}
