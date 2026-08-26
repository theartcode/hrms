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
import { ItProjectPriority, ItWorkItem, ItWorkType } from "@/types/it-work-management.types";
import { IT_PROJECT_PRIORITY_LABELS } from "../it-project-status-meta";
import { IT_WORK_TYPE_LABELS } from "../it-work-item-meta";
import { ItProjectProductPicker } from "./it-project-product-picker";
import { ItWorkItemProjectPicker } from "./it-work-item-project-picker";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const optionalDate = z.union([z.literal(""), z.string().regex(dateRegex, "Invalid date")]);

const schema = z.object({
  product: z.string().min(1, "Select a product"),
  project: z.string().nullable(),
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
  description: z.string().trim().max(2000).optional(),
  workType: z.string().min(1, "Select a work type"),
  priority: z.string().min(1),
  dueDate: optionalDate,
});

type FormValues = z.infer<typeof schema>;

interface ItWorkItemEditProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItem: ItWorkItem;
}

// The proposer revising their own still-pending proposal — e.g. after the
// IT Head used "Request Changes" (see ItWorkItemRequestProposalChangesDialog).
// Only ever shown to the original proposer while approvalStatus is still
// PENDING (it-work-item-status-control.tsx enforces this) — the backend's
// updateProposal independently enforces the same rule. Saving clears the
// outstanding reviewNote, since the edit is presumed to address it.
export function ItWorkItemEditProposalDialog({
  open,
  onOpenChange,
  workItem,
}: ItWorkItemEditProposalDialogProps) {
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
      product: workItem.product?._id ?? "",
      project: workItem.project?._id ?? null,
      title: workItem.title,
      description: workItem.description ?? "",
      workType: workItem.workType,
      priority: workItem.priority,
      dueDate: workItem.dueDate ?? "",
    },
  });

  const product = useWatch({ control, name: "product" });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      itWorkItemService.updateProposal(workItem._id, {
        title: values.title,
        description: values.description || undefined,
        product: values.product,
        project: values.project,
        workType: values.workType as ItWorkType,
        priority: values.priority as ItProjectPriority,
        startDate: null,
        dueDate: values.dueDate || null,
      }),
    onSuccess: () => {
      toast.success("Proposal updated");
      queryClient.invalidateQueries({ queryKey: ["it-work-items"] });
      queryClient.invalidateQueries({ queryKey: ["it-work-item", workItem._id] });
      queryClient.invalidateQueries({ queryKey: ["it-work-item-activity", workItem._id] });
      queryClient.invalidateQueries({ queryKey: ["it-my-dashboard"] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Proposal</DialogTitle>
          <DialogDescription>
            Still pending your IT Head&apos;s decision — update anything they asked you to change.
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
            <Label htmlFor="edit-proposal-title">Title</Label>
            <Input id="edit-proposal-title" disabled={isSubmitting} {...register("title")} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-proposal-description">Description</Label>
            <Textarea
              id="edit-proposal-description"
              disabled={isSubmitting}
              {...register("description")}
            />
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-proposal-dueDate">Due Date</Label>
              <Input
                id="edit-proposal-dueDate"
                type="date"
                disabled={isSubmitting}
                {...register("dueDate")}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
