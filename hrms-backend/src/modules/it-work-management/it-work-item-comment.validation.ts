import { z } from "zod";

export const listCommentsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const addCommentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    body: z.string().trim().min(1, "Comment cannot be empty").max(2000, "Comment is too long"),
  }),
});

export const commentIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1), commentId: z.string().min(1) }),
});

export const editCommentSchema = z.object({
  params: z.object({ id: z.string().min(1), commentId: z.string().min(1) }),
  body: z.object({
    body: z.string().trim().min(1, "Comment cannot be empty").max(2000, "Comment is too long"),
  }),
});
