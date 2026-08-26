import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import * as itWorkItemService from "./it-work-item.service";
import { isWorkItemOverdue } from "./it-work-item.util";
import { IITWorkItem } from "./it-work-item.model";

// `overdue` is computed here, at the HTTP boundary, and never stored —
// same convention as the existing Task module's toPublicTask. Kept out of
// the service layer so it-work-item.service.ts's return type stays a
// plain Mongoose document, not a bespoke DTO shape.
function withOverdue(workItem: IITWorkItem) {
  const obj = workItem.toObject() as Record<string, unknown> & {
    dueDate: string | null;
    status: IITWorkItem["status"];
  };
  return { ...obj, overdue: isWorkItemOverdue(obj.dueDate, obj.status) };
}

async function list(req: Request, res: Response): Promise<void> {
  const filters = req.validated!.query as {
    product?: string;
    project?: string;
    workType?: string;
    priority?: string;
    status?: string;
    assignedTo?: string;
  };
  const workItems = await itWorkItemService.listWorkItems(req.user!, filters as never);
  sendSuccess(res, { workItems: workItems.map(withOverdue) });
}

async function getById(req: Request, res: Response): Promise<void> {
  const workItem = await itWorkItemService.getWorkItemForActor(req.user!, String(req.params.id));
  sendSuccess(res, { workItem: withOverdue(workItem) });
}

async function create(req: Request, res: Response): Promise<void> {
  const workItem = await itWorkItemService.createWorkItem(req.user!, req.body);
  sendSuccess(res, { workItem: withOverdue(workItem) }, "Work item created", 201);
}

async function update(req: Request, res: Response): Promise<void> {
  const workItem = await itWorkItemService.updateWorkItem(
    req.user!,
    String(req.params.id),
    req.body
  );
  sendSuccess(res, { workItem: withOverdue(workItem) }, "Work item updated");
}

async function updateAssignment(req: Request, res: Response): Promise<void> {
  const workItem = await itWorkItemService.updateWorkItemAssignment(
    req.user!,
    String(req.params.id),
    req.body
  );
  sendSuccess(res, { workItem: withOverdue(workItem) }, "Work item assignment updated");
}

async function changeStatus(req: Request, res: Response): Promise<void> {
  const workItem = await itWorkItemService.changeWorkItemStatus(
    req.user!,
    String(req.params.id),
    req.body.status,
    req.body.reason
  );
  sendSuccess(res, { workItem: withOverdue(workItem) }, "Work item status updated");
}

async function submitForReview(req: Request, res: Response): Promise<void> {
  const workItem = await itWorkItemService.submitWorkItemForReview(
    req.user!,
    String(req.params.id)
  );
  sendSuccess(res, { workItem: withOverdue(workItem) }, "Submitted for review");
}

async function review(req: Request, res: Response): Promise<void> {
  const workItem = await itWorkItemService.reviewWorkItem(
    req.user!,
    String(req.params.id),
    req.body.decision,
    req.body.reason
  );
  sendSuccess(
    res,
    { workItem: withOverdue(workItem) },
    req.body.decision === "APPROVE" ? "Work item approved" : "Changes requested"
  );
}

async function listActivity(req: Request, res: Response): Promise<void> {
  const activity = await itWorkItemService.listWorkItemActivity(
    req.user!,
    String(req.params.id)
  );
  sendSuccess(res, { activity });
}

async function propose(req: Request, res: Response): Promise<void> {
  const workItem = await itWorkItemService.proposeWorkItem(req.user!, req.body);
  sendSuccess(res, { workItem: withOverdue(workItem) }, "Work item proposed", 201);
}

async function approveProposal(req: Request, res: Response): Promise<void> {
  const workItem = await itWorkItemService.approveWorkItemProposal(
    req.user!,
    String(req.params.id)
  );
  sendSuccess(res, { workItem: withOverdue(workItem) }, "Proposal approved");
}

async function rejectProposal(req: Request, res: Response): Promise<void> {
  const workItem = await itWorkItemService.rejectWorkItemProposal(
    req.user!,
    String(req.params.id),
    req.body.reason
  );
  sendSuccess(res, { workItem: withOverdue(workItem) }, "Proposal rejected");
}

async function requestProposalChanges(req: Request, res: Response): Promise<void> {
  const workItem = await itWorkItemService.requestProposalChanges(
    req.user!,
    String(req.params.id),
    req.body.note
  );
  sendSuccess(res, { workItem: withOverdue(workItem) }, "Changes requested");
}

async function updateProposal(req: Request, res: Response): Promise<void> {
  const workItem = await itWorkItemService.updateProposal(
    req.user!,
    String(req.params.id),
    req.body
  );
  sendSuccess(res, { workItem: withOverdue(workItem) }, "Proposal updated");
}

export {
  list,
  getById,
  create,
  update,
  updateAssignment,
  changeStatus,
  submitForReview,
  review,
  listActivity,
  propose,
  approveProposal,
  rejectProposal,
  requestProposalChanges,
  updateProposal,
};
