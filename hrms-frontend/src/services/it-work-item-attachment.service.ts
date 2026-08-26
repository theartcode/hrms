import { apiFetch, apiUpload } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/constants/api-endpoints";
import { ItWorkItemAttachment } from "@/types/it-work-management.types";

type ApiSuccess<T> = { success: true; message: string; data: T };

export const itWorkItemAttachmentService = {
  list(workItemId: string) {
    return apiFetch<ApiSuccess<{ attachments: ItWorkItemAttachment[] }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.ATTACHMENTS(workItemId)
    ).then((res) => res.data.attachments);
  },
  upload(workItemId: string, file: File, onProgress?: (percent: number) => void) {
    const formData = new FormData();
    formData.append("file", file);
    return apiUpload<ApiSuccess<{ attachment: ItWorkItemAttachment }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.ATTACHMENTS(workItemId),
      formData,
      onProgress
    ).then((res) => res.data.attachment);
  },
  getDownloadUrl(workItemId: string, attachmentId: string) {
    return apiFetch<ApiSuccess<{ url: string }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.ATTACHMENT_DOWNLOAD_URL(workItemId, attachmentId)
    ).then((res) => res.data.url);
  },
  remove(workItemId: string, attachmentId: string) {
    return apiFetch<ApiSuccess<Record<string, never>>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.ATTACHMENT_DELETE(workItemId, attachmentId),
      { method: "DELETE" }
    );
  },
};
