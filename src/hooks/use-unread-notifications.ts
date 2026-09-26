"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Notification } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Shared singleton store for unread notifications count.
 * Prevents duplicate channel subscriptions across re-renders or multiple consumers.
 */

let currentCount = 0;
const listeners = new Set<() => void>();
let channel: RealtimeChannel | null = null;

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

async function fetchUnreadCount() {
  try {
    const supabase = createClient();
    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .is("read_at", null);
    if (error) return;
    currentCount = count ?? 0;
    notifyListeners();
  } catch (err) {
    console.warn("[useUnreadNotifications] fetch error:", err);
  }
}

function startSubscription() {
  if (channel) return;

  const supabase = createClient();
  void fetchUnreadCount();

  const channelName = `notifications-count-${Math.random().toString(36).slice(2, 8)}`;
  channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "notifications" },
      (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as Notification;
          if (!row.read_at) {
            currentCount += 1;
            notifyListeners();
          }
        } else if (payload.eventType === "UPDATE") {
          const newRow = payload.new as Notification;
          if (newRow.read_at) {
            currentCount = Math.max(0, currentCount - 1);
            notifyListeners();
          }
        } else if (payload.eventType === "DELETE") {
          const oldRow = payload.old as Partial<Notification>;
          if (!oldRow.read_at) {
            currentCount = Math.max(0, currentCount - 1);
            notifyListeners();
          }
        }
      }
    )
    .subscribe();
}

function stopSubscription() {
  if (channel) {
    const supabase = createClient();
    supabase.removeChannel(channel);
    channel = null;
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  if (listeners.size === 1) {
    startSubscription();
  }
  return () => {
    listeners.delete(callback);
    if (listeners.size === 0) {
      stopSubscription();
    }
  };
}

function getSnapshot() {
  return currentCount;
}

const serverSnapshot = () => 0;

export function useUnreadNotifications(): number {
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
}
