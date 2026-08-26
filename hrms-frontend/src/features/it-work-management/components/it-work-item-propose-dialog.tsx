"use client";

import { useForm, useFieldArray, useWatch, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Info, Loader2, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { itWorkItemService, ItWorkItemProposeInput } from "@/services/it-work-item.service";
import { ItProjectPriority, ItWorkType } from "@/types/it-work-management.types";
import { IT_PROJECT_PRIORITY_LABELS } from "../it-project-status-meta";
import { IT_WORK_TYPE_LABELS } from "../it-work-item-meta";
import { ItProjectProductPicker } from "./it-project-product-picker";
import { ItWorkItemProjectPicker } from "./it-work-item-project-picker";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const optionalDate = z.union([z.literal(""), z.string().regex(dateRegex, "Invalid date")]);

const rowSchema = z.object({
  product: z.string().min(1, "Select a product"),
  project: z.string().nullable(),
  title: z.string().trim().min(2, "At least 2 characters").max(200),
  workType: z.string().min(1, "Select a work type"),
  priority: z.string().min(1),
  dueDate: optionalDate,
});

const schema = z.object({ rows: z.array(rowSchema).min(1) });

type FormValues = z.infer<typeof schema>;
type RowValues = FormValues["rows"][number];

function emptyRow(defaults?: Partial<RowValues>): RowValues {
  return {
    product: defaults?.product ?? "",
    project: defaults?.project ?? null,
    title: "",
    workType: defaults?.workType ?? "",
    priority: defaults?.priority ?? "MEDIUM",
    dueDate: "",
  };
}

interface ItWorkItemProposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// A team member proposing work for themselves — e.g. planning several days
// of next week in one sitting, one row per item. Each row is always
// self-assigned with no reviewer until the IT Head approves it (see
// it-work-item.service.ts's proposeWorkItem). Rows are submitted
// independently (Promise.allSettled, not one combined request) so a
// mistake in one row's product/project pairing can't block the rest — any
// row that fails stays in the form for a quick fix and resubmit, while
// everything that succeeded is gone.
export function ItWorkItemProposeDialog({ open, onOpenChange }: ItWorkItemProposeDialogProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    control,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { rows: [emptyRow()] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "rows" });

  const mutation = useMutation({
    mutationFn: async (rows: RowValues[]) => {
      const inputs: ItWorkItemProposeInput[] = rows.map((row) => ({
        title: row.title,
        product: row.product,
        project: row.project,
        workType: row.workType as ItWorkType,
        priority: row.priority as ItProjectPriority,
        startDate: null,
        dueDate: row.dueDate || null,
      }));
      const results = await Promise.allSettled(inputs.map((input) => itWorkItemService.propose(input)));
      return results;
    },
    onSuccess: (results) => {
      const succeededIndexes = new Set(
        results.flatMap((r, i) => (r.status === "fulfilled" ? [i] : []))
      );
      const failedCount = results.length - succeededIndexes.size;

      queryClient.invalidateQueries({ queryKey: ["it-my-dashboard"] });

      if (failedCount === 0) {
        toast.success(
          results.length === 1 ? "Work item proposed — waiting for approval" : `${results.length} work items proposed — waiting for approval`
        );
        reset({ rows: [emptyRow()] });
        onOpenChange(false);
        return;
      }

      const currentRows = getValues("rows");
      const remainingRows = currentRows.filter((_, i) => !succeededIndexes.has(i));
      reset({ rows: remainingRows.length > 0 ? remainingRows : [emptyRow()] });
      toast.error(
        `${succeededIndexes.size} proposed, ${failedCount} failed — fix the remaining row${failedCount === 1 ? "" : "s"} and try again`
      );
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = useWatch({ control, name: "rows" });

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) reset({ rows: [emptyRow()] });
      }}
    >
      <SheetContent
        side="right"
        className="flex flex-col gap-6 overflow-y-auto p-6 data-[side=right]:w-1/2 data-[side=right]:sm:max-w-none"
      >
        <SheetHeader className="gap-2 border-b p-0 pb-4">
          <SheetTitle>Propose Work</SheetTitle>
          <SheetDescription>
            Add one or more work items for yourself — e.g. a plan for next week, one row per day.
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p>
            <span className="font-medium text-foreground">What happens next:</span> each item you
            submit is created immediately and marked <span className="font-medium">Pending
            Approval</span> — it&apos;s visible to you and your IT Head, but isn&apos;t counted as
            active work yet. Your IT Head reviews it and either <span className="font-medium">
            approves</span> it (it then becomes a normal tracked work item you can work through as
            usual) or <span className="font-medium">rejects</span> it with a reason (it&apos;s
            cancelled). You&apos;ll get a notification either way.
          </p>
        </div>

        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values.rows))}
          className="flex flex-1 flex-col gap-4"
        >
          <div className="flex flex-col gap-4">
            {fields.map((field, index) => (
              <div key={field.id} className="flex flex-col gap-3 rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Item {index + 1}</span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(index)}
                      disabled={isSubmitting}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor={`rows.${index}.title`}>Title</Label>
                  <Input
                    id={`rows.${index}.title`}
                    disabled={isSubmitting}
                    {...register(`rows.${index}.title`)}
                  />
                  {errors.rows?.[index]?.title && (
                    <p className="text-sm text-destructive">{errors.rows[index]?.title?.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label>Product</Label>
                    <Controller
                      control={control}
                      name={`rows.${index}.product`}
                      render={({ field: f }) => (
                        <ItProjectProductPicker
                          value={f.value}
                          onChange={(v) => {
                            f.onChange(v);
                            setValue(`rows.${index}.project`, null);
                          }}
                          disabled={isSubmitting}
                        />
                      )}
                    />
                    {errors.rows?.[index]?.product && (
                      <p className="text-sm text-destructive">{errors.rows[index]?.product?.message}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Project</Label>
                    <Controller
                      control={control}
                      name={`rows.${index}.project`}
                      render={({ field: f }) => (
                        <ItWorkItemProjectPicker
                          product={rows[index]?.product ?? ""}
                          value={f.value}
                          onChange={f.onChange}
                          disabled={isSubmitting}
                        />
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-2">
                    <Label>Work Type</Label>
                    <Controller
                      control={control}
                      name={`rows.${index}.workType`}
                      render={({ field: f }) => (
                        <Select value={f.value} onValueChange={f.onChange}>
                          <SelectTrigger aria-label="Work Type">
                            <SelectValue placeholder="Select">
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
                    {errors.rows?.[index]?.workType && (
                      <p className="text-sm text-destructive">
                        {errors.rows[index]?.workType?.message}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label>Priority</Label>
                    <Controller
                      control={control}
                      name={`rows.${index}.priority`}
                      render={({ field: f }) => (
                        <Select value={f.value} onValueChange={f.onChange}>
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
                    <Label htmlFor={`rows.${index}.dueDate`}>Due Date</Label>
                    <Input
                      id={`rows.${index}.dueDate`}
                      type="date"
                      disabled={isSubmitting}
                      {...register(`rows.${index}.dueDate`)}
                    />
                    {errors.rows?.[index]?.dueDate && (
                      <p className="text-sm text-destructive">
                        {errors.rows[index]?.dueDate?.message}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={isSubmitting}
            onClick={() => {
              const last = rows[rows.length - 1];
              append(emptyRow({ product: last?.product, project: last?.project, workType: last?.workType, priority: last?.priority }));
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Another Day
          </Button>

          <SheetFooter className="mt-0 border-t p-0 pt-4">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Propose {fields.length > 1 ? `${fields.length} Items` : "Work"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
