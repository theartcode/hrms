"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/layout/role-guard";
import { ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import { locationService } from "@/services/location.service";
import { ReferenceDataManager } from "@/features/administration/components/reference-data-manager";

export default function AdministrationLocationsPage() {
  const router = useRouter();

  return (
    <RoleGuard allow={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}>
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          onClick={() => router.push(ROUTES.ADMINISTRATION)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Administration
        </Button>

        <ReferenceDataManager
          title="Locations"
          description="Office locations employees can be assigned to."
          itemLabel="Location"
          queryKey="locations"
          service={locationService}
        />
      </div>
    </RoleGuard>
  );
}
