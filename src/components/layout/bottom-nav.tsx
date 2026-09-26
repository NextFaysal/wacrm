"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTotalUnread } from "@/hooks/use-total-unread";
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingBag,
  Users,
  Menu,
} from "lucide-react";

interface BottomNavProps {
  onOpenMenu: () => void;
}

export function BottomNav({ onOpenMenu }: BottomNavProps) {
  const pathname = usePathname();
  const totalUnread = useTotalUnread();

  const navItems = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      isActive: pathname === "/dashboard",
    },
    {
      href: "/inbox",
      label: "Inbox",
      icon: MessageSquare,
      badge: totalUnread > 0 ? totalUnread : undefined,
      isActive: pathname.startsWith("/inbox"),
    },
    {
      href: "/orders",
      label: "Orders",
      icon: ShoppingBag,
      isActive: pathname.startsWith("/orders"),
    },
    {
      href: "/contacts",
      label: "Contacts",
      icon: Users,
      isActive: pathname.startsWith("/contacts"),
    },
  ];

  return (
    <nav
      aria-label="Mobile Navigation"
      className="fixed bottom-0 inset-x-0 z-40 block border-t border-border/70 bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur-xl lg:hidden data-[hidden=true]:hidden"
      id="wacrm-mobile-bottom-nav"
    >
      <div className="flex h-15 items-center justify-around px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-center transition-colors",
                item.isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon className={cn("h-5 w-5", item.isActive && "scale-105")} />
                {item.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-sm">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>
              {item.isActive && (
                <span className="absolute bottom-0.5 h-0.5 w-6 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}

        {/* More / Menu trigger button */}
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open More Menu"
          className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 text-center text-muted-foreground transition-colors hover:text-foreground active:scale-95"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] tracking-tight">More</span>
        </button>
      </div>
    </nav>
  );
}
