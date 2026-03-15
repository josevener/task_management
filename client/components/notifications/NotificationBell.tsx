"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Loader2 } from "lucide-react";
import { notificationApi, Notification } from "@/lib/api/notifications";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/lib/toast";

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const { showToast } = useToast();

  const playNotificationSound = () => {
    if (!soundEnabled) return;
    try {
      const audio = new Audio('/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(e => {
        // Browser might block autoplay until user interacts
        console.log("Audio play prevented by browser:", e);
      });
    }
    catch (e) {
      console.log("Could not play sound:", e);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const [notifsRes, countRes] = await Promise.all([
        notificationApi.getNotifications(),
        notificationApi.getUnreadCount(),
      ]);
      if (notifsRes.success && notifsRes.data) setNotifications(notifsRes.data.notifications);
      if (countRes.success && countRes.data) setUnreadCount(countRes.data.count);
    }
    catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Refresh every minute to keep relative timestamps updated
    const interval = setInterval(fetchNotifications, 60000);

    // Set up Server-Sent Events listener for real-time notifications
    const unsubscribe = notificationApi.listenForRealTime((newNotif: Notification) => {
      setNotifications((prev) => [newNotif, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Determine toast type based on notification type
      let toastType: 'info' | 'success' | 'warning' | 'error' = 'info';
      if (newNotif.type === 'task_overdue') {
        toastType = 'warning';
      }
      else if (newNotif.type === 'task_status_changed') {
        toastType = 'success';
      }

      showToast(`${newNotif.title}`, toastType);
      playNotificationSound();
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [showToast, soundEnabled]);

  const handleMarkAsRead = async (id: number) => {
    try {
      const res = await notificationApi.markAsRead(id);
      if (res.success) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    }
    catch (error) {
      console.log("Failed to mark as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await notificationApi.markAllAsRead();
      if (res.success) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    }
    catch (error) {
      console.log("Failed to mark all as read:", error);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative cursor-pointer">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 p-0 text-[10px] text-white"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
              onClick={handleMarkAllAsRead}
            >
              Mark all as read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="h-80">
          {loading && notifications.length === 0 ? (
            <div className="flex h-20 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex h-20 flex-col items-center justify-center text-sm text-muted-foreground">
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "relative flex flex-col gap-1 p-4 transition-colors hover:bg-slate-50",
                    !notification.is_read && "bg-blue-50/50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn(
                      "text-sm font-semibold",
                      !notification.is_read ? "text-blue-900" : "text-slate-900"
                    )}>
                      {notification.title}
                    </p>
                    {!notification.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                        onClick={() => handleMarkAsRead(notification.id)}
                      >
                        <Check className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-slate-600">
                    {notification.message}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                    {notification.project_name && ` • ${notification.project_name}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
