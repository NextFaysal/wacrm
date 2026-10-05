"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LayoutDashboard,
  MessageSquare,
  ShoppingBag,
  Package,
  TrendingUp,
  Bell,
  Users,
  GitBranch,
  Radio,
  Zap,
  Workflow,
  Bot,
  Settings,
  Search,
  Sun,
  Moon,
  Palette,
  ExternalLink,
  PlusCircle,
  PackagePlus,
  Send,
  UserPlus,
  Sparkles,
  Command as CommandIcon,
  CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandItem {
  id: string;
  category: "Navigation" | "Actions" | "Theme";
  title: string;
  subtitle?: string;
  icon: typeof LayoutDashboard;
  keywords?: string[];
  action: () => void;
  badge?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Global shortcut Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const navigate = useCallback(
    (path: string) => {
      onOpenChange(false);
      router.push(path);
    },
    [router, onOpenChange]
  );

  const setThemeMode = useCallback((mode: "light" | "dark") => {
    document.documentElement.dataset.mode = mode;
    try {
      localStorage.setItem("wacrm.mode", mode);
      localStorage.setItem("wacrm:theme:mode", mode);
    } catch {}
    onOpenChange(false);
  }, [onOpenChange]);

  const setThemeAccent = useCallback((accent: string) => {
    document.documentElement.dataset.theme = accent;
    try {
      localStorage.setItem("wacrm.theme", accent);
      localStorage.setItem("wacrm:theme:accent", accent);
    } catch {}
    onOpenChange(false);
  }, [onOpenChange]);

  const items: CommandItem[] = useMemo(() => [
    // Navigation
    {
      id: "nav-dashboard",
      category: "Navigation",
      title: "Dashboard",
      subtitle: "Overview, metrics & live activity",
      icon: LayoutDashboard,
      action: () => navigate("/dashboard"),
    },
    {
      id: "nav-inbox",
      category: "Navigation",
      title: "Shared Inbox",
      subtitle: "WhatsApp chats, customer queries & agent replies",
      icon: MessageSquare,
      action: () => navigate("/inbox"),
    },
    {
      id: "nav-orders",
      category: "Navigation",
      title: "Orders & Sales",
      subtitle: "Order management, courier dispatch & invoices",
      icon: ShoppingBag,
      action: () => navigate("/orders"),
    },
    {
      id: "nav-products",
      category: "Navigation",
      title: "Products & Inventory",
      subtitle: "Product catalog, variants, and stock",
      icon: Package,
      action: () => navigate("/products"),
    },
    {
      id: "nav-analytics",
      category: "Navigation",
      title: "Sales & Analytics",
      subtitle: "Revenue, profit, and conversion reports",
      icon: TrendingUp,
      action: () => navigate("/analytics"),
    },
    {
      id: "nav-contacts",
      category: "Navigation",
      title: "Contacts & Customers",
      subtitle: "Customer directory, tags & custom fields",
      icon: Users,
      action: () => navigate("/contacts"),
    },
    {
      id: "nav-pipelines",
      category: "Navigation",
      title: "Sales Pipelines (Kanban)",
      subtitle: "Deals, stages, and sales pipeline",
      icon: GitBranch,
      action: () => navigate("/pipelines"),
    },
    {
      id: "nav-broadcasts",
      category: "Navigation",
      title: "WhatsApp Broadcasts",
      subtitle: "Bulk campaigns, delivery & read metrics",
      icon: Radio,
      action: () => navigate("/broadcasts"),
    },
    {
      id: "nav-automations",
      category: "Navigation",
      title: "Automations",
      subtitle: "Triggers, keyword replies & webhooks",
      icon: Zap,
      action: () => navigate("/automations"),
    },
    {
      id: "nav-flows",
      category: "Navigation",
      title: "Visual Flow Builder",
      subtitle: "Node-based visual automation editor",
      icon: Workflow,
      badge: "Beta",
      action: () => navigate("/flows"),
    },
    {
      id: "nav-agents",
      category: "Navigation",
      title: "AI Agents",
      subtitle: "Auto-reply bot, AI drafts & knowledge base",
      icon: Bot,
      action: () => navigate("/agents"),
    },
    {
      id: "nav-notifications",
      category: "Navigation",
      title: "Notifications",
      subtitle: "System alerts & customer activity",
      icon: Bell,
      action: () => navigate("/notifications"),
    },
    {
      id: "nav-settings",
      category: "Navigation",
      title: "Settings",
      subtitle: "WhatsApp API, Courier keys, Team members & profile",
      icon: Settings,
      action: () => navigate("/settings"),
    },

    // Quick Actions
    {
      id: "action-broadcast-new",
      category: "Actions",
      title: "Create WhatsApp Broadcast",
      subtitle: "Draft a new campaign to target contacts",
      icon: Send,
      action: () => navigate("/broadcasts/new"),
    },
    {
      id: "action-automation-new",
      category: "Actions",
      title: "Create Automation Rule",
      subtitle: "Set up auto-responder or workflow",
      icon: Zap,
      action: () => navigate("/automations/new"),
    },
    {
      id: "action-settings-courier",
      category: "Actions",
      title: "Configure Steadfast & Pathao Courier",
      subtitle: "API credentials and delivery rate settings",
      icon: ShoppingBag,
      action: () => navigate("/settings?tab=courier"),
    },
    {
      id: "action-settings-ai",
      category: "Actions",
      title: "Configure AI & Knowledge Base",
      subtitle: "OpenAI/Claude API keys & training docs",
      icon: Sparkles,
      action: () => navigate("/settings?tab=ai"),
    },

    // Themes & Appearance
    {
      id: "theme-dark",
      category: "Theme",
      title: "Dark Mode",
      subtitle: "Switch surfaces to Obsidian dark mode",
      icon: Moon,
      action: () => setThemeMode("dark"),
    },
    {
      id: "theme-light",
      category: "Theme",
      title: "Light Mode",
      subtitle: "Switch surfaces to crisp clean light mode",
      icon: Sun,
      action: () => setThemeMode("light"),
    },
    {
      id: "accent-emerald",
      category: "Theme",
      title: "Accent: Emerald Green",
      subtitle: "Signature WhatsApp vibrant green",
      icon: Palette,
      badge: "WhatsApp",
      action: () => setThemeAccent("emerald"),
    },
    {
      id: "accent-violet",
      category: "Theme",
      title: "Accent: Modern Violet",
      subtitle: "Deep modern purple accent",
      icon: Palette,
      action: () => setThemeAccent("violet"),
    },
    {
      id: "accent-cobalt",
      category: "Theme",
      title: "Accent: Electric Cobalt",
      subtitle: "Dynamic vivid blue accent",
      icon: Palette,
      action: () => setThemeAccent("cobalt"),
    },
    {
      id: "accent-amber",
      category: "Theme",
      title: "Accent: Warm Amber",
      subtitle: "Warm sunset gold accent",
      icon: Palette,
      action: () => setThemeAccent("amber"),
    },
    {
      id: "accent-rose",
      category: "Theme",
      title: "Accent: Rose Pink",
      subtitle: "Vibrant high-contrast rose accent",
      icon: Palette,
      action: () => setThemeAccent("rose"),
    },
  ], [navigate, setThemeMode, setThemeAccent]);

  // Filter items based on query
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle?.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  }, [items, query]);

  // Reset selectedIndex when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle keyboard arrow navigation inside the list
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < filtered.length ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] w-[94vw] max-w-xl -translate-y-0 gap-0 overflow-hidden rounded-2xl border border-border/80 bg-popover/95 p-0 shadow-2xl backdrop-blur-xl sm:top-[15%]"
      >
        <DialogTitle className="sr-only">Quick Command & Search</DialogTitle>

        {/* Search input header */}
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3 sm:px-5">
          <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden items-center gap-1 rounded border border-border/80 bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-flex">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-2 sm:max-h-[380px]">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No results found for &ldquo;<span className="text-foreground">{query}</span>&rdquo;
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.action}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all",
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-foreground hover:bg-muted/70"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                        isSelected
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {item.title}
                        </span>
                        {item.badge && (
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider",
                              isSelected
                                ? "bg-primary-foreground/30 text-primary-foreground"
                                : "bg-primary/10 text-primary"
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <p
                          className={cn(
                            "truncate text-xs",
                            isSelected
                              ? "text-primary-foreground/80"
                              : "text-muted-foreground"
                          )}
                        >
                          {item.subtitle}
                        </p>
                      )}
                    </div>

                    {isSelected && (
                      <CornerDownLeft className="h-4 w-4 shrink-0 text-primary-foreground/70" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer shortcuts info */}
        <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-card px-1 text-[10px]">↑</kbd>
              <kbd className="rounded border border-border bg-card px-1 text-[10px]">↓</kbd>
              to navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-card px-1 text-[10px]">↵</kbd>
              to open
            </span>
          </div>
          <span className="hidden items-center gap-1 sm:inline-flex">
            <CommandIcon className="h-3 w-3" />
            WACRM Quick Search
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
