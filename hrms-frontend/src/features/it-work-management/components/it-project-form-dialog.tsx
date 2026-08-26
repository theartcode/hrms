"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { itProjectService } from "@/services/it-project.service";
import { ItProject, ItProjectPriority, ItProjectStatus } from "@/types/it-work-management.types";
import { IT_PROJECT_PRIORITY_LABELS, IT_PROJECT_STATUS_LABELS } from "../it-project-status-meta";
import { ItProjectProductPicker } from "./it-project-product-picker";
import { ItProjectOwnerPicker } from "./it-project-owner-picker";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const optionalDate = z.union([z.literal(""), z.string().regex(dateRegex, "Invalid date")]);

const schema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(150),
    description: z.string().trim().max(1000).optional(),
    product: z.string().min(1, "Select a product"),
    owner: z.string().min(1, "Select an owner"),
    priority: z.string().min(1),
    status: z.string().min(1),
    startDate: optionalDate,
    targetDate: optionalDate,
  })
  .refine((data) => !data.startDate || !data.targetDate || data.startDate <= data.targetDate, {
    message: "Start date must not be after target date",
    path: ["targetDate"],
  });

type FormValues = z.infer<typeof schema>;

const EMPTY_VALUES: FormValues = {
  name: "",
  description: "",
  product: "",
  owner: "",
  priority: "MEDIUM",
  status: "PLANNED",
  startDate: "",
  targetDate: "",
};

interface ItProjectFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present = edit mode (status is not editable here — see the project detail page's status control). Absent = create mode. */
  project?: ItProject;
  /** Preselects the product on create, e.g. when launched from a product's own page. Ignored in edit mode. */
  defaultProduct?: string;
}

export function ItProjectFormDialog({
  open,
  onOpenChange,
  project,
  defaultProduct,
}: ItProjectFormDialogProps) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(project);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: project
      ? {
          name: project.name,
          description: project.description ?? "",
          // Falls back to empty (forcing an explicit re-pick) rather than
          // crashing if the Project's stored product reference no longer
          // resolves to a real Product — see ItProject.product's type.
          product: project.product?._id ?? "",
          // Same fallback reasoning as product above, for a dangling owner.
          owner: project.owner?._id ?? "",
          priority: project.priority,
          status: project.status,
          startDate: project.startDate ?? "",
          targetDate: project.targetDate ?? "",
        }
      : { ...EMPTY_VALUES, product: defaultProduct ?? "" },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["it-projects"] });
    if (project) queryClient.invalidateQueries({ queryKey: ["it-project", project._id] });
  };

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? itProjectService.update(project!._id, {
            name: values.name,
            description: values.description || undefined,
            product: values.product,
            owner: values.owner,
            priority: values.priority as ItProjectPriority,
            startDate: values.startDate || null,
            targetDate: values.targetDate || null,
          })
        : itProjectService.create({
            name: values.name,
            description: values.description || undefined,
            product: values.product,
            owner: values.owner,
            priority: values.priority as ItProjectPriority,
            status: values.status as ItProjectStatus,
            startDate: values.startDate || null,
            targetDate: values.targetDate || null,
          }),
    onSuccess: () => {
      toast.success(isEdit ? "Project updated" : "Project created");
      invalidate();
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Project" : "Create Project"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the project's details. Status changes happen from the project page."
              : "Add a new project under a product."}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label>Product</Label>
            <Controller
              control={control}
              name="product"
              render={({ field }) => (
                <ItProjectProductPicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
            {errors.product && (
              <p className="text-sm text-destructive">{errors.product.message}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Project Name</Label>
            <Input id="name" disabled={isSubmitting} {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" disabled={isSubmitting} {...register("description")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Owner</Label>
            <Controller
              control={control}
              name="owner"
              render={({ field }) => (
                <ItProjectOwnerPicker
                  value={field.value}
                  onChange={field.onChange}
                  disabled={isSubmitting}
                />
              )}
            />
            {errors.owner && <p className="text-sm text-destructive">{errors.owner.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Priority</Label>
              <Controller
                control={control}
                name="priority"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Priority">
                      <SelectValue placeholder="Priority">
                        {(v: string) => IT_PROJECT_PRIORITY_LABELS[v as ItProjectPriority]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(IT_PROJECT_PRIORITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            {isEdit ? (
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <p className="flex h-9 items-center text-sm text-muted-foreground">
                  {IT_PROJECT_STATUS_LABELS[project!.status]} — change from the project page
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label>Status</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label="Status">
                        <SelectValue placeholder="Status">
                          {(v: string) => IT_PROJECT_STATUS_LABELS[v as ItProjectStatus]}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(IT_PROJECT_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                disabled={isSubmitting}
                {...register("startDate")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="targetDate">Target Date</Label>
              <Input
                id="targetDate"
                type="date"
                disabled={isSubmitting}
                {...register("targetDate")}
              />
              {errors.targetDate && (
                <p className="text-sm text-destructive">{errors.targetDate.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
