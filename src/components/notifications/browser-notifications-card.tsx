"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Check, ExternalLink, Send, ShieldAlert, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { playSound } from "@/lib/sound/sound-fx";
import { useBrowserNotifyPref } from "@/hooks/use-browser-notifications";
import {
  getNotificationPermission,
  writeBrowserNotifyPref,
} from "@/lib/notifications/browser-notify";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/notifications/push-client";

export function BrowserNotificationsCard() {
  const t = useTranslations("Settings.browserNotifications");
  const enabled = useBrowserNotifyPref();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermission());
  }, [enabled]);

  const handleToggle = async (nextState: boolean) => {
    if (nextState) {
      if (typeof window === "undefined" || !("Notification" in window)) {
        toast.error(t("unsupported"));
        return;
      }

      try {
        const res = await Notification.requestPermission();
        setPermission(res);
        if (res === "granted") {
          writeBrowserNotifyPref(true);
          void subscribeToPush();
          playSound("incoming");
          toast.success(t("statusGranted"));
        } else {
          writeBrowserNotifyPref(false);
          toast.error(t("permissionDeniedToast"));
        }
      } catch (err) {
        console.error("Failed to request notification permission:", err);
        toast.error(t("permissionDeniedToast"));
      }
    } else {
      writeBrowserNotifyPref(false);
      void unsubscribeFromPush();
      toast.info("Notifications turned off for this browser.");
    }
  };

  const handleSendTest = () => {
    setTesting(true);
    playSound("incoming");

    try {
      if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
        navigator.serviceWorker.ready
          .then((reg) => {
            return reg.showNotification(t("testTitle"), {
              body: t("testBody"),
              icon: "/icon-192.png",
              badge: "/icon-192.png",
            });
          })
          .catch(() => {
            new Notification(t("testTitle"), {
              body: t("testBody"),
              icon: "/icon-192.png",
            });
          });
      } else if (typeof Notification !== "undefined") {
        new Notification(t("testTitle"), {
          body: t("testBody"),
          icon: "/icon-192.png",
        });
      }
      toast.success("Test notification sent!");
    } catch {
      toast.error("Could not trigger notification.");
    } finally {
      setTimeout(() => setTesting(false), 1000);
    }
  };

  const isDenied = permission === "denied";
  const isGranted = permission === "granted";
  const isUnsupported = permission === "unsupported";

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-xs transition-all">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {enabled && isGranted ? (
              <Bell className="h-5 w-5" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-foreground">
                {t("title")}
              </h3>
              {enabled && isGranted && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="h-3 w-3" /> Live
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed max-w-xl">
              {t("description")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <Switch
            checked={enabled && isGranted}
            disabled={isUnsupported || isDenied}
            onCheckedChange={handleToggle}
            aria-label={t("toggleLabel")}
          />
        </div>
      </div>

      {/* Permission diagnostics banner */}
      <div className="mt-4 pt-4 border-t border-border/60">
        {isDenied ? (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive flex items-start gap-2.5">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{t("statusDenied")}</p>
              <p className="mt-0.5 text-muted-foreground">{t("deniedHint")}</p>
            </div>
          </div>
        ) : isUnsupported ? (
          <p className="text-xs text-muted-foreground">{t("unsupported")}</p>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {isGranted ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  {t("statusGranted")}
                </span>
              ) : (
                <span>{t("statusDefault")}</span>
              )}
            </div>

            {isGranted && enabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSendTest}
                disabled={testing}
                className="h-8 gap-1.5 text-xs shadow-2xs self-start sm:self-auto"
              >
                <Send className="h-3.5 w-3.5 text-primary" />
                {t("sendTest")}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
