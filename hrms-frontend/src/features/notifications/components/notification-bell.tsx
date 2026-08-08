"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import * as notificationService from "@/services/notification.service";
import { NotificationList } from "./notification-list";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: () => notificationService.getUnreadCount().then((res) => res.data.count),
  });

  const count = data ?? 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Notifications${count > 0 ? `, ${count} unread` : ""}`}
            className="relative"
          />
        }
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium text-white">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <NotificationList onNavigate={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
