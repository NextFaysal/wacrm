"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { Bell, BellOff, LogOut, Menu, Search, Settings as SettingsIcon, User, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { isSoundEnabled, setSoundEnabled, playSound } from "@/lib/sound/sound-fx";
import { useBrowserNotifyPref } from "@/hooks/use-browser-notifications";
import { writeBrowserNotifyPref } from "@/lib/notifications/browser-notify";
import { subscribeToPush, unsubscribeFromPush } from "@/lib/notifications/push-client";
import { useState, useEffect } from "react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/layout/mode-toggle";

const pageTitles: Record<string, string> = {
  "/dashboard": "dashboard",
  "/inbox": "inbox",
  "/orders": "orders",
  "/products": "products",
  "/analytics": "analytics",
  "/notifications": "notifications",
  "/contacts": "contacts",
  "/pipelines": "pipelines",
  "/broadcasts": "broadcasts",
  "/automations": "automations",
  "/flows": "flows",
  "/agents": "aiAgents",
  "/settings": "settings",
};

function getPageTitleKey(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  const match = Object.entries(pageTitles).find(([path]) =>
    pathname.startsWith(path),
  );
  return match ? match[1] : "dashboard";
}

interface HeaderProps {
  /** Wired to the shell's drawer state. Used only on mobile — the
   *  hamburger button is hidden on lg+. */
  onOpenSidebar?: () => void;
  /** Opens the command palette (Cmd+K) modal */
  onOpenCommandPalette?: () => void;
}

import { useTranslations } from "next-intl";

export function Header({ onOpenSidebar, onOpenCommandPalette }: HeaderProps) {
  const t = useTranslations("Header");
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const titleKey = getPageTitleKey(pathname);

  const initial =
    profile?.full_name?.charAt(0)?.toUpperCase() ??
    profile?.email?.charAt(0)?.toUpperCase() ??
    "U";

  const [soundActive, setSoundActive] = useState(true);
  useEffect(() => {
    setSoundActive(isSoundEnabled());
  }, []);

  const toggleSound = () => {
    const next = !soundActive;
    setSoundActive(next);
    setSoundEnabled(next);
    if (next) playSound("incoming");
  };

  const desktopNotifyEnabled = useBrowserNotifyPref();
  const toggleDesktopNotifications = async () => {
    if (!desktopNotifyEnabled) {
      if (typeof window === "undefined" || !("Notification" in window)) {
        toast.error("Notifications not supported in this browser");
        return;
      }
      try {
        const res = await Notification.requestPermission();
        if (res === "granted") {
          writeBrowserNotifyPref(true);
          void subscribeToPush();
          playSound("incoming");
          toast.success("Desktop & push notifications enabled!");
        } else {
          writeBrowserNotifyPref(false);
          toast.error("Notifications blocked by browser settings");
        }
      } catch {
        toast.error("Could not request notification permissions");
      }
    } else {
      writeBrowserNotifyPref(false);
      void unsubscribeFromPush();
      toast.info("Desktop notifications turned off");
    }
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-3.5 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {/* Hamburger — mobile only */}
        <button
          type="button"
          onClick={onOpenSidebar}
          aria-label={t("openMenu")}
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
          {t(titleKey as string)}
        </h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Command palette search trigger */}
        {onOpenCommandPalette && (
          <>
            {/* Desktop search pill */}
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="hidden items-center gap-2 rounded-xl border border-border/80 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-muted/70 hover:text-foreground sm:flex"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search or jump to...</span>
              <kbd className="ml-1 rounded border border-border bg-card px-1 py-0.5 text-[10px] font-semibold">
                Ctrl K
              </kbd>
            </button>

            {/* Mobile search icon */}
            <button
              type="button"
              onClick={onOpenCommandPalette}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
            >
              <Search className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Audio notification sound toggle */}
        <button
          type="button"
          onClick={toggleSound}
          aria-label={soundActive ? "Mute audio notifications" : "Enable audio notifications"}
          title={soundActive ? "Sound notifications: ON (Click to mute)" : "Sound notifications: MUTED (Click to unmute)"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
        >
          {soundActive ? (
            <Volume2 className="h-4 w-4 text-primary" />
          ) : (
            <VolumeX className="h-4 w-4 text-muted-foreground/60" />
          )}
        </button>

        {/* Web Push / Desktop Notification toggle */}
        <button
          type="button"
          onClick={toggleDesktopNotifications}
          aria-label={desktopNotifyEnabled ? "Disable desktop & push notifications" : "Enable desktop & push notifications"}
          title={desktopNotifyEnabled ? "Desktop notifications: ACTIVE (Click to turn off)" : "Desktop notifications: OFF (Click to turn on)"}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95"
        >
          {desktopNotifyEnabled ? (
            <Bell className="h-4 w-4 text-primary" />
          ) : (
            <BellOff className="h-4 w-4 text-muted-foreground/60" />
          )}
        </button>

        <ModeToggle />

        <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-muted/70 focus:bg-muted/70 focus:outline-none data-popup-open:bg-muted/70 sm:gap-3 sm:pl-1 sm:pr-3"
          aria-label={t("openAccountMenu")}
        >
          <Avatar className="size-8">
            {profile?.avatar_url ? (
              <AvatarImage
                src={profile.avatar_url}
                alt={profile.full_name ?? t("defaultAvatar")}
              />
            ) : null}
            <AvatarFallback className="bg-primary/10 text-sm font-medium text-primary">
              {initial}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium text-foreground sm:inline">
            {profile?.full_name ?? t("defaultUser")}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="min-w-56 bg-popover text-popover-foreground ring-border"
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-sm font-medium text-foreground">
              {profile?.full_name ?? t("defaultUser")}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {profile?.email ?? ""}
            </p>
          </div>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            render={
              <Link
                href="/settings?tab=profile"
                className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
              />
            }
          >
            <User className="size-4" />
            {t("menuProfile")}
          </DropdownMenuItem>
          <DropdownMenuItem
            render={
              <Link
                href="/settings?tab=whatsapp"
                className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
              />
            }
          >
            <SettingsIcon className="size-4" />
            {t("menuSettings")}
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-border" />
          <DropdownMenuItem
            onClick={signOut}
            className="text-popover-foreground focus:bg-accent focus:text-accent-foreground"
          >
            <LogOut className="size-4" />
            {t("menuSignOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
