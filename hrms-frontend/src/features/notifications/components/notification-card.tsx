"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { Notification } from "@/types/notification.types";
import { NOTIFICATION_ICON, NOTIFICATION_ICON_COLOR } from "../notification-meta";
import { getNotificationUrl } from "../notification-links";

export function NotificationCard({
  notification,
  onMarkRead,
  onNavigate,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
  /** Called right after navigating — lets a containing panel (e.g. the bell dropdown) close itself. */
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const Icon = NOTIFICATION_ICON[notification.type];
  const url = getNotificationUrl(notification);

  function handleClick() {
    if (!notification.read) onMarkRead(notification.id);
    if (url) {
      router.push(url);
      onNavigate?.();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent",
        !notification.read && "bg-primary/5",
        url ? "cursor-pointer" : "cursor-default"
      )}
    >
      <div className={cn("mt-0.5 shrink-0", NOTIFICATION_ICON_COLOR[notification.type])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium">{notification.title}</span>
          {!notification.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />}
        </div>
        <p className="text-sm text-muted-foreground">{notification.message}</p>
        <span className="text-xs text-muted-foreground">
          {formatRelativeTime(notification.createdAt)}
        </span>
      </div>
    </button>
  );
}
