import { apiFetch } from "@/lib/api-client";
import { API_ENDPOINTS } from "@/constants/api-endpoints";
import { ItProduct } from "@/types/it-work-management.types";

type ApiSuccess<T> = { success: true; message: string; data: T };

export const itProductService = {
  list(includeInactive = false) {
    const qs = includeInactive ? "?includeInactive=true" : "";
    return apiFetch<ApiSuccess<{ products: ItProduct[] }>>(
      `${API_ENDPOINTS.IT_WORK_MANAGEMENT.PRODUCTS.LIST}${qs}`
    ).then((res) => res.data.products);
  },
  create(name: string, description?: string) {
    return apiFetch<ApiSuccess<{ product: ItProduct }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.PRODUCTS.CREATE,
      { method: "POST", body: JSON.stringify({ name, description }) }
    ).then((res) => res.data.product);
  },
  update(id: string, name: string, description?: string) {
    return apiFetch<ApiSuccess<{ product: ItProduct }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.PRODUCTS.UPDATE(id),
      { method: "PATCH", body: JSON.stringify({ name, description }) }
    ).then((res) => res.data.product);
  },
  activate(id: string) {
    return apiFetch<ApiSuccess<{ product: ItProduct }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.PRODUCTS.ACTIVATE(id),
      { method: "PATCH" }
    ).then((res) => res.data.product);
  },
  deactivate(id: string) {
    return apiFetch<ApiSuccess<{ product: ItProduct }>>(
      API_ENDPOINTS.IT_WORK_MANAGEMENT.PRODUCTS.DEACTIVATE(id),
      { method: "PATCH" }
    ).then((res) => res.data.product);
  },
};
