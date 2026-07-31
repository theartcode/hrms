import { useQuery } from "@tanstack/react-query";
import { departmentService } from "@/services/department.service";
import { designationService } from "@/services/designation.service";
import { locationService } from "@/services/location.service";

export function useDepartments(includeInactive = false) {
  return useQuery({
    queryKey: ["departments", includeInactive],
    queryFn: () => departmentService.list(includeInactive),
  });
}

export function useDesignations(includeInactive = false) {
  return useQuery({
    queryKey: ["designations", includeInactive],
    queryFn: () => designationService.list(includeInactive),
  });
}

export function useLocations(includeInactive = false) {
  return useQuery({
    queryKey: ["locations", includeInactive],
    queryFn: () => locationService.list(includeInactive),
  });
}
