import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import * as employeeService from "./employee.service";

async function list(req: Request, res: Response): Promise<void> {
  const query = req.validated!.query as {
    page: number;
    limit: number;
    search?: string;
    department?: string;
    designation?: string;
    role?: string;
    status?: string;
    sortBy: string;
    sortOrder: "asc" | "desc";
  };
  const result = await employeeService.listEmployees(query);
  sendSuccess(res, result);
}

async function create(req: Request, res: Response): Promise<void> {
  const result = await employeeService.createEmployee(req.user!, req.body);
  sendSuccess(
    res,
    result,
    "Employee created - share the temporary password with them once",
    201
  );
}

async function getById(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.getEmployeeById(
    req.user!,
    String(req.params.id)
  );
  sendSuccess(res, { employee });
}

async function update(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.updateEmployee(
    req.user!,
    String(req.params.id),
    req.body
  );
  sendSuccess(res, { employee }, "Employee updated");
}

async function activate(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.setEmployeeActive(
    req.user!,
    String(req.params.id),
    true
  );
  sendSuccess(res, { employee }, "Employee activated");
}

async function deactivate(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.setEmployeeActive(
    req.user!,
    String(req.params.id),
    false
  );
  sendSuccess(res, { employee }, "Employee deactivated");
}

async function promoteToPermanent(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.promoteToPermanent(
    req.user!,
    String(req.params.id)
  );
  sendSuccess(res, { employee }, "Employee marked as Permanent");
}

async function remove(req: Request, res: Response): Promise<void> {
  await employeeService.deleteEmployee(req.user!, String(req.params.id));
  sendSuccess(res, null, "Employee deleted");
}

async function getMe(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.getMyProfile(req.user!.id);
  sendSuccess(res, { employee });
}

async function updateMe(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.updateMyProfile(req.user!.id, req.body);
  sendSuccess(res, { employee }, "Profile updated");
}

async function listAssignable(req: Request, res: Response): Promise<void> {
  const employees = await employeeService.listAssignableEmployees(req.user!);
  sendSuccess(res, { employees });
}

async function upcomingAnniversaries(req: Request, res: Response): Promise<void> {
  const days = Number(req.query.days) || 30;
  const anniversaries = await employeeService.listUpcomingWorkAnniversaries(days);
  sendSuccess(res, { anniversaries });
}

async function submitPaymentInfo(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.submitPaymentInfoChange(req.user!, req.body);
  sendSuccess(res, { employee }, "Bank details submitted for approval");
}

async function approvePaymentInfo(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.approvePaymentInfoChange(
    req.user!,
    String(req.params.id)
  );
  sendSuccess(res, { employee }, "Bank details approved");
}

async function rejectPaymentInfo(req: Request, res: Response): Promise<void> {
  const employee = await employeeService.rejectPaymentInfoChange(
    req.user!,
    String(req.params.id),
    req.body.comment
  );
  sendSuccess(res, { employee }, "Bank details change rejected");
}

export {
  list,
  create,
  getById,
  update,
  activate,
  deactivate,
  promoteToPermanent,
  remove,
  getMe,
  updateMe,
  listAssignable,
  upcomingAnniversaries,
  submitPaymentInfo,
  approvePaymentInfo,
  rejectPaymentInfo,
};
