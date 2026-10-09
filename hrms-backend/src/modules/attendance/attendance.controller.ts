import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import * as attendanceService from "./attendance.service";

async function doCheckIn(req: Request, res: Response): Promise<void> {
  const record = await attendanceService.checkIn(req.user!);
  sendSuccess(res, { attendance: record }, "Checked in");
}

async function doCheckOut(req: Request, res: Response): Promise<void> {
  const record = await attendanceService.checkOut(req.user!);
  sendSuccess(res, { attendance: record }, "Checked out");
}

async function today(req: Request, res: Response): Promise<void> {
  const record = await attendanceService.getToday(req.user!.id);
  sendSuccess(res, { attendance: record });
}

async function officeHours(_req: Request, res: Response): Promise<void> {
  sendSuccess(res, attendanceService.getOfficeHours());
}

async function adminSetAttendance(req: Request, res: Response): Promise<void> {
  const { employeeId, date } = req.validated!.params as { employeeId: string; date: string };
  const { checkIn, checkOut } = req.body as { checkIn: Date | null; checkOut: Date | null };
  const attendance = await attendanceService.adminSetAttendance(req.user!, employeeId, date, {
    checkIn,
    checkOut,
  });
  sendSuccess(res, { attendance }, attendance ? "Attendance updated" : "Attendance record cleared");
}

function currentYearMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

async function history(req: Request, res: Response): Promise<void> {
  const query = req.validated!.query as {
    year?: number;
    month?: number;
    employeeId?: string;
  };
  const employeeId = await attendanceService.resolveViewableEmployeeId(
    req.user!,
    query.employeeId
  );
  const { year, month } = { ...currentYearMonth(), ...query };
  const days = await attendanceService.getMonthDayStatuses(employeeId, year, month);
  sendSuccess(res, { year, month, days });
}

async function exportHistory(req: Request, res: Response): Promise<void> {
  const query = req.validated!.query as {
    year?: number;
    month?: number;
    employeeId?: string;
  };
  const employeeId = await attendanceService.resolveViewableEmployeeId(
    req.user!,
    query.employeeId
  );
  const { year, month } = { ...currentYearMonth(), ...query };
  const csv = await attendanceService.exportMonthDayStatusesCsv(employeeId, year, month);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="attendance-history.csv"');
  res.send(csv);
}

async function calendar(req: Request, res: Response): Promise<void> {
  const query = req.validated!.query as {
    year?: number;
    month?: number;
    employeeId?: string;
  };
  const employeeId = await attendanceService.resolveViewableEmployeeId(
    req.user!,
    query.employeeId
  );
  const { year, month } = { ...currentYearMonth(), ...query };
  const days = await attendanceService.getMonthDayStatuses(employeeId, year, month);
  sendSuccess(res, { year, month, days });
}

async function summary(req: Request, res: Response): Promise<void> {
  const query = req.validated!.query as {
    year?: number;
    month?: number;
    employeeId?: string;
  };
  const employeeId = await attendanceService.resolveViewableEmployeeId(
    req.user!,
    query.employeeId
  );
  const { year, month } = { ...currentYearMonth(), ...query };
  const data = await attendanceService.getMonthSummary(employeeId, year, month);
  sendSuccess(res, { year, month, summary: data });
}

async function adminList(req: Request, res: Response): Promise<void> {
  const query = req.validated!.query as Parameters<
    typeof attendanceService.adminListAttendance
  >[0];
  const result = await attendanceService.adminListAttendance(query);
  sendSuccess(res, result);
}

async function notCheckedIn(req: Request, res: Response): Promise<void> {
  const query = req.validated!.query as { date?: string };
  const employees = await attendanceService.getNotCheckedInToday(query.date);
  sendSuccess(res, { employees });
}

async function adminExport(req: Request, res: Response): Promise<void> {
  const query = req.validated!.query as Parameters<
    typeof attendanceService.exportAttendanceCsv
  >[0];
  const csv = await attendanceService.exportAttendanceCsv(query);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="attendance-export.csv"');
  res.send(csv);
}

export {
  doCheckIn,
  doCheckOut,
  today,
  officeHours,
  history,
  exportHistory,
  calendar,
  summary,
  adminList,
  adminExport,
  notCheckedIn,
  adminSetAttendance,
};
