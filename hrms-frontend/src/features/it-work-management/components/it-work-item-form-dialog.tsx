"use client";

import { useForm, useWatch, Controller } from "react-hook-form";
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
import { itWorkItemService } from "@/services/it-work-item.service";
import { ItProjectPriority, ItWorkType } from "@/types/it-work-management.types";
import { IT_PROJECT_PRIORITY_LABELS } from "../it-project-status-meta";
import { IT_WORK_TYPE_LABELS } from "../it-work-item-meta";
import { ItProjectProductPicker } from "./it-project-product-picker";
import { ItWorkItemProjectPicker } from "./it-work-item-project-picker";
import { ItWorkItemPersonPicker } from "./it-work-item-person-picker";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const optionalDate = z.union([z.literal(""), z.string().regex(dateRegex, "Invalid date")]);

const schema = z
  .object({
    product: z.string().min(1, "Select a product"),
    project: z.string().nullable(),
    title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
    description: z.string().trim().max(2000).optional(),
    workType: z.string().min(1, "Select a work type"),
    assignedTo: z.string().nullable(),
    reviewer: z.string().nullable(),
    priority: z.string().min(1),
    startDate: optionalDate,
    dueDate: optionalDate,
  })
  .refine((data) => !data.startDate || !data.dueDate || data.startDate <= data.dueDate, {
    message: "Start date must not be after due date",
    path: ["dueDate"],
  });

type FormValues = z.infer<typeof schema>;

const EMPTY_VALUES: FormValues = {
  product: "",
  project: null,
  title: "",
  description: "",
  workType: "",
  assignedTo: null,
  reviewer: null,
  priority: "MEDIUM",
  startDate: "",
  dueDate: "",
};

interface ItWorkItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselects the product, e.g. when launched from a product or project's own page. */
  defaultProduct?: string;
  defaultProject?: string;
}

// Create only — editing is split across ItWorkItemEditDialog (general
// fields) and ItWorkItemAssignmentDialog (management fields), mirroring
// the backend's own create-vs-update-vs-assignment split.
export function ItWorkItemFormDialog({
  open,
  onOpenChange,
  defaultProduct,
  defaultProject,
}: ItWorkItemFormDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      ...EMPTY_VALUES,
      product: defaultProduct ?? "",
      project: defaultProject ?? null,
    },
  });

  const product = useWatch({ control, name: "product" });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      itWorkItemService.create({
        title: values.title,
        description: values.description || undefined,
        product: values.product,
        project: values.project,
        workType: values.workType as ItWorkType,
        assignedTo: values.assignedTo,
        reviewer: values.reviewer,
        priority: values.priority as ItProjectPriority,
        startDate: values.startDate || null,
        dueDate: values.dueDate || null,
      }),
    onSuccess: () => {
      toast.success("Work item created");
      queryClient.invalidateQueries({ queryKey: ["it-work-items"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Work Item</DialogTitle>
          <DialogDescription>
            Capture the requirement — starts as Requested.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Product</Label>
              <Controller
                control={control}
                name="product"
                render={({ field }) => (
                  <ItProjectProductPicker
                    value={field.value}
                    onChange={(v) => {
                      field.onChange(v);
                      // A project only ever belongs to one product — clear
                      // a stale selection rather than let it silently
                      // point at the wrong product's project.
                      setValue("project", null);
                    }}
                    disabled={isSubmitting}
                  />
                )}
              />
              {errors.product && (
                <p className="text-sm text-destructive">{errors.product.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label>Project</Label>
              <Controller
                control={control}
                name="project"
                render={({ field }) => (
                  <ItWorkItemProjectPicker
                    product={product}
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" disabled={isSubmitting} {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" disabled={isSubmitting} {...register("description")} />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Work Type</Label>
            <Controller
              control={control}
              name="workType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Work Type">
                    <SelectValue placeholder="Select a work type">
                      {(v: string) => IT_WORK_TYPE_LABELS[v as ItWorkType]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(IT_WORK_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.workType && (
              <p className="text-sm text-destructive">{errors.workType.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Assignee</Label>
              <Controller
                control={control}
                name="assignedTo"
                render={({ field }) => (
                  <ItWorkItemPersonPicker
                    label="Assignee"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>Reviewer</Label>
              <Controller
                control={control}
                name="reviewer"
                render={({ field }) => (
                  <ItWorkItemPersonPicker
                    label="Reviewer"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isSubmitting}
                  />
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
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
              <Label htmlFor="dueDate">Due Date</Label>
              <Input id="dueDate" type="date" disabled={isSubmitting} {...register("dueDate")} />
              {errors.dueDate && (
                <p className="text-sm text-destructive">{errors.dueDate.message}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Create Work Item
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
