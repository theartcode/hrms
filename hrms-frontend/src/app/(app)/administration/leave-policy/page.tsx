"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AdministrationPageShell,
  CONFIGURATION_QUERY_KEY,
} from "@/features/administration/components/administration-page-shell";
import { SettingsSection } from "@/features/administration/components/settings-section";
import { SaveBar } from "@/features/administration/components/save-bar";
import { ToggleRow } from "@/features/administration/components/toggle-row";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import * as configurationService from "@/services/configuration.service";
import { Configuration, LeavePolicy, LeaveTypePolicy } from "@/types/configuration.types";
import { LEAVE_TYPES, LeaveType } from "@/constants/leave-types";

const leaveTypeOptions: { value: LeaveType; label: string }[] = [
  { value: LEAVE_TYPES.SICK, label: "Sick Leave" },
  { value: LEAVE_TYPES.CASUAL_PAID, label: "Casual Leave" },
  { value: LEAVE_TYPES.ANNUAL, label: "Annual Leave" },
  { value: LEAVE_TYPES.UNPAID, label: "Unpaid Leave" },
  { value: LEAVE_TYPES.COMP_OFF, label: "Comp Off" },
];

// Which fields are actually meaningful per type, so the table shows "—"
// instead of an editable control where editing it would do nothing:
// - Default Leave / Monthly Increment: Sick & Casual use a flat per-half
//   quota, Annual is pure monthly accrual (no flat quota), Unpaid is
//   unlimited, Comp Off is granted ad hoc (never from a policy default).
// - Carry Forward: only ever consulted for Sick and Casual (the two
//   half-year-bucketed types) — Annual/Unpaid/Comp Off never apply it,
//   regardless of its value, so it's not editable on those rows.
const HAS_MONTHLY_INCREMENT: Record<LeaveType, boolean> = {
  SICK: false,
  CASUAL_PAID: false,
  ANNUAL: true,
  UNPAID: false,
  COMP_OFF: false,
};
const HAS_CARRY_FORWARD: Record<LeaveType, boolean> = {
  SICK: true,
  CASUAL_PAID: true,
  ANNUAL: false,
  UNPAID: false,
  COMP_OFF: false,
};

export default function LeavePolicyPage() {
  return (
    <AdministrationPageShell
      title="Leave Policy"
      description="Leave application and approval logic uses these values automatically."
    >
      {(config) => <LeavePolicyForm key={config.updatedAt} config={config} />}
    </AdministrationPageShell>
  );
}

