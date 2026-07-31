"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingsSection } from "@/features/administration/components/settings-section";
import { ToggleRow } from "@/features/administration/components/toggle-row";
import { TimePicker } from "@/features/administration/components/time-picker";
import { useDepartments, useDesignations, useLocations } from "@/hooks/use-reference-data";
import { useAuth } from "@/hooks/use-auth";
import { EMPLOYEE_STATUS } from "@/constants/employee-status";
import { EMPLOYMENT_TYPE } from "@/constants/employment-type";
import { ROLES } from "@/constants/roles";
import { GENDER } from "@/constants/gender";
import { STATUTORY_STATUS } from "@/constants/statutory-status";
import * as employeeService from "@/services/employee.service";
import * as configurationService from "@/services/configuration.service";
import { CONFIGURATION_QUERY_KEY } from "@/features/administration/components/administration-page-shell";
import { Employee } from "@/types/employee.types";

const phoneRegex = /^\+?[0-9][0-9\s-]{6,18}$/;

const schema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
  phone: z.string().trim().regex(phoneRegex, "Enter a valid phone number"),
  dateOfBirth: z.string().optional().or(z.literal("")),
  gender: z.string().optional().or(z.literal("")),
  bloodGroup: z.string().trim().optional().or(z.literal("")),
  department: z.string().min(1, "Select a department"),
  designation: z.string().min(1, "Select a designation"),
  joiningDate: z.string().min(1, "Select a joining date"),
  probationEndDate: z.string().optional().or(z.literal("")),
  manager: z.string().optional().or(z.literal("")),
  location: z.string().optional().or(z.literal("")),
  gracePeriodOverrideMinutes: z.string().optional().or(z.literal("")),
  role: z.string().min(1, "Select a role"),
  status: z.string().min(1, "Select a status"),
  salary: z.string().optional().or(z.literal("")),
  numberOfBonuses: z.string().optional().or(z.literal("")),
  advanceSalaryBalance: z.string().optional().or(z.literal("")),
  advanceSalaryEmi: z.string().optional().or(z.literal("")),
  shiftStartTime: z.string().optional().or(z.literal("")),
  shiftEndTime: z.string().optional().or(z.literal("")),
  ifscCode: z.string().trim().optional().or(z.literal("")),
  accountNumber: z.string().trim().optional().or(z.literal("")),
  accountHolderName: z.string().trim().optional().or(z.literal("")),
  pan: z.string().trim().optional().or(z.literal("")),
  pfEnabled: z.boolean(),
  pfUan: z.string().trim().optional().or(z.literal("")),
  professionalTaxEnabled: z.boolean(),
  lwfEnabled: z.boolean(),
  esicEnabled: z.boolean(),
  esicIpNumber: z.string().trim().optional().or(z.literal("")),
  whatsappEnabled: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

const STATUS_OPTIONS = Object.values(EMPLOYEE_STATUS);
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  NOTICE_PERIOD: "Notice Period",
  RESIGNED: "Resigned",
  TERMINATED: "Terminated",
};

const ROLE_LABELS: Record<string, string> = {
  EMPLOYEE: "Employee",
  ADMIN: "Admin",
  SUPER_ADMIN: "Super Admin",
};

const GENDER_LABELS: Record<string, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
};

interface EditEmployeeFormProps {
  employee: Employee;
  onSaved: (employee: Employee) => void;
}

