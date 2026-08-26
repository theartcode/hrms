"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ItWorkManagementGuard } from "@/features/it-work-management/components/it-work-management-guard";
import { ItProjectStatusBadge, ItProjectPriorityBadge } from "@/features/it-work-management/components/it-project-badges";
import { ItWorkItemSummaryCounts } from "@/features/it-work-management/components/it-work-item-summary-counts";
import { summarizeWorkItemStatuses } from "@/features/it-work-management/it-work-item-meta";
import { useItProducts } from "@/hooks/use-it-products";
import { itProjectService } from "@/services/it-project.service";
import { itWorkItemService } from "@/services/it-work-item.service";
import { ROUTES } from "@/constants/routes";

export default function ItWorkManagementProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // No dedicated GET /products/:id — the Product list is reference-data
  // scale (a handful of rows), already fetched everywhere else via this
  // same hook/cache, so finding the one product client-side avoids adding
  // an endpoint that Part H's "prefer existing API structure" wouldn't
  // have wanted for something this small.
  const {
    data: products,
    isLoading: productsLoading,
    isError: productsError,
    refetch: refetchProducts,
    isRefetching: productsRefetching,
  } = useItProducts(true);
  const product = products?.find((p) => p._id === id);

  // Both rollups request only this Product's own data, server-side
  // filtered via ?product=id — never the full Project/Work Item
  // collections fetched and filtered client-side.
  const {
    data: projects,
    isLoading: projectsLoading,
    isError: projectsError,
  } = useQuery({
    queryKey: ["it-projects", { product: id }],
    queryFn: () => itProjectService.list({ product: id }),
    enabled: !!id,
  });

  const { data: workItems } = useQuery({
    queryKey: ["it-work-items", { product: id }],
    queryFn: () => itWorkItemService.list({ product: id }),
    enabled: !!id,
  });

  const summary = useMemo(() => summarizeWorkItemStatuses(workItems ?? []), [workItems]);

  return (
    <ItWorkManagementGuard>
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 w-fit"
          onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_PRODUCTS)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Products
        </Button>

        {productsLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {!productsLoading && productsError && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center">
            <AlertCircle className="h-6 w-6 text-destructive" />
            <p className="text-sm text-destructive">Couldn&apos;t load this product.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchProducts()}
              disabled={productsRefetching}
            >
              Try again
            </Button>
          </div>
        )}

        {!productsLoading && !productsError && !product && (
          <div className="flex min-h-[40vh] flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium">Product not found</p>
          </div>
        )}

        {!productsLoading && !productsError && product && (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {product.description || "No description."}
                </p>
              </div>
              <Badge
                variant="outline"
                className={
                  product.isActive
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-transparent"
                    : "bg-muted text-muted-foreground border-transparent"
                }
              >
                {product.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">Work Item Summary</h2>
              <ItWorkItemSummaryCounts summary={summary} />
            </div>

            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                Projects {projects ? `(${projects.length})` : ""}
              </h2>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>Target Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectsLoading &&
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={6}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        </TableRow>
                      ))}

                    {!projectsLoading && projectsError && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-sm text-destructive"
                        >
                          Couldn&apos;t load projects for this product.
                        </TableCell>
                      </TableRow>
                    )}

                    {!projectsLoading && !projectsError && projects?.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="h-24 text-center text-sm text-muted-foreground"
                        >
                          No projects under this product yet.
                        </TableCell>
                      </TableRow>
                    )}

                    {!projectsLoading &&
                      !projectsError &&
                      projects?.map((proj) => (
                        <TableRow
                          key={proj._id}
                          className="cursor-pointer"
                          onClick={() =>
                            router.push(ROUTES.IT_WORK_MANAGEMENT_PROJECT_DETAIL(proj._id))
                          }
                        >
                          <TableCell className="font-medium">{proj.name}</TableCell>
                          <TableCell>
                            <ItProjectStatusBadge status={proj.status} />
                          </TableCell>
                          <TableCell>
                            <ItProjectPriorityBadge priority={proj.priority} />
                          </TableCell>
                          <TableCell>{proj.owner?.fullName ?? "Unknown Owner"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {proj.startDate ?? "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {proj.targetDate ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        )}
      </div>
    </ItWorkManagementGuard>
  );
}
