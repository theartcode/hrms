import { apiFetch } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/constants/api-endpoints";
import { ItWorkItemComment } from "@/types/it-work-management.types";

type ApiSuccess<T> = { success: true; message: string; data: T };

export const itWorkItemCommentService = {
  list(workItemId: string) {
    return apiFetch<ApiSuccess<{ comments: ItWorkItemComment[] }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.COMMENTS(workItemId)
    ).then((res) => res.data.comments);
  },
  create(workItemId: string, body: string) {
    return apiFetch<ApiSuccess<{ comment: ItWorkItemComment }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.COMMENTS(workItemId),
      { method: "POST", body: JSON.stringify({ body }) }
    ).then((res) => res.data.comment);
  },
  update(workItemId: string, commentId: string, body: string) {
    return apiFetch<ApiSuccess<{ comment: ItWorkItemComment }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.COMMENT_DETAIL(workItemId, commentId),
      { method: "PATCH", body: JSON.stringify({ body }) }
    ).then((res) => res.data.comment);
  },
  remove(workItemId: string, commentId: string) {
    return apiFetch<ApiSuccess<Record<string, never>>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.WORK_ITEMS.COMMENT_DETAIL(workItemId, commentId),
      { method: "DELETE" }
    );
  },
};
