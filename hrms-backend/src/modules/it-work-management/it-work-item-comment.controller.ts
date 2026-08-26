import { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/ApiResponse";
import * as commentService from "./it-work-item-comment.service";

async function list(req: Request, res: Response): Promise<void> {
  const comments = await commentService.listComments(req.user!, String(req.params.id));
  sendSuccess(res, { comments });
}

async function create(req: Request, res: Response): Promise<void> {
  const comment = await commentService.addComment(
    req.user!,
    String(req.params.id),
    req.body.body
  );
  sendSuccess(res, { comment }, "Comment posted", 201);
}

async function update(req: Request, res: Response): Promise<void> {
  const comment = await commentService.editComment(
    req.user!,
    String(req.params.id),
    String(req.params.commentId),
    req.body.body
  );
  sendSuccess(res, { comment }, "Comment updated");
}

async function remove(req: Request, res: Response): Promise<void> {
  await commentService.deleteComment(req.user!, String(req.params.id), String(req.params.commentId));
  sendSuccess(res, {}, "Comment deleted");
}

export { list, create, update, remove };
