"use client";

import { Bell } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ShellNotification } from "@/lib/data/shell";
import { formatDate } from "@/lib/format";

function NotificationsBell({ notifications }: { notifications: ShellNotification[] }) {
  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          className="relative"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell aria-hidden className="size-5" />
          {unread ? <Badge className="absolute -top-0.5 -right-0.5 min-w-4 px-1 py-0.5">{unread}</Badge> : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="type-small px-3 py-4 text-content-muted">Your notifications will appear here.</p>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem key={notification.id} className="flex-col items-start gap-0.5">
              <span className={notification.readAt ? "" : "font-semibold"}>
                {notification.title}
                {notification.readAt ? null : <span className="sr-only"> (unread)</span>}
              </span>
              {notification.body ? (
                <span className="type-small text-content-muted">{notification.body}</span>
              ) : null}
              <span className="type-small text-content-muted">{formatDate(notification.createdAt)}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { NotificationsBell };
