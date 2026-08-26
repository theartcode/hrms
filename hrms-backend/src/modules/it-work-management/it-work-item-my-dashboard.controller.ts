import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import { getMyDashboard, MyDashboardFilters } from "./it-work-item-my-dashboard.service";

// The actor is taken from authentication only — never from a query
// parameter — so scope can't be widened by the caller (Part 27/28 of the
// brief). itTeamOnly on the route already restricts this to team-tier
// actors before this ever runs.
export async function getMyDashboardHandler(req: Request, res: Response): Promise<void> {
  const filters = req.validated!.query as MyDashboardFilters;
  const dashboard = await getMyDashboard(req.user!, filters);
  sendSuccess(res, { dashboard });
}
