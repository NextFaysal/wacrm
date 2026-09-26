"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Conversation } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Shared singleton store for total unread conversations count.
 *
 * Why singleton store:
 * Both Sidebar and BottomNav (and any other chrome component) need the
 * unread count simultaneously. Multiple instances of useTotalUnread()
 * subscribing to the same hardcoded Supabase channel causes
 * `cannot add postgres_changes callbacks after subscribe()` errors.
 * Using useSyncExternalStore ensures:
 *   1. Exactly ONE Supabase Realtime channel is maintained.
 *   2. Zero duplicate network requests or WebSocket subscriptions.
 *   3. All UI components stay in sync with zero latency.
 */

let currentTotal = 0;
const counts = new Map<string, number>();
const listeners = new Set<() => void>();
let channel: RealtimeChannel | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

async function fetchTotal() {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("conversations")
      .select("id, unread_count");
    if (error || !data) return;

    counts.clear();
    let sum = 0;
    for (const row of data as { id: string; unread_count: number }[]) {
      const n = row.unread_count ?? 0;
      counts.set(row.id, n);
      if (n > 0) sum += 1;
    }
    currentTotal = sum;
    notifyListeners();
  } catch (err) {
    console.warn("[useTotalUnread] fetchTotal error:", err);
  }
}

function startSubscription() {
  if (channel) return;

  const supabase = createClient();
  void fetchTotal();

  pollTimer = setInterval(() => {
    if (typeof document !== "undefined" && document.visibilityState === "visible") {
      void fetchTotal();
    }
  }, 10000);

  const channelName = `total-unread-${Math.random().toString(36).slice(2, 8)}`;
  channel = supabase
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "conversations" },
      (payload) => {
        if (payload.eventType === "DELETE") {
          const oldRow = payload.old as Partial<Conversation>;
          if (oldRow.id) counts.delete(oldRow.id);
        } else {
          const row = payload.new as Conversation;
          counts.set(row.id, row.unread_count ?? 0);
        }
        let sum = 0;
        for (const n of counts.values()) if (n > 0) sum += 1;
        currentTotal = sum;
        notifyListeners();
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
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
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
  return currentTotal;
}

const serverSnapshot = () => 0;

export function useTotalUnread(): number {
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
}
