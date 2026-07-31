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
import * as configurationService from "@/services/configuration.service";
import { Configuration, NotificationSettings } from "@/types/configuration.types";

const EVENT_LABELS: Record<keyof NotificationSettings["events"], string> = {
  LEAVE_APPLIED: "Leave Applied",
  LEAVE_APPROVED: "Leave Approved",
  LEAVE_REJECTED: "Leave Rejected",
  ATTENDANCE_CORRECTION: "Attendance Correction Reviewed",
  HOLIDAY_ADDED: "Holiday Added",
  ANNOUNCEMENT_PUBLISHED: "Announcement Published",
  EMPLOYEE_CREATED: "Employee Created",
  BIRTHDAY: "Birthday",
  WORK_ANNIVERSARY: "Work Anniversary",
  PROBATION_ENDING: "Probation Ending",
};

export default function NotificationSettingsPage() {
  return (
    <AdministrationPageShell
      title="Notification Settings"
      description="Control which events generate notifications. Email sending isn't implemented yet — this only stores the preference."
    >
      {(config) => <NotificationSettingsForm key={config.updatedAt} config={config} />}
    </AdministrationPageShell>
  );
}

function NotificationSettingsForm({ config }: { config: Configuration }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<NotificationSettings>(config.notificationSettings);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(config.notificationSettings),
    [draft, config.notificationSettings]
  );

  const mutation = useMutation({
    mutationFn: () => configurationService.updateNotificationSettings(draft),
    onSuccess: (updated) => {
      toast.success("Notification settings updated");
      queryClient.setQueryData(CONFIGURATION_QUERY_KEY, updated);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <>
      <SettingsSection title="Channels">
        <ToggleRow
          id="in-app-enabled"
          label="In-App Notifications"
          checked={draft.inAppEnabled}
          onCheckedChange={(inAppEnabled) => setDraft({ ...draft, inAppEnabled })}
        />
        <ToggleRow
          id="email-enabled"
          label="Email Notifications"
          description="Configuration only — email delivery is not implemented yet."
          checked={draft.emailEnabled}
          onCheckedChange={(emailEnabled) => setDraft({ ...draft, emailEnabled })}
        />
      </SettingsSection>

      <SettingsSection title="Per-Event Preferences">
        {(Object.keys(EVENT_LABELS) as (keyof NotificationSettings["events"])[]).map((key) => (
          <ToggleRow
            key={key}
            id={`event-${key}`}
            label={EVENT_LABELS[key]}
            checked={draft.events[key]}
            onCheckedChange={(checked) =>
              setDraft({ ...draft, events: { ...draft.events, [key]: checked } })
            }
          />
        ))}
      </SettingsSection>

      <SaveBar
        visible={isDirty}
        isSaving={mutation.isPending}
        onSave={() => mutation.mutate()}
        onDiscard={() => setDraft(config.notificationSettings)}
      />
    </>
  );
}
