import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import * as locationService from "./location.service";

async function list(req: Request, res: Response): Promise<void> {
  const { includeInactive } = req.validated!.query as { includeInactive: boolean };
  const locations = await locationService.listLocations(includeInactive);
  sendSuccess(res, { locations });
}

async function create(req: Request, res: Response): Promise<void> {
  const location = await locationService.createLocation(req.user!, req.body.name);
  sendSuccess(res, { location }, "Location created", 201);
}

async function update(req: Request, res: Response): Promise<void> {
  const location = await locationService.updateLocation(
    req.user!,
    String(req.params.id),
    req.body.name
  );
  sendSuccess(res, { location }, "Location updated");
}

async function activate(req: Request, res: Response): Promise<void> {
  const location = await locationService.setLocationActive(
    req.user!,
    String(req.params.id),
    true
  );
  sendSuccess(res, { location }, "Location activated");
}

async function deactivate(req: Request, res: Response): Promise<void> {
  const location = await locationService.setLocationActive(
    req.user!,
    String(req.params.id),
    false
  );
  sendSuccess(res, { location }, "Location deactivated");
}

export { list, create, update, activate, deactivate };