function LeavePolicyForm({ config }: { config: Configuration }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<LeavePolicy>(() => withLeaveTypeDefaults(config.leavePolicy));

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(config.leavePolicy),
    [draft, config.leavePolicy]
  );

  const mutation = useMutation({
    mutationFn: () => configurationService.updateLeavePolicy(draft),
    onSuccess: (updated) => {
      toast.success("Leave policy updated");
      queryClient.setQueryData(CONFIGURATION_QUERY_KEY, updated);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function updateType(type: LeaveType, patch: Partial<LeaveTypePolicy>) {
    const current = draft.leaveTypeSettings?.[type] ?? defaultTypeSettings(draft, type);
    setDraft({
      ...draft,
      leaveTypeSettings: { ...draft.leaveTypeSettings, [type]: { ...current, ...patch } },
    });
  }

  return (
    <>
      <SettingsSection
        title="Types of Leave"
        description="Entitlement, notice, duration, and carry-forward rules for every leave type."
        contentClassName="gap-0"
      >
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Default Leave</TableHead>
                <TableHead>Monthly Increment</TableHead>
                <TableHead>Advance Notice</TableHead>
                <TableHead>Min–Max Duration</TableHead>
                <TableHead>Carry Forward</TableHead>
                <TableHead>Include Weekends</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveTypeOptions.map(({ value, label }) => {
                const settings = draft.leaveTypeSettings?.[value] ?? defaultTypeSettings(draft, value);
                return (
                  <TableRow key={value}>
                    <TableCell className="font-medium whitespace-nowrap">{label}</TableCell>
                    <TableCell>
                      {value === LEAVE_TYPES.SICK ? (
                        <QuotaInput
                          value={draft.sickQuotaPerHalf}
                          onChange={(sickQuotaPerHalf) => setDraft({ ...draft, sickQuotaPerHalf })}
                          suffix="/ half"
                        />
                      ) : value === LEAVE_TYPES.CASUAL_PAID ? (
                        <QuotaInput
                          value={draft.casualPaidQuotaPerHalf}
                          onChange={(casualPaidQuotaPerHalf) =>
                            setDraft({ ...draft, casualPaidQuotaPerHalf })
                          }
                          suffix="/ half"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {value === LEAVE_TYPES.ANNUAL
                            ? "Accrual-based"
                            : value === LEAVE_TYPES.UNPAID
                              ? "Unlimited"
                              : "Granted manually"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {HAS_MONTHLY_INCREMENT[value] ? (
                        <QuotaInput
                          value={draft.annualAccrualPerMonth}
                          onChange={(annualAccrualPerMonth) =>
                            setDraft({ ...draft, annualAccrualPerMonth })
                          }
                          step={0.25}
                          suffix="/ month"
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <QuotaInput
                        value={settings.advanceNoticeDays}
                        onChange={(advanceNoticeDays) => updateType(value, { advanceNoticeDays })}
                        suffix="day(s)"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          {settings.minDurationDays === null ? (
                            <span className="flex h-8 w-16 items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground">
                              No min
                            </span>
                          ) : (
                            <QuotaInput
                              value={settings.minDurationDays}
                              min={1}
                              onChange={(minDurationDays) => updateType(value, { minDurationDays })}
                            />
                          )}
                          <span className="text-muted-foreground">–</span>
                          <QuotaInput
                            value={settings.maxDurationDays}
                            min={1}
                            onChange={(maxDurationDays) => updateType(value, { maxDurationDays })}
                          />
                        </div>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Checkbox
                            checked={settings.minDurationDays === null}
                            onCheckedChange={(checked) =>
                              updateType(value, {
                                minDurationDays: checked === true ? null : 1,
                              })
                            }
                          />
                          No minimum
                        </label>
                      </div>
                    </TableCell>
                    <TableCell>
                      {HAS_CARRY_FORWARD[value] ? (
                        <Checkbox
                          checked={settings.carryForwardEnabled ?? false}
                          onCheckedChange={(carryForwardEnabled) =>
                            updateType(value, { carryForwardEnabled: carryForwardEnabled === true })
                          }
                        />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Checkbox
                        checked={settings.includeWeekends ?? false}
                        onCheckedChange={(includeWeekends) =>
                          updateType(value, { includeWeekends: includeWeekends === true })
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Check &quot;No minimum&quot; under Min–Max Duration to enforce only a maximum for that
          leave type. Carry Forward applies only to Sick and Casual Leave — unused Jan–Jun days
          carry into Jul–Dec,
          but not further, and Annual Leave never carries into the next year. Include Weekends
          counts weekend days inside the requested range toward that leave&apos;s day total instead
          of skipping them (holidays are always excluded).
        </p>

        <ToggleRow
          id="unpaid-allowed"
          label="Allow Unpaid Leave"
          description="When off, employees cannot apply for unpaid leave."
          checked={draft.unpaidAllowed}
          onCheckedChange={(unpaidAllowed) => setDraft({ ...draft, unpaidAllowed })}
        />
      </SettingsSection>

      <SaveBar
        visible={isDirty}
        isSaving={mutation.isPending}
        onSave={() => mutation.mutate()}
        onDiscard={() => setDraft(withLeaveTypeDefaults(config.leavePolicy))}
      />
    </>
  );
}

function QuotaInput({
  value,
  onChange,
  min = 0,
  step = 1,
  suffix,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        className="w-16"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      {suffix && <span className="text-xs whitespace-nowrap text-muted-foreground">{suffix}</span>}
    </div>
  );
}

function defaultTypeSettings(policy: LeavePolicy, type: LeaveType): LeaveTypePolicy {
  return {
    advanceNoticeDays:
      type === LEAVE_TYPES.CASUAL_PAID
        ? policy.casualPaidNoticeDays
        : type === LEAVE_TYPES.ANNUAL
          ? policy.annualNoticeDays
          : 0,
    minDurationDays: policy.minDurationDays,
    maxDurationDays: policy.maxDurationDays,
    includeWeekends: false,
    // Seed from the legacy shared toggle so splitting it per-type doesn't
    // silently turn Carry Forward off for a type that already relied on it.
    carryForwardEnabled: policy.carryForwardEnabled,
  };
}

function withLeaveTypeDefaults(policy: LeavePolicy): LeavePolicy {
  return {
    ...policy,
    leaveTypeSettings: {
      SICK: defaultTypeSettings(policy, LEAVE_TYPES.SICK),
      CASUAL_PAID: defaultTypeSettings(policy, LEAVE_TYPES.CASUAL_PAID),
      ANNUAL: defaultTypeSettings(policy, LEAVE_TYPES.ANNUAL),
      UNPAID: defaultTypeSettings(policy, LEAVE_TYPES.UNPAID),
      COMP_OFF: defaultTypeSettings(policy, LEAVE_TYPES.COMP_OFF),
      ...policy.leaveTypeSettings,
    },
  };
}
