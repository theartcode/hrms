import { Request, Response } from "express";
import { ApiError } from "../../shared/errors/ApiError";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import * as attachmentService from "./it-work-item-attachment.service";

async function list(req: Request, res: Response): Promise<void> {
  const attachments = await attachmentService.listAttachments(req.user!, String(req.params.id));
  sendSuccess(res, { attachments });
}

async function upload(req: Request, res: Response): Promise<void> {
  if (!req.file) {
    throw new ApiError(422, "Upload a PDF, JPEG, PNG, or DOCX file under 10MB");
  }
  const attachment = await attachmentService.uploadAttachment(
    req.user!,
    String(req.params.id),
    req.file
  );
  sendSuccess(res, { attachment }, "Attachment uploaded", 201);
}

async function getDownloadUrl(req: Request, res: Response): Promise<void> {
  const url = await attachmentService.getAttachmentDownloadUrl(
    req.user!,
    String(req.params.id),
    String(req.params.attachmentId)
  );
  sendSuccess(res, { url });
}

async function remove(req: Request, res: Response): Promise<void> {
  await attachmentService.deleteAttachment(
    req.user!,
    String(req.params.id),
    String(req.params.attachmentId)
  );
  sendSuccess(res, {}, "Attachment deleted");
}

export { list, upload, getDownloadUrl, remove };
