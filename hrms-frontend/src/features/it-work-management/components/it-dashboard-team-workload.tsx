"use client";

import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { ItDashboardTeamMember } from "@/types/it-work-management.types";
import { DashboardSection } from "@/features/dashboard/components/dashboard-section";

// WORKLOAD, not productivity — raw current counts by status, nothing that
// implies effort, speed, or quality (Part 4 of the brief is explicit that
// this distinction matters). No HR fields (salary, statutory info, personal
// details) appear here — only name and IT work counts.
export function ItDashboardTeamWorkload({ team }: { team: ItDashboardTeamMember[] }) {
  const router = useRouter();

  return (
    <DashboardSection
      title="Team Workload"
      description="Current work item counts per team member — a snapshot of load, not a measure of output."
    >
      {team.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          No IT team members found.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team Member</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>In Review</TableHead>
                <TableHead>Blocked</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead>Next Due</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {team.map((member) => (
                <TableRow
                  key={member.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`${ROUTES.IT_WORK_MANAGEMENT_WORK_ITEMS}?assignedTo=${member.id}`)
                  }
                >
                  <TableCell className="font-medium">{member.fullName}</TableCell>
                  <TableCell className="tabular-nums">{member.active}</TableCell>
                  <TableCell className="tabular-nums">{member.review}</TableCell>
                  <TableCell className="tabular-nums">{member.blocked}</TableCell>
                  <TableCell className="tabular-nums">
                    {member.overdue > 0 ? (
                      <span className="text-red-600 dark:text-red-400">{member.overdue}</span>
                    ) : (
                      member.overdue
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.nextDue ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DashboardSection>
  );
}
