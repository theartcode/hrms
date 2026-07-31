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
import { TimePicker } from "@/features/administration/components/time-picker";
import { NumberInput } from "@/features/administration/components/number-input";
import { WeekdaySelector } from "@/features/administration/components/weekday-selector";
import * as configurationService from "@/services/configuration.service";
import { Configuration, OfficeSettings } from "@/types/configuration.types";

export default function OfficeSettingsPage() {
  return (
    <AdministrationPageShell
      title="Office Settings"
      description="Attendance calculations use these values automatically — no restart required."
    >
      {(config) => <OfficeSettingsForm key={config.updatedAt} config={config} />}
    </AdministrationPageShell>
  );
}

function OfficeSettingsForm({ config }: { config: Configuration }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<OfficeSettings>(config.officeSettings);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(config.officeSettings),
    [draft, config.officeSettings]
  );

  const overlap = draft.workingDays.some((d) => draft.weekendDays.includes(d));
  const coversAllDays = new Set([...draft.workingDays, ...draft.weekendDays]).size === 7;
  const isValid = !overlap && coversAllDays;

  const mutation = useMutation({
    mutationFn: () => configurationService.updateOfficeSettings(draft),
    onSuccess: (updated) => {
      toast.success("Office settings updated");
      queryClient.setQueryData(CONFIGURATION_QUERY_KEY, updated);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <SettingsSection title="Office Hours">
        <div className="grid gap-4 sm:grid-cols-2">
          <TimePicker
            id="office-start-time"
            label="Office Start Time"
            value={draft.startTime}
            onChange={(startTime) => setDraft({ ...draft, startTime })}
          />
          <TimePicker
            id="office-end-time"
            label="Office End Time"
            value={draft.endTime}
            onChange={(endTime) => setDraft({ ...draft, endTime })}
          />
        </div>
        <NumberInput
          id="grace-period"
          label="Grace Period"
          suffix="minutes"
          value={draft.gracePeriodMinutes}
          min={0}
          max={120}
          onChange={(gracePeriodMinutes) => setDraft({ ...draft, gracePeriodMinutes })}
          description="Check-ins within this window after start time still count as On Time."
        />
        <NumberInput
          id="default-probation-months"
          label="Default Probation Period"
          suffix="months"
          value={draft.defaultProbationMonths}
          min={0}
          max={24}
          onChange={(defaultProbationMonths) => setDraft({ ...draft, defaultProbationMonths })}
          description="Auto-fills a new employee's probation end date (joining date + this many months). Editable per employee afterward."
        />
      </SettingsSection>

      <SettingsSection title="Working Week">
        <WeekdaySelector
          label="Working Days"
          value={draft.workingDays}
          onChange={(workingDays) => setDraft({ ...draft, workingDays })}
        />
        <WeekdaySelector
          label="Weekend Days"
          value={draft.weekendDays}
          onChange={(weekendDays) => setDraft({ ...draft, weekendDays })}
        />
        {!isValid && (
          <p className="text-sm text-destructive">
            Working days and weekend days must together cover all 7 days with no overlap.
          </p>
        )}
      </SettingsSection>

      <SaveBar
        visible={isDirty}
        isSaving={mutation.isPending}
        onSave={() => isValid && mutation.mutate()}
        onDiscard={() => setDraft(config.officeSettings)}
      />
    </>
  );
}
