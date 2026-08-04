"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useAppData } from "@/lib/context/data-context";
import { cn, timeAgo } from "@/lib/utils";
import type { NotificationAudience } from "@/lib/types";

export function NotificationBell({ userId, audience }: { userId: string; audience: NotificationAudience }) {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useAppData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const mine = notifications
    .filter((n) => n.userId === userId && n.audience === audience)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const unread = mine.filter((n) => !n.read).length;

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl text-navy-500 hover:bg-navy-100"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-brand ring-2 ring-white" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[90vw] animate-scale-in rounded-2xl border border-navy-100 bg-white shadow-card-hover">
          <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
            <p className="font-display text-sm font-semibold text-navy-900">Notifications</p>
            {unread > 0 && (
              <button
                onClick={() => markAllNotificationsRead(userId)}
                className="text-xs font-medium text-brand hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {mine.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-navy-400">You&apos;re all caught up.</p>
            ) : (
              mine.slice(0, 12).map((n) => {
                const body = (
                  <div
                    className={cn(
                      "cursor-pointer border-b border-navy-50 px-4 py-3 last:border-0 hover:bg-navy-50",
                      !n.read && "bg-brand-50/40",
                    )}
                    onClick={() => markNotificationRead(n.id)}
                  >
                    <p className="text-sm font-medium text-navy-900">{n.title}</p>
                    <p className="mt-0.5 text-xs text-navy-500">{n.body}</p>
                    <p className="mt-1 text-[11px] text-navy-350 text-navy-400">{timeAgo(n.createdAt)}</p>
                  </div>
                );
                return n.link ? (
                  <Link key={n.id} href={n.link}>
                    {body}
                  </Link>
                ) : (
                  <div key={n.id}>{body}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
