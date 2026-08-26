"use client";

import { useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { ItExecutiveProduct } from "@/types/it-work-management.types";
import { DashboardSection } from "@/features/dashboard/components/dashboard-section";

// Part 16 — every active Product, automatically (no hardcoded product
// list) since this renders whatever `products` the backend returned for
// currently-active IT Products. Clicking a row opens the existing Product
// detail page (Part 17: reuse existing pages, no CEO-only copy).
export function ItExecutiveProductOverview({ products }: { products: ItExecutiveProduct[] }) {
  const router = useRouter();

  return (
    <DashboardSection title="Product Overview" description="Work by Product, across every active IT Product.">
      {products.length === 0 ? (
        <div className="flex h-20 items-center justify-center rounded-lg border text-sm text-muted-foreground">
          No active products.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Active Projects</TableHead>
                <TableHead>Active Work Items</TableHead>
                <TableHead>Blocked</TableHead>
                <TableHead>Overdue</TableHead>
                <TableHead>In Review</TableHead>
                <TableHead>Completed Recently</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow
                  key={product.id}
                  className="cursor-pointer"
                  onClick={() => router.push(ROUTES.IT_WORK_MANAGEMENT_PRODUCT_DETAIL(product.id))}
                >
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="tabular-nums">{product.activeProjects}</TableCell>
                  <TableCell className="tabular-nums">{product.activeWorkItems}</TableCell>
                  <TableCell className="tabular-nums">
                    {product.blocked > 0 ? (
                      <span className="text-red-600 dark:text-red-400">{product.blocked}</span>
                    ) : (
                      product.blocked
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {product.overdue > 0 ? (
                      <span className="text-red-600 dark:text-red-400">{product.overdue}</span>
                    ) : (
                      product.overdue
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{product.inReview}</TableCell>
                  <TableCell className="tabular-nums">{product.completedRecently}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </DashboardSection>
  );
}
