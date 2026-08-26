"use client";

import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { ItProject } from "@/types/it-work-management.types";
import { ItProjectPriorityBadge, ItProjectStatusBadge } from "./it-project-badges";

interface ItProjectTableProps {
  projects: ItProject[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  isRefetching: boolean;
}

const COLUMN_COUNT = 6;

export function ItProjectTable({
  projects,
  isLoading,
  isError,
  onRetry,
  isRefetching,
}: ItProjectTableProps) {
  const router = useRouter();

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Priority</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Target Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading &&
            Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={COLUMN_COUNT}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ))}

          {!isLoading && isError && (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <p className="text-sm text-destructive">Couldn&apos;t load projects.</p>
                  <Button variant="outline" size="sm" onClick={onRetry} disabled={isRefetching}>
                    {isRefetching && <Loader2 className="h-4 w-4 animate-spin" />}
                    Try again
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          )}

          {!isLoading && !isError && projects?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={COLUMN_COUNT}
                className="h-24 text-center text-sm text-muted-foreground"
              >
                No projects match these filters.
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            !isError &&
            projects?.map((project) => (
              <TableRow
                key={project._id}
                className="cursor-pointer"
                onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_PROJECT_DETAIL(project._id))}
              >
                <TableCell className="font-medium">{project.name}</TableCell>
                <TableCell>{project.product?.name ?? "Unknown Product"}</TableCell>
                <TableCell>
                  <ItProjectStatusBadge status={project.status} />
                </TableCell>
                <TableCell>
                  <ItProjectPriorityBadge priority={project.priority} />
                </TableCell>
                <TableCell>{project.owner?.fullName ?? "Unknown Owner"}</TableCell>
                <TableCell className="text-muted-foreground">
                  {project.targetDate ?? "—"}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
