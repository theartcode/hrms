"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SettingsSection } from "@/features/administration/components/settings-section";
import { maskAccountNumber } from "@/lib/utils";
import * as employeeService from "@/services/employee.service";
import { Employee } from "@/types/employee.types";

const phoneRegex = /^\+?[0-9][0-9\s-]{6,18}$/;

const schema = z.object({
  phone: z.string().trim().regex(phoneRegex, "Enter a valid phone number"),
  dateOfBirth: z.string().optional().or(z.literal("")),
  address: z.string().trim().max(500).optional().or(z.literal("")),
  emergencyContactName: z.string().trim().optional().or(z.literal("")),
  emergencyContactPhone: z
    .string()
    .trim()
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || phoneRegex.test(v), "Enter a valid phone number"),
});

type FormValues = z.infer<typeof schema>;

const bankSchema = z.object({
  ifscCode: z.string().trim().min(1, "IFSC code is required"),
  accountNumber: z.string().trim().min(1, "Account number is required"),
  accountHolderName: z.string().trim().min(1, "Account holder name is required"),
});

type BankFormValues = z.infer<typeof bankSchema>;

interface EditProfileFormProps {
  employee: Employee;
  onSaved: (employee: Employee) => void;
}

const REVIEW_STATUS_LABELS: Record<string, string> = {
  PENDING: "Awaiting Approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export function EditProfileForm({ employee, onSaved }: EditProfileFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [bankServerError, setBankServerError] = useState<string | null>(null);
  const [bankSubmitted, setBankSubmitted] = useState(false);
  const [current, setCurrent] = useState(employee);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      phone: employee.phone,
      dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.slice(0, 10) : "",
      address: employee.address ?? "",
      emergencyContactName: employee.emergencyContact?.name ?? "",
      emergencyContactPhone: employee.emergencyContact?.phone ?? "",
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const res = await employeeService.updateMyProfile({
        phone: values.phone,
        dateOfBirth: values.dateOfBirth || undefined,
        address: values.address || undefined,
        emergencyContact:
          values.emergencyContactName && values.emergencyContactPhone
            ? {
                name: values.emergencyContactName,
                phone: values.emergencyContactPhone,
              }
            : undefined,
      });
      onSaved(res.data.employee);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not update profile");
    }
  }

  // Bank details are a separate, self-contained form with its own submit
  // action — unlike every other field here, this one never saves directly.
  // It always goes to pendingPaymentInfo for an admin to approve, so it
  // gets its own explicit "Submit for Approval" button rather than being
  // silently bundled into the main "Save changes" click.
  const {
    register: registerBank,
    handleSubmit: handleSubmitBank,
    formState: { errors: bankErrors, isSubmitting: isSubmittingBank },
  } = useForm<BankFormValues>({
    resolver: zodResolver(bankSchema),
    defaultValues: {
      ifscCode: employee.pendingPaymentInfo?.ifscCode ?? employee.paymentInfo?.ifscCode ?? "",
      accountNumber:
        employee.pendingPaymentInfo?.accountNumber ?? employee.paymentInfo?.accountNumber ?? "",
      accountHolderName:
        employee.pendingPaymentInfo?.accountHolderName ??
        employee.paymentInfo?.accountHolderName ??
        "",
    },
  });

  async function onSubmitBank(values: BankFormValues) {
    setBankServerError(null);
    try {
      const res = await employeeService.submitPaymentInfoChange(values);
      setCurrent(res.data.employee);
      setBankSubmitted(true);
    } catch (err) {
      setBankServerError(err instanceof Error ? err.message : "Could not submit bank details");
    }
  }

  const reviewStatus = current.paymentInfoReviewStatus;

  return (
    <div className="flex flex-col gap-6">
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" disabled={isSubmitting} {...register("phone")} />
        {errors.phone && (
          <p className="text-sm text-destructive">{errors.phone.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="dateOfBirth">Date of Birth</Label>
        <Input
          id="dateOfBirth"
          type="date"
          disabled={isSubmitting}
          {...register("dateOfBirth")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" disabled={isSubmitting} {...register("address")} />
        {errors.address && (
          <p className="text-sm text-destructive">{errors.address.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
        <Input
          id="emergencyContactName"
          disabled={isSubmitting}
          {...register("emergencyContactName")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
        <Input
          id="emergencyContactPhone"
          disabled={isSubmitting}
          {...register("emergencyContactPhone")}
        />
        {errors.emergencyContactPhone && (
          <p className="text-sm text-destructive">
            {errors.emergencyContactPhone.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting} className="mt-2 self-start">
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Save changes
      </Button>
    </form>

    <form onSubmit={handleSubmitBank(onSubmitBank)}>
      <SettingsSection
        title="Bank Details"
        description="Changes here don't take effect immediately — an admin must approve them before payroll uses the new details."
      >
        {bankServerError && (
          <Alert variant="destructive">
            <AlertDescription>{bankServerError}</AlertDescription>
          </Alert>
        )}

        {reviewStatus === "PENDING" && (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription>
              A bank details change is awaiting admin approval. Your current details on file are
              still in effect until then.
            </AlertDescription>
          </Alert>
        )}

        {reviewStatus === "REJECTED" && !bankSubmitted && (
          <Alert variant="destructive">
            <AlertDescription>
              Your last bank details change was rejected
              {current.paymentInfoReviewComment ? `: ${current.paymentInfoReviewComment}` : "."}
            </AlertDescription>
          </Alert>
        )}

        {bankSubmitted && (
          <Alert>
            <AlertDescription>
              Submitted — an admin will review this change before it takes effect.
            </AlertDescription>
          </Alert>
        )}

        {current.paymentInfo && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              Current on file: {current.paymentInfo.ifscCode} ····{" "}
              {maskAccountNumber(current.paymentInfo.accountNumber)}
            </span>
            {reviewStatus && (
              <Badge variant={reviewStatus === "APPROVED" ? "default" : "outline"}>
                {REVIEW_STATUS_LABELS[reviewStatus]}
              </Badge>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="ifscCode">IFSC Code</Label>
          <Input id="ifscCode" disabled={isSubmittingBank} {...registerBank("ifscCode")} />
          {bankErrors.ifscCode && (
            <p className="text-sm text-destructive">{bankErrors.ifscCode.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="accountNumber">Account Number</Label>
          <Input
            id="accountNumber"
            disabled={isSubmittingBank}
            {...registerBank("accountNumber")}
          />
          {bankErrors.accountNumber && (
            <p className="text-sm text-destructive">{bankErrors.accountNumber.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="accountHolderName">Account Holder Name</Label>
          <Input
            id="accountHolderName"
            disabled={isSubmittingBank}
            {...registerBank("accountHolderName")}
          />
          {bankErrors.accountHolderName && (
            <p className="text-sm text-destructive">{bankErrors.accountHolderName.message}</p>
          )}
        </div>

        <Button type="submit" disabled={isSubmittingBank} className="self-start">
          {isSubmittingBank && <Loader2 className="h-4 w-4 animate-spin" />}
          Submit for Approval
        </Button>
      </SettingsSection>
    </form>
    </div>
  );
}