export function EditEmployeeForm({ employee, onSaved }: EditEmployeeFormProps) {
  const { user } = useAuth();
  const { data: departments } = useDepartments(true);
  const { data: designations } = useDesignations(true);
  const { data: locations } = useLocations(true);
  const { data: assignableEmployees } = useQuery({
    queryKey: ["employees-assignable"],
    queryFn: () => employeeService.listAssignableEmployees(),
  });
  const { data: config } = useQuery({
    queryKey: CONFIGURATION_QUERY_KEY,
    queryFn: () => configurationService.getConfiguration().then((res) => res.data.configuration),
  });
  const [serverError, setServerError] = useState<string | null>(null);

  // Mirrors the backend rule: only a Super Admin can grant/revoke Admin
  // access, and a Super Admin's own role isn't editable through this form.
  const canEditRole = user?.role === ROLES.SUPER_ADMIN && employee.role !== ROLES.SUPER_ADMIN;

  const managerOptions = (assignableEmployees ?? []).filter((e) => e.id !== employee.id);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: employee.fullName,
      phone: employee.phone,
      dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.slice(0, 10) : "",
      gender: employee.gender ?? "",
      bloodGroup: employee.bloodGroup ?? "",
      department: employee.department?._id ?? "",
      designation: employee.designation?._id ?? "",
      joiningDate: employee.joiningDate ? employee.joiningDate.slice(0, 10) : "",
      probationEndDate: employee.probationEndDate ? employee.probationEndDate.slice(0, 10) : "",
      manager: employee.manager?._id ?? "",
      location: employee.location?._id ?? "",
      gracePeriodOverrideMinutes:
        employee.gracePeriodOverrideMinutes != null
          ? String(employee.gracePeriodOverrideMinutes)
          : "",
      role: employee.role,
      status: employee.status,
      salary: employee.salary != null ? String(employee.salary) : "",
      numberOfBonuses: employee.numberOfBonuses != null ? String(employee.numberOfBonuses) : "",
      advanceSalaryBalance:
        employee.advanceSalaryBalance != null ? String(employee.advanceSalaryBalance) : "",
      advanceSalaryEmi:
        employee.advanceSalaryEmi != null ? String(employee.advanceSalaryEmi) : "",
      shiftStartTime: employee.shiftStartTime ?? "",
      shiftEndTime: employee.shiftEndTime ?? "",
      ifscCode: employee.paymentInfo?.ifscCode ?? "",
      accountNumber: employee.paymentInfo?.accountNumber ?? "",
      accountHolderName: employee.paymentInfo?.accountHolderName ?? "",
      pan: employee.statutoryInfo?.pan ?? "",
      pfEnabled: employee.statutoryInfo?.pfStatus === STATUTORY_STATUS.ENABLED,
      pfUan: employee.statutoryInfo?.pfUan ?? "",
      professionalTaxEnabled:
        employee.statutoryInfo?.professionalTaxStatus === STATUTORY_STATUS.ENABLED,
      lwfEnabled: employee.statutoryInfo?.lwfStatus === STATUTORY_STATUS.ENABLED,
      esicEnabled: employee.statutoryInfo?.esicStatus === STATUTORY_STATUS.ENABLED,
      esicIpNumber: employee.statutoryInfo?.esicIpNumber ?? "",
      whatsappEnabled: employee.whatsappEnabled,
    },
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      const hasPaymentInfo =
        values.ifscCode !== "" || values.accountNumber !== "" || values.accountHolderName !== "";

      const res = await employeeService.updateEmployee(employee.id, {
        fullName: values.fullName,
        phone: values.phone,
        // An empty string fails the backend's date validator outright
        // (it doesn't coerce "" to "no value") — omit the field entirely
        // when there's nothing to send, same as every other optional field.
        dateOfBirth: values.dateOfBirth || undefined,
        gender: values.gender === "" ? null : values.gender,
        bloodGroup: values.bloodGroup === "" ? null : values.bloodGroup,
        department: values.department,
        designation: values.designation,
        joiningDate: values.joiningDate,
        // Blank is meaningful here (clear the tracked date back to "not
        // tracked"), unlike joiningDate above, so it's sent as null, not
        // omitted.
        probationEndDate: values.probationEndDate === "" ? null : values.probationEndDate,
        manager: values.manager === "" ? null : values.manager,
        location: values.location === "" ? null : values.location,
        // Here blank is meaningful (clear the override, fall back to the
        // company default) so it's sent as null, not omitted.
        gracePeriodOverrideMinutes:
          values.gracePeriodOverrideMinutes === ""
            ? null
            : Number(values.gracePeriodOverrideMinutes),
        role: values.role,
        status: values.status,
        salary: values.salary === "" ? null : Number(values.salary),
        numberOfBonuses: values.numberOfBonuses === "" ? null : Number(values.numberOfBonuses),
        advanceSalaryBalance:
          values.advanceSalaryBalance === "" ? null : Number(values.advanceSalaryBalance),
        advanceSalaryEmi:
          values.advanceSalaryEmi === "" ? null : Number(values.advanceSalaryEmi),
        shiftStartTime: values.shiftStartTime === "" ? null : values.shiftStartTime,
        shiftEndTime: values.shiftEndTime === "" ? null : values.shiftEndTime,
        // All-or-nothing: only send a payment info object once every field
        // is filled in — leaving it untouched otherwise, same as how a
        // half-entered bank detail shouldn't silently overwrite the rest.
        paymentInfo: hasPaymentInfo
          ? {
              ifscCode: values.ifscCode ?? "",
              accountNumber: values.accountNumber ?? "",
              accountHolderName: values.accountHolderName ?? "",
            }
          : undefined,
        statutoryInfo: {
          pan: values.pan || null,
          pfStatus: values.pfEnabled ? STATUTORY_STATUS.ENABLED : STATUTORY_STATUS.DISABLED,
          pfUan: values.pfUan || null,
          professionalTaxStatus: values.professionalTaxEnabled
            ? STATUTORY_STATUS.ENABLED
            : STATUTORY_STATUS.DISABLED,
          lwfStatus: values.lwfEnabled ? STATUTORY_STATUS.ENABLED : STATUTORY_STATUS.DISABLED,
          esicStatus: values.esicEnabled ? STATUTORY_STATUS.ENABLED : STATUTORY_STATUS.DISABLED,
          esicIpNumber: values.esicIpNumber || null,
        },
        whatsappEnabled: values.whatsappEnabled,
      });
      onSaved(res.data.employee);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Could not update employee");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {serverError && (
        <Alert variant="destructive">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <SettingsSection title="Basic Information" contentClassName="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input id="fullName" disabled={isSubmitting} {...register("fullName")} />
          {errors.fullName && (
            <p className="text-sm text-destructive">{errors.fullName.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" disabled={isSubmitting} {...register("phone")} />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
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
          <Label>Gender</Label>
          <Controller
            control={control}
            name="gender"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Gender">
                  <SelectValue placeholder="Not specified">
                    {(v: string) => GENDER_LABELS[v] ?? "Not specified"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.values(GENDER).map((g) => (
                    <SelectItem key={g} value={g}>
                      {GENDER_LABELS[g]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="bloodGroup">Blood Group</Label>
          <Input id="bloodGroup" placeholder="e.g. O+" disabled={isSubmitting} {...register("bloodGroup")} />
        </div>
      </SettingsSection>

      <SettingsSection title="Work Details" contentClassName="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Department</Label>
          <Controller
            control={control}
            name="department"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Department">
                  <SelectValue placeholder="Select department">
                    {(v: string) => departments?.find((d) => d._id === v)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {departments?.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name}
                      {!d.isActive ? " (inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Designation</Label>
          <Controller
            control={control}
            name="designation"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Designation">
                  <SelectValue placeholder="Select designation">
                    {(v: string) => designations?.find((d) => d._id === v)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {designations?.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name}
                      {!d.isActive ? " (inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="joiningDate">Joining Date</Label>
          <Input
            id="joiningDate"
            type="date"
            disabled={isSubmitting}
            {...register("joiningDate")}
          />
          <p className="text-sm text-muted-foreground">
            Drives leave carry-forward and Annual Leave accrual eligibility — correct this if it
            was entered wrong, or when migrating an employee&apos;s real join date from Razorpay.
          </p>
          {errors.joiningDate && (
            <p className="text-sm text-destructive">{errors.joiningDate.message}</p>
          )}
        </div>

        {employee.employmentType === EMPLOYMENT_TYPE.PROBATION && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="probationEndDate">Probation End Date</Label>
            <Input
              id="probationEndDate"
              type="date"
              disabled={isSubmitting}
              {...register("probationEndDate")}
            />
            <p className="text-sm text-muted-foreground">
              Auto-filled at hiring from the company default. An admin is notified automatically
              once this date passes. Clear it to stop tracking.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label>Manager</Label>
          <Controller
            control={control}
            name="manager"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Manager">
                  <SelectValue placeholder="No manager">
                    {(v: string) =>
                      managerOptions.find((m) => m.id === v)?.fullName ?? "No manager"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No manager</SelectItem>
                  {managerOptions.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName} ({m.employeeId})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label>Location</Label>
          <Controller
            control={control}
            name="location"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Location">
                  <SelectValue placeholder="No location">
                    {(v: string) => locations?.find((l) => l._id === v)?.name ?? "No location"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No location</SelectItem>
                  {locations?.map((l) => (
                    <SelectItem key={l._id} value={l._id}>
                      {l.name}
                      {!l.isActive ? " (inactive)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="gracePeriodOverrideMinutes">Grace Period Override</Label>
          <Input
            id="gracePeriodOverrideMinutes"
            type="number"
            min={0}
            max={480}
            placeholder="Company default"
            disabled={isSubmitting}
            {...register("gracePeriodOverrideMinutes")}
          />
          <p className="text-sm text-muted-foreground">
            Minutes late still counted as on-time, for this employee only. Leave blank to use the
            company default{config ? ` (${config.officeSettings.gracePeriodMinutes} minutes)` : ""}.
          </p>
          {errors.gracePeriodOverrideMinutes && (
            <p className="text-sm text-destructive">{errors.gracePeriodOverrideMinutes.message}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Role</Label>
          <Controller
            control={control}
            name="role"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange} disabled={!canEditRole}>
                <SelectTrigger aria-label="Role">
                  <SelectValue placeholder="Select role">
                    {(v: string) => ROLE_LABELS[v]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ROLES.EMPLOYEE}>Employee</SelectItem>
                  <SelectItem value={ROLES.ADMIN}>Admin</SelectItem>
                  {employee.role === ROLES.SUPER_ADMIN && (
                    <SelectItem value={ROLES.SUPER_ADMIN}>Super Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          />
          {!canEditRole && (
            <p className="text-sm text-muted-foreground">
              {employee.role === ROLES.SUPER_ADMIN
                ? "A Super Admin's role can't be changed here."
                : "Only a Super Admin can change an employee's role."}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label>Status</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Status">
                  <SelectValue placeholder="Select status">
                    {(v: string) => STATUS_LABELS[v]}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Compensation & Perquisites" contentClassName="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="salary">Annual Salary</Label>
          <Input
            id="salary"
            type="number"
            min={0}
            disabled={isSubmitting}
            {...register("salary")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="numberOfBonuses">Number of Bonuses</Label>
          <Input
            id="numberOfBonuses"
            type="number"
            min={0}
            disabled={isSubmitting}
            {...register("numberOfBonuses")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="advanceSalaryBalance">Current Advance Salary</Label>
          <Input
            id="advanceSalaryBalance"
            type="number"
            min={0}
            disabled={isSubmitting}
            {...register("advanceSalaryBalance")}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="advanceSalaryEmi">Advance Salary EMI</Label>
          <Input
            id="advanceSalaryEmi"
            type="number"
            min={0}
            disabled={isSubmitting}
            {...register("advanceSalaryEmi")}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Shift Timing" contentClassName="grid gap-4 sm:grid-cols-2">
        <Controller
          control={control}
          name="shiftStartTime"
          render={({ field }) => (
            <TimePicker id="shiftStartTime" label="Shift Start" value={field.value ?? ""} onChange={field.onChange} />
          )}
        />
        <Controller
          control={control}
          name="shiftEndTime"
          render={({ field }) => (
            <TimePicker id="shiftEndTime" label="Shift End" value={field.value ?? ""} onChange={field.onChange} />
          )}
        />
      </SettingsSection>

      <SettingsSection
        title="Payment Information"
        description="Fill in all three fields, or leave all blank."
        contentClassName="grid gap-4 sm:grid-cols-2"
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="ifscCode">IFSC Code</Label>
          <Input id="ifscCode" disabled={isSubmitting} {...register("ifscCode")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="accountNumber">Account Number</Label>
          <Input id="accountNumber" disabled={isSubmitting} {...register("accountNumber")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="accountHolderName">Account Holder Name</Label>
          <Input
            id="accountHolderName"
            disabled={isSubmitting}
            {...register("accountHolderName")}
          />
        </div>
      </SettingsSection>

      <SettingsSection title="Statutory Information" contentClassName="grid gap-4 sm:grid-cols-2 sm:items-end">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pan">PAN</Label>
          <Input id="pan" disabled={isSubmitting} {...register("pan")} />
        </div>
        <Controller
          control={control}
          name="pfEnabled"
          render={({ field }) => (
            <ToggleRow
              id="pfEnabled"
              label="PF Status"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="pfUan">PF UAN</Label>
          <Input id="pfUan" disabled={isSubmitting} {...register("pfUan")} />
        </div>
        <Controller
          control={control}
          name="professionalTaxEnabled"
          render={({ field }) => (
            <ToggleRow
              id="professionalTaxEnabled"
              label="Professional Tax"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="lwfEnabled"
          render={({ field }) => (
            <ToggleRow
              id="lwfEnabled"
              label="LWF Status"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="esicEnabled"
          render={({ field }) => (
            <ToggleRow
              id="esicEnabled"
              label="ESIC Status"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="esicIpNumber">ESIC IP Number</Label>
          <Input id="esicIpNumber" disabled={isSubmitting} {...register("esicIpNumber")} />
        </div>
      </SettingsSection>

      <SettingsSection title="Other Information">
        <Controller
          control={control}
          name="whatsappEnabled"
          render={({ field }) => (
            <ToggleRow
              id="whatsappEnabled"
              label="WhatsApp Integration"
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          )}
        />
      </SettingsSection>

      <Button type="submit" disabled={isSubmitting} className="mt-2 self-start">
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        Save changes
      </Button>
    </form>
  );
}
