import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ROLES } from "@/constants/roles";
import { myItAccess } from "@/services/it-work-management.service";

const IT_DEPARTMENT_NAME = "IT";

// The "manage" tier (Admin/Super Admin/IT Head) is resolvable purely from
// the auth payload — departmentHeadOf is already there, no request needed.
// "team" and "readonly" (Phase 1C-C's CEO tier) are NOT: neither a user's
// own department membership nor their read-only-viewer grant status is
// carried on the auth payload, so both are resolved by the module's own
// GET /access/me — same shape as useAdobeLicenseAccess, and for the same
// reason: the check only runs for actors who aren't already manage-tier.
export function useItWorkManagementAccess() {
  const { user } = useAuth();
  const isAdmin = !!user && (user.role === ROLES.ADMIN || user.role === ROLES.SUPER_ADMIN);
  const isItHead =
    !!user &&
    user.departmentHeadOf.some((d) => d.name.trim().toUpperCase() === IT_DEPARTMENT_NAME);
  const isManage = isAdmin || isItHead;

  const query = useQuery({
    queryKey: ["it-work-management-access-me"],
    queryFn: () => myItAccess().then((res) => res.data.tier),
    enabled: !!user && !isManage,
    staleTime: 5 * 60 * 1000,
  });

  const tier = isManage ? "manage" : (query.data ?? "none");
  const isTeamMember = tier === "team";
  const isReadOnlyViewer = tier === "readonly";

  return {
    canAccess: isManage || isTeamMember || isReadOnlyViewer,
    canManage: isManage,
    isItHead,
    isAdmin,
    isTeamMember,
    isReadOnlyViewer,
    isLoading: !!user && !isManage && query.isLoading,
  };
}
