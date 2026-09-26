"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError] Uncaught error in dashboard segment:", error);
  }, [error]);

  return (
    <div className="flex h-[70vh] flex-col items-center justify-center p-4 text-center">
      <div className="flex max-w-md flex-col items-center rounded-2xl border border-border/80 bg-card p-6 shadow-lg sm:p-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
          Dashboard section couldn&apos;t load
        </h2>
        <p className="mt-2 text-xs text-muted-foreground sm:text-sm">
          {error.message || "A temporary issue occurred while rendering this view."}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
            Digest: {error.digest}
          </p>
        )}
        <div className="mt-5 flex items-center gap-3">
          <Button
            onClick={() => reset()}
            className="gap-2 rounded-xl"
            size="sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload section
          </Button>
          <Button
            variant="outline"
            onClick={() => window.location.reload()}
            className="rounded-xl"
            size="sm"
          >
            Full refresh
          </Button>
        </div>
      </div>
    </div>
  );
}
