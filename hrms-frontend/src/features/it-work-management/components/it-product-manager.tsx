"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Eye, Loader2, Pencil, Power, PowerOff, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { itProductService } from "@/services/it-product.service";
import { ItProduct } from "@/types/it-work-management.types";
import { useItWorkManagementAccess } from "@/hooks/use-it-work-management-access";
import { ROUTES } from "@/constants/routes";

// Not built on the generic ReferenceDataManager: Products carry a
// description field the generic {name, isActive} reference-data shape (and
// its shared component) don't support, and this needs explicit error-state
// handling that component doesn't have — see the Phase 1A report.
//
// Phase 1C-C: this page is now reachable by team members and read-only
// viewers too (see it-work-management-guard.tsx's default "any" tier) —
// every create/edit/activate control below is gated on canManage so a
// non-manage viewer only ever sees the read-only View action.
export function ItProductManager() {
  const router = useRouter();
  const { canManage } = useItWorkManagementAccess();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [editing, setEditing] = useState<ItProduct | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [toggling, setToggling] = useState<ItProduct | null>(null);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["it-products", "all"],
    queryFn: () => itProductService.list(true),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["it-products"] });

  const createMutation = useMutation({
    mutationFn: () => itProductService.create(addName.trim(), addDescription.trim() || undefined),
    onSuccess: () => {
      toast.success("Product created");
      invalidate();
      setAddOpen(false);
      setAddName("");
      setAddDescription("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      itProductService.update(
        editing!._id,
        editName.trim(),
        editDescription.trim() || undefined
      ),
    onSuccess: () => {
      toast.success("Product updated");
      invalidate();
      setEditing(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: () =>
      toggling!.isActive
        ? itProductService.deactivate(toggling!._id)
        : itProductService.activate(toggling!._id),
    onSuccess: () => {
      toast.success(`Product ${toggling?.isActive ? "deactivated" : "activated"}`);
      invalidate();
      setToggling(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Products</h2>
          <p className="text-sm text-muted-foreground">
            Systems and products the IT team is responsible for.
          </p>
        </div>
        {canManage && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4" />
            Add Product
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Product</DialogTitle>
              <DialogDescription>
                Give the new product a name and, optionally, a short description.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="product-name">Name</Label>
                <Input
                  id="product-name"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="e.g. HRMS"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="product-description">Description (optional)</Label>
                <Textarea
                  id="product-description"
                  value={addDescription}
                  onChange={(e) => setAddDescription(e.target.value)}
                  placeholder="What this product is"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={addName.trim().length < 2 || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))}

            {!isLoading && isError && (
              <TableRow>
                <TableCell colSpan={4} className="h-32 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <p className="text-sm text-destructive">Couldn&apos;t load products.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetch()}
                      disabled={isRefetching}
                    >
                      {isRefetching && <Loader2 className="h-4 w-4 animate-spin" />}
                      Try again
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {!isLoading && !isError && data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-sm text-muted-foreground">
                  No products yet.
                </TableCell>
              </TableRow>
            )}

            {!isLoading &&
              !isError &&
              data?.map((product) => (
                <TableRow key={product._id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {product.description || "—"}
                  </TableCell>
                  <TableCell>
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
                  </TableCell>
                  <TableCell className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`View ${product.name}`}
                      onClick={() =>
                        router.push(ROUTES.IT_WORK_MANAGEMENT_PRODUCT_DETAIL(product._id))
                      }
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${product.name}`}
                          onClick={() => {
                            setEditing(product);
                            setEditName(product.name);
                            setEditDescription(product.description ?? "");
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={product.isActive ? "Deactivate" : "Activate"}
                          onClick={() => setToggling(product)}
                        >
                          {product.isActive ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-product-name">Name</Label>
              <Input
                id="edit-product-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-product-description">Description (optional)</Label>
              <Textarea
                id="edit-product-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={editName.trim().length < 2 || updateMutation.isPending}
              onClick={() => updateMutation.mutate()}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(open) => !open && setToggling(null)}
        title={toggling?.isActive ? "Deactivate product?" : "Activate product?"}
        description={
          toggling?.isActive
            ? `"${toggling?.name}" will no longer be selectable for new IT work.`
            : `"${toggling?.name}" will become selectable for IT work again.`
        }
        confirmLabel={toggling?.isActive ? "Deactivate" : "Activate"}
        destructive={!!toggling?.isActive}
        isLoading={toggleMutation.isPending}
        onConfirm={() => toggleMutation.mutate()}
      />
    </div>
  );
}
