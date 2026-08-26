import { useQuery } from "@tanstack/react-query";
import { itProductService } from "@/services/it-product.service";

// Shared by the Products management page and the Project form/filters'
// product dropdown — same query key as ItProductManager's own list query
// (["it-products","all"] when includeInactive is true) so they share one
// cache and one invalidation path instead of double-fetching.
export function useItProducts(includeInactive = true) {
  return useQuery({
    queryKey: ["it-products", includeInactive ? "all" : "active"],
    queryFn: () => itProductService.list(includeInactive),
  });
}
