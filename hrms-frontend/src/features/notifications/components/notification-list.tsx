"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import * as notificationService from "@/services/notification.service";
import { Notification } from "@/types/notification.types";
import { NotificationCard } from "./notification-card";

const PAGE_SIZE = 15;

export function NotificationList({ onNavigate }: { onNavigate?: () => void } = {}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [accumulated, setAccumulated] = useState<Notification[]>([]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["notifications", page],
    queryFn: () =>
      notificationService.listNotifications({ page, limit: PAGE_SIZE }).then((res) => {
        const result = res.data;
        setAccumulated((prev) => (page === 1 ? result.notifications : [...prev, ...result.notifications]));
        return result;
      }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: (_res, id) => {
      setAccumulated((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      setAccumulated((prev) => prev.map((n) => ({ ...n, read: true })));
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const hasMore = data ? data.pagination.page < data.pagination.totalPages : false;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <span className="text-sm text-muted-foreground">
          {data ? `${data.unreadCount} unread` : ""}
        </span>
        <Button
          variant="ghost"
          size="sm"
          disabled={markAllReadMutation.isPending || (data?.unreadCount ?? 0) === 0}
          onClick={() => markAllReadMutation.mutate()}
        >
          Mark all read
        </Button>
      </div>

      <div className="flex flex-col gap-1">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="flex items-start gap-3 p-3">
              <Skeleton className="h-4 w-4 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          ))}

        {!isLoading && accumulated.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <BellOff className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="text-sm text-muted-foreground">You&apos;re all caught up.</p>
          </div>
        )}

        {!isLoading &&
          accumulated.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              onMarkRead={(id) => markReadMutation.mutate(id)}
              onNavigate={onNavigate}
            />
          ))}
      </div>

      {hasMore && (
        <Button
          variant="outline"
          size="sm"
          disabled={isFetching}
          onClick={() => setPage((p) => p + 1)}
        >
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Load more
        </Button>
      )}
    </div>
  );
}
