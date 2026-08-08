"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleGuard } from "@/components/layout/role-guard";
import { ROLES } from "@/constants/roles";
import { ROUTES } from "@/constants/routes";
import * as attendanceService from "@/services/attendance.service";
import {
  AdminAttendanceFilters,
  AdminAttendanceFilterValues,
} from "@/features/attendance/components/admin-attendance-filters";
import { AdminAttendanceTable } from "@/features/attendance/components/admin-attendance-table";
import { AdminCorrectionsPanel } from "@/features/attendance/components/admin-corrections-panel";

export default function TeamAttendancePage() {
  return (
    <RoleGuard allow={[ROLES.ADMIN, ROLES.SUPER_ADMIN]}>
      <TeamAttendanceContent />
    </RoleGuard>
  );
}

function TeamAttendanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = new Date();
  const correctionHighlightId = searchParams.get("correctionId") ?? undefined;
  const [filters, setFilters] = useState<AdminAttendanceFilterValues>({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    employeeId: searchParams.get("employeeId") ?? undefined,
  });
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["attendance-admin", filters, page],
    queryFn: () =>
      attendanceService.adminList({ ...filters, page, limit: 15 }).then((res) => res.data),
  });

  function handleFiltersChange(next: AdminAttendanceFilterValues) {
    setFilters(next);
    setPage(1);
  }

  async function handleExport() {
    setExporting(true);
    try {
      await attendanceService.exportCsv(filters);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2"
          onClick={() => router.push(ROUTES.ATTENDANCE)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to My Attendance
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Team Attendance</h1>
        <p className="text-sm text-muted-foreground">
          View and export attendance records across the company.
        </p>
      </div>

      <AdminAttendanceFilters
        value={filters}
        onChange={handleFiltersChange}
        onExport={handleExport}
        exporting={exporting}
      />

      <AdminAttendanceTable
        rows={data?.records ?? []}
        isLoading={isLoading}
        isError={isError}
        pagination={data?.pagination}
        onPageChange={setPage}
      />

      <AdminCorrectionsPanel highlightId={correctionHighlightId} />
    </div>
  );
}
