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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { itWorkItemService } from "@/services/it-work-item.service";
import { ItProjectPriority, ItWorkItem } from "@/types/it-work-management.types";
import { IT_PROJECT_PRIORITY_LABELS } from "../it-project-status-meta";
import { ItWorkItemPersonPicker } from "./it-work-item-person-picker";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const optionalDate = z.union([z.literal(""), z.string().regex(dateRegex, "Invalid date")]);

const schema = z
  .object({
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

interface ItWorkItemAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workItem: ItWorkItem;
}

// Management fields only — assignee, reviewer, priority, dates. Route-
// gated itManage-only on the backend, so this dialog is only ever reached
// from actions a team member wouldn't see rendered in the first place.
export function ItWorkItemAssignmentDialog({
  open,
  onOpenChange,
  workItem,
}: ItWorkItemAssignmentDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      assignedTo: workItem.assignedTo?._id ?? null,
      reviewer: workItem.reviewer?._id ?? null,
      priority: workItem.priority,
      startDate: workItem.startDate ?? "",
      dueDate: workItem.dueDate ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      itWorkItemService.updateAssignment(workItem._id, {
        assignedTo: values.assignedTo,
        reviewer: values.reviewer,
        priority: values.priority as ItProjectPriority,
        startDate: values.startDate || null,
        dueDate: values.dueDate || null,
      }),
    onSuccess: () => {
      toast.success("Assignment updated");
      queryClient.invalidateQueries({ queryKey: ["it-work-items"] });
      queryClient.invalidateQueries({ queryKey: ["it-work-item", workItem._id] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Assignment</DialogTitle>
          <DialogDescription>Assignee, reviewer, priority, and dates.</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
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
              Save Assignment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
