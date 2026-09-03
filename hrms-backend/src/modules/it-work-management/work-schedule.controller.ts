import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import * as scheduleService from "./work-schedule.service";

async function getMine(req: Request, res: Response): Promise<void> {
  const result = await scheduleService.getEmployeeSchedule(req.user!.id);
  sendSuccess(res, result);
}

async function addMine(req: Request, res: Response): Promise<void> {
  const entry = await scheduleService.addScheduleEntry(req.user!, req.user!.id, req.body);
  sendSuccess(res, { entry }, "Added to your schedule", 201);
}

async function updateMine(req: Request, res: Response): Promise<void> {
  const entry = await scheduleService.updateMyScheduleEntryNote(
    req.user!,
    String(req.params.id),
    req.body.note
  );
  sendSuccess(res, { entry }, "Schedule entry updated");
}

async function removeMine(req: Request, res: Response): Promise<void> {
  await scheduleService.removeScheduleEntry(req.user!, req.user!.id, String(req.params.id));
  sendSuccess(res, {}, "Removed from your schedule");
}

async function getTeam(_req: Request, res: Response): Promise<void> {
  const result = await scheduleService.getTeamSchedule();
  sendSuccess(res, result);
}

async function getForEmployee(req: Request, res: Response): Promise<void> {
  const result = await scheduleService.getEmployeeSchedule(String(req.params.employeeId));
  sendSuccess(res, result);
}

async function addForEmployee(req: Request, res: Response): Promise<void> {
  const entry = await scheduleService.addScheduleEntry(
    req.user!,
    String(req.params.employeeId),
    req.body
  );
  sendSuccess(res, { entry }, "Added to employee's schedule", 201);
}

async function removeForEmployee(req: Request, res: Response): Promise<void> {
  await scheduleService.removeScheduleEntry(
    req.user!,
    String(req.params.employeeId),
    String(req.params.id)
  );
  sendSuccess(res, {}, "Removed from employee's schedule");
}

export {
  getMine,
  addMine,
  updateMine,
  removeMine,
  getTeam,
  getForEmployee,
  addForEmployee,
  removeForEmployee,
};
