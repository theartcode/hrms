import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import * as itProjectService from "./it-project.service";

async function list(req: Request, res: Response): Promise<void> {
  const filters = req.validated!.query as {
    product?: string;
    status?: string;
    priority?: string;
    owner?: string;
  };
  const projects = await itProjectService.listProjects(filters as never);
  sendSuccess(res, { projects });
}

async function getById(req: Request, res: Response): Promise<void> {
  const project = await itProjectService.assertProjectExists(String(req.params.id));
  sendSuccess(res, { project });
}

async function create(req: Request, res: Response): Promise<void> {
  const project = await itProjectService.createProject(req.user!, req.body);
  sendSuccess(res, { project }, "Project created", 201);
}

async function update(req: Request, res: Response): Promise<void> {
  const project = await itProjectService.updateProject(
    req.user!,
    String(req.params.id),
    req.body
  );
  sendSuccess(res, { project }, "Project updated");
}

async function changeStatus(req: Request, res: Response): Promise<void> {
  const project = await itProjectService.changeProjectStatus(
    req.user!,
    String(req.params.id),
    req.body.status
  );
  sendSuccess(res, { project }, "Project status updated");
}

async function remove(req: Request, res: Response): Promise<void> {
  await itProjectService.deleteProject(req.user!, String(req.params.id));
  sendSuccess(res, {}, "Project deleted");
}

export { list, getById, create, update, changeStatus, remove };
