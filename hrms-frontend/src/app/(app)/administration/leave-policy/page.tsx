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
import { NumberInput } from "@/features/administration/components/number-input";
import { ToggleRow } from "@/features/administration/components/toggle-row";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Settings2 } from "lucide-react";
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
  const [editingType, setEditingType] = useState<LeaveType | null>(null);

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

  return (
    <>
      <SettingsSection
        title="Leave Type Settings"
        description="Set advance notice and duration limits independently for every leave type."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {leaveTypeOptions.map(({ value, label }, index) => {
            const settings = draft.leaveTypeSettings?.[value];
            return (
              <div key={value} className="group flex items-center justify-between gap-4 rounded-xl border bg-muted/20 p-4 transition-colors hover:bg-muted/40">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${[
                    "bg-sky-500/15 text-sky-600",
                    "bg-emerald-500/15 text-emerald-600",
                    "bg-violet-500/15 text-violet-600",
                    "bg-amber-500/15 text-amber-600",
                    "bg-rose-500/15 text-rose-600",
                  ][index]}`}>
                    <Check className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{label}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {settings?.advanceNoticeDays ?? 0} day(s) notice, {settings?.minDurationDays ?? 1}–{settings?.maxDurationDays ?? 30} working day(s)
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="shrink-0" onClick={() => setEditingType(value)}>
                  <Settings2 />
                  Settings
                </Button>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="Leave Quotas" description="Set the recurring entitlement and accrual rules used by the leave balance engine.">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberInput
            id="sick-quota"
            label="Sick Leave Quota (per half-year)"
            suffix="days / half"
            value={draft.sickQuotaPerHalf}
            min={0}
            max={180}
            onChange={(sickQuotaPerHalf) => setDraft({ ...draft, sickQuotaPerHalf })}
          />
          <NumberInput
            id="casual-quota"
            label="Casual Leave Quota (per half-year)"
            suffix="days / half"
            value={draft.casualPaidQuotaPerHalf}
            min={0}
            max={180}
            onChange={(casualPaidQuotaPerHalf) => setDraft({ ...draft, casualPaidQuotaPerHalf })}
          />
          <NumberInput
            id="annual-accrual"
            label="Annual Leave Accrual"
            suffix="days / no-leave month"
            value={draft.annualAccrualPerMonth}
            min={0}
            max={10}
            step={0.25}
            onChange={(annualAccrualPerMonth) => setDraft({ ...draft, annualAccrualPerMonth })}
          />
        </div>
        <ToggleRow
          id="unpaid-allowed"
          label="Allow Unpaid Leave"
          description="When off, employees cannot apply for unpaid leave."
          checked={draft.unpaidAllowed}
          onCheckedChange={(unpaidAllowed) => setDraft({ ...draft, unpaidAllowed })}
        />
        <ToggleRow
          id="carry-forward"
          label="Carry Forward Unused Leave"
          description="When on, Sick and Casual Leave days left unused in Jan–Jun carry into the Jul–Dec half. They don't carry further than that, and unused Annual Leave days never carry into the next year."
          checked={draft.carryForwardEnabled}
          onCheckedChange={(carryForwardEnabled) => setDraft({ ...draft, carryForwardEnabled })}
        />
      </SettingsSection>

      <LeaveTypeSettingsDialog
        type={editingType}
        settings={editingType ? draft.leaveTypeSettings?.[editingType] : undefined}
        onOpenChange={(open) => !open && setEditingType(null)}
        onChange={(settings) => {
          if (!editingType) return;
          setDraft({
            ...draft,
            leaveTypeSettings: { ...draft.leaveTypeSettings, [editingType]: settings },
          });
        }}
      />

      <SaveBar
        visible={isDirty}
        isSaving={mutation.isPending}
        onSave={() => mutation.mutate()}
        onDiscard={() => setDraft(config.leavePolicy)}
      />
    </>
  );
}

function withLeaveTypeDefaults(policy: LeavePolicy): LeavePolicy {
  const defaults: LeaveTypePolicy = {
    advanceNoticeDays: 0,
    minDurationDays: policy.minDurationDays,
    maxDurationDays: policy.maxDurationDays,
  };
  return {
    ...policy,
    leaveTypeSettings: {
      SICK: { ...defaults },
      CASUAL_PAID: { ...defaults, advanceNoticeDays: policy.casualPaidNoticeDays },
      ANNUAL: { ...defaults, advanceNoticeDays: policy.annualNoticeDays },
      UNPAID: { ...defaults },
      COMP_OFF: { ...defaults },
      ...policy.leaveTypeSettings,
    },
  };
}

function LeaveTypeSettingsDialog({
  type,
  settings,
  onOpenChange,
  onChange,
}: {
  type: LeaveType | null;
  settings?: LeaveTypePolicy;
  onOpenChange: (open: boolean) => void;
  onChange: (settings: LeaveTypePolicy) => void;
}) {
  const label = leaveTypeOptions.find((option) => option.value === type)?.label;
  const current = settings ?? { advanceNoticeDays: 0, minDurationDays: 1, maxDurationDays: 30 };

  return (
    <Dialog open={type !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{label} Settings</DialogTitle>
          <DialogDescription>Set the rules employees must meet when applying for this leave.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <NumberInput
            id="leave-advance-notice"
            label="Advance Notice"
            suffix="day(s)"
            value={current.advanceNoticeDays}
            min={0}
            max={365}
            onChange={(advanceNoticeDays) => onChange({ ...current, advanceNoticeDays })}
          />
          <NumberInput
            id="leave-min-duration"
            label="Minimum Duration"
            suffix="working day(s)"
            value={current.minDurationDays}
            min={1}
            max={365}
            onChange={(minDurationDays) => onChange({ ...current, minDurationDays })}
          />
          <NumberInput
            id="leave-max-duration"
            label="Maximum Duration"
            suffix="working day(s)"
            value={current.maxDurationDays}
            min={1}
            max={365}
            onChange={(maxDurationDays) => onChange({ ...current, maxDurationDays })}
          />
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}
