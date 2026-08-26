import { z } from "zod";

export const listAttachmentsSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const uploadAttachmentSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
});

export const attachmentIdParamSchema = z.object({
  params: z.object({ id: z.string().min(1), attachmentId: z.string().min(1) }),
});
