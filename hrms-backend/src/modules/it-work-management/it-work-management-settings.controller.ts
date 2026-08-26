import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import * as settingsService from "./it-work-management-settings.service";

async function list(_req: Request, res: Response): Promise<void> {
  const viewers = await settingsService.listReadOnlyViewers();
  sendSuccess(res, { viewers });
}

async function grant(req: Request, res: Response): Promise<void> {
  const viewers = await settingsService.grantReadOnlyAccess(req.user!, String(req.params.userId));
  sendSuccess(res, { viewers }, "Read-only access granted");
}

async function revoke(req: Request, res: Response): Promise<void> {
  const viewers = await settingsService.revokeReadOnlyAccess(req.user!, String(req.params.userId));
  sendSuccess(res, { viewers }, "Read-only access revoked");
}

export { list, grant, revoke };
