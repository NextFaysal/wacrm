"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface ShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
  category: "Navigation" | "Actions" | "General";
}

const SHORTCUTS: ShortcutItem[] = [
  { keys: ["J", "↓"], description: "Next conversation in list", category: "Navigation" },
  { keys: ["K", "↑"], description: "Previous conversation in list", category: "Navigation" },
  { keys: ["R"], description: "Quick reply (focus message composer)", category: "Actions" },
  { keys: ["E"], description: "Mark conversation closed / open", category: "Actions" },
  { keys: ["/"], description: "Trigger quick replies & actions in composer", category: "Actions" },
  { keys: ["⌘", "K"], description: "Open Spotlight Command Palette", category: "General" },
  { keys: ["?"], description: "Show this keyboard shortcuts cheat sheet", category: "General" },
  { keys: ["Esc"], description: "Close modal / deselect thread", category: "General" },
];

export function ShortcutsDialog({ open, onOpenChange }: ShortcutsDialogProps) {
  const categories: ShortcutItem["category"][] = ["Navigation", "Actions", "General"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 text-primary">
            <Keyboard className="h-5 w-5" />
            <DialogTitle className="text-base font-semibold">Inbox Keyboard Shortcuts</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Navigate conversations and execute CRM actions at lightning speed without touching the mouse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {categories.map((cat) => {
            const items = SHORTCUTS.filter((s) => s.category === cat);
            return (
              <div key={cat} className="space-y-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {cat}
                </h4>
                <div className="divide-y divide-border/40 rounded-lg border border-border/50 bg-muted/30">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-2 text-xs"
                    >
                      <span className="text-foreground">{item.description}</span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((k, kIdx) => (
                          <kbd
                            key={kIdx}
                            className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-card px-1.5 font-mono text-[10px] font-semibold text-foreground shadow-xs"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border/50 pt-2 text-center text-[11px] text-muted-foreground">
          Press <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">?</kbd> anywhere in the inbox to open this guide.
        </div>
      </DialogContent>
    </Dialog>
  );
}
