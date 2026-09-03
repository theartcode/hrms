import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import * as timesheetService from "./daily-timesheet.service";

async function getToday(req: Request, res: Response): Promise<void> {
  const entry = await timesheetService.getTodayTimesheet(req.user!);
  sendSuccess(res, { timesheet: entry });
}

async function saveToday(req: Request, res: Response): Promise<void> {
  const entry = await timesheetService.saveTodayDraft(req.user!, req.body);
  sendSuccess(res, { timesheet: entry }, "Timesheet saved");
}

async function submitToday(req: Request, res: Response): Promise<void> {
  const entry = await timesheetService.submitTodayTimesheet(req.user!);
  sendSuccess(res, { timesheet: entry }, "Timesheet submitted");
}

async function myHistory(req: Request, res: Response): Promise<void> {
  const query = req.validated!.query as {
    page: number;
    limit: number;
    startDate?: string;
    endDate?: string;
  };
  const result = await timesheetService.listMyTimesheetHistory(req.user!, query);
  sendSuccess(res, result);
}

async function team(req: Request, res: Response): Promise<void> {
  const query = req.validated!.query as {
    date?: string;
    employee?: string;
    status?: "DRAFT" | "SUBMITTED" | "NOT_STARTED";
    page: number;
    limit: number;
  };
  const result = await timesheetService.getTeamTimesheets(query);
  sendSuccess(res, result);
}

async function getById(req: Request, res: Response): Promise<void> {
  const entry = await timesheetService.getTimesheetById(req.user!, String(req.params.id));
  sendSuccess(res, { timesheet: entry });
}

export { getToday, saveToday, submitToday, myHistory, team, getById };
