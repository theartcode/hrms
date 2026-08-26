"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ItWorkManagementGuard } from "@/features/it-work-management/components/it-work-management-guard";
import { ItProductManager } from "@/features/it-work-management/components/it-product-manager";
import { ROUTES } from "@/constants/routes";

export default function ItWorkManagementProductsPage() {
  const router = useRouter();

  return (
    <ItWorkManagementGuard>
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to IT Work Management
        </Button>

        <ItProductManager />
      </div>
    </ItWorkManagementGuard>
  );
}
